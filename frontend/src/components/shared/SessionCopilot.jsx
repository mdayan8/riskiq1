import { useMemo, useState, useRef, useEffect } from "react";
import { Bot, MessageSquare, Send, ShieldCheck, Info, CornerDownRight, Zap } from "lucide-react";
import { api } from "../../lib/api";
import { cn } from "../../lib/utils";

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
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
          follow_up: data.follow_up || "",
          evidence_cards: data.evidence_cards || []
        }
      ]);
    } catch (e) {
      setError(e.response?.data?.error || "Copilot failed to answer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card h-[600px] flex flex-col overflow-hidden bg-slate-50/20">
      <div className="p-4 border-b border-slate-100 bg-white sticky top-0 z-20">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 inline-flex items-center gap-2">
            <Zap className="w-4 h-4 text-slate-900 fill-slate-900" /> Astra Compliance Copilot
          </h3>
          <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">GROUNDED</span>
        </div>
        <p className="text-[11px] text-slate-500 font-medium">
          Contextually aware intelligence grounded in this specific document session.
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.length === 0 && (
          <div className="space-y-4 py-4">
            <div className="rounded-2xl bg-white border border-slate-100 p-6 text-center shadow-sm">
              <Bot className="w-8 h-8 text-slate-200 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-900">Awaiting your query.</p>
              <p className="text-xs text-slate-500 mt-1 max-w-[200px] mx-auto">Ask about compliance violations, risk logic, or remediation steps.</p>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => ask(q)}
                  className="text-left text-[11px] font-bold p-3 rounded-xl border border-slate-100 bg-white hover:border-slate-300 hover:shadow-sm transition-all text-slate-600 flex items-center justify-between group"
                >
                  {q}
                  <CornerDownRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn(
            "space-y-2 max-w-[90%]",
            m.role === "user" ? "ml-auto" : "mr-auto"
          )}>
            <div className={cn(
              "rounded-2xl p-4 text-sm leading-relaxed",
              m.role === "user"
                ? "bg-slate-900 text-white font-medium"
                : "bg-white border border-slate-100 text-slate-800 shadow-sm shadow-slate-200/50"
            )}>
              {m.content}
            </div>

            {m.role === "assistant" && Array.isArray(m.citations) && m.citations.length > 0 && (
              <div className="pl-2 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-4 mb-2">Evidence Citations</p>
                <div className="grid grid-cols-1 gap-2">
                  {m.citations.slice(0, 3).map((c, idx) => (
                    <div key={idx} className="p-2 bg-white/50 border border-slate-100 rounded-lg">
                      <div className="flex items-center gap-1.5 mb-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        <span className="text-[9px] font-black uppercase text-slate-900">{c.type || "Evidence"}</span>
                        {c.id && (
                          <span className="text-[9px] font-semibold text-slate-500">#{c.id}</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 italic line-clamp-2">"{c.evidence || "No snippet"}"</p>
                      {c.link && (
                        <a
                          href={c.link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block mt-1 text-[10px] font-semibold text-blue-700 hover:text-blue-800 underline"
                        >
                          Open source reference
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {m.role === "assistant" && Array.isArray(m.evidence_cards) && m.evidence_cards.length > 0 && (
              <div className="pl-2 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-3 mb-1">What is wrong in this document</p>
                <div className="space-y-1">
                  {m.evidence_cards
                    .filter((e) => e.type === "violation")
                    .slice(0, 4)
                    .map((e, idx) => (
                      <div key={`${e.id}-${idx}`} className="rounded-lg border border-rose-100 bg-rose-50/60 px-2 py-1.5">
                        <p className="text-[10px] font-black text-rose-700 uppercase">{e.id || "Violation"}</p>
                        <p className="text-[11px] text-rose-900 leading-relaxed">{e.evidence}</p>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="bg-white border border-slate-100 rounded-2xl p-4 mr-auto animate-pulse flex items-center gap-2">
            <div className="flex gap-1">
              <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-white border-t border-slate-100">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
          className="relative"
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask session intelligence..."
            className="w-full bg-slate-50 border-transparent rounded-xl pl-4 pr-12 py-3 text-sm focus:bg-white focus:ring-0 focus:border-slate-200 transition-all font-medium"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-900 disabled:opacity-30 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        {error && <p className="text-[10px] font-bold text-rose-500 mt-2 uppercase tracking-tight">{error}</p>}
      </div>
    </div>
  );
}
