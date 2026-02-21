import { useEffect, useState } from "react";
import { ShieldAlert, AlertTriangle, AlertCircle, Info, Filter, Search, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    api.get("/alerts")
      .then((res) => setAlerts(res.data.alerts))
      .catch((e) => setError(e.response?.data?.error || "Failed to load alerts."));
  }, []);

  const SeverityIcon = ({ severity }) => {
    switch (severity) {
      case "HIGH": return <ShieldAlert className="w-5 h-5 text-error" />;
      case "MEDIUM": return <AlertTriangle className="w-5 h-5 text-warning" />;
      case "LOW": return <Info className="w-5 h-5 text-accent" />;
      default: return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const SeverityBadge = ({ severity }) => {
    const config = {
      HIGH: "bg-error-light text-error border-error/20",
      MEDIUM: "bg-warning-light text-warning border-warning/20",
      LOW: "bg-blue-50 text-accent border-accent/20"
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider border uppercase ${config[severity] || "bg-gray-100 text-gray-600"}`}>
        {severity}
      </span>
    );
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Alerts & Responses</h2>
          <p className="text-gray-500 mt-1">Real-time notification stream from continuous monitoring agents.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-medium rounded-lg border border-gray-200 transition-colors">
            Acknowledge All
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-3 p-4 bg-error-light/50 border border-error/20 rounded-xl text-error">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      ) : null}

      {/* Toolbar */}
      <div className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search alerts by keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
          />
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 bg-error-light/30 text-error hover:bg-error-light/60 text-xs font-semibold rounded-lg transition-colors">High</button>
          <button className="px-3 py-1.5 bg-warning-light/30 text-warning hover:bg-warning-light/60 text-xs font-semibold rounded-lg transition-colors">Medium</button>
          <button className="px-3 py-1.5 bg-blue-50 text-accent hover:bg-blue-100 text-xs font-semibold rounded-lg transition-colors">Low</button>
        </div>
      </div>

      {/* Alert Stream */}
      <div className="space-y-3">
        {alerts.map((alert) => (
          <div key={alert.id} className="card p-5 border-l-4 transition-all hover:shadow-md group" style={{
            borderLeftColor: alert.severity === "HIGH" ? "#FF4D4F" : alert.severity === "MEDIUM" ? "#FFB020" : "#2E6CF6"
          }}>
            <div className="flex items-start gap-4">
              <div className="mt-1 shrink-0">
                <SeverityIcon severity={alert.severity} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <SeverityBadge severity={alert.severity} />
                    <span className="text-sm font-semibold text-gray-900 truncate">Agent: {alert.source || "System"}</span>
                  </div>
                  <span className="text-xs text-gray-400 font-medium whitespace-nowrap">
                    {new Date(alert.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-700 leading-relaxed">{alert.message}</p>
              </div>
              <button className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-gray-400 hover:text-gray-900 rounded-lg shrink-0">
                Resolve
              </button>
            </div>
          </div>
        ))}

        {alerts.length === 0 && !error && (
          <div className="card p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-success-light/30 text-success rounded-full flex items-center justify-center mb-4">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">All Clear</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-sm">No active compliance or system alerts. Continuous monitoring is running silently.</p>
          </div>
        )}
      </div>

    </div>
  );
}

