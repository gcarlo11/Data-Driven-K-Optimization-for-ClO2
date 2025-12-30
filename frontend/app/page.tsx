'use client';

import { useState, useMemo } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ComposedChart, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, Scatter, Cell 
} from 'recharts';
import { 
  Activity, Droplets, FlaskConical, Gauge, ArrowRight, 
  AlertTriangle, CheckCircle, ShieldCheck, TrendingUp,
  Clock, Beaker, Zap, Settings, Info, RefreshCcw, Menu, X
} from 'lucide-react';

// Interfaces
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
  delta: number;
  flow_calculated: number;
  retention_calculated: number;
  estimated_outlet: number;
  k_optimal: number;
  k_current: number;
  control_status: string;
}

export default function Home() {
  // State
  const [formData, setFormData] = useState<FormData>({
    kappa: 8.5,
    temperature: 75.0,
    ph: 2.2,
    inlet_brightness: 70,
    current_dose: 25.0,
    production_rate: 70,
    consistency: 10.5
  });

  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [graphData, setGraphData] = useState<any[]>([]);

  // Real-time Calculations for UI
  const liveCalculations = useMemo(() => {
    const flow = (formData.production_rate * 100) / (0.9 * formData.consistency);
    const retention = (450 / flow) * 60;
    return {
      flow: isFinite(flow) ? flow.toFixed(2) : '0',
      retention: isFinite(retention) ? retention.toFixed(1) : '0'
    };
  }, [formData.production_rate, formData.consistency]);

  // Handlers
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
          name: 'Kondisi Saat Ini', 
          brightness: res.estimated_outlet, 
          dose: res.current_dose,
          k: res.k_current 
        },
        { 
          name: 'Target AI (70% ISO)', 
          brightness: 70.0, 
          dose: res.recommended_dose,
          k: res.k_optimal
        }
      ]);
    } catch (err) {
      setError('Gagal terhubung ke Server. Pastikan Backend sudah berjalan.');
    } finally {
      setLoading(false);
    }
  };

  // UI Config
  const getStatusTheme = (status: string) => {
    const themes: Record<string, any> = {
      MAINTAIN_OPTIMAL: { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', icon: <ShieldCheck />, label: 'KONDISI OPTIMAL' },
      OPTIMIZATION_ACTION: { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: <TrendingUp />, label: 'AKSI OPTIMASI' },
      GUARDRAIL_UNDERBLEACH: { color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', icon: <AlertTriangle />, label: 'SAFETY: UNDER-BLEACH' },
      GUARDRAIL_OVERBLEACH: { color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', icon: <AlertTriangle />, label: 'SAFETY: OVER-BLEACH' },
      RATE_LIMITED: { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', icon: <Zap />, label: 'RATE LIMITED' }
    };
    return themes[status] || { color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', icon: <Info />, label: status };
  };

  return (
    <main className="min-h-screen bg-[#F1F5F9] text-slate-900 font-sans p-3 sm:p-6 lg:p-12 selection:bg-blue-100">
      <div className="max-w-[1440px] mx-auto">
        
        {/* Responsive Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8 lg:mb-12">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="flex items-center gap-3 sm:gap-4 mb-2">
              <div className="p-2 sm:p-3 bg-blue-600 rounded-2xl shadow-xl shadow-blue-200">
                <FlaskConical className="w-6 h-6 sm:w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-slate-900">
                D0 <span className="text-blue-600">Optimizer</span>
              </h1>
            </div>
            <p className="text-slate-500 font-bold ml-1 uppercase text-[10px] sm:text-xs tracking-[0.2em]">Data-Driven ClO₂ Optimization System</p>
          </motion.div>
          
          <div className="flex items-center gap-3 bg-white px-4 sm:px-6 py-2 sm:py-3 rounded-2xl shadow-sm border border-slate-100 w-full sm:w-auto justify-center">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-xs sm:text-sm font-black text-slate-600 uppercase tracking-wider">System: Online</span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          
          {/* Side Panel: Inputs - Mobile Stacked, Desktop Sticky */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-4"
          >
            <div className="bg-white rounded-[24px] lg:rounded-[32px] shadow-2xl shadow-slate-200/50 border border-white p-6 sm:p-8 lg:sticky lg:top-8">
              <div className="flex items-center justify-between mb-6 lg:mb-8 pb-4 border-b border-slate-50">
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5 text-blue-500" />
                  <h2 className="font-black text-lg sm:text-xl text-slate-800 uppercase tracking-tight">Parameters</h2>
                </div>
                <RefreshCcw className="w-4 h-4 text-slate-300 cursor-pointer hover:rotate-180 transition-all duration-500" onClick={() => window.location.reload()} />
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-5 lg:space-y-6">
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">Production Metrics</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InputGroup label="Prod Rate (ADT)" name="production_rate" value={formData.production_rate} onChange={handleChange} />
                    <InputGroup label="Consistency (%)" name="consistency" value={formData.consistency} onChange={handleChange} step="0.1" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase">Est. Flow</p>
                      <p className="text-xs sm:text-sm font-bold text-slate-600">{liveCalculations.flow} m³/h</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase">Est. Retention</p>
                      <p className="text-xs sm:text-sm font-bold text-slate-600">{liveCalculations.retention} min</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-50">
                  <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">Quality & Environment</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <InputGroup label="Kappa" name="kappa" value={formData.kappa} onChange={handleChange} step="0.1" />
                    <InputGroup label="pH Level" name="ph" value={formData.ph} onChange={handleChange} step="0.1" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <InputGroup label="Temp (°C)" name="temperature" value={formData.temperature} onChange={handleChange} />
                    <InputGroup label="Inlet (%ISO)" name="inlet_brightness" value={formData.inlet_brightness} onChange={handleChange} step="0.1" />
                  </div>
                </div>

                <div className="bg-blue-600 p-5 sm:p-6 rounded-[20px] sm:rounded-[24px] shadow-xl shadow-blue-100">
                  <label className="block text-[10px] sm:text-xs font-black text-blue-100 uppercase mb-3 tracking-widest">Current ClO₂ Dose</label>
                  <div className="relative">
                    <input 
                      type="number" step="0.1" name="current_dose" 
                      value={formData.current_dose} onChange={handleChange}
                      className="w-full bg-white/10 border-2 border-white/20 rounded-xl px-4 py-3 text-xl sm:text-2xl font-black text-white focus:bg-white focus:text-slate-900 focus:border-white outline-none transition-all"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] sm:text-sm font-black opacity-50 uppercase">kg/h</span>
                  </div>
                </div>

                <button 
                  type="submit" disabled={loading}
                  className="w-full bg-slate-900 hover:bg-blue-600 text-white font-black py-4 sm:py-5 rounded-2xl transition-all shadow-xl shadow-slate-200 disabled:bg-slate-300 flex justify-center items-center gap-3 group text-xs sm:text-sm uppercase tracking-widest"
                >
                  {loading ? (
                    <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> ANALYZING...</span>
                  ) : (
                    <>Run Optimization <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>
                  )}
                </button>
              </form>
            </div>
          </motion.div>

          {/* Right Panel: Results - Responsive Grid */}
          <div className="lg:col-span-8 space-y-6">
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div 
                  key="result"
                  initial={{ opacity: 0, scale: 0.98 }} 
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-6"
                >
                  {/* Status Banner - Multi-column responsive */}
                  <div className={`relative overflow-hidden rounded-[32px] lg:rounded-[40px] border-b-[8px] lg:border-b-[12px] p-6 sm:p-8 lg:p-10 shadow-2xl transition-all ${getStatusTheme(result.control_status).bg} ${getStatusTheme(result.control_status).border}`}>
                    <div className="relative z-10">
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-6 mb-8 lg:mb-12">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 sm:p-4 rounded-[18px] sm:rounded-[24px] bg-white shadow-sm ${getStatusTheme(result.control_status).color}`}>
                            {getStatusTheme(result.control_status).icon}
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">AI Recommendation</p>
                            <h3 className={`text-lg sm:text-2xl font-black tracking-tight ${getStatusTheme(result.control_status).color}`}>
                              {getStatusTheme(result.control_status).label}
                            </h3>
                          </div>
                        </div>
                        
                        <div className="bg-white/60 backdrop-blur-xl px-5 sm:px-8 py-3 sm:py-5 rounded-2xl sm:rounded-3xl border border-white text-left sm:text-right shadow-sm w-full sm:w-auto">
                          <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase mb-1 tracking-wider">Est. Final Brightness</p>
                          <p className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tighter">{result.estimated_outlet}<span className="text-xs sm:text-lg font-bold opacity-30 ml-1">%ISO</span></p>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6 sm:gap-10">
                        <div className="w-full sm:w-auto">
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest">Target Flow Rate</p>
                          <div className="flex items-baseline gap-3">
                            <span className="text-6xl sm:text-8xl lg:text-9xl font-black tracking-tighter text-slate-900 leading-[0.8]">{result.recommended_dose}</span>
                            <span className="text-xl sm:text-3xl font-bold text-slate-300 uppercase">kg/h</span>
                          </div>
                        </div>

                        <div className={`px-6 py-3 sm:py-4 rounded-2xl sm:rounded-3xl border-2 flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-center ${
                          result.delta === 0 ? 'bg-blue-100/50 border-blue-200 text-blue-700' : 
                          result.delta > 0 ? 'bg-rose-100/50 border-rose-200 text-rose-700' : 'bg-emerald-100/50 border-emerald-200 text-emerald-700'
                        }`}>
                          <span className="text-[10px] sm:text-sm font-black uppercase tracking-widest opacity-60">Adj:</span>
                          <span className="text-xl sm:text-3xl font-black">
                            {result.delta > 0 ? '▲' : result.delta < 0 ? '▼' : ''} {Math.abs(result.delta)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Matrix Cards - Grid stacks on mobile, 2 cols on tablet, 4 on desktop */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <MetricCard label="Optimal K-Factor" value={result.k_optimal} sub="Efficiency Target" highlight />
                    <MetricCard label="Current K-Factor" value={result.k_current} sub="Actual Ratio" />
                    <MetricCard label="Calculated Flow" value={result.flow_calculated} sub="m³/h (Inlet)" />
                    <MetricCard label="Retention" value={result.retention_calculated} sub="Minutes (D0)" />
                  </div>

                  {/* Charts & Insights - Stack on mobile, grid on large screens */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <div className="bg-white p-6 sm:p-8 rounded-[24px] sm:rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-50 rounded-xl"><TrendingUp className="w-5 h-5 text-blue-500" /></div>
                          <h3 className="font-black text-base sm:text-lg text-slate-800 uppercase tracking-tight">Operation Map</h3>
                        </div>
                        <div className="flex gap-4">
                          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400"><div className="w-2 h-2 rounded-full bg-rose-500"></div> CURRENT</div>
                          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400"><div className="w-2 h-2 rounded-full bg-blue-500"></div> TARGET</div>
                        </div>
                      </div>
                      
                      <div className="h-[300px] sm:h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart margin={{ top: 20, right: 10, bottom: 20, left: -10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="brightness" type="number" domain={['auto', 'auto']} fontSize={10} fontWeight="bold" tick={{ fill: '#94a3b8' }} hide={false} />
                            <YAxis dataKey="dose" type="number" domain={['auto', 'auto']} fontSize={10} fontWeight="bold" tick={{ fill: '#94a3b8' }} />
                            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                            <Scatter name="Current" data={[graphData[0]]} fill="#F43F5E" />
                            <Scatter name="Target" data={[graphData[1]]} fill="#3B82F6" shape="star" />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="bg-slate-900 rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 text-white space-y-6 sm:space-y-8">
                      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-blue-400">System Insights</h3>
                      <div className="space-y-4 sm:space-y-6">
                        <InsightRow 
                          icon={<Zap className="text-amber-400 w-4 h-4" />} 
                          title="Efficiency Delta" 
                          value={`${(Math.abs(result.k_optimal - result.k_current) / result.k_current * 100).toFixed(1)}%`}
                          desc="Selisih efisiensi terhadap target model."
                        />
                        <InsightRow 
                          icon={<Beaker className="text-blue-400 w-4 h-4" />} 
                          title="Mass Balance" 
                          value={`${result.flow_calculated} m³/h`}
                          desc="Flow pulp berdasarkan konsistensi."
                        />
                        <InsightRow 
                          icon={<Clock className="text-emerald-400 w-4 h-4" />} 
                          title="Chemical Contact" 
                          value={`${result.retention_calculated} min`}
                          desc="Waktu tinggal optimal di Menara D0."
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="h-full min-h-[500px] flex flex-col items-center justify-center bg-white rounded-[32px] lg:rounded-[48px] border-4 border-dashed border-slate-100 text-slate-300 p-8 text-center"
                >
                  <Beaker className="w-12 sm:w-16 h-12 sm:h-16 text-slate-200 mb-6" />
                  <h3 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-400 mb-4 tracking-tight">Ready for Analysis</h3>
                  <p className="max-w-xs text-slate-400 font-bold uppercase text-[10px] sm:text-xs tracking-widest leading-loose">
                    Lengkapi parameter di panel kiri untuk memulai optimasi.
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

// Responsive Components

function InputGroup({ label, name, value, onChange, step = "1" }: any) {
  return (
    <div className="w-full">
      <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 tracking-wider truncate">
        {label}
      </label>
      <input 
        type="number" step={step} name={name} value={value} onChange={onChange}
        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 font-bold focus:ring-4 focus:ring-blue-50 focus:border-blue-500 focus:bg-white outline-none transition-all text-sm sm:text-base"
      />
    </div>
  );
}

function MetricCard({ label, value, sub, highlight = false }: any) {
  return (
    <div className="bg-white p-5 lg:p-6 rounded-[20px] lg:rounded-3xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
      <p className="text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 sm:mb-2">{label}</p>
      <p className={`text-xl sm:text-2xl lg:text-3xl font-black tracking-tighter ${highlight ? 'text-blue-600' : 'text-slate-800'}`}>{value}</p>
      <p className="text-[9px] lg:text-[10px] font-black text-slate-300 mt-1 uppercase truncate">{sub}</p>
    </div>
  );
}

function InsightRow({ icon, title, value, desc }: any) {
  return (
    <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl bg-white/5 border border-white/5 transition-all hover:bg-white/10">
      <div className="p-2 sm:p-3 bg-white/10 rounded-xl flex-shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between mb-1 gap-2">
          <h4 className="text-[9px] sm:text-xs font-black uppercase tracking-widest text-slate-400 truncate">{title}</h4>
          <span className="text-sm sm:text-lg font-black text-white whitespace-nowrap">{value}</span>
        </div>
        <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 leading-tight line-clamp-2">{desc}</p>
      </div>
    </div>
  );
}