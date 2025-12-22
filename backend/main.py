from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib
import pandas as pd
import numpy as np
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="D0 Bleaching Optimizer API")

# Setup CORS agar bisa diakses Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Di production ganti dengan URL frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 1. Load Model saat Startup ---
model = None
params = None

@app.on_event("startup")
def load_artifacts():
    global model, params
    try:
        model = joblib.load('d0_xgboost_model.pkl')
        params = joblib.load('d0_system_params.pkl')
        print("✓ Model & Params loaded successfully")
    except Exception as e:
        print(f"Error loading model: {e}")

# --- 2. Definisi Input Data (Schema) ---
class ProcessInput(BaseModel):
    kappa: float
    temperature: float
    ph: float
    inlet_brightness: float
    pulp_flow: float
    current_dose: float
    dose_trend: float = 0.0
    kappa_trend: float = 0.0

# --- 3. Endpoint Prediksi ---
@app.post("/predict")
def predict_dose(data: ProcessInput):
    if not model or not params:
        raise HTTPException(status_code=500, detail="Model not loaded")

    # A. Ambil Parameter Global
    K_TARGET = params['k_target']
    BIAS_INLET = params['bias_inlet']
    FEATURE_NAMES = params['feature_names']

    # B. Preprocessing Logic
    inlet_corrected = data.inlet_brightness - BIAS_INLET
    brightness_gap = 70.0 - inlet_corrected
    
    flow_stability = 0.0 

    # C. Mapping ke Format DataFrame Model
    input_dict = {
        'D0 Tower Inlet Kappa Q analyzer/Cormec/Polarox  Kappa': data.kappa,
        'D0 Tower Inlet Temperature': data.temperature,
        'D0 Tower Inlet pH': data.ph,
        'Inlet_Corrected': inlet_corrected,
        'DO  Stage Pulp Flow': data.pulp_flow,
        'Dose_Trend': data.dose_trend,
        'Kappa_Trend': data.kappa_trend,
        'Brightness_Gap': brightness_gap,
        'Flow_Stability': flow_stability
    }
    
    # Buat DataFrame dan urutkan kolom sesuai training
    df_input = pd.DataFrame([input_dict])
    df_input = df_input[FEATURE_NAMES] # Reorder columns

    # D. Prediksi (Core Logic)
    delta_k_pred = model.predict(df_input)[0]
    
    # Hitung K-Factor Optimal
    k_optimal = float(K_TARGET + delta_k_pred)
    
    # Hitung Base Dose
    rec_dose = k_optimal * data.kappa

    # E. Guardrails / Safety Logic
    final_dose = rec_dose
    status_msg = "OPTIMIZED"
    
    # Rate Limiter (Max change 20%)
    change = final_dose - data.current_dose
    max_change = data.current_dose * 0.20
    
    if abs(change) > max_change:
        final_dose = data.current_dose + np.sign(change) * max_change
        status_msg = "RATE_LIMITED (Max 20%)"

    final_dose = max(0.1, final_dose)

    return {
        "status": "success",
        "recommended_dose": round(final_dose, 2),
        "current_dose": data.current_dose,
        "delta": round(final_dose - data.current_dose, 2),
        "k_factor_optimal": round(k_optimal, 4),
        "k_factor_target": round(K_TARGET, 4),
        "control_status": status_msg
    }

