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
import { Activity, Droplets, Thermometer, FlaskConical, Gauge, ArrowRight, AlertTriangle, CheckCircle, ShieldCheck } from 'lucide-react';

// --- TIPE DATA ---
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
  // --- STATE ---
  const [formData, setFormData] = useState<FormData>({
    kappa: 8.5,
    temperature: 70.0,
    ph: 2.5,
    inlet_brightness: 71.0,
    pulp_flow: 800.0,
    current_dose: 25.0
  });

  const [result, setResult] = useState<ApiResult | null>(null);
  const [graphData, setGraphData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // --- HANDLERS ---
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
    setError('');
    
    try {
      // 1. Panggil API
      const response = await axios.post('http://127.0.0.1:8000/predict', formData);
      const res: ApiResult = response.data;
      setResult(res);

      // 2. Generate Data Grafik (Operational Map)
      // Kita buat simulasi: Apa yang terjadi jika Kappa berubah +/- 2 point?
      const points = [];
      const centerKappa = Number(formData.kappa);
      
      for (let i = -4; i <= 4; i++) {
        const k_sim = centerKappa + (i * 0.5); // Step 0.5
        
        if (k_sim > 0) {
          points.push({
            kappa: Number(k_sim.toFixed(1)),
            // Garis Rekomendasi AI
            optimalLine: Number((k_sim * res.k_optimal).toFixed(2)),
            // Garis Settingan Saat Ini
            currentLine: Number((k_sim * res.k_current).toFixed(2)),
          });
        }
      }
      setGraphData(points);

    } catch (err) {
      console.error(err);
      setError('Gagal terhubung ke Server Model (Backend mati atau error).');
    } finally {
      setLoading(false);
    }
  };

  // --- LOGIC UI STATUS ---
  const getStatusColor = (status: string) => {
    if (status === 'MAINTAIN_OPTIMAL') return 'bg-blue-50 border-blue-500 text-blue-700';
    if (status === 'OPTIMIZED') return 'bg-green-50 border-green-500 text-green-700';
    if (status.includes('GUARDRAIL')) return 'bg-orange-50 border-orange-500 text-orange-800';
    return 'bg-yellow-50 border-yellow-500 text-yellow-800';
  };

  const getStatusIcon = (status: string) => {
    if (status === 'MAINTAIN_OPTIMAL') return <ShieldCheck className="w-6 h-6 text-blue-600" />;
    if (status === 'OPTIMIZED') return <CheckCircle className="w-6 h-6 text-green-600" />;
    return <AlertTriangle className="w-6 h-6 text-orange-600" />;
  };

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <header className="mb-8 text-center md:text-left">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center justify-center md:justify-start gap-3">
            <FlaskConical className="w-8 h-8 text-blue-600" />
            D0 Bleaching Optimizer
          </h1>
          <p className="text-slate-500 mt-2 ml-11">AI-Driven ClO₂ Dosage Control System</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* --- KOLOM KIRI: INPUT FORM --- */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="font-semibold text-lg mb-6 flex items-center gap-2 text-slate-700 border-b pb-4">
                <Gauge className="w-5 h-5" /> Process Parameters
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-5">
                
                {/* Group 1: Pulp Properties */}
                <div className="space-y-4">
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
                </div>

                {/* Group 2: Flow & Brightness */}
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

                {/* Group 3: Current State */}
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <label className="text-xs font-bold text-blue-800 mb-1">Current ClO₂ Dose (kg Ac Cl)</label>
                  <input type="number" step="0.1" name="current_dose" 
                    value={formData.current_dose} onChange={handleChange} 
                    className="w-full p-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-lg font-semibold text-slate-800" />
                </div>

                <button type="submit" disabled={loading} 
                  className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-slate-200 flex justify-center items-center gap-2">
                  {loading ? 'Analyzing...' : <>Calculate Optimization <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>
            </div>
            
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> {error}
              </div>
            )}
          </div>

          {/* --- KOLOM KANAN: RESULT DASHBOARD --- */}
          <div className="lg:col-span-8 space-y-6">
            {result ? (
              <>
                {/* 1. KARTU REKOMENDASI UTAMA */}
                <div className={`relative overflow-hidden p-8 rounded-2xl shadow-lg border-l-8 transition-all ${getStatusColor(result.control_status)}`}>
                  <div className="relative z-10">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-sm font-bold opacity-70 uppercase tracking-wide">Recommended Action</h3>
                        <div className="flex items-center gap-2 mt-1">
                          {getStatusIcon(result.control_status)}
                          <span className="font-bold text-lg">{result.control_status.replace('_', ' ')}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm opacity-70 font-medium">Estimated Outlet</p>
                        <p className="text-2xl font-bold">{result.estimated_outlet} %ISO</p>
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-end gap-6 mt-8">
                      <div>
                        <span className="text-6xl font-extrabold tracking-tight">{result.recommended_dose}</span>
                        <span className="text-xl font-medium ml-2 opacity-80">kg/h</span>
                      </div>

                      {/* Delta Indicator */}
                      <div className="mb-2 px-4 py-2 bg-white/50 rounded-lg backdrop-blur-sm border border-white/20">
                         <span className="text-sm font-semibold text-slate-600 uppercase mr-2">Adjustment:</span>
                         <span className={`text-lg font-bold ${
                           result.delta === 0 ? 'text-slate-500' : 
                           result.delta > 0 ? 'text-red-600' : 'text-green-600'
                         }`}>
                           {result.delta > 0 ? '▲' : result.delta < 0 ? '▼' : ''} {Math.abs(result.delta)} kg
                         </span>
                      </div>
                    </div>

                    {result.control_status === 'MAINTAIN_OPTIMAL' && (
                      <p className="mt-6 text-sm font-medium opacity-80 bg-white/40 p-3 rounded-lg inline-block">
                        💡 Sistem mendeteksi kondisi proses sudah optimal. Mempertahankan dosis saat ini adalah strategi terbaik.
                      </p>
                    )}
                  </div>
                </div>

                {/* 2. GRID METRICS */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <MetricCard label="Plant Efficiency (K-Target)" value={result.k_optimal} sub="Baseline" />
                  <MetricCard label="Current Efficiency" value={result.k_current} sub="Real-time" />
                  <MetricCard 
                    label="Dose Deviation" 
                    value={`${((result.delta / result.current_dose) * 100).toFixed(1)}%`} 
                    sub="Percentage" 
                    highlight={result.delta !== 0}
                  />
                </div>

                {/* 3. CHART SECTION */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-slate-700">Operational Map: Sensitivity Analysis</h3>
                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded">Kappa ± 2.0</span>
                  </div>
                  
                  <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={graphData} margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis 
                          dataKey="kappa" 
                          type="number" 
                          domain={['auto', 'auto']}
                          label={{ value: 'Kappa Number', position: 'insideBottom', offset: -10, fill: '#94a3b8' }} 
                          tick={{ fill: '#64748b' }}
                        />
                        <YAxis 
                          label={{ value: 'ClO₂ Dose (kg)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }} 
                          tick={{ fill: '#64748b' }}
                        />
                        <Tooltip 
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend verticalAlign="top" height={36}/>
                        
                        {/* Garis Current (Abu-abu putus-putus) */}
                        <Line 
                          type="monotone" 
                          dataKey="currentLine" 
                          stroke="#cbd5e1" 
                          strokeDasharray="5 5" 
                          name="Current Efficiency Strategy" 
                          dot={false} 
                          strokeWidth={2} 
                        />
                        
                        {/* Garis AI (Hijau Solid) */}
                        <Line 
                          type="monotone" 
                          dataKey="optimalLine" 
                          stroke="#10b981" 
                          name="AI Optimized Strategy" 
                          strokeWidth={3} 
                          dot={false} 
                          activeDot={{ r: 8 }}
                        />
                        
                        {/* Titik Posisi User */}
                        <Scatter 
                          name="Your Current Position" 
                          data={[{
                            kappa: Number(formData.kappa), 
                            optimalLine: Number(result.recommended_dose) // Plot di garis optimal
                          }]} 
                          fill="#ef4444" 
                          shape="circle"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            ) : (
              // EMPTY STATE
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

      {/* Styles inline untuk input field */}
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

// Komponen Kecil untuk Metric
function MetricCard({ label, value, sub, highlight = false }: { label: string, value: string | number, sub: string, highlight?: boolean }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-2 ${highlight ? 'text-blue-600' : 'text-slate-700'}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-1">{sub}</p>
    </div>
  );
}