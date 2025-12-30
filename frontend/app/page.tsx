'use client';

import { useState, useMemo } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ComposedChart, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, Scatter
} from 'recharts';
import { 
  Activity, Droplets, FlaskConical, Gauge, ArrowRight, 
  AlertTriangle, CheckCircle, ShieldCheck, TrendingUp,
  Clock, Beaker, Zap, Settings, Info, RefreshCcw, Search
} from 'lucide-react';

// --- Interfaces sesuai Backend baru ---
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
    inlet_brightness: 70,
    current_dose: 25.0,
    production_rate: 700,
    consistency: 10.5
  });

  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [graphData, setGraphData] = useState<any[]>([]);

  // Kalkulasi Preview di Sisi Client
  const livePreview = useMemo(() => {
    const flow = (formData.production_rate * 100) / (0.9 * formData.consistency);
    const retention = (450 / flow) * 60;
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
      setError('Koneksi Gagal: Periksa apakah Backend (Port 8000) sudah aktif.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusTheme = (status: string) => {
    const themes: Record<string, any> = {
      HOLD_STEADY: { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', icon: <ShieldCheck />, label: 'STEADY STATE' },
      OPTIMIZED: { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: <TrendingUp />, label: 'OPTIMIZED' },
      SAFETY_UNDERBLEACH: { color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', icon: <AlertTriangle />, label: 'SAFETY LIMIT' },
      SAFETY_OVERBLEACH: { color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', icon: <AlertTriangle />, label: 'SAFETY LIMIT' },
      RATE_LIMITED: { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', icon: <Zap />, label: 'RATE LIMITED' }
    };
    return themes[status] || { color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', icon: <Info />, label: status };
  };

  return (
    <main className="min-h-screen bg-[#F1F5F9] text-slate-900 p-4 md:p-8 lg:p-12">
      <div className="max-w-[1440px] mx-auto">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-12">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-blue-600 rounded-2xl shadow-xl shadow-blue-200">
                <FlaskConical className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900">
                D0 <span className="text-blue-600">Optimizer V2</span>
              </h1>
            </div>
            <p className="text-slate-500 font-bold ml-1 uppercase text-xs tracking-widest">Two-Stage AI Control Architecture</p>
          </motion.div>
          <div className="bg-white px-6 py-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
            <span className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-sm font-black text-slate-600 uppercase">Binary Search Engine Active</span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Form Panel */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-4">
            <div className="bg-white rounded-[32px] shadow-2xl border border-white p-8 sticky top-8">
              <div className="flex items-center gap-3 mb-8 pb-4 border-b border-slate-50">
                <Settings className="w-5 h-5 text-blue-500" />
                <h2 className="font-black text-xl text-slate-800 uppercase">Parameters</h2>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Production Metrics</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <InputGroup label="Prod Rate (ADT/d)" name="production_rate" value={formData.production_rate} onChange={handleChange} />
                    <InputGroup label="Consistency (%)" name="consistency" value={formData.consistency} onChange={handleChange} step="0.1" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <LiveStat label="Calculated Flow" value={livePreview.flow} unit="m³/h" />
                    <LiveStat label="Calculated Retention" value={livePreview.retention} unit="min" />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-50">
                  <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Process Conditions</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <InputGroup label="Kappa In" name="kappa" value={formData.kappa} onChange={handleChange} step="0.1" />
                    <InputGroup label="pH Level" name="ph" value={formData.ph} onChange={handleChange} step="0.1" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <InputGroup label="Temperature (°C)" name="temperature" value={formData.temperature} onChange={handleChange} />
                    <InputGroup label="Inlet Bright (%ISO)" name="inlet_brightness" value={formData.inlet_brightness} onChange={handleChange} step="0.1" />
                  </div>
                </div>

                <div className="bg-slate-900 p-6 rounded-[24px]">
                  <label className="block text-xs font-black text-slate-400 uppercase mb-3 tracking-widest">Current ClO₂ Dose (SP)</label>
                  <div className="relative">
                    <input type="number" step="0.1" name="current_dose" value={formData.current_dose} onChange={handleChange}
                      className="w-full bg-white/10 border-2 border-white/20 rounded-xl px-4 py-3 text-2xl font-black text-white focus:bg-white focus:text-slate-900 outline-none transition-all" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black opacity-30">KG/H</span>
                  </div>
                </div>

                <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-blue-100 flex justify-center items-center gap-3 uppercase tracking-widest text-sm">
                  {loading ? 'Optimizing...' : <>Run Analysis <Search className="w-5 h-5" /></>}
                </button>
              </form>
            </div>
          </motion.div>

          {/* Results Panel */}
          <div className="lg:col-span-8 space-y-6">
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div key="result" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
                  
                  {/* Status Banner */}
                  <div className={`rounded-[40px] border-b-[12px] p-10 shadow-2xl transition-all ${getStatusTheme(result.control_status).bg} ${getStatusTheme(result.control_status).border}`}>
                    <div className="flex flex-wrap justify-between items-start gap-8 mb-12">
                      <div className="flex items-center gap-5">
                        <div className="p-4 rounded-[24px] bg-white shadow-sm">
                          {getStatusTheme(result.control_status).icon}
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Control Status</p>
                          <h3 className={`text-2xl font-black ${getStatusTheme(result.control_status).color}`}>
                            {getStatusTheme(result.control_status).label}
                          </h3>
                        </div>
                      </div>
                      <div className="bg-white/60 backdrop-blur-xl px-8 py-5 rounded-3xl border border-white text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Virtual Sensor Reading</p>
                        <p className="text-4xl font-black text-slate-900 leading-none">{result.estimated_outlet_current}<span className="text-lg font-bold opacity-30 ml-1">%ISO</span></p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-end gap-10">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest text-current">Optimized Target Dose</p>
                        <div className="flex items-baseline gap-4">
                          <span className="text-9xl font-black tracking-tighter text-slate-900 leading-[0.8]">{result.recommended_dose}</span>
                          <span className="text-3xl font-bold text-slate-300 uppercase">kg/h</span>
                        </div>
                      </div>
                      <div className={`mb-4 px-8 py-4 rounded-3xl border-2 flex items-center gap-4 ${result.delta_dose >= 0 ? 'bg-rose-100/50 border-rose-200 text-rose-700' : 'bg-emerald-100/50 border-emerald-200 text-emerald-700'}`}>
                        <span className="text-sm font-black uppercase tracking-widest opacity-60">Delta:</span>
                        <span className="text-3xl font-black">{result.delta_dose > 0 ? '+' : ''}{result.delta_dose}</span>
                      </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-white/40 flex items-center gap-3">
                      <div className="p-2 bg-white rounded-lg"><Info className="w-4 h-4 text-slate-400" /></div>
                      <p className="text-sm font-bold text-slate-600 italic">"{result.reason}"</p>
                    </div>
                  </div>

                  {/* Matrix Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <MetricCard label="Optimal K" value={result.k_optimal} sub="Target" highlight />
                    <MetricCard label="Current K" value={result.k_current} sub="Actual" />
                    <MetricCard label="Est. Outlet" value={result.predicted_outlet_optimized} sub="After Action" />
                    <MetricCard label="Efficiency" value={`${((result.k_optimal / result.k_current) * 100).toFixed(1)}%`} sub="Yield" />
                  </div>

                  {/* Operation Map (Chart) */}
                  <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                    <h3 className="font-black text-lg text-slate-800 uppercase mb-8 flex items-center gap-3">
                      <TrendingUp className="w-5 h-5 text-blue-500" /> Two-Stage Analysis Map
                    </h3>
                    <div className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart margin={{ top: 20, right: 30, bottom: 40, left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="brightness" type="number" domain={['auto', 'auto']} unit="%ISO" label={{ value: 'Brightness (%ISO)', position: 'insideBottom', offset: -20, fontSize: 10, fontWeight: 'bold' }} />
                          <YAxis dataKey="dose" type="number" domain={['auto', 'auto']} unit="kg" label={{ value: 'Dose (kg/h)', angle: -90, position: 'insideLeft', fontSize: 10, fontWeight: 'bold' }} />
                          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                          <Legend verticalAlign="top" height={36} />
                          <Scatter name="Current Estimate" data={[graphData[0]]} fill="#F43F5E" />
                          <Scatter name="Optimized Recommendation" data={[graphData[1]]} fill="#3B82F6" shape="star" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="h-full min-h-[600px] flex flex-col items-center justify-center bg-white rounded-[48px] border-4 border-dashed border-slate-100 text-slate-300 p-12 text-center">
                  <Beaker className="w-20 h-20 mb-8 opacity-20" />
                  <h3 className="text-3xl font-black mb-4">Ready for Optimization</h3>
                  <p className="max-w-md font-bold uppercase text-xs tracking-[0.2em] leading-loose">Input data proses dan jalankan optimasi untuk mencari dosis ClO₂ minimum menuju target 70% ISO.</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </main>
  );
}

// --- Specialized UI Components ---
function InputGroup({ label, name, value, onChange, step = "1" }: any) {
  return (
    <div>
      <label className="block text-[9px] font-black text-slate-400 uppercase mb-2 tracking-wider">{label}</label>
      <input type="number" step={step} name={name} value={value} onChange={onChange}
        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-700 font-bold focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all" />
    </div>
  );
}

function LiveStat({ label, value, unit }: any) {
  return (
    <div>
      <p className="text-[9px] font-black text-slate-400 uppercase">{label}</p>
      <p className="text-sm font-bold text-slate-600">{value} <span className="text-[10px] opacity-40">{unit}</span></p>
    </div>
  );
}

function MetricCard({ label, value, sub, highlight = false }: any) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</p>
      <p className={`text-2xl font-black ${highlight ? 'text-blue-600' : 'text-slate-800'}`}>{value}</p>
      <p className="text-[10px] font-black text-slate-300 mt-2 uppercase">{sub}</p>
    </div>
  );
}