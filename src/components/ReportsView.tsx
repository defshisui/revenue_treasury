// src/components/ReportsView.tsx
import { useState, useEffect } from "react";
import type { RPTRecord } from "../types/treasury";
import { getLeases } from "../services/marketService";
import { getHawkerApplications } from "../services/hawkerservice";

export default function ReportsView({ isCollapsed = false }: { isCollapsed?: boolean }) {
  const [reportPeriod, setReportPeriod] = useState("FY 2026");
  const [previewModalType, setPreviewModalType] = useState<"daily" | "delinquent" | "market" | "hawkers" | null>(null);

  // Database state
  const [rptRecords, setRptRecords] = useState<RPTRecord[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [marketLeases, setMarketLeases] = useState<any[]>([]);
  const [hawkerApps, setHawkerApps] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch & mapping logic with zero dummy data fallbacks
  const fetchDatabaseData = async () => {
    try {
      setLoading(true);
      
      const [leases, hawkers] = await Promise.all([
        getLeases(),
        getHawkerApplications()
      ]);

      const activeLeases = leases || [];
      setMarketLeases(activeLeases);
      setHawkerApps(hawkers || []);

      // Transformation: Only grab genuine stored numeric data fields from the database records (including amountDue)
      const derivedTransactions = activeLeases.map((lease: any, idx: number) => {
        const amountValue = Number(
          lease.amountDue ?? 
          lease.amountPaid ?? 
          lease.monthlyRent ?? 
          lease.rate ?? 
          lease.fee ?? 
          lease.amount ?? 
          0
        );

        return {
          id: lease.leaseId || lease.id || `TX-MARKET-${idx + 1}`,
          transactionType: `Market Stall Collection (${lease.marketName || 'Public Market'} - Stall ${lease.stallNumber || idx + 1})`,
          amount: amountValue,
          date: lease.createdAt || lease.date || new Date().toISOString()
        };
      });

      setTransactions(derivedTransactions);

    } catch (error) {
      console.error("Failed to fetch reports from database:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatabaseData();
  }, [reportPeriod]);

  const matchesFiscalPeriod = (dateStr?: string) => {
    if (!dateStr) return true;
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) return true;
    const year = dateObj.getFullYear().toString();
    if (reportPeriod === "FY 2026") return year === "2026" || year === "2025" || year === "2024" || year === "2023";
    if (reportPeriod === "FY 2025") return year === "2025" || year === "2024";
    return true;
  };

  const filteredTransactions = transactions.filter((tx: any) => 
    matchesFiscalPeriod(tx.date || tx.createdAt || tx.timestamp || tx.transactionDate)
  );

  const filteredRptRecords = rptRecords.filter((rec: any) => matchesFiscalPeriod(rec.date || rec.createdAt || rec.timestamp));
  const filteredMarketLeases = marketLeases.filter((lease: any) => matchesFiscalPeriod(lease.createdAt || lease.date || lease.timestamp));
  const filteredHawkerApps = hawkerApps.filter((app: any) => matchesFiscalPeriod(app.createdAt || app.date || app.timestamp));

  const totalCollectedRevenue = filteredTransactions.reduce((sum, tx: any) => sum + (Number(tx.amount) || 0), 0);

  const delinquentRecords = filteredRptRecords.filter(
    (record: any) => record.delinquentStatus || (record.balance && record.balance > 0)
  );
  const totalDelinquentBalance = delinquentRecords.reduce((sum: number, record: any) => sum + (record.balance || 0), 0);
  const delinquentLeases = filteredMarketLeases.filter((lease: any) => (lease.amountDue ?? 0) > 0);

  const handleExportCSV = () => {
    const headers = ["Record Type", "Identifier", "Name / Entity", "Location / Barangay", "Balance Due / Status"];
    
    const rptRows = delinquentRecords.map((rec: any) => [
      "RPT Delinquent",
      rec.propertyIndexNumber || rec.propertyId || rec.id,
      `"${rec.ownerName || "Unknown"}"`,
      `"${rec.barangay || "N/A"}"`,
      `₱${rec.balance || 0}`
    ]);

    const marketRows = delinquentLeases.map((lease: any) => [
      "Market Stall Lease",
      lease.leaseId,
      `"${lease.firstName} ${lease.lastName}"`,
      `"${lease.marketName} - Section ${lease.section} (${lease.stallNumber})"`,
      `₱${lease.amountDue}`
    ]);

    const rows = [...rptRows, ...marketRows];
    const csvContent = "data:text/csv;charset=utf-8," + 
      [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Municipal_Delinquency_Audit_${reportPeriod}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportSummary = () => {
    const reportText = `
=== MUNICIPAL TREASURY & REVENUE STATEMENT SUMMARY ===
Fiscal Period: ${reportPeriod}
Generated On: ${new Date().toLocaleDateString()}

[1] DAILY COLLECTION REPORT
- Total Transactions Logged: ${filteredTransactions.length}
- Total Collected Revenue: ₱${totalCollectedRevenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}

[2] RPT DELINQUENCY STATEMENT
- Total Delinquent Properties: ${delinquentRecords.length}
- Pending Collection Balance: ₱${totalDelinquentBalance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}

[3] MARKET STALL LEASES & HAWKERS
- Total Active Market Leases: ${filteredMarketLeases.length}
- Market Leases with Balance Due: ${delinquentLeases.length}
- Registered Hawker Associations: ${filteredHawkerApps.length}
    `.trim();

    const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Treasury_Statement_Summary_${reportPeriod}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div 
      className={`
        min-h-screen
        bg-slate-50 dark:bg-slate-950
        text-slate-800 dark:text-slate-100
        p-4 sm:p-12 pt-20
        transition-all duration-300
        ${isCollapsed ? "ml-20" : "ml-64"}
      `}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header & Global Report Options */}
        <div className="flex flex-wrap justify-between items-center bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white m-0 mb-1">
              Financial & Treasury Report Generators
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 m-0">
              Generate, preview, and export official municipal statements and ledgers ({reportPeriod})
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Fiscal Period Selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="reportPeriod" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Period:
              </label>
              <select
                id="reportPeriod"
                value={reportPeriod}
                onChange={(e) => setReportPeriod(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer outline-none focus:border-blue-500"
              >
                <option value="FY 2026">FY 2026</option>
                <option value="FY 2025">FY 2025</option>
                <option value="Q1 2026">Q1 2026</option>
                <option value="Q2 2026">Q2 2026</option>
              </select>
            </div>

            {/* Export & Utility Actions */}
            <div className="flex items-center gap-2">
              <button 
                onClick={handleExportCSV}
                className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold px-3 py-2 rounded-xl text-xs text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              >
                Export CSV Audit
              </button>
              <button 
                onClick={fetchDatabaseData}
                disabled={loading}
                className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400 font-semibold px-3 py-2 rounded-xl text-xs border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                {loading ? "Syncing DB..." : "Refresh DB"}
              </button>
              <button 
                onClick={handleExportSummary} 
                className="bg-amber-500 hover:bg-amber-600 font-bold px-4 py-2 rounded-xl text-xs text-white shadow-xs transition-colors cursor-pointer"
              >
                Export Summary
              </button>
            </div>
          </div>
        </div>

        {/* Reports Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Daily Collection Report Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white m-0">Daily Collection Report</h3>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  Synced with Market DB
                </span>
              </div>
              <p className="text-xs mb-4 text-slate-500 dark:text-slate-400">Real-time revenue summary synced with active market lease registry.</p>
              
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                  <span>Total Transactions Logged:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{filteredTransactions.length}</span>
                </div>
                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                  <span>Total Collected Revenue:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">₱{totalCollectedRevenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex justify-between items-center">
              <span className="text-[11px] text-slate-400">{loading ? "Fetching data..." : "Database synchronized"}</span>
              <button
                onClick={() => setPreviewModalType("daily")}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline bg-transparent border-none cursor-pointer p-0"
              >
                Preview Line Items →
              </button>
            </div>
          </div>

          {/* RPT Delinquency Statement Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white m-0">RPT Delinquency Statement</h3>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                  Needs Attention
                </span>
              </div>
              <p className="text-xs mb-4 text-slate-500 dark:text-slate-400">Properties flagged with unpaid assessments or overdue balances.</p>
              
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                  <span>Total Delinquent Properties:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{delinquentRecords.length}</span>
                </div>
                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                  <span>Pending Collection Balance:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    ₱{totalDelinquentBalance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex justify-between items-center">
              <span className="text-[11px] text-slate-400">Action required</span>
              <button
                onClick={() => setPreviewModalType("delinquent")}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline bg-transparent border-none cursor-pointer p-0"
              >
                Preview Delinquent List →
              </button>
            </div>
          </div>

        </div>

        {/* Secondary Module Summaries */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Market Stalls Summary Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white m-0">Market Stall Leases</h3>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                  Active Registry
                </span>
              </div>
              <p className="text-xs mb-4 text-slate-500 dark:text-slate-400">Overview of public market stall leases fetched directly from database.</p>
              
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                  <span>Total Registered Leases:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{filteredMarketLeases.length}</span>
                </div>
                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                  <span>Leases with Balances Due:</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    {filteredMarketLeases.filter((l: any) => (l.amountDue ?? 0) > 0).length}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex justify-between items-center">
              <span className="text-[11px] text-slate-400">Market records synced</span>
              <button
                onClick={() => setPreviewModalType("market")}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline bg-transparent border-none cursor-pointer p-0"
              >
                Preview Stall Leases →
              </button>
            </div>
          </div>

          {/* Hawker Associations Summary Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white m-0">Hawker Associations</h3>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
                  Permit Records
                </span>
              </div>
              <p className="text-xs mb-4 text-slate-500 dark:text-slate-400">Verified hawker association permits and filings.</p>
              
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                  <span>Total Registered Associations:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{filteredHawkerApps.length}</span>
                </div>
                <div className="flex justify-between text-slate-700 dark:text-slate-300">
                  <span>Active Filings:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {filteredHawkerApps.filter((h: any) => h.status).length}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex justify-between items-center">
              <span className="text-[11px] text-slate-400">Compliance verified</span>
              <button
                onClick={() => setPreviewModalType("hawkers")}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline bg-transparent border-none cursor-pointer p-0"
              >
                Preview Hawkers →
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* PREVIEW MODAL */}
      {previewModalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white m-0">
                  {previewModalType === "daily" && "Daily Collection Preview"}
                  {previewModalType === "delinquent" && "Delinquent Properties Ledger"}
                  {previewModalType === "market" && "Market Stalls Lease Registry"}
                  {previewModalType === "hawkers" && "Hawker Association Records"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mt-1">
                  {previewModalType === "daily" && `Showing collection records derived from active market storage (${filteredTransactions.length})`}
                  {previewModalType === "delinquent" && `Total Flagged Entries: ${delinquentRecords.length}`}
                  {previewModalType === "market" && `Total Active Leases: ${filteredMarketLeases.length}`}
                  {previewModalType === "hawkers" && `Total Registered Associations: ${filteredHawkerApps.length}`}
                </p>
              </div>
              <button 
                onClick={() => setPreviewModalType(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center font-bold border-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 text-xs">
              {previewModalType === "delinquent" && (
                delinquentRecords.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">No delinquent RPT records found.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-3 px-4">Property Index / ID</th>
                          <th className="py-3 px-4">Owner Name</th>
                          <th className="py-3 px-4">Barangay</th>
                          <th className="py-3 px-4 text-right">Balance Due</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {delinquentRecords.map((rec: any, i: number) => (
                          <tr key={rec.id || i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                            <td className="py-3 px-4 font-mono font-semibold text-blue-600 dark:text-blue-400">
                              {rec.propertyIndexNumber || rec.propertyId || rec.id}
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{rec.ownerName}</td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{rec.barangay || "N/A"}</td>
                            <td className="py-3 px-4 text-right font-semibold text-rose-600 dark:text-rose-400">
                              ₱{(rec.balance || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {previewModalType === "market" && (
                filteredMarketLeases.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">No market lease records found.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-3 px-4">Lease ID</th>
                          <th className="py-3 px-4">Lessee Name</th>
                          <th className="py-3 px-4">Market / Section</th>
                          <th className="py-3 px-4 text-right">Amount Due</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {filteredMarketLeases.map((lease: any, i: number) => (
                          <tr key={lease.leaseId || i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                            <td className="py-3 px-4 font-mono font-semibold text-blue-600 dark:text-blue-400">{lease.leaseId}</td>
                            <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{lease.firstName} {lease.lastName}</td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{lease.marketName} - Sec {lease.section} ({lease.stallNumber})</td>
                            <td className="py-3 px-4 text-right font-semibold text-amber-600 dark:text-amber-400">
                              ₱{(lease.amountDue || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {previewModalType === "hawkers" && (
                filteredHawkerApps.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">No hawker applications found.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-3 px-4">Association #</th>
                          <th className="py-3 px-4">Association Name</th>
                          <th className="py-3 px-4">Chairperson</th>
                          <th className="py-3 px-4 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {filteredHawkerApps.map((app: any, i: number) => (
                          <tr key={app.id || i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                            <td className="py-3 px-4 font-mono font-semibold text-purple-600 dark:text-purple-400">{app.associationNumber}</td>
                            <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{app.associationName}</td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{app.chairperson?.firstName} {app.chairperson?.lastName}</td>
                            <td className="py-3 px-4 text-right font-semibold text-emerald-600 dark:text-emerald-400">{app.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {previewModalType === "daily" && (
                filteredTransactions.length === 0 ? (
                  <div className="text-center py-8 space-y-3">
                    <p className="text-slate-400">No collection records found.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-xs text-slate-500 pb-2 border-b border-slate-200 dark:border-slate-800">
                      <span>Total Count: {filteredTransactions.length} items</span>
                      <span>Total Collected Revenue: ₱{totalCollectedRevenue.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="py-3 px-4">Reference ID</th>
                            <th className="py-3 px-4">Description</th>
                            <th className="py-3 px-4 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {filteredTransactions.map((tx: any, i: number) => (
                            <tr key={tx.id || i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                              <td className="py-3 px-4 font-mono font-semibold text-blue-600 dark:text-blue-400">
                                {tx.id}
                              </td>
                              <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                                {tx.transactionType}
                              </td>
                              <td className="py-3 px-4 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                                ₱{(tx.amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              )}
            </div>

            <div className="flex justify-between items-center p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <span className="text-[11px] text-slate-400">Certified Municipal Record</span>
              <button 
                onClick={() => setPreviewModalType(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs cursor-pointer border-none hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
              >
                Close Preview
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}