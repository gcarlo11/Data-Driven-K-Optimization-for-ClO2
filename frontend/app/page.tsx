'use client';
import { useState } from 'react';
import axios from 'axios';

export default function Home() {
  const [formData, setFormData] = useState({
    kappa: 10.5,
    temperature: 60.0,
    ph: 2.5,
    inlet_brightness: 71.0,
    pulp_flow: 650.0,
    current_dose: 25.0
  });

  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: any) => {
    setFormData({
      ...formData,
      [e.target.name]: parseFloat(e.target.value)
    });
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post('http://127.0.0.1:8000/predict', formData);
      setResult(response.data);
    } catch (error) {
      console.error("Error connecting to API", error);
      alert("Gagal koneksi ke Backend API");
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-800">🧪 D0 Bleaching Optimizer</h1>
          <p className="text-slate-500">AI-Powered Chemical Dosing Recommendation</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="md:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="font-semibold mb-4 text-slate-700">Process Conditions</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase">Inlet Kappa</label>
                <input type="number" step="0.1" name="kappa" value={formData.kappa} onChange={handleChange} 
                  className="w-full mt-1 p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-slate-800" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase">Pulp Flow (ADt/h)</label>
                <input type="number" step="10" name="pulp_flow" value={formData.pulp_flow} onChange={handleChange} 
                  className="w-full mt-1 p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-slate-800" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase">Inlet Brightness</label>
                <input type="number" step="0.1" name="inlet_brightness" value={formData.inlet_brightness} onChange={handleChange} 
                  className="w-full mt-1 p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-slate-800" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase">Current Dose (kg)</label>
                <input type="number" step="0.1" name="current_dose" value={formData.current_dose} onChange={handleChange} 
                  className="w-full mt-1 p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-slate-800" />
              </div>

              <input type="hidden" name="temperature" value={formData.temperature} />
              <input type="hidden" name="ph" value={formData.ph} />

              <button type="submit" disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors mt-4">
                {loading ? 'Calculating...' : 'Get Recommendation'}
              </button>
            </form>
          </div>

          <div className="md:col-span-2">
            {result ? (
              <div className="space-y-6">
                
                <div className="bg-white p-8 rounded-xl shadow-lg border-t-4 border-blue-500">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-500 font-medium">Recommended ClO₂ Setpoint</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      result.control_status === 'OPTIMIZED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {result.control_status}
                    </span>
                  </div>
                  
                  <div className="flex items-end gap-4">
                    <span className="text-6xl font-bold text-slate-800">{result.recommended_dose}</span>
                    <span className="text-xl text-slate-500 mb-2">kg/h</span>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-100 flex gap-6 text-sm">
                    <div>
                      <span className="block text-slate-400">Current</span>
                      <span className="font-semibold text-slate-700">{result.current_dose} kg/h</span>
                    </div>
                    <div>
                      <span className="block text-slate-400">Adjustment</span>
                      <span className={`font-semibold ${result.delta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {result.delta > 0 ? '+' : ''}{result.delta} kg/h
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <span className="text-xs text-slate-400 uppercase font-bold">Optimal K-Factor</span>
                    <div className="text-2xl font-bold text-slate-700 mt-1">{result.k_factor_optimal}</div>
                    <p className="text-xs text-slate-500 mt-1">Efficiency metric for current state</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <span className="text-xs text-slate-400 uppercase font-bold">Target K-Factor</span>
                    <div className="text-2xl font-bold text-slate-400 mt-1">{result.k_factor_target}</div>
                    <p className="text-xs text-slate-500 mt-1">Plant Baseline</p>
                  </div>
                </div>

              </div>
            ) : (
              <div className="h-full flex items-center justify-center bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 text-slate-400">
                <p>Enter parameters and click Calculate to see AI recommendations</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </main>
  );
}