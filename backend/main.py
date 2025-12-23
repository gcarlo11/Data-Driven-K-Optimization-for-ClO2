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
        # Load Model Optimizer (Yang lama)
        model = joblib.load('d0_xgboost_model.pkl')
        params = joblib.load('d0_system_params.pkl')
        
        # Load Model Predictor (Yang baru dibuat)
        predictor_model = joblib.load('d0_predictor_model.pkl')
        predictor_features = joblib.load('d0_predictor_features.pkl')
        
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

    # Ambil Parameter
    K_TARGET = params['k_target']
    BIAS_INLET = params['bias_inlet']
    FEATURE_NAMES = params['feature_names']
    TARGET_SETPOINT = 70.0

    # 1. FEATURE ENGINEERING 
    pred_input = pd.DataFrame([{
        'D0 Tower Inlet Kappa Q analyzer/Cormec/Polarox  Kappa': data.kappa,
        'D0 Tower Inlet Temperature': data.temperature,
        'DO  Stage Pulp Flow': data.pulp_flow,
        'D0 Tower Inlet pH': data.ph,
        'D0 Tower Inlet Brightness': data.inlet_brightness,
        'D0 Stage ClO2 flow SP': data.current_dose
    }])[predictor_features]
    
    # AI Menebak Outlet saat ini
    estimated_outlet = predictor_model.predict(pred_input)[0]
    
    # Hitung Gap
    brightness_gap = 70.0 - estimated_outlet    
    
    # Input ke Model
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
    
    # Target Dosis Murni AI (Untuk mencapai 70.0 pas)
    raw_ai_dose = k_optimal * data.kappa

    # 3. LOGIC DECISION (Sesuai Request Anda)
    final_dose = raw_ai_dose
    status_msg = "OPTIMIZATION_ACTION"
    
    # Cek apakah estimasi saat ini SUDAH MASUK Range Aman (69.0 - 71.0)?
    is_in_safe_range = 69.0 <= estimated_outlet <= 71.0
    
    # Hitung selisih saran AI vs Current
    diff = raw_ai_dose - data.current_dose

    # --- RULE 1: SAFE RANGE (Permintaan Utama Anda) ---
    # Jika estimasi outlet sudah 69-71, maka bilangnya OPTIMAL.
    # Kecuali AI mendeteksi anomali parah (beda dosis > 3kg), kita tahan di current.
    if is_in_safe_range:
        # Cek apakah AI "halu" minta perubahan besar padahal sudah aman
        if abs(diff) < 3.0: 
            final_dose = data.current_dose
            status_msg = "MAINTAIN_OPTIMAL"
        else:
            # Jika range aman tapi AI minta ubah drastis, kita batasi (Rate Limit)
            # Ini jarang terjadi, biasanya saat Kappa berubah drastis tiba-tiba
            status_msg = "RATE_LIMITED" # Akan kena logic rate limiter di bawah

    # --- RULE 2: USER SATISFACTION ---
    # Jika user sudah input angka yang mirip saran AI (< 0.5kg)
    elif abs(diff) <= 0.5:
        final_dose = data.current_dose
        status_msg = "MAINTAIN_OPTIMAL"
        
    # --- RULE 3: GUARDRAILS (Jika Belum Optimal / Di Luar Range) ---
    else:
        # GUARDRAIL A: Under-bleach (< 69.0) -> HARUS NAIK
        if estimated_outlet < 69.0:
            if final_dose < data.current_dose:
                final_dose = data.current_dose * 1.05 # Paksa naik 5%
                status_msg = "GUARDRAIL_UNDERBLEACH"
            else:
                status_msg = "OPTIMIZATION_ACTION" # Naik normal sesuai AI

        # GUARDRAIL B: Over-bleach (> 71.0) -> HARUS TURUN
        elif estimated_outlet > 71.0:
            if final_dose > data.current_dose:
                final_dose = data.current_dose * 0.95 # Paksa turun 5%
                status_msg = "GUARDRAIL_OVERBLEACH"
            else:
                status_msg = "OPTIMIZATION_ACTION" # Turun normal sesuai AI

    # --- FINAL SAFETY: RATE LIMITER ---
    # Pastikan perubahan tidak pernah > 20% dalam kondisi apapun (kecuali maintain)
    if status_msg != "MAINTAIN_OPTIMAL":
        change = final_dose - data.current_dose
        max_change = data.current_dose * 0.20
        
        if abs(change) > max_change:
            final_dose = data.current_dose + np.sign(change) * max_change
            status_msg = "RATE_LIMITED"

    # Clip Safety (Agar tidak negatif)
    final_dose = max(0.1, min(final_dose, 50.0))

    return {
        "recommended_dose": round(final_dose, 2),
        "current_dose": data.current_dose,
        "delta": round(final_dose - data.current_dose, 2),
        "k_optimal": round(k_optimal, 4),
        "k_current": round(data.current_dose / data.kappa, 4),
        "estimated_outlet": round(estimated_outlet, 2),
        "control_status": status_msg
    }