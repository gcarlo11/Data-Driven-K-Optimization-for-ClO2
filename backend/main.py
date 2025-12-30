from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib
import pandas as pd
import numpy as np
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="D0 Bleaching Optimizer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Artifacts
optimizer_model = None
predictor_model = None
predictor_features = None
system_params = None

@app.on_event("startup")
def load_artifacts():
    global optimizer_model, predictor_model, predictor_features, system_params
    try:
        # Model Optimizer (XGBoost Delta K - 14 Fitur)
        optimizer_model = joblib.load('d0_xgboost_model_v3.pkl')
        system_params = joblib.load('d0_system_params_v3.pkl')
        
        # Model Predictor (XGBoost - 8 Fitur sesuai snippet Anda)
        predictor_model = joblib.load('d0_predictor_model_v3.pkl')
        predictor_features = joblib.load('d0_predictor_features_v3.pkl')
        
        print("✓ All AI Models Loaded Successfully")
    except Exception as e:
        print(f"❌ Error loading: {e}")

class ProcessInput(BaseModel):
    kappa: float
    temperature: float
    ph: float
    inlet_brightness: float
    current_dose: float
    production_rate: float  # ADT/d
    consistency: float       # %

@app.post("/predict")
def predict_dose(data: ProcessInput):
    if not optimizer_model or not predictor_model:
        raise HTTPException(status_code=500, detail="Model not initialized")

    # 1. RUMUS FISIKA & FLOW INLET
    # Flow = (Prod Rate * 100) / (0.9 * Consistency)
    flow_inlet = (data.production_rate * 100) / (0.9 * data.consistency)
    # Retention = (450 / Flow) * 60
    retention_time = (450 / flow_inlet) * 60
    # K-Factor Raw untuk Predictor
    k_factor_raw = data.current_dose / (data.kappa + 0.1)

    k_current = data.current_dose / (data.kappa + 0.1)
    
    # 2. PREDICTOR VIRTUAL SENSOR (8 FITUR - Perbaikan Shape Mismatch)
    # Pastikan nama key sesuai dengan PREDICTOR_FEATURES saat training
    pred_input_dict = {
        'Kappa': data.kappa,
        'Temperature': data.temperature,
        'Flow': flow_inlet,
        'pH': data.ph,
        'Brightness_Inlet': data.inlet_brightness,
        'Retention_Time': retention_time,
        'ClO2_Dosage': data.current_dose,
        'K_Factor_Raw': k_factor_raw 
    }
    
    # Slicing menggunakan predictor_features memastikan urutan dan jumlah (8 kolom) tepat
    df_pred = pd.DataFrame([pred_input_dict])[predictor_features]
    estimated_outlet = float(predictor_model.predict(df_pred)[0])
        
    # 3. OPTIMIZER MODEL (14 FITUR ENHANCED)
    K_TARGET = system_params['k_target']
    FEATURE_NAMES = system_params['feature_names'] # List 14 fitur
    
    input_dict_opt = {
        'Flow': flow_inlet,
        'Retention_Time': retention_time,
        'Brightness_Inlet': data.inlet_brightness,
        'Kappa': data.kappa,
        'Temperature': data.temperature,
        'pH': data.ph,
        'ClO2_Trend': 0.0,
        'Kappa_Trend': 0.0,
        'Flow_Trend': 0.0,
        'Brightness_Gap': 70.0 - data.inlet_brightness,
        'Flow_Stability': 0.0,
        'Temp_Stability': 0.0,
        'Kappa_Flow_Interaction': (data.kappa * flow_inlet) / 1000,
        'Retention_Efficiency': (retention_time * data.temperature) / 100
    }
    
    df_opt = pd.DataFrame([input_dict_opt])[FEATURE_NAMES]
    delta_k_pred = optimizer_model.predict(df_opt)[0]
    k_optimal = float(K_TARGET + delta_k_pred)
    raw_ai_dose = k_optimal * data.kappa

    # 4. DECISION LOGIC & GUARDRAILS
    final_dose = raw_ai_dose
    status_msg = "OPTIMIZATION_ACTION"
    diff = raw_ai_dose - data.current_dose

    # Guardrails
    if estimated_outlet < 69.0 and final_dose < data.current_dose:
        final_dose = data.current_dose * 1.05
        status_msg = "GUARDRAIL_UNDERBLEACH"
    elif estimated_outlet > 71.0 and final_dose > data.current_dose:
        final_dose = data.current_dose * 0.95
        status_msg = "GUARDRAIL_OVERBLEACH"
    
    if 69.5 <= estimated_outlet <= 70.5 and abs(delta_k_pred) < 0.10:
        final_dose = data.current_dose
        status_msg = "MAINTAIN_OPTIMAL"

    return {
        "recommended_dose": round(final_dose, 2),
        "current_dose": data.current_dose,
        "delta": round(final_dose - data.current_dose, 2),
        "flow_calculated": round(flow_inlet, 2),
        "retention_calculated": round(retention_time, 1),
        "estimated_outlet": round(estimated_outlet, 2),
        "k_optimal": round(k_optimal, 4), # Metrik K Optimal
        "k_current": round(k_current, 4), # Metrik K Saat Ini
        "control_status": status_msg
    }