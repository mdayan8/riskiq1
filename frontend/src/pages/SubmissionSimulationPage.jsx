import { useEffect, useMemo, useState } from "react";
import { Play, PlusCircle, Send, FileText, CheckCircle2 } from "lucide-react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

export default function SubmissionSimulationPage() {
  const [sessions, setSessions] = useState([]);
  const [simulations, setSimulations] = useState([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState([]);
  const [mode, setMode] = useState("single");
  const [name, setName] = useState("RBI Submission Package");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const [s, sims] = await Promise.all([api.get("/sessions"), api.get("/submission-simulations")]);
      setSessions(s.data.sessions || []);
      setSimulations(sims.data.simulations || []);
    } catch (e) {
      setError(e.response?.data?.error || "Failed to load simulation workspace");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const selectedCount = selectedSessionIds.length;

  const createSimulation = async () => {
    if (!selectedCount) return;
    setLoading(true);
    setError("");
    try {
      await api.post("/submission-simulations", {
        name,
        regulator: "RBI",
        mode,
        session_ids: selectedSessionIds
      });
      setSelectedSessionIds([]);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || "Failed to create simulation");
    } finally {
      setLoading(false);
    }
  };

  const runSimulation = async (id) => {
    try {
      await api.post(`/submission-simulations/${id}/run`);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || "Failed to run simulation");
    }
  };

  const downloadByReportId = async (reportId, fallbackName) => {
    const response = await api.get(`/reports/${reportId}/download`, { responseType: "blob" });
    const blob = new Blob([response.data], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fallbackName}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const sortedSessions = useMemo(() => sessions.slice().sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)), [sessions]);

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-primary">RBI Submission Simulation</h2>
        <p className="text-gray-500 mt-1">Stage any session or combined package and simulate direct submission to RBI.</p>
      </div>

      {error && <div className="card p-3 bg-red-50 border-red-200 text-red-700 text-sm font-medium">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[420px,minmax(0,1fr)]">
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-gray-700">Create Simulation</h3>
          <input
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Simulation package name"
          />

          <div className="flex items-center gap-3">
            <select className="rounded-xl border border-gray-200 px-3 py-2 text-sm" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="single">Single</option>
              <option value="combined">Combined</option>
            </select>
            <span className="text-xs text-gray-500">Selected sessions: {selectedCount}</span>
          </div>

          <div className="max-h-72 overflow-y-auto pr-1 custom-scrollbar space-y-2">
            {sortedSessions.map((s) => {
              const checked = selectedSessionIds.includes(s.id);
              const eligible = s.status === "completed" && !!s.document_id;
              return (
                <label
                  key={s.id}
                  className={cn(
                    "block rounded-lg border p-3",
                    eligible ? "cursor-pointer" : "cursor-not-allowed opacity-60",
                    checked ? "border-accent bg-blue-50/50" : "border-gray-100 bg-gray-50/40"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!eligible}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedSessionIds((v) => [...v, s.id]);
                        else setSelectedSessionIds((v) => v.filter((id) => id !== s.id));
                      }}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 break-words">{s.file_name.split("/").pop()}</p>
                      <p className="text-[10px] text-gray-500 mt-1">
                        {s.status} • {new Date(s.updated_at).toLocaleString()}
                        {!eligible && " • not eligible"}
                      </p>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          <button
            onClick={createSimulation}
            disabled={!selectedCount || loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50"
          >
            <PlusCircle className="w-4 h-4" /> Stage Simulation
          </button>
        </div>

        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-gray-700">Simulation Queue</h3>
          <div className="space-y-3">
            {simulations.map((sim) => (
              <div key={sim.id} className="rounded-xl border border-gray-100 bg-gray-50/40 p-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 break-words">{sim.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{sim.regulator} • {sim.mode} • {sim.status}</p>
                    {sim.submission_ref && <p className="text-xs text-emerald-700 mt-1 font-medium">Reference: {sim.submission_ref}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => runSimulation(sim.id)}
                      disabled={sim.status === "SUBMITTED"}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs font-semibold disabled:opacity-50"
                    >
                      {sim.status === "SUBMITTED" ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Play className="w-4 h-4" />} Run
                    </button>
                    {sim.report_id && (
                      <button
                        onClick={() => downloadByReportId(sim.report_id, `rbi-sim-${sim.id.slice(0, 8)}`)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs font-semibold"
                      >
                        <FileText className="w-4 h-4" /> Package
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  {(sim.timeline_json || []).slice(-4).map((t, i) => (
                    <p key={i} className="text-[11px] text-gray-600 inline-flex items-center gap-2 mr-3">
                      <Send className="w-3 h-3 text-accent" /> {t.step}: {t.message}
                    </p>
                  ))}
                </div>
              </div>
            ))}
            {simulations.length === 0 && <p className="text-sm text-gray-500">No simulations staged yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
