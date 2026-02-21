import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell
} from "recharts";
import {
  FileText, ShieldAlert, History, Activity, TrendingUp, AlertTriangle,
  ChevronRight, ArrowUpRight, Bell, Zap, Database
} from "lucide-react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState("");
  const [lastAlertCount, setLastAlertCount] = useState(0);
  const [newAlert, setNewAlert] = useState(null);
  const pollTimer = useRef(null);

  const fetchTelemetry = async () => {
    try {
      const [d, s] = await Promise.all([api.get("/dashboard"), api.get("/sessions")]);
      setData(d.data);
      const sessionList = (s.data.sessions || []).slice(0, 8);
      setSessions(sessionList);

      const alertTotal = d.data.alerts_by_severity.reduce((acc, item) => acc + Number(item.total), 0);

      // Real-time Alert Popup Logic
      if (lastAlertCount > 0 && alertTotal > lastAlertCount) {
        setNewAlert({
          message: `New High-Severity Alert Detected`,
          time: new Date().toLocaleTimeString()
        });
        setTimeout(() => setNewAlert(null), 5000);
      }
      setLastAlertCount(alertTotal);

    } catch (e) {
      if (!data) setError(e.response?.data?.error || "Failed to load dashboard.");
    }
  };

  useEffect(() => {
    fetchTelemetry();
    pollTimer.current = setInterval(fetchTelemetry, 3000); // Reactive Telemetry
    return () => clearInterval(pollTimer.current);
  }, [lastAlertCount]);

  if (error) return <div className="card p-4 text-red-600">{error}</div>;
  if (!data) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <Zap className="w-12 h-12 text-accent animate-pulse" />
      <p className="text-sm font-medium text-gray-400 uppercase tracking-widest">Synchronizing Global Telemetry...</p>
    </div>
  );

  const alertTotal = data.alerts_by_severity.reduce((acc, item) => acc + Number(item.total), 0);
  const complianceBuckets = data.compliance_distribution.length;

  return (
    <div className="space-y-8 animate-slide-up pb-10">
      {/* Real-time Alert Notification */}
      {newAlert && (
        <div className="fixed top-20 right-8 z-50 animate-slide-up">
          <div className="bg-error text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-white/20 backdrop-blur-md">
            <div className="bg-white/20 p-2 rounded-lg">
              <Bell className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-tighter opacity-80">Live Security Event</p>
              <p className="text-sm font-bold">{newAlert.message}</p>
            </div>
            <p className="text-[10px] ml-4 font-mono opacity-60">{newAlert.time}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">System Command Center</h2>
          <p className="text-gray-500 mt-1 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
            </span>
            Real-time pipeline telemetry from autonomous AI swarms.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-100 shadow-sm">
          <Database className="w-4 h-4 text-accent" />
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Storage Level: 1.2TB / 5TB</span>
        </div>
      </div>

      {/* Interactive Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link to="/sessions" className="group">
          <div className="card p-6 hover:border-accent/40 hover:shadow-lg transition-all relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/50 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform" />
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="p-2 bg-blue-50 rounded-xl">
                <FileText className="w-5 h-5 text-accent" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-accent transition-colors" />
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest relative z-10">Documents</p>
            <p className="text-3xl font-black text-gray-900 mt-1 relative z-10">{data.total_documents_analyzed}</p>
          </div>
        </Link>

        <Link to="/alerts" className="group">
          <div className="card p-6 hover:border-error/40 hover:shadow-lg transition-all relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-error-light/10 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform" />
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="p-2 bg-error-light/30 rounded-xl">
                <ShieldAlert className="w-5 h-5 text-error" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-error transition-colors" />
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest relative z-10">Risk Alerts</p>
            <p className="text-3xl font-black text-gray-900 mt-1 relative z-10">{alertTotal}</p>
          </div>
        </Link>

        <Link to="/reports" className="group">
          <div className="card p-6 hover:border-success/40 hover:shadow-lg transition-all relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50/50 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform" />
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="p-2 bg-emerald-50 rounded-xl">
                <Activity className="w-5 h-5 text-success" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-success transition-colors" />
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest relative z-10">Compliant Hubs</p>
            <p className="text-3xl font-black text-gray-900 mt-1 relative z-10">{complianceBuckets}</p>
          </div>
        </Link>

        <Link to="/sessions" className="group">
          <div className="card p-6 hover:border-accent/40 hover:shadow-lg transition-all relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform" />
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="p-2 bg-slate-100 rounded-xl">
                <History className="w-5 h-5 text-slate-600" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-accent transition-colors" />
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest relative z-10">Active Sessions</p>
            <p className="text-3xl font-black text-gray-900 mt-1 relative z-10">{sessions.length}</p>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Charts */}
        <div className="lg:col-span-8 space-y-6">
          <div className="card p-8 group">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-accent" /> Decision Intelligence Trend
                </h3>
                <p className="text-xs text-gray-500 mt-1 uppercase font-bold tracking-tighter">Aggregated agent scoring history</p>
              </div>
              <div className="flex gap-2">
                <span className="bg-success/10 text-success text-[10px] font-bold px-2 py-1 rounded">STABLE</span>
              </div>
            </div>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.score_trend}>
                  <defs>
                    <linearGradient id="scoreColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} domain={[0, 1]} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="avg_score" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#scoreColor)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card p-8 overflow-hidden relative">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-error" /> Fraud Probability (RF Engine)
                </h3>
                <p className="text-xs text-gray-500 mt-1 uppercase font-bold tracking-tighter">Real-time model inference telemetry</p>
              </div>
            </div>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.fraud_trend || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} domain={[0, 1]} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line
                    type="stepAfter"
                    dataKey="avg_fraud_score"
                    stroke="#ef4444"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 6, fill: '#ef4444', strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right: Lists & Distro */}
        <div className="lg:col-span-4 space-y-6">
          <div className="card p-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent" /> Compliance Distribution
            </h3>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.compliance_distribution} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="status" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} width={60} />
                  <Tooltip cursor={{ fill: 'transparent' }} />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]} barSize={24}>
                    {data.compliance_distribution.map((entry, index) => (
                      <Cell key={index} fill={entry.status === 'PASS' ? '#10b981' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">Activity Stream</h3>
              <Link to="/sessions" className="text-[10px] font-bold text-accent px-2 py-1 bg-blue-50 rounded-lg hover:bg-accent hover:text-white transition-all">VIEW ALL</Link>
            </div>
            <div className="space-y-4">
              {sessions.map((s) => (
                <Link to={`/sessions`} key={s.id} className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-xl transition-all border border-transparent hover:border-gray-100 group">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                    s.status === "completed" ? "bg-emerald-50 text-emerald-600" :
                      s.status === "failed" ? "bg-error-light/50 text-error" :
                        "bg-blue-50 text-accent animate-pulse"
                  )}>
                    {s.status === "completed" ? <ShieldAlert className="w-5 h-5" /> :
                      s.status === "failed" ? <AlertTriangle className="w-5 h-5" /> :
                        <Activity className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate group-hover:text-accent transition-colors">{s.file_name.split('/').pop()}</p>
                    <p className="text-[10px] uppercase font-bold tracking-tighter text-gray-400 mt-0.5">
                      {s.status} • {s.current_stage || "VALIDATED"}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-900" />
                </Link>
              ))}
              {sessions.length === 0 && (
                <div className="text-center py-10">
                  <FileText className="w-12 h-12 text-gray-100 mx-auto mb-2" />
                  <p className="text-xs font-bold text-gray-300 uppercase tracking-widest">No active sessions</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
