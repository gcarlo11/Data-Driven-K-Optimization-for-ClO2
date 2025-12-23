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

model = None
params = None

@app.on_event("startup")
def load_artifacts():
    global model, params
    try:
        model = joblib.load('d0_xgboost_model.pkl')
        params = joblib.load('d0_system_params.pkl')
        print("✓ Model Loaded & Dynamic Bias Active")
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

    if params.get('bias_type') == 'dynamic':
        slope = params['bias_slope']
        intercept = params['bias_intercept']
        estimated_outlet = (slope * data.inlet_brightness) + intercept
    else:
        
        estimated_outlet = data.inlet_brightness - params['bias_inlet']

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
    
    df_input = pd.DataFrame([input_dict])[params['feature_names']]

    delta_k_pred = model.predict(df_input)[0]
    k_optimal = float(params['k_target'] + delta_k_pred)
    raw_rec_dose = k_optimal * data.kappa

    final_dose = raw_rec_dose
    
    DEADBAND = 0.5
    dose_diff = final_dose - data.current_dose
    
    status_msg = "OPTIMIZATION_ACTION" 
  
    if (69.0 <= estimated_outlet <= 71.0) and (abs(dose_diff) < DEADBAND):
        final_dose = data.current_dose
        status_msg = "MAINTAIN_OPTIMAL"
    
    
    else:
        if estimated_outlet < 69.0 and final_dose < data.current_dose:
            final_dose = data.current_dose * 1.05
            status_msg = "GUARDRAIL_UNDERBLEACH"
        
        elif estimated_outlet > 71.0 and final_dose > data.current_dose:
            final_dose = data.current_dose * 0.95
            status_msg = "GUARDRAIL_OVERBLEACH"
        
        else:
            change = final_dose - data.current_dose
            max_change = data.current_dose * 0.20
            
            if abs(change) > max_change:
                final_dose = data.current_dose + np.sign(change) * max_change
                status_msg = "RATE_LIMITED"
            elif abs(change) >= DEADBAND:
                 status_msg = "OPTIMIZATION_ACTION" 

    
    final_dose = max(0.1, final_dose)

    return {
        "recommended_dose": round(final_dose, 2),
        "current_dose": data.current_dose,
        "delta": round(final_dose - data.current_dose, 2),
        "k_optimal": round(k_optimal, 4),
        "k_current": round(data.current_dose / data.kappa, 4),
        "estimated_outlet": round(estimated_outlet, 2),
        "control_status": status_msg
    }