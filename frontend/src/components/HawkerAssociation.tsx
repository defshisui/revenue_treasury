// src/components/HawkerAssociation.tsx
import React, { useState, useMemo } from "react";
import type { HawkerAssociationRecord, HawkerAssociationStatus } from "../types/treasury";
import { API_BASE_URL } from '../config/api';

// NEW: Define the structure for the Digital Vault Documents
export interface HawkerDocument {
  id: string;
  document_type: string;
  file_url: string;
  file_name: string;
  mime_type: string;
  status: string;
}

interface LguExtensionMeta {
  marketZone?: string;
  assignedStallCount?: number;
  uploadedDocuments?: HawkerDocument[];
  feesPaid: boolean;
  orNumber?: string;
  violationsCount: number;
  auditTrail: { timestamp: string; admin: string; action: string }[];
}

type ExtendedHawkerRecord = HawkerAssociationRecord & { lguMeta: LguExtensionMeta };

interface Props {
  records?: HawkerAssociationRecord[];
  isCollapsed?: boolean;
  onUpdateRecord?: (record: HawkerAssociationRecord) => void;
  onDeleteRecord?: (id: string) => void;
}

const INITIAL_MOCK_DATA: HawkerAssociationRecord[] = [];

const MARKET_ZONES = [
  "Cubao Farmers Market Zone",
  "Novaliches Proper Market Zone",
  "Balintawak Agro-Industrial Zone",
  "Project 4 Market Hub",
  "Commonwealth Avenue Vending Strip",
  "Welcome Rotonda Stall Area",
];

// Moved outside the component to allow use during state initialization
const enrichWithLguMeta = (item: any): ExtendedHawkerRecord => ({
  ...item,
  lguMeta: item.lguMeta || {
    marketZone: MARKET_ZONES[Math.floor(Math.random() * MARKET_ZONES.length)],
    assignedStallCount: Math.floor(10 + Math.random() * 40),
    // Map existing documents or inject mock data for visual testing if empty
    uploadedDocuments: item.lguMeta?.uploadedDocuments || item.uploadedDocuments || [
      {
        id: crypto.randomUUID(),
        document_type: "SEC_DTI_PERMIT",
        file_url: "https://placehold.co/600x400/png?text=SEC+Permit+Preview",
        file_name: "sec_permit_2026.png",
        mime_type: "image/png",
        status: "VERIFIED"
      },
      {
        id: crypto.randomUUID(),
        document_type: "MEMBER_ROSTER",
        file_url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        file_name: "member_list.pdf",
        mime_type: "application/pdf",
        status: "PENDING"
      },
      {
        id: crypto.randomUUID(),
        document_type: "BARANGAY_CLEARANCE",
        file_url: "https://placehold.co/400x600/jpeg?text=Clearance",
        file_name: "brgy_clearance.jpg",
        mime_type: "image/jpeg",
        status: "VERIFIED"
      }
    ],
    feesPaid: item.status === "Approved",
    orNumber: item.status === "Approved" ? `OR-${Math.floor(100000 + Math.random() * 900000)}` : undefined,
    violationsCount: 0,
    auditTrail: [
      {
        timestamp: item.submissionDate || new Date().toISOString().slice(0, 10),
        admin: item.submittedBy || "Citizen Portal",
        action: "Application Submitted / Initialized",
      },
    ],
  },
});

