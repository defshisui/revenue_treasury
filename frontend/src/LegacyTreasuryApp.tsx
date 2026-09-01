// src/LegacyTreasuryApp.tsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { usePermissions } from "./hooks/usePermissions";
import { getEncryptedItem } from "./citizen-portal/citizenSecurity";
import { calculateRPT } from "./services/rptCalculations";
import TreasuryDashboardView, { type TreasuryMetrics } from "./components/TreasuryDashboardView";
import TreasuryHeader from "./components/TreasuryHeader";
import TreasurySidebar from "./components/TreasurySidebar";
import RealPropertyTaxView from "./components/RealPropertyTaxView";
import BusinessTaxView from "./components/BusinessTaxView";
import MarketStallsView from "./components/MarketStallsView";
import UsersView from "./components/UsersView";
import AuditTrailView, { type AuditRecord as ComponentAuditRecord } from "./components/AuditTrailView";
import ReportsView from "./components/ReportsView";
import HawkerAssociation from "./components/HawkerAssociation";
import CityOwnedMarketAdmin from "./components/CityOwnedMarketAdmin";
import PrivateOwnedMarketAdmin from "./components/Private_Owned_Admin";
import FraudMonitoringView from "./components/FraudMonitoringView";
import SessionInactivityModal from "./components/SessionInactivityModal";

import type {
  AuditRecord,
  BusinessRecord,
  LGUConfig,
  Role,
  RPTRecord,
  RPTWorkflowStatus,
  StallRecord,
  Subsystem,
  TransactionRecord,
  UserRecord,
  BusinessWorkflowStatus,
} from "./types/treasury";

export interface RPTForm {
  ownerName: string;
  ownerAddress: string;
  contact: string;
  pin: string;
  tdNo: string;
  barangay: string;
  type: "Residential" | "Commercial" | "Industrial" | "Agricultural";
  landArea: number;
  buildingArea: number;
  marketValue: number;
  assessLvl: number;
  transactionType: string;
  paymentMethod: string;
  receiptNo: string;
}

export interface BusinessForm {
  owner: string;
  businessName: string;
  address: string;
  type: string;
  nature: string;
  grossSales: number;
  capital: number;
  contact: string;
  barangay: string;
  paymentMethod: string;
  receiptNo: string;
}

const INITIAL_CONFIG: LGUConfig = {
  basicRptRate: 0.01,
  sefRate: 0.01,
  specialLevyRate: 0.005,
  penaltyRatePerMonth: 0.02,
  discountRateEarly: 0.10,
};

