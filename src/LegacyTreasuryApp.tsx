import React, { useState, useMemo, useCallback } from "react";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { usePermissions } from "./hooks/usePermissions";
import { calculateRPT } from "./services/rptCalculations";
import TreasuryDashboardView, { type TreasuryMetrics } from "./components/TreasuryDashboardView";
import TreasuryHeader from "./components/TreasuryHeader";
import TreasurySidebar from "./components/TreasurySidebar";
import RealPropertyTaxView, { type RPTForm } from "./components/RealPropertyTaxView";
import BusinessTaxView, { type BusinessForm } from "./components/BusinessTaxView";
import MarketStallsView from "./components/MarketStallsView";
import PaymentsView, { type PaymentForm } from "./components/PaymentsView";
import UsersView from "./components/UsersView";
import AuditTrailView from "./components/AuditTrailView";
import ReportsView from "./components/ReportsView";

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

const INITIAL_CONFIG: LGUConfig = {
  basicRptRate: 0.01,
  sefRate: 0.01,
  specialLevyRate: 0.005,
  penaltyRatePerMonth: 0.02,
  discountRateEarly: 0.10,
};

export default function LegacyTreasuryApp() {
  const [activeRole, setActiveRole] = useState<Role>("Administrator");
  const [activeTab, setActiveTab] = useState<Subsystem>("dashboard");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [config] = useLocalStorage("lgu_config", INITIAL_CONFIG);
  const [users] = useLocalStorage<UserRecord[]>("lgu_users", []);
  const [rptRecords, setRptRecords] = useLocalStorage<RPTRecord[]>("lgu_rpt", []);
  const [businessRecords, setBusinessRecords] = useLocalStorage<BusinessRecord[]>("lgu_business", []);
  const [stalls] = useLocalStorage<StallRecord[]>("lgu_stalls", []);
  const [transactions, setTransactions] = useLocalStorage<TransactionRecord[]>("lgu_transactions", []);
  const [auditLogs, setAuditLogs] = useLocalStorage<AuditRecord[]>("lgu_audit", []);

  const [notification, setNotification] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [businessSearchQuery, setBusinessSearchQuery] = useState("");
  const [paymentSearchQuery, setPaymentSearchQuery] = useState("");

  // Edit State Management for RPT & Business
  const [editingId, setEditingId] = useState<string | null>(null);
  const [businessEditingId, setBusinessEditingId] = useState<string | null>(null);

  const { canCreate, canApprove, canDelete } = usePermissions(activeRole);

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const logAudit = useCallback((module: string, action: AuditRecord["action"], prev?: string, next?: string) => {
    const newAudit: AuditRecord = {
      id: crypto.randomUUID(),
      auditId: crypto.randomUUID(),
      user: users.find(u => u.role === activeRole)?.fullname || activeRole,
      role: activeRole,
      module,
      action,
      previousData: prev,
      newData: next,
      timestamp: new Date().toLocaleString()
    };
    setAuditLogs(prevLogs => [newAudit, ...prevLogs]);
  }, [activeRole, users, setAuditLogs]);

  const [rptForm, setRptForm] = useState<RPTForm>({
    ownerName: "",
    ownerAddress: "",
    contact: "",
    pin: "",
    tdNo: "",
    barangay: "",
    type: "Residential" as const,
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
    
    // Auto-generate receipt number if Cash and field is empty
    const finalReceiptNo = 
      rptForm.paymentMethod === "Cash" && !rptForm.receiptNo
        ? `OR-${Math.floor(100000 + Math.random() * 900000)}`
        : rptForm.receiptNo;
    
    if (editingId) {
      // UPDATE EXISTING RECORD
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
            transactionType: rptForm.transactionType,
            paymentMethod: rptForm.paymentMethod,
            receiptNo: finalReceiptNo
          };
        }
        return item;
      }));

      logAudit("Real Property Tax Management", "Update", undefined, `Updated RPT for ${rptForm.ownerName}`);
      
      // Reset edit mode and form
      setEditingId(null);
      setRptForm({
        ownerName: "", ownerAddress: "", contact: "", pin: "", tdNo: "", barangay: "",
        type: "Residential", landArea: 0, buildingArea: 0, marketValue: 0, assessLvl: 0,
        transactionType: "Annual", paymentMethod: "Cash", receiptNo: ""
      });

    } else {
      // CREATE NEW RECORD
      if (!canCreate("RPT")) { return; }
      
      const calc = calculateRPT(config, Number(rptForm.marketValue), Number(rptForm.assessLvl), true, false);

      const newRec: RPTRecord = {
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
        transactionType: rptForm.transactionType,
        paymentMethod: rptForm.paymentMethod,
        receiptNo: finalReceiptNo
      };

      setRptRecords([newRec, ...rptRecords]);
      logAudit("Real Property Tax Management", "Create", undefined, `Created RPT for ${newRec.ownerName}`);
      
      // Clear form after creation
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

  const [payForm, setPayForm] = useState<PaymentForm>({
    payer: "", type: "Real Property Tax" as const, amount: 0, method: "Cash" as const, refNo: "", remarks: ""
  });

  const handlePostPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate("Payments")) { return; }

    const refNumber = payForm.refNo.trim() !== "" ? payForm.refNo : `OR-${Math.floor(100000 + Math.random() * 900000)}`;
    const newTrx: TransactionRecord = {
      id: crypto.randomUUID(),
      transactionId: crypto.randomUUID(),
      referenceNumber: refNumber,
      taxpayer: payForm.payer,
      paymentType: payForm.type,
      amount: Number(payForm.amount),
      paymentMethod: payForm.method,
      externalReference: payForm.refNo,
      collector: users.find(u => u.role === activeRole)?.fullname || activeRole,
      date: new Date().toLocaleString(),
      status: "Posted",
      remarks: payForm.remarks
    };

    setTransactions([newTrx, ...transactions]);
    logAudit("Payment Collection System", "Payment Posting", undefined, `Posted payment reference ${refNumber} amounting to ${payForm.amount}`);
    
    // Reset form after submission
    setPayForm({
      payer: "", type: "Real Property Tax", amount: 0, method: "Cash", refNo: "", remarks: ""
    });
  };

  const metrics: TreasuryMetrics = useMemo(() => {
    const postedTrx = transactions.filter(t => t.status === "Posted");
    const todayCollection = postedTrx.reduce((sum, t) => sum + t.amount, 0);

    const rptTotal = rptRecords.reduce((sum, r) => sum + (r.amountPaid > 0 ? r.amountPaid : r.totalAssessment), 0);
    const bizTotal = businessRecords.reduce((sum, b) => sum + (b.amountPaid > 0 ? b.amountPaid : b.totalDue), 0);
    const marketTotal = stalls.reduce((sum, s) => sum + (s.rentalRate - s.currentBalance === 0 ? s.rentalRate : 0), 0);
    
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
      activeBusinessesCount: businessRecords.length
    };
  }, [transactions, rptRecords, businessRecords, stalls]);

  return (
    <div className="legacy-treasury-shell h-screen overflow-hidden dark:bg-slate-900 text-slate-100 flex flex-col font-sans">
      <TreasuryHeader 
        activeRole={activeRole} 
        setActiveRole={setActiveRole}
        notify={notify}
        isCollapsed={isSidebarCollapsed}
      />

      {/* POP-UP NOTIFICATION MODAL CARD */}
      {notification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl border border-slate-100 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
            
            {/* Check Icon in the Center */}
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
              <svg 
                className="w-9 h-9 text-emerald-600" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="3" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            {/* Title */}
            <h3 className="text-xl font-bold text-slate-900 mb-1">
              Transaction Submitted
            </h3>

            {/* Dynamic Detail Message */}
            <p className="text-sm text-slate-500 mb-6">
              {notification}
            </p>

            {/* Dismiss Button */}
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

        <main className="flex-1 overflow-y-auto p-8 dark:bg-slate-900">
          {activeTab === "dashboard" && (
            <TreasuryDashboardView metrics={metrics} transactions={transactions} isCollapsed={isSidebarCollapsed} />
          )}

          {activeTab === "rpt" && (
            <RealPropertyTaxView
              records={rptRecords}
              form={rptForm}
              setForm={setRptForm}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onSubmit={handleCreateOrUpdateRPT}
              onAdvance={advanceRPTStatus}
              onEdit={handleEditRPT}
              onDelete={handleDeleteRPT}
              editingId={editingId}
              onCancelEdit={handleCancelEdit}
              previewTotalAssessment={previewRPT}
              notify={notify}
              isCollapsed={isSidebarCollapsed}
            />
          )}

          {activeTab === "business" && (
            <BusinessTaxView 
              records={businessRecords} 
              form={bizForm} 
              setForm={setBizForm} 
              onSubmit={handleCreateOrUpdateBusiness} 
              onAdvance={advanceBusinessStatus} 
              previewTotalDue={previewBusinessDue}
              searchQuery={businessSearchQuery}
              setSearchQuery={setBusinessSearchQuery}
              onEdit={handleEditBusiness}
              onDelete={handleDeleteBusiness}
              notify={notify}
              isCollapsed={isSidebarCollapsed}
            />
          )}

          {activeTab === "market" && <MarketStallsView records={stalls} isCollapsed={isSidebarCollapsed} />}
          
          {activeTab === "payments" && (
            <PaymentsView 
              transactions={transactions}
              form={payForm}
              setForm={setPayForm}
              onSubmit={handlePostPayment}
              searchQuery={paymentSearchQuery}
              setSearchQuery={setPaymentSearchQuery}
              notify={notify}
              isCollapsed={isSidebarCollapsed}
            />
          )}

          {activeTab === "users" && <UsersView records={users} isCollapsed={isSidebarCollapsed} />}
          {activeTab === "audit" && <AuditTrailView records={auditLogs} isCollapsed={isSidebarCollapsed} />}
          {activeTab === "reports" && <ReportsView metrics={metrics} transactionCount={transactions.length} rptRecords={rptRecords} onExport={() => notify("Report compiled successfully.")} isCollapsed={isSidebarCollapsed} />}
        </main>
      </div>
    </div>
  );
}