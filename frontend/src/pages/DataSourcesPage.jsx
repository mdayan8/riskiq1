import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function DataSourcesPage() {
  const [type, setType] = useState("postgres");
  const [name, setName] = useState("Primary Source");
  const [config, setConfig] = useState('{"host":"localhost","port":5432}');
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [steps, setSteps] = useState([]);
  const [sources, setSources] = useState([]);

  const loadSources = async () => {
    try {
      const { data } = await api.get("/data-sources");
      setSources(data.sources || []);
    } catch (e) {
      setError(e.response?.data?.error || "Failed to load sources");
    }
  };

  useEffect(() => {
    loadSources();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setStatus("");
    setError("");
    setSteps([]);

    try {
      const { data } = await api.post("/connect-database", {
        type,
        name,
        config: JSON.parse(config)
      });
      setSteps(data.steps || []);
      setStatus("Connector saved successfully");
      await loadSources();
    } catch (e2) {
      setError(e2.response?.data?.error || "Failed to save connector");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <form onSubmit={submit} className="card p-4 space-y-3 lg:col-span-2">
        <h2 className="text-lg font-semibold">Data Source Connectors</h2>
        <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="postgres">PostgreSQL</option>
          <option value="mongodb">MongoDB</option>
          <option value="csv">CSV</option>
          <option value="excel">Excel</option>
          <option value="api">API Endpoint</option>
          <option value="manual">Manual Upload</option>
        </select>
        <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="Connector Name" />
        <textarea className="h-36 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm" value={config} onChange={(e) => setConfig(e.target.value)} />
        <button className="rounded-lg bg-blue-700 px-4 py-2 text-white">Test & Save Connector</button>
        {status && <p className="text-sm text-emerald-700">{status}</p>}
        {error && <p className="text-sm text-red-700">{error}</p>}
        {steps.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-semibold text-slate-600">Connection Workflow</p>
            <div className="space-y-1">
              {steps.map((s, i) => (
                <p key={`${s.step}-${i}`} className="text-xs text-slate-700">{s.step}: {s.status}</p>
              ))}
            </div>
          </div>
        )}
      </form>

      <div className="card p-4">
        <h3 className="text-lg font-semibold">Active Sources</h3>
        <div className="mt-3 space-y-2">
          {sources.map((src) => (
            <div key={src.id} className="rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-medium">{src.name}</p>
              <p className="text-xs text-slate-500">{src.type}</p>
              <p className="text-xs text-slate-500">{new Date(src.created_at).toLocaleString()}</p>
            </div>
          ))}
          {sources.length === 0 && <p className="text-sm text-slate-500">No sources configured yet.</p>}
        </div>
      </div>
    </div>
  );
}