export default function LegacyTreasuryApp() {
  const navigate = useNavigate();
  const [isAuthChecked, setIsAuthChecked] = useState(false);

  // ============================================================
  // AUTH GUARD — Only admin / treasury-staff / auditor may access
  // ============================================================
  useEffect(() => {
    const ALLOWED_ROLES = ["admin", "treasury-staff", "auditor"];

    // 1. Try encrypted storage first, then plain localStorage/sessionStorage
    const encUser = getEncryptedItem('currentUser') || getEncryptedItem('user');
    const rawData =
      localStorage.getItem('currentUser') ||
      localStorage.getItem('user') ||
      sessionStorage.getItem('currentUser') ||
      sessionStorage.getItem('user');

    let sessionUser: any = null;

    if (encUser) {
      sessionUser = encUser;
    } else if (rawData) {
      try {
        sessionUser = JSON.parse(rawData);
      } catch {
        sessionUser = null;
      }
    }

    // 2. Also require a JWT token
    const token = localStorage.getItem('token');

    if (!sessionUser || !token) {
      // Not logged in at all → send to login page
      navigate("/", { replace: true });
      return;
    }

    // 3. Resolve the actual user object (handles { user: {...} } wrapper)
    const targetUser =
      sessionUser.user && typeof sessionUser.user === 'object'
        ? sessionUser.user
        : sessionUser;
    const userRole = (targetUser.role || '').toLowerCase();

    if (!ALLOWED_ROLES.includes(userRole)) {
      // Logged in but not an admin role → send citizens back to their portal
      navigate("/citizen-portal", { replace: true });
      return;
    }

    // Authorized ✓
    setIsAuthChecked(true);
  }, [navigate]);

  const [activeRole, setActiveRole] = useState<Role>("Administrator");
  const [activeTab, setActiveTab] = useState<Subsystem>("dashboard");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [config] = useLocalStorage("lgu_config", INITIAL_CONFIG);
  const [users] = useLocalStorage<UserRecord[]>("lgu_users", []);
  const [rptRecords, setRptRecords] = useLocalStorage<RPTRecord[]>("lgu_rpt", []);
  const [businessRecords, setBusinessRecords] = useLocalStorage<BusinessRecord[]>("lgu_business", []);
  const [stalls] = useLocalStorage<StallRecord[]>("lgu_stalls", []);
  const [transactions] = useLocalStorage<TransactionRecord[]>("lgu_transactions", []);
  const [auditLogs, setAuditLogs] = useLocalStorage<AuditRecord[]>("lgu_audit", []);

  const [notification, setNotification] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [businessSearchQuery, setBusinessSearchQuery] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [businessEditingId, setBusinessEditingId] = useState<string | null>(null);

  const { canCreate, canApprove, canDelete } = usePermissions(activeRole);

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const logAudit = useCallback((module: string, action: AuditRecord["action"], prev?: string, next?: string) => {
    const newAudit = {
      id: crypto.randomUUID(),
      auditId: crypto.randomUUID(),
      user: users.find(u => u.role === activeRole)?.fullname || activeRole,
      role: activeRole,
      module,
      action,
      previousData: prev,
      newData: next,
      timestamp: new Date().toLocaleString(),
      severity: "info",
      ipAddress: "127.0.0.1",
      userAgent: navigator.userAgent
    } as unknown as AuditRecord;

    setAuditLogs(prevLogs => [newAudit, ...prevLogs]);
  }, [activeRole, users, setAuditLogs]);

  const [rptForm, setRptForm] = useState<RPTForm>({
    ownerName: "",
    ownerAddress: "",
    contact: "",
    pin: "",
    tdNo: "",
    barangay: "",
    type: "Residential",
    landArea: 0,
    buildingArea: 0,
    marketValue: 0,
    assessLvl: 0,
    transactionType: "Annual",
    paymentMethod: "Cash",
    receiptNo: ""
  });

  const previewRPT = useMemo(() => {
    if (!rptForm.marketValue || !rptForm.assessLvl) return 0;

    return calculateRPT(config, Number(rptForm.marketValue), Number(rptForm.assessLvl), true, false)
      .totalAssessment;
  }, [config, rptForm.marketValue, rptForm.assessLvl]);

  const handleCreateOrUpdateRPT = (e: React.FormEvent) => {
    e.preventDefault();

    const finalReceiptNo =
      rptForm.paymentMethod === "Cash" && !rptForm.receiptNo
        ? `OR-${Math.floor(100000 + Math.random() * 900000)}`
        : rptForm.receiptNo;

    if (editingId) {
      if (!canCreate("RPT")) { return; }

      const calc = calculateRPT(config, Number(rptForm.marketValue), Number(rptForm.assessLvl), true, false);

      setRptRecords(prev => prev.map(item => {
        if (item.id === editingId) {
          return {
            ...item,
            ownerName: rptForm.ownerName,
            ownerAddress: rptForm.ownerAddress,
            contactInfo: rptForm.contact,
            propertyIndexNumber: rptForm.pin,
            taxDeclarationNumber: rptForm.tdNo,
            barangay: rptForm.barangay,
            propertyType: rptForm.type,
            landArea: Number(rptForm.landArea),
            buildingArea: Number(rptForm.buildingArea),
            marketValue: Number(rptForm.marketValue),
            assessmentLevel: Number(rptForm.assessLvl),
            assessedValue: calc.assessedValue,
            basicTax: calc.basicTax,
            sefTax: calc.sefTax,
            specialLevy: calc.specialLevy,
            penalty: calc.penalty,
            discount: calc.discount,
            totalAssessment: calc.totalAssessment,
            balance: calc.totalAssessment,
            receiptNo: finalReceiptNo,
            transactionType: rptForm.transactionType,
            paymentMethod: rptForm.paymentMethod
          } as unknown as RPTRecord;
        }
        return item;
      }));

      logAudit("Real Property Tax Management", "Update", undefined, `Updated RPT for ${rptForm.ownerName}`);

      setEditingId(null);
      setRptForm({
        ownerName: "", ownerAddress: "", contact: "", pin: "", tdNo: "", barangay: "",
        type: "Residential", landArea: 0, buildingArea: 0, marketValue: 0, assessLvl: 0,
        transactionType: "Annual", paymentMethod: "Cash", receiptNo: ""
      });

    } else {
      if (!canCreate("RPT")) { return; }

      const calc = calculateRPT(config, Number(rptForm.marketValue), Number(rptForm.assessLvl), true, false);

      const newRec = {
        id: crypto.randomUUID(),
        propertyId: crypto.randomUUID(),
        taxpayerId: crypto.randomUUID(),
        ownerName: rptForm.ownerName,
        ownerAddress: rptForm.ownerAddress,
        contactInfo: rptForm.contact,
        propertyIndexNumber: rptForm.pin,
        taxDeclarationNumber: rptForm.tdNo,
        barangay: rptForm.barangay,
        location: "",
        propertyType: rptForm.type,
        landArea: Number(rptForm.landArea),
        buildingArea: Number(rptForm.buildingArea),
        marketValue: Number(rptForm.marketValue),
        assessmentLevel: Number(rptForm.assessLvl),
        assessedValue: calc.assessedValue,
        billingYear: new Date().getFullYear(),
        quarter: "Full Year",
        dueDate: "",
        basicTax: calc.basicTax,
        sefTax: calc.sefTax,
        specialLevy: calc.specialLevy,
        penalty: calc.penalty,
        discount: calc.discount,
        totalAssessment: calc.totalAssessment,
        amountPaid: 0,
        balance: calc.totalAssessment,
        delinquentStatus: false,
        paymentHistory: [],
        status: "Assessment Created",
        createdAt: new Date().toISOString().split("T")[0],
        receiptNo: finalReceiptNo,
        transactionType: rptForm.transactionType,
        paymentMethod: rptForm.paymentMethod
      } as unknown as RPTRecord;

      setRptRecords([newRec, ...rptRecords]);
      logAudit("Real Property Tax Management", "Create", undefined, `Created RPT for ${newRec.ownerName}`);

      setRptForm({
        ownerName: "", ownerAddress: "", contact: "", pin: "", tdNo: "", barangay: "",
        type: "Residential", landArea: 0, buildingArea: 0, marketValue: 0, assessLvl: 0,
        transactionType: "Annual", paymentMethod: "Cash", receiptNo: ""
      });
    }
  };

  const handleEditRPT = (record: RPTRecord) => {
    const rawRecord = record as any;
    setEditingId(record.id);
    setRptForm({
      ownerName: record.ownerName || "",
      ownerAddress: record.ownerAddress || "",
      contact: record.contactInfo || "",
      pin: record.propertyIndexNumber || "",
      tdNo: record.taxDeclarationNumber || "",
      barangay: record.barangay || "",
      type: (record.propertyType as any) || "Residential",
      landArea: record.landArea || 0,
      buildingArea: record.buildingArea || 0,
      marketValue: record.marketValue || 0,
      assessLvl: record.assessmentLevel || 0,
      transactionType: rawRecord.transactionType || "Annual",
      paymentMethod: rawRecord.paymentMethod || "Cash",
      receiptNo: record.receiptNo || ""
    });
  };

  const handleDeleteRPT = (id: string) => {
    if (!canDelete()) { return; }

    setRptRecords(prev => prev.filter(item => item.id !== id));
    logAudit("Real Property Tax Management", "Delete", `ID: ${id}`, undefined);

    if (editingId === id) {
      setEditingId(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setRptForm({
      ownerName: "", ownerAddress: "", contact: "", pin: "", tdNo: "", barangay: "",
      type: "Residential", landArea: 0, buildingArea: 0, marketValue: 0, assessLvl: 0,
      transactionType: "Annual", paymentMethod: "Cash", receiptNo: ""
    });
  };

  const advanceRPTStatus = (id: string) => {
    setRptRecords(prev => prev.map(item => {
      if (item.id !== id) return item;
      let nextStatus: RPTWorkflowStatus = item.status;
      if (item.status === "Assessment Created") nextStatus = "Reviewed";
      else if (item.status === "Reviewed" && canApprove()) nextStatus = "Approved";
      else if (item.status === "Approved") nextStatus = "Billed";

      logAudit("Real Property Tax Management", "Status Change", `Status: ${item.status}`, `Status: ${nextStatus}`);
      return { ...item, status: nextStatus };
    }));
  };

  const [bizForm, setBizForm] = useState<BusinessForm>({
    owner: "", businessName: "", address: "", type: "", nature: "", grossSales: 0, capital: 0, contact: "", barangay: "", paymentMethod: "", receiptNo: ""
  });

  const previewBusinessDue = useMemo(() => {
    const gross = Number(bizForm.grossSales) || 0;
    return gross * 0.015;
  }, [bizForm.grossSales]);

  const handleCreateOrUpdateBusiness = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate("Business")) { return; }

    const gross = Number(bizForm.grossSales);
    const taxRate = 0.015;
    const computedTax = gross * taxRate;
    const mayorPermitFee = 0;
    const regulatoryFees = 0;
    const inspectionFee = 0;
    const sanitaryFee = 0;
    const garbageFee = 0;
    const totalDue = computedTax + mayorPermitFee + regulatoryFees + inspectionFee + sanitaryFee + garbageFee;

    if (businessEditingId) {
      setBusinessRecords(prev => prev.map(item => {
        if (item.id === businessEditingId) {
          return {
            ...item,
            owner: bizForm.owner,
            businessName: bizForm.businessName,
            address: bizForm.address,
            businessType: bizForm.type,
            natureOfBusiness: bizForm.nature,
            grossSales: gross,
            capitalInvestment: Number(bizForm.capital),
            computedTax,
            totalDue,
            balance: totalDue
          };
        }
        return item;
      }));

      logAudit("Business Tax Management", "Update", undefined, `Updated Business Assessment for ${bizForm.businessName}`);
      setBusinessEditingId(null);
    } else {
      const newBiz: BusinessRecord = {
        id: crypto.randomUUID(),
        businessId: crypto.randomUUID(),
        owner: bizForm.owner,
        businessName: bizForm.businessName,
        address: bizForm.address,
        businessType: bizForm.type,
        natureOfBusiness: bizForm.nature,
        registrationDate: new Date().toISOString().split("T")[0],
        grossSales: gross,
        capitalInvestment: Number(bizForm.capital),
        taxCategory: "",
        taxRate,
        computedTax,
        mayorPermitFee,
        regulatoryFees,
        inspectionFee,
        sanitaryFee,
        garbageFee,
        totalDue,
        amountPaid: 0,
        balance: totalDue,
        status: "Draft",
        createdAt: new Date().toISOString().split("T")[0]
      };

      setBusinessRecords([newBiz, ...businessRecords]);
      logAudit("Business Tax Management", "Create", undefined, `Created Business Assessment for ${newBiz.businessName}`);
    }

    setBizForm({
      owner: "", businessName: "", address: "", type: "", nature: "", grossSales: 0, capital: 0, contact: "", barangay: "", paymentMethod: "", receiptNo: ""
    });
  };

  const handleEditBusiness = (record: BusinessRecord) => {
    setBusinessEditingId(record.id);
    setBizForm({
      owner: record.owner || "",
      businessName: record.businessName || "",
      address: record.address || "",
      type: record.businessType || "",
      nature: record.natureOfBusiness || "",
      grossSales: record.grossSales || 0,
      capital: record.capitalInvestment || 0,
      contact: "",
      barangay: "",
      paymentMethod: "",
      receiptNo: ""
    });
  };

  const handleDeleteBusiness = (id: string) => {
    if (!canDelete()) { return; }
    setBusinessRecords(prev => prev.filter(item => item.id !== id));
    logAudit("Business Tax Management", "Delete", `ID: ${id}`, undefined);
    if (businessEditingId === id) {
      setBusinessEditingId(null);
    }
  };

  const advanceBusinessStatus = (id: string) => {
    setBusinessRecords(prev => prev.map(item => {
      if (item.id !== id) return item;
      let nextStatus: BusinessWorkflowStatus = item.status;
      if (item.status === "Draft") nextStatus = "Submitted";
      else if (item.status === "Submitted") nextStatus = "Reviewed";
      else if (item.status === "Reviewed" && canApprove()) nextStatus = "Approved";

      logAudit("Business Tax Management", "Status Change", `Status: ${item.status}`, `Status: ${nextStatus}`);
      return { ...item, status: nextStatus };
    }));
  };

  const metrics: TreasuryMetrics = useMemo(() => {
    const postedTrx = transactions.filter(t => t.status === "Posted");
    const todayCollection = postedTrx.reduce((sum, t) => sum + t.amount, 0);

    const rptTotal = rptRecords.reduce((sum, r) => sum + (r.amountPaid > 0 ? r.amountPaid : r.totalAssessment), 0);
    const bizTotal = businessRecords.reduce((sum, b) => sum + (b.amountPaid > 0 ? b.amountPaid : b.totalDue), 0);
    const marketTotal = stalls.reduce((sum, s) => sum + (((s.rentalRate ?? 0) - (s.currentBalance ?? 0) === 0) ? (s.rentalRate ?? 0) : 0), 0);

    const combinedCollection = todayCollection + rptTotal;

    const delinquentCount = rptRecords.filter(r => r.delinquentStatus).length + stalls.filter(s => s.overdueStatus).length;

    return {
      today: combinedCollection,
      monthly: combinedCollection * 3,
      annual: combinedCollection * 12,
      collectionTarget: combinedCollection,
      rptCollection: rptTotal,
      businessCollection: bizTotal,
      marketCollection: marketTotal,
      permitsCollection: 0,
      delinquentCount,
      pendingPaymentsCount: transactions.filter(t => t.status === "Pending").length,
      activePermitsCount: businessRecords.filter(b => b.status === "Approved").length,
      activeStallsCount: stalls.length,
      activeBusinessesCount: businessRecords.length,
      totalEpayments: 0,
      totalEORs: 0,
      totalAmount: combinedCollection,
      billerSystems: 0,
      paymentOptions: [],
      annualTransactions: [],
      transactionsByType: {},
      transactionsByBiller: {}
    } as unknown as TreasuryMetrics;
  }, [transactions, rptRecords, businessRecords, stalls]);

  return (
    <>
      {/* Block rendering until auth check completes */}
      {!isAuthChecked ? (
        <div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        </div>
      ) : (
    <div className="legacy-treasury-shell h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex flex-col font-sans">
      <TreasuryHeader
        activeRole={activeRole}
        setActiveRole={setActiveRole}
        notify={notify}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
      />

      <SessionInactivityModal idleTimeoutMinutes={10} countdownSeconds={60} />

      {notification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 animate-in fade-in duration-100">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl border border-slate-100 dark:border-gray-700 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-9 h-9 text-emerald-600 dark:text-emerald-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
              Transaction Submitted
            </h3>

            <p className="text-sm text-slate-500 dark:text-gray-400 mb-6">
              {notification}
            </p>

            <button
              type="button"
              onClick={() => setNotification(null)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl transition-colors cursor-pointer shadow-md"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <TreasurySidebar
          activeTab={activeTab}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          setActiveTab={setActiveTab}
          canCreate={canCreate}
          canApprove={canApprove}
          canDelete={canDelete}
        />

        <main className="flex-1 overflow-y-auto p-8 bg-slate-50 dark:bg-slate-900">
          {activeTab === "dashboard" && (
            <TreasuryDashboardView
              metrics={metrics}
              transactions={transactions}
              marketStalls={stalls}
              isCollapsed={isSidebarCollapsed}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === "rpt" && (
            <RealPropertyTaxView
              {...({
                records: rptRecords,
                form: rptForm,
                setForm: setRptForm,
                searchQuery,
                setSearchQuery,
                onSubmit: handleCreateOrUpdateRPT,
                onAdvance: advanceRPTStatus,
                onEdit: handleEditRPT,
                onDelete: handleDeleteRPT,
                editingId,
                onCancelEdit: handleCancelEdit,
                previewTotalAssessment: previewRPT,
                notify,
                isCollapsed: isSidebarCollapsed
              } as any)}
            />
          )}

          {activeTab === "business" && (
            <BusinessTaxView
              {...({
                records: businessRecords,
                form: bizForm,
                setForm: setBizForm,
                onSubmit: handleCreateOrUpdateBusiness,
                onAdvance: advanceBusinessStatus,
                previewTotalDue: previewBusinessDue,
                searchQuery: businessSearchQuery,
                setSearchQuery: setBusinessSearchQuery,
                onEdit: handleEditBusiness,
                onDelete: handleDeleteBusiness,
                notify,
                isCollapsed: isSidebarCollapsed
              } as any)}
            />
          )}

          {activeTab === "market" && <MarketStallsView records={stalls} isCollapsed={isSidebarCollapsed} />}

          {activeTab === "market-city" && (
            <CityOwnedMarketAdmin {...({ isCollapsed: isSidebarCollapsed } as any)} />
          )}

          {activeTab === "market-private" && (
            <PrivateOwnedMarketAdmin {...({ isCollapsed: isSidebarCollapsed } as any)} />
          )}

          {activeTab === "users" && <UsersView records={users} isCollapsed={isSidebarCollapsed} />}
          {activeTab === "audit" && <AuditTrailView records={auditLogs as unknown as ComponentAuditRecord[]} isCollapsed={isSidebarCollapsed} />}
          {activeTab === "fraud" && <FraudMonitoringView isCollapsed={isSidebarCollapsed} />}
          {activeTab === "reports" && (
            <ReportsView
              {...({
                metrics,
                transactionCount: transactions.length,
                rptRecords,
                onExport: () => notify("Report compiled successfully."),
                isCollapsed: isSidebarCollapsed
              } as any)}
            />
          )}

          {activeTab === "hawker" && (
            <HawkerAssociation {...({ isCollapsed: isSidebarCollapsed } as any)} />
          )}
        </main>
      </div>
    </div>
      )}
    </>
  );
}