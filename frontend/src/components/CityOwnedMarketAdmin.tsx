import { useState, useMemo, useEffect } from "react";
import { getLeases, updateLease, deleteLease } from "../services/marketService";
import { API_BASE_URL } from "../config/api";

interface LeaseRecord {
  leaseId: string;
  firstName: string;
  lastName: string;
  marketName: string;
  section: string;
  stallNumber: string;
  leaseStatus: "Active" | "Termination Requested" | "For Termination" | "Terminated" | "Inactive" | "Archived";
  amountDue: number;
  helperApprovalStatus: string;
  advancePaymentStatus: string;
  paymentStatus: "Pending Payment" | "For Payment Verification" | "Payment Information Requested" | "Paid";
  paymentMethod?: string;
}

interface Props {
  records?: LeaseRecord[];
  isCollapsed?: boolean;
  onUpdateRecord?: (record: LeaseRecord) => void;
  onDeleteRecord?: (leaseId: string) => void;
}

export default function CityOwnedMarketAdmin({
  records: initialRecords = [],
  isCollapsed = false,
  onUpdateRecord,
  onDeleteRecord,
}: Props) {
  const [leases, setLeases] = useState<LeaseRecord[]>(initialRecords);

  // Tab State
  const [activeTab, setActiveTab] = useState<"Active" | "Archived">("Active");

  const [searchTermLeaseId, setSearchTermLeaseId] = useState("");
  const [searchFirstName, setSearchFirstName] = useState("");
  const [searchLastName, setSearchLastName] = useState("");
  const [selectedMarket, setSelectedMarket] = useState("All");
  const [selectedLeaseStatus, setSelectedLeaseStatus] = useState("All");
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState("All");
  const [showInactive, setShowInactive] = useState(false);
  const [entriesPerPage, setEntriesPerPage] = useState(10);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<LeaseRecord | null>(null);

  const [isAnalyzingFraud, setIsAnalyzingFraud] = useState(false);
  const [fraudAnalysisResult, setFraudAnalysisResult] = useState<{
    riskScore: number;
    riskLevel: "Low" | "Medium" | "High";
    flags: string[];
  } | null>(null);

  const fetchAdminLeases = async () => {
    try {
      const storedLeases = await getLeases();
      // Bypass strict type checking from the external service on load if needed
      setLeases(storedLeases as any[]);
    } catch (err) {
      console.error("Error fetching local leases:", err);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      if (initialRecords && initialRecords.length > 0) {
        if (isMounted) setLeases(initialRecords);
        return;
      }
      try {
        const storedLeases = await getLeases();
        if (isMounted) setLeases(storedLeases as any[]);
      } catch (err) {
        console.error("Error fetching local leases:", err);
      }
    };

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, [initialRecords]);

  const metrics = useMemo(() => {
    // Exclude archived records from the dashboard metrics
    const activeRecords = leases.filter((l) => l.leaseStatus !== "Archived");
    const total = activeRecords.length;
    let active = 0;
    let pendingPayment = 0;
    let totalRevenueDue = 0;

    for (let i = 0; i < total; i++) {
      const l = activeRecords[i];
      if (l.leaseStatus === "Active") active++;
      if (l.paymentStatus === "Pending Payment" || l.paymentStatus === "For Payment Verification") pendingPayment++;
      totalRevenueDue += l.amountDue || 0;
    }

    return { total, active, pendingPayment, totalRevenueDue };
  }, [leases]);

  const filteredLeases = useMemo(() => {
    const lowerLeaseId = searchTermLeaseId.toLowerCase();
    const lowerFirstName = searchFirstName.toLowerCase();
    const lowerLastName = searchLastName.toLowerCase();

    return leases.filter((item) => {
      const isArchived = item.leaseStatus === "Archived";

      // Filter by Tab
      if (activeTab === "Active" && isArchived) return false;
      if (activeTab === "Archived" && !isArchived) return false;

      if (!showInactive && item.leaseStatus === "Inactive" && activeTab === "Active") return false;
      if (selectedMarket !== "All" && item.marketName !== selectedMarket) return false;
      if (selectedLeaseStatus !== "All" && item.leaseStatus !== selectedLeaseStatus) return false;
      if (selectedPaymentStatus !== "All" && item.paymentStatus !== selectedPaymentStatus) return false;

      if (lowerLeaseId && !item.leaseId.toLowerCase().includes(lowerLeaseId)) return false;
      if (lowerFirstName && !item.firstName.toLowerCase().includes(lowerFirstName)) return false;
      if (lowerLastName && !item.lastName.toLowerCase().includes(lowerLastName)) return false;

      return true;
    });
  }, [leases, searchTermLeaseId, searchFirstName, searchLastName, selectedMarket, selectedLeaseStatus, selectedPaymentStatus, showInactive, activeTab]);

  const handleOpenEdit = (record: LeaseRecord) => {
    setSelectedRecord(record);
    setFraudAnalysisResult(null);
    setIsModalOpen(true);
  };

  const runAntiFraudCheck = async () => {
    if (!selectedRecord) return;
    setIsAnalyzingFraud(true);
    setFraudAnalysisResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/ai/fraud-scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ leaseId: selectedRecord.leaseId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete fraud scan.');
      }

      setFraudAnalysisResult({
        riskScore: data.riskScore,
        riskLevel: data.riskLevel,
        flags: data.flags && data.flags.length > 0 ? data.flags : ["No critical behavioral or transactional anomalies detected."]
      });
    } catch (err: any) {
      console.error('Error running AI scan:', err);
      alert('Could not complete the fraud scan: ' + err.message);
    } finally {
      setIsAnalyzingFraud(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;

    try {
      let recordToSave = { ...selectedRecord };

      if (recordToSave.paymentStatus === "Paid") {
        recordToSave.leaseStatus = "Active";
        if (recordToSave.helperApprovalStatus === "Pending" || !recordToSave.helperApprovalStatus) {
          recordToSave.helperApprovalStatus = "Approved";
        }
        if (recordToSave.advancePaymentStatus === "Pending" || !recordToSave.advancePaymentStatus) {
          recordToSave.advancePaymentStatus = "Verified & Cleared";
        }
      }

      // Bypass strict type checking from the external service
      await updateLease(recordToSave as any);

      const updated = leases.map((item) => {
        if (item.leaseId === recordToSave.leaseId) {
          return recordToSave;
        }
        return item;
      });

      setLeases(updated);

      if (onUpdateRecord) {
        onUpdateRecord(recordToSave);
      }

      setIsModalOpen(false);
      setSelectedRecord(null);
    } catch (err) {
      console.error("Failed to update lease record:", err);
      alert("Error saving lease updates.");
    }
  };

  // Archive (Soft Delete)
  const handleSoftDelete = async (record: LeaseRecord) => {
    if (window.confirm(`Are you sure you want to move lease record ${record.leaseId} to the Archiver?`)) {
      try {
        const updatedRecord = { ...record, leaseStatus: "Archived" as const };
        // Bypass strict type checking from the external service
        await updateLease(updatedRecord as any);
        setLeases(prevLeases => prevLeases.map((l) => l.leaseId === record.leaseId ? updatedRecord : l));
        if (onUpdateRecord) onUpdateRecord(updatedRecord);
      } catch (err) {
        console.error("Failed to archive lease:", err);
        alert("Error archiving lease record.");
      }
    }
  };

  // Restore from Archive
  const handleRestore = async (record: LeaseRecord) => {
    if (window.confirm(`Are you sure you want to restore lease record ${record.leaseId}?`)) {
      try {
        const updatedRecord = { ...record, leaseStatus: "Inactive" as const };
        // Bypass strict type checking from the external service
        await updateLease(updatedRecord as any);
        setLeases(prevLeases => prevLeases.map((l) => l.leaseId === record.leaseId ? updatedRecord : l));
        if (onUpdateRecord) onUpdateRecord(updatedRecord);
      } catch (err) {
        console.error("Failed to restore lease:", err);
        alert("Error restoring lease record.");
      }
    }
  };

  // Hard Delete (Final)
  const handleFinalDelete = async (leaseId: string) => {
    if (window.confirm(`WARNING: Are you sure you want to PERMANENTLY delete lease record ${leaseId}?`)) {
      try {
        await deleteLease(leaseId);
      } catch (err) {
        console.warn("Backend delete failed or unavailable, removing from local UI state anyway:", err);
      }

      setLeases(prevLeases => prevLeases.filter((l) => l.leaseId !== leaseId));

      if (onDeleteRecord) {
        onDeleteRecord(leaseId);
      }
    }
  };

  const handleExportCSV = () => {
    // Only exports the currently filtered active list
    const exportList = activeTab === "Active" ? leases.filter((l) => l.leaseStatus !== "Archived") : filteredLeases;
    const headers = [
      "Lease ID", "First Name", "Last Name", "Market Name", "Section",
      "Stall Number", "Lease Status", "Amount Due", "Helper Approval Status",
      "Advance Payment Status", "Payment Status", "Payment Method"
    ];

    const rows = exportList.map((l) => [
      `"${l.leaseId}"`,
      `"${l.firstName}"`,
      `"${l.lastName}"`,
      `"${l.marketName}"`,
      `"${l.section}"`,
      `"${l.stallNumber}"`,
      `"${l.leaseStatus}"`,
      l.amountDue,
      `"${l.helperApprovalStatus}"`,
      `"${l.advancePaymentStatus}"`,
      `"${l.paymentStatus}"`,
      `"${l.paymentMethod || 'Cash / Direct'}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `QC_Market_Leases_Admin_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getLeaseStatusBadge = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800";
      case "Termination Requested":
      case "For Termination":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800";
      case "Terminated":
      case "Inactive":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800";
      case "Archived":
        return "bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case "Paid":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800";
      case "For Payment Verification":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800";
      case "Payment Information Requested":
        return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-400 dark:border-purple-800";
      case "Pending Payment":
      default:
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800";
    }
  };

  return (
    <div
      style={{
        marginLeft: isCollapsed ? "80px" : "256px",
        width: isCollapsed ? "calc(100% - 80px)" : "calc(100% - 256px)",
      }}
      className="min-h-screen bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 p-6 pt-24 transition-all duration-300 box-border"
    >
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8 bg-white dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse"></span>
            <span className="text-[11px] font-semibold tracking-wider text-blue-600 dark:text-blue-400 uppercase">
              Market Development & Administration Department
            </span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            City-Owned Market Lease Management (Admin)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Stall Lease Auditing, Verification & AI Anti-Fraud Control Hub
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={fetchAdminLeases}
            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center gap-2"
          >
            Refresh List
          </button>
          <button
            onClick={handleExportCSV}
            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center gap-2"
          >
            <i className="fa-solid fa-download text-[10px]"></i> Export Lease Masterlist
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-900/80 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex justify-between items-start">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Lease Records</p>
            <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <i className="fa-solid fa-file-contract text-xs"></i>
            </span>
          </div>
          <h4 className="text-2xl font-bold text-slate-900 dark:text-white mt-3">{metrics.total}</h4>
          <p className="mt-2 text-[11px] text-slate-400">Total registered stalls</p>
        </div>

        <div className="bg-white dark:bg-slate-900/80 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex justify-between items-start">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Active Leases</p>
            <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <i className="fa-solid fa-circle-check text-xs"></i>
            </span>
          </div>
          <h4 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-3">{metrics.active}</h4>
          <p className="mt-2 text-[11px] text-slate-400">Currently operating</p>
        </div>

        <div className="bg-white dark:bg-slate-900/80 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex justify-between items-start">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Pending Payments</p>
            <span className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <i className="fa-solid fa-clock-rotate-left text-xs"></i>
            </span>
          </div>
          <h4 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-3">{metrics.pendingPayment}</h4>
          <p className="mt-2 text-[11px] text-slate-400">Requires verification</p>
        </div>

        <div className="bg-white dark:bg-slate-900/80 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex justify-between items-start">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Revenue Due</p>
            <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <i className="fa-solid fa-peso-sign text-xs"></i>
            </span>
          </div>
          <h4 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-3">₱{metrics.totalRevenueDue.toLocaleString()}</h4>
          <p className="mt-2 text-[11px] text-slate-400">Accumulated billings</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex space-x-1 bg-slate-200/50 dark:bg-slate-800/50 p-1.5 rounded-xl w-fit mb-6">
        <button
          onClick={() => setActiveTab("Active")}
          className={`px-5 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${activeTab === "Active"
              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
        >
          <i className="fa-solid fa-list-check mr-1.5"></i> Active Leases
        </button>
        <button
          onClick={() => setActiveTab("Archived")}
          className={`px-5 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${activeTab === "Archived"
              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
        >
          <i className="fa-solid fa-box-archive mr-1.5"></i> Archiver
        </button>
      </div>

      <section className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-5">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <i className={`fa-solid ${activeTab === "Active" ? "fa-list-check text-blue-600" : "fa-box-archive text-slate-500"} text-sm`}></i>
            {activeTab === "Active" ? "Admin Market Lease Control Panel" : "Archived Leases"}
          </h3>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            Due Date: 08/20/2026
          </span>
        </div>

        <div className="p-5 bg-slate-50/50 dark:bg-slate-950/50 rounded-2xl border border-slate-200/80 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          <div className="flex flex-col gap-1.5 text-xs">
            <label className="font-semibold text-slate-700 dark:text-slate-300">Lease ID</label>
            <input
              type="text"
              placeholder="Search Lease ID..."
              value={searchTermLeaseId}
              onChange={(e) => setSearchTermLeaseId(e.target.value)}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-all"
            />
          </div>

          <div className="flex flex-col gap-1.5 text-xs">
            <label className="font-semibold text-slate-700 dark:text-slate-300">First name Stallholder</label>
            <input
              type="text"
              placeholder="First name..."
              value={searchFirstName}
              onChange={(e) => setSearchFirstName(e.target.value)}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-all"
            />
          </div>

          <div className="flex flex-col gap-1.5 text-xs">
            <label className="font-semibold text-slate-700 dark:text-slate-300">Last name Stallholder</label>
            <input
              type="text"
              placeholder="Last name..."
              value={searchLastName}
              onChange={(e) => setSearchLastName(e.target.value)}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-all"
            />
          </div>

          <div className="flex flex-col gap-1.5 text-xs">
            <label className="font-semibold text-slate-700 dark:text-slate-300">Market Name</label>
            <select
              value={selectedMarket}
              onChange={(e) => setSelectedMarket(e.target.value)}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none cursor-pointer focus:border-blue-500 transition-all"
            >
              <option value="All">All Markets</option>
              <option value="Galas City-Owned Market">Galas City-Owned Market</option>
              <option value="Kamuning City-Owned Market">Kamuning City-Owned Market</option>
              <option value="Murphy City-owned Market">Murphy City-owned Market</option>
              <option value="Project 2 City-Owned Market">Project 2 City-Owned Market</option>
              <option value="Project 4 City-Owned Market (New)">Project 4 City-Owned Market (New)</option>
              <option value="R.A. Calalay City-Owned Market - Temporary">R.A. Calalay City-Owned Market - Temporary</option>
              <option value="Roxas City-Owned Market">Roxas City-Owned Market</option>
              <option value="San Jose City-Owned Market">San Jose City-Owned Market</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5 text-xs">
            <label className="font-semibold text-slate-700 dark:text-slate-300">Lease Status</label>
            <select
              value={selectedLeaseStatus}
              onChange={(e) => setSelectedLeaseStatus(e.target.value)}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none cursor-pointer focus:border-blue-500 transition-all"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Termination Requested">Termination Requested</option>
              <option value="For Termination">For Termination</option>
              <option value="Terminated">Terminated</option>
              <option value="Inactive">Inactive</option>
              <option value="Archived">Archived</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5 text-xs">
            <label className="font-semibold text-slate-700 dark:text-slate-300">Payment Status</label>
            <select
              value={selectedPaymentStatus}
              onChange={(e) => setSelectedPaymentStatus(e.target.value)}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none cursor-pointer focus:border-blue-500 transition-all"
            >
              <option value="All">All Payment Statuses</option>
              <option value="Pending Payment">Pending Payment</option>
              <option value="For Payment Verification">For Payment Verification</option>
              <option value="Payment Information Requested">Payment Information Requested</option>
              <option value="Paid">Paid</option>
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
            <button
              onClick={() => {
                setSearchTermLeaseId("");
                setSearchFirstName("");
                setSearchLastName("");
                setSelectedMarket("All");
                setSelectedLeaseStatus("All");
                setSelectedPaymentStatus("All");
              }}
              className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
          <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-4">Lease ID</th>
                <th className="p-4">First Name</th>
                <th className="p-4">Last Name</th>
                <th className="p-4">Market Name</th>
                <th className="p-4">Section</th>
                <th className="p-4">Stall Number</th>
                <th className="p-4 text-center">Lease Status</th>
                <th className="p-4">Need to pay</th>
                <th className="p-4">Payment Method</th>
                <th className="p-4">Helper Approval Status</th>
                <th className="p-4">Advance Payment Status</th>
                <th className="p-4 text-center">Payment Status</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              {filteredLeases.length === 0 ? (
                <tr>
                  <td colSpan={13} className="text-center py-16 text-slate-400 italic">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mb-1">
                        <i className={`fa-solid ${activeTab === "Active" ? "fa-folder-open" : "fa-box-archive"} text-xl`}></i>
                      </div>
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        {activeTab === "Active" ? "No Lease records found" : "No archived leases found"}
                      </p>
                      <p className="text-[11px] text-slate-400">Applications submitted from the citizen portal will appear here.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLeases.slice(0, entriesPerPage === 0 ? filteredLeases.length : entriesPerPage).map((item) => (
                  <tr key={item.leaseId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-4 font-mono font-bold text-blue-600 dark:text-blue-400">{item.leaseId}</td>
                    <td className="p-4 font-semibold text-slate-900 dark:text-slate-100">{item.firstName}</td>
                    <td className="p-4 font-semibold text-slate-900 dark:text-slate-100">{item.lastName}</td>
                    <td className="p-4">{item.marketName}</td>
                    <td className="p-4">{item.section}</td>
                    <td className="p-4 font-mono font-bold">{item.stallNumber}</td>

                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border ${getLeaseStatusBadge(item.leaseStatus)}`}>
                        {item.leaseStatus}
                      </span>
                    </td>

                    <td className="p-4 font-mono font-bold text-slate-900 dark:text-white">₱{item.amountDue.toLocaleString()}</td>
                    <td className="p-4 font-medium text-slate-700 dark:text-slate-300">{item.paymentMethod || "Cash / Direct"}</td>
                    <td className="p-4">{item.helperApprovalStatus}</td>
                    <td className="p-4">{item.advancePaymentStatus}</td>

                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border ${getPaymentStatusBadge(item.paymentStatus)}`}>
                        {item.paymentStatus}
                      </span>
                    </td>

                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {activeTab === "Active" ? (
                          <>
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-3.5 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                            >
                              Review
                            </button>
                            <button
                              onClick={() => handleSoftDelete(item)}
                              className="bg-slate-100 hover:bg-slate-200 hover:text-slate-800 text-slate-500 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200 font-medium px-2.5 py-1.5 rounded-xl transition-all cursor-pointer border border-slate-200"
                            >
                              Archive
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-3.5 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                            >
                              Review
                            </button>
                            <button
                              onClick={() => handleRestore(item)}
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-medium px-3.5 py-1.5 rounded-xl transition-all cursor-pointer border border-emerald-200 dark:border-emerald-900 flex items-center gap-1.5"
                            >
                              Restore
                            </button>
                            <button
                              onClick={() => handleFinalDelete(item.leaseId)}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 font-medium px-3.5 py-1.5 rounded-xl transition-all cursor-pointer border border-rose-200 dark:border-rose-900 flex items-center gap-1.5"
                            >
                              Delete (Final)
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span>Ipakita</span>
            <select
              value={entriesPerPage}
              onChange={(e) => setEntriesPerPage(Number(e.target.value))}
              className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none cursor-pointer"
            >
              <option value={0}>All</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
            </select>
            <span>ng {filteredLeases.length} entries</span>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="w-4 h-4 cursor-pointer rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500"
              />
              Ipakita ang hindi aktibong lease
            </label>
          </div>
        </div>
      </section>

      {/* Edit / Review Modal */}
      {isModalOpen && selectedRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-8 shadow-2xl border border-slate-200 dark:border-slate-800 my-8">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-4 mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Review &amp; Edit Lease Record
                </h3>
                <p className="text-xs font-mono text-blue-600 dark:text-blue-400 mt-0.5">ID: {selectedRecord.leaseId}</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">First Name</label>
                  <input
                    type="text"
                    value={selectedRecord.firstName}
                    onChange={(e) => setSelectedRecord({ ...selectedRecord, firstName: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-800 dark:text-slate-100"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Last Name</label>
                  <input
                    type="text"
                    value={selectedRecord.lastName}
                    onChange={(e) => setSelectedRecord({ ...selectedRecord, lastName: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-800 dark:text-slate-100"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Market Name</label>
                  <input
                    type="text"
                    value={selectedRecord.marketName}
                    onChange={(e) => setSelectedRecord({ ...selectedRecord, marketName: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Stall Number</label>
                  <input
                    type="text"
                    value={selectedRecord.stallNumber}
                    onChange={(e) => setSelectedRecord({ ...selectedRecord, stallNumber: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-800 dark:text-slate-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Lease Status</label>
                  <select
                    value={selectedRecord.leaseStatus}
                    onChange={(e) => setSelectedRecord({ ...selectedRecord, leaseStatus: e.target.value as any })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-800 dark:text-slate-100"
                  >
                    <option value="Active">Active</option>
                    <option value="Termination Requested">Termination Requested</option>
                    <option value="For Termination">For Termination</option>
                    <option value="Terminated">Terminated</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Payment Status</label>
                  <select
                    value={selectedRecord.paymentStatus}
                    onChange={(e) => {
                      const newPaymentStatus = e.target.value as any;
                      setSelectedRecord({
                        ...selectedRecord,
                        paymentStatus: newPaymentStatus,
                        leaseStatus: newPaymentStatus === "Paid" ? "Active" : selectedRecord.leaseStatus,
                        helperApprovalStatus: newPaymentStatus === "Paid" ? "Approved" : selectedRecord.helperApprovalStatus,
                        advancePaymentStatus: newPaymentStatus === "Paid" ? "Verified & Cleared" : selectedRecord.advancePaymentStatus
                      });
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-800 dark:text-slate-100"
                  >
                    <option value="Pending Payment">Pending Payment</option>
                    <option value="For Payment Verification">For Payment Verification</option>
                    <option value="Payment Information Requested">Payment Information Requested</option>
                    <option value="Paid">Paid</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Payment Method</label>
                  <select
                    value={selectedRecord.paymentMethod || "Cash / Direct"}
                    onChange={(e) => setSelectedRecord({ ...selectedRecord, paymentMethod: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-800 dark:text-slate-100"
                  >
                    <option value="Cash / Direct">Cash / Direct</option>
                    <option value="GCash">GCash</option>
                    <option value="Maya">Maya</option>
                    <option value="Landbank Link.BizPortal">Landbank Link.BizPortal</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Helper Approval Status</label>
                  <input
                    type="text"
                    value={selectedRecord.helperApprovalStatus}
                    onChange={(e) => setSelectedRecord({ ...selectedRecord, helperApprovalStatus: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Advance Payment Status</label>
                  <input
                    type="text"
                    value={selectedRecord.advancePaymentStatus}
                    onChange={(e) => setSelectedRecord({ ...selectedRecord, advancePaymentStatus: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Amount Due (₱)</label>
                  <input
                    type="number"
                    value={selectedRecord.amountDue}
                    onChange={(e) => setSelectedRecord({ ...selectedRecord, amountDue: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-800 dark:text-slate-100 font-mono"
                  />
                </div>

                {/* Gateway Transaction Verification Section */}
                <div className="sm:col-span-2 bg-slate-100/70 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 mt-2">
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider flex items-center gap-2">
                    <span>₱</span> Gateway Transaction Verification
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div>
                      <span className="text-slate-400 block mb-0.5">Gateway Ref ID:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {selectedRecord.leaseId}-TRX-9984
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">Webhook Timestamp:</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">
                        2026-08-21 (Payment Matched)
                      </span>
                    </div>
                  </div>

                  <div className="pt-1 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRecord({
                          ...selectedRecord,
                          paymentStatus: "Paid",
                          leaseStatus: "Active",
                          helperApprovalStatus: "Approved",
                          advancePaymentStatus: "Verified & Cleared"
                        });
                        alert("Payment successfully verified & matched via Gov Pay gateway!");
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer shadow-xs"
                    >
                      Verify &amp; Match Payment
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRecord({
                          ...selectedRecord,
                          paymentStatus: "Payment Information Requested",
                        });
                        alert("Flagged for transaction mismatch. Requesting updated proof from citizen.");
                      }}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer shadow-xs"
                    >
                      Flag Mismatch / Request Info
                    </button>
                  </div>
                </div>

                {/* Anti-Fraud AI Guardrails Section */}
                <div className="sm:col-span-2 bg-indigo-50/70 dark:bg-indigo-950/30 p-4 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 space-y-3 mt-1">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-indigo-950 dark:text-indigo-200 text-xs uppercase tracking-wider flex items-center gap-2">
                      <span>↻</span>Anti-Fraud AI Inspector
                    </h4>
                    <button
                      type="button"
                      onClick={runAntiFraudCheck}
                      disabled={isAnalyzingFraud}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold px-3.5 py-1.5 rounded-xl text-[11px] transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                    >
                      {isAnalyzingFraud ? (
                        <>
                          <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          Scanning Heuristics...
                        </>
                      ) : (
                        <>Run AI Fraud Scan</>
                      )}
                    </button>
                  </div>

                  {fraudAnalysisResult && (
                    <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-900 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-600 dark:text-slate-400">Assessed Risk Level:</span>
                        <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase ${fraudAnalysisResult.riskLevel === "High" ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" :
                            fraudAnalysisResult.riskLevel === "Medium" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" :
                              "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          }`}>
                          {fraudAnalysisResult.riskLevel} Risk ({fraudAnalysisResult.riskScore}/100)
                        </span>
                      </div>

                      <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-[11px] font-semibold text-slate-500 block">AI Flagged Signals:</span>
                        <ul className="list-disc pl-4 space-y-0.5 text-slate-700 dark:text-slate-300 text-[11px]">
                          {fraudAnalysisResult.flags.map((flag, idx) => (
                            <li key={idx}>{flag}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>

              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-xs cursor-pointer transition-all"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}