from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib
import pandas as pd
import numpy as np
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="D0 Bleaching Optimizer API")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

predictor_model = None
predictor_features = None

@app.on_event("startup")
def load_artifacts():
    global model, params, predictor_model, predictor_features
    try:
        # Model Optimizer 
        model = joblib.load('d0_xgboost_model.pkl')
        params = joblib.load('d0_system_params.pkl')
        
        # Model Predictor
        predictor_model = joblib.load('d0_predictor_model_v2.pkl')
        predictor_features = joblib.load('d0_predictor_features_v2.pkl')
        
        print("✓ All AI Models Loaded Successfully")
    except Exception as e:
        print(f"❌ Error loading: {e}")

class ProcessInput(BaseModel):
    kappa: float
    temperature: float
    ph: float
    inlet_brightness: float
    pulp_flow: float
    current_dose: float

@app.post("/predict")
def predict_dose(data: ProcessInput):
    if not model or not params:
        raise HTTPException(status_code=500, detail="Model not initialized")

    # Parameter
    K_TARGET = params['k_target']
    BIAS_INLET = params['bias_inlet']
    FEATURE_NAMES = params['feature_names']
    TARGET_SETPOINT = 70.0
    k_factor_raw = data.current_dose / (data.kappa + 0.1)
    
    pred_input_dict = {
        'D0 Tower Inlet Kappa Q analyzer/Cormec/Polarox  Kappa': data.kappa,
        'D0 Tower Inlet Temperature': data.temperature,
        'DO  Stage Pulp Flow': data.pulp_flow,
        'D0 Tower Inlet pH': data.ph,
        'D0 Tower Inlet Brightness': data.inlet_brightness,
        'D0 Stage ClO2 flow SP': data.current_dose,
        'K_Factor_Raw': k_factor_raw 
    }
    
    df_pred = pd.DataFrame([pred_input_dict])[predictor_features]

    estimated_outlet = float(predictor_model.predict(df_pred)[0])
        
    brightness_gap = 70.0 - estimated_outlet    
    
    input_dict = {
        'D0 Tower Inlet Kappa Q analyzer/Cormec/Polarox  Kappa': data.kappa,
        'D0 Tower Inlet Temperature': data.temperature,
        'D0 Tower Inlet pH': data.ph,
        'Inlet_Corrected': estimated_outlet,
        'DO  Stage Pulp Flow': data.pulp_flow,
        'Dose_Trend': 0.0,
        'Kappa_Trend': 0.0,
        'Brightness_Gap': brightness_gap,
        'Flow_Stability': 0.0
    }
    
    df_input = pd.DataFrame([input_dict])[FEATURE_NAMES]

    # 2. PREDIKSI CORE
    delta_k_pred = model.predict(df_input)[0]
    k_optimal = float(K_TARGET + delta_k_pred)
    
    # Target Dosis Murni AI 
    raw_ai_dose = k_optimal * data.kappa

    # 3. LOGIC DECISION 
    final_dose = raw_ai_dose
    status_msg = "OPTIMIZATION_ACTION"
    
    # Selisih AI vs Current
    diff = raw_ai_dose - data.current_dose
    
    # Range: 69.0 sampai 71.0
    is_in_safe_range = 69.0 <= estimated_outlet <= 71.0

    #  RULE 0: ANTI-GREEDY (Hanya berlaku di 70.0 - 71.0)
    if (70.0 <= estimated_outlet <= 71.0) and diff > 0:
        final_dose = data.current_dose
        status_msg = "MAINTAIN_OPTIMAL"

    # RULE 1: SAFE RANGE
    elif is_in_safe_range:
        if abs(diff) < 0.5: 
            final_dose = data.current_dose
            status_msg = "MAINTAIN_OPTIMAL"
        else:
            status_msg = "RATE_LIMITED" 

    # RULE 2: USER SATISFACTION  
    elif abs(diff) <= 0.5 and estimated_outlet <= 71.0:
        final_dose = data.current_dose
        status_msg = "MAINTAIN_OPTIMAL"
        
    # RULE 3: GUARDRAILS & ACTION
    else:
        # GUARDRAIL A: Under-bleach (< 69.0)
        if estimated_outlet < 69.0:
            if final_dose < data.current_dose:
                final_dose = data.current_dose * 1.05 
                status_msg = "GUARDRAIL_UNDERBLEACH"
            else:
                status_msg = "OPTIMIZATION_ACTION"

        # GUARDRAIL B: Over-bleach (> 71.0)
        elif estimated_outlet > 71.0:
            if final_dose > data.current_dose:
                final_dose = data.current_dose * 0.95 
                status_msg = "GUARDRAIL_OVERBLEACH"
            else:
                status_msg = "OPTIMIZATION_ACTION" 


    LIMIT_PERCENTAGE = 0.50 

    if "GUARDRAIL" in status_msg:
        LIMIT_PERCENTAGE = 0.50 

    if status_msg != "MAINTAIN_OPTIMAL":
        change = final_dose - data.current_dose
        max_change = data.current_dose * LIMIT_PERCENTAGE
        
        if abs(change) > max_change:
            final_dose = data.current_dose + np.sign(change) * max_change
            
            if "GUARDRAIL" not in status_msg:
                status_msg = "RATE_LIMITED"

    final_dose = max(0.1, min(final_dose, 50.0))

    return {
        "recommended_dose": round(final_dose, 2),
        "current_dose": data.current_dose,
        "delta": round(final_dose - data.current_dose, 2),
        "k_optimal": round(k_optimal, 4),
        "k_current": round(data.current_dose / data.kappa, 4),
        "estimated_outlet": round(estimated_outlet, 2),
        "inlet_brightness": data.inlet_brightness, 
        "control_status": status_msg
    }