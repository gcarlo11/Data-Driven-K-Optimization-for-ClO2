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

# Global variables
model = None
params = None

@app.on_event("startup")
def load_artifacts():
    global model, params
    try:
        model = joblib.load('d0_xgboost_model.pkl')
        params = joblib.load('d0_system_params.pkl')
        print("✓ Model Loaded")
    except Exception as e:
        print(f"Error: {e}")

# --- 1. UPDATE PARAMETER SESUAI REQUEST ---
class ProcessInput(BaseModel):
    kappa: float              # Kappa Number
    temperature: float        # Tower Inlet Temperature
    ph: float                 # Tower Inlet pH
    inlet_brightness: float   # Inlet Brightness
    pulp_flow: float          # D0 Stage Pulp Flow
    current_dose: float       # Current ClO2 Dose

@app.post("/predict")
def predict_dose(data: ProcessInput):
    if not model or not params:
        raise HTTPException(status_code=500, detail="Model not active")

    K_TARGET = params['k_target']
    BIAS_INLET = params['bias_inlet']
    FEATURE_NAMES = params['feature_names']

    # --- 2. PREPROCESSING OTOMATIS ---
    # Menghitung fitur turunan secara internal
    inlet_corrected = data.inlet_brightness - BIAS_INLET
    brightness_gap = 70.0 - inlet_corrected
    
    # Asumsi steady state (karena user tidak input trend)
    dose_trend = 0.0
    kappa_trend = 0.0
    flow_stability = 0.0

    # Mapping ke format Model (XGBoost butuh nama kolom exact)
    input_dict = {
        'D0 Tower Inlet Kappa Q analyzer/Cormec/Polarox  Kappa': data.kappa,
        'D0 Tower Inlet Temperature': data.temperature,
        'D0 Tower Inlet pH': data.ph,
        'Inlet_Corrected': inlet_corrected,
        'DO  Stage Pulp Flow': data.pulp_flow,
        'Dose_Trend': dose_trend,
        'Kappa_Trend': kappa_trend,
        'Brightness_Gap': brightness_gap,
        'Flow_Stability': flow_stability
    }
    
    df_input = pd.DataFrame([input_dict])
    df_input = df_input[FEATURE_NAMES] # Urutkan kolom

    # --- 3. PREDIKSI ---
    delta_k_pred = model.predict(df_input)[0]
    k_optimal = float(K_TARGET + delta_k_pred)
    rec_dose = k_optimal * data.kappa

    # Safety Guardrails
    final_dose = rec_dose
    status_msg = "OPTIMIZED"
    
    change = final_dose - data.current_dose
    max_change = data.current_dose * 0.20
    
    if abs(change) > max_change:
        final_dose = data.current_dose + np.sign(change) * max_change
        status_msg = "RATE LIMITED"

    final_dose = max(0.1, final_dose)

    # Kita kirim data tambahan untuk Grafik
    return {
        "recommended_dose": round(final_dose, 2),
        "current_dose": data.current_dose,
        "delta": round(final_dose - data.current_dose, 2),
        "k_optimal": round(k_optimal, 4),
        "k_current": round(data.current_dose / data.kappa, 4), # Untuk grafik perbandingan
        "control_status": status_msg
    }