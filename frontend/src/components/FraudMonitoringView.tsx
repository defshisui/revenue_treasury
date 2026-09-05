import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config/api';

interface FraudLog {
  id: string;
  auditId: string;
  timestamp: string;
  user: string;
  role: string;
  module: string;
  action: string;
  severity: string;
  ipAddress: string;
  userAgent: string;
  previousData: string;
  newData: string;
  isArchived?: boolean;
}

interface Props {
  isCollapsed: boolean;
}

export default function FraudMonitoringView({ isCollapsed }: Props) {
  const [logs, setLogs] = useState<FraudLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'Active' | 'Archived'>('Active');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'BLOCKED' | 'PASSED'>('ALL');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [revealedIps, setRevealedIps] = useState<Record<string, boolean>>({});

  const toggleIpVisibility = (id: string) => {
    setRevealedIps((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const maskIp = (ip: string, isRevealed: boolean) => {
    if (!ip) return "•••.•••.•••.•••";
    if (isRevealed) return ip;
    const parts = ip.split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1].replace(/./g, "*")}.${parts[2].replace(/./g, "*")}.${parts[3]}`;
    }
    return "•••.•••.•••.•••";
  };

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/audit-logs`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();

      const fraudRelated = data.filter((log: FraudLog) => 
        log.newData?.includes('Anti-Fraud') || 
        log.action === 'ACCOUNT_CREATION_BLOCKED' ||
        log.action === 'PAYMENT_BLOCKED' ||
        log.newData?.includes('Risk Score') ||
        log.auditId?.includes('FRAUD')
      );

      setLogs(fraudRelated);
    } catch (err) {
      console.error('Failed to fetch fraud logs:', err);
      showToast('Failed to load fraud logs from server', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleArchive = async (id: string, userEmail: string) => {
    if (!window.confirm(`Are you sure you want to move log for "${userEmail}" to the Archiver?`)) {
      return;
    }
    setActionInProgress(id);
    try {
      const res = await fetch(`${API_BASE_URL}/audit-logs/${id}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: true }),
      });
      if (!res.ok) throw new Error('Failed to archive');
      setLogs(prev => prev.map(item => item.id === id ? { ...item, isArchived: true } : item));
      showToast('Log record moved to Archiver successfully.');
    } catch (err) {
      console.error('Error archiving log:', err);
      showToast('Failed to archive log record.', 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRetrieve = async (id: string, userEmail: string) => {
    if (!window.confirm(`Retrieve and restore log for "${userEmail}" back to Active Monitoring?`)) {
      return;
    }
    setActionInProgress(id);
    try {
      const res = await fetch(`${API_BASE_URL}/audit-logs/${id}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: false }),
      });
      if (!res.ok) throw new Error('Failed to retrieve');
      setLogs(prev => prev.map(item => item.id === id ? { ...item, isArchived: false } : item));
      showToast('Log record retrieved and restored to Active Logs.');
    } catch (err) {
      console.error('Error retrieving log:', err);
      showToast('Failed to retrieve log record.', 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDeletePermanent = async (id: string, userEmail: string) => {
    if (!window.confirm(`⚠️ PERMANENT DELETE: Are you sure you want to permanently delete this log for "${userEmail}"? This action cannot be undone.`)) {
      return;
    }
    setActionInProgress(id);
    try {
      const res = await fetch(`${API_BASE_URL}/audit-logs/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      setLogs(prev => prev.filter(item => item.id !== id));
      showToast('Log record deleted permanently.');
    } catch (err) {
      console.error('Error permanently deleting log:', err);
      showToast('Failed to delete log record.', 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  const activeLogs = logs.filter(l => !l.isArchived);
  const archivedLogs = logs.filter(l => l.isArchived === true);

  const displayedList = (activeTab === 'Active' ? activeLogs : archivedLogs).filter(log => {
    const matchesSearch = 
      log.user?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.ipAddress?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.module?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.newData?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action?.toLowerCase().includes(searchQuery.toLowerCase());

    const isBlocked = log.action?.includes('BLOCK') || log.severity === 'CRITICAL';
    if (statusFilter === 'BLOCKED' && !isBlocked) return false;
    if (statusFilter === 'PASSED' && isBlocked) return false;

    return matchesSearch;
  });

  return (
    <main
      className={`
        min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans p-4 sm:p-8 transition-all duration-300
        ${isCollapsed ? "ml-20" : "ml-64"}
      `}
    >
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Toast alert */}
        {toastMessage && (
          <div className={`p-4 rounded-2xl flex items-center justify-between shadow-lg text-sm font-medium transition-all ${
            toastMessage.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700' 
              : 'bg-rose-50 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-200 dark:border-rose-700'
          }`}>
            <span>{toastMessage.text}</span>
            <button onClick={() => setToastMessage(null)} className="opacity-70 hover:opacity-100 ml-4 font-bold">✕</button>
          </div>
        )}

        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <svg className="w-7 h-7 text-indigo-600 dark:text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
              Fraud Monitoring & Archiver
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Live AI analysis of account creations and payments with historical archiver support.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex-wrap">
            <div className="flex flex-col items-center px-3 border-r border-slate-200 dark:border-slate-700">
              <span className="text-lg font-bold text-slate-900 dark:text-white">{activeLogs.length}</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Active Logs</span>
            </div>
            <div className="flex flex-col items-center px-3 border-r border-slate-200 dark:border-slate-700">
              <span className="text-lg font-bold text-rose-600 dark:text-rose-400">
                {activeLogs.filter(l => l.action.includes('BLOCK')).length}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Blocked</span>
            </div>
            <div className="flex flex-col items-center px-3">
              <span className="text-lg font-bold text-amber-600 dark:text-amber-400">{archivedLogs.length}</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Archived</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation & Controls */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">

            {/* Tabs */}
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl">
              <button
                type="button"
                onClick={() => setActiveTab('Active')}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'Active'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Active Monitoring
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 font-bold">
                  {activeLogs.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('Archived')}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'Archived'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>
                Archiver Tab
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/20 text-white font-bold">
                  {archivedLogs.length}
                </span>
              </button>
            </div>

            {/* Search & Filters */}
            <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
              <div className="relative flex-1 md:w-64">
                <input
                  type="text"
                  placeholder="Search user, IP, status..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="ALL">All Outcomes</option>
                <option value="BLOCKED">Blocked Only</option>
                <option value="PASSED">Passed Only</option>
              </select>

              <button
                type="button"
                onClick={fetchLogs}
                title="Refresh Records"
                className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 transition-colors"
              >
                <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-800 dark:text-slate-200">
              <thead className="bg-slate-100 dark:bg-slate-800 text-[11px] uppercase text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-4 text-slate-900 dark:text-white font-bold">Status</th>
                  <th className="p-4 text-slate-900 dark:text-white font-bold">Timestamp</th>
                  <th className="p-4 text-slate-900 dark:text-white font-bold">User / Email</th>
                  <th className="p-4 text-slate-900 dark:text-white font-bold">Module</th>
                  <th className="p-4 text-slate-900 dark:text-white font-bold">IP Address</th>
                  <th className="p-4 text-slate-900 dark:text-white font-bold">Risk Details</th>
                  <th className="p-4 text-slate-900 dark:text-white font-bold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                      <div className="flex justify-center items-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        <span className="ml-3 font-medium">Loading records...</span>
                      </div>
                    </td>
                  </tr>
                ) : displayedList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-slate-600 dark:text-slate-400 text-xs italic py-12 text-center bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                      {activeTab === 'Active' 
                        ? 'No active fraud log entries found.' 
                        : 'Archiver is empty. Archived records will appear here.'}
                    </td>
                  </tr>
                ) : (
                  displayedList.map((log) => {
                    const isBlocked = log.action.includes('BLOCK') || log.severity === 'CRITICAL';
                    const isWorking = actionInProgress === log.id;

                    return (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-4">
                          {isBlocked ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20">
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg>
                              Blocked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M9 12l2 2 4-4"></path></svg>
                              Passed
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">{log.timestamp}</td>
                        <td className="p-4 font-mono text-xs text-blue-600 dark:text-blue-400 font-semibold">{log.user}</td>
                        <td className="p-4 text-xs font-medium text-slate-600 dark:text-slate-300">{log.module}</td>
                        <td className="p-4 font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <span>{maskIp(log.ipAddress || '127.0.0.1', !!revealedIps[log.id])}</span>
                            <button
                              type="button"
                              onClick={() => toggleIpVisibility(log.id)}
                              className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors p-1 rounded-md cursor-pointer"
                              title={revealedIps[log.id] ? "Hide IP Address" : "Show IP Address"}
                            >
                              {revealedIps[log.id] ? (
                                <svg className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.043 10.043 0 013.122-.888c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21M3 3l18 18" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="p-4 text-xs text-slate-600 dark:text-slate-300">
                          {log.newData || log.action}
                        </td>
                        <td className="p-4 text-center">
                          {activeTab === 'Active' ? (
                            <button
                              type="button"
                              disabled={isWorking}
                              onClick={() => handleArchive(log.id, log.user)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-amber-100 hover:text-amber-800 dark:hover:bg-amber-900/30 dark:hover:text-amber-300 border border-slate-200 dark:border-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
                              title="Move to Archiver"
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>
                              Archive
                            </button>
                          ) : (
                            <div className="inline-flex items-center gap-2">
                              {/* Retrieve / Restore Button */}
                              <button
                                type="button"
                                disabled={isWorking}
                                onClick={() => handleRetrieve(log.id, log.user)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 transition-colors disabled:opacity-50 cursor-pointer"
                                title="Retrieve and restore to active monitoring"
                              >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>
                                Retrieve
                              </button>

                              {/* Permanent Delete Button */}
                              <button
                                type="button"
                                disabled={isWorking}
                                onClick={() => handleDeletePermanent(log.id, log.user)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 transition-colors disabled:opacity-50 cursor-pointer"
                                title="Delete record permanently"
                              >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
