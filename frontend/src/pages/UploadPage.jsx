import { useEffect, useMemo, useState } from "react";
import {
  UploadCloud,
  CheckCircle2,
  FileText,
  Activity,
  Search,
  Zap,
  ShieldCheck,
  Database
} from "lucide-react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";
import AnalysisResults from "../components/shared/AnalysisResults";

const STAGES = [
  { key: "INGESTION", label: "Data Ingestion", icon: UploadCloud, desc: "Preparing document for extraction" },
  { key: "DOCUMENT_AGENT", label: "Document Agent", icon: FileText, desc: "Neural entity extraction" },
  { key: "COMPLIANCE_AGENT", label: "Compliance Agent", icon: ShieldCheck, desc: "GVR Multi-framework scan" },
  { key: "DECISION_AGENT", label: "Decision Agent", icon: Activity, desc: "Risk & fraud probability scoring" },
  { key: "MONITORING_AGENT", label: "Monitoring Agent", icon: Search, desc: "Anomaly & drift evaluation" },
  { key: "REPORTING_AGENT", label: "Reporting Agent", icon: FileText, desc: "Narrative intelligence generation" },
  { key: "PERSISTENCE", label: "Storage & Report", icon: Database, desc: "Session persistence" }
];

function AgentPipeline({ stages, currentStage }) {
  const currentIndex = STAGES.findIndex((s) => s.key === currentStage);
  const completedCount = useMemo(
    () => (stages || []).filter((s) => s.status === "completed").length,
    [stages]
  );
  const progressPct = Math.min(100, Math.round((completedCount / STAGES.length) * 100));

  return (
    <div className="card p-8 overflow-hidden space-y-6">
      <div>
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-2">
          <span>Autonomous Pipeline Progress</span>
          <span>{progressPct}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-700 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between relative">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-100 -translate-y-1/2 -z-10" />

        {STAGES.map((stage, idx) => {
          const stageFromBackend = stages?.find((s) => s.key === stage.key);
          const isCompleted = stageFromBackend?.status === "completed";
          const isRunning =
            currentStage === stage.key || (!isCompleted && idx === currentIndex && currentStage !== "DONE");
          const Icon = stage.icon;

          return (
            <div key={stage.key} className="flex flex-col items-center gap-3 relative z-10 w-full group">
              {idx > 0 && isRunning && (
                <div className="absolute top-1/2 -left-1/2 w-full h-0.5 -translate-y-1/2 overflow-hidden pointer-events-none">
                  <div className="w-full h-full bg-accent animate-flow-line stroke-accent" />
                </div>
              )}

              <div
                className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500",
                  isCompleted
                    ? "bg-success text-white scale-90"
                    : isRunning
                      ? "bg-accent text-white animate-pulse-agent scale-110 shadow-lg shadow-accent/30"
                      : "bg-white border-2 border-gray-100 text-gray-300"
                )}
              >
                {isCompleted ? <CheckCircle2 className="w-7 h-7" /> : <Icon className="w-6 h-6" />}
              </div>

              <div className="text-center">
                <p
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-widest transition-colors",
                    isRunning ? "text-accent" : isCompleted ? "text-success" : "text-gray-400"
                  )}
                >
                  {stage.label}
                </p>
                <div className="h-4">
                  {isRunning && <span className="text-[9px] text-gray-500 animate-pulse">Processing...</span>}
                </div>
              </div>

              <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-[10px] px-2 py-1 rounded pointer-events-none whitespace-nowrap">
                {stage.desc}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [jobId, setJobId] = useState("");
  const [jobState, setJobState] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!jobId) return;

    let active = true;
    const poll = async () => {
      try {
        const { data } = await api.get(`/workflow-status/${jobId}`);
        if (!active) return;
        setJobState(data);

        if (data.status === "completed") {
          setResult(data.result);
          setLoading(false);
          return;
        }

        if (data.status === "failed") {
          setError(data.error || "Workflow failed");
          setLoading(false);
          return;
        }

        setTimeout(poll, 900);
      } catch (err) {
        if (!active) return;
        setError(err.response?.data?.error || "Failed to fetch workflow status");
        setLoading(false);
      }
    };

    poll();
    return () => {
      active = false;
    };
  }, [jobId]);

  useEffect(() => {
    if (!loading) return;
    const timer = setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => clearInterval(timer);
  }, [loading]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setJobState(null);
    setJobId("");
    setElapsed(0);
    if (!file) return setError("Select a file first.");

    const form = new FormData();
    form.append("document", file);

    try {
      setLoading(true);
      const { data } = await api.post("/upload-async", form, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setJobId(data.job_id);
      setJobState(data);
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.error || "Upload workflow failed");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Autonomous Agent Workspace</h2>
          <p className="text-gray-500 mt-1">Deploying autonomous swarms for multi-framework compliance and risk intelligence.</p>
        </div>
        {jobId && (
          <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-full border border-gray-100 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
            </span>
            <span className="text-xs font-medium text-gray-600 uppercase tracking-tighter">Session: {jobId.slice(0, 8)}</span>
            {loading && <span className="text-xs font-medium text-gray-400">Elapsed: {elapsed}s</span>}
          </div>
        )}
      </div>

      {!result && (
        <div className="animate-slide-up">
          <form onSubmit={submit} className="card p-8 border-dashed border-2 bg-gray-50/50 hover:bg-white hover:border-accent/40 transition-all cursor-pointer group">
            <label className="flex flex-col items-center justify-center gap-4 cursor-pointer">
              <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.tiff,.bmp,.docx,.txt,.md,.csv,.xlsx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <div className="w-16 h-16 bg-blue-50 text-accent rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-sm">
                <UploadCloud className="w-8 h-8" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900">{file ? file.name : "Select Financial Document"}</h3>
                <p className="text-xs text-gray-500 mt-1">{file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : "Drag and drop or click to browse files"}</p>
              </div>
              <button disabled={loading} className="mt-4 rounded-xl bg-primary px-8 py-3 text-white font-semibold text-sm hover:bg-black transition-all shadow-lg active:scale-95 disabled:opacity-50">
                {loading ? "RUNNING AGENT WORKFLOW..." : "INITIATE PIPELINE"}
              </button>
            </label>
            {error && <p className="text-center text-sm text-error mt-6 font-medium bg-error-light/30 py-2 rounded-lg">{error}</p>}
          </form>
        </div>
      )}

      {jobState && (
        <div className="space-y-6">
          <AgentPipeline stages={jobState.stages} currentStage={jobState.current_stage} />
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-bold uppercase tracking-widest text-gray-700">Live Agent Execution Log</h3>
            </div>
            <div className="max-h-64 overflow-y-auto pr-2 custom-scrollbar space-y-2">
              {(jobState.logs || []).slice().reverse().map((log, idx) => (
                <div key={`${log.timestamp}-${idx}`} className="flex items-start gap-3 text-xs p-2 rounded-lg bg-gray-50 border border-gray-100">
                  <span
                    className={cn(
                      "mt-1 inline-block h-2 w-2 rounded-full",
                      log.status === "completed"
                        ? "bg-emerald-500"
                        : log.status === "failed"
                          ? "bg-red-500"
                          : "bg-blue-500 animate-pulse"
                    )}
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800">{log.stage.replaceAll("_", " ")}</p>
                    <p className="text-gray-600">{log.message || log.status}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{new Date(log.timestamp).toLocaleTimeString()}</p>
                  </div>
                </div>
              ))}
              {(!jobState.logs || jobState.logs.length === 0) && (
                <div className="text-xs text-gray-500">Waiting for stage updates...</div>
              )}
            </div>
          </div>
        </div>
      )}

      {result && <AnalysisResults result={result} />}
    </div>
  );
}
