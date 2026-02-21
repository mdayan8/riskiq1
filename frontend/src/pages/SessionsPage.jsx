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
  Clock
} from "lucide-react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";
import AnalysisResults from "../components/shared/AnalysisResults";

export default function SessionsPage() {
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const { data } = await api.get("/sessions");
      const list = data.sessions || [];
      setSessions(list);
      if (list[0]) loadSession(list[0].id);
    } catch {
      setError("Failed to synchronize session history");
    }
  };

  const loadSession = async (id) => {
    try {
      setLoading(true);
      const { data } = await api.get(`/sessions/${id}`);
      setSelected(data.session);
    } catch {
      setError("Could not retrieve session intelligence");
    } finally {
      setLoading(false);
    }
  };

  const triggerDownload = (blobData, fileName) => {
    const blob = new Blob([blobData], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const downloadFromReportId = async (reportId, documentRef) => {
    const response = await api.get(`/reports/${reportId}/download`, { responseType: "blob" });
    triggerDownload(response.data, `riskiq-report-${documentRef}.pdf`);
  };

  const regenerateReportForSession = async () => {
    if (!selected?.id) return;
    setRegenerating(true);
    try {
      const { data } = await api.post(`/sessions/${selected.id}/report`);
      const report = data.report;
      const documentRef = report?.document_ref || selected?.result_json?.document_id || selected.id;
      await downloadFromReportId(report.id, documentRef);
      await loadSession(selected.id);
      await fetchSessions();
    } catch (e) {
      setError(e.response?.data?.error || "Failed to regenerate report for this session");
    } finally {
      setRegenerating(false);
    }
  };

  const downloadReport = async () => {
    if (!selected) return;
    setDownloading(true);
    setError("");
    try {
      const reportId = selected.result_json?.report_id;
      const documentRef = selected.result_json?.document_id || selected.id;
      if (reportId) {
        await downloadFromReportId(reportId, documentRef);
      } else {
        await regenerateReportForSession();
      }
    } catch (e) {
      if (e?.response?.status === 404) {
        await regenerateReportForSession();
      } else {
        setError(e.response?.data?.error || "Report download failed");
      }
    } finally {
      setDownloading(false);
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

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Intelligence Portal</h2>
          <p className="text-gray-500 mt-1">Audit-ready historical analysis and session intelligence.</p>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="relative group w-full lg:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-accent transition-colors" />
            <input
              type="text"
              placeholder="Search sessions..."
              className="w-full bg-white border border-gray-100 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="p-2.5 bg-white border border-gray-100 rounded-xl hover:bg-gray-50 transition-all shadow-sm">
            <Filter className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {error && (
        <div className="card p-3 border-red-200 bg-red-50 text-red-700 text-sm font-medium">{error}</div>
      )}

      <div className="grid gap-6 xl:grid-cols-[360px,minmax(0,1fr)] items-start">
        <aside className="card p-4 xl:sticky xl:top-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Session Timeline</span>
            <span className="text-[10px] font-bold text-accent bg-blue-50 px-2 py-0.5 rounded-full">{sessions.length} TOTAL</span>
          </div>

          <div className="space-y-3 max-h-[62vh] overflow-y-auto pr-1 custom-scrollbar">
            {filteredSessions.map((s) => (
              <button
                key={s.id}
                onClick={() => loadSession(s.id)}
                className={cn(
                  "w-full text-left p-4 rounded-xl border transition-all relative",
                  selected?.id === s.id
                    ? "bg-white border-accent shadow-md shadow-accent/10"
                    : "bg-gray-50/60 border-gray-100 hover:bg-white hover:border-gray-200"
                )}
              >
                <div className="flex justify-between items-start gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-white text-gray-500 border border-gray-100">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span
                    className={cn(
                      "text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded",
                      s.status === "completed"
                        ? "bg-emerald-50 text-emerald-700"
                        : s.status === "failed"
                          ? "bg-red-50 text-red-700"
                          : "bg-blue-50 text-blue-700"
                    )}
                  >
                    {s.status}
                  </span>
                </div>

                <p className="text-xs font-bold text-gray-900 break-words leading-snug">{s.file_name.split("/").pop()}</p>

                <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-[10px] text-gray-500 font-medium mt-2">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {new Date(s.updated_at).toLocaleDateString()}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(s.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </button>
            ))}

            {filteredSessions.length === 0 && (
              <div className="py-14 text-center flex flex-col items-center">
                <History className="w-10 h-10 text-gray-200 mb-3" />
                <p className="text-sm font-semibold text-gray-400">No sessions found</p>
              </div>
            )}
          </div>
        </aside>

        <section className="min-w-0">
          {loading ? (
            <div className="card p-12 flex flex-col items-center justify-center space-y-4">
              <Zap className="w-10 h-10 text-accent animate-pulse" />
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Synchronizing Session Data...</p>
            </div>
          ) : selected ? (
            <div className="space-y-6">
              <div className="card p-5">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-xl font-bold text-gray-900 break-words">{selected.file_name.split("/").pop()}</h3>
                    <div className="flex items-center flex-wrap gap-3 mt-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      <span>UUID: {selected.id.slice(0, 8)}</span>
                      <span className="h-1 w-1 bg-gray-300 rounded-full" />
                      <span>Type: Document Analysis</span>
                    </div>
                  </div>

                  <button
                    onClick={downloadReport}
                    disabled={downloading || regenerating}
                    className="inline-flex items-center gap-2 px-3 py-2.5 bg-white border border-gray-100 rounded-xl hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50"
                    title="Download report"
                  >
                    <Download className="w-4 h-4 text-gray-500" />
                    <span className="text-xs font-semibold text-gray-700">
                      {regenerating ? "Regenerating..." : downloading ? "Downloading..." : "Download Report"}
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card p-4 bg-gray-50/50">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Processing Status</p>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                    <span className="text-sm font-bold text-gray-900 uppercase break-all">{selected.status}</span>
                  </div>
                </div>
                <div className="card p-4 bg-gray-50/50">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Final Stage</p>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-accent" />
                    <span className="text-sm font-bold text-gray-900 uppercase break-all">{selected.current_stage || "DONE"}</span>
                  </div>
                </div>
                <div className="card p-4 bg-gray-50/50">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Date Finalized</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-bold text-gray-900">{new Date(selected.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {selected.result_json ? (
                <AnalysisResults result={selected.result_json} />
              ) : selected.error_text ? (
                <div className="card p-10 text-center bg-red-50/30 border-red-100">
                  <AlertCircle className="w-12 h-12 text-error mx-auto mb-4" />
                  <h4 className="text-lg font-bold text-red-900">Pipeline Execution Failed</h4>
                  <p className="text-sm text-red-600 mt-2 max-w-md mx-auto break-words">{selected.error_text}</p>
                </div>
              ) : (
                <div className="card p-10 text-center bg-gray-50/30 border-dashed">
                  <Activity className="w-12 h-12 text-gray-200 mx-auto mb-4 animate-pulse" />
                  <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Analysis Results Unavailable</p>
                </div>
              )}
            </div>
          ) : (
            <div className="card p-12 flex flex-col items-center justify-center opacity-70">
              <Zap className="w-14 h-14 text-gray-200 mb-6" />
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Select a session to view intelligence</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
