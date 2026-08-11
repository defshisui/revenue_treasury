import { useState } from "react";
import type { TransactionRecord } from "../types/treasury";

export interface TreasuryMetrics {
  today: number;
  monthly: number;
  annual: number;
  collectionTarget: number;
  rptCollection: number;
  businessCollection: number;
  marketCollection: number;
  permitsCollection: number;
  delinquentCount: number;
  pendingPaymentsCount: number;
  activePermitsCount: number;
  activeStallsCount: number;
  activeBusinessesCount: number;
}

export interface TreasuryDashboardViewProps {
  metrics: TreasuryMetrics;
  transactions: TransactionRecord[];
  isCollapsed: boolean;
}

export default function TreasuryDashboardView({ metrics, transactions, isCollapsed }: TreasuryDashboardViewProps) {
  const [fiscalPeriod, setFiscalPeriod] = useState("FY 2026");

  const m = metrics || ({} as TreasuryMetrics);
  const txs = transactions || [];

  const today = m.today || 0;
  const monthly = m.monthly || 0;
  const annual = m.annual || 0;
  const collectionTarget = m.collectionTarget || 0;
  const rptCollection = m.rptCollection || 0;
  const businessCollection = m.businessCollection || 0;
  const marketCollection = m.marketCollection || 0;
  const permitsCollection = m.permitsCollection || 0;
  const delinquentCount = m.delinquentCount || 0;
  const pendingPaymentsCount = m.pendingPaymentsCount || 0;
  const activePermitsCount = m.activePermitsCount || 0;
  const activeStallsCount = m.activeStallsCount || 0;
  const activeBusinessesCount = m.activeBusinessesCount || 0;

  const totalRevenueBreakdown = rptCollection + businessCollection + marketCollection + permitsCollection;
  const rptPercent = totalRevenueBreakdown > 0 ? (rptCollection / totalRevenueBreakdown) * 100 : 0;
  const businessPercent = totalRevenueBreakdown > 0 ? (businessCollection / totalRevenueBreakdown) * 100 : 0;
  const marketPercent = totalRevenueBreakdown > 0 ? (marketCollection / totalRevenueBreakdown) * 100 : 0;
  const permitsPercent = totalRevenueBreakdown > 0 ? (permitsCollection / totalRevenueBreakdown) * 100 : 0;

  return (
    <div 
      className={`
        min-h-screen
        bg-slate-50 dark:bg-slate-900
        text-slate-800 dark:text-slate-100
        p-6 pt-24
        transition-all duration-300
        ${isCollapsed ? "ml-20" : "ml-64"}
      `}
    >
      {/* Header & Fiscal Period Selector */}
      <div className="flex justify-between items-start bg-white dark:bg-slate-800 p-6 rounded-xl mb-5 flex-wrap gap-4 shadow-sm border border-slate-200 dark:border-slate-700">
        <div>
          <h2 className="text-xl font-bold mb-1 text-slate-900 dark:text-white">
            Treasury Overview & Revenue Metrics
          </h2>
          <p className="text-[13px] m-0 text-slate-500 dark:text-slate-400">
            Real-time local government collection monitoring & financial statistics
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="fiscalPeriodSelect" className="text-[13px] font-medium text-slate-700 dark:text-slate-300">
              Fiscal Period:
            </label>
            <select
              id="fiscalPeriodSelect"
              value={fiscalPeriod}
              onChange={(e) => setFiscalPeriod(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-[13px] font-medium text-slate-700 dark:text-slate-200 cursor-pointer outline-none focus:border-blue-500"
            >
              <option value="FY 2026">FY 2026 (Current)</option>
              <option value="FY 2025">FY 2025 (Previous)</option>
              <option value="Q1 2026">Q1 2026</option>
              <option value="Q2 2026">Q2 2026</option>
            </select>
          </div>
        </div>
      </div>

      {/* TOP METRICS GRID */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4 mb-5">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm overflow-hidden">
          <p className="text-xs font-medium mb-1.5 mt-0 text-slate-500 dark:text-slate-400">Today's Collection</p>
          <p className="text-xl font-bold mb-1 mt-0 truncate text-slate-900 dark:text-white">₱{today.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p>
          <p className="text-xs m-0 text-slate-500 dark:text-slate-400">Recorded daily inflows</p>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm overflow-hidden">
          <p className="text-xs font-medium mb-1.5 mt-0 text-slate-500 dark:text-slate-400">Monthly Collection</p>
          <p className="text-xl font-bold mb-1 mt-0 truncate text-slate-900 dark:text-white">₱{monthly.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p>
          <p className="text-xs m-0 text-slate-500 dark:text-slate-400">Current month accumulated</p>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm overflow-hidden">
          <p className="text-xs font-medium mb-1.5 mt-0 text-slate-500 dark:text-slate-400">Annual Revenue</p>
          <p className="text-xl font-bold mb-1 mt-0 truncate text-slate-900 dark:text-white">₱{annual.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p>
          <p className="text-xs m-0 text-slate-500 dark:text-slate-400">Year-to-date accumulated</p>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm overflow-hidden">
          <p className="text-xs font-medium mb-1.5 mt-0 text-slate-500 dark:text-slate-400">Collection Target</p>
          <p className="text-xl font-bold mb-1 mt-0 truncate text-slate-900 dark:text-white">₱{collectionTarget.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p>
          <p className="text-xs m-0 text-slate-500 dark:text-slate-400">Annual fiscal goal benchmark</p>
        </div>
      </div>

      {/* QUICK STATISTICS */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-4 mb-5">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-center shadow-sm">
          <p className="text-xs font-medium mb-1.5 mt-0 whitespace-nowrap overflow-hidden text-ellipsis text-slate-500 dark:text-slate-400">Today's Transactions</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white m-0">{txs.length.toLocaleString()}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-center shadow-sm">
          <p className="text-xs font-medium mb-1.5 mt-0 whitespace-nowrap overflow-hidden text-ellipsis text-slate-500 dark:text-slate-400">Pending Payments</p>
          <p className="text-xl font-bold text-amber-600 dark:text-amber-400 m-0">{pendingPaymentsCount.toLocaleString()}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-center shadow-sm">
          <p className="text-xs font-medium mb-1.5 mt-0 whitespace-nowrap overflow-hidden text-ellipsis text-slate-500 dark:text-slate-400">Delinquent Taxpayers</p>
          <p className="text-xl font-bold text-rose-600 dark:text-rose-400 m-0">{delinquentCount.toLocaleString()}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-center shadow-sm">
          <p className="text-xs font-medium mb-1.5 mt-0 whitespace-nowrap overflow-hidden text-ellipsis text-slate-500 dark:text-slate-400">Active Permits</p>
          <p className="text-xl font-bold text-teal-600 dark:text-teal-400 m-0">{activePermitsCount.toLocaleString()}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-center shadow-sm">
          <p className="text-xs font-medium mb-1.5 mt-0 whitespace-nowrap overflow-hidden text-ellipsis text-slate-500 dark:text-slate-400">Active Stalls</p>
          <p className="text-xl font-bold text-blue-600 dark:text-blue-400 m-0">{activeStallsCount.toLocaleString()}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-center shadow-sm">
          <p className="text-xs font-medium mb-1.5 mt-0 whitespace-nowrap overflow-hidden text-ellipsis text-slate-500 dark:text-slate-400">Active Businesses</p>
          <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400 m-0">{activeBusinessesCount.toLocaleString()}</p>
        </div>
      </div>

      {/* REVENUE TREND & DAILY COLLECTION */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 mb-5 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-[15px] font-bold text-slate-900 dark:text-white mb-0.5 mt-0">Daily Collection Trend</h3>
            <p className="text-xs m-0 text-slate-500 dark:text-slate-400">Graphical tracking of daily revenue inflows</p>
          </div>
          <span className="text-[11px] font-semibold py-1 px-2 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
            Live Feed
          </span>
        </div>

        <div className="h-45 w-full bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 flex items-end justify-between p-4 gap-1 overflow-hidden">
          {txs.length > 0 ? (
            txs.slice(0, 30).map((tx, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end max-w-18.75">
                <div 
                  style={{ height: `${Math.min(Math.max((tx.amount / (collectionTarget || 100000)) * 100, 10), 100)}%` }}
                  className="w-full bg-blue-600 dark:bg-blue-500 rounded-t-[3px]" 
                />
              </div>
            ))
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[13px] text-slate-400 dark:text-slate-500 italic">
              No daily collection data available to chart.
            </div>
          )}
        </div>
      </div>

      {/* REVENUE SOURCES & DISTRIBUTION */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-5 mb-5">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
          <h3 className="text-[15px] font-bold text-slate-900 dark:text-white mb-0.5 mt-0">Revenue Sources Breakdown</h3>
          <p className="text-xs mb-4 mt-0 text-slate-500 dark:text-slate-400">Collections categorized by statutory municipal revenue stream</p>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
            <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
              <div className="flex justify-between items-start mb-1.5">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 m-0">Business Tax</p>
                <span className="text-[11px] font-semibold py-0.5 px-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-teal-700 dark:text-teal-400">
                  {businessPercent.toFixed(1)}%
                </span>
              </div>
              <div className="mb-2.5">
                <p className="text-sm font-bold text-teal-700 dark:text-teal-400 m-0 truncate">
                  ₱{businessCollection.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div style={{ width: `${businessPercent}%` }} className="h-full bg-teal-600 dark:bg-teal-500 rounded-full" />
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
              <div className="flex justify-between items-start mb-1.5">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 m-0">Real Property Tax (RPT)</p>
                <span className="text-[11px] font-semibold py-0.5 px-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-blue-700 dark:text-blue-400">
                  {rptPercent.toFixed(1)}%
                </span>
              </div>
              <div className="mb-2.5">
                <p className="text-sm font-bold text-blue-700 dark:text-blue-400 m-0 truncate">
                  ₱{rptCollection.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div style={{ width: `${rptPercent}%` }} className="h-full bg-blue-600 dark:bg-blue-500 rounded-full" />
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
              <div className="flex justify-between items-start mb-1.5">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 m-0">Market Rentals</p>
                <span className="text-[11px] font-semibold py-0.5 px-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-emerald-700 dark:text-emerald-400">
                  {marketPercent.toFixed(1)}%
                </span>
              </div>
              <div className="mb-2.5">
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 m-0 truncate">
                  ₱{marketCollection.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div style={{ width: `${marketPercent}%` }} className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full" />
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
              <div className="flex justify-between items-start mb-1.5">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 m-0">Permits & Licenses</p>
                <span className="text-[11px] font-semibold py-0.5 px-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-indigo-700 dark:text-indigo-400">
                  {permitsPercent.toFixed(1)}%
                </span>
              </div>
              <div className="mb-2.5">
                <p className="text-sm font-bold text-indigo-700 dark:text-indigo-400 m-0 truncate">
                  ₱{permitsCollection.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div style={{ width: `${permitsPercent}%` }} className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 flex flex-col justify-between shadow-sm">
          <div>
            <h3 className="text-[15px] font-bold text-slate-900 dark:text-white mb-0.5 mt-0">Revenue Distribution</h3>
            <p className="text-xs m-0 text-slate-500 dark:text-slate-400">Proportional share per department</p>
          </div>

          <div className="my-4">
            <div className="h-3 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden flex">
              <div style={{ width: `${businessPercent}%` }} className="bg-teal-600 dark:bg-teal-500 h-full" />
              <div style={{ width: `${rptPercent}%` }} className="bg-blue-600 dark:bg-blue-500 h-full" />
              <div style={{ width: `${marketPercent}%` }} className="bg-emerald-600 dark:bg-emerald-500 h-full" />
              <div style={{ width: `${permitsPercent}%` }} className="bg-indigo-600 dark:bg-indigo-500 h-full" />
            </div>

            <div className="grid grid-cols-2 gap-2.5 mt-4 text-xs text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-teal-600 dark:bg-teal-500 inline-block" />Business ({businessPercent.toFixed(1)}%)</div>
              <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-500 inline-block" />RPT ({rptPercent.toFixed(1)}%)</div>
              <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-500 inline-block" />Market ({marketPercent.toFixed(1)}%)</div>
              <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-500 inline-block" />Permits ({permitsPercent.toFixed(1)}%)</div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 dark:text-slate-500 text-center border-t border-slate-100 dark:border-slate-700 pt-3">
            Updated in real-time with electronic ledger feed
          </div>
        </div>
      </div>

      {/* RECENT TRANSACTIONS TABLE */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white m-0">Recent Transactions</h3>
          <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold cursor-pointer hover:underline">
            View All Feed →
          </span>
        </div>

        {txs.length === 0 ? (
          <p className="text-slate-400 dark:text-slate-500 text-[13px] italic text-center p-8 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg m-0">
            No payment transactions found. Load your transaction feed to display entries.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full text-left text-[13px] border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Payer Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Collector</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {txs.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                    <td className="py-3 px-4 font-mono font-semibold text-blue-600 dark:text-blue-400">{transaction.referenceNumber}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{transaction.taxpayer}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{transaction.paymentType}</td>
                    <td className="py-3 px-4 text-right font-semibold text-emerald-700 dark:text-emerald-400">
                      ₱{transaction.amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{transaction.paymentMethod}</td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">{transaction.collector}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="py-0.5 px-2 rounded-md text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        {transaction.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}