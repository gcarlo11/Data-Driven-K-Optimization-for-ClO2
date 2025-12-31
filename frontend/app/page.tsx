'use client';

import { useState, useMemo } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ComposedChart, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, Scatter
} from 'recharts';
import { 
  FlaskConical, ArrowRight, AlertTriangle, TrendingUp,
  Clock, Beaker, Zap, Settings, Info, RefreshCcw, Search, Droplets
} from 'lucide-react';

// --- Interfaces sesuai Backend Two-Stage Architecture ---
interface FormData {
  kappa: number;
  temperature: number;
  ph: number;
  inlet_brightness: number;
  current_dose: number;
  production_rate: number;
  consistency: number;
}

interface ApiResult {
  recommended_dose: number;
  current_dose: number;
  delta_dose: number;
  estimated_outlet_current: number;
  predicted_outlet_optimized: number;
  k_optimal: number;
  k_current: number;
  flow_calculated: number;
  retention_calculated: number;
  control_status: string;
  reason: string;
}

export default function Home() {
  const [formData, setFormData] = useState<FormData>({
    kappa: 8.5,
    temperature: 75.0,
    ph: 2.2,
    inlet_brightness: 65,
    current_dose: 25.0,
    production_rate: 70,
    consistency: 10.5
  });

  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [graphData, setGraphData] = useState<any[]>([]);

  // Preview kalkulasi parameter proses secara real-time
  const livePreview = useMemo(() => {
    const flow = (formData.production_rate * 100) / (0.9 * formData.consistency);
    const retention = flow > 0 ? (450 / flow) * 60 : 0;
    return {
      flow: isFinite(flow) ? flow.toFixed(2) : '0',
      retention: isFinite(retention) ? retention.toFixed(1) : '0'
    };
  }, [formData.production_rate, formData.consistency]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setFormData(prev => ({ 
      ...prev, 
      [e.target.name]: isNaN(val) ? 0 : val 
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.post('http://127.0.0.1:8000/predict', formData);
      const res = response.data;
      setResult(res);

      setGraphData([
        { 
          name: 'Current State', 
          brightness: res.estimated_outlet_current, 
          dose: res.current_dose,
        },
        { 
          name: 'Target (70% ISO)', 
          brightness: res.predicted_outlet_optimized, 
          dose: res.recommended_dose,
        }
      ]);
    } catch (err) {
      setError('Gagal terhubung ke backend. Pastikan server FastAPI aktif di port 8000.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusTheme = (status: string) => {
    const themes: Record<string, any> = {
      HOLD_STEADY: { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', icon: <RefreshCcw />, label: 'STEADY STATE' },
      OPTIMIZED: { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: <TrendingUp />, label: 'OPTIMIZED' },
      SAFETY_UNDERBLEACH: { color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', icon: <AlertTriangle />, label: 'SAFETY LIMIT' },
      SAFETY_OVERBLEACH: { color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', icon: <AlertTriangle />, label: 'SAFETY LIMIT' },
      RATE_LIMITED: { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', icon: <Zap />, label: 'RATE LIMITED' }
    };
    return themes[status] || { color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', icon: <Info />, label: status };
  };

  return (
    <main className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 lg:p-12 font-sans selection:bg-blue-100">
      <div className="max-w-[1440px] mx-auto">
        
        {/* Header Dashboard */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200">
                <FlaskConical className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                D0 <span className="text-blue-600">Optimizer</span>
                <span className="ml-3 text-xs bg-slate-200 px-2 py-1 rounded-md text-slate-500 font-bold uppercase tracking-widest">v0.4</span>
              </h1>
            </div>
            <p className="text-slate-500 font-bold text-xs uppercase tracking-widest opacity-75">Industrial Two-Stage AI Control</p>
          </motion.div>
          <div className="bg-white px-5 py-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
            <span className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs font-black text-slate-600 uppercase tracking-wider">Predictor Engine Online</span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Sidebar Parameter Input */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-4">
            <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 p-8 lg:sticky lg:top-10">
              <div className="flex items-center gap-3 mb-8 pb-4 border-b border-slate-50">
                <Settings className="w-5 h-5 text-blue-500" />
                <h2 className="font-black text-xl text-slate-800 uppercase">Input Data</h2>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Produksi & Fisika</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <InputGroup label="Prod Rate (ADT)" name="production_rate" value={formData.production_rate} onChange={handleChange} />
                    <InputGroup label="Consistency (%)" name="consistency" value={formData.consistency} onChange={handleChange} step="0.1" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <LiveStat label="Flow Inlet" value={livePreview.flow} unit="m³/h" />
                    <LiveStat label="Retention" value={livePreview.retention} unit="min" />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-50">
                  <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Parameter Proses</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <InputGroup label="Kappa In" name="kappa" value={formData.kappa} onChange={handleChange} step="0.1" />
                    <InputGroup label="pH Level" name="ph" value={formData.ph} onChange={handleChange} step="0.1" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <InputGroup label="Temp (°C)" name="temperature" value={formData.temperature} onChange={handleChange} />
                    <InputGroup label="Inlet Bright" name="inlet_brightness" value={formData.inlet_brightness} onChange={handleChange} step="0.1" />
                  </div>
                </div>

                <div className="bg-slate-900 p-6 rounded-[1.5rem] shadow-lg">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest">Current ClO₂ Dose (Setpoint)</label>
                  <div className="relative">
                    <input 
                      type="number" step="0.1" name="current_dose" 
                      value={formData.current_dose} onChange={handleChange}
                      className="w-full bg-white/10 border-2 border-white/20 rounded-xl px-4 py-3 text-2xl font-black text-white focus:bg-white focus:text-slate-900 outline-none transition-all" 
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-500">kg Ac Cl</span>
                  </div>
                </div>

                <button 
                  type="submit" disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-100 disabled:bg-slate-300 flex justify-center items-center gap-3 uppercase tracking-widest text-sm"
                >
                  {loading ? 'Processing...' : <>Mulai Optimasi <Search className="w-5 h-5" /></>}
                </button>
              </form>
            </div>
          </motion.div>

          {/* Panel Hasil Dashboard */}
          <div className="lg:col-span-8 space-y-6">
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div key="result" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
                  
                  {/* Banner Rekomendasi Utama */}
                  <div className={`rounded-[2.5rem] border-b-[10px] p-8 sm:p-10 shadow-2xl transition-all ${getStatusTheme(result.control_status).bg} ${getStatusTheme(result.control_status).border}`}>
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-8 mb-10">
                      <div className="flex items-center gap-5">
                        <div className="p-4 rounded-[1.5rem] bg-white shadow-sm ring-1 ring-slate-100">
                          {getStatusTheme(result.control_status).icon}
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">AI Decision</p>
                          <h3 className={`text-2xl font-black ${getStatusTheme(result.control_status).color}`}>
                            {getStatusTheme(result.control_status).label}
                          </h3>
                        </div>
                      </div>
                      <div className="bg-white/60 backdrop-blur-xl px-8 py-5 rounded-[1.5rem] border border-white text-right shadow-sm w-full sm:w-auto">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Prediksi Lab Saat Ini</p>
                        <p className="text-4xl font-black text-slate-900 leading-none">{result.estimated_outlet_current.toFixed(2)}<span className="text-lg font-bold opacity-30 ml-1">%ISO</span></p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-end gap-10">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest">Rekomendasi Dosis Baru</p>
                        <div className="flex items-baseline gap-4">
                          <span className="text-8xl sm:text-9xl font-black tracking-tighter text-slate-900 leading-[0.8]">{result.recommended_dose.toFixed(2)}</span>
                          <span className="text-2xl font-bold text-slate-400 uppercase">SP</span>
                        </div>
                      </div>
                      <div className={`mb-4 px-6 py-3 rounded-2xl border-2 flex items-center gap-4 ${result.delta_dose >= 0 ? 'bg-rose-100/50 border-rose-200 text-rose-700' : 'bg-emerald-100/50 border-emerald-200 text-emerald-700'}`}>
                        <span className="text-xs font-black uppercase tracking-widest opacity-60">Delta:</span>
                        <span className="text-2xl font-black">{result.delta_dose > 0 ? '+' : ''}{result.delta_dose.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-white/50 flex items-start gap-3">
                      <Info className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm font-bold text-slate-600 italic">"{result.reason}"</p>
                    </div>
                  </div>

                  {/* Matriks Performa */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <MetricCard 
                      label="Optimal K-Factor" 
                      // Jika status HOLD_STEADY, tampilkan "-", jika tidak tampilkan angka
                      value={result.control_status === 'HOLD_STEADY' ? '-' : result.k_optimal.toFixed(4)} 
                      sub="Efficiency Target" 
                      highlight 
                    />
                    
                    <MetricCard 
                      label="Current K-Factor" 
                      value={result.k_current.toFixed(4)} 
                      sub="Actual Ratio" 
                    />

                    <MetricCard 
                      label="Est. Outlet" 
                      value={result.predicted_outlet_optimized.toFixed(2)} 
                      sub="Target ISO" 
                    />

                    <MetricCard 
                      label="Efficiency" 
                      value={result.control_status === 'HOLD_STEADY' ? '100.0%' : `${((result.k_optimal / result.k_current) * 100).toFixed(1)}%`} 
                      sub="Action Yield" 
                    />
                  </div>

                  {/* Operational Chart */}
                  <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="font-black text-lg text-slate-800 uppercase flex items-center gap-3">
                        <TrendingUp className="w-5 h-5 text-blue-500" /> Analysis Map
                      </h3>
                      <div className="flex gap-4 text-[10px] font-black uppercase text-slate-400">
                        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-rose-500 rounded-full"/> Current</div>
                        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-blue-500 rounded-full"/> Target</div>
                      </div>
                    </div>
                    <div className="h-[350px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart margin={{ top: 20, right: 30, bottom: 40, left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="brightness" type="number" domain={['auto', 'auto']} fontSize={10} fontWeight="bold" tick={{ fill: '#94a3b8' }} />
                          <YAxis dataKey="dose" type="number" domain={['auto', 'auto']} fontSize={10} fontWeight="bold" tick={{ fill: '#94a3b8' }} />
                          <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                          <Scatter name="Kondisi Sekarang" data={[graphData[0]]} fill="#F43F5E" />
                          <Scatter name="Target Optimasi" data={[graphData[1]]} fill="#3B82F6" shape="star" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </motion.div>
              ) : (
                /* Empty State */
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full min-h-[600px] flex flex-col items-center justify-center bg-white rounded-[3rem] border-4 border-dashed border-slate-100 text-slate-300 p-12 text-center">
                  <Beaker className="w-20 h-20 mb-8 opacity-20" />
                  <h3 className="text-3xl font-black text-slate-400 mb-4">Industrial Optimizer</h3>
                  <p className="max-w-md font-bold uppercase text-[10px] tracking-[0.2em] leading-loose">
                    Masukkan data parameter di panel kiri untuk memulai simulasi optimasi dosis ClO₂ menggunakan Binary Search AI Engine.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </main>
  );
}

// --- Sub-Components ---
function InputGroup({ label, name, value, onChange, step = "1" }: any) {
  return (
    <div className="w-full">
      <label className="block text-[9px] font-black text-slate-400 uppercase mb-2 tracking-widest">{label}</label>
      <input 
        type="number" step={step} name={name} value={value} onChange={onChange}
        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 font-bold focus:ring-4 focus:ring-blue-50 focus:border-blue-500 focus:bg-white outline-none transition-all text-sm"
      />
    </div>
  );
}

function LiveStat({ label, value, unit }: any) {
  return (
    <div className="truncate">
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{label}</p>
      <p className="text-sm font-bold text-slate-600 truncate">{value} <span className="text-[10px] opacity-40 uppercase">{unit}</span></p>
    </div>
  );
}

function MetricCard({ label, value, sub, highlight = false }: any) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm transition-all hover:shadow-md hover:-translate-y-1">
      <p className="text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 truncate">{label}</p>
      <p className={`text-xl sm:text-2xl lg:text-3xl font-black tracking-tighter ${highlight ? 'text-blue-600' : 'text-slate-800'}`}>{value}</p>
      <p className="text-[10px] font-black text-slate-300 mt-2 uppercase truncate">{sub}</p>
    </div>
  );
}