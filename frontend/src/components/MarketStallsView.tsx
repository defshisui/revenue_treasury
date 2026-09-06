import React, { useState, useMemo } from "react";
import type { StallRecord, StallStatus } from "../types/treasury";
import { getLeases, updateLease, deleteLease } from "../services/marketService";
import type { LeaseRecord } from "../services/marketService";

interface Props {
  records?: (StallRecord | LeaseRecord)[];
  isCollapsed?: boolean;
  onUpdateRecord?: (record: any) => void;
  onDeleteRecord?: (id: string) => void;
}

export default function MarketStallsView({
  records: initialRecords = [],
  isCollapsed = false,
  onUpdateRecord,
  onDeleteRecord,
}: Props) {
  const [rawRecords, setRawRecords] = useState<any[]>(initialRecords);

  React.useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      if (initialRecords && initialRecords.length > 0) {
        if (isMounted) setRawRecords(initialRecords);
        return;
      }
      try {
        const storedLeases = await getLeases();
        if (isMounted && storedLeases && storedLeases.length > 0) {
          setRawRecords(storedLeases);
        }
      } catch (err) {
        console.error("Error fetching market data:", err);
      }
    };
    loadData();
    return () => {
      isMounted = false;
    };
  }, [initialRecords]);

  const normalizedInitialStalls: StallRecord[] = useMemo(() => {
    return rawRecords.map((item: any) => {
      const isTerminatedOrInactive = item.leaseStatus === "Terminated" || item.leaseStatus === "Inactive";
      const isOccupied = !isTerminatedOrInactive && item.leaseStatus !== "Archived" && (item.leaseStatus === "Active" || item.leaseStatus === "Termination Requested" || item.status === "Occupied");

      const isPaid = item.paymentStatus === "Paid";
      const currentBalance = isPaid ? 0 : (item.currentBalance ?? item.amountDue ?? 0);
      const overdueStatus = isPaid ? false : (item.paymentStatus === "Pending Payment" || item.overdueStatus || currentBalance > 0);

      return {
        id: item.id || item.leaseId || crypto.randomUUID(),
        stallNumber: item.stallNumber || item.stall_no || "N/A",
        marketBranch: item.marketBranch || item.marketName || "Central Public Market",
        marketSection: item.marketSection || item.section || "General Section",
        sizeSqMeters: item.sizeSqMeters || 12,
        monthlyBaseRate: item.monthlyBaseRate || item.amountDue || 2500,
        status: (isPaid ? "Paid" : isOccupied ? "Occupied" : "Vacant") as StallStatus,
        currentBalance: currentBalance,
        accumulatedPenalty: isPaid ? 0 : (item.accumulatedPenalty || 0),
        overdueStatus: overdueStatus,
        assignedVendorId: isOccupied ? (item.assignedVendorId || item.leaseId) : undefined,
        vendorName: isOccupied ? (item.vendorName || (item.firstName && item.lastName ? `${item.firstName} ${item.lastName}` : undefined)) : undefined,
        vendorContact: item.vendorContact || "N/A",
        paymentHistory: item.paymentHistory || [],
        leaseStatus: item.leaseStatus,
        leaseId: item.leaseId || item.id,
      };
    });
  }, [rawRecords]);

  const [stalls, setStalls] = useState<StallRecord[]>(normalizedInitialStalls);
  const [activeTab, setActiveTab] = useState<"Active" | "Archived">("Active");
  const [selectedBranch, setSelectedBranch] = useState<string>("All");
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const [isAssignLeaseOpen, setIsAssignLeaseOpen] = useState(false);
  const [selectedStall, setSelectedStall] = useState<StallRecord | null>(null);

  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [isSurchargeModalOpen, setIsSurchargeModalOpen] = useState(false);
  const [selectedBillingStallIds, setSelectedBillingStallIds] = useState<string[]>([]);
  const [selectedSurchargeStallIds, setSelectedSurchargeStallIds] = useState<string[]>([]);

  const [leaseForm, setLeaseForm] = useState({
    vendorName: "",
    vendorContact: "",
    tinOrId: "",
    leaseStartDate: new Date().toISOString().slice(0, 10),
  });

  React.useEffect(() => {
    setStalls(normalizedInitialStalls);
  }, [normalizedInitialStalls]);

  const metrics = useMemo(() => {

    const activeStallsList = stalls.filter(s => (s as any).leaseStatus !== "Archived");
    const totalStalls = activeStallsList.length;
    const occupied = activeStallsList.filter((s) => s.status === "Occupied" || s.assignedVendorId).length;
    const vacant = activeStallsList.filter((s) => s.status === "Vacant").length;
    const delinquent = activeStallsList.filter((s) => (s.overdueStatus || s.currentBalance > 0) && s.status !== "Paid").length;
    const totalCollectible = activeStallsList.reduce((acc, curr) => acc + (curr.currentBalance || 0), 0);
    const occupancyRate = totalStalls > 0 ? ((occupied / totalStalls) * 100).toFixed(1) : "0.0";

    return { totalStalls, occupied, vacant, delinquent, totalCollectible, occupancyRate };
  }, [stalls]);

  const availableBillingStalls = useMemo(() => {
    return stalls.filter((s) => (s as any).leaseStatus !== "Archived" && s.status === "Occupied" && s.assignedVendorId);
  }, [stalls]);

  const availableSurchargeStalls = useMemo(() => {
    return stalls.filter((s) => (s as any).leaseStatus !== "Archived" && s.currentBalance > 0);
  }, [stalls]);

  const filteredStalls = useMemo(() => {
    return stalls.filter((stall) => {
      const isArchived = (stall as any).leaseStatus === "Archived";

      if (activeTab === "Active" && isArchived) return false;
      if (activeTab === "Archived" && !isArchived) return false;

      const matchesBranch = selectedBranch === "All" || stall.marketBranch === selectedBranch;
      const isDelinquent = (stall.overdueStatus || stall.currentBalance > 0) && stall.currentBalance > 0 && stall.status !== "Paid";
      const matchesStatus =
        selectedStatus === "All" ||
        (selectedStatus === "Delinquent"
          ? isDelinquent
          : stall.status === selectedStatus);

      const matchesSearch =
        stall.stallNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (stall.vendorName && stall.vendorName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        stall.marketSection.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesBranch && matchesStatus && matchesSearch;
    });
  }, [stalls, selectedBranch, selectedStatus, searchTerm, activeTab]);

  const handleOpenBillingModal = () => {
    const eligibleIds = availableBillingStalls.map((s) => s.id);
    setSelectedBillingStallIds(eligibleIds);
    setIsBillingModalOpen(true);
  };

  const handleOpenSurchargeModal = () => {
    const eligibleIds = availableSurchargeStalls.map((s) => s.id);
    setSelectedSurchargeStallIds(eligibleIds);
    setIsSurchargeModalOpen(true);
  };

  const handleConfirmBatchBilling = async () => {
    if (selectedBillingStallIds.length === 0) {
      alert("Please select at least one stall to generate billing.");
      return;
    }
    const updated = stalls.map(async (stall) => {
      if (selectedBillingStallIds.includes(stall.id)) {
        const newBal = (stall.currentBalance || 0) + (stall.monthlyBaseRate || (stall as any).rentalRate || 0);
        const updatedStall = { ...stall, currentBalance: newBal, overdueStatus: newBal > 0 };
        if (onUpdateRecord) onUpdateRecord(updatedStall);
        else {
          await updateLease({
            leaseId: (stall as any).leaseId || stall.id,
            firstName: stall.vendorName?.split(" ")[0] || "",
            lastName: stall.vendorName?.split(" ").slice(1).join(" ") || "",
            marketName: stall.marketBranch,
            section: stall.marketSection,
            stallNumber: stall.stallNumber,
            leaseStatus: (stall as any).leaseStatus || "Active",
            amountDue: newBal,
            helperApprovalStatus: "Approved",
            advancePaymentStatus: "Paid",
            paymentStatus: "Pending Payment",
          });
        }
        return updatedStall;
      }
      return stall;
    });

    const resolvedStalls = await Promise.all(updated);
    setStalls(resolvedStalls);
    setIsBillingModalOpen(false);
    alert("Monthly stall rental fees successfully posted to selected ledgers.");
  };

  const handleConfirmSurcharges = async () => {
    if (selectedSurchargeStallIds.length === 0) {
      alert("Please select at least one stall to apply surcharges.");
      return;
    }
    const updated = stalls.map(async (stall) => {
      if (selectedSurchargeStallIds.includes(stall.id)) {
        const surcharge = stall.currentBalance * 0.1;
        const newBal = stall.currentBalance + surcharge;
        const updatedStall: StallRecord = {
          ...stall,
          accumulatedPenalty: (stall.accumulatedPenalty || 0) + surcharge,
          currentBalance: newBal,
          overdueStatus: true,
        };
        if (onUpdateRecord) onUpdateRecord(updatedStall);
        else {
          await updateLease({
            leaseId: (stall as any).leaseId || stall.id,
            firstName: stall.vendorName?.split(" ")[0] || "",
            lastName: stall.vendorName?.split(" ").slice(1).join(" ") || "",
            marketName: stall.marketBranch,
            section: stall.marketSection,
            stallNumber: stall.stallNumber,
            leaseStatus: (stall as any).leaseStatus || "Active",
            amountDue: newBal,
            helperApprovalStatus: "Approved",
            advancePaymentStatus: "Paid",
            paymentStatus: "Pending Payment",
          });
        }
        return updatedStall;
      }
      return stall;
    });

    const resolvedStalls = await Promise.all(updated);
    setStalls(resolvedStalls);
    setIsSurchargeModalOpen(false);
    alert("System surcharge applied to selected delinquent stall ledgers.");
  };

  const handleAssignLease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStall) return;

    const names = leaseForm.vendorName.trim().split(" ");
    const firstName = names[0] || "";
    const lastName = names.slice(1).join(" ") || "";
    const leaseId = (selectedStall as any).leaseId || selectedStall.id;

    const updatedLeaseRecord: LeaseRecord = {
      leaseId: leaseId,
      firstName: firstName,
      lastName: lastName,
      marketName: selectedStall.marketBranch,
      section: selectedStall.marketSection,
      stallNumber: selectedStall.stallNumber,
      leaseStatus: "Active",
      amountDue: selectedStall.monthlyBaseRate || 2500,
      helperApprovalStatus: "Approved",
      advancePaymentStatus: "Paid",
      paymentStatus: "Pending Payment",
    };

    await updateLease(updatedLeaseRecord);

    const updated = stalls.map((s) => {
      if (s.id === selectedStall.id) {
        const item: StallRecord = {
          ...s,
          assignedVendorId: `VND-${Math.floor(1000 + Math.random() * 9000)}`,
          vendorName: leaseForm.vendorName,
          vendorContact: leaseForm.vendorContact,
          tinOrId: leaseForm.tinOrId,
          leaseStartDate: leaseForm.leaseStartDate,
          leaseStatus: "Active" as any,
          status: "Occupied" as StallStatus,
        };
        if (onUpdateRecord) onUpdateRecord(item);
        return item;
      }
      return s;
    });

    setStalls(updated);
    setIsAssignLeaseOpen(false);
    setSelectedStall(null);
    setLeaseForm({
      vendorName: "",
      vendorContact: "",
      tinOrId: "",
      leaseStartDate: new Date().toISOString().slice(0, 10),
    });
  };

  const handleTerminateLease = async (stall: StallRecord) => {
    if (confirm(`Terminate active lease for ${stall.vendorName || "vendor"} on Stall ${stall.stallNumber}?`)) {
      const leaseId = (stall as any).leaseId || stall.id;

      try {
        await updateLease({
          leaseId: leaseId,
          firstName: stall.vendorName?.split(" ")[0] || "",
          lastName: stall.vendorName?.split(" ").slice(1).join(" ") || "",
          marketName: stall.marketBranch,
          section: stall.marketSection,
          stallNumber: stall.stallNumber,
          leaseStatus: "Terminated",
          amountDue: stall.currentBalance,
          helperApprovalStatus: "Terminated",
          advancePaymentStatus: "N/A",
          paymentStatus: stall.currentBalance === 0 ? "Paid" : "Pending Payment",
        });
      } catch (err) {
        console.error("Failed to update storage for termination:", err);
      }

      const updated = stalls.map((s) => {
        if (s.id === stall.id) {
          const item: StallRecord = {
            ...s,
            assignedVendorId: undefined,
            vendorName: undefined,
            vendorContact: undefined,
            leaseStatus: "Terminated" as any,
            status: "Vacant" as StallStatus,
          };
          if (onUpdateRecord) onUpdateRecord(item);
          return item;
        }
        return s;
      });
      setStalls(updated);
    }
  };

  const handleWaivePenalty = async (stall: StallRecord) => {
    if (confirm(`Waive penalties for ${stall.stallNumber}?`)) {
      const newBal = Math.max(0, stall.currentBalance - (stall.accumulatedPenalty || 0));

      await updateLease({
        leaseId: (stall as any).leaseId || stall.id,
        firstName: stall.vendorName?.split(" ")[0] || "",
        lastName: stall.vendorName?.split(" ").slice(1).join(" ") || "",
        marketName: stall.marketBranch,
        section: stall.marketSection,
        stallNumber: stall.stallNumber,
        leaseStatus: (stall as any).leaseStatus || "Active",
        amountDue: newBal,
        helperApprovalStatus: "Approved",
        advancePaymentStatus: "Paid",
        paymentStatus: newBal === 0 ? "Paid" : "Pending Payment",
      });

      const updated = stalls.map((s) => {
        if (s.id === stall.id) {
          const item: StallRecord = {
            ...s,
            currentBalance: newBal,
            accumulatedPenalty: 0,
            overdueStatus: newBal > 0,
          };
          if (onUpdateRecord) onUpdateRecord(item);
          return item;
        }
        return s;
      });
      setStalls(updated);
    }
  };

  const handleSoftDeleteStall = async (id: string, stall: StallRecord) => {
    if (confirm("Are you sure you want to move this stall to the Archiver?")) {
      const leaseId = (stall as any).leaseId || id;
      try {
        await updateLease({
          leaseId: leaseId,
          firstName: stall.vendorName?.split(" ")[0] || "",
          lastName: stall.vendorName?.split(" ").slice(1).join(" ") || "",
          marketName: stall.marketBranch,
          section: stall.marketSection,
          stallNumber: stall.stallNumber,
          leaseStatus: "Archived" as any, // FIXED: Type assertion to bypass strict type checking
          amountDue: stall.currentBalance,
          helperApprovalStatus: "Terminated",
          advancePaymentStatus: "N/A",
          paymentStatus: stall.currentBalance === 0 ? "Paid" : "Pending Payment",
        });
        setStalls(stalls.map(s => s.id === id ? { ...s, leaseStatus: "Archived" as any } : s));
      } catch (err) {
        console.error("Failed to archive stall:", err);
      }
    }
  };

  const handleRestoreStall = async (id: string, stall: StallRecord) => {
    if (confirm(`Are you sure you want to restore Stall ${stall.stallNumber} to active records?`)) {
      const leaseId = (stall as any).leaseId || id;
      try {
        await updateLease({
          leaseId: leaseId,
          firstName: stall.vendorName?.split(" ")[0] || "",
          lastName: stall.vendorName?.split(" ").slice(1).join(" ") || "",
          marketName: stall.marketBranch,
          section: stall.marketSection,
          stallNumber: stall.stallNumber,
          leaseStatus: "Inactive", // Sets back to an active record state (Vacant)
          amountDue: stall.currentBalance,
          helperApprovalStatus: "Pending",
          advancePaymentStatus: "N/A",
          paymentStatus: stall.currentBalance === 0 ? "Paid" : "Pending Payment",
        });
        setStalls(stalls.map(s => s.id === id ? { ...s, leaseStatus: "Inactive" as any, status: "Vacant" as StallStatus } : s));
      } catch (err) {
        console.error("Failed to restore stall:", err);
      }
    }
  };

  const handleFinalDeleteStall = async (id: string, stall: StallRecord) => {
    if (confirm("WARNING: Are you sure you want to PERMANENTLY delete this stall? This action will remove it from the database and cannot be undone.")) {
      const leaseId = (stall as any).leaseId || id;
      try {
        await deleteLease(leaseId);
        setStalls(stalls.filter((s) => s.id !== id));
        if (onDeleteRecord) onDeleteRecord(id);
      } catch (err) {
        console.error("Failed to delete stall permanently:", err);
      }
    }
  };

  const handleExportCSV = () => {
    const activeStallsList = stalls.filter(s => (s as any).leaseStatus !== "Archived");
    const headers = ["Stall No", "Branch", "Section", "Status", "Vendor Name", "Base Rate", "Balance Due", "Penalty"];
    const rows = activeStallsList.map((s) => [
      `"${s.stallNumber}"`,
      `"${s.marketBranch}"`,
      `"${s.marketSection}"`,
      `"${s.status}"`,
      `"${s.vendorName || "VACANT"}"`,
      s.monthlyBaseRate || (s as any).rentalRate || 0,
      s.currentBalance || 0,
      s.accumulatedPenalty || (s as any).penalty || 0,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `LGU_Market_Stalls_Masterlist_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      style={{
        marginLeft: isCollapsed ? "80px" : "256px",
        width: isCollapsed ? "calc(100% - 80px)" : "calc(100% - 256px)",
      }}
      className="min-h-screen bg-slate-50/60 dark:bg-slate-950 text-slate-800 dark:text-slate-100 p-6 pt-24 transition-all duration-300 box-border"
    >
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8 bg-white dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse"></span>
            <span className="text-[11px] font-semibold tracking-wider text-blue-600 dark:text-blue-400 uppercase">
              Municipal Treasury Operations
            </span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Market Stall Admin & Lease Management
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Asset Tracking, Stall Allocation & Revenue Auditing Hub
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleOpenBillingModal}
            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs px-4 py-2.5 rounded-xl transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
          >
            Run Monthly Billing
          </button>
          <button
            onClick={handleOpenSurchargeModal}
            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs px-4 py-2.5 rounded-xl transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
          >
            Apply Surcharges
          </button>
          <button
            onClick={handleExportCSV}
            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
          >
            Export Masterlist
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-900/80 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex justify-between items-start">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Registered Stalls</p>
            <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <i className="fa-solid fa-store text-xs"></i>
            </span>
          </div>
          <h4 className="text-2xl font-bold text-slate-900 dark:text-white mt-3">{metrics.totalStalls}</h4>
          <div className="mt-2 text-[11px] text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
            <i className="fa-solid fa-chart-line text-[9px]"></i> {metrics.occupancyRate}% Occupancy Rate
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/80 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex justify-between items-start">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Occupied / Leased</p>
            <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <i className="fa-solid fa-circle-check text-xs"></i>
            </span>
          </div>
          <h4 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-3">{metrics.occupied}</h4>
          <p className="mt-2 text-[11px] text-slate-400">Active lease accounts</p>
        </div>

        <div className="bg-white dark:bg-slate-900/80 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex justify-between items-start">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Vacant & Ready</p>
            <span className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <i className="fa-solid fa-door-open text-xs"></i>
            </span>
          </div>
          <h4 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-3">{metrics.vacant}</h4>
          <p className="mt-2 text-[11px] text-slate-400">Available for assignment</p>
        </div>

        <div className="bg-white dark:bg-slate-900/80 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex justify-between items-start">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Delinquent Accounts</p>
            <span className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
              <i className="fa-solid fa-triangle-exclamation text-xs"></i>
            </span>
          </div>
          <h4 className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-3">{metrics.delinquent}</h4>
          <p className="mt-2 text-[11px] text-slate-400">Requires treasury notice</p>
        </div>

        <div className="bg-white dark:bg-slate-900/80 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs sm:col-span-2 lg:col-span-1">
          <div className="flex justify-between items-start">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Receivables</p>
            <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <i className="fa-solid fa-peso-sign text-xs"></i>
            </span>
          </div>
          <h4 className="text-xl font-bold text-slate-900 dark:text-white mt-3 truncate">
            ₱{metrics.totalCollectible.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </h4>
          <p className="mt-2 text-[11px] text-slate-400">Outstanding balance</p>
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
          <i className="fa-solid fa-list-check mr-1.5"></i> Active Stalls
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
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <i className={`fa-solid ${activeTab === "Active" ? "fa-building-columns text-blue-600" : "fa-box-archive text-slate-500"} text-sm`}></i>
            {activeTab === "Active" ? "Master Market Stall Directory" : "Archived Stalls Database"}
          </h3>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="relative flex-1 sm:w-72">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <i className="fa-solid fa-magnifying-glass text-xs"></i>
              </span>
              <input
                type="text"
                placeholder="Search stall #, vendor name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>

            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="All">All Market Branches</option>
              <option value="Central Public Market">Central Public Market</option>
              <option value="Galas City-Owned Market">Galas City-Owned Market</option>
              <option value="Kamuning City-Owned Market">Kamuning City-Owned Market</option>
              <option value="Murphy City-owned Market">Murphy City-owned Market</option>
              <option value="Project 2 City-Owned Market">Project 2 City-Owned Market</option>
              <option value="Project 4 City-Owned Market (New)">Project 4 City-Owned Market (New)</option>
              <option value="R.A. Calalay City-Owned Market - Temporary">R.A. Calalay City-Owned Market - Temporary</option>
              <option value="Roxas City-Owned Market">Roxas City-Owned Market</option>
              <option value="San Jose City-Owned Market">San Jose City-Owned Market</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Occupied">Occupied</option>
              <option value="Vacant">Vacant</option>
              <option value="Delinquent">Delinquent / Overdue</option>
              <option value="Maintenance">Maintenance</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
          <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-4">Stall Details</th>
                <th className="p-4">Assigned Leaseholder</th>
                <th className="p-4">Branch & Section</th>
                <th className="p-4 text-right">Base Monthly Rate</th>
                <th className="p-4 text-right">Current Balance</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Admin Ledger Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              {filteredStalls.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-400 italic">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mb-1">
                        <i className={`fa-solid ${activeTab === "Active" ? "fa-folder-open" : "fa-box-archive"} text-xl`}></i>
                      </div>
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        {activeTab === "Active" ? "No active stall records found" : "No archived stalls found"}
                      </p>
                      <p className="text-[11px] text-slate-400">Try checking your search keyword or filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStalls.map((stall) => (
                  <tr key={stall.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-4 font-mono font-bold text-slate-900 dark:text-white">
                      {stall.stallNumber}
                      <p className="text-[11px] font-sans font-normal text-slate-400 mt-0.5">
                        Size: {stall.sizeSqMeters || 10} sq meters
                      </p>
                    </td>

                    <td className="p-4">
                      {stall.vendorName ? (
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">{stall.vendorName}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{stall.vendorContact || (stall as any).contactNumber || "No Contact"}</p>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span> UNASSIGNED / VACANT
                        </span>
                      )}
                    </td>

                    <td className="p-4">
                      <p className="font-medium text-slate-800 dark:text-slate-200">{stall.marketBranch}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{stall.marketSection}</p>
                    </td>

                    <td className="p-4 text-right font-mono font-medium text-slate-900 dark:text-slate-100">
                      ₱{(stall.monthlyBaseRate || (stall as any).rentalRate || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </td>

                    <td className="p-4 text-right">
                      <span className={`font-mono font-bold ${stall.currentBalance > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600"}`}>
                        ₱{(stall.currentBalance || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </span>
                      {(stall.accumulatedPenalty || 0) > 0 && (
                        <p className="text-[10px] text-rose-500 font-medium mt-0.5">
                          Incl. ₱{(stall.accumulatedPenalty || 0).toLocaleString("en-PH")} Surcharge
                        </p>
                      )}
                    </td>

                    <td className="p-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border ${activeTab === "Archived"
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700"
                          : (stall.overdueStatus || stall.status === "Delinquent") && stall.currentBalance > 0 && stall.status !== "Paid"
                            ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900"
                            : stall.status === "Occupied"
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900"
                              : stall.status === "Paid"
                                ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900"
                                : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900"
                          }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${activeTab === "Archived" ? "bg-slate-500" :
                          (stall.overdueStatus || stall.status === "Delinquent") && stall.currentBalance > 0 && stall.status !== "Paid" ? "bg-rose-500" :
                            stall.status === "Occupied" ? "bg-emerald-500" : stall.status === "Paid" ? "bg-indigo-500" : "bg-amber-500"
                          }`}></span>
                        {activeTab === "Archived" ? "Archived" : (stall.overdueStatus || stall.status === "Delinquent") && stall.currentBalance > 0 && stall.status !== "Paid" ? "Delinquent" : stall.status}
                      </span>
                    </td>

                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {activeTab === "Active" ? (
                          <>
                            {!stall.assignedVendorId ? (
                              <button
                                onClick={() => {
                                  setSelectedStall(stall);
                                  setIsAssignLeaseOpen(true);
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-3.5 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                              >
                                <i className="fa-solid fa-file-contract text-[10px]"></i> Assign
                              </button>
                            ) : (
                              <button
                                onClick={() => handleTerminateLease(stall)}
                                className="bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 font-medium px-3.5 py-1.5 rounded-xl transition-all cursor-pointer border border-rose-200 dark:border-rose-900 flex items-center gap-1.5"
                              >
                                <i className="fa-solid fa-ban text-[10px]"></i> Terminate
                              </button>
                            )}

                            {(stall.accumulatedPenalty || 0) > 0 && (
                              <button
                                onClick={() => handleWaivePenalty(stall)}
                                className="bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 font-medium px-3 py-1.5 rounded-xl transition-all cursor-pointer border border-amber-200 dark:border-amber-900 flex items-center gap-1"
                                title="Waive Penalty"
                              >
                                <i className="fa-solid fa-percent text-[10px]"></i> Waive
                              </button>
                            )}

                            <button
                              onClick={() => handleSoftDeleteStall(stall.id, stall)}
                              className="bg-slate-100 hover:bg-slate-200 hover:text-slate-800 text-slate-500 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 font-medium px-3 py-1.5 rounded-xl transition-all cursor-pointer border border-slate-200/80 dark:border-slate-700 flex items-center gap-1.5"
                              title="Archive Stall"
                            >
                              <i className="fa-solid fa-box-archive text-[11px]"></i>
                              <span>Archive</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleRestoreStall(stall.id, stall)}
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-medium px-3.5 py-1.5 rounded-xl transition-all cursor-pointer border border-emerald-200 dark:border-emerald-900 flex items-center gap-1.5"
                            >
                              <i className="fa-solid fa-rotate-left text-[10px]"></i> Restore
                            </button>
                            <button
                              onClick={() => handleFinalDeleteStall(stall.id, stall)}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 font-medium px-3.5 py-1.5 rounded-xl transition-all cursor-pointer border border-rose-200 dark:border-rose-900 flex items-center gap-1.5"
                            >
                              <i className="fa-solid fa-trash-can text-[10px]"></i> Delete (Final)
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
      </section>


      {isBillingModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-8 shadow-2xl border border-slate-200 dark:border-slate-800 my-8">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Run Monthly Treasury Assessment
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Select available active stalls to generate monthly rental fees</p>
            </div>

            <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
              <span>Showing {availableBillingStalls.length} available active stall(s)</span>
              <button
                type="button"
                onClick={() => {
                  if (selectedBillingStallIds.length === availableBillingStalls.length) {
                    setSelectedBillingStallIds([]);
                  } else {
                    setSelectedBillingStallIds(availableBillingStalls.map((s) => s.id));
                  }
                }}
                className="text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
              >
                {selectedBillingStallIds.length === availableBillingStalls.length ? "Deselect All" : "Select All"}
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
              {availableBillingStalls.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 italic">No available active stalls found for billing.</div>
              ) : (
                availableBillingStalls.map((stall) => {
                  const isChecked = selectedBillingStallIds.includes(stall.id);
                  return (
                    <label key={stall.id} className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer text-xs">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedBillingStallIds([...selectedBillingStallIds, stall.id]);
                            } else {
                              setSelectedBillingStallIds(selectedBillingStallIds.filter((id) => id !== stall.id));
                            }
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                        />
                        <div>
                          <p className="font-mono font-bold text-slate-900 dark:text-white">{stall.stallNumber} - {stall.vendorName}</p>
                          <p className="text-[11px] text-slate-400">{stall.marketBranch} ({stall.marketSection})</p>
                        </div>
                      </div>
                      <div className="text-right font-mono font-medium text-slate-900 dark:text-white">
                        ₱{(stall.monthlyBaseRate || (stall as any).rentalRate || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex justify-end gap-3 pt-5 border-t border-slate-100 dark:border-slate-800 mt-6">
              <button
                type="button"
                onClick={() => setIsBillingModalOpen(false)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBatchBilling}
                className="px-5 py-2.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-500/20 cursor-pointer transition-all"
              >
                Post Billing ({selectedBillingStallIds.length} Selected)
              </button>
            </div>
          </div>
        </div>
      )}


      {isSurchargeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-8 shadow-2xl border border-slate-200 dark:border-slate-800 my-8">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Apply 10% Standard Late Surcharge
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Select available delinquent stalls with outstanding balances</p>
            </div>

            <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
              <span>Showing {availableSurchargeStalls.length} available delinquent stall(s)</span>
              <button
                type="button"
                onClick={() => {
                  if (selectedSurchargeStallIds.length === availableSurchargeStalls.length) {
                    setSelectedSurchargeStallIds([]);
                  } else {
                    setSelectedSurchargeStallIds(availableSurchargeStalls.map((s) => s.id));
                  }
                }}
                className="text-rose-600 dark:text-rose-400 font-semibold hover:underline cursor-pointer"
              >
                {selectedSurchargeStallIds.length === availableSurchargeStalls.length ? "Deselect All" : "Select All"}
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
              {availableSurchargeStalls.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 italic">No available delinquent stalls found with outstanding balances.</div>
              ) : (
                availableSurchargeStalls.map((stall) => {
                  const isChecked = selectedSurchargeStallIds.includes(stall.id);
                  return (
                    <label key={stall.id} className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer text-xs">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSurchargeStallIds([...selectedSurchargeStallIds, stall.id]);
                            } else {
                              setSelectedSurchargeStallIds(selectedSurchargeStallIds.filter((id) => id !== stall.id));
                            }
                          }}
                          className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 h-4 w-4"
                        />
                        <div>
                          <p className="font-mono font-bold text-slate-900 dark:text-white">{stall.stallNumber} - {stall.vendorName || "Active Lease"}</p>
                          <p className="text-[11px] text-slate-400">{stall.marketBranch}</p>
                        </div>
                      </div>
                      <div className="text-right font-mono font-medium text-rose-600 dark:text-rose-400">
                        Balance: ₱{(stall.currentBalance || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        <p className="text-[10px] text-slate-400">Surcharge: +₱{((stall.currentBalance || 0) * 0.1).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p>
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex justify-end gap-3 pt-5 border-t border-slate-100 dark:border-slate-800 mt-6">
              <button
                type="button"
                onClick={() => setIsSurchargeModalOpen(false)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSurcharges}
                className="px-5 py-2.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md shadow-rose-500/20 cursor-pointer transition-all"
              >
                Apply Surcharges ({selectedSurchargeStallIds.length} Selected)
              </button>
            </div>
          </div>
        </div>
      )}

      {isAssignLeaseOpen && selectedStall && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-8 shadow-2xl border border-slate-200 dark:border-slate-800 my-8">
            <div className="mb-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Assign Vendor Lease</h3>
            </div>
            <p className="text-xs text-slate-400 mb-6">
              Stall Code: <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{selectedStall.stallNumber}</span>
            </p>

            <form onSubmit={handleAssignLease} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Vendor Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Juan De La Cruz"
                  value={leaseForm.vendorName}
                  onChange={(e) => setLeaseForm({ ...leaseForm, vendorName: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Contact Number *</label>
                <input
                  type="text"
                  required
                  placeholder="0917XXXXXXX"
                  value={leaseForm.vendorContact}
                  onChange={(e) => setLeaseForm({ ...leaseForm, vendorContact: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">TIN / Government ID No. *</label>
                <input
                  type="text"
                  required
                  placeholder="TIN-000-123-456"
                  value={leaseForm.tinOrId}
                  onChange={(e) => setLeaseForm({ ...leaseForm, tinOrId: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Lease Effectivity Date *</label>
                <input
                  type="date"
                  required
                  value={leaseForm.leaseStartDate}
                  onChange={(e) => setLeaseForm({ ...leaseForm, leaseStartDate: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setIsAssignLeaseOpen(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md shadow-emerald-500/20 cursor-pointer transition-all"
                >
                  Approve & Issue Lease
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}