
import { useState, useEffect } from "react";
import { API_BASE_URL } from "../config/api";

export interface AuditRecord {
  id: string;
  auditId: string;
  user: string;
  role: string;
  module: string;
  action: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  previousData?: string;
  newData?: string;
  timestamp: string;
}

const formatGMT8Time = (dateString: string) => {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const formattedDate = d.toLocaleString("en-US", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });
    return `${formattedDate} GMT+8`;
  } catch {
    return dateString;
  }
};

const getGMT8DateString = () => {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
};

export default function AuditTrailView({
  records: initialRecords = [],
  isCollapsed = false
}: {
  records?: AuditRecord[];
  isCollapsed?: boolean
}) {
  const [records, setRecords] = useState<AuditRecord[]>(initialRecords);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModule, setSelectedModule] = useState("ALL");
  const [selectedSeverity, setSelectedSeverity] = useState("ALL");
  const [actionCategory, setActionCategory] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState<AuditRecord | null>(null);

  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [hasDownloadedBackup, setHasDownloadedBackup] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const itemsPerPage = 10;

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/audit-logs`);

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      const serverData = Array.isArray(data) ? data : (data.data || []);
      setRecords(serverData);

    } catch (err) {
      console.warn("Backend fetch failed, falling back to Local Storage:", err);

      try {
        const localData = localStorage.getItem("lgu_audit");
        setRecords(localData ? JSON.parse(localData) : []);
      } catch (localError) {
        console.error("Failed to parse local storage logs", localError);
        setRecords([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [API_BASE_URL]);

  const filteredRecords = records.filter((record) => {
    const matchesSearch =
      record.auditId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.action.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesModule = selectedModule === "ALL" || record.module === selectedModule;
    const matchesSeverity = selectedSeverity === "ALL" || record.severity === selectedSeverity;

    let matchesActionCategory = true;
    const act = record.action.toLowerCase();
    if (actionCategory === "LOGOUT") {
      matchesActionCategory = act.includes("logout") || act.includes("sign out");
    } else if (actionCategory === "CREATE_ACCOUNT") {
      matchesActionCategory = act.includes("create") || act.includes("register") || act.includes("signup");
    } else if (actionCategory === "CHANGE_PASSWORD") {
      matchesActionCategory = act.includes("password") || act.includes("credential update");
    }

    let matchesDate = true;
    const recordDate = new Date(record.timestamp);
    if (startDate) {
      matchesDate = matchesDate && recordDate >= new Date(startDate);
    }
    if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      matchesDate = matchesDate && recordDate <= endDateTime;
    }

    return matchesSearch && matchesModule && matchesSeverity && matchesActionCategory && matchesDate;
  });

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage) || 1;
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const exportToCSV = () => {
    const headers = ["Audit ID", "User", "Role", "Module", "Action", "Severity", "Previous Data", "New Data", "Timestamp"];
    const rows = filteredRecords.map(r => [
      r.auditId,
      r.user,
      r.role,
      r.module,
      r.action,
      r.severity,
      `"${(r.previousData || "").replace(/"/g, '""')}"`,
      `"${(r.newData || "").replace(/"/g, '""')}"`,
      `"${formatGMT8Time(r.timestamp)}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `LGU_Audit_Trail_${getGMT8DateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadBackupJSON = () => {
    const backupData = records.map(record => ({
      ...record,
      timestamp: formatGMT8Time(record.timestamp)
    }));

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `LGU_Audit_Backup_${getGMT8DateString()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setHasDownloadedBackup(true);
  };

  const handleConfirmClearAndDelete = async () => {
    if (!hasDownloadedBackup) return;
    setIsDeleting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/audit-logs`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setRecords([]);
        localStorage.removeItem("lgu_audit");
        setIsClearModalOpen(false);
        setHasDownloadedBackup(false);
      } else {
        throw new Error('Failed to clear audit logs on the server.');
      }
    } catch (error) {
      console.warn('Network error clearing server logs, clearing local logs instead:', error);
      setRecords([]);
      localStorage.removeItem("lgu_audit");
      setIsClearModalOpen(false);
      setHasDownloadedBackup(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const getSeverityBadgeStyle = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/30";
      case "WARNING":
        return "bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/30";
      default:
        return "bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-500/30";
    }
  };

  const uniqueModules = ["ALL", ...Array.from(new Set(records.map(r => r.module)))];

  return (
    <main
      className={`
        min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans p-4 sm:p-8 transition-all duration-300
        ${isCollapsed ? "ml-20" : "ml-64"}
      `}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">System Audit Trail</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Immutable record of system activities and risk monitoring</p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={exportToCSV}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3.5 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer"
            >
              Export CSV
            </button>
            <button
              onClick={() => {
                setHasDownloadedBackup(false);
                setIsClearModalOpen(true);
              }}
              className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold px-3.5 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer"
            >
              Clear / Delete Logs
            </button>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
          <div>
            <input
              type="text"
              placeholder="Search ID, user, action..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <select
              value={actionCategory}
              onChange={(e) => setActionCategory(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
            >
              <option value="ALL">Event: All Actions</option>
              <option value="LOGOUT">Detect: Logouts</option>
              <option value="CREATE_ACCOUNT">Detect: Created Accts</option>
              <option value="CHANGE_PASSWORD">Detect: Pass Changes</option>
            </select>
          </div>
          <div>
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
            >
              {uniqueModules.map((mod) => (
                <option key={mod} value={mod} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Module: {mod}</option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
            >
              <option value="ALL">Severity: ALL</option>
              <option value="INFO">INFO</option>
              <option value="WARNING">WARNING</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </div>
          <div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        {/* Content Section */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider">Audit Activity Logs</h3>
            <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
              Showing {paginatedRecords.length} of {filteredRecords.length} entries
            </span>
          </div>

          {isLoading ? (
            <p className="text-slate-600 dark:text-slate-400 text-xs italic py-8 text-center">Loading audit logs...</p>
          ) : filteredRecords.length === 0 ? (
            <p className="text-slate-600 dark:text-slate-400 text-xs italic py-8 text-center">No matching audit logs found.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-800 dark:text-slate-200">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-xs uppercase text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-4 text-slate-900 dark:text-white font-bold">Audit ID</th>
                      <th className="p-4 text-slate-900 dark:text-white font-bold">User & Role</th>
                      <th className="p-4 text-slate-900 dark:text-white font-bold">Module / Action</th>
                      <th className="p-4 text-slate-900 dark:text-white font-bold">Severity</th>
                      <th className="p-4 text-slate-900 dark:text-white font-bold">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {paginatedRecords.map(record => (
                      <tr
                        key={record.id}
                        onClick={() => setSelectedRecord(record)}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                      >
                        <td className="p-4 font-mono font-bold text-slate-900 dark:text-white">{record.auditId}</td>
                        <td className="p-4 font-semibold text-slate-900 dark:text-white">{record.user}<br />
                          <span className="text-xs font-normal text-slate-600 dark:text-slate-400">{record.role}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-xs font-bold text-slate-900 dark:text-white block">{record.module}</span>
                          <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">{record.action}</span>
                        </td>
                        <td className="p-4">
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${getSeverityBadgeStyle(record.severity)}`}>
                            {record.severity}
                          </span>
                        </td>
                        <td className="p-4 text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {formatGMT8Time(record.timestamp)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800 text-xs">
                <span className="text-slate-600 dark:text-slate-400 font-medium">Page {currentPage} of {totalPages}</span>
                <div className="flex gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                    className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 disabled:opacity-40 cursor-pointer font-semibold"
                  >
                    Previous
                  </button>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                    className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 disabled:opacity-40 cursor-pointer font-semibold"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Clear/Delete Confirmation & Backup Modal */}
      {isClearModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-black text-rose-700 dark:text-rose-400 text-base flex items-center gap-2.5">
                Secure Log Deletion Warning
              </h3>
              <button
                onClick={() => setIsClearModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
              <p className="font-bold text-slate-900 dark:text-white text-sm">
                Are you sure you want to completely clear and delete all historical audit logs from the database?
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                Government compliance protocols dictate that records should be preserved. To proceed with the deletion, you must download a secure local JSON backup first.
              </p>

              <div className="bg-slate-100 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 p-4 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-[11px] uppercase tracking-wider">Step 1: Mandatory Backup</span>
                  {hasDownloadedBackup && (
                    <span className="text-emerald-700 dark:text-emerald-300 font-bold text-[10px] bg-emerald-100 dark:bg-emerald-500/20 px-2 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-500/30">
                      ✓ Backup Downloaded
                    </span>
                  )}
                </div>
                <button
                  onClick={handleDownloadBackupJSON}
                  className="w-full bg-slate-900 hover:bg-slate-950 text-black dark:bg-slate-800 dark:hover:bg-slate-700 font-bold py-3 px-4 rounded-xl transition-all cursor-pointer text-xs shadow-md border border-slate-700 flex items-center justify-center gap-2"
                >
                  Download JSON Backup Archive
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsClearModalOpen(false)}
                className="bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold px-4 py-2.5 rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={!hasDownloadedBackup || isDeleting}
                onClick={handleConfirmClearAndDelete}
                className="bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-md cursor-pointer"
              >
                {isDeleting ? "Wiping Logs..." : "Confirm & Delete Logs"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-xl shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <h4 className="font-bold text-slate-900 dark:text-white text-base">Audit Entry Details</h4>
              <button
                onClick={() => setSelectedRecord(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
              <p><strong className="text-slate-900 dark:text-white">Audit ID:</strong> <span className="font-mono text-slate-900 dark:text-slate-100">{selectedRecord.auditId}</span></p>
              <p><strong className="text-slate-900 dark:text-white">User:</strong> <span className="text-slate-900 dark:text-slate-100">{selectedRecord.user} ({selectedRecord.role})</span></p>
              <p><strong className="text-slate-900 dark:text-white">Module / Action:</strong> <span className="text-slate-900 dark:text-slate-100">{selectedRecord.module} / {selectedRecord.action}</span></p>
              <p><strong className="text-slate-900 dark:text-white">Severity Level:</strong> <span className="font-bold text-slate-900 dark:text-slate-100">{selectedRecord.severity}</span></p>

              {/* Display Timestamp formatted to GMT+8 inside the modal */}
              <p><strong className="text-slate-900 dark:text-white">Timestamp:</strong> <span className="text-slate-900 dark:text-slate-100">{formatGMT8Time(selectedRecord.timestamp)}</span></p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <span className="font-bold text-slate-900 dark:text-white uppercase text-[10px]">Previous State</span>
                  <pre className="font-mono text-[11px] whitespace-pre-wrap text-slate-700 dark:text-slate-300">{selectedRecord.previousData || "None"}</pre>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                  <span className="font-bold text-slate-900 dark:text-white uppercase text-[10px]">New State</span>
                  <pre className="font-mono text-[11px] whitespace-pre-wrap text-slate-700 dark:text-slate-300">{selectedRecord.newData || "None"}</pre>
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedRecord(null)}
                className="bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold px-4 py-2 rounded-xl text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}