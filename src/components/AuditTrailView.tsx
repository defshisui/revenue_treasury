import React from "react";

export interface AuditRecord {
  id: string;
  auditId: string;
  user: string;
  role: string;
  module: string;
  action: string;
  previousData?: string;
  newData?: string;
  timestamp: string;
}

export default function AuditTrailView({ 
  records, 
  isCollapsed = false 
}: { 
  records: AuditRecord[]; 
  isCollapsed?: boolean 
}) { 
  return (
    <div 
      className={`
        min-h-screen
        bg-slate-50 dark:bg-slate-900
        text-slate-800 dark:text-slate-100
        font-sans p-4 sm:p-8 
        transition-all duration-300
        ${isCollapsed ? "ml-20" : "ml-64"}
      `}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm dark:shadow-2xl gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">System Audit Trail</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Immutable record of system activities, data changes, and user roles</p>
          </div>
          <span className="text-xs bg-slate-100 dark:bg-slate-800 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold shadow-inner">
            Audit Logging Enabled
          </span>
        </div>

        {/* Content Section */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm dark:shadow-xl space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider">Audit Activity Logs</h3>
          
          {records.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 text-xs italic py-8 text-center">
              No audit logs available. Enable audit logging and connect your data sources.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-100 dark:bg-blue-950 text-xs uppercase text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4 text-slate-900 dark:text-white">Audit ID</th>
                    <th className="p-4 text-slate-900 dark:text-white">User & Role</th>
                    <th className="p-4 text-slate-900 dark:text-white">Module</th>
                    <th className="p-4 text-slate-900 dark:text-white">Action</th>
                    <th className="p-4 text-slate-900 dark:text-white">Data State Change</th>
                    <th className="p-4 text-slate-900 dark:text-white">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {records.map(record => (
                    <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-blue-900/20 transition-colors">
                      <td className="p-4 font-mono font-bold text-slate-900 dark:text-white">{record.auditId}</td>
                      <td className="p-4 font-semibold text-slate-900 dark:text-white">{record.user}<br />
                        <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{record.role}</span>
                      </td>
                      <td className="p-4 text-xs text-slate-600 dark:text-slate-300">{record.module}</td>
                      <td className="p-4">
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-500/20">
                          {record.action}
                        </span>
                      </td>
                      <td className="p-4 text-xs font-mono text-slate-500 dark:text-slate-400">
                        {record.previousData} {record.newData}
                      </td>
                      <td className="p-4 text-xs font-mono text-slate-500 dark:text-slate-400">{record.timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}