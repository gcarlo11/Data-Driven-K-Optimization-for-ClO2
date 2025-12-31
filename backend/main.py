from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib
import pandas as pd
import numpy as np
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="D0 Bleaching Optimizer API - CORRECTED WITH FUTURE SIMULATION")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

optimizer_model = None
predictor_model = None
predictor_features = None
optimizer_features = None
system_params = None

TARGET_BRIGHTNESS = 70.0
STEADY_STATE_LOWER = 69.0  
STEADY_STATE_UPPER = 71.0  
ERROR_TOLERANCE = 1.0      
SEARCH_TOLERANCE = 0.1

# --- [ADDED] KONSTANTA UNTUK SIMULASI MASA DEPAN ---
DOSE_INLET_SENSITIVITY = 0.15  # Estimasi: Turun 1 kg Dosis = Inlet masa depan turun 0.15 poin
MIN_PUMP_FLOW = 5.0            # Batas teknis pompa terendah

@app.on_event("startup")
def load_artifacts():
    global optimizer_model, predictor_model, predictor_features, optimizer_features, system_params
    try:
        optimizer_model = joblib.load('d0_xgboost_model_v3.pkl')
        predictor_model = joblib.load('d0_predictor_model_v3.pkl')
        
        predictor_features = joblib.load('d0_predictor_features_v3.pkl')
        system_params = joblib.load('d0_system_params_v3.pkl')
        
        optimizer_features = system_params.get('feature_names', [])
        
        print("✓ All Models Loaded Successfully")
        print(f"  - Predictor features: {len(predictor_features)}")
        print(f"  - Optimizer features: {len(optimizer_features)}")
        print(f"  - K-Target: {system_params.get('k_target', 'N/A')}")
        
    except Exception as e:
        print(f"❌ Error loading models: {e}")
        raise

class ProcessInput(BaseModel):
    kappa: float
    temperature: float
    ph: float
    inlet_brightness: float
    current_dose: float
    production_rate: float  
    consistency: float      

class OptimizationResponse(BaseModel):
    recommended_dose: float
    current_dose: float
    delta_dose: float
    estimated_outlet_current: float
    predicted_outlet_optimized: float
    k_optimal: float
    k_current: float
    flow_calculated: float
    retention_calculated: float
    control_status: str
    reason: str

def calculate_process_params(production_rate: float, consistency: float):
    """Calculate Flow and Retention Time from production rate"""
    # Flow = (Production * 100) / (efficiency * consistency)
    flow_inlet = (production_rate * 100) / (0.9 * consistency)
    # Retention Time = (Volume / Flow) * 60
    retention_time = (450 / flow_inlet) * 60
    
    return flow_inlet, retention_time

# --- [MODIFIED] Menambahkan parameter override_inlet untuk simulasi masa depan ---
def predict_outlet_brightness(
    predictor_model,
    predictor_features,
    kappa: float,
    temperature: float,
    flow: float,
    ph: float,
    inlet_brightness: float,
    retention_time: float,
    clo2_dose: float,
    override_inlet: float = None # Parameter tambahan
) -> float:
    """
    STAGE 1: Predict outlet brightness (VIRTUAL SENSOR)
    """
    # Gunakan override_inlet jika ada (Future Simulation), jika tidak pakai data sensor asli
    eff_inlet = override_inlet if override_inlet is not None else inlet_brightness

    k_factor = clo2_dose / (kappa + 0.1)
    
    clo2_per_ton = clo2_dose / (flow + 1.0)
    
    pred_input = {
        'Kappa': kappa,
        'Temperature': temperature,
        'Flow': flow,
        'pH': ph,
        'Brightness_Inlet': eff_inlet, # Updated variable
        'Retention_Time': retention_time,
        'ClO2_Dosage': clo2_dose,
        'K_Factor_Raw': k_factor,
        'ClO2_per_Ton': clo2_per_ton 
    }
    
    df_pred = pd.DataFrame([pred_input])[predictor_features]
    outlet_pred = float(predictor_model.predict(df_pred)[0])
    
    return outlet_pred

