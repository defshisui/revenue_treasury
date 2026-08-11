import type { RPTRecord } from "../types/treasury";

interface Metrics { 
  today: number; 
  delinquentCount: number; 
}

export default function ReportsView({ 
  metrics, 
  transactionCount, 
  rptRecords, 
  onExport, 
  isCollapsed = false 
}: { 
  metrics: Metrics; 
  transactionCount: number; 
  rptRecords: RPTRecord[]; 
  onExport: () => void; 
  isCollapsed?: boolean 
}) { 
  return (
    <div 
      className={`
        min-h-screen
        bg-slate-50 dark:bg-slate-950
        text-slate-800 dark:text-slate-100
        p-4 sm:p-16
        transition-all duration-300
        ${isCollapsed ? "ml-20" : "ml-64"}
      `}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Financial & Treasury Report Generators</h2>
          <button 
            onClick={onExport} 
            className="bg-amber-500 hover:bg-amber-600 font-bold px-4 py-2 rounded-lg text-sm text-white shadow-sm transition-colors"
          >
            Export Statement Summary
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Daily Collection Report Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-xl">
            <h3 className="text-lg font-bold mb-2 text-slate-900 dark:text-white">Daily Collection Report</h3>
            <p className="text-xs mb-4 text-slate-500 dark:text-slate-400">Summary of all validated collections for the current active period.</p>
            
            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-sm">
              <div className="flex justify-between text-slate-700 dark:text-slate-300">
                <span>Total Transactions:</span>
                <span className="font-bold text-slate-900 dark:text-white">{transactionCount}</span>
              </div>
              <div className="flex justify-between text-slate-700 dark:text-slate-300">
                <span>Total Collected Revenue:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{metrics.today.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* RPT Delinquency Statement Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-xl">
            <h3 className="text-lg font-bold mb-2 text-slate-900 dark:text-white">RPT Delinquency Statement</h3>
            <p className="text-xs mb-4 text-slate-500 dark:text-slate-400">Properties flagged with unpaid assessments or overdue balances.</p>
            
            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-sm">
              <div className="flex justify-between text-slate-700 dark:text-slate-300">
                <span>Total Delinquent Properties:</span>
                <span className="font-bold text-slate-900 dark:text-white">{metrics.delinquentCount}</span>
              </div>
              <div className="flex justify-between text-slate-700 dark:text-slate-300">
                <span>Pending Collection Balance:</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">
                  {rptRecords.reduce((sum, record) => sum + record.balance, 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}