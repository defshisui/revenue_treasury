import type { UserRecord } from "../types/treasury";

export default function UsersView({ records, isCollapsed = false }: { records: UserRecord[]; isCollapsed?: boolean }) { 
  return (
    <div 
      className={`
        min-h-screen
        bg-slate-50 dark:bg-slate-900
        text-slate-800 dark:text-slate-100
        p-4 sm:p-20 pt-24
        transition-all duration-300
        ${isCollapsed ? "ml-20" : "ml-64"}
      `}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">User Management & Security Access</h2>
          <span className="text-xs bg-slate-800 dark:bg-slate-800 px-3 py-1.5 rounded border border-slate-700 text-slate-300">Access control configured</span>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-none">
          <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-white">Authorized Treasury Personnel</h3>
          {records.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 text-sm italic">No user accounts configured. Sync your access control directory to populate user data.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="p-3">Full Name</th>
                  <th className="p-3">Username</th>
                  <th className="p-3">Assigned Role</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                {records.map(record => (
                  <tr key={record.id}>
                    <td className="p-3 text-slate-900 dark:text-slate-100">{record.fullname}</td>
                    <td className="p-3 font-mono text-amber-600 dark:text-amber-400">{record.username}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">{record.role}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">{record.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}