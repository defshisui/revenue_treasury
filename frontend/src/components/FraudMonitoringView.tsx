import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config/api';

interface FraudLog {
  id: string;
  auditId: string;
  timestamp: string;
  user: string;
  module: string;
  action: string;
  severity: string;
  ipAddress: string;
  newData: string;
}

interface Props {
  isCollapsed: boolean;
}

export default function FraudMonitoringView({ isCollapsed }: Props) {
  const [logs, setLogs] = useState<FraudLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/audit-logs`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        
        // Filter for logs that contain 'Anti-Fraud' in newData, or specific actions
        const fraudRelated = data.filter((log: FraudLog) => 
          log.newData?.includes('Anti-Fraud') || 
          log.action === 'ACCOUNT_CREATION_BLOCKED' ||
          log.action === 'PAYMENT_BLOCKED' ||
          log.newData?.includes('Risk Score')
        );
        
        setLogs(fraudRelated);
      } catch (err) {
        console.error('Failed to fetch fraud logs:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchLogs();
  }, []);

  return (
    <main
      className={`
        min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans p-4 sm:p-8 transition-all duration-300
        ${isCollapsed ? "ml-20" : "ml-64"}
      `}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <svg className="w-7 h-7 text-indigo-600 dark:text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
              Fraud Monitoring
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Real-time AI analysis of account creations and payments.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex flex-col items-center px-4 border-r border-slate-200 dark:border-slate-700">
              <span className="text-xl font-bold text-slate-900 dark:text-white">{logs.length}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Checks</span>
            </div>
            <div className="flex flex-col items-center px-4">
              <span className="text-xl font-bold text-rose-600 dark:text-rose-400">
                {logs.filter(l => l.action.includes('BLOCK')).length}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Blocked</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-800 dark:text-slate-200">
              <thead className="bg-slate-100 dark:bg-slate-800 text-xs uppercase text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-4 text-slate-900 dark:text-white font-bold">Status</th>
                  <th className="p-4 text-slate-900 dark:text-white font-bold">Timestamp</th>
                  <th className="p-4 text-slate-900 dark:text-white font-bold">User / Email</th>
                  <th className="p-4 text-slate-900 dark:text-white font-bold">Module</th>
                  <th className="p-4 text-slate-900 dark:text-white font-bold">IP Address</th>
                  <th className="p-4 text-slate-900 dark:text-white font-bold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                      <div className="flex justify-center items-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        <span className="ml-3">Loading fraud logs...</span>
                      </div>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-slate-600 dark:text-slate-400 text-xs italic py-12 text-center bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                      No fraud logs available.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const isBlocked = log.action.includes('BLOCK');
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
                        <td className="p-4 text-xs font-medium text-slate-500 dark:text-slate-400">{log.timestamp}</td>
                        <td className="p-4 font-mono text-xs text-blue-600 dark:text-blue-400 font-semibold">{log.user}</td>
                        <td className="p-4 text-xs font-medium text-slate-600 dark:text-slate-300">{log.module}</td>
                        <td className="p-4 font-mono text-xs text-slate-500 dark:text-slate-400">{log.ipAddress}</td>
                        <td className="p-4 text-xs text-slate-600 dark:text-slate-300">
                          {log.newData}
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
