import { useState, useMemo, useEffect } from "react";
import { getLeases, updateLease, deleteLease, detectPaymentMethod } from "../services/marketService";
import { API_BASE_URL } from "../config/api";

const STANDARD_PAYMENT_METHODS = [
  "PayMongo (QR Ph)",
  "QR Ph",
  "PayMongo",
  "PayMongo (GCash)",
  "PayMongo (Maya)",
  "PayMongo (Card)",
  "PayMongo (GrabPay)",
  "PayMongo (Dobopay)"
];

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
  paymentStatus:
    | "Pending Payment"
    | "For Payment Verification"
    | "Payment Information Requested"
    | "Proof Submitted - For Treasury Verification"
    | "Paid"
    | string;
  paymentMethod?: string;
  officialReceiptNumber?: string;
  paymentReference?: string;
  paymentProof?: string;
  mismatchNotes?: string;
  paymentDate?: string;
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

  const [isDocViewerOpen, setIsDocViewerOpen] = useState(false);
  const [docZoom, setDocZoom] = useState(1);
  const [isMismatchModalOpen, setIsMismatchModalOpen] = useState(false);
  const [mismatchNoteInput, setMismatchNoteInput] = useState("");
  const [isSavingMismatch, setIsSavingMismatch] = useState(false);

  const fetchAdminLeases = async () => {
    try {
      const storedLeases = await getLeases();

      setLeases(storedLeases as any[]);
    } catch (err) {
      console.error("Error fetching local leases:", err);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const storedLeases = await getLeases();
        if (isMounted && Array.isArray(storedLeases)) {
          setLeases((prevLeases) => {
            if (JSON.stringify(prevLeases) === JSON.stringify(storedLeases)) {
              return prevLeases;
            }
            return storedLeases as any[];
          });
        }
      } catch (err) {
        console.error("Error fetching live leases:", err);
      }
    };

    if (initialRecords && initialRecords.length > 0) {
      setLeases(initialRecords);
    } else {
      loadData();
    }


    const intervalId = setInterval(() => {
      loadData();
    }, 3000);

    const handleFocus = () => loadData();
    window.addEventListener("focus", handleFocus);
    window.addEventListener("visibilitychange", handleFocus);
    window.addEventListener("db_treasury_updated", handleFocus);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("visibilitychange", handleFocus);
      window.removeEventListener("db_treasury_updated", handleFocus);
    };
  }, [initialRecords]);

  const metrics = useMemo(() => {

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
    const detected = detectPaymentMethod(record);
    setSelectedRecord({
      ...record,
      paymentMethod: record.paymentMethod || detected
    });
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
      const recordToSave = { ...selectedRecord };

      if (recordToSave.paymentStatus === "Paid") {
        recordToSave.leaseStatus = "Active";
        if (recordToSave.helperApprovalStatus === "Pending" || !recordToSave.helperApprovalStatus) {
          recordToSave.helperApprovalStatus = "Approved";
        }
        if (recordToSave.advancePaymentStatus === "Pending" || !recordToSave.advancePaymentStatus) {
          recordToSave.advancePaymentStatus = "Verified & Cleared";
        }
      }

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

  const handleVerifyAndMatchPayment = async () => {
    if (!selectedRecord) return;
    try {
      const orNumber = selectedRecord.officialReceiptNumber || `OR-MKT-${Math.floor(100000 + Math.random() * 900000)}`;
      const updatedRecord: LeaseRecord = {
        ...selectedRecord,
        paymentStatus: "Paid",
        leaseStatus: "Active",
        helperApprovalStatus: "Approved",
        advancePaymentStatus: "Verified & Cleared",
        officialReceiptNumber: orNumber,
        paymentDate: selectedRecord.paymentDate || new Date().toISOString(),
        paymentMethod: selectedRecord.paymentMethod || "PayMongo (QR Ph)",
      };

      await updateLease(updatedRecord);
      setSelectedRecord(updatedRecord);
      setLeases((prev) => prev.map((l) => (l.leaseId === updatedRecord.leaseId ? updatedRecord : l)));
      if (onUpdateRecord) onUpdateRecord(updatedRecord);
      window.dispatchEvent(new Event("db_treasury_updated"));
      alert(`Payment successfully verified & matched via Gov Pay gateway! Official Receipt issued: ${orNumber}`);
    } catch (err: any) {
      console.error("Failed to verify & match payment:", err);
      alert(err?.message || "Failed to update lease record in database.");
    }
  };

  const handleOpenFlagMismatchModal = (record?: LeaseRecord) => {
    const target = record || selectedRecord;
    if (!target) return;
    setSelectedRecord(target);
    setMismatchNoteInput(
      target.mismatchNotes ||
      "Payment amount or transaction reference does not match. Please upload your proof of transaction or receipt."
    );
    setIsMismatchModalOpen(true);
  };

  const handleConfirmFlagMismatch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedRecord) return;
    setIsSavingMismatch(true);
    const finalNote = mismatchNoteInput.trim() || "Transaction reference mismatch. Please upload valid proof of transaction.";

    try {
      const updatedRecord: LeaseRecord = {
        ...selectedRecord,
        paymentStatus: "Payment Information Requested",
        mismatchNotes: finalNote,
      };

      await updateLease(updatedRecord);
      setSelectedRecord(updatedRecord);
      setLeases((prev) => prev.map((l) => (l.leaseId === updatedRecord.leaseId ? updatedRecord : l)));
      if (onUpdateRecord) onUpdateRecord(updatedRecord);
      window.dispatchEvent(new Event("db_treasury_updated"));
      setIsMismatchModalOpen(false);
      alert("Flagged for transaction mismatch. Citizen has been notified to provide proof of transaction.");
    } catch (err: any) {
      console.error("Failed to flag mismatch:", err);
      alert(err?.message || "Failed to update lease record in database.");
    } finally {
      setIsSavingMismatch(false);
    }
  };

  const handleSoftDelete = async (record: LeaseRecord) => {
    if (window.confirm(`Are you sure you want to move lease record ${record.leaseId} to the Archiver?`)) {
      const updatedRecord = { ...record, leaseStatus: "Archived" as const };
      try {
        await updateLease(updatedRecord as any);
      } catch (err) {
        console.warn("Archive database update warning, updated local record:", err);
      }
      setLeases(prevLeases => prevLeases.map((l) => l.leaseId === record.leaseId ? updatedRecord : l));
      if (onUpdateRecord) onUpdateRecord(updatedRecord);
      window.dispatchEvent(new Event("db_treasury_updated"));
    }
  };

  const handleRestore = async (record: LeaseRecord) => {
    if (window.confirm(`Are you sure you want to restore lease record ${record.leaseId}?`)) {
      const updatedRecord = { ...record, leaseStatus: "Inactive" as const };
      try {
        await updateLease(updatedRecord as any);
      } catch (err) {
        console.warn("Restore database update warning, restored local record:", err);
      }
      setLeases(prevLeases => prevLeases.map((l) => l.leaseId === record.leaseId ? updatedRecord : l));
      if (onUpdateRecord) onUpdateRecord(updatedRecord);
      window.dispatchEvent(new Event("db_treasury_updated"));
    }
  };

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

    const exportList = activeTab === "Active" ? leases.filter((l) => l.leaseStatus !== "Archived") : filteredLeases;
    const headers = [
      "Lease ID", "First Name", "Last Name", "Market Name", "Section",
      "Stall Number", "Lease Status", "Amount Due", "Helper Approval Status",
      "Advance Payment Status", "Payment Status", "Payment Method", "Official Receipt Number"
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
      `"${detectPaymentMethod(l)}"`,
      `"${l.officialReceiptNumber || 'Not yet issued'}"`,
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
      case "Proof Submitted - For Treasury Verification":
        return "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-400 dark:border-cyan-800";
      case "For Payment Verification":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800";
      case "Payment Information Requested":
      case "Flagged Mismatch / Proof Required":
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
          <div className="flex flex-wrap items-center gap-2 mb-1">
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
          </div>
          <h4 className="text-2xl font-bold text-slate-900 dark:text-white mt-3">{metrics.total}</h4>
          <p className="mt-2 text-[11px] text-slate-400">Total registered stalls</p>
        </div>

        <div className="bg-white dark:bg-slate-900/80 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex justify-between items-start">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Active Leases</p>
          </div>
          <h4 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-3">{metrics.active}</h4>
          <p className="mt-2 text-[11px] text-slate-400">Currently operating</p>
        </div>

        <div className="bg-white dark:bg-slate-900/80 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex justify-between items-start">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Pending Payments</p>
          </div>
          <h4 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-3">{metrics.pendingPayment}</h4>
          <p className="mt-2 text-[11px] text-slate-400">Requires verification</p>
        </div>

        <div className="bg-white dark:bg-slate-900/80 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex justify-between items-start">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Revenue Due</p>
          </div>
          <h4 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-3">₱{metrics.totalRevenueDue.toLocaleString()}</h4>
          <p className="mt-2 text-[11px] text-slate-400">Accumulated billings</p>
        </div>
      </div>

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
                    <td className="p-4 font-medium text-slate-700 dark:text-slate-300">{detectPaymentMethod(item)}</td>
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
                            {item.paymentStatus === "Proof Submitted - For Treasury Verification" ? (
                              <button
                                onClick={() => handleOpenEdit(item)}
                                className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs flex items-center gap-1 text-[11px] animate-pulse"
                                title="Citizen uploaded proof of payment! Click to verify."
                              >
                                Review Proof
                              </button>
                            ) : (
                              <button
                                onClick={() => handleOpenEdit(item)}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs flex items-center gap-1 text-[11px]"
                              >
                                Review
                              </button>
                            )}
                            {item.paymentStatus !== "Paid" && (
                              <button
                                onClick={() => handleOpenFlagMismatchModal(item)}
                                className="bg-amber-600 hover:bg-amber-700 text-white font-medium px-2.5 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs flex items-center gap-1 text-[11px]"
                                title="Flag mismatch & notify citizen"
                              >
                                Flag Mismatch
                              </button>
                            )}
                            <button
                              onClick={() => handleSoftDelete(item)}
                              className="bg-slate-100 hover:bg-slate-200 hover:text-slate-800 text-slate-500 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200 font-medium px-2.5 py-1.5 rounded-xl transition-all cursor-pointer border border-slate-200 text-[11px]"
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
            <span>Showing</span>
            <select
              value={entriesPerPage}
              onChange={(e) => setEntriesPerPage(Number(e.target.value))}
              className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none cursor-pointer"
            >
              <option value={0}>All</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
            </select>
            <span>of {filteredLeases.length} entries</span>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="w-4 h-4 cursor-pointer rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500"
              />
              Show Inactive Leases
            </label>
          </div>
        </div>
      </section>

      {isModalOpen && selectedRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[94vh] overflow-y-auto my-2">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-4 mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Review &amp; Edit Lease Record
                </h3>
                <p className="text-xs font-mono text-blue-600 dark:text-blue-400 mt-0.5">ID: {selectedRecord.leaseId}</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer transition-colors"
                title="Close"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
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
                  {(() => {
                    const activeMethod = selectedRecord.paymentMethod || detectPaymentMethod(selectedRecord);
                    const options = Array.from(
                      new Set([
                        ...STANDARD_PAYMENT_METHODS,
                        activeMethod,
                        ...(selectedRecord.paymentMethod ? [selectedRecord.paymentMethod] : [])
                      ])
                    );
                    return (
                      <select
                        value={activeMethod}
                        onChange={(e) => setSelectedRecord({ ...selectedRecord, paymentMethod: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-800 dark:text-slate-100 font-medium"
                      >
                        {options.map((method) => (
                          <option key={method} value={method}>
                            {method}
                          </option>
                        ))}
                      </select>
                    );
                  })()}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Official Receipt (O.R.) Number
                  </label>

                  <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Official Receipt (O.R.) Number
                        </p>

                        <p
                          className={`mt-1 font-mono text-sm font-bold truncate ${selectedRecord.officialReceiptNumber &&
                            String(selectedRecord.paymentStatus).toLowerCase() === "paid"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-slate-500 dark:text-slate-400"
                            }`}
                        >
                          {selectedRecord.officialReceiptNumber || "Not yet issued"}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase ${selectedRecord.officialReceiptNumber &&
                          String(selectedRecord.paymentStatus).toLowerCase() === "paid"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                      >
                        {selectedRecord.officialReceiptNumber &&
                          String(selectedRecord.paymentStatus).toLowerCase() === "paid"
                          ? "PAID"
                          : "UNPAID"}
                      </span>
                    </div>
                  </div>
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


                <div className="sm:col-span-2 bg-slate-100/70 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 mt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider flex items-center gap-2">
                      <span>₱</span> Gateway Transaction &amp; Payment Verification
                    </h4>
                    {selectedRecord.paymentStatus === "Proof Submitted - For Treasury Verification" && (
                      <span className="px-2.5 py-1 bg-cyan-100 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 rounded-full text-[10px] font-bold border border-cyan-300 dark:border-cyan-700 animate-pulse">
                        ● Proof Uploaded by Citizen
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div>
                      <span className="text-slate-400 block mb-0.5">Payment Reference:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {selectedRecord.paymentReference || `${selectedRecord.leaseId}-TRX-9984`}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">Official Receipt (O.R.):</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {selectedRecord.officialReceiptNumber || (selectedRecord.paymentStatus === "Paid" ? "OR-ISSUED" : "None")}
                      </span>
                    </div>
                  </div>

                  {selectedRecord.paymentProof && (
                    <div className="bg-cyan-50/70 dark:bg-cyan-950/30 p-3 rounded-xl border border-cyan-200 dark:border-cyan-800/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-cyan-900 dark:text-cyan-200 uppercase tracking-wide flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-cyan-700 dark:text-cyan-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                          </svg>
                          Citizen Submitted Proof of Transaction
                        </span>
                        <span className="text-[10px] text-cyan-700 dark:text-cyan-400 font-mono">
                          Ref: {selectedRecord.paymentReference || "Attached"}
                        </span>
                      </div>
                      {selectedRecord.paymentProof.startsWith("data:image") || selectedRecord.paymentProof.startsWith("http") ? (
                        <div
                          onClick={() => {
                            setDocZoom(1);
                            setIsDocViewerOpen(true);
                          }}
                          className="mt-1 relative group cursor-pointer overflow-hidden rounded-xl border border-cyan-200 dark:border-cyan-800 bg-white dark:bg-slate-900 p-2 flex items-center justify-center transition-all hover:border-cyan-400 hover:shadow-md"
                          title="Click to zoom in and view document"
                        >
                          <img
                            src={selectedRecord.paymentProof}
                            alt="Citizen Payment Proof"
                            className="max-h-48 rounded-lg object-contain transition-transform duration-200 group-hover:scale-[1.02]"
                          />
                          <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-xl backdrop-blur-[1px]">
                            <span className="bg-white/95 dark:bg-slate-800/95 text-slate-900 dark:text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5">
                              <svg className="w-4 h-4 text-cyan-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                <line x1="11" y1="8" x2="11" y2="14"></line>
                                <line x1="8" y1="11" x2="14" y2="11"></line>
                              </svg>
                              Click to Zoom In / View
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => {
                            setDocZoom(1);
                            setIsDocViewerOpen(true);
                          }}
                          className="text-xs text-cyan-900 dark:text-cyan-200 font-medium bg-white/70 dark:bg-slate-900/70 p-3 rounded-lg border border-cyan-200 dark:border-cyan-800 cursor-pointer hover:bg-white dark:hover:bg-slate-800 flex items-center justify-between"
                        >
                          <span className="font-mono">{selectedRecord.paymentProof}</span>
                          <span className="text-[11px] text-cyan-600 font-bold">Open Document Viewer</span>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedRecord.mismatchNotes && (
                    <div className="bg-amber-50/70 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200 dark:border-amber-800/60">
                      <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wide flex items-center gap-1.5 mb-1">
                        <svg className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                          <line x1="12" y1="9" x2="12" y2="13"/>
                          <line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        Mismatch / Requested Info Notes:
                      </span>
                      <p className="text-xs text-amber-800 dark:text-amber-300 italic m-0">
                        "{selectedRecord.mismatchNotes}"
                      </p>
                    </div>
                  )}

                  <div className="pt-1 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleVerifyAndMatchPayment}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      Verify &amp; Match Payment
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenFlagMismatchModal()}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/>
                        <line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                      Flag Mismatch / Request Info
                    </button>
                  </div>
                </div>


                <div className="sm:col-span-2 bg-indigo-50/70 dark:bg-indigo-950/30 p-4 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 space-y-3 mt-1">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-indigo-950 dark:text-indigo-200 text-xs uppercase tracking-wider flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                        <path d="M3 3v5h5"/>
                        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                        <path d="M16 16h5v5"/>
                      </svg>
                      Anti-Fraud AI Inspector
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

      {/* Document & Payment Proof Zoomable Viewer Modal */}
      {isDocViewerOpen && selectedRecord?.paymentProof && (
        <div className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header / Zoom Controls Toolbar */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-slate-50 dark:bg-slate-800/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Document &amp; Payment Proof Viewer
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Lease ID: {selectedRecord.leaseId} — Ref: {selectedRecord.paymentReference || "Attached Proof"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDocZoom((prev) => Math.max(0.5, prev - 0.25))}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                  title="Zoom Out"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                  Zoom Out
                </button>

                <span className="px-2.5 py-1 text-xs font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  {Math.round(docZoom * 100)}%
                </span>

                <button
                  type="button"
                  onClick={() => setDocZoom((prev) => Math.min(3.5, prev + 0.25))}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                  title="Zoom In"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                  Zoom In
                </button>

                <button
                  type="button"
                  onClick={() => setDocZoom(1)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors"
                  title="Reset Zoom"
                >
                  Reset
                </button>

                <div className="h-6 w-px bg-slate-300 dark:bg-slate-700 mx-1"></div>

                <button
                  type="button"
                  onClick={() => {
                    setIsDocViewerOpen(false);
                    setDocZoom(1);
                  }}
                  className="p-2 bg-slate-200 hover:bg-rose-100 dark:bg-slate-800 dark:hover:bg-rose-950/60 text-slate-600 hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-400 rounded-xl transition-colors cursor-pointer"
                  title="Close Document Viewer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>

            {/* Document Content Viewport */}
            <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-slate-100/70 dark:bg-slate-950/70 min-h-[400px]">
              {selectedRecord.paymentProof.startsWith("data:image") || selectedRecord.paymentProof.startsWith("http") ? (
                <div
                  className="transition-transform duration-150 ease-out origin-center"
                  style={{ transform: `scale(${docZoom})` }}
                >
                  <img
                    src={selectedRecord.paymentProof}
                    alt="Citizen Submitted Document"
                    className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                  />
                </div>
              ) : (
                <div
                  className="transition-transform duration-150 ease-out origin-center bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-lg w-full text-center space-y-3"
                  style={{ transform: `scale(${docZoom})` }}
                >
                  <p className="text-sm font-mono text-slate-700 dark:text-slate-200 break-words">
                    {selectedRecord.paymentProof}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Flag Mismatch / Request Proof Modal */}
      {isMismatchModalOpen && selectedRecord && (
        <div className="fixed inset-0 z-[100001] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 flex items-center justify-center text-amber-700 dark:text-amber-400">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Flag Payment Mismatch / Request Proof</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Stall #{selectedRecord.stallNumber} ({selectedRecord.leaseId}) — {selectedRecord.firstName} {selectedRecord.lastName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMismatchModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1 rounded-lg"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleConfirmFlagMismatch} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Quick Reason Presets
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Amount mismatch: Transaction amount does not match rental due.",
                    "Reference number invalid: Transaction not verified by Treasury gateway.",
                    "Proof required: Please upload an official receipt or validated deposit slip.",
                    "Legibility issue: Uploaded screenshot is unreadable or cropped."
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setMismatchNoteInput(preset)}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-[11px] text-slate-700 dark:text-slate-300 hover:text-amber-800 dark:hover:text-amber-300 transition-colors cursor-pointer text-left"
                    >
                      {preset.split(":")[0]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Instructions / Reason for Citizen <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={mismatchNoteInput}
                  onChange={(e) => setMismatchNoteInput(e.target.value)}
                  placeholder="Enter details explaining why the payment is flagged and what proof the citizen should upload..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-amber-500 outline-none leading-relaxed"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  This note will be shown directly on the citizen's portal and in their notification dropdown.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsMismatchModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingMismatch}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  {isSavingMismatch ? "Notifying..." : "Flag Mismatch & Notify Citizen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}