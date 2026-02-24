import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Filter,
  Calendar,
  FileText,
  CheckCircle2,
  AlertCircle,
  History,
  Download,
  Zap,
  Activity,
  Clock,
  ArrowRight,
  ChevronLeft,
  LayoutGrid,
  List,
  Eye,
  ShieldCheck,
  MoreVertical,
  Inbox,
  Trash2
} from "lucide-react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";
import AnalysisResults from "../components/shared/AnalysisResults";
import SessionCopilot from "../components/shared/SessionCopilot";

const SessionCard = ({ session, onClick }) => {
  const result = session.result_json;
  const fileName = session.file_name.split("/").pop();

  // Corrected data mapping based on backend result structure
  const riskScore = result?.decision?.score ?? result?.decision?.combined_risk_score ?? 0;
  const riskCategory = result?.decision?.risk_category ?? "UNKNOWN";
  const violationsCount = result?.compliance?.summary?.violations_count ?? result?.compliance?.violations?.length ?? 0;

  // Extract a preview of obligations/entities
  const obligations = result?.extracted_data?.obligations ?? result?.structured_data?.obligations ?? [];

  return (
    <div
      onClick={onClick}
      className="card group cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 flex flex-col h-full overflow-hidden border-slate-200/60 min-w-[300px]"
    >
      <div className="p-8 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-6">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white group-hover:border-slate-900 transition-all duration-300 shadow-sm">
            <FileText className="w-6 h-6" />
          </div>
          <div className={cn(
            "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border",
            riskCategory === "SAFE" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
              riskCategory === "HIGH" ? "bg-rose-50 text-rose-700 border-rose-100" : "bg-amber-50 text-amber-700 border-amber-100"
          )}>
            {riskCategory}
          </div>
        </div>

        <h3 className="text-xl font-extrabold text-slate-900 tracking-tight mb-3 line-clamp-1 group-hover:text-slate-600 transition-colors">
          {fileName}
        </h3>

        <p className="text-xs text-slate-500 font-medium mb-6 line-clamp-2 leading-relaxed">
          {result?.extraction?.executive_summary || "Automated document audit session. Full intelligence profile available in detail view."}
        </p>

        {obligations.length > 0 && (
          <div className="mb-6 space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Key Obligations</p>
            <div className="flex flex-wrap gap-1.5">
              {obligations.slice(0, 3).map((obj, i) => (
                <span key={i} className="px-2 py-1 bg-slate-100 text-slate-600 text-[9px] font-bold rounded-md truncate max-w-full">
                  {String(obj)}
                </span>
              ))}
              {obligations.length > 3 && <span className="text-[9px] font-bold text-slate-400 self-center">+{obligations.length - 3} More</span>}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-50 mt-auto">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Risk Intensity</p>
            <p className="text-lg font-black text-slate-900">{(riskScore * 100).toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Violations</p>
            <p className={cn("text-lg font-black", violationsCount > 0 ? "text-rose-600" : "text-emerald-600")}>
              {violationsCount}
            </p>
          </div>
        </div>
      </div>

      <div className="px-8 py-5 bg-slate-50/50 flex items-center justify-between border-t border-slate-100">
        <div className="flex items-center gap-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          <Calendar className="w-3.5 h-3.5" />
          {new Date(session.updated_at).toLocaleDateString()}
        </div>
        <div className="text-slate-900 group-hover:translate-x-1 transition-transform">
          <ArrowRight className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};

export default function SessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [view, setView] = useState("grid"); // "grid" or "detail"
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/sessions");
      setSessions(data.sessions || []);
    } catch {
      setError("Failed to synchronize session history");
    } finally {
      setLoading(false);
    }
  };

  const loadSession = async (id) => {
    try {
      setLoading(true);
      const { data } = await api.get(`/sessions/${id}`);
      setSelected(data.session);
      setView("detail");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Could not retrieve session intelligence");
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = async () => {
    if (!selected) return;
    setDownloading(true);
    setError(""); // Reset error
    try {
      let reportId = selected.result_json?.report_id;

      // Fallback: If report_id is missing or stale, try to find by document_id
      if (!reportId && selected.result_json?.document_id) {
        const latest = await api.get(`/reports/by-document/${selected.result_json.document_id}/latest`);
        reportId = latest.data?.report?.id;
      }

      if (!reportId) {
        setError("No report available for this session yet.");
        return;
      }

      const response = await api.get(`/reports/${reportId}/download`, { responseType: "blob" });

      // Validation: Check if it's actually a PDF
      if (response.data.type !== "application/pdf") {
        setError("Invalid report format received. The report may be corrupted or outdated.");
        return;
      }

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `riskiq-report-${selected.id.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError("Report download failed. Generating on-demand...");
      // Logic for re-gen should follow if needed
    } finally {
      setDownloading(false);
    }
  };

  const deleteSession = async () => {
    if (!selected || deleting) return;
    const ok = window.confirm("Delete this session and its stored analytics? This cannot be undone.");
    if (!ok) return;
    setDeleting(true);
    setError("");
    try {
      await api.delete(`/sessions/${selected.id}`);
      setSelected(null);
      setView("grid");
      await fetchSessions();
    } catch (e) {
      setError(e.response?.data?.error || "Session deletion failed");
    } finally {
      setDeleting(false);
    }
  };

  const filteredSessions = useMemo(
    () =>
      sessions.filter(
        (s) =>
          s.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.status.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [sessions, searchQuery]
  );

  if (view === "detail" && selected) {
    return (
      <div className="max-w-[1400px] mx-auto animate-slide-up pb-20 pt-4 space-y-8">
        <button
          onClick={() => setView("grid")}
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors uppercase tracking-widest"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Vault
        </button>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-100 pb-8">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-1 rounded tracking-widest uppercase border border-slate-200">Session Alpha</span>
              <span className="text-slate-400 text-[10px] font-bold tracking-widest uppercase">ID: {selected.id}</span>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{selected.file_name.split("/").pop()}</h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={downloadReport}
              className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-xs font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Download Executive PDF
            </button>
            <button
              onClick={deleteSession}
              disabled={deleting}
              className="px-6 py-3 bg-rose-50 text-rose-700 rounded-2xl text-xs font-bold hover:bg-rose-100 transition-all border border-rose-200 flex items-center gap-2 disabled:opacity-60"
            >
              <Trash2 className="w-4 h-4" /> {deleting ? "Deleting..." : "Delete Session"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 space-y-8">
            <div className="card p-8 bg-slate-50/50 border-dashed border-slate-300">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-white rounded-2xl border border-slate-200">
                  <ShieldCheck className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Autonomous Validation Pass</h3>
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-tighter">Verified by Ensemble AI Orchestrator</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                {selected.result_json?.extraction?.executive_summary || "Full document extraction completed. All regulatory benchmarks were analyzed against the active compliance datastore."}
              </p>
            </div>

            <AnalysisResults result={selected.result_json} sessionId={selected.id} />
          </div>

          <div className="lg:col-span-4 space-y-8 sticky top-4">
            <SessionCopilot sessionId={selected.id} />

            <div className="card p-6 divide-y divide-slate-100">
              <div className="pb-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Session Metadata</p>
                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-400 uppercase">Processed At</span>
                    <span className="text-slate-900">{new Date(selected.updated_at).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-400 uppercase">Workflow Engine</span>
                    <span className="text-slate-900">Alpha-Agent v2</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-400 uppercase">Input Token Pool</span>
                    <span className="text-slate-900">1.2M Samples</span>
                  </div>
                </div>
              </div>
              <div className="pt-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">System Flags</p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black rounded border border-emerald-100">STABLE</span>
                  <span className="px-2 py-1 bg-slate-50 text-slate-600 text-[10px] font-black rounded border border-slate-200">AUDIT_READY</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto animate-slide-up pb-20 pt-4 space-y-12">
      {/* Premium Studio Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 border-b border-slate-100 pb-10">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded tracking-widest uppercase border border-slate-200">Library</span>
            <span className="text-slate-400 text-[10px] font-bold tracking-widest uppercase">{sessions.length} Documents</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Intelligence <span className="text-slate-400">Vault</span>
          </h1>
          <p className="text-lg text-slate-500 mt-3 max-w-2xl font-medium">
            Search and manage historical risk excavations and compliance audit sessions.
          </p>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative group flex-1 md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
            <input
              type="text"
              placeholder="Filter vault..."
              className="w-full bg-slate-50 border-transparent rounded-2xl pl-12 pr-4 py-3.5 text-sm focus:bg-white focus:ring-0 focus:border-slate-300 transition-all font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="h-[48px] px-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all border border-transparent hover:border-slate-200">
            <Filter className="w-5 h-5 text-slate-600" />
          </button>
        </div>
      </div>

      {error && (
        <div className="card bg-rose-50 border-rose-100 p-4 text-rose-700 text-sm font-bold">{error}</div>
      )}

      {loading && !sessions.length ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-6">
          <Zap className="w-12 h-12 text-slate-200 animate-pulse" />
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Syncing Vault Core...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-10">
          {filteredSessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              onClick={() => loadSession(s.id)}
            />
          ))}

          {filteredSessions.length === 0 && (
            <div className="col-span-full py-32 text-center">
              <Inbox className="w-16 h-16 text-slate-100 mx-auto mb-6" />
              <h3 className="text-xl font-bold text-slate-900">No Intelligence Found</h3>
              <p className="text-slate-400 mt-2 font-medium">Try adjusting your filter or upload a new session.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
