// src/components/TreasuryDashboardView.tsx

import { useState, useEffect, useRef } from "react";
import type { TransactionRecord } from "../types/treasury";

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
  fetchTransactions?: () => Promise<TransactionRecord[]>;
  fetchStalls?: () => Promise<StallRecord[]>;
  fetchMetrics?: () => Promise<TreasuryMetrics>;
}

const ALL_TRANSACTION_DATES = [
  "Aug 2026", "Jul 2026", "Jun 2026", "May 2026", "Apr 2026", "Mar 2026", 
  "Feb 2026", "Jan 2026", "Dec 2025", "Nov 2025", "Oct 2025", "Sep 2025"
];

const ALL_PAYMENT_TYPES = [
  "MISCELLANEOUS",
  "REAL PROPERTY TAX (RPT)",
  "BUSINESS"
];

const ALL_BILLERS = [
  "City Owned Market"
];

const ALL_PAYMENT_OPTIONS = [
  "Bayad Center",
  "GCash",
  "Landbank Online",
  "Manual Payment for Landbank of the Philippines",
  "Maya (E-Wallet)",
  "Maya (QR)",
  "Online Banking via Paygate",
  "Visa/Mastercard via Paymaya"
];

const ALL_EOR_OPTIONS = ["EOR", "NON-EOR"];

const PAYMENT_OPTION_COLORS: Record<string, string> = {
  "GCash": "#3b82f6", 
  "Visa/Mastercard via Paymaya": "#f97316", 
  "Maya (E-Wallet)": "#a855f7", 
  "Online Banking via Paygate": "#84cc16", 
  "Maya (QR)": "#06b6d4", 
  "Bayad Center": "#eab308", 
  "Manual Payment for Landbank of the Philippines": "#ec4899", 
  "Landbank Online": "#6366f1" 
};

export default function TreasuryDashboardView({ 
  metrics: initialMetrics,
  transactions: initialTransactions = [], 
  marketStalls: initialStalls = [], 
  isCollapsed,
  onNavigate,
  fetchTransactions,
  fetchStalls,
  fetchMetrics
}: TreasuryDashboardViewProps) {
  const [fiscalPeriod, setFiscalPeriod] = useState("2026");
  const [stalls, setStalls] = useState<StallRecord[]>(initialStalls);
  const [txs, setTxs] = useState<TransactionRecord[]>(initialTransactions);
  const [metrics, setMetrics] = useState<TreasuryMetrics | undefined>(initialMetrics);
  const [loading, setLoading] = useState(false);
  const [showAllModal, setShowAllModal] = useState(false);

  // Filter Dropdown States
  const [selectedDates, setSelectedDates] = useState<string[]>(ALL_TRANSACTION_DATES);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(ALL_PAYMENT_TYPES);
  const [selectedBillers, setSelectedBillers] = useState<string[]>(ALL_BILLERS);
  const [selectedOptions, setSelectedOptions] = useState<string[]>(ALL_PAYMENT_OPTIONS);
  const [selectedEor, setSelectedEor] = useState<string[]>(ALL_EOR_OPTIONS);

  // Search queries inside filter dropdowns
  const [dateSearch, setDateSearch] = useState("");
  const [typeSearch, setTypeSearch] = useState("");
  const [billerSearch, setBillerSearch] = useState("");
  const [optionSearch, setOptionSearch] = useState("");
  const [eorSearch, setEorSearch] = useState("");

  // Open dropdown toggles
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (initialTransactions && initialTransactions.length > 0) {
      setTxs(initialTransactions);
    }
  }, [initialTransactions]);

  useEffect(() => {
    if (initialStalls && initialStalls.length > 0) {
      setStalls(initialStalls);
    }
  }, [initialStalls]);

  useEffect(() => {
    if (initialMetrics) {
      setMetrics(initialMetrics);
    }
  }, [initialMetrics]);

  const loadPostgresData = async () => {
    try {
      setLoading(true);
      let dbTransactions: TransactionRecord[] | null = null;
      let dbStalls: StallRecord[] | null = null;
      let dbMetrics: TreasuryMetrics | null = null;

      if (fetchTransactions) {
        dbTransactions = await fetchTransactions();
      } else {
        const res = await fetch('http://localhost:3000/transactions');
        if (res.ok) dbTransactions = await res.json();
      }

      if (fetchStalls) {
        dbStalls = await fetchStalls();
      } else {
        const res = await fetch('http://localhost:3000/market-leases');
        if (res.ok) dbStalls = await res.json();
      }

      if (fetchMetrics) {
        dbMetrics = await fetchMetrics();
      } else {
        try {
          const res = await fetch('http://localhost:3000/treasury-metrics');
          if (res.ok) dbMetrics = await res.json();
        } catch {
          // Fallback compute
        }
      }

      if (dbTransactions) setTxs(dbTransactions);
      if (dbStalls) setStalls(dbStalls);
      if (dbMetrics) setMetrics(dbMetrics);
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
  }, [fetchTransactions, fetchStalls, fetchMetrics]);

  const matchesFiscalPeriod = (dateStr?: string) => {
    if (!dateStr) return true;
    const year = dateStr.slice(0, 4);
    if (!year || isNaN(Number(year))) return true;
    return year === fiscalPeriod;
  };

  const activeTxFeed = txs.filter(tx => matchesFiscalPeriod(tx.date));

  // --- AUTO-COMPUTE METRICS FROM LIVE TRANSACTIONS ---
  const computedMetrics: TreasuryMetrics = (() => {
    const totalEpayments = txs.length;
    const totalEORs = txs.filter(t => t.status === 'Posted' || !t.status).length;
    const totalAmount = txs.reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const billersSet = new Set(txs.map(t => t.collector || 'Municipal Treasury'));
    const optionsSet = new Set(txs.map(t => t.paymentMethod || 'Cash / Direct'));

    const annualMap: Record<string, { transactions: number; amount: number }> = {};
    txs.forEach(t => {
      const year = t.date ? t.date.slice(0, 4) : '2026';
      if (!annualMap[year]) annualMap[year] = { transactions: 0, amount: 0 };
      annualMap[year].transactions += 1;
      annualMap[year].amount += Number(t.amount || 0);
    });

    const annualTransactions = Object.keys(annualMap).sort().map(year => ({
      year,
      transactions: annualMap[year].transactions,
      amount: annualMap[year].amount
    }));

    const typeMap: Record<string, number> = {};
    txs.forEach(t => {
      const type = t.paymentType || 'General';
      typeMap[type] = (typeMap[type] || 0) + 1;
    });
    const transactionsByType = Object.keys(typeMap).map(type => ({
      type,
      percentage: totalEpayments > 0 ? Math.round((typeMap[type] / totalEpayments) * 100) : 0
    }));

    const billerMap: Record<string, number> = {};
    txs.forEach(t => {
      const biller = t.collector || 'Municipal Treasury';
      billerMap[biller] = (billerMap[biller] || 0) + 1;
    });
    const transactionsByBiller = Object.keys(billerMap).map(biller => ({
      biller,
      percentage: totalEpayments > 0 ? Math.round((billerMap[biller] / totalEpayments) * 100) : 0
    }));

    const optionCountMap: Record<string, number> = {};
    const optionAmountMap: Record<string, number> = {};
    txs.forEach(t => {
      const option = t.paymentMethod || 'Cash / Direct';
      optionCountMap[option] = (optionCountMap[option] || 0) + 1;
      optionAmountMap[option] = (optionAmountMap[option] || 0) + Number(t.amount || 0);
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

  const activeMetrics = metrics && metrics.totalEpayments > 0 ? metrics : computedMetrics;

  const toggleSelectAll = (allList: string[], currentSelected: string[], setter: (val: string[]) => void) => {
    if (currentSelected.length === allList.length) {
      setter([]);
    } else {
      setter([...allList]);
    }
  };

  const toggleItem = (item: string, currentSelected: string[], setter: (val: string[]) => void) => {
    if (currentSelected.includes(item)) {
      setter(currentSelected.filter(i => i !== item));
    } else {
      setter([...currentSelected, item]);
    }
  };

  const generateConicGradient = (items: { percentage: number; option?: string; type?: string }[]) => {
    let cumulativePercent = 0;
    return items.map((item, idx) => {
      const start = cumulativePercent;
      cumulativePercent += item.percentage;
      const color = item.option ? (PAYMENT_OPTION_COLORS[item.option] || '#3b82f6') : (idx === 0 ? '#3b82f6' : idx === 1 ? '#f97316' : '#a855f7');
      return `${color} ${start}% ${cumulativePercent}%`;
    }).join(', ');
  };

  return (
    <div 
      style={{
        marginLeft: isCollapsed ? "80px" : "256px",
        width: isCollapsed ? "calc(100% - 80px)" : "calc(100% - 256px)",
      }}
      className="min-h-screen bg-slate-50/60 dark:bg-slate-950 text-slate-800 dark:text-slate-100 p-6 pt-24 transition-all duration-300 box-border"
      ref={dropdownRef}
    >
      {/* Header & Year Selector */}
      <div className="flex justify-between items-start bg-white dark:bg-slate-900/60 p-6 rounded-2xl mb-6 flex-wrap gap-4 shadow-xs border border-slate-200/80 dark:border-slate-800 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-bold mb-1 text-slate-900 dark:text-white flex items-center gap-3">
            Treasury ePayment Dashboard
            {loading && <span className="text-xs font-normal text-blue-500 animate-pulse">(Querying PostgreSQL...)</span>}
          </h2>
          <p className="text-[13px] m-0 text-slate-500 dark:text-slate-400">
            Comprehensive ePayment analytics, transaction volumes, and gateway distribution
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onNavigate && (
            <button 
              onClick={() => onNavigate('home')}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer hover:bg-slate-200 transition-colors"
            >
              Back Home
            </button>
          )}
          <button 
            onClick={loadPostgresData}
            className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-xs font-semibold cursor-pointer hover:bg-blue-100 transition-colors"
          >
            Refresh Data
          </button>
          <div className="flex items-center gap-2">
            <label htmlFor="fiscalPeriodSelect" className="text-[13px] font-medium text-slate-700 dark:text-slate-300">
              Filter Year:
            </label>
            <select
              id="fiscalPeriodSelect"
              value={fiscalPeriod}
              onChange={(e) => setFiscalPeriod(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-[13px] font-medium text-slate-700 dark:text-slate-200 cursor-pointer outline-none focus:border-blue-500"
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

      {/* TOP FIVE METRICS BANNER */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4 mb-6">
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl flex items-center justify-center">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-1 mt-0 uppercase">TOTAL ePAYMENTS</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white m-0">{activeMetrics.totalEpayments.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-center">
          <p className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 mt-0 uppercase">TOTAL eORs</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white m-0">{activeMetrics.totalEORs.toLocaleString()}</p>
        </div>

        <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-center">
          <p className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 mt-0 uppercase">TOTAL AMOUNT</p>
          <p className="text-lg font-bold text-slate-900 dark:text-white m-0 truncate">₱{activeMetrics.totalAmount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>

        <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-center">
          <p className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 mt-0 uppercase">BILLER SYSTEMS</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white m-0">{activeMetrics.billerSystems}</p>
        </div>

        <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-center">
          <p className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 mt-0 uppercase">PAYMENT OPTIONS</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white m-0">{activeMetrics.paymentOptions}</p>
        </div>
      </div>

      {/* FILTER TOOLBAR SECTION */}
      <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 mb-6 shadow-xs flex items-center justify-center flex-wrap gap-3">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-2">Filter by:</span>

        {/* Date Filter */}
        <div className="relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === 'date' ? null : 'date')}
            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center justify-between gap-4 cursor-pointer hover:border-blue-500 transition-all min-w-[160px]"
          >
            <span className="truncate">Transaction Date ({selectedDates.length})</span>
            <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${openDropdown === 'date' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {openDropdown === 'date' && (
            <div className="absolute left-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-30 p-3.5 backdrop-blur-lg">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2.5">
                <label className="flex items-center gap-2.5 text-xs font-semibold cursor-pointer text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={selectedDates.length === ALL_TRANSACTION_DATES.length}
                    onChange={() => toggleSelectAll(ALL_TRANSACTION_DATES, selectedDates, setSelectedDates)}
                    className="rounded-md w-4 h-4 accent-blue-600 cursor-pointer"
                  />
                  <span>Select All Dates</span>
                </label>
                <span className="text-[11px] text-slate-400 font-medium">{selectedDates.length}/{ALL_TRANSACTION_DATES.length}</span>
              </div>
              <div className="relative mb-2.5">
                <input
                  type="text"
                  placeholder="Search dates..."
                  value={dateSearch}
                  onChange={(e) => setDateSearch(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500 text-slate-700 dark:text-slate-200"
                />
              </div>
              <div className="max-h-52 overflow-y-auto flex flex-col gap-1 pr-1">
                {ALL_TRANSACTION_DATES.filter(d => d.toLowerCase().includes(dateSearch.toLowerCase())).map((date) => (
                  <label key={date} className="flex items-center gap-2.5 text-xs py-1.5 px-2 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedDates.includes(date)}
                      onChange={() => toggleItem(date, selectedDates, setSelectedDates)}
                      className="rounded-md w-4 h-4 accent-blue-600 cursor-pointer"
                    />
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{date}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Payment Type Filter */}
        <div className="relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === 'type' ? null : 'type')}
            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center justify-between gap-4 cursor-pointer hover:border-blue-500 transition-all min-w-[160px]"
          >
            <span className="truncate">Payment Type ({selectedTypes.length})</span>
            <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${openDropdown === 'type' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {openDropdown === 'type' && (
            <div className="absolute left-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-30 p-3.5 backdrop-blur-lg">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2.5">
                <label className="flex items-center gap-2.5 text-xs font-semibold cursor-pointer text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={selectedTypes.length === ALL_PAYMENT_TYPES.length}
                    onChange={() => toggleSelectAll(ALL_PAYMENT_TYPES, selectedTypes, setSelectedTypes)}
                    className="rounded-md w-4 h-4 accent-blue-600 cursor-pointer"
                  />
                  <span>Select All Types</span>
                </label>
                <span className="text-[11px] text-slate-400 font-medium">{selectedTypes.length}/{ALL_PAYMENT_TYPES.length}</span>
              </div>
              <div className="relative mb-2.5">
                <input
                  type="text"
                  placeholder="Search types..."
                  value={typeSearch}
                  onChange={(e) => setTypeSearch(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500 text-slate-700 dark:text-slate-200"
                />
              </div>
              <div className="max-h-52 overflow-y-auto flex flex-col gap-1 pr-1">
                {ALL_PAYMENT_TYPES.filter(t => t.toLowerCase().includes(typeSearch.toLowerCase())).map((type) => (
                  <label key={type} className="flex items-center gap-2.5 text-xs py-1.5 px-2 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes(type)}
                      onChange={() => toggleItem(type, selectedTypes, setSelectedTypes)}
                      className="rounded-md w-4 h-4 accent-blue-600 cursor-pointer"
                    />
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{type}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Biller Filter */}
        <div className="relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === 'biller' ? null : 'biller')}
            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center justify-between gap-4 cursor-pointer hover:border-blue-500 transition-all min-w-[160px]"
          >
            <span className="truncate">Biller ({selectedBillers.length})</span>
            <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${openDropdown === 'biller' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {openDropdown === 'biller' && (
            <div className="absolute left-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-30 p-3.5 backdrop-blur-lg">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2.5">
                <label className="flex items-center gap-2.5 text-xs font-semibold cursor-pointer text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={selectedBillers.length === ALL_BILLERS.length}
                    onChange={() => toggleSelectAll(ALL_BILLERS, selectedBillers, setSelectedBillers)}
                    className="rounded-md w-4 h-4 accent-blue-600 cursor-pointer"
                  />
                  <span>Select All Billers</span>
                </label>
                <span className="text-[11px] text-slate-400 font-medium">{selectedBillers.length}/{ALL_BILLERS.length}</span>
              </div>
              <div className="relative mb-2.5">
                <input
                  type="text"
                  placeholder="Search billers..."
                  value={billerSearch}
                  onChange={(e) => setBillerSearch(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500 text-slate-700 dark:text-slate-200"
                />
              </div>
              <div className="max-h-52 overflow-y-auto flex flex-col gap-1 pr-1">
                {ALL_BILLERS.filter(b => b.toLowerCase().includes(billerSearch.toLowerCase())).map((biller) => (
                  <label key={biller} className="flex items-center gap-2.5 text-xs py-1.5 px-2 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedBillers.includes(biller)}
                      onChange={() => toggleItem(biller, selectedBillers, setSelectedBillers)}
                      className="rounded-md w-4 h-4 accent-blue-600 cursor-pointer"
                    />
                    <span className="text-slate-700 dark:text-slate-300 font-medium truncate" title={biller}>{biller}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Payment Option Filter */}
        <div className="relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === 'option' ? null : 'option')}
            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center justify-between gap-4 cursor-pointer hover:border-blue-500 transition-all min-w-[160px]"
          >
            <span className="truncate">Payment Option ({selectedOptions.length})</span>
            <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${openDropdown === 'option' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {openDropdown === 'option' && (
            <div className="absolute left-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-30 p-3.5 backdrop-blur-lg">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2.5">
                <label className="flex items-center gap-2.5 text-xs font-semibold cursor-pointer text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={selectedOptions.length === ALL_PAYMENT_OPTIONS.length}
                    onChange={() => toggleSelectAll(ALL_PAYMENT_OPTIONS, selectedOptions, setSelectedOptions)}
                    className="rounded-md w-4 h-4 accent-blue-600 cursor-pointer"
                  />
                  <span>Select All Options</span>
                </label>
                <span className="text-[11px] text-slate-400 font-medium">{selectedOptions.length}/{ALL_PAYMENT_OPTIONS.length}</span>
              </div>
              <div className="relative mb-2.5">
                <input
                  type="text"
                  placeholder="Search options..."
                  value={optionSearch}
                  onChange={(e) => setOptionSearch(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500 text-slate-700 dark:text-slate-200"
                />
              </div>
              <div className="max-h-52 overflow-y-auto flex flex-col gap-1 pr-1">
                {ALL_PAYMENT_OPTIONS.filter(o => o.toLowerCase().includes(optionSearch.toLowerCase())).map((opt) => (
                  <label key={opt} className="flex items-center gap-2.5 text-xs py-1.5 px-2 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedOptions.includes(opt)}
                      onChange={() => toggleItem(opt, selectedOptions, setSelectedOptions)}
                      className="rounded-md w-4 h-4 accent-blue-600 cursor-pointer"
                    />
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* eOR Filter */}
        <div className="relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === 'eor' ? null : 'eor')}
            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center justify-between gap-4 cursor-pointer hover:border-blue-500 transition-all min-w-[140px]"
          >
            <span className="truncate">With eOR ({selectedEor.length})</span>
            <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${openDropdown === 'eor' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {openDropdown === 'eor' && (
            <div className="absolute left-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-30 p-3.5 backdrop-blur-lg">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2.5">
                <label className="flex items-center gap-2.5 text-xs font-semibold cursor-pointer text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={selectedEor.length === ALL_EOR_OPTIONS.length}
                    onChange={() => toggleSelectAll(ALL_EOR_OPTIONS, selectedEor, setSelectedEor)}
                    className="rounded-md w-4 h-4 accent-blue-600 cursor-pointer"
                  />
                  <span>Select All</span>
                </label>
                <span className="text-[11px] text-slate-400 font-medium">{selectedEor.length}/{ALL_EOR_OPTIONS.length}</span>
              </div>
              <div className="relative mb-2.5">
                <input
                  type="text"
                  placeholder="Search options..."
                  value={eorSearch}
                  onChange={(e) => setEorSearch(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500 text-slate-700 dark:text-slate-200"
                />
              </div>
              <div className="max-h-52 overflow-y-auto flex flex-col gap-1 pr-1">
                {ALL_EOR_OPTIONS.filter(e => e.toLowerCase().includes(eorSearch.toLowerCase())).map((item) => (
                  <label key={item} className="flex items-center gap-2.5 text-xs py-1.5 px-2 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedEor.includes(item)}
                      onChange={() => toggleItem(item, selectedEor, setSelectedEor)}
                      className="rounded-md w-4 h-4 accent-blue-600 cursor-pointer"
                    />
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{item}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ROW 1: CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white m-0 mb-4">Annual Total ePayment Transactions</h3>
            <div className="h-44 flex items-end justify-between gap-2 pt-6 px-2 border-b border-slate-200 dark:border-slate-800">
              {activeMetrics.annualTransactions.map((item, index) => {
                const maxTx = Math.max(...activeMetrics.annualTransactions.map(s => s.transactions), 1);
                const heightPct = Math.round((item.transactions / maxTx) * 100);
                return (
                  <div key={index} className="flex-1 flex flex-col items-center h-full justify-end" title={`${item.year}: ${item.transactions.toLocaleString()} transactions`}>
                    <div style={{ height: `${Math.max(heightPct, 4)}%` }} className="w-full bg-blue-500 rounded-t-xs" />
                    <span className="text-[10px] text-slate-500 mt-2">{item.year}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex justify-between items-center text-xs text-slate-400 mt-3">
            <span>Volume Spectrum</span>
            <span className="font-semibold text-blue-600">Active Analytics</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white m-0 mb-2">ePayment Transactions by Type</h3>
            <div className="flex flex-wrap items-center gap-3 text-xs mb-4">
              {activeMetrics.transactionsByType.map((item, idx) => (
                <span key={idx} className="flex items-center gap-1.5 uppercase">
                  <span className={`w-2.5 h-2.5 rounded-full ${idx === 0 ? 'bg-blue-500' : idx === 1 ? 'bg-amber-500' : 'bg-purple-500'} inline-block`}></span> 
                  {item.type} ({item.percentage}%)
                </span>
              ))}
            </div>
            <div className="flex justify-center items-center py-4">
              <div 
                className="w-36 h-36 rounded-full relative flex items-center justify-center shadow-xs"
                style={{ background: `conic-gradient(${generateConicGradient(activeMetrics.transactionsByType)})` }}
              >
                <div className="w-20 h-20 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center">
                  <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">Type Ratio</span>
                </div>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 text-center m-0">Distribution across statutory assessment modules</p>
        </div>

        <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white m-0 mb-3">ePayment Transactions by Biller</h3>
            <div className="flex items-center justify-between">
              <div 
                className="w-32 h-32 rounded-full relative flex items-center justify-center shadow-xs"
                style={{ background: `conic-gradient(${generateConicGradient(activeMetrics.transactionsByBiller)})` }}
              >
                <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center">
                  <span className="text-[9px] font-bold text-slate-700 dark:text-slate-200">Billers</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 text-[11px] text-slate-600 dark:text-slate-300 max-h-36 overflow-y-auto pr-1">
                {activeMetrics.transactionsByBiller.map((billerItem, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-blue-500' : idx === 1 ? 'bg-amber-500' : 'bg-purple-500'}`}></span> 
                    {billerItem.biller} ({billerItem.percentage}%)
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 text-center mt-2 m-0">Ranked by municipal biller integration</p>
        </div>
      </div>

      {/* ROW 2: PAYMENT OPTION DONUT CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold tracking-wider uppercase text-slate-900 dark:text-white m-0 mb-6">ePayment Transactions by Payment Option</h3>
            <div className="flex items-center justify-around gap-4 flex-wrap">
              <div 
                className="w-44 h-44 rounded-full relative flex items-center justify-center shadow-md"
                style={{ background: `conic-gradient(${generateConicGradient(activeMetrics.transactionsByPaymentOption)})` }}
              >
                <div className="w-24 h-24 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 text-center">
                    {activeMetrics.transactionsByPaymentOption[0] ? `${activeMetrics.transactionsByPaymentOption[0].percentage}%` : '0%'}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2 text-xs text-slate-600 dark:text-slate-300 max-h-48 overflow-y-auto pr-2">
                {activeMetrics.transactionsByPaymentOption.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PAYMENT_OPTION_COLORS[opt.option] || '#3b82f6' }}></span> 
                    <span className="truncate max-w-[200px]" title={opt.option}>{opt.option}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 text-center mt-6 m-0">Volume breakdown by integrated payment option channel</p>
        </div>

        <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold tracking-wider uppercase text-slate-900 dark:text-white m-0 mb-6">Amount by Payment Option</h3>
            <div className="flex items-center justify-around gap-4 flex-wrap">
              <div 
                className="w-44 h-44 rounded-full relative flex items-center justify-center shadow-md"
                style={{ background: `conic-gradient(${generateConicGradient(activeMetrics.amountByPaymentOption)})` }}
              >
                <div className="w-24 h-24 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 text-center">
                    {activeMetrics.amountByPaymentOption[0] ? `${activeMetrics.amountByPaymentOption[0].percentage}%` : '0%'}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2 text-xs text-slate-600 dark:text-slate-300 max-h-48 overflow-y-auto pr-2">
                {activeMetrics.amountByPaymentOption.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PAYMENT_OPTION_COLORS[opt.option] || '#3b82f6' }}></span> 
                    <span className="truncate max-w-[200px]" title={`${opt.option} (${opt.percentage}%)`}>{opt.option}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 text-center mt-6 m-0">Total monetary value distributed across gateway payment methods</p>
        </div>
      </div>

      {/* MARKET STALLS & LEASE OVERVIEW */}
      <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white m-0">Market Stalls & Lease Overview</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mt-0.5">Active market stall records fetched from PostgreSQL ({stalls.length} total entries)</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl">
            {stalls.length} Stalls Registered
          </span>
        </div>

        {stalls.length === 0 ? (
          <p className="text-slate-400 dark:text-slate-500 text-[13px] italic text-center p-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl m-0">
            No market stall records available.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
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
                  <tr key={stall.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-blue-600 dark:text-blue-400">{stall.stallNumber || stall.id}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{stall.lesseeName || stall.vendorName || 'Unassigned'}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{stall.section || 'General Market'}</td>
                    <td className="py-3 px-4 text-right font-semibold text-emerald-700 dark:text-emerald-400">
                      ₱{Number(stall.monthlyRent || stall.amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="py-0.5 px-2.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
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

      {/* POSTGRESQL LIVE TRANSACTION FEED TABLE */}
      <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white m-0">Live Postgres Transaction Ledger ({fiscalPeriod})</h3>
          {activeTxFeed.length > 0 && (
            <button 
              onClick={() => setShowAllModal(true)}
              className="text-xs text-blue-600 dark:text-blue-400 font-semibold cursor-pointer hover:underline bg-transparent border-none p-0"
            >
              View All Feed →
            </button>
          )}
        </div>

        {activeTxFeed.length === 0 ? (
          <p className="text-slate-400 dark:text-slate-500 text-[13px] italic text-center p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl m-0">
            No transaction records found in database for year {fiscalPeriod}.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
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
                {activeTxFeed.slice(0, 5).map((transaction, index) => (
                  <tr key={transaction.id || transaction.transactionId || index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-blue-600 dark:text-blue-400">{transaction.referenceNumber || transaction.id}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{transaction.taxpayer || (transaction as any).payerName}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{transaction.paymentType}</td>
                    <td className="py-3 px-4 text-right font-semibold text-emerald-700 dark:text-emerald-400">
                      ₱{Number(transaction.amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{transaction.paymentMethod}</td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">{transaction.collector}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="py-0.5 px-2.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        {transaction.status || "Posted"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* FULL LEDGER MODAL */}
      {showAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
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
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
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
                      <tr key={transaction.id || transaction.transactionId || index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-blue-600 dark:text-blue-400">{transaction.referenceNumber || transaction.id}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{transaction.taxpayer || (transaction as any).payerName}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{transaction.paymentType}</td>
                        <td className="py-3 px-4 text-right font-semibold text-emerald-700 dark:text-emerald-400">
                          ₱{Number(transaction.amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{transaction.paymentMethod}</td>
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400">{transaction.date || ""}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="py-0.5 px-2.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
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