import { useState, useEffect } from "react";
import type { TransactionRecord } from "../types/treasury";
import { API_BASE_URL } from "../config/api";

export interface StallRecord {
  id?: string | number;
  stallNumber?: string;
  lesseeName?: string;
  vendorName?: string;
  section?: string;
  monthlyRent?: number;
  amount?: number;
  status?: string;
}

export interface BusinessAssessmentRecord {
  trackingNumber?: string;
  businessName?: string;
  businessOwner?: string;
  grossSales?: number | string;
  status?: string;
  applicationDate?: string;
  dateFiled?: string;
}

export interface RPTAssessmentRecord {
  id?: string;
  referenceNumber?: string;
  controlNumber?: string;
  applicantName?: string;
  ownerName?: string;
  service?: string;
  category?: string;
  status?: string;
  propertyDetails?: {
    pin?: string;
  };
  pin?: string;
}

export interface TreasuryMetrics {
  totalEpayments: number;
  totalEORs: number;
  totalAmount: number;
  billerSystems: number;
  paymentOptions: number;
  annualTransactions: { year: string; transactions: number; amount: number }[];
  transactionsByType: { type: string; percentage: number }[];
  transactionsByBiller: { biller: string; percentage: number }[];
  amountByType: { type: string; percentage: number }[];
  transactionsByPaymentOption: { option: string; percentage: number; transactions?: number }[];
  amountByPaymentOption: { option: string; percentage: number; amount: number }[];
}

export interface TreasuryDashboardViewProps {
  metrics?: TreasuryMetrics;
  transactions?: TransactionRecord[];
  marketStalls?: StallRecord[];
  isCollapsed: boolean;
  onNavigate?: (view: string) => void;
  setActiveTab?: (tab: any) => void;
  fetchTransactions?: () => Promise<TransactionRecord[]>;
  fetchStalls?: () => Promise<StallRecord[]>;
  fetchMetrics?: () => Promise<TreasuryMetrics>;
}

const PAYMENT_OPTION_COLORS: Record<string, string> = {
  "GCash": "#1d4ed8",
  "Visa/Mastercard via Paymaya": "#2563eb",
  "Maya (E-Wallet)": "#3b82f6",
  "Online Banking via Paygate": "#60a5fa",
  "Maya (QR)": "#93c5fd",
  "Bayad Center": "#bfdbfe",
  "Manual Payment for Landbank of the Philippines": "#dbeafe",
  "Landbank Online": "#1e3a8a"
};

const CHART_COLORS = ["#2563eb", "#60a5fa", "#93c5fd", "#bfdbfe", "#1e3a8a"];

export default function TreasuryDashboardView({
  transactions: initialTransactions = [],
  marketStalls: initialStalls = [],
  isCollapsed,
  onNavigate,
  setActiveTab,
  fetchTransactions,
  fetchStalls
}: TreasuryDashboardViewProps) {
  const [fiscalPeriod, setFiscalPeriod] = useState("2026");
  const [activeLocalTab, setActiveLocalTab] = useState<"ALL" | "RPT" | "BUSINESS" | "MARKET">("ALL");

  const [stalls, setStalls] = useState<StallRecord[]>(initialStalls);
  const [txs, setTxs] = useState<TransactionRecord[]>(initialTransactions);
  const [bizAssessments, setBizAssessments] = useState<BusinessAssessmentRecord[]>([]);
  const [rptAssessments, setRptAssessments] = useState<RPTAssessmentRecord[]>([]);
  const [rptPayments, setRptPayments] = useState<any[]>([]);
  const [marketPayments, setMarketPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAllModal, setShowAllModal] = useState(false);

  useEffect(() => {
    if (Array.isArray(initialTransactions)) setTxs(initialTransactions);
  }, [initialTransactions]);

  useEffect(() => {
    if (Array.isArray(initialStalls)) setStalls(initialStalls);
  }, [initialStalls]);

  const loadPostgresData = async () => {
    try {
      setLoading(true);
      let dbTransactions: TransactionRecord[] = [];
      let dbStalls: StallRecord[] = [];
      let dbBizAssessments: BusinessAssessmentRecord[] = [];
      let dbRptAssessments: RPTAssessmentRecord[] = [];

      if (fetchTransactions) {
        dbTransactions = (await fetchTransactions()) || [];
      } else {
        const res = await fetch(`${API_BASE_URL}/transactions`);
        if (res.ok) {
          const data = await res.json();
          dbTransactions = Array.isArray(data) ? data : (data.data || []);
        }
      }

      if (fetchStalls) {
        dbStalls = (await fetchStalls()) || [];
      } else {
        const res = await fetch(`${API_BASE_URL}/market-leases`);
        if (res.ok) {
          const data = await res.json();
          dbStalls = Array.isArray(data) ? data : (data.data || []);
        }
      }

      try {
        const resBiz = await fetch(`${API_BASE_URL}/business-assessments`);
        if (resBiz.ok) {
          const data = await resBiz.json();
          dbBizAssessments = Array.isArray(data) ? data : (data.assessments || data.data || []);
        }
      } catch (error) {
        console.error("Failed to fetch business assessments:", error);
      }

      try {
        const resRpt = await fetch(`${API_BASE_URL}/citizen-rpt-applications`);
        if (resRpt.ok) {
          const data = await resRpt.json();
          dbRptAssessments = Array.isArray(data) ? data : (data.applications || data.data || []);
        }
      } catch (error) {
        console.error("Failed to fetch RPT applications:", error);
      }

      setTxs(Array.isArray(dbTransactions) ? dbTransactions : []);
      setStalls(Array.isArray(dbStalls) ? dbStalls : []);
      setBizAssessments(Array.isArray(dbBizAssessments) ? dbBizAssessments : []);
      setRptAssessments(Array.isArray(dbRptAssessments) ? dbRptAssessments : []);

      // Fetch RPT payments for revenue trend
      try {
        const resRptPay = await fetch(`${API_BASE_URL}/citizen-rpt-payments`);
        if (resRptPay.ok) {
          const data = await resRptPay.json();
          setRptPayments(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.error('Failed to fetch RPT payments:', e);
      }

      // Fetch market lease payments for revenue trend
      try {
        const resMarket = await fetch(`${API_BASE_URL}/market-leases`);
        if (resMarket.ok) {
          const data = await resMarket.json();
          setMarketPayments(Array.isArray(data) ? data : (data.data || []));
        }
      } catch (e) {
        console.error('Failed to fetch market leases:', e);
      }

    } catch (error) {
      console.error("Failed to query data from backend:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPostgresData();
    const handleDbUpdate = () => loadPostgresData();
    window.addEventListener("db_treasury_updated", handleDbUpdate);
    return () => window.removeEventListener("db_treasury_updated", handleDbUpdate);
  }, [fetchTransactions, fetchStalls]);

  const handleShortcutNavigation = (viewName: string) => {
    if (setActiveTab) {
      setActiveTab(viewName);
    } else if (onNavigate) {
      onNavigate(viewName);
    } else {
      console.warn("Dashboard tried to navigate, but setActiveTab was not passed to it!");
    }
  };

  const matchesFiscalPeriod = (dateStr?: string) => {
    if (!dateStr) return true;
    const year = dateStr.slice(0, 4);
    if (!year || isNaN(Number(year))) return true;
    return year === fiscalPeriod;
  };

  const safeTxs = Array.isArray(txs) ? txs : [];

  const filteredTxsByTab = safeTxs.filter(tx => {
    if (activeLocalTab === "ALL") return true;
    const type = (tx?.paymentType || "").toUpperCase();
    if (activeLocalTab === "RPT") return type.includes("REAL PROPERTY") || type === "RPT";
    if (activeLocalTab === "BUSINESS") return type.includes("BUSINESS") || type.includes("BPLPO") || type.includes("PERMIT");
    if (activeLocalTab === "MARKET") return type.includes("MARKET");
    return true;
  });

  const activeTxFeed = filteredTxsByTab.filter(tx => matchesFiscalPeriod(tx?.date));

  const activeMetrics: TreasuryMetrics = (() => {
    const totalEpayments = filteredTxsByTab.length;
    const totalEORs = filteredTxsByTab.filter(t => t?.status === 'Posted' || !t?.status).length;
    const totalAmount = filteredTxsByTab
      .filter(t => t?.status === 'Posted' || t?.status === 'Verified')
      .reduce((sum, t) => sum + Number(t?.amount || 0), 0);

    const billersSet = new Set(filteredTxsByTab.map(t => t?.collector || 'Municipal Treasury'));
    const optionsSet = new Set(filteredTxsByTab.map(t => t?.paymentMethod || 'Cash / Direct'));

    const annualMap: Record<string, { transactions: number; amount: number }> = {};
    filteredTxsByTab.forEach(t => {
      const year = t?.date ? t.date.slice(0, 4) : '2026';
      if (!annualMap[year]) annualMap[year] = { transactions: 0, amount: 0 };
      annualMap[year].transactions += 1;
      annualMap[year].amount += Number(t?.amount || 0);
    });

    const annualTransactions = Object.keys(annualMap).sort().map(year => ({
      year,
      transactions: annualMap[year].transactions,
      amount: annualMap[year].amount
    }));

    const typeMap: Record<string, number> = {};
    filteredTxsByTab.forEach(t => {
      const type = t?.paymentType || 'General';
      typeMap[type] = (typeMap[type] || 0) + 1;
    });
    const transactionsByType = Object.keys(typeMap).map(type => ({
      type,
      percentage: totalEpayments > 0 ? Math.round((typeMap[type] / totalEpayments) * 100) : 0
    }));

    const billerMap: Record<string, number> = {};
    filteredTxsByTab.forEach(t => {
      const biller = t?.collector || 'Municipal Treasury';
      billerMap[biller] = (billerMap[biller] || 0) + 1;
    });
    const transactionsByBiller = Object.keys(billerMap).map(biller => ({
      biller,
      percentage: totalEpayments > 0 ? Math.round((billerMap[biller] / totalEpayments) * 100) : 0
    }));

    const optionCountMap: Record<string, number> = {};
    const optionAmountMap: Record<string, number> = {};
    filteredTxsByTab.forEach(t => {
      const option = t?.paymentMethod || 'Cash / Direct';
      optionCountMap[option] = (optionCountMap[option] || 0) + 1;
      optionAmountMap[option] = (optionAmountMap[option] || 0) + Number(t?.amount || 0);
    });

    const transactionsByPaymentOption = Object.keys(optionCountMap).map(option => ({
      option,
      transactions: optionCountMap[option],
      percentage: totalEpayments > 0 ? Number(((optionCountMap[option] / totalEpayments) * 100).toFixed(2)) : 0
    })).sort((a, b) => b.transactions - a.transactions);

    const amountByPaymentOption = Object.keys(optionAmountMap).map(option => ({
      option,
      amount: optionAmountMap[option],
      percentage: totalAmount > 0 ? Number(((optionAmountMap[option] / totalAmount) * 100).toFixed(2)) : 0
    })).sort((a, b) => b.amount - a.amount);

    return {
      totalEpayments,
      totalEORs,
      totalAmount,
      billerSystems: billersSet.size,
      paymentOptions: optionsSet.size,
      annualTransactions,
      transactionsByType,
      transactionsByBiller,
      amountByType: transactionsByType,
      transactionsByPaymentOption,
      amountByPaymentOption
    };
  })();

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const rptTrend = months.map((m, index) => {
    const monthNumStr = String(index + 1).padStart(2, '0');
    // From payment transactions
    const txAmount = activeTxFeed
      .filter(t => {
        const type = (t?.paymentType || '').toUpperCase();
        const dateStr = t?.date || '';
        const matchesMonth = dateStr.startsWith(`${fiscalPeriod}-${monthNumStr}`);
        return (type.includes('REAL PROPERTY') || type === 'RPT') && matchesMonth;
      })
      .reduce((sum, t) => sum + Number(t?.amount || 0), 0);
    // From RPT citizen payments
    const rptPayAmount = rptPayments
      .filter(p => {
        const dateStr = String(p?.payment_date || p?.created_at || p?.paymentDate || '');
        return dateStr.startsWith(`${fiscalPeriod}-${monthNumStr}`);
      })
      .reduce((sum, p) => sum + Number(p?.total_amount || p?.amount || p?.paid_amount || 0), 0);
    return { month: m, amount: txAmount + rptPayAmount };
  });

  const safeBizAssessments = Array.isArray(bizAssessments) ? bizAssessments : [];

  const bizTrend = months.map((m, index) => {
    const monthNumStr = String(index + 1).padStart(2, '0');
    const txAmount = activeTxFeed
      .filter(t => {
        const type = (t?.paymentType || '').toUpperCase();
        const dateStr = t?.date || '';
        return (type.includes('BUSINESS') || type.includes('BPLPO') || type.includes('PERMIT')) &&
          dateStr.startsWith(`${fiscalPeriod}-${monthNumStr}`);
      })
      .reduce((sum, t) => sum + Number(t?.amount || 0), 0);

    const assessmentAmount = safeBizAssessments
      .filter(b => {
        const dateStr = String(b?.applicationDate || b?.dateFiled || "");
        if (!dateStr) return false;
        return dateStr.includes(fiscalPeriod) && (dateStr.includes(`-${monthNumStr}-`) || dateStr.includes(`/${monthNumStr}/`) || dateStr.startsWith(`${fiscalPeriod}-${monthNumStr}`));
      })
      .reduce((sum, b) => {
        const rawSales = Number(String(b?.grossSales || "0").replace(/[^0-9.-]+/g, "")) || 0;
        return sum + (rawSales * 0.02);
      }, 0);

    return { month: m, amount: txAmount + assessmentAmount };
  });

  const marketTrend = months.map((m, index) => {
    const monthNumStr = String(index + 1).padStart(2, '0');
    // From payment transactions
    const txAmount = activeTxFeed
      .filter(t => {
        const type = (t?.paymentType || '').toUpperCase();
        const dateStr = t?.date || '';
        return type.includes('MARKET') && dateStr.startsWith(`${fiscalPeriod}-${monthNumStr}`);
      })
      .reduce((sum, t) => sum + Number(t?.amount || 0), 0);
    // From market lease records (amount_due / monthly_rent)
    const marketLeaseAmount = marketPayments
      .filter(l => {
        const dateStr = String(l?.payment_date || l?.created_at || l?.leaseStartDate || l?.startDate || '');
        return dateStr.startsWith(`${fiscalPeriod}-${monthNumStr}`) && 
          (l?.paymentStatus === 'Paid' || l?.status === 'Active');
      })
      .reduce((sum, l) => sum + Number(l?.amount_due || l?.monthlyRent || l?.amount || 0), 0);
    return { month: m, amount: txAmount + marketLeaseAmount };
  });

  const generateConicGradient = (items: { percentage: number; option?: string; type?: string }[]) => {
    if (!Array.isArray(items) || items.length === 0) return '#f1f5f9 0% 100%';
    let cumulativePercent = 0;
    return items.map((item, idx) => {
      const start = cumulativePercent;
      cumulativePercent += (item?.percentage || 0);
      const color = item?.option
        ? (PAYMENT_OPTION_COLORS[item.option] || '#2563eb')
        : (CHART_COLORS[idx % CHART_COLORS.length]);
      return `${color} ${start}% ${cumulativePercent}%`;
    }).join(', ');
  };

  return (
    <div
      style={{
        marginLeft: isCollapsed ? "80px" : "256px",
        width: isCollapsed ? "calc(100% - 80px)" : "calc(100% - 256px)",
      }}
      className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 p-6 pt-24 transition-all duration-300 box-border"
    >

      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center bg-white dark:bg-slate-900 p-6 rounded-2xl mb-6 flex-wrap gap-4 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 tracking-wider uppercase">
              OFFICE OF THE CITY ASSESSOR & TREASURY
            </span>
          </div>
          <h2 className="text-xl font-bold mb-1 text-slate-900 dark:text-white flex items-center gap-3">
            Treasury Dashboard
            {loading && <span className="text-xs font-normal text-blue-500 animate-pulse">(Querying PostgreSQL...)</span>}
          </h2>
          <p className="text-[13px] m-0 text-slate-500 dark:text-slate-400">
            Comprehensive analytics, transaction volumes, and gateway distribution
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-3">
          <div className="flex items-center gap-2 border-r border-slate-200 dark:border-slate-800 pr-3">
            <button
              onClick={() => setActiveLocalTab('ALL')}
              className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors border ${activeLocalTab === 'ALL' ? 'bg-blue-600 text-white border-blue-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
              All Modules
            </button>
            <button
              onClick={() => setActiveLocalTab('RPT')}
              className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors border ${activeLocalTab === 'RPT' ? 'bg-blue-600 text-white border-blue-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
              RPT Portal
            </button>
            <button
              onClick={() => setActiveLocalTab('BUSINESS')}
              className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors border ${activeLocalTab === 'BUSINESS' ? 'bg-blue-600 text-white border-blue-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
              Business Tax Hub
            </button>
            <button
              onClick={() => setActiveLocalTab('MARKET')}
              className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors border ${activeLocalTab === 'MARKET' ? 'bg-blue-600 text-white border-blue-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
              Market Stalls
            </button>
          </div>

          <button
            onClick={loadPostgresData}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white border border-blue-700 text-xs font-semibold cursor-pointer hover:bg-blue-700 shadow-sm transition-colors"
          >
            Refresh Data
          </button>
          <div className="flex items-center gap-2 ml-1">
            <label htmlFor="fiscalPeriodSelect" className="text-[13px] font-medium text-slate-700 dark:text-slate-300">
              Filter Year:
            </label>
            <select
              id="fiscalPeriodSelect"
              value={fiscalPeriod}
              onChange={(e) => setFiscalPeriod(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-[13px] font-medium text-slate-700 dark:text-slate-200 cursor-pointer outline-none focus:border-blue-500"
            >
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
              <option value="2023">2023</option>
              <option value="2022">2022</option>
              <option value="2021">2021</option>
            </select>
          </div>
        </div>
      </div>

      {activeLocalTab === "ALL" && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4 mb-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center gap-4">
            <div>
              <p className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-1 mt-0 uppercase">TOTAL ePAYMENTS</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white m-0">{activeMetrics.totalEpayments.toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-center">
            <p className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 mt-0 uppercase">TOTAL eORs</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white m-0">{activeMetrics.totalEORs.toLocaleString()}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-center">
            <p className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 mt-0 uppercase">TOTAL AMOUNT</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white m-0 truncate">₱{activeMetrics.totalAmount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>
      )}

      {activeLocalTab === "ALL" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white m-0 mb-4">Annual Total ePayment Transactions</h3>
              <div className="h-44 flex items-end justify-between gap-2 pt-6 px-2 border-b border-slate-200 dark:border-slate-800">
                {activeMetrics.annualTransactions.map((item, index) => {
                  const maxTx = Math.max(...activeMetrics.annualTransactions.map(s => s.transactions), 1);
                  const heightPct = Math.round((item.transactions / maxTx) * 100) || 0;
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center h-full justify-end" title={`${item.year}: ${item.transactions.toLocaleString()} transactions`}>
                      <div style={{ height: `${Math.max(heightPct, 4)}%` }} className="w-full bg-blue-600 rounded-t-sm" />
                      <span className="text-[10px] text-slate-500 mt-2">{item.year}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white m-0 mb-2">ePayment Transactions by Type</h3>
              <div className="flex justify-center items-center py-4">
                <div
                  className="w-36 h-36 rounded-full relative flex items-center justify-center shadow-sm"
                  style={{ background: `conic-gradient(${generateConicGradient(activeMetrics.transactionsByType)})` }}
                >
                  <div className="w-20 h-20 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center">
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">Type Ratio</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white m-0 mb-3">ePayment Transactions by Biller</h3>
              <div className="flex items-center justify-between">
                <div
                  className="w-32 h-32 rounded-full relative flex items-center justify-center shadow-sm"
                  style={{ background: `conic-gradient(${generateConicGradient(activeMetrics.transactionsByBiller)})` }}
                >
                  <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center">
                    <span className="text-[9px] font-bold text-slate-700 dark:text-slate-200">Billers</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`grid grid-cols-1 ${activeLocalTab === 'ALL' ? 'lg:grid-cols-3' : 'lg:grid-cols-1'} gap-6 mb-6`}>

        {(activeLocalTab === "ALL" || activeLocalTab === "RPT") && (
          <div
            onClick={() => handleShortcutNavigation('rpt')}
            className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all transform hover:-translate-y-1"
          >
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white m-0 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  Real Property Tax (RPT) Revenue
                </h3>
                <svg className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
              </div>
              <div className="h-44 flex items-end justify-between gap-1 pt-6 px-2 border-b border-slate-200 dark:border-slate-800">
                {rptTrend.map((item, index) => {
                  const maxAmt = Math.max(...rptTrend.map(s => s.amount), 1);
                  const heightPct = Math.round((item.amount / maxAmt) * 100) || 0;
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center h-full justify-end" title={`${item.month}: ₱${item.amount.toLocaleString()}`}>
                      <div style={{ height: `${Math.max(heightPct, 4)}%` }} className="w-full bg-blue-600 rounded-t-sm transition-all group-hover:bg-blue-500" />
                      <span className="text-[9px] text-slate-500 mt-2">{item.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="text-[11px] font-semibold text-blue-500 text-center mt-4 m-0 opacity-0 group-hover:opacity-100 transition-opacity">Go to Real Property Tax Admin Dashboard →</p>
          </div>
        )}

        {(activeLocalTab === "ALL" || activeLocalTab === "BUSINESS") && (
          <div
            onClick={() => handleShortcutNavigation('business')}
            className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all transform hover:-translate-y-1"
          >
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white m-0 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
                  Business Tax Revenue
                </h3>
                <svg className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
              </div>
              <div className="h-44 flex items-end justify-between gap-1 pt-6 px-2 border-b border-slate-200 dark:border-slate-800">
                {bizTrend.map((item, index) => {
                  const maxAmt = Math.max(...bizTrend.map(s => s.amount), 1);
                  const heightPct = Math.round((item.amount / maxAmt) * 100) || 0;
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center h-full justify-end" title={`${item.month}: ₱${item.amount.toLocaleString()}`}>
                      <div style={{ height: `${Math.max(heightPct, 4)}%` }} className="w-full bg-blue-400 rounded-t-sm transition-all group-hover:bg-blue-300" />
                      <span className="text-[9px] text-slate-500 mt-2">{item.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="text-[11px] font-semibold text-blue-500 text-center mt-4 m-0 opacity-0 group-hover:opacity-100 transition-opacity">Go to Business Tax Admin Dashboard →</p>
          </div>
        )}

        {(activeLocalTab === "ALL" || activeLocalTab === "MARKET") && (
          <div
            onClick={() => handleShortcutNavigation('market')}
            className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all transform hover:-translate-y-1"
          >
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white m-0 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
                  Market Stalls Revenue
                </h3>
                <svg className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
              </div>
              <div className="h-44 flex items-end justify-between gap-1 pt-6 px-2 border-b border-slate-200 dark:border-slate-800">
                {marketTrend.map((item, index) => {
                  const maxAmt = Math.max(...marketTrend.map(s => s.amount), 1);
                  const heightPct = Math.round((item.amount / maxAmt) * 100) || 0;
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center h-full justify-end" title={`${item.month}: ₱${item.amount.toLocaleString()}`}>
                      <div style={{ height: `${Math.max(heightPct, 4)}%` }} className="w-full bg-blue-500 rounded-t-sm transition-all group-hover:bg-blue-400" />
                      <span className="text-[9px] text-slate-500 mt-2">{item.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="text-[11px] font-semibold text-blue-500 text-center mt-4 m-0 opacity-0 group-hover:opacity-100 transition-opacity">Go to Market Stalls Admin Dashboard →</p>
          </div>
        )}
      </div>

      {activeLocalTab === "ALL" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold tracking-wider uppercase text-slate-900 dark:text-white m-0 mb-6">ePayment Transactions by Payment Option</h3>
              <div className="flex items-center justify-around gap-4 flex-wrap">
                <div
                  className="w-44 h-44 rounded-full relative flex items-center justify-center shadow-sm"
                  style={{ background: `conic-gradient(${generateConicGradient(activeMetrics.transactionsByPaymentOption)})` }}
                >
                  <div className="w-24 h-24 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 text-center">
                      {activeMetrics.transactionsByPaymentOption[0] ? `${activeMetrics.transactionsByPaymentOption[0].percentage}%` : '0%'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold tracking-wider uppercase text-slate-900 dark:text-white m-0 mb-6">Amount by Payment Option</h3>
              <div className="flex items-center justify-around gap-4 flex-wrap">
                <div
                  className="w-44 h-44 rounded-full relative flex items-center justify-center shadow-sm"
                  style={{ background: `conic-gradient(${generateConicGradient(activeMetrics.amountByPaymentOption)})` }}
                >
                  <div className="w-24 h-24 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 text-center">
                      {activeMetrics.amountByPaymentOption[0] ? `${activeMetrics.amountByPaymentOption[0].percentage}%` : '0%'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeLocalTab === "RPT" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm mb-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white m-0">Live Postgres RPT Applications</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mt-0.5">Showing raw property tax assessment records fetched from PostgreSQL</p>
            </div>
          </div>

          {rptAssessments.length === 0 ? (
            <p className="text-slate-400 dark:text-slate-500 text-[13px] italic text-center p-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl m-0">
              No RPT assessment records found in database.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-[13px] border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Ref / Control No.</th>
                    <th className="py-3 px-4">Applicant Name</th>
                    <th className="py-3 px-4">Category / Service</th>
                    <th className="py-3 px-4">Property PIN</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {rptAssessments.map((app, idx) => {
                    const refNo = app.controlNumber || app.referenceNumber || `REF-${app.id || idx}`;
                    const name = app.applicantName || app.ownerName || 'Unknown';
                    const pin = app.propertyDetails?.pin || app.pin || 'N/A';

                    return (
                      <tr key={app.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-blue-600 dark:text-blue-400">{refNo}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{name}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{app.service || app.category || 'RPT Assessment'}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-mono">{pin}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`py-0.5 px-2.5 rounded-full text-[11px] font-semibold border ${(app.status || "").includes("Approved") || (app.status || "").includes("Issued")
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}>
                            {app.status || 'Under Evaluation'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeLocalTab === "MARKET" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm mb-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white m-0">Market Stalls & Lease Overview</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mt-0.5">Active market stall records fetched from PostgreSQL ({stalls.length} total entries)</p>
            </div>
          </div>

          {stalls.length === 0 ? (
            <p className="text-slate-400 dark:text-slate-500 text-[13px] italic text-center p-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl m-0">
              No market stall records available.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-[13px] border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Stall Number / ID</th>
                    <th className="py-3 px-4">Vendor / Lessee</th>
                    <th className="py-3 px-4">Section / Market</th>
                    <th className="py-3 px-4 text-right">Monthly Rental</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {stalls.slice(0, 5).map((stall, idx) => (
                    <tr key={stall.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-blue-600 dark:text-blue-400">{stall.stallNumber || stall.id}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{stall.lesseeName || stall.vendorName || 'Unassigned'}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{stall.section || 'General Market'}</td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900 dark:text-white">
                        ₱{Number(stall.monthlyRent || stall.amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="py-0.5 px-2.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                          {stall.status || 'Active'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeLocalTab === "BUSINESS" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm mb-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white m-0">Live Postgres Business Assessments</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mt-0.5">Showing raw assessment declarations fetched from PostgreSQL</p>
            </div>
          </div>

          {bizAssessments.length === 0 ? (
            <p className="text-slate-400 dark:text-slate-500 text-[13px] italic text-center p-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl m-0">
              No business assessments found in database.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-[13px] border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Tracking No.</th>
                    <th className="py-3 px-4">Business Name</th>
                    <th className="py-3 px-4">Owner</th>
                    <th className="py-3 px-4 text-right">Gross Sales</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {bizAssessments.map((b, idx) => {
                    const rawSales = Number(String(b?.grossSales || "0").replace(/[^0-9.-]+/g, "")) || 0;
                    return (
                      <tr key={b.trackingNumber || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-blue-600 dark:text-blue-400">{b.trackingNumber}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{b.businessName}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{b.businessOwner}</td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-900 dark:text-white">
                          ₱{rawSales.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`py-0.5 px-2.5 rounded-full text-[11px] font-semibold border ${(b.status || "").toUpperCase() === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}>
                            {b.status || 'PENDING'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white m-0">
              Live Transaction Ledger ({activeLocalTab === "ALL" ? "All Modules" : activeLocalTab})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mt-0.5">
              {activeLocalTab === "RPT" && "Showing RPT citizen payment records fetched from PostgreSQL"}
              {activeLocalTab === "BUSINESS" && "Showing business assessment declarations fetched from PostgreSQL"}
              {activeLocalTab === "MARKET" && "Showing market lease records fetched from PostgreSQL"}
              {activeLocalTab === "ALL" && "Showing all ePayment transaction records from PostgreSQL"}
            </p>
          </div>
          {activeLocalTab === "ALL" && activeTxFeed.length > 0 && (
            <button
              onClick={() => setShowAllModal(true)}
              className="text-xs text-blue-600 dark:text-blue-400 font-semibold cursor-pointer hover:underline bg-transparent border-none p-0"
            >
              View All Feed
            </button>
          )}
        </div>

        {/* RPT Tab — show RPT payments */}
        {activeLocalTab === "RPT" && (
          rptPayments.length === 0 ? (
            <p className="text-slate-400 dark:text-slate-500 text-[13px] italic text-center p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl m-0">
              No RPT payment records found in database.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-[13px] border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Payment Ref</th>
                    <th className="py-3 px-4">Taxpayer / Owner</th>
                    <th className="py-3 px-4">Property PIN</th>
                    <th className="py-3 px-4 text-right">Amount Paid</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {rptPayments.slice(0, 10).map((p, idx) => (
                    <tr key={p.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-blue-600 dark:text-blue-400">{p.reference_number || p.referenceNumber || p.id || `RPT-PAY-${idx + 1}`}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{p.taxpayer_name || p.taxpayerName || p.owner_name || p.applicant_name || 'N/A'}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-mono">{p.pin || p.property_pin || 'N/A'}</td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900 dark:text-white">
                        ₱{Number(p.total_amount || p.amount || p.paid_amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{p.payment_method || p.paymentMethod || 'Online Payment'}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="py-0.5 px-2.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {p.status || 'Paid'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* BUSINESS Tab — show business assessments as ledger */}
        {activeLocalTab === "BUSINESS" && (
          bizAssessments.length === 0 ? (
            <p className="text-slate-400 dark:text-slate-500 text-[13px] italic text-center p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl m-0">
              No business assessment records found in database.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-[13px] border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Tracking No.</th>
                    <th className="py-3 px-4">Business Name</th>
                    <th className="py-3 px-4">Owner</th>
                    <th className="py-3 px-4">Date Filed</th>
                    <th className="py-3 px-4 text-right">Gross Sales</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {bizAssessments.slice(0, 10).map((b, idx) => {
                    const rawSales = Number(String(b?.grossSales || "0").replace(/[^0-9.-]+/g, "")) || 0;
                    return (
                      <tr key={b.trackingNumber || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-blue-600 dark:text-blue-400">{b.trackingNumber}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{b.businessName}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{b.businessOwner}</td>
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400">{b.applicationDate || b.dateFiled || 'N/A'}</td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-900 dark:text-white">
                          ₱{rawSales.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`py-0.5 px-2.5 rounded-full text-[11px] font-semibold border ${(b.status || "").toUpperCase() === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : (b.status || "").toUpperCase() === "REJECTED"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}>
                            {b.status || 'PENDING'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* MARKET Tab — show stall / lease records */}
        {activeLocalTab === "MARKET" && (
          stalls.length === 0 ? (
            <p className="text-slate-400 dark:text-slate-500 text-[13px] italic text-center p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl m-0">
              No market lease records found in database.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-[13px] border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Stall / ID</th>
                    <th className="py-3 px-4">Vendor / Lessee</th>
                    <th className="py-3 px-4">Section / Market</th>
                    <th className="py-3 px-4 text-right">Monthly Rental</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {stalls.slice(0, 10).map((stall, idx) => (
                    <tr key={stall.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-blue-600 dark:text-blue-400">{stall.stallNumber || stall.id}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{stall.lesseeName || stall.vendorName || 'Unassigned'}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{stall.section || 'General Market'}</td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900 dark:text-white">
                        ₱{Number(stall.monthlyRent || stall.amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="py-0.5 px-2.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                          {stall.status || 'Active'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* ALL Tab — show payment transactions */}
        {activeLocalTab === "ALL" && (
          activeTxFeed.length === 0 ? (
            <p className="text-slate-400 dark:text-slate-500 text-[13px] italic text-center p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl m-0">
              No transaction records found in database for year {fiscalPeriod}.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-[13px] border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Reference</th>
                    <th className="py-3 px-4">Payer Name</th>
                    <th className="py-3 px-4">Payment Type</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4">Collector</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {activeTxFeed.slice(0, 10).map((transaction, index) => (
                    <tr key={transaction.id || transaction.transactionId || index} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-blue-600 dark:text-blue-400">{transaction.referenceNumber || transaction.id}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{transaction.taxpayer || (transaction as any).payerName}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{transaction.paymentType}</td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900 dark:text-white">
                        ₱{Number(transaction.amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{transaction.paymentMethod}</td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">{transaction.collector}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="py-0.5 px-2.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                          {transaction.status || "Posted"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>


      {showAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white m-0">Complete Postgres Database Ledger ({fiscalPeriod})</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mt-1">Showing all records ({activeTxFeed.length} entries)</p>
              </div>
              <button
                onClick={() => setShowAllModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center font-bold border-none cursor-pointer"
              >
                X
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-[13px] border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Reference</th>
                      <th className="py-3 px-4">Payer Name</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4">Method</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {activeTxFeed.map((transaction, index) => (
                      <tr key={transaction.id || transaction.transactionId || index} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-blue-600 dark:text-blue-400">{transaction.referenceNumber || transaction.id}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{transaction.taxpayer || (transaction as any).payerName}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{transaction.paymentType}</td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-900 dark:text-white">
                          ₱{Number(transaction.amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{transaction.paymentMethod}</td>
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400">{transaction.date || ""}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="py-0.5 px-2.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                            {transaction.status || "Posted"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex justify-end p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <button
                onClick={() => setShowAllModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs cursor-pointer border-none hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}