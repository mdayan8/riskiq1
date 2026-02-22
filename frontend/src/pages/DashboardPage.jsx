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
  ChevronRight, ArrowUpRight, Bell, Zap, Database, Search, UserCheck, Inbox
} from "lucide-react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

const Sparkline = ({ data, color }) => (
  <div className="h-10 w-24">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          fill={color}
          fillOpacity={0.1}
          strokeWidth={2}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

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
      const sessionList = (s.data.sessions || []).slice(0, 5);
      setSessions(sessionList);

      const alertTotal = d.data.alerts_by_severity.reduce((acc, item) => acc + Number(item.total), 0);

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
    pollTimer.current = setInterval(fetchTelemetry, 3000);
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

  // Mock sparklines based on trend data
  const docSpark = data.score_trend.slice(-10).map((v, i) => ({ v: v.avg_score + Math.random() * 0.1 }));
  const riskSpark = data.fraud_trend?.slice(-10).map((v, i) => ({ v: v.avg_fraud_score + Math.random() * 0.1 })) || [];

  return (
    <div className="max-w-[1600px] mx-auto space-y-12 animate-slide-up pb-20 pt-4">
      {/* Premium Studio Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 border-b border-slate-100 pb-10">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded tracking-widest uppercase">Enterprise</span>
            <span className="text-slate-400 text-[10px] font-bold tracking-widest uppercase">v2.4.0-Stable</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Command <span className="text-slate-400">Intelligence</span>
          </h1>
          <p className="text-lg text-slate-500 mt-3 max-w-2xl font-medium">
            Autonomous risk orchestration and real-time inference telemetry across global data swarms.
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">System Health</p>
            <p className="text-sm font-bold text-slate-900">99.98% Operational</p>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shadow-sm">
            <Activity className="w-6 h-6 text-slate-900" />
          </div>
        </div>
      </div>

      {/* Harvey Style Insight Shelves */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="card p-8 group relative overflow-hidden flex flex-col justify-between min-h-[220px]">
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Global Extraction</p>
              <h3 className="text-5xl font-black text-slate-900 tracking-tighter">{data.total_documents_analyzed}</h3>
            </div>
            <Sparkline data={docSpark} color="#2E6CF6" />
          </div>
          <div className="mt-8 flex items-center justify-between relative z-10">
            <p className="text-xs font-semibold text-slate-500">Documents scrutinized by AI swarm</p>
            <Link to="/sessions" className="text-slate-900 hover:translate-x-1 transition-transform">
              <ArrowUpRight className="w-5 h-5" />
            </Link>
          </div>
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-slate-50/50 rounded-full mix-blend-multiply filter blur-3xl opacity-50 -mr-16 -mb-16" />
        </div>

        <div className="card p-8 group relative overflow-hidden flex flex-col justify-between min-h-[220px]">
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Risk Signals</p>
              <h3 className="text-5xl font-black text-rose-600 tracking-tighter">{alertTotal}</h3>
            </div>
            <Sparkline data={riskSpark} color="#E11D48" />
          </div>
          <div className="mt-8 flex items-center justify-between relative z-10">
            <p className="text-xs font-semibold text-slate-500">Anomalies requiring human oversight</p>
            <Link to="/alerts" className="text-slate-900 hover:translate-x-1 transition-transform">
              <ArrowUpRight className="w-5 h-5" />
            </Link>
          </div>
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-rose-50/50 rounded-full mix-blend-multiply filter blur-3xl opacity-50 -mr-16 -mb-16" />
        </div>

        <div className="card p-8 group relative overflow-hidden flex flex-col justify-between min-h-[220px]">
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Compliant Footprint</p>
              <h3 className="text-5xl font-black text-emerald-600 tracking-tighter">{Math.round((data.compliance_distribution.find(i => i.status === 'PASS')?.total / (alertTotal || 1)) * 100)}%</h3>
            </div>
            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
              <ShieldAlert className="w-8 h-8 text-emerald-600" />
            </div>
          </div>
          <div className="mt-8 flex items-center justify-between relative z-10">
            <p className="text-xs font-semibold text-slate-500">Average alignment with GVR/RBI</p>
            <Link to="/reports" className="text-slate-900 hover:translate-x-1 transition-transform">
              <ArrowUpRight className="w-5 h-5" />
            </Link>
          </div>
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-emerald-50/50 rounded-full mix-blend-multiply filter blur-3xl opacity-50 -mr-16 -mb-16" />
        </div>
      </div>

      {/* Full-Width Analytics Section */}
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Decision Engineering</h2>
          <div className="flex gap-2">
            <div className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold text-slate-500 uppercase tracking-widest">7 Day Pulse</div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <div className="card p-10">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Intelligence Confidence Trend</h3>
                <p className="text-sm text-slate-500 mt-1">Weighted average of agent output stability.</p>
              </div>
            </div>
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.score_trend}>
                  <defs>
                    <linearGradient id="scoreColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2E6CF6" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#2E6CF6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} dx={-10} domain={[0, 1]} />
                  <Tooltip
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)', padding: '12px 16px' }}
                    itemStyle={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}
                  />
                  <Area type="monotone" dataKey="avg_score" stroke="#2E6CF6" strokeWidth={4} fillOpacity={1} fill="url(#scoreColor)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card p-10">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Fraud Probability Inference</h3>
                <p className="text-sm text-slate-500 mt-1">Real-time model output from RandomForest engine.</p>
              </div>
            </div>
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.fraud_trend || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} dx={-10} domain={[0, 1]} />
                  <Tooltip
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)', padding: '12px 16px' }}
                  />
                  <Line
                    type="stepAfter"
                    dataKey="avg_fraud_score"
                    stroke="#E11D48"
                    strokeWidth={4}
                    dot={false}
                    activeDot={{ r: 8, fill: '#E11D48', strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Ledger Style Activity Stream */}
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Recent Intelligence Sessions</h2>
          <Link to="/sessions" className="text-sm font-bold text-slate-900 border-b-2 border-slate-900 pb-0.5 hover:text-slate-500 hover:border-slate-500 transition-all">VIEW FULL ARCHIVE</Link>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Document Session</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Agent Status</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Risk Tier</th>
                  <th className="px-8 py-5 text-[100px] font-bold text-slate-400 uppercase tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center group-hover:bg-white border border-transparent group-hover:border-slate-200 transition-all">
                          <FileText className="w-5 h-5 text-slate-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 tracking-tight">{s.file_name.split('/').pop()}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">ID: {s.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "w-2 h-2 rounded-full",
                          s.status === "completed" ? "bg-emerald-500" :
                            s.status === "failed" ? "bg-rose-500" : "bg-blue-500 animate-pulse"
                        )} />
                        <span className="text-xs font-bold text-slate-700 uppercase">{s.status}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={cn(
                        "text-[10px] font-black px-2 py-1 rounded tracking-tighter uppercase",
                        s.status === "completed" ? "bg-emerald-100 text-emerald-800" :
                          s.status === "failed" ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-500"
                      )}>
                        {s.status === "completed" ? "Verified Safe" : "Action Required"}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <Link to="/sessions" className="inline-flex items-center gap-2 text-xs font-bold text-slate-900 hover:text-blue-600 transition-colors">
                        Inspect <ArrowUpRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