def optimize_dose_binary_search(
    predictor_model,
    predictor_features,
    optimizer_model,
    optimizer_features,
    k_target: float,
    process_data: dict,
    target_brightness: float = TARGET_BRIGHTNESS
) -> dict:
    """
    STAGE 2: Find MINIMUM ClO2 dose that achieves target brightness
    """
    
    # Unpack process data
    kappa = process_data['kappa']
    temperature = process_data['temperature']
    flow = process_data['flow']
    ph = process_data['ph']
    inlet_brightness = process_data['inlet_brightness']
    retention_time = process_data['retention_time']
    
    brightness_gap = target_brightness - inlet_brightness
    
    opt_input = {
        'Flow': flow,
        'Retention_Time': retention_time,
        'Brightness_Inlet': inlet_brightness,
        'Kappa': kappa,
        'Temperature': temperature,
        'pH': ph,
        'ClO2_Trend': 0.0,
        'Kappa_Trend': 0.0,
        'Flow_Trend': 0.0,
        'Brightness_Gap': brightness_gap,
        'Flow_Stability': 0.0,
        'Temp_Stability': 0.0,
        'Kappa_Flow_Interaction': (kappa * flow) / 1000,
        'Retention_Efficiency': (retention_time * temperature) / 100
    }
    
    df_opt = pd.DataFrame([opt_input])[optimizer_features]
    delta_k_pred = optimizer_model.predict(df_opt)[0]
    k_optimal_hint = k_target + delta_k_pred
    dose_hint = k_optimal_hint * kappa
    
    # Binary search bounds 
    dose_min = max(MIN_PUMP_FLOW, dose_hint * 0.5) # Updated min bound
    dose_max = min(60.0, dose_hint * 1.5)
    
    # Binary search
    best_dose = None
    best_outlet = None
    
    max_iterations = 50
    tolerance = 0.1  
    
    for iteration in range(max_iterations):
        dose_test = (dose_min + dose_max) / 2
        
        # Predict outlet with this dose
        outlet_pred = predict_outlet_brightness(
            predictor_model, predictor_features,
            kappa, temperature, flow, ph, inlet_brightness,
            retention_time, dose_test
        )
        
        error = outlet_pred - target_brightness
        
        if abs(error) <= tolerance:
            if best_dose is None or dose_test < best_dose:
                best_dose = dose_test
                best_outlet = outlet_pred
            
            dose_max = dose_test
        else:
            if error < 0:  
                dose_min = dose_test
            else:  
                dose_max = dose_test
        
        # Convergence check
        if dose_max - dose_min < 0.1:
            break
    
    # If no solution found, use best available
    if best_dose is None:
        best_dose = (dose_min + dose_max) / 2
        best_outlet = predict_outlet_brightness(
            predictor_model, predictor_features,
            kappa, temperature, flow, ph, inlet_brightness,
            retention_time, best_dose
        )
    
    return {
        'optimal_dose': best_dose,
        'predicted_outlet': best_outlet,
        'k_optimal': best_dose / (kappa+ 0.1),
        'optimizer_hint': dose_hint,
        'iterations': iteration + 1
    }

