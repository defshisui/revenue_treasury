import { useState, useEffect } from 'react';

interface FraudLog {
  id: string;
  timestamp: string;
  userEmail: string;
  module: string;
  action: string;
  severity: string;
  ipAddress: string;
  newData: string;
}

interface Props {
  isCollapsed: boolean;
}

export default function FraudMonitoringView(_props: Props) {
  const [logs, setLogs] = useState<FraudLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Simulated fetch of audit logs specifically related to fraud checks
  useEffect(() => {
    // In a real implementation, you would fetch from your backend API
    // e.g., /api/audit-logs?module=Fraud
    const fetchLogs = async () => {
      try {
        setLoading(true);
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 600));
        
        // Mock data since we don't have an endpoint for just fraud logs yet
        // and we want to show what this looks like right away.
        const mockLogs: FraudLog[] = [
          {
            id: '1',
            timestamp: new Date(Date.now() - 1000 * 60 * 5).toLocaleString(),
            userEmail: 'test-high-risk@example.com',
            module: 'User Management',
            action: 'ACCOUNT_CREATION_BLOCKED',
            severity: 'CRITICAL',
            ipAddress: '192.168.1.5',
            newData: 'Blocked by Anti-Fraud AI. Score: 85',
          },
          {
            id: '2',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toLocaleString(),
            userEmail: 'normal-user@example.com',
            module: 'User Management',
            action: 'USER_CREATED',
            severity: 'WARNING',
            ipAddress: '192.168.1.10',
            newData: 'Created user account. Risk Score: 12',
          },
          {
            id: '3',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toLocaleString(),
            userEmail: 'fraudster-pay@example.com',
            module: 'Payment',
            action: 'PAYMENT_BLOCKED',
            severity: 'CRITICAL',
            ipAddress: '10.0.0.45',
            newData: 'Payment blocked by Anti-Fraud AI. Score: 92',
          },
        ];
        setLogs(mockLogs);
      } catch (err) {
        console.error('Failed to fetch fraud logs:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchLogs();
  }, []);

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <svg className="w-7 h-7 text-indigo-600 dark:text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            Fraud Monitoring
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time AI analysis of account creations and payments.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
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

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 font-medium border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">User / Email</th>
                <th className="px-6 py-4">Module</th>
                <th className="px-6 py-4">IP Address</th>
                <th className="px-6 py-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
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
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    No fraud logs available.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isBlocked = log.action.includes('BLOCK');
                  return (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                      <td className="px-6 py-4">
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
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{log.timestamp}</td>
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{log.userEmail}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{log.module}</td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">{log.ipAddress}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
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
  );
}