export default function HawkerAssociation({
  records: initialRecords = INITIAL_MOCK_DATA,
  isCollapsed = false,
  onUpdateRecord,
  onDeleteRecord,
}: Props) {
  // Main State
  const [associations, setAssociations] = useState<ExtendedHawkerRecord[]>(() =>
    initialRecords.map(enrichWithLguMeta)
  );

  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"details" | "documents" | "compliance" | "audit">("details");

  // Modals & Detail Drawer States
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ExtendedHawkerRecord | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<HawkerAssociationStatus>("Approved");
  const [reviewRemarks, setReviewRemarks] = useState("");
  const [inspectionNote, setInspectionNote] = useState("");

  // New Manual Admin Registration Form State with LGU fields
  const [newForm, setNewForm] = useState({
    associationNumber: `HA-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    associationName: "",
    secRegistrationNo: "",
    dateIssued: "",
    contactNumber: "",
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    marketZone: MARKET_ZONES[0],
    assignedStallCount: 15,
    submittedBy: "System Administrator (Walk-in)",
    submitterEmail: "admin.market@quezoncity.gov.ph",
  });

  // Fetch submitted applications from Backend API / LocalStorage
  const fetchApplications = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/hawkers`);
      if (response.ok) {
        const data = await response.json();
        const mappedRecords: ExtendedHawkerRecord[] = data.map((item: any) => enrichWithLguMeta({
          id: item.id || crypto.randomUUID(),
          associationNumber: item.associationNumber,
          associationName: item.associationName,
          secRegistrationNo: item.secRegistrationNo || undefined,
          dateIssued: item.dateIssued || undefined,
          contactNumber: item.contactNumber,
          chairperson: {
            firstName: item.chairperson?.firstName || "",
            middleName: item.chairperson?.middleName || "",
            lastName: item.chairperson?.lastName || "",
            email: item.chairperson?.email || "",
          },
          submittedBy: item.submittedBy || "Citizen Applicant",
          submitterEmail: item.submitterEmail || item.chairperson?.email || "",
          submissionDate: item.submissionDate || new Date().toISOString().slice(0, 10),
          status: item.status || "New",
          memberCount: item.memberCount || 25,
          ...item,
        }));

        setAssociations((prev) => {
          const existingIds = new Set(prev.map(p => p.id));
          const newItems = mappedRecords.filter((m) => !existingIds.has(m.id));
          return [...newItems, ...prev];
        });
        return;
      }
    } catch (error) {
      console.warn("Backend API unreachable, utilizing local storage:", error);
    }

    const savedApplications = localStorage.getItem("hawker_applications");
    if (savedApplications) {
      try {
        const parsed = JSON.parse(savedApplications);
        const mappedRecords: ExtendedHawkerRecord[] = parsed.map((item: any) => enrichWithLguMeta({
          id: item.id || crypto.randomUUID(),
          associationNumber: item.associationNumber,
          associationName: item.associationName,
          secRegistrationNo: item.secRegistrationNo || undefined,
          dateIssued: item.dateIssued || undefined,
          contactNumber: item.contactNumber,
          chairperson: {
            firstName: item.chairperson?.firstName || "",
            middleName: item.chairperson?.middleName || "",
            lastName: item.chairperson?.lastName || "",
            email: item.chairperson?.email || "",
          },
          submittedBy: item.submittedBy || "Citizen Applicant",
          submitterEmail: item.submitterEmail || item.chairperson?.email || "",
          submissionDate: item.submissionDate || new Date().toISOString().slice(0, 10),
          status: item.status || "New",
          memberCount: 20,
        }));

        setAssociations((prev) => {
          const existingIds = new Set(prev.map(p => p.id));
          const newItems = mappedRecords.filter((m) => !existingIds.has(m.id));
          return [...newItems, ...prev];
        });
      } catch (err) {
        console.error("Failed parsing local storage hawker records:", err);
      }
    }
  };

  React.useEffect(() => {
    fetchApplications();
  }, []);

  // Executive LGU Metrics
  const metrics = useMemo(() => {
    const total = associations.length;
    const pending = associations.filter((a) => a.status === "New" || a.status === "Under Review").length;
    const approved = associations.filter((a) => a.status === "Approved").length;
    const rejected = associations.filter((a) => a.status === "Rejected").length;
    const totalStalls = associations.reduce((acc, curr) => acc + (curr.lguMeta?.assignedStallCount || 0), 0);

    return { total, pending, approved, rejected, totalStalls };
  }, [associations]);

  // Filter Data List
  const filteredAssociations = useMemo(() => {
    return associations.filter((item) => {
      const matchesStatus = selectedStatus === "All" || item.status === selectedStatus;
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        item.associationName.toLowerCase().includes(searchLower) ||
        item.associationNumber.toLowerCase().includes(searchLower) ||
        `${item.chairperson.firstName} ${item.chairperson.lastName}`.toLowerCase().includes(searchLower) ||
        item.submittedBy.toLowerCase().includes(searchLower) ||
        (item.lguMeta?.marketZone || "").toLowerCase().includes(searchLower);

      return matchesStatus && matchesSearch;
    });
  }, [associations, selectedStatus, searchTerm]);

  // Create Walk-in Record
  const handleCreateAssociation = async (e: React.FormEvent) => {
    e.preventDefault();
    const newRecord: ExtendedHawkerRecord = enrichWithLguMeta({
      id: crypto.randomUUID(),
      associationNumber: newForm.associationNumber,
      associationName: newForm.associationName,
      secRegistrationNo: newForm.secRegistrationNo || undefined,
      dateIssued: newForm.dateIssued || undefined,
      contactNumber: newForm.contactNumber,
      chairperson: {
        firstName: newForm.firstName,
        middleName: newForm.middleName,
        lastName: newForm.lastName,
        email: newForm.email,
      },
      submittedBy: newForm.submittedBy,
      submitterEmail: newForm.submitterEmail,
      submissionDate: new Date().toISOString().slice(0, 10),
      status: "Approved",
      memberCount: 30,
      lguMeta: {
        marketZone: newForm.marketZone,
        assignedStallCount: Number(newForm.assignedStallCount),
        feesPaid: true,
        orNumber: `OR-${Math.floor(100000 + Math.random() * 900000)}`,
        violationsCount: 0,
        auditTrail: [
          {
            timestamp: new Date().toISOString().slice(0, 10),
            admin: "System Administrator (Walk-in)",
            action: "Walk-in manual registration created and approved directly.",
          },
        ],
      },
    });

    try {
      await fetch(`${API_BASE_URL}/api/hawkers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecord),
      });
    } catch (err) {
      console.warn("Backend server offline, saved locally.");
    }

    setAssociations([newRecord, ...associations]);
    setIsRegisterOpen(false);
    setNewForm({
      associationNumber: `HA-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      associationName: "",
      secRegistrationNo: "",
      dateIssued: "",
      contactNumber: "",
      firstName: "",
      middleName: "",
      lastName: "",
      email: "",
      marketZone: MARKET_ZONES[0],
      assignedStallCount: 15,
      submittedBy: "System Administrator (Walk-in)",
      submitterEmail: "admin.market@quezoncity.gov.ph",
    });
  };

  // Update Status & Audit Trail
  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;

    const auditEntry = {
      timestamp: new Date().toISOString().slice(0, 10),
      admin: "Market Admin Officer",
      action: `Status changed to ${reviewStatus}. Remarks: ${reviewRemarks || "None"}`,
    };

    let itemToUpdate: ExtendedHawkerRecord | null = null;

    const updated = associations.map((item) => {
      if (item.id === selectedRecord.id) {
        const updatedItem: ExtendedHawkerRecord = {
          ...item,
          status: reviewStatus,
          remarks: reviewRemarks,
          lguMeta: {
            ...item.lguMeta,
            feesPaid: reviewStatus === "Approved" ? true : item.lguMeta.feesPaid,
            orNumber: reviewStatus === "Approved" && !item.lguMeta.orNumber ? `OR-${Math.floor(100000 + Math.random() * 900000)}` : item.lguMeta.orNumber,
            auditTrail: [auditEntry, ...item.lguMeta.auditTrail],
          },
        };
        itemToUpdate = updatedItem;
        if (onUpdateRecord) onUpdateRecord(updatedItem);
        return updatedItem;
      }
      return item;
    });

    setAssociations(updated);

    // Update the backend so the user sees it immediately
    if (itemToUpdate) {
      try {
        await fetch(`${API_BASE_URL}/api/hawkers/${selectedRecord.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(itemToUpdate),
        });
      } catch (err) {
        console.warn("Backend update failed, saved locally:", err);
      }
    }

    setIsReviewModalOpen(false);
    setSelectedRecord(null);
    setReviewRemarks("");
  };

  // Add Inspector Violation Notice
  const handleAddViolation = async () => {
    if (!selectedRecord || !inspectionNote.trim()) return;

    const auditEntry = {
      timestamp: new Date().toISOString().slice(0, 10),
      admin: "LGU Market Inspector",
      action: `Violation Citation Issued: ${inspectionNote}`,
    };

    let itemToUpdate: ExtendedHawkerRecord | null = null;

    const updated = associations.map((item) => {
      if (item.id === selectedRecord.id) {
        const updatedItem = {
          ...item,
          lguMeta: {
            ...item.lguMeta,
            violationsCount: item.lguMeta.violationsCount + 1,
            auditTrail: [auditEntry, ...item.lguMeta.auditTrail],
          },
        };
        itemToUpdate = updatedItem;
        setSelectedRecord(updatedItem);
        return updatedItem;
      }
      return item;
    });

    setAssociations(updated);

    // Update backend violation count
    if (itemToUpdate) {
      try {
        await fetch(`${API_BASE_URL}/api/hawkers/${selectedRecord.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(itemToUpdate),
        });
      } catch (err) {
        console.warn("Backend update failed, saved locally:", err);
      }
    }

    setInspectionNote("");
  };

  // ROBUST DATABASE DELETION
  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this hawker association registry? This will permanently remove the record from the database.")) {

      // Optimistically remove from UI
      const updated = associations.filter((item) => item.id !== id);
      setAssociations(updated);

      try {
        const response = await fetch(`${API_BASE_URL}/api/hawkers/${id}`, { method: 'DELETE' });

        if (!response.ok) {
          throw new Error("Failed to delete from database");
        }

        if (onDeleteRecord) onDeleteRecord(id);
      } catch (err) {
        console.error("Delete failed:", err);
        alert("Failed to delete record from the database. Restoring view.");
        // If DB deletion fails, restore the list by fetching again
        fetchApplications();
      }
    }
  };

  const handleExportCSV = () => {
    const headers = ["Association No", "Association Name", "Market Zone", "Stalls", "Chairperson", "Contact", "OR Number", "Violations", "Status"];
    const rows = associations.map((a) => [
      `"${a.associationNumber}"`,
      `"${a.associationName}"`,
      `"${a.lguMeta?.marketZone || "N/A"}"`,
      a.lguMeta?.assignedStallCount || 0,
      `"${a.chairperson.firstName} ${a.chairperson.lastName}"`,
      `"${a.contactNumber}"`,
      `"${a.lguMeta?.orNumber || "Unpaid"}"`,
      a.lguMeta?.violationsCount || 0,
      a.status,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `QC_Market_Hawker_Associations_Audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className={`
        min-h-screen bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 p-6 pt-24
        transition-all duration-300 ${isCollapsed ? "ml-20" : "ml-64"}
      `}
    >
      {/* TOP HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8 bg-white dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse"></span>
            <span className="text-[11px] font-semibold tracking-wider text-blue-600 dark:text-blue-400 uppercase">
              Market Development & Administration Department (MDAD)
            </span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Hawker Association Governance & LGU Compliance Hub
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Zoning Accreditation, Document Vault, Fee Licensing & Violation Enforcement
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsRegisterOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-2"
          >
            <i className="fa-solid fa-plus text-[10px]"></i>New Guild Registration
          </button>
          <button
            onClick={fetchApplications}
            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs px-4 py-2.5 rounded-xl transition-all border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center gap-2"
          >
            <i className="fa-solid fa-rotate text-[10px]"></i> Sync Database
          </button>
          <button
            onClick={handleExportCSV}
            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
          >
            Export COA Audit CSV
          </button>
        </div>
      </div>

      {/* EXECUTIVE LGU METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-white dark:bg-slate-900/85 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Total Registered Guilds</p>
          <h4 className="text-2xl font-bold text-slate-900 dark:text-white mt-3">{metrics.total}</h4>
          <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1 font-medium">{metrics.totalStalls} Vending Stalls Allocated</p>
        </div>
        <div className="bg-white dark:bg-slate-900/85 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Pending Approvals</p>
          <h4 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-3">{metrics.pending}</h4>
          <p className="text-[10px] text-slate-400 mt-1">Requires document check</p>
        </div>
        <div className="bg-white dark:bg-slate-900/85 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Accredited & Active</p>
          <h4 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-3">{metrics.approved}</h4>
          <p className="text-[10px] text-slate-400 mt-1">Compliant with LGU code</p>
        </div>
        <div className="bg-white dark:bg-slate-900/85 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Rejected / Suspended</p>
          <h4 className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-3">{metrics.rejected}</h4>
          <p className="text-[10px] text-slate-400 mt-1">Permits withheld</p>
        </div>
        <div className="bg-white dark:bg-slate-900/85 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs sm:col-span-2 lg:col-span-1">
          <p className="text-xs text-slate-500 font-medium">Treasury Fee Collection</p>
          <h4 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-3">
            {metrics.total > 0 ? `${((associations.filter(a => a.lguMeta?.feesPaid).length / metrics.total) * 100).toFixed(0)}%` : "0%"}
          </h4>
          <p className="text-[10px] text-slate-400 mt-1">Annual dues paid</p>
        </div>
      </div>

      {/* DIRECTORY TABLE */}
      <section className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <i className="fa-solid fa-map-location-dot text-blue-600 text-sm"></i> Market Zones & Association Masterlist
          </h3>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="relative flex-1 sm:w-80">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <i className="fa-solid fa-magnifying-glass text-xs"></i>
              </span>
              <input
                type="text"
                placeholder="Search association, zone, chairperson..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="New">New Submissions</option>
              <option value="Under Review">Under Review</option>
              <option value="Approved">Approved / Active</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
          <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-4">Reference No.</th>
                <th className="p-4">Association & Market Zone</th>
                <th className="p-4">Chairperson</th>
                <th className="p-4">Treasury / OR</th>
                <th className="p-4 text-center">Violations</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Actions / Vault</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              {filteredAssociations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-400 italic">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mb-1">
                        <i className="fa-solid fa-folder-open text-xl"></i>
                      </div>
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-300">No matching association records found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAssociations.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {item.associationNumber}
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-slate-900 dark:text-white">{item.associationName}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        <i className="fa-solid fa-location-pin text-rose-500"></i> {item.lguMeta?.marketZone || "General Market"} ({item.lguMeta?.assignedStallCount || 0} stalls)
                      </p>
                    </td>
                    <td className="p-4">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {item.chairperson.firstName} {item.chairperson.lastName}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{item.contactNumber}</p>
                    </td>
                    <td className="p-4">
                      {item.lguMeta?.feesPaid ? (
                        <div>
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                            <i className="fa-solid fa-receipt text-[10px]"></i> {item.lguMeta.orNumber}
                          </span>
                          <p className="text-[10px] text-slate-400">Annual Dues Paid</p>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                          <i className="fa-solid fa-triangle-exclamation text-[10px]"></i> Unpaid Dues
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${(item.lguMeta?.violationsCount || 0) > 0 ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        }`}>
                        {item.lguMeta?.violationsCount || 0} Citations
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border ${item.status === "Approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        item.status === "New" ? "bg-blue-50 text-blue-700 border-blue-200" :
                          item.status === "Under Review" ? "bg-amber-50 text-amber-700 border-amber-200" :
                            "bg-rose-50 text-rose-700 border-rose-200"
                        }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedRecord(item);
                            setReviewStatus(item.status === "New" ? "Approved" : item.status);
                            setActiveTab("details");
                            setIsReviewModalOpen(true);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-3.5 py-1.5 rounded-xl cursor-pointer shadow-xs flex items-center gap-1"
                        >
                          <i className="fa-solid fa-folder-tree text-[10px]"></i> Vault & Review
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500 dark:bg-slate-800 dark:text-slate-400 font-medium px-3 py-1.5 rounded-xl cursor-pointer border border-slate-200 dark:border-slate-700"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* MODAL: ADVANCED LGU REVIEW & DOCUMENT VAULT DRAWER */}
      {isReviewModalOpen && selectedRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full p-8 shadow-2xl border border-slate-200 dark:border-slate-800 my-8">
            <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">LGU Municipal Review & Compliance Vault</h3>
                <p className="text-xs text-slate-400 mt-0.5">Reference ID: <span className="font-mono text-blue-600 font-bold">{selectedRecord.associationNumber}</span></p>
              </div>
              <button onClick={() => setIsReviewModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            {/* Modal Tabs Header */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6 gap-6 text-xs font-semibold overflow-x-auto whitespace-nowrap">
              <button
                type="button"
                onClick={() => setActiveTab("details")}
                className={`pb-3 border-b-2 cursor-pointer transition-colors ${activeTab === "details" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400"}`}
              >
                1. Status & Licensing
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("documents")}
                className={`pb-3 border-b-2 cursor-pointer transition-colors ${activeTab === "documents" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400"}`}
              >
                2. Digital Vault (Docs)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("compliance")}
                className={`pb-3 border-b-2 cursor-pointer transition-colors ${activeTab === "compliance" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400"}`}
              >
                3. Market Inspections
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("audit")}
                className={`pb-3 border-b-2 cursor-pointer transition-colors ${activeTab === "audit" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400"}`}
              >
                4. COA Audit Trail
              </button>
            </div>

            {/* TAB 1: DETAILS & STATUS */}
            {activeTab === "details" && (
              <form onSubmit={handleUpdateStatus} className="space-y-4 text-xs">
                <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-4 space-y-2 border border-slate-200 dark:border-slate-800">
                  <div className="flex justify-between"><span className="text-slate-500">Association:</span><span className="font-bold text-slate-900 dark:text-white">{selectedRecord.associationName}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Market Zone:</span><span className="font-semibold text-blue-600">{selectedRecord.lguMeta?.marketZone}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Assigned Stalls:</span><span className="font-semibold text-slate-900 dark:text-white">{selectedRecord.lguMeta?.assignedStallCount} Units</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Chairperson:</span><span className="font-semibold text-slate-900 dark:text-white">{selectedRecord.chairperson.firstName} {selectedRecord.chairperson.lastName}</span></div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Accreditation Decision</label>
                  <select
                    value={reviewStatus}
                    onChange={(e) => setReviewStatus(e.target.value as HawkerAssociationStatus)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="Under Review">Under Review</option>
                    <option value="Approved">Approve & Issue Permit</option>
                    <option value="Rejected">Reject / Return Application</option>
                    <option value="Suspended">Suspend Accreditation</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Official Administrative Remarks</label>
                  <textarea
                    rows={3}
                    value={reviewRemarks}
                    onChange={(e) => setReviewRemarks(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-white"
                    placeholder="Enter notes or conditions for approval..."
                  ></textarea>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button type="button" onClick={() => setIsReviewModalOpen(false)} className="px-4 py-2 font-semibold text-slate-600 cursor-pointer">Cancel</button>
                  <button type="submit" className="px-5 py-2.5 font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md cursor-pointer">Save & Update Registry</button>
                </div>
              </form>
            )}

            {/* TAB 2: DIGITAL VAULT WITH IMAGE / PDF VIEW */}
            {activeTab === "documents" && (
              <div className="space-y-4 text-xs">
                <p className="text-slate-500 mb-2">Verified statutory documents uploaded by the applicant to the database:</p>

                {selectedRecord.lguMeta?.uploadedDocuments && selectedRecord.lguMeta.uploadedDocuments.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                    {selectedRecord.lguMeta.uploadedDocuments.map((doc) => (
                      <div key={doc.id} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center">
                        <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2 text-center">
                          {doc.document_type.replace(/_/g, ' ')}
                        </span>

                        {/* Display Logic Based on mime_type */}
                        {doc.mime_type.startsWith('image/') ? (
                          <div className="w-full h-36 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white">
                            <img
                              src={doc.file_url}
                              alt={doc.file_name}
                              className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                              onClick={() => window.open(doc.file_url, '_blank')}
                            />
                          </div>
                        ) : (
                          <div
                            className="w-full h-36 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            onClick={() => window.open(doc.file_url, '_blank')}
                          >
                            <i className="fa-solid fa-file-pdf text-rose-500 text-4xl mb-2"></i>
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold hover:underline">View Document (PDF)</span>
                          </div>
                        )}

                        <div className="mt-3 w-full flex justify-between items-center px-1">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${doc.status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400' :
                              doc.status === 'REJECTED' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-400' :
                                'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400'
                            }`}>
                            {doc.status}
                          </span>
                          <span className="text-[10px] text-slate-400 truncate max-w-[100px]" title={doc.file_name}>{doc.file_name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center">
                    <p className="text-slate-500">No documents found for this association.</p>
                  </div>
                )}

                <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
                  <button type="button" onClick={() => setIsReviewModalOpen(false)} className="px-5 py-2 font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl cursor-pointer">Close Vault</button>
                </div>
              </div>
            )}

            {/* TAB 3: MARKET INSPECTION & VIOLATIONS */}
            {activeTab === "compliance" && (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300">
                  <p className="font-bold mb-1">Enforcement & Inspection Status</p>
                  <p className="text-[11px]">Total Recorded Violations: <strong className="text-amber-600">{selectedRecord.lguMeta?.violationsCount || 0}</strong> (Overflow, uncalibrated scale, or cleanliness infractions)</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Issue New Inspector Citation / Warning</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Failure to maintain 3-meter walkway clearance..."
                      value={inspectionNote}
                      onChange={(e) => setInspectionNote(e.target.value)}
                      className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleAddViolation}
                      className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2.5 rounded-xl cursor-pointer"
                    >
                      Log Citation
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
                  <button type="button" onClick={() => setIsReviewModalOpen(false)} className="px-5 py-2 font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl cursor-pointer">Done</button>
                </div>
              </div>
            )}

            {/* TAB 4: COA AUDIT TRAIL */}
            {activeTab === "audit" && (
              <div className="space-y-4 text-xs">
                <p className="text-slate-400">Immutable ledger logging all administrative modifications for internal audit compliance:</p>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {selectedRecord.lguMeta?.auditTrail?.map((audit, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200">{audit.action}</p>
                        <p className="text-[10px] text-slate-400">By: {audit.admin}</p>
                      </div>
                      <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400">{audit.timestamp}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
                  <button type="button" onClick={() => setIsReviewModalOpen(false)} className="px-5 py-2 font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl cursor-pointer">Close</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: MANUAL WALK-IN REGISTRATION */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-8 shadow-2xl border border-slate-200 dark:border-slate-800 my-8">
            <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1">Register New Hawker Association & Market Zone</h3>
            <p className="text-xs text-slate-400 mb-6">LGU Direct Walk-In Entry</p>

            <form onSubmit={handleCreateAssociation} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Association Number</label>
                  <input
                    type="text"
                    required
                    value={newForm.associationNumber}
                    onChange={(e) => setNewForm({ ...newForm, associationNumber: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Contact Number</label>
                  <input
                    type="text"
                    required
                    placeholder="09XXXXXXXXX"
                    value={newForm.contactNumber}
                    onChange={(e) => setNewForm({ ...newForm, contactNumber: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Association Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Samahan ng mga Magtitinda sa Farmers"
                  value={newForm.associationName}
                  onChange={(e) => setNewForm({ ...newForm, associationName: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Assigned Public Market Zone</label>
                  <select
                    value={newForm.marketZone}
                    onChange={(e) => setNewForm({ ...newForm, marketZone: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-white cursor-pointer"
                  >
                    {MARKET_ZONES.map((zone, idx) => (
                      <option key={idx} value={zone}>{zone}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Assigned Stalls / Meters Count</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newForm.assignedStallCount}
                    onChange={(e) => setNewForm({ ...newForm, assignedStallCount: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-3">Chairperson Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-500 mb-1">First Name</label>
                    <input
                      type="text"
                      required
                      value={newForm.firstName}
                      onChange={(e) => setNewForm({ ...newForm, firstName: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-500 mb-1">Last Name</label>
                    <input
                      type="text"
                      required
                      value={newForm.lastName}
                      onChange={(e) => setNewForm({ ...newForm, lastName: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block font-medium text-slate-500 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={newForm.email}
                    onChange={(e) => setNewForm({ ...newForm, email: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
                <button type="button" onClick={() => setIsRegisterOpen(false)} className="px-4 py-2 font-semibold text-slate-600 cursor-pointer">Cancel</button>
                <button type="submit" className="px-5 py-2.5 font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md cursor-pointer">Register & Issue Permit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}