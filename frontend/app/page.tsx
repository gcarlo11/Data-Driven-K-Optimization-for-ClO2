'use client';
import { useState } from 'react';
import axios from 'axios';
import { 
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Scatter 
} from 'recharts';

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
  const [graphData, setGraphData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: parseFloat(e.target.value) });
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post('http://127.0.0.1:8000/predict', formData);
      const res = response.data;
      setResult(res);
      

      const points = [];
      const centerKappa = Number(formData.kappa);
      for (let i = -2; i <= 2; i++) {
        const k_sim = centerKappa + (i * 0.5); 
        if (k_sim > 0) {
            points.push({
                kappa: Number(k_sim.toFixed(1)),
                optimalLine: Number((k_sim * res.k_optimal).toFixed(2)), 
                currentLine: Number((k_sim * res.k_current).toFixed(2)),
            });
        }
      }
      setGraphData(points);

    } catch (error) {
      alert("Gagal koneksi ke API");
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6 font-sans text-slate-800">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-left text-slate-800">D0 Bleaching Optimizer</h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
            <h2 className="font-semibold mb-4 text-slate-700 border-b pb-2">Input Parameters</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs font-bold text-slate-500">Kappa Number</label>
                    <input type="number" step="0.1" name="kappa" value={formData.kappa} onChange={handleChange} className="input-field" />
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500">Temperature (°C)</label>
                    <input type="number" step="1" name="temperature" value={formData.temperature} onChange={handleChange} className="input-field" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs font-bold text-slate-500">Inlet pH</label>
                    <input type="number" step="0.1" name="ph" value={formData.ph} onChange={handleChange} className="input-field" />
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500">Inlet Brightness</label>
                    <input type="number" step="0.1" name="inlet_brightness" value={formData.inlet_brightness} onChange={handleChange} className="input-field" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500">Pulp Flow (ADt/h)</label>
                <input type="number" step="10" name="pulp_flow" value={formData.pulp_flow} onChange={handleChange} className="input-field w-full" />
              </div>

              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                <label className="text-xs font-bold text-blue-700">Current ClO₂ Dose (kg/h)</label>
                <input type="number" step="0.1" name="current_dose" value={formData.current_dose} onChange={handleChange} className="input-field w-full border-blue-300 focus:ring-blue-500" />
              </div>

              <button type="submit" disabled={loading} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-lg mt-4 transition-all">
                {loading ? 'Calculating...' : 'Optimize Process ⚡'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-8 space-y-6">
            {result ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-green-500">
                        <p className="text-sm text-slate-500 font-medium">Recommended Dose</p>
                        <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-4xl font-bold text-slate-800">{result.recommended_dose}</span>
                            <span className="text-sm text-slate-500">kg/h</span>
                        </div>
                        <div className={`mt-2 text-sm font-bold ${result.delta >= 0 ? 'text-red-500' : 'text-green-600'}`}>
                            {result.delta > 0 ? `+${result.delta}` : result.delta} kg vs Current
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-blue-500">
                        <p className="text-sm text-slate-500 font-medium">K-Factor Efficiency</p>
                        <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-4xl font-bold text-slate-800">{result.k_optimal}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">Target Efficiency based on Model</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-slate-700 mb-4">📈 Operational Map: Kappa vs ClO₂ Dose</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={graphData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis 
                                    dataKey="kappa" 
                                    type="number"  
                                    domain={['auto', 'auto']} 
                                    tickCount={5}
                                    label={{ value: 'Kappa Number', position: 'insideBottom', offset: -10 }} 
                                />
                                <YAxis label={{ value: 'ClO₂ Dose (kg)', angle: -90, position: 'insideLeft' }} />
                                <Tooltip />
                                <Legend verticalAlign="top" height={36}/>
                                
                                <Line type="monotone" dataKey="currentLine" stroke="#94a3b8" strokeDasharray="5 5" name="Current Setting" dot={false} strokeWidth={2} />
                                
                                <Line type="monotone" dataKey="optimalLine" stroke="#10b981" name="AI Optimization" strokeWidth={3} dot={false} />
                                
                                <Scatter 
                                    name="Current Position" 
                                    data={[{
                                        kappa: Number(formData.kappa), 
                                        optimalLine: Number(result.recommended_dose) 
                                    }]} 
                                    fill="red" 
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                    <p className="text-xs text-center text-slate-400 mt-2">
                        Garis Hijau menunjukkan dosis optimal untuk berbagai nilai Kappa. 
                        Garis Putus-putus abu-abu adalah efisiensi settingan Anda saat ini.
                    </p>
                </div>
              </>
            ) : (
                <div className="h-full flex flex-col items-center justify-center bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 min-h-[400px]">
                    <span className="text-4xl mb-2">👈</span>
                    <p>Enter data on the left to start</p>
                </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .input-field {
            width: 100%;
            margin-top: 4px;
            padding: 10px;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            outline: none;
            color: #1e293b;
            font-size: 0.9rem;
        }
        .input-field:focus {
            border-color: #3b82f6;
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
        }
      `}</style>
    </main>
  );
}