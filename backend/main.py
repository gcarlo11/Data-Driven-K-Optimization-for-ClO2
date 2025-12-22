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
        print("✓ Model Loaded (Balanced Version)")
    except Exception as e:
        print(f"Error: {e}")

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
        raise HTTPException(status_code=500, detail="Model not active")

    K_TARGET = params['k_target']
    BIAS_INLET = params['bias_inlet']
    FEATURE_NAMES = params['feature_names']

    # --- 1. PREPROCESSING ---
    # Hitung estimasi Brightness Outlet saat ini berdasarkan sensor Inlet
    estimated_outlet = data.inlet_brightness - BIAS_INLET
    
    # Hitung Brightness Gap (Target - Estimasi)
    brightness_gap = 70.0 - estimated_outlet
    
    # Mapping ke format Model
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
    
    df_input = pd.DataFrame([input_dict])
    df_input = df_input[FEATURE_NAMES]

    # --- 2. PREDIKSI ---
    delta_k_pred = model.predict(df_input)[0]
    k_optimal = float(K_TARGET + delta_k_pred)
    
    # Base Calculation
    rec_dose = k_optimal * data.kappa

    # --- 3. SAFETY GUARDRAILS (UPDATED) ---
    final_dose = rec_dose
    status_msg = "OPTIMIZED"
    
    # A. GUARDRAIL: MAINTAIN OPTIMAL (Logika Baru Anda!)
    # Jika estimasi brightness sudah di range bagus (69.5 - 70.5)
    # DAN prediksi perubahan K-Factor sangat kecil (< 0.02)
    # MAKA: Jangan ubah apapun.
    if (69.5 <= estimated_outlet <= 70.5) and (abs(delta_k_pred) < 0.02):
        final_dose = data.current_dose
        status_msg = "MAINTAIN_OPTIMAL"
    
    else:
        # B. GUARDRAIL: Logic Under/Over Bleach Standard
        # Jika Under-bleach (< 69.0), Dosis TIDAK BOLEH Turun
        if estimated_outlet < 69.0 and final_dose < data.current_dose:
            final_dose = data.current_dose * 1.05 # Paksa naik 5%
            status_msg = "GUARDRAIL_UNDERBLEACH"
            
        # Jika Over-bleach (> 71.0), Dosis TIDAK BOLEH Naik
        elif estimated_outlet > 71.0 and final_dose > data.current_dose:
            final_dose = data.current_dose * 0.95 # Paksa turun 5%
            status_msg = "GUARDRAIL_OVERBLEACH"
            
        # C. Rate Limiter (Max 20%)
        # Hanya berlaku jika tidak masuk kondisi MAINTAIN
        else:
            change = final_dose - data.current_dose
            max_change = data.current_dose * 0.20
            if abs(change) > max_change:
                final_dose = data.current_dose + np.sign(change) * max_change
                status_msg = "RATE_LIMITED"

    # Clip Safety
    final_dose = max(0.1, final_dose)

    return {
        "recommended_dose": round(final_dose, 2),
        "current_dose": data.current_dose,
        "delta": round(final_dose - data.current_dose, 2),
        "k_optimal": round(k_optimal, 4),
        "k_current": round(data.current_dose / data.kappa, 4),
        "estimated_outlet": round(estimated_outlet, 2), # Kirim balik untuk UI
        "control_status": status_msg
    }