import React, { useState, useEffect } from "react";
import type { Dispatch, SetStateAction, FormEvent } from "react";

// --- TYPES & INTERFACES ---

export type SourceModule = 
  | "Real Property Tax Management" 
  | "Business Permit Management" 
  | "Market Fee Management" 
  | "Regulatory Fee System" 
  | "Other Revenue Module";

export type RevenueType = 
  | "Real Property Tax" 
  | "Business Tax" 
  | "Market Rental" 
  | "Community Tax (Cedula)" 
  | "Regulatory Fees";

export type PaymentMethod = 
  | "Cash" 
  | "Check" 
  | "Bank Transfer" 
  | "Debit/Credit Card" 
  | "Digital Wallet";

export type PaymentStatus = "PAID" | "PARTIALLY_PAID" | "PENDING" | "VOIDED";

export interface PaymentForm {
  payer: string;
  type: "Real Property Tax" | "Business Tax" | "Market Rental" | "Other Fees";
  amount: number;
  method: "Cash" | "Bank Transfer" | "Check" | "Digital Wallet";
  refNo: string;
  remarks: string;
}

export interface PaymentRequest {
  id: string;
  referenceNumber: string;
  sourceModule: SourceModule;
  taxpayerId: string;
  taxpayerName: string;
  revenueType: RevenueType;
  assessmentNumber: string;
  amountDue: number;
  previousPayments: number;
  remainingBalance: number;
  dueDate: string;
}

export interface TransactionRecord {
  id: string;
  transactionId: string;
  officialReceiptNumber?: string;
  transactionNumber?: string;
  referenceNumber: string;
  sourceModule?: SourceModule;
  taxpayerId?: string;
  taxpayer: string;
  taxpayerName?: string;
  paymentType?: string;
  revenueType?: RevenueType;
  assessmentNumber?: string;
  amountDue?: number;
  amount: number;
  amountPaid?: number;
  remainingBalance?: number;
  paymentMethod: PaymentMethod;
  externalReference?: string;
  remarks?: string;
  paymentStatus?: PaymentStatus;
  status?: string;
  collector?: string;
  cashierName?: string;
  date: string;
}

export interface DashboardMetrics {
  totalCollectionsToday: number;
  totalTransactions: number;
  fullPayments: number;
  partialPayments: number;
  pendingPayments: number;
  cashCollections: number;
  nonCashCollections: number;
}

export interface AuditLogRecord {
  id: string;
  user: string;
  role: string;
  action: "PAYMENT_CREATED" | "PAYMENT_POSTED" | "PAYMENT_VOIDED" | "RECEIPT_GENERATED";
  transactionId: string;
  timestamp: string;
}

export interface PaymentPayload {
  paymentRequestId: string;
  referenceNumber: string;
  sourceModule: SourceModule;
  taxpayerId: string;
  taxpayerName: string;
  revenueType: RevenueType;
  assessmentNumber: string;
  amountDue: number;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  externalReference?: string;
  remarks?: string;
}

// --- PROPS INTERFACE FIX FOR MAIN APP INTEGRATION ---
export interface PaymentsViewProps {
  transactions: TransactionRecord[];
  form: PaymentForm;
  setForm: Dispatch<SetStateAction<PaymentForm>>;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  notify: (msg: string) => void;
  isCollapsed?: boolean;
}

const API_BASE_URL = "/api";

export const treasuryApi = {
  getPaymentRequests: async (search = ""): Promise<PaymentRequest[]> => {
    const res = await fetch(`${API_BASE_URL}/payment-requests?search=${encodeURIComponent(search)}`);
    if (!res.ok) throw new Error("Failed to fetch incoming payment requests from municipal modules.");
    return res.json();
  },

  getPaymentRequestById: async (id: string): Promise<PaymentRequest> => {
    const res = await fetch(`${API_BASE_URL}/payment-requests/${id}`);
    if (!res.ok) throw new Error("Failed to fetch specific payment request details.");
    return res.json();
  },

  postPayment: async (payload: PaymentPayload): Promise<TransactionRecord> => {
    const res = await fetch(`${API_BASE_URL}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to post payment transaction to PostgreSQL backend.");
    return res.json();
  },

  getPayments: async (page = 1, limit = 10, search = "", filterType = "All"): Promise<{ data: TransactionRecord[]; total: number }> => {
    const params = new URLSearchParams({ page: page.toString(), limit: limit.toString(), search, filterType });
    const res = await fetch(`${API_BASE_URL}/payments?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to retrieve payment records history.");
    return res.json();
  },

  getReceipt: async (id: string): Promise<TransactionRecord> => {
    const res = await fetch(`${API_BASE_URL}/payments/${id}/receipt`);
    if (!res.ok) throw new Error("Failed to fetch official receipt details.");
    return res.json();
  },

  voidTransaction: async (id: string): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_BASE_URL}/payments/${id}/void`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error("Failed to authorize transaction void action.");
    return res.json();
  },

  updatePaymentStatus: async (transactionId: string, status: PaymentStatus): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_BASE_URL}/payment-status/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId, status }),
    });
    if (!res.ok) throw new Error("Failed to synchronize payment status across municipal modules.");
    return res.json();
  },

  getDashboardMetrics: async (): Promise<DashboardMetrics> => {
    const res = await fetch(`${API_BASE_URL}/dashboard/metrics`);
    if (!res.ok) throw new Error("Failed to fetch treasury collection dashboard metrics.");
    return res.json();
  },

  getAuditLogs: async (): Promise<AuditLogRecord[]> => {
    const res = await fetch(`${API_BASE_URL}/audit-logs`);
    if (!res.ok) throw new Error("Failed to retrieve audit trail logs.");
    return res.json();
  },
};

// --- MAIN COMPONENT ---

export default function PaymentCollectionSystem({ 
  transactions, 
  form, 
  setForm, 
  onSubmit,
  searchQuery, 
  setSearchQuery, 
  notify, 
  isCollapsed = false 
}: PaymentsViewProps) {
  const [activeTab, setActiveTab] = useState<"dashboard" | "collection" | "history" | "audit">("collection");
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState<boolean>(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  const [incomingRequests, setIncomingRequests] = useState<PaymentRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState<boolean>(false);
  const [requestsError, setRequestsError] = useState<string | null>(null);

  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);

  // Confirmation Modal
  const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
  const [pendingPayload, setPendingPayload] = useState<PaymentPayload | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Receipt Modal
  const [completedTransaction, setCompletedTransaction] = useState<TransactionRecord | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState<boolean>(false);

  // History states
  const [historyPage] = useState<number>(1);
  const [historySearch, setHistorySearch] = useState<string>("");
  const [historyFilterType, setHistoryFilterType] = useState<string>("All");

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [auditLoading, setAuditLoading] = useState<boolean>(false);

  // Fetch Dashboard Metrics
  useEffect(() => {
    const fetchMetrics = async () => {
      setMetricsLoading(true);
      setMetricsError(null);
      try {
        const data = await treasuryApi.getDashboardMetrics();
        setMetrics(data);
      } catch (err: any) {
        setMetricsError(err.message || "Failed to load dashboard metrics.");
      } finally {
        setMetricsLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  // Fetch Incoming Payment Requests from Other Modules
  useEffect(() => {
    const fetchRequests = async () => {
      setRequestsLoading(true);
      setRequestsError(null);
      try {
        const data = await treasuryApi.getPaymentRequests(searchQuery);
        setIncomingRequests(data);
      } catch (err: any) {
        setRequestsError(err.message || "Failed to fetch incoming payment requests.");
      } finally {
        setRequestsLoading(false);
      }
    };
    const debounce = setTimeout(fetchRequests, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  // Fetch Audit Logs
  useEffect(() => {
    if (activeTab === "audit") {
      const fetchAudit = async () => {
        setAuditLoading(true);
        try {
          const logs = await treasuryApi.getAuditLogs();
          setAuditLogs(logs);
        } catch (err) {
          console.error(err);
        } finally {
          setAuditLoading(false);
        }
      };
      fetchAudit();
    }
  }, [activeTab]);

  // Handle Selection of Payment Request
  const handleSelectRequest = (req: PaymentRequest) => {
    setSelectedRequest(req);
    setForm(prev => ({
      ...prev,
      payer: req.taxpayerName,
      amount: req.remainingBalance,
      method: "Cash",
      refNo: "",
      remarks: ""
    }));
    setFormError(null);
  };

  // Validation & Preparation for Confirmation
  const handlePreparePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) {
      setFormError("A payable payment request must be selected before processing.");
      return;
    }
    if (form.amount <= 0) {
      setFormError("Payment amount must be greater than zero.");
      return;
    }
    if (form.method !== "Cash" && !form.refNo.trim()) {
      setFormError(`Non-cash payment method (${form.method}) requires a valid external reference number.`);
      return;
    }

    setFormError(null);
    const payload: PaymentPayload = {
      paymentRequestId: selectedRequest.id,
      referenceNumber: selectedRequest.referenceNumber,
      sourceModule: selectedRequest.sourceModule,
      taxpayerId: selectedRequest.taxpayerId,
      taxpayerName: selectedRequest.taxpayerName,
      revenueType: selectedRequest.revenueType,
      assessmentNumber: selectedRequest.assessmentNumber,
      amountDue: selectedRequest.remainingBalance,
      amountPaid: form.amount,
      paymentMethod: form.method as any,
      externalReference: form.refNo,
      remarks: form.remarks,
    };

    setPendingPayload(payload);
    setIsConfirmOpen(true);
  };

  // Finalize Payment Submission
  const handleConfirmPayment = async () => {
    if (!pendingPayload) return;
    try {
      const transaction = await treasuryApi.postPayment(pendingPayload);
      setCompletedTransaction(transaction);
      setIsConfirmOpen(false);
      setIsReceiptOpen(true);
      setSelectedRequest(null);
      notify("Payment posted successfully.");

      // Refresh metrics
      const newMetrics = await treasuryApi.getDashboardMetrics();
      setMetrics(newMetrics);
    } catch (err: any) {
      setFormError(err.message || "Failed to post payment transaction.");
      setIsConfirmOpen(false);
    }
  };

  // Void Transaction Handler
  const handleVoidTransaction = async (id: string) => {
    if (!window.confirm("Are you sure you want to authorize voiding this posted transaction?")) return;
    try {
      await treasuryApi.voidTransaction(id);
      const newMetrics = await treasuryApi.getDashboardMetrics();
      setMetrics(newMetrics);
      notify("Transaction voided successfully.");
    } catch (err: any) {
      alert(err.message || "Failed to void transaction.");
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = 
      (tx.referenceNumber && tx.referenceNumber.toLowerCase().includes(historySearch.toLowerCase())) ||
      (tx.taxpayer && tx.taxpayer.toLowerCase().includes(historySearch.toLowerCase()));
    const matchesType = historyFilterType === "All" || tx.paymentType === historyFilterType || tx.revenueType === historyFilterType;
    return matchesSearch && matchesType;
  });

  return (
    <div 
      className={`
        min-h-screen
        bg-slate-50 dark:bg-slate-900
        text-slate-800 dark:text-white
        p-6 pt-24
        transition-all duration-300
        ${isCollapsed ? "ml-20" : "ml-64"}
      `}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center dark:bg-slate-800 border-slate-800 rounded-3xl p-6 shadow-2xl gap-4">
          <div>
            <h1 className="text-2xl font-bold mt-1 dark:text-white">Payment Collection Module</h1>
            <p className="text-xs text-slate-400 d">Integrated Revenue Management & Official Receipt Processing</p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-800 text-xs font-semibold w-full md:w-auto overflow-x-auto">
            <button 
              onClick={() => setActiveTab("collection")} 
              className={`px-4 py-2.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${activeTab === "collection" ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:text-white"}`}
            >
              Payment Counter
            </button>
            <button 
              onClick={() => setActiveTab("dashboard")} 
              className={`px-4 py-2.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${activeTab === "dashboard" ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:text-white"}`}
            >
              Metrics Dashboard
            </button>
            <button 
              onClick={() => setActiveTab("history")} 
              className={`px-4 py-2.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${activeTab === "history" ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:text-white"}`}
            >
              Transaction History
            </button>
            <button 
              onClick={() => setActiveTab("audit")} 
              className={`px-4 py-2.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${activeTab === "audit" ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:text-white"}`}
            >
              Audit Trail
            </button>
          </div>
        </header>

        {/* TAB 1: PAYMENT COLLECTION COUNTER */}
        {activeTab === "collection" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Incoming Requests Search & Selection */}
            <div className="lg:col-span-5 space-y-6">
              <div className="dark:bg-slate-800 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                <div>
                  <h2 className="text-base font-bold dark:text-white uppercase tracking-wider">Incoming Payable Requests</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Retrieved from Real Property, Business Permit, Market, & Regulatory modules</p>
                </div>

                <div className="relative">
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Reference, Taxpayer ID, Name, or Revenue Type..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-blue-500 outline-none transition-colors"
                  />
                </div>

                {requestsLoading && <div className="text-xs text-slate-400 text-center py-4">Querying municipal assessment database...</div>}
                {requestsError && <div className="text-xs text-rose-400 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">{requestsError}</div>}

                <div className="space-y-2 max-h-120 overflow-y-auto pr-1">
                  {incomingRequests.map((req) => (
                    <div 
                      key={req.id}
                      onClick={() => handleSelectRequest(req)}
                      className={`p-4 rounded-2xl cursor-pointer border transition-all flex flex-col gap-2 ${selectedRequest?.id === req.id ? "bg-blue-500/10 border-blue-500/50 shadow-lg" : "bg-slate-950 border-slate-800 hover:border-slate-700"}`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">{req.sourceModule}</span>
                          <p className="font-bold text-sm text-white mt-1">{req.taxpayerName}</p>
                        </div>
                        <span className="text-xs font-mono font-bold text-blue-400">₱{req.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-400 pt-1 border-t border-slate-900">
                        <span>Ref: {req.referenceNumber}</span>
                        <span>Due: {req.dueDate}</span>
                      </div>
                    </div>
                  ))}
                  {!requestsLoading && incomingRequests.length === 0 && (
                    <div className="text-center py-8 text-xs text-slate-500">No unpaid assessment requests found.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Active Payment Processing Form */}
            <div className="lg:col-span-7 space-y-6">
              <div className="dark:bg-slate-800 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
                <div>
                  <h2 className="text-base font-bold dark:text-white uppercase tracking-wider">Payment Processing Terminal</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Process payment and generate municipal official receipt</p>
                </div>

                {selectedRequest ? (
                  <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3 text-sm">
                    <div className="flex justify-between border-b border-slate-900 pb-2">
                      <span className="text-slate-400">Selected Taxpayer:</span>
                      <span className="font-semibold text-white">{selectedRequest.taxpayerName}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-900 pb-2">
                      <span className="text-slate-400">Revenue Type & Source:</span>
                      <span className="font-semibold text-blue-400">{selectedRequest.revenueType} ({selectedRequest.sourceModule})</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-900 pb-2">
                      <span className="text-slate-400">Reference Number:</span>
                      <span className="font-mono text-slate-300">{selectedRequest.referenceNumber}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-900 pb-2">
                      <span className="text-slate-400">Assessment Number:</span>
                      <span className="font-mono text-slate-300">{selectedRequest.assessmentNumber}</span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-400 font-bold">Remaining Balance Due:</span>
                      <span className="font-bold text-blue-400 text-base">₱{selectedRequest.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 bg-slate-950 rounded-2xl border border-slate-800 text-center text-xs text-slate-500">
                    Select an incoming payment request from the left list to begin transaction processing.
                  </div>
                )}

                <form onSubmit={handlePreparePayment} className="space-y-4">
                  {formError && (
                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-xs font-semibold">
                      {formError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Payment Method</label>
                      <select 
                        value={form.method}
                        onChange={(e) => setForm(prev => ({ ...prev, method: e.target.value as any }))}
                        className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-sm text-white outline-none focus:border-blue-500"
                      >
                        <option value="Cash">Cash</option>
                        <option value="Check">Check</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Digital Wallet">Digital Wallet</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Amount Paid (₱)</label>
                      <input 
                        type="number"
                        step="0.01"
                        value={form.amount}
                        onChange={(e) => setForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                        className="w-full mt-1.5 bg-slate-950 border border-blue-500/80 rounded-2xl p-3.5 text-base text-white font-black outline-none shadow-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">External Reference No. (Check / Transfer / Card Ref)</label>
                    <input 
                      type="text"
                      value={form.refNo}
                      onChange={(e) => setForm(prev => ({ ...prev, refNo: e.target.value }))}
                      placeholder="Required for non-cash payment methods..."
                      className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-sm text-white outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Remarks / Teller Notations</label>
                    <input 
                      type="text"
                      value={form.remarks}
                      onChange={(e) => setForm(prev => ({ ...prev, remarks: e.target.value }))}
                      placeholder="Optional notes..."
                      className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-sm text-white outline-none focus:border-blue-500"
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={!selectedRequest}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-500 disabled:text-black dark:text-white font-bold py-4 rounded-2xl shadow-xl transition-all text-sm tracking-wide uppercase cursor-pointer"
                  >
                    Proceed to Payment Confirmation
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: METRICS DASHBOARD */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <div className="dark:bg-slate-800 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <h2 className="text-base font-bold dark:text-white uppercase tracking-wider">Treasury Collection Metrics</h2>
              <p className="text-xs text-slate-400 mt-0.5">Real-time statistics synchronized from backend database collections</p>
            </div>

            {metricsLoading && <div className="text-center py-12 text-slate-400">Loading collection analytics...</div>}
            {metricsError && <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-xs">{metricsError}</div>}

            {metrics && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-lg space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Collections Today</p>
                  <p className="text-3xl font-black text-blue-400">₱{metrics.totalCollectionsToday.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-lg space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Transactions</p>
                  <p className="text-3xl font-black text-white">{metrics.totalTransactions}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-lg space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Full / Partial Payments</p>
                  <p className="text-3xl font-black text-blue-400">{metrics.fullPayments} / {metrics.partialPayments}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-lg space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Cash vs Non-Cash</p>
                  <p className="text-2xl font-black text-purple-400">₱{metrics.cashCollections.toLocaleString()} / ₱{metrics.nonCashCollections.toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: TRANSACTION HISTORY */}
        {activeTab === "history" && (
          <div className="dark:bg-slate-800 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-base font-bold dark:text-white uppercase tracking-wider">Processed Transaction History</h2>
                <p className="text-xs text-slate-400 mt-0.5">Historical ledger records, official receipts, and audit actions</p>
              </div>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <input 
                  type="text"
                  placeholder="Search OR or Taxpayer..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500"
                />
                <select 
                  value={historyFilterType}
                  onChange={(e) => setHistoryFilterType(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                >
                  <option value="All">All Revenue Types</option>
                  <option value="Real Property Tax">Real Property Tax</option>
                  <option value="Business Tax">Business Tax</option>
                  <option value="Market Rental">Market Rental</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-xs uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-4">Reference / OR</th>
                    <th className="p-4">Taxpayer</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Method</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-950/50 transition-colors">
                      <td className="p-4 font-mono font-bold text-blue-400">{tx.referenceNumber}</td>
                      <td className="p-4 font-semibold text-white">{tx.taxpayer}</td>
                      <td className="p-4 text-xs text-slate-400">{tx.paymentType}</td>
                      <td className="p-4 font-bold text-white">₱{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="p-4 text-xs">{tx.paymentMethod}</td>
                      <td className="p-4">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border ${tx.status === 'Posted' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                          {tx.status || "Posted"}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button 
                          onClick={() => { setCompletedTransaction(tx); setIsReceiptOpen(true); }}
                          className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl border border-slate-700 transition-colors cursor-pointer"
                        >
                          Receipt
                        </button>
                        <button 
                          onClick={() => handleVoidTransaction(tx.id)}
                          className="text-xs bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 px-3 py-1.5 rounded-xl border border-rose-500/30 transition-colors cursor-pointer"
                        >
                          Void
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredTransactions.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-8 text-slate-500 text-xs">No transaction records found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: AUDIT TRAIL */}
        {activeTab === "audit" && (
          <div className="dark:bg-slate-800 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div>
              <h2 className="text-base font-bold dark:text-white uppercase tracking-wider">System Audit Trail</h2>
              <p className="text-xs text-slate-400 mt-0.5">Immutable record of payment creation, posting, voiding, and receipt generation</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-xs uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-4">Timestamp</th>
                    <th className="p-4">User</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Action</th>
                    <th className="p-4">Transaction ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {auditLoading ? (
                    <tr><td colSpan={5} className="text-center py-8 text-slate-500 text-xs">Loading audit logs...</td></tr>
                  ) : auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-950/50 transition-colors">
                      <td className="p-4 text-xs font-mono text-slate-400">{log.timestamp}</td>
                      <td className="p-4 font-semibold text-white">{log.user}</td>
                      <td className="p-4 text-xs text-slate-400">{log.role}</td>
                      <td className="p-4"><span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20">{log.action}</span></td>
                      <td className="p-4 font-mono text-xs text-slate-300">{log.transactionId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CONFIRMATION MODAL */}
        {isConfirmOpen && pendingPayload && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-lg w-full shadow-2xl space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">Payment Summary & Confirmation</h2>
                <p className="text-xs text-slate-400 mt-1">Review transaction details prior to PostgreSQL posting and receipt generation</p>
              </div>

              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3 text-sm">
                <div className="flex justify-between border-b border-slate-900 pb-2"><span className="text-slate-400">Taxpayer:</span> <span className="font-semibold text-white">{pendingPayload.taxpayerName}</span></div>
                <div className="flex justify-between border-b border-slate-900 pb-2"><span className="text-slate-400">Source Module:</span> <span className="text-blue-400">{pendingPayload.sourceModule}</span></div>
                <div className="flex justify-between border-b border-slate-900 pb-2"><span className="text-slate-400">Reference Number:</span> <span className="font-mono text-slate-300">{pendingPayload.referenceNumber}</span></div>
                <div className="flex justify-between border-b border-slate-900 pb-2"><span className="text-slate-400">Amount Due:</span> <span className="font-semibold text-white">₱{pendingPayload.amountDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between border-b border-slate-900 pb-2"><span className="text-slate-400">Amount Paid:</span> <span className="font-bold text-blue-400 text-base">₱{pendingPayload.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Payment Method:</span> <span className="font-semibold text-white">{pendingPayload.paymentMethod}</span></div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setIsConfirmOpen(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-bold text-sm transition-colors border border-slate-700 cursor-pointer">
                  Cancel
                </button>
                <button onClick={handleConfirmPayment} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold text-sm transition-colors shadow-lg cursor-pointer">
                  Confirm & Post Payment
                </button>
              </div>
            </div>
          </div>
        )}

        {/* OFFICIAL RECEIPT MODAL */}
        {isReceiptOpen && completedTransaction && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-blue-500/40 rounded-3xl p-8 max-w-xl w-full shadow-2xl space-y-6">
              <div className="text-center space-y-1">
                <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">Republic of the Philippines</span>
                <h2 className="text-lg font-black text-white">Municipal Treasury's Office</h2>
                <p className="text-xs text-slate-400">Official Receipt Generated Successfully</p>
              </div>

              <div className="bg-slate-950 rounded-2xl p-6 border border-slate-800 space-y-3 text-sm">
                <div className="flex justify-between border-b border-slate-900 pb-2"><span className="text-slate-400">OR Number:</span> <span className="font-mono font-bold text-blue-400 text-base">{completedTransaction.officialReceiptNumber || completedTransaction.referenceNumber}</span></div>
                <div className="flex justify-between border-b border-slate-900 pb-2"><span className="text-slate-400">Payment Date:</span> <span className="text-white">{completedTransaction.date}</span></div>
                <div className="flex justify-between border-b border-slate-900 pb-2"><span className="text-slate-400">Taxpayer Name:</span> <span className="font-semibold text-white">{completedTransaction.taxpayerName || completedTransaction.taxpayer}</span></div>
                <div className="flex justify-between border-b border-slate-900 pb-2"><span className="text-slate-400">Amount Paid:</span> <span className="font-bold text-white text-base">₱{(completedTransaction.amountPaid || completedTransaction.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Payment Method:</span> <span className="text-white">{completedTransaction.paymentMethod}</span></div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => window.print()} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-bold text-sm border border-slate-700 transition-colors cursor-pointer">
                  Print Official Receipt
                </button>
                <button onClick={() => setIsReceiptOpen(false)} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold text-sm transition-colors shadow-lg cursor-pointer">
                  Close & Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}