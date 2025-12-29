'use client';

import { useState } from 'react';
import axios from 'axios';
import { 
  ComposedChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  Scatter 
} from 'recharts';
import { 
  Activity, 
  Droplets, 
  FlaskConical, 
  Gauge, 
  ArrowRight, 
  AlertTriangle, 
  CheckCircle, 
  ShieldCheck, 
  TrendingUp 
} from 'lucide-react';

interface FormData {
  kappa: number;
  temperature: number;
  ph: number;
  inlet_brightness: number;
  pulp_flow: number;
  current_dose: number;
}

interface ApiResult {
  recommended_dose: number;
  current_dose: number;
  delta: number;
  k_optimal: number;
  k_current: number;
  estimated_outlet: number;
  control_status: string;
}

export default function Home() {
  const [formData, setFormData] = useState<FormData>({
    kappa: 8.5,
    temperature: 75.0,
    ph: 2.2,
    inlet_brightness: 70,
    pulp_flow: 750.0,
    current_dose: 25.0
  });

  const [result, setResult] = useState<ApiResult | null>(null);
  const [graphData, setGraphData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setFormData({ 
      ...formData, 
      [e.target.name]: isNaN(val) ? 0 : val 
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await axios.post('http://127.0.0.1:8000/predict', formData);
      const res = response.data;
      setResult(res);

      setGraphData([
        {
          name: 'Current Status',
          brightness: res.estimated_outlet,
          dose: res.current_dose,
          type: 'current'
        },
        {
          name: 'AI Recommendation',
          brightness: 70.0,
          dose: res.recommended_dose,
          type: 'target'
        }
      ]);

    } catch (err) {
      setError('Gagal terhubung ke Server.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'MAINTAIN_OPTIMAL': return 'bg-blue-50 border-blue-500 text-blue-800';
      case 'OPTIMIZATION_ACTION': return 'bg-green-50 border-green-500 text-green-800';
      case 'GUARDRAIL_UNDERBLEACH': 
      case 'GUARDRAIL_OVERBLEACH': return 'bg-orange-50 border-orange-500 text-orange-900';
      case 'RATE_LIMITED': return 'bg-yellow-50 border-yellow-500 text-yellow-900';
      default: return 'bg-slate-50 border-slate-300 text-slate-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'MAINTAIN_OPTIMAL': return <ShieldCheck className="w-6 h-6 text-blue-600" />;
      case 'OPTIMIZATION_ACTION': return <TrendingUp className="w-6 h-6 text-green-600" />;
      case 'RATE_LIMITED': return <Activity className="w-6 h-6 text-yellow-600" />;
      default: return <AlertTriangle className="w-6 h-6 text-orange-600" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'MAINTAIN_OPTIMAL': return 'KONDISI OPTIMAL (MAINTAIN)';
      case 'OPTIMIZATION_ACTION': return 'REKOMENDASI OPTIMASI';
      case 'GUARDRAIL_UNDERBLEACH': return 'SAFETY: UNDER-BLEACH DETECTED';
      case 'GUARDRAIL_OVERBLEACH': return 'SAFETY: OVER-BLEACH DETECTED';
      case 'RATE_LIMITED': return 'PENYESUAIAN BERTAHAP (STEP-UP)';
      default: return status;
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto">
        
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <FlaskConical className="w-8 h-8 text-blue-600" />
              D0 Bleaching Optimizer
            </h1>
            <p className="text-slate-500 mt-1 ml-11">AI-Driven ClO₂ Dosage Control System</p>
          </div>
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm text-sm font-medium text-slate-600">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            System Online
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="font-semibold text-lg mb-6 flex items-center gap-2 text-slate-700 border-b pb-4">
                <Gauge className="w-5 h-5" /> Process Parameters
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-5">
                
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-1">
                    <Activity className="w-3 h-3" /> Kappa Number
                  </label>
                  <input type="number" step="0.1" name="kappa" 
                    value={formData.kappa} onChange={handleChange} 
                    className="input-field" placeholder="e.g. 10.5" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1">Temp (°C)</label>
                    <input type="number" step="1" name="temperature" 
                      value={formData.temperature} onChange={handleChange} 
                      className="input-field" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1">pH Level</label>
                    <input type="number" step="0.1" name="ph" 
                      value={formData.ph} onChange={handleChange} 
                      className="input-field" />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-4">
                   <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1">Inlet Brightness (%ISO)</label>
                    <input type="number" step="0.1" name="inlet_brightness" 
                      value={formData.inlet_brightness} onChange={handleChange} 
                      className="input-field" />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-1">
                      <Droplets className="w-3 h-3" /> Pulp Flow (m³/h)
                    </label>
                    <input type="number" step="10" name="pulp_flow" 
                      value={formData.pulp_flow} onChange={handleChange} 
                      className="input-field" />
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mt-4">
                  <label className="text-xs font-bold text-blue-800 uppercase mb-1">Current ClO₂ Dose (SP)</label>
                  <input type="number" step="0.1" name="current_dose" 
                    value={formData.current_dose} onChange={handleChange} 
                    className="w-full p-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-lg font-semibold text-slate-800" />
                </div>

                <button type="submit" disabled={loading} 
                  className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-slate-200 flex justify-center items-center gap-2 group">
                  {loading ? 'Analyzing...' : <>Calculate Optimization <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>}
                </button>
              </form>
            </div>
            
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-200 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
              </div>
            )}
          </div>

          <div className="lg:col-span-8 space-y-6">
            {result ? (
              <>

                <div className={`relative overflow-hidden p-8 rounded-2xl shadow-lg border-l-8 transition-all duration-300 ${getStatusColor(result.control_status)}`}>
                  <div className="relative z-10">
                    <div className="flex flex-col md:flex-row justify-between md:items-start gap-4 mb-6">
                      
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/60 rounded-full backdrop-blur-sm">
                          {getStatusIcon(result.control_status)}
                        </div>
                        <div>
                          <h3 className="text-xs font-bold opacity-70 uppercase tracking-wide">System Status</h3>
                          <span className="font-bold text-lg">{getStatusText(result.control_status)}</span>
                        </div>
                      </div>

                      <div className="text-right bg-white/40 p-3 rounded-lg backdrop-blur-sm min-w-[140px]">
                        <p className="text-xs opacity-70 font-bold uppercase">Inlet Quality (Lab Eq)</p>
                        <p className="text-2xl font-bold">{result.estimated_outlet} <span className="text-sm font-normal">%ISO</span></p>
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-end gap-6">
                      <div>
                        <span className="text-xs font-bold opacity-70 uppercase block mb-1">Recommended Setpoint</span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-6xl font-extrabold tracking-tight">{result.recommended_dose}</span>
                          <span className="text-xl font-medium opacity-80">kg Ac Cl</span>
                        </div>
                      </div>

                      <div className={`mb-3 px-4 py-2 rounded-lg border backdrop-blur-sm ${
                        result.delta === 0 ? 'bg-blue-100/50 border-blue-200 text-blue-800' : 
                        result.delta > 0 ? 'bg-red-100/50 border-red-200 text-red-800' : 'bg-green-100/50 border-green-200 text-green-800'
                      }`}>
                         <span className="text-xs font-bold uppercase mr-2">Adjustment:</span>
                         <span className="text-lg font-bold">
                           {result.delta > 0 ? '▲' : result.delta < 0 ? '▼' : ''} {Math.abs(result.delta)} kg
                         </span>
                      </div>
                    </div>

                    {result.control_status === 'MAINTAIN_OPTIMAL' && (
                      <p className="mt-6 text-sm font-medium opacity-90 bg-white/50 p-3 rounded-lg inline-flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Dosis saat ini sudah sesuai dengan rekomendasi AI. Pertahankan setpoint.
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <MetricCard label="Target Efficiency (Model)" value={result.k_optimal} sub="K-Factor" />
                  <MetricCard label="Current Efficiency" value={result.k_current} sub="K-Factor" />
                  <MetricCard 
                    label="Dose Deviation" 
                    value={`${((result.delta / result.current_dose) * 100).toFixed(1)}%`} 
                    sub="Percentage" 
                    highlight={result.delta !== 0}
                  />
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-blue-500" /> 
                      Operational Sensitivity
                    </h3>
                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded font-mono">Kappa ± 2.0</span>
                  </div>
                  
                  <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        
                        <XAxis 
                          dataKey="brightness" 
                          type="number" 
                          domain={[Math.floor(formData.inlet_brightness), 72]} 
                          name="Brightness"
                          unit="%ISO"
                          label={{ value: 'Brightness (%ISO)', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 12 }} 
                          tick={{ fill: '#64748b', fontSize: 12 }}
                        />
                        
                        <YAxis 
                          dataKey="dose" 
                          type="number"
                          name="Dose"
                          unit=" kg/h"
                          label={{ value: 'ClO₂ Dose (SP)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12 }} 
                          tick={{ fill: '#64748b', fontSize: 12 }}
                        />
                        
                        <Tooltip 
                          cursor={{ strokeDasharray: '3 3' }}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend verticalAlign="top" height={36}/>
                        
                        <Scatter 
                          name="Current Status" 
                          data={[graphData[0]]} 
                          fill="#ef4444" 
                          shape="circle"
                        />
                        
                        <Scatter 
                          name="AI Target (70% ISO)" 
                          data={[graphData[1]]} 
                          fill="#3b82f6" 
                          shape="star"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-full min-h-[500px] flex flex-col items-center justify-center bg-white rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 p-8 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <ArrowRight className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-semibold text-slate-600">Ready to Optimize</h3>
                <p className="max-w-xs mt-2 text-sm">Masukkan parameter proses di panel kiri dan klik tombol calculate untuk mendapatkan rekomendasi AI.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .input-field {
          width: 100%;
          padding: 12px;
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          outline: none;
          color: #1e293b;
          font-weight: 500;
          transition: all 0.2s;
        }
        .input-field:focus {
          background-color: #ffffff;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
      `}</style>
    </main>
  );
}

function MetricCard({ label, value, sub, highlight = false }: { label: string, value: string | number, sub: string, highlight?: boolean }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-2 ${highlight ? 'text-blue-600' : 'text-slate-700'}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-1">{sub}</p>
    </div>
  );
}