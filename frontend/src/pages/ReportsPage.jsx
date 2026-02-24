import { useEffect, useState } from "react";
import { Download, Search, Filter, FileText, MoreVertical, ShieldAlert } from "lucide-react";
import { api } from "../lib/api";

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    api
      .get("/reports")
      .then((res) => setReports(res.data.reports))
      .catch((e) => setError(e.response?.data?.error || "Failed to load reports"));
  }, []);

  const downloadReport = async (report) => {
    try {
      setDownloadingId(report.id);
      setError(""); // Reset error
      const response = await api.get(`/reports/${report.id}/download`, { responseType: "blob" });

      // Validation: Check if it's actually a PDF
      if (response.data.type !== "application/pdf") {
        setError("Invalid report format received. The file may be corrupt.");
        return;
      }

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `riskiq-report-${report.document_ref}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.response?.data?.error || "Report download failed");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6">

      {/* Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Compliance Reports</h2>
          <p className="text-gray-500 mt-1">Generated audit trails, extracted summaries, and risk assessments.</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-error-light/50 border border-error/20 rounded-xl text-error">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Toolbar */}
      <div className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search reports by ID or document reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors">
            <Filter className="w-4 h-4 mr-2 text-gray-500" />
            Filter
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50/80 text-gray-500 font-medium border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Report Details</th>
                <th className="px-6 py-4">Generated Date</th>
                <th className="px-6 py-4">Document Ref</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.map((report) => (
                <tr key={report.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-accent flex items-center justify-center">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 leading-tight">RiskIQ Audit Report</p>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">{report.id.substring(0, 8)}...</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {new Date(report.created_at).toLocaleString(undefined, {
                      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </td>
                  <td className="px-6 py-4 text-gray-700 font-medium">{report.document_ref}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => downloadReport(report)}
                        disabled={downloadingId === report.id}
                        className="inline-flex items-center px-3 py-1.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-accent rounded-md text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        {downloadingId === report.id ? (
                          <span className="w-4 h-4 border-2 border-accent border-r-transparent rounded-full animate-spin mr-1.5" />
                        ) : (
                          <Download className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        Download PDF
                      </button>
                      <button className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {reports.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center">
                      <FileText className="w-12 h-12 text-gray-300 mb-3" />
                      <p className="text-sm font-medium text-gray-900">No reports generated yet</p>
                      <p className="text-xs text-gray-500 mt-1">Run an agent pipeline on a project to generate a report.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

