import { useMemo, useState } from "react";
import { Bot, MessageSquare, Send } from "lucide-react";
import { api } from "../../lib/api";

const QUICK_QUESTIONS = [
  "Why was this document flagged?",
  "What are the top 3 issues to fix first?",
  "Explain the risk score in plain language.",
  "Which violations are high severity and why?"
];

export default function SessionCopilot({ sessionId }) {
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const history = useMemo(
    () => messages.map((m) => ({ role: m.role, content: m.content })),
    [messages]
  );

  const ask = async (q) => {
    const text = q?.trim();
    if (!text || !sessionId || loading) return;
    setError("");
    const userMsg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");
    setLoading(true);

    try {
      const { data } = await api.post(`/sessions/${sessionId}/copilot`, {
        question: text,
        history: history.slice(-10)
      });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer || "No answer generated.",
          citations: data.citations || [],
          follow_up: data.follow_up || ""
        }
      ]);
    } catch (e) {
      setError(e.response?.data?.error || "Copilot failed to answer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-widest text-gray-800 inline-flex items-center gap-2">
          <Bot className="w-4 h-4 text-accent" /> Astra Compliance Copilot
        </h3>
        <span className="text-[10px] font-semibold px-2 py-1 rounded bg-blue-50 text-blue-700">Grounded + Cited</span>
      </div>

      <p className="text-xs text-slate-500">
        Ask about this session only. Answers are grounded in extracted entities, compliance, risk score, and alerts.
      </p>

      <div className="flex flex-wrap gap-2">
        {QUICK_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => ask(q)}
            disabled={loading}
            className="text-[11px] px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      <div className="space-y-3 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
        {messages.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center">
            <MessageSquare className="w-5 h-5 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-500">No questions yet. Ask a quick question to start.</p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`rounded-xl p-3 border ${m.role === "user" ? "bg-blue-50 border-blue-100" : "bg-white border-slate-200"}`}>
            <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-500 mb-1">{m.role === "user" ? "You" : "Copilot"}</p>
            <p className="text-sm text-slate-800 whitespace-pre-wrap">{m.content}</p>

            {m.role === "assistant" && Array.isArray(m.citations) && m.citations.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-500">Evidence Citations</p>
                {m.citations.slice(0, 6).map((c, idx) => (
                  <p key={idx} className="text-[11px] text-slate-600">
                    • <span className="font-semibold">{c.type || "source"}</span> {c.id ? `(${c.id})` : ""}: {c.evidence || "No snippet"}
                    {c.link && (
                      <>
                        {" "}
                        <a href={c.link} target="_blank" rel="noreferrer" className="text-blue-700 underline">
                          source link
                        </a>
                      </>
                    )}
                  </p>
                ))}
              </div>
            )}

            {m.role === "assistant" && m.follow_up && (
              <p className="mt-2 text-[11px] text-blue-700">Suggested next question: {m.follow_up}</p>
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="flex items-center gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask this session: why flagged, risk reason, fixes..."
          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-white px-3 py-2 text-sm font-semibold disabled:opacity-50"
        >
          <Send className="w-4 h-4" /> {loading ? "Thinking..." : "Ask"}
        </button>
      </form>
    </div>
  );
}
