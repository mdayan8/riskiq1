import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function ComplianceStorePage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await api.get("/compliance-knowledge");
      setData(res.data);
    } catch (e) {
      setError(e.response?.data?.error || "Failed to load compliance store");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const refreshKnowledge = async () => {
    try {
      setRefreshing(true);
      await api.post("/knowledge-base/refresh");
      await load();
    } catch (e) {
      setError(e.response?.data?.error || "Knowledge refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  if (error) return <div className="card p-4 text-red-600">{error}</div>;
  if (!data) return <div className="card p-4">Loading compliance datastore...</div>;

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Compliance Knowledge Datastore</h2>
            <p className="text-sm text-slate-600">Knowledge: {data.knowledge_items.length} | Rules: {data.rules.length} | Agents: {data.agents.length}</p>
          </div>
          <button onClick={refreshKnowledge} disabled={refreshing} className="rounded-lg bg-blue-700 px-3 py-1.5 text-sm text-white disabled:opacity-60">
            {refreshing ? "Refreshing..." : "Refresh From Sources"}
          </button>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="mb-3 font-medium">Regulatory Sources (with references)</h3>
        <div className="space-y-2">
          {data.knowledge_items.map((item) => (
            <div key={item.source_id} className="rounded-xl border border-slate-200 p-3">
              <p className="font-medium">{item.title}</p>
              <p className="text-xs text-slate-500">{item.regulator} • {item.framework} • {item.jurisdiction}</p>
              <p className="mt-1 text-sm text-slate-700">{item.summary}</p>
              <a className="mt-1 inline-block text-xs text-blue-700 underline" target="_blank" rel="noreferrer" href={item.source_url}>Reference Source</a>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-2 font-medium">Active Rules</h3>
          <pre className="max-h-72 overflow-auto rounded-lg bg-slate-50 p-3 text-xs">{JSON.stringify(data.rules, null, 2)}</pre>
        </div>
        <div className="card p-4">
          <h3 className="mb-2 font-medium">Agent Identities & System Prompts</h3>
          <pre className="max-h-72 overflow-auto rounded-lg bg-slate-50 p-3 text-xs">{JSON.stringify(data.agents, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}