@app.post("/predict", response_model=OptimizationResponse)
def predict_dose(data: ProcessInput):
    if not optimizer_model or not predictor_model:
        raise HTTPException(status_code=500, detail="Models not initialized")
    
    try:
        # CALCULATE PROCESS PARAMETER
        flow_inlet, retention_time = calculate_process_params(
            data.production_rate, data.consistency
        )
        k_current = data.current_dose / (data.kappa + 0.1)
        K_TARGET = system_params['k_target']
        
        # VIRTUAL SENSOR (CURRENT REALITY)
        estimated_outlet = predict_outlet_brightness(
            predictor_model, predictor_features,
            data.kappa, data.temperature, flow_inlet, data.ph,
            data.inlet_brightness, retention_time, data.current_dose
        )
        
        # CONTROL LAW - Steady State 69.0 - 71.0 (FIXED BUG)
        if STEADY_STATE_LOWER <= estimated_outlet <= STEADY_STATE_UPPER:
            return OptimizationResponse(
                recommended_dose=data.current_dose,
                current_dose=data.current_dose,
                delta_dose=0.0,
                estimated_outlet_current=estimated_outlet,
                predicted_outlet_optimized=estimated_outlet,
                k_optimal=k_current, 
                k_current=k_current,
                flow_calculated=flow_inlet,
                retention_calculated=retention_time,
                control_status="HOLD_STEADY",
                reason=f"Steady State: Brightness {estimated_outlet:.2f}% sudah masuk rentang target (69-71%)"
            )
        
        # --- [ADDED LOGIC] HIGH INLET / OVER-BLEACH HANDLING ---
        future_inlet = data.inlet_brightness # Default: tidak berubah
        optimal_dose = 0.0
        predicted_outlet = 0.0
        status = ""
        reason = ""

        # Jika Inlet Brightness Tinggi (Over-bleach potential)
        if data.inlet_brightness >= (TARGET_BRIGHTNESS - 0.5):
            # 1. Hitung Kelebihan Brightness di Outlet
            excess = estimated_outlet - TARGET_BRIGHTNESS
            if excess < 0: excess = 0

            # 2. Hitung Dosis yang harus dipotong (Reverse Engineering)
            # Rumus: Excess / Sensitivity
            dose_cut_needed = excess / DOSE_INLET_SENSITIVITY
            target_dose = data.current_dose - dose_cut_needed
            
            # 3. Tentukan Optimal Dose (min 5.0 kg)
            optimal_dose = max(MIN_PUMP_FLOW, target_dose)
            
            # 4. Simulasi Masa Depan (Future Inlet Simulation)
            actual_cut = data.current_dose - optimal_dose
            estimated_drop = actual_cut * DOSE_INLET_SENSITIVITY
            future_inlet = data.inlet_brightness - estimated_drop
            
            status = "DEEP_CUT_MODE"
            
            # [REQUESTED MESSAGE] Tampilan spesifik yang Anda minta
            reason = f"Over-bleach detected. Cutting {actual_cut:.1f} kg to drop future Inlet by ~{estimated_drop:.1f} pts."
            
            # 5. Prediksi Outlet menggunakan FUTURE INLET (Agar hasil mendekati 70%)
            predicted_outlet = predict_outlet_brightness(
                predictor_model, predictor_features,
                data.kappa, data.temperature, flow_inlet, data.ph,
                data.inlet_brightness, retention_time, optimal_dose,
                override_inlet=future_inlet # Kunci logika 70%
            )
            
            k_optimal = optimal_dose / (data.kappa + 0.1)

        else:
            # --- NORMAL LOGIC (BINARY SEARCH) ---
            process_data = {
                'kappa': data.kappa,
                'temperature': data.temperature,
                'flow': flow_inlet,
                'ph': data.ph,
                'inlet_brightness': data.inlet_brightness,
                'retention_time': retention_time
            }
            
            optimization_result = optimize_dose_binary_search(
                predictor_model, predictor_features,
                optimizer_model, optimizer_features,
                K_TARGET, process_data, TARGET_BRIGHTNESS
            )
            
            optimal_dose = optimization_result['optimal_dose']
            predicted_outlet = optimization_result['predicted_outlet']
            k_optimal = optimization_result['k_optimal']
            
            status = "OPTIMIZED"
            reason = f"Target adjustment from {estimated_outlet:.1f}% to {TARGET_BRIGHTNESS:.1f}%"
        
        # STEP 5: SAFETY GUARDRAILS
        dose_change = optimal_dose - data.current_dose
        final_dose = optimal_dose
        
        # Guardrail 1: Directional safety 
        if "DEEP_CUT" not in status:
            if estimated_outlet < STEADY_STATE_LOWER and dose_change < 0:
                final_dose = data.current_dose * 1.02
                status = "SAFETY_UNDERBLEACH"
                reason = "Under-target, prevented dose decrease"
            elif estimated_outlet > STEADY_STATE_UPPER and dose_change > 0:
                final_dose = data.current_dose * 0.98
                status = "SAFETY_OVERBLEACH"
                reason = "Over-target, prevented dose increase"
        
        # Guardrail 2: Rate limiter (±20% max change)
        actual_change = final_dose - data.current_dose
        max_change = data.current_dose * 0.20
        
        if abs(actual_change) > max_change:
            final_dose = data.current_dose + np.sign(actual_change) * max_change
            if "SAFETY" not in status:
                status = "RATE_LIMITED"
                # Jika kena rate limit di mode Deep Cut, update pesan agar tetap jujur
                if "DEEP_CUT" in status:
                    limited_cut = data.current_dose - final_dose
                    est_drop_limited = limited_cut * DOSE_INLET_SENSITIVITY
                    future_inlet = data.inlet_brightness - est_drop_limited # Update simulasi future
                    reason = f"Over-bleach detected. Cutting {limited_cut:.1f} kg (Rate Limited) to drop future Inlet by ~{est_drop_limited:.1f} pts."
                else:
                    reason = f"Change limited to ±20% ({max_change:.2f} kg/adt)"
        
        # Guardrail 3: Absolute bounds
        final_dose = np.clip(final_dose, MIN_PUMP_FLOW, 60.0)
        
        # Final Prediction (Using Future Inlet if Deep Cut was active)
        final_predicted_outlet = predict_outlet_brightness(
            predictor_model, predictor_features,
            data.kappa, data.temperature, flow_inlet, data.ph,
            data.inlet_brightness, retention_time, final_dose,
            override_inlet=future_inlet
        )
        
        final_k = final_dose / (data.kappa + 0.1)
        
        # RETURN RESPONSE
        return OptimizationResponse(
            recommended_dose=round(final_dose, 2),
            current_dose=data.current_dose,
            delta_dose=round(final_dose - data.current_dose, 2),
            estimated_outlet_current=round(estimated_outlet, 2),
            predicted_outlet_optimized=round(final_predicted_outlet, 2),
            k_optimal=round(final_k, 4),
            k_current=round(k_current, 4),
            flow_calculated=round(flow_inlet, 2),
            retention_calculated=round(retention_time, 1),
            control_status=status,
            reason=reason
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Optimization error: {str(e)}")

@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "models_loaded": all([
            optimizer_model is not None,
            predictor_model is not None,
            predictor_features is not None,
            system_params is not None
        ])
    }

@app.get("/")
def root():
    """Root endpoint"""
    return {
        "message": "D0 Bleaching Optimizer API - CORRECTED VERSION",
        "version": "2.0",
        "architecture": "Two-Stage (Predictor → Optimizer)",
        "endpoints": {
            "POST /predict": "Get optimized ClO2 dose recommendation",
            "GET /health": "Check API health"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)