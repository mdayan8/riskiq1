import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  ShieldAlert,
  ShieldCheck,
  Database,
  FileText,
  Activity,
  ChevronRight,
  ArrowRight,
  ExternalLink,
  Info,
  PieChart as PieIcon,
  TrendingUp,
  Cpu,
  ScanSearch
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { cn } from "../../lib/utils";
import { api } from "../../lib/api";

const getScoreColor = (score, mappedColor) => {
  if (mappedColor === "GREEN") return "#10b981";
  if (mappedColor === "ORANGE") return "#f97316";
  if (mappedColor === "RED") return "#ef4444";
  if (score < 0.15) return "#10b981";
  if (score < 0.6) return "#f97316";
  return "#ef4444";
};

export default function AnalysisResults({ result }) {
  if (!result) return null;

  const extractedData = result.extracted_data || result.structured_data || {};
  const profile = result.document_profile || {};
  const [showAllViolations, setShowAllViolations] = useState(false);
  const violations = result.compliance?.violations || [];
  const visibleViolations = showAllViolations ? violations : violations.slice(0, 12);
  const severityCounts = useMemo(() => {
    const stats = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const v of violations) {
      const s = v?.severity || "LOW";
      if (stats[s] !== undefined) stats[s] += 1;
    }
    return stats;
  }, [violations]);

  const downloadReport = async () => {
    const documentRef = result.document_id;
    if (!documentRef) return;

    try {
      let reportId = result.report_id;
      if (!reportId) {
        const latest = await api.get(`/reports/by-document/${documentRef}/latest`);
        reportId = latest.data?.report?.id;
      }
      if (!reportId) return;

      const response = await api.get(`/reports/${reportId}/download`, { responseType: "blob" });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `riskiq-report-${documentRef}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (_e) {
      // no-op
    }
  };

  return (
    <div className="grid gap-6 grid-cols-1 lg:grid-cols-12 animate-slide-up">
      <div className="lg:col-span-4 space-y-6">
        <div className="card p-6">
          <div className="mb-4 w-full flex justify-between items-center text-xs font-bold uppercase tracking-widest text-gray-400">
            <span>Risk Evaluation</span>
            <PieIcon className="w-4 h-4" />
          </div>

          <div className="relative h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: "Score", value: result.decision.score },
                    { name: "Remainder", value: 1 - result.decision.score }
                  ]}
                  cx="50%"
                  cy="100%"
                  startAngle={180}
                  endAngle={0}
                  innerRadius={56}
                  outerRadius={74}
                  dataKey="value"
                >
                  <Cell fill={getScoreColor(result.decision.score, result.decision.color)} />
                  <Cell fill="#f1f5f9" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute bottom-0 left-0 w-full text-center">
              <span className="text-4xl font-black text-gray-900">{(result.decision.score * 100).toFixed(1)}%</span>
              <p className="text-[10px] uppercase font-bold tracking-tighter text-gray-400 mt-1">Composite Risk Score</p>
            </div>
          </div>

          <div
            className={cn(
              "mt-4 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border inline-flex items-center gap-2",
              result.decision.color === "GREEN"
                ? "bg-success-light text-success border-success/20"
                : result.decision.color === "ORANGE"
                  ? "bg-orange-50 text-orange-600 border-orange-200"
                  : "bg-error-light text-error border-error/20"
            )}
          >
            {result.decision.risk_category} Risk
            <div className="group/info relative">
              <Info className="w-3.5 h-3.5 opacity-60 cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2 bg-gray-900 text-[10px] text-white rounded-lg opacity-0 group-hover/info:opacity-100 transition-opacity pointer-events-none z-50 normal-case font-medium leading-tight">
                {result.decision?.explanation || "Two-layer verified score from AI + regulatory source layer."}
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase">AI Confidence</p>
              <p className="text-lg font-bold text-gray-900">{(result.decision.confidence * 100).toFixed(0)}%</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase">Violations</p>
              <p className="text-lg font-bold text-error">{result.compliance?.summary?.violations_count || 0}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase">Doc Intelligence</p>
              <p className="text-lg font-bold text-gray-900">{((result.decision.document_intelligence_confidence || 0) * 100).toFixed(0)}%</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase">Compliance Alignment</p>
              <p className="text-lg font-bold text-gray-900">{((result.decision.compliance_alignment_score || 0) * 100).toFixed(0)}%</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-[10px] px-2 py-1 rounded bg-slate-100 text-slate-700 font-semibold">AI Score: {((result.decision?.verification?.ai_risk_score ?? 0) * 100).toFixed(1)}%</span>
            <span className="text-[10px] px-2 py-1 rounded bg-slate-100 text-slate-700 font-semibold">Source Score: {((result.decision?.verification?.source_risk_score ?? 0) * 100).toFixed(1)}%</span>
            <span className="text-[10px] px-2 py-1 rounded bg-slate-100 text-slate-700 font-semibold">Fraud Signal: {((result.decision?.fraud_score ?? 0) * 100).toFixed(1)}%</span>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Neural Architecture</h3>
          <div className="space-y-3">
            {(result.models_used || []).map((m, i) => (
              <div key={`${m.component}-${i}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-accent/20 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center">
                    <Cpu className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">{m.component}</p>
                    <p className="text-[10px] text-gray-500 uppercase">{m.provider} • {m.model}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Document Auto Detection</h3>
          <div className="flex items-center gap-2 mb-2 text-gray-800">
            <ScanSearch className="w-4 h-4 text-accent" />
            <span className="text-sm font-semibold capitalize">{(profile.document_type || "unknown").replaceAll("_", " ")}</span>
          </div>
          <p className="text-xs text-gray-500">Type confidence: {((profile.document_type_confidence || 0) * 100).toFixed(0)}%</p>
          <p className="text-xs text-gray-500 mt-1">Input mode: {profile.input_mode || "unknown"}</p>
          <p className="text-xs text-gray-500 mt-1">Format: {(profile.file_extension || "unknown").toUpperCase()}</p>
        </div>
      </div>

      <div className="lg:col-span-8 space-y-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-accent" /> Structured Entity Hub
            </h3>
            <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">DEEPSEEK-REASONER</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(extractedData)
              .filter(([_, val]) => Array.isArray(val) && val.length > 0)
              .map(([key, value]) => (
                <div key={key} className="p-4 bg-gray-50/50 rounded-xl border border-gray-100 group hover:border-accent/40 transition-all">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-2 group-hover:text-accent flex items-center gap-1.5">
                    <ChevronRight className="w-3 h-3" /> {key.replaceAll("_", " ")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {value.slice(0, 5).map((item, i) => (
                      <span key={i} className="text-xs bg-white text-gray-800 px-2 py-1 rounded-md border border-gray-100 shadow-sm font-medium">
                        {String(item)}
                      </span>
                    ))}
                    {value.length > 5 && <span className="text-xs text-gray-400 italic">+{value.length - 5} more</span>}
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card p-6 border-l-4 border-error">
            <h3 className="text-sm font-bold uppercase tracking-widest text-error flex items-center gap-2 mb-3">
              <ShieldAlert className="w-4 h-4" /> Compliance Violations
            </h3>
            {violations.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                <span className="text-[10px] px-2 py-1 rounded bg-red-50 text-red-700 font-semibold">HIGH: {severityCounts.HIGH}</span>
                <span className="text-[10px] px-2 py-1 rounded bg-amber-50 text-amber-700 font-semibold">MEDIUM: {severityCounts.MEDIUM}</span>
                <span className="text-[10px] px-2 py-1 rounded bg-blue-50 text-blue-700 font-semibold">LOW: {severityCounts.LOW}</span>
                <span className="text-[10px] px-2 py-1 rounded bg-slate-100 text-slate-700 font-semibold">TOTAL: {violations.length}</span>
              </div>
            )}
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {visibleViolations.map((v, i) => (
                <div key={i} className="p-3 bg-error-light/20 rounded-xl space-y-1 border border-error/10">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-error uppercase">{v.rule_id}</span>
                    <span className="text-[9px] bg-error text-white px-1.5 py-0.5 rounded uppercase font-black">{v.severity}</span>
                  </div>
                  <p className="text-xs text-gray-700 leading-snug">{v.message}</p>
                </div>
              ))}
              {!violations.length && (
                <div className="flex flex-col items-center justify-center py-10 text-success opacity-60">
                  <ShieldCheck className="w-12 h-12 mb-2" />
                  <p className="text-xs font-bold uppercase">No Violations Detected</p>
                </div>
              )}
            </div>
            {violations.length > 12 && (
              <button
                type="button"
                onClick={() => setShowAllViolations((v) => !v)}
                className="mt-3 text-xs font-semibold text-accent hover:text-accent-dark"
              >
                {showAllViolations ? "Show less" : `Show all (${violations.length})`}
              </button>
            )}
          </div>

          <div className="card p-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-accent flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4" /> Strategic Remediation
            </h3>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {(result.suggestions || []).map((s, i) => (
                <div key={i} className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-100 relative group overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-accent opacity-40" />
                  <div className="flex items-start justify-between gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <Info className="w-4 h-4 text-accent" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-gray-900 leading-tight mb-1">{s.message}</p>
                      <ul className="space-y-1">
                        {(s.actions || []).map((action, j) => (
                          <li key={j} className="text-[11px] text-gray-600 flex items-start gap-1.5 leading-relaxed">
                            <ArrowRight className="w-3 h-3 text-accent shrink-0 mt-0.5" /> {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card p-6 bg-primary text-white overflow-hidden relative">
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-accent-light flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4" /> GVR Standards Framework
              </h3>
              <p className="text-xs text-gray-400 max-w-lg">All decisions are cross-mapped against active regulatory schemas.</p>
            </div>
            {result.document_id && (
              <button
                type="button"
                onClick={downloadReport}
                className="bg-accent hover:bg-accent-dark transition-colors px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg"
              >
                <FileText className="w-4 h-4" /> Intelligence Report
              </button>
            )}
          </div>
          <div className="mt-6 flex flex-wrap gap-2 relative z-10">
            {(result.standard_references || []).map((ref, i) => (
              <a
                key={i}
                href={ref.source_url}
                target="_blank"
                rel="noreferrer"
                className="bg-white/5 hover:bg-accent hover:text-white transition-all px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2 group"
              >
                <span className="text-[10px] font-bold group-hover:scale-105 transition-transform">{ref.source_id}</span>
                <ExternalLink className="w-3 h-3 opacity-40 group-hover:opacity-100" />
              </a>
            ))}
          </div>
          <ShieldCheck className="absolute -bottom-10 -right-10 w-48 h-48 opacity-5 text-white" />
        </div>
      </div>
    </div>
  );
}
