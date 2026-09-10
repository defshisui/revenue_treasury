import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { StatusType } from '../types/treasury';
import {
  getRPTApplications,
  getLguMasterRptRecords,
  createLguMasterRptRecord,
  updateRptApplicationStatus,
  updateLguMasterRptRecord,
  deleteLguMasterRptRecord,
  deleteRptApplication,
  type RPTApplicationRecord,
} from '../services/realpropertytaxService';
import { API_BASE_URL } from '../config/api';

type ExtendedStatusType =
  | StatusType
  | 'Archived'
  | 'Submitted'
  | 'For Review'
  | 'Under Evaluation'
  | 'For Compliance'
  | 'Processing'
  | 'Approved'
  | 'For Payment'
  | 'Payment Completed'
  | 'Ready for Release'
  | 'Rejected'
  | 'Completed'
  | 'Digital Certificate Issued';

export interface LguMasterProperty {
  id: number | string;
  propertyIndexNumber: string;
  newPspin: string;
  taxDeclarationNumber: string;
  ownerName: string;
  ownerAddress: string;
  contactInfo: string;
  barangay: string;
  location: string;
  propertyType: string;
  lotAreaSqm: number;
  marketValue: number;
  assessedValue: number;
  billingYear: number;
  billExpiryDate: string;
  basicTax: number;
  sefTax: number;
  shttcApplied: number;
  penalty: number;
  discount: number;
  totalAssessment: number;
  amountPaid: number;
  balance: number;
  delinquentStatus: boolean;
  status: string;
  paymentStatus: string;
}

export interface PaymentLedgerRecord {
  id: number | string;
  taxDeclarationNumber: string;
  ownerName: string;
  amountPaid: number;
  officialReceiptNumber: string;
  paymentDate: string;
  paymentMethod: string;
  quarterCoverage?: string;
  paymentOption?: string;
  paymongoSessionId?: string;
  status: string;
}

export interface ApplicationDocument {
  id: string;
  name: string;
  type: string;
  url?: string;
  status: 'Verified' | 'Rejected' | 'Pending';
  uploadedAt: string;
}

interface ExtendedApplicationRecord extends Omit<RPTApplicationRecord, 'documents' | 'status'> {
  status: ExtendedStatusType;
  referenceNumber: string;
  applicantEmail: string;
  applicantPhone: string;
  category: string;
  submissionDate: string;
  assignedOfficer?: string;
  paymentStatus?: 'Paid' | 'Pending' | 'For Payment' | 'Payment Completed' | 'Unpaid';
  paymentAmount?: number;
  paymentReference?: string;
  officialReceiptNumber?: string;
  paymentMethod?: string;
  paymentDate?: string;
  paymentDueDate?: string;
  penaltyFee: number;
  propertyDetails: {
    pin: string;
    titleNumber: string;
    lotAreaSqM: number;
    address: string;
    currentValuation?: number;
  };
  documents: ApplicationDocument[];
  auditLogs?: {
    id: string;
    timestamp: string;
    officer: string;
    action: string;
  }[];
  notificationLogs?: {
    id: string;
    timestamp: string;
    type: 'Email' | 'SMS';
    message: string;
    status: 'Delivered' | 'Pending';
  }[];
  aiFraudRisk?: 'Low' | 'Medium' | 'High';
  aiFraudReason?: string;
  digitalRelease?: {
    releaseMethod: 'Digital';
    releasedAt?: string;
    releasedBy?: string;
    certificateType: 'Tax Declaration' | 'Certified True Copy' | 'Tax Declaration / CTC';
    digitalSignatureStatus: 'Pending' | 'Signed' | 'Invalidated';
    qrVerificationCode?: string;
    downloadCount: number;
    citizenNotified: boolean;
  };
}

export interface RealPropertyTaxViewProps {
  isCollapsed: boolean;
  [key: string]: any;
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(val || 0);
}

export const RealPropertyTaxView: React.FC<RealPropertyTaxViewProps> = ({
  isCollapsed,
}) => {
  // Navigation tabs
  const [mainViewTab, setMainViewTab] = useState<'master' | 'queue' | 'payments'>(
    () => {
      const stored = localStorage.getItem('rpt_admin_tab');
      return stored === 'master' || stored === 'queue' || stored === 'payments' ? stored : 'master';
    }
  );

  const switchMainViewTab = (tab: 'master' | 'queue' | 'payments') => {
    setMainViewTab(tab);
    localStorage.setItem('rpt_admin_tab', tab);
  };

  // Master Database subtabs (Active vs Archiver)
  const [masterTab, setMasterTab] = useState<'Active' | 'Archived'>('Active');
  // Citizen Applications subtabs (Active vs Archiver)
  const [queueTab, setQueueTab] = useState<'Active' | 'Archived'>('Active');

  // Master Properties state
  const [masterProperties, setMasterProperties] = useState<LguMasterProperty[]>([]);
  const [masterSearch, setMasterSearch] = useState<string>('');
  const [masterTypeFilter, setMasterTypeFilter] = useState<string>('ALL');
  const [masterStatusFilter, setMasterStatusFilter] = useState<string>('ALL');
  const [isPropertyModalOpen, setIsPropertyModalOpen] = useState<boolean>(false);
  const [editingProperty, setEditingProperty] = useState<Partial<LguMasterProperty> | null>(null);
  const [masterEntriesPerPage, setMasterEntriesPerPage] = useState<number>(10);
  const [masterCurrentPage, setMasterCurrentPage] = useState<number>(1);

  // Payments ledger state
  const [paymentsLedger, setPaymentsLedger] = useState<PaymentLedgerRecord[]>([]);
  const [paymentSearch, setPaymentSearch] = useState<string>('');

  // Applications queue state
  const [applications, setApplications] = useState<ExtendedApplicationRecord[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [rptServiceAmountInput, setRptServiceAmountInput] = useState<string>('');

  // Document Preview Pop-Up Modal State
  const [previewModalOpen, setPreviewModalOpen] = useState<boolean>(false);
  const [previewDocList, setPreviewDocList] = useState<ApplicationDocument[]>([]);
  const [activeDocIndex, setActiveDocIndex] = useState<number>(0);
  const [previewTabMode, setPreviewTabMode] = useState<'viewer' | 'details'>('viewer');
  const [previewZoom, setPreviewZoom] = useState<number>(100);
  const [previewDocError, setPreviewDocError] = useState<boolean>(false);

  // Toast message state
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'warning' | 'error';
  } | null>(null);

  // Treasury Cashier In-Person Settlement Modal State
  const [isCashierSettleModalOpen, setIsCashierSettleModalOpen] = useState<boolean>(false);
  const [cashierOrNumber, setCashierOrNumber] = useState<string>('');
  const [cashierPaymentMethod, setCashierPaymentMethod] = useState<string>('Treasury Cashier (Cash)');
  const [cashierPaymentAmount, setCashierPaymentAmount] = useState<number>(0);
  const [isSubmittingSettle, setIsSubmittingSettle] = useState<boolean>(false);

  // Payments Ledger Category Filter
  const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState<'ALL' | 'MASTER' | 'APPLICATION'>('ALL');

  const triggerToast = (text: string, type: 'success' | 'warning' | 'error') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // In-app confirmation modal (replaces window.confirm's native dialog)
  const [confirmState, setConfirmState] = useState<{
    message: string;
    tone: 'default' | 'danger';
  } | null>(null);
  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirmAction = (message: string, tone: 'default' | 'danger' = 'default'): Promise<boolean> => {
    return new Promise((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmState({ message, tone });
    });
  };

  const resolveConfirm = (result: boolean) => {
    setConfirmState(null);
    if (confirmResolverRef.current) {
      confirmResolverRef.current(result);
      confirmResolverRef.current = null;
    }
  };

  // -------------------------------------------------------------
  // Data Fetching
  // -------------------------------------------------------------
  const loadMasterRecords = useCallback(async () => {
    try {
      const raw = await getLguMasterRptRecords();
      const records: any[] = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as any)?.data)
          ? (raw as any).data
          : Array.isArray((raw as any)?.records)
            ? (raw as any).records
            : [];
      const mapped: LguMasterProperty[] = records.map((r: any) => {
        const rawPaymentStatus = String(r.payment_status || r.paymentStatus || '').trim().toLowerCase();
        const balance = Number(r.balance || 0);
        const amountPaid = Number(r.amount_paid || r.amountPaid || 0);
        const isPaid = rawPaymentStatus === 'paid' || rawPaymentStatus === 'settled' || (balance <= 0 && amountPaid > 0);

        return {
          id: r.id,
          propertyIndexNumber: r.property_index_number || r.propertyIndexNumber || '',
          newPspin: r.new_pspin || r.newPspin || '',
          taxDeclarationNumber: r.tax_declaration_number || r.taxDeclarationNumber || '',
          ownerName: r.owner_name || r.ownerName || '',
          ownerAddress: r.owner_address || r.ownerAddress || '',
          contactInfo: r.contact_info || r.contactInfo || '',
          barangay: r.barangay || '',
          location: r.location || '',
          propertyType: r.property_type || r.propertyType || 'Residential',
          lotAreaSqm: Number(r.lot_area_sqm || r.lotAreaSqm || 0),
          marketValue: Number(r.market_value || r.marketValue || 0),
          assessedValue: Number(r.assessed_value || r.assessedValue || 0),
          billingYear: Number(r.billing_year || r.billingYear || 2025),
          billExpiryDate: r.bill_expiry_date || r.billExpiryDate || '2025-10-31',
          basicTax: Number(r.basic_tax || r.basicTax || 0),
          sefTax: Number(r.sef_tax || r.sefTax || 0),
          shttcApplied: Number(r.shttc_applied || r.shttcApplied || 0),
          penalty: Number(r.penalty || 0),
          discount: Number(r.discount || 0),
          totalAssessment: Number(r.total_assessment || r.totalAssessment || 0),
          amountPaid,
          balance,
          delinquentStatus: Boolean(r.delinquent_status || r.delinquentStatus),
          status: r.status || 'Active',
          paymentStatus: isPaid ? 'Paid' : 'Unpaid',
        };
      });
      setMasterProperties(mapped);
    } catch (e) {
      console.error('Failed to load master records:', e);
    }
  }, []);

  const loadPayments = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/citizen-rpt-payments`);
      if (response.ok) {
        const raw = await response.json();
        const data: any[] = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.data)
            ? raw.data
            : Array.isArray(raw?.records)
              ? raw.records
              : [];
        setPaymentsLedger(
          data.map((p: any) => ({
            id: p.id,
            taxDeclarationNumber: p.tax_declaration_number || p.taxDeclarationNumber || 'N/A',
            ownerName: p.owner_name || p.ownerName || 'Unknown Payor',
            amountPaid: Number(p.amount_paid || p.amount || p.amountPaid || 0),
            officialReceiptNumber: p.official_receipt_number || p.officialReceiptNumber || `OR-${p.id}`,
            paymentDate: p.payment_date || p.paymentDate || '',
            paymentMethod: p.payment_method || p.paymentMethod || 'Online Gateway',
            quarterCoverage: p.quarter_coverage || p.quarterCoverage || 'Full Year',
            paymentOption: p.payment_option || p.paymentOption || 'Full',
            paymongoSessionId: p.paymongo_session_id || p.paymongoSessionId || '',
            status: p.status || 'Verified',
          }))
        );
      }
    } catch (e) {
      console.error('Failed to load payments ledger:', e);
    }
  }, []);

  const recordPaymentLedgerEntry = async (payload: {
    taxDeclarationNumber: string;
    ownerName: string;
    amountPaid: number;
    officialReceiptNumber: string;
    paymentDate: string;
    paymentMethod: string;
    quarterCoverage?: string;
    paymentOption?: string;
    status?: string;
  }) => {
    const response = await fetch(`${API_BASE_URL}/citizen-rpt-payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Payment ledger entry could not be recorded (HTTP ${response.status}).`);
    }
    return response.json().catch(() => null);
  };

  const loadApplications = useCallback(async () => {
    try {
      const data = await getRPTApplications();
      const mapped: ExtendedApplicationRecord[] = (Array.isArray(data) ? data : []).map((item: any) => {
        let rawDocs = item.documents;
        if (typeof rawDocs === 'string') {
          try {
            rawDocs = JSON.parse(rawDocs);
          } catch {
            rawDocs = [];
          }
        }
        if (rawDocs && !Array.isArray(rawDocs) && typeof rawDocs === 'object') {
          rawDocs = Object.values(rawDocs);
        }

        const rawPaymentStatus = String(item.payment_status || item.paymentStatus || '').trim().toLowerCase();
        const itemStatus = String(item.status || '').trim();
        const rawPaymentAmount = Number(
          item.payment_amount !== undefined
            ? item.payment_amount
            : item.paymentAmount !== undefined
              ? item.paymentAmount
              : 0
        );
        const isPaymentSettled =
          ['paid', 'settled', 'payment completed'].includes(rawPaymentStatus) ||
          itemStatus === 'Payment Completed';
        const isPaymentPending =
          !isPaymentSettled &&
          (itemStatus === 'For Payment' ||
            ['pending', 'pending payment'].includes(rawPaymentStatus) ||
            rawPaymentAmount > 0);
        const resolvedPaymentStatus: 'Paid' | 'Pending' | 'For Payment' | 'Payment Completed' | 'Unpaid' =
          isPaymentSettled
            ? 'Paid'
            : isPaymentPending
              ? 'Pending'
              : 'Unpaid';

        return {
          ...item,
          id: item.id || `RPT-${Math.random().toString(36).substring(2, 9)}`,
          applicantName: item.applicantName || item.ownerName || 'Unknown Applicant',
          status: item.status || 'Under Evaluation',
          referenceNumber: item.controlNumber || item.referenceNumber || `REF-${item.id}`,
          applicantEmail: item.email || '',
          applicantPhone: item.mobileNumber || '',
          category: item.service || 'Transfer of Ownership',
          submissionDate: item.filedDate || '',
          penaltyFee: item.penalty ? Number(item.penalty) : 0,
          paymentStatus: resolvedPaymentStatus,
          paymentAmount: rawPaymentAmount,
          paymentReference: item.payment_reference || item.paymentReference || '',
          officialReceiptNumber: item.official_receipt_number || item.officialReceiptNumber || '',
          paymentMethod: item.payment_method || item.paymentMethod || '',
          paymentDate: item.payment_date || item.paymentDate || '',
          paymentDueDate: item.payment_due_date || item.paymentDueDate || '',
          propertyDetails: item.propertyDetails || {
            pin: item.pin || '',
            titleNumber: item.taxDeclarationNumber || '',
            lotAreaSqM: item.lotAreaSqM || 0,
            address: item.propertyLocation || '',
            currentValuation: item.currentValuation || 0,
          },
          documents: (Array.isArray(rawDocs) ? rawDocs : []).reduce((acc: ApplicationDocument[], doc: any, idx: number) => {
            if (!doc) return acc;
            if (typeof doc === 'string') {
              if (!doc.trim()) return acc;
              acc.push({
                id: `DOC-${idx + 1}`,
                name: doc,
                type: doc.toLowerCase().includes('.pdf') ? 'PDF' : 'IMAGE',
                url: doc.startsWith('data:') || doc.startsWith('http') ? doc : `${API_BASE_URL}/uploads/${doc}`,
                status: 'Pending' as const,
                uploadedAt: item.filedDate || '',
              });
              return acc;
            }
            const docName = doc.name || doc.fileName || '';
            if (!docName) return acc;
            acc.push({
              id: doc.id || `DOC-${idx + 1}`,
              name: docName,
              type: doc.type || (docName.toLowerCase().includes('.pdf') ? 'PDF' : 'IMAGE'),
              url: doc.url
                ? doc.url.startsWith('data:') || doc.url.startsWith('http')
                  ? doc.url
                  : `${API_BASE_URL}${doc.url.startsWith('/') ? '' : '/'}${doc.url}`
                : '',
              status: doc.status || 'Pending',
              uploadedAt: doc.uploadedAt || item.filedDate || '',
            });
            return acc;
          }, []),
          auditLogs: item.auditLogs || [],
          notificationLogs: item.notificationLogs || [],
        };
      });

      setApplications(mapped);

      setSelectedAppId((prev) => (prev ? prev : mapped.length > 0 ? mapped[0].id : prev));
    } catch (err) {
      console.error('Failed to load RPT applications:', err);
    }
  }, []);

  const refreshAllData = useCallback(async () => {
    await Promise.all([loadMasterRecords(), loadPayments(), loadApplications()]);
    triggerToast('RPT Admin data synchronized.', 'success');
  }, [loadMasterRecords, loadPayments, loadApplications]);

  useEffect(() => {
    loadMasterRecords();
    loadPayments();
    loadApplications();
  }, [loadMasterRecords, loadPayments, loadApplications]);

  // Current selected application
  const currentApp = useMemo(() => {
    return applications.find((app) => app.id === selectedAppId);
  }, [applications, selectedAppId]);

  useEffect(() => {
    setRptServiceAmountInput(
      currentApp ? String(currentApp.paymentAmount || '') : ''
    );
  }, [currentApp?.id, currentApp?.paymentAmount]);

  // -------------------------------------------------------------
  // KPI Metrics Calculation
  // -------------------------------------------------------------
  const metrics = useMemo(() => {
    const activeMaster = masterProperties.filter((p) => p.status !== 'Archived');
    const totalMaster = activeMaster.length;
    const settledMasterCount = activeMaster.filter((p) => p.paymentStatus === 'Paid').length;
    const pendingMasterCount = activeMaster.filter((p) => p.paymentStatus !== 'Paid').length;

    const nonArchivedApps = applications.filter((a) => a.status !== 'Archived');
    const totalApps = nonArchivedApps.length;
    const settledApps = nonArchivedApps.filter(
      (a) => a.paymentStatus === 'Paid' || a.status === 'Payment Completed'
    );
    const settledAppsCount = settledApps.length;
    const settledAppRevenue = settledApps.reduce((sum, a) => sum + Number(a.paymentAmount || 0), 0);

    const pendingPaymentApps = nonArchivedApps.filter(
      (a) =>
        a.paymentStatus !== 'Paid' &&
        a.status !== 'Payment Completed' &&
        (a.status === 'For Payment' ||
          a.paymentStatus === 'Pending' ||
          Number(a.paymentAmount || 0) > 0)
    );
    const pendingPaymentAppsCount = pendingPaymentApps.length;
    const pendingAppFees = pendingPaymentApps.reduce(
      (sum, a) => sum + Number(a.paymentAmount || 0),
      0
    );

    const underReviewAppsCount = nonArchivedApps.filter(
      (a) =>
        !['Approved', 'Payment Completed', 'Ready for Release', 'Rejected'].includes(a.status as string) &&
        a.status !== 'For Payment'
    ).length;

    const masterPaidRevenue = paymentsLedger.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
    const totalPaidRevenue = masterPaidRevenue + settledAppRevenue;

    const pendingMasterBalance = activeMaster.reduce((sum, p) => {
      if (p.paymentStatus !== 'Paid') {
        return sum + (p.balance || p.totalAssessment || 0);
      }
      return sum;
    }, 0);

    const totalPendingReceivables = pendingMasterBalance + pendingAppFees;

    return {
      totalMaster,
      settledMasterCount,
      pendingMasterCount,
      activeApps: totalApps,
      settledAppsCount,
      settledAppRevenue,
      pendingPaymentAppsCount,
      pendingAppFees,
      underReviewAppsCount,
      masterPaidRevenue,
      totalPaidRevenue,
      pendingBalance: pendingMasterBalance,
      totalPendingReceivables,
      totalSettledReceipts: paymentsLedger.length + settledAppsCount,
      unpaidCount: pendingMasterCount,
    };
  }, [masterProperties, applications, paymentsLedger]);

  // -------------------------------------------------------------
  // Filtered Master Properties
  // -------------------------------------------------------------
  const filteredMasterProperties = useMemo(() => {
    const lowerSearch = masterSearch.toLowerCase();
    return masterProperties.filter((p) => {
      const isArchived = p.status === 'Archived';
      if (masterTab === 'Active' && isArchived) return false;
      if (masterTab === 'Archived' && !isArchived) return false;

      const isSettled = p.paymentStatus === 'Paid';
      const matchesSearch =
        !lowerSearch ||
        p.taxDeclarationNumber.toLowerCase().includes(lowerSearch) ||
        p.ownerName.toLowerCase().includes(lowerSearch) ||
        p.newPspin.toLowerCase().includes(lowerSearch) ||
        p.barangay.toLowerCase().includes(lowerSearch) ||
        (lowerSearch === 'settled' && isSettled) ||
        (lowerSearch === 'pending' && !isSettled);

      const matchesType = masterTypeFilter === 'ALL' || p.propertyType === masterTypeFilter;
      let matchesStatus = true;
      if (masterStatusFilter === 'Paid' || masterStatusFilter === 'Settled') {
        matchesStatus = isSettled;
      } else if (masterStatusFilter === 'Unpaid' || masterStatusFilter === 'Pending') {
        matchesStatus = !isSettled;
      } else if (masterStatusFilter !== 'ALL') {
        matchesStatus = p.paymentStatus === masterStatusFilter;
      }

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [masterProperties, masterSearch, masterTypeFilter, masterStatusFilter, masterTab]);

  const paginatedMasterProperties = useMemo(() => {
    const startIndex = (masterCurrentPage - 1) * masterEntriesPerPage;
    return filteredMasterProperties.slice(startIndex, startIndex + masterEntriesPerPage);
  }, [filteredMasterProperties, masterCurrentPage, masterEntriesPerPage]);

  const masterTotalPages = Math.ceil(filteredMasterProperties.length / masterEntriesPerPage) || 1;

  // -------------------------------------------------------------
  // Filtered Applications
  // -------------------------------------------------------------
  const filteredApplications = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();
    return applications.filter((app) => {
      const isArchived = app.status === 'Archived';
      if (queueTab === 'Active' && isArchived) return false;
      if (queueTab === 'Archived' && !isArchived) return false;

      const isSettled = app.paymentStatus === 'Paid' || app.status === 'Payment Completed';
      const isPending =
        !isSettled &&
        (app.status === 'For Payment' ||
          app.paymentStatus === 'Pending' ||
          Number(app.paymentAmount || 0) > 0);

      const matchesSearch =
        !lowerSearch ||
        app.referenceNumber.toLowerCase().includes(lowerSearch) ||
        app.applicantName.toLowerCase().includes(lowerSearch) ||
        app.propertyDetails.address.toLowerCase().includes(lowerSearch) ||
        (lowerSearch === 'settled' && isSettled) ||
        (lowerSearch === 'pending' && isPending) ||
        Boolean(app.officialReceiptNumber && app.officialReceiptNumber.toLowerCase().includes(lowerSearch));

      const matchesCategory = selectedCategory === 'ALL' || app.category === selectedCategory;

      let matchesStatus = true;
      if (selectedStatusFilter === 'PENDING_PAYMENT') {
        matchesStatus = isPending;
      } else if (selectedStatusFilter === 'SETTLED_PAYMENT') {
        matchesStatus = isSettled;
      } else if (selectedStatusFilter !== 'ALL') {
        matchesStatus = app.status === selectedStatusFilter;
      }

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [applications, searchTerm, selectedCategory, selectedStatusFilter, queueTab]);

  useEffect(() => {
    const stillValid = filteredApplications.some((app) => app.id === selectedAppId);
    if (!stillValid) {
      setSelectedAppId(filteredApplications.length > 0 ? filteredApplications[0].id : '');
    }
  }, [queueTab, filteredApplications, selectedAppId]);

  // -------------------------------------------------------------
  // Master Property Operations (Create/Edit, Archive, Restore, Delete)
  // -------------------------------------------------------------
  const handleSavePropertyRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProperty?.taxDeclarationNumber || !editingProperty?.ownerName) {
      triggerToast('Please provide Tax Declaration Number and Owner Name.', 'warning');
      return;
    }

    try {
      if (editingProperty.id) {
        await updateLguMasterRptRecord(editingProperty.id, editingProperty);
        triggerToast(`Property record ${editingProperty.taxDeclarationNumber} updated successfully.`, 'success');
      } else {
        await createLguMasterRptRecord({
          ...editingProperty,
          status: 'Active',
        });
        triggerToast(`New property assessment ${editingProperty.taxDeclarationNumber} registered.`, 'success');
      }
      setIsPropertyModalOpen(false);
      setEditingProperty(null);
      loadMasterRecords();
    } catch (err: any) {
      triggerToast(err.message || 'Failed to save property record.', 'error');
    }
  };

  const downloadSingleRecordCSV = (
    headers: string[],
    row: (string | number)[],
    filenamePrefix: string
  ) => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), row.join(',')].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleArchiveMasterProperty = async (prop: LguMasterProperty) => {
    if (await confirmAction(`Are you sure you want to move assessment record ${prop.taxDeclarationNumber} to the Archiver?`)) {
      try {
        await updateLguMasterRptRecord(prop.id, { status: 'Archived' });
        setMasterProperties((prev) =>
          prev.map((p) => (p.id === prop.id ? { ...p, status: 'Archived' } : p))
        );
        triggerToast(`Assessment record ${prop.taxDeclarationNumber} moved to Archiver.`, 'success');
      } catch (err: any) {
        triggerToast(err.message || 'Failed to archive assessment record.', 'error');
      }
    }
  };

  const handleRestoreMasterProperty = async (prop: LguMasterProperty) => {
    if (await confirmAction(`Are you sure you want to restore assessment record ${prop.taxDeclarationNumber} to Active?`)) {
      try {
        await updateLguMasterRptRecord(prop.id, { status: 'Active' });
        setMasterProperties((prev) =>
          prev.map((p) => (p.id === prop.id ? { ...p, status: 'Active' } : p))
        );
        triggerToast(`Assessment record ${prop.taxDeclarationNumber} restored to Active registry.`, 'success');
      } catch (err: any) {
        triggerToast(err.message || 'Failed to restore assessment record.', 'error');
      }
    }
  };

  const handleDeleteMasterProperty = async (prop: LguMasterProperty) => {
    if (!(await confirmAction(`WARNING: Are you sure you want to PERMANENTLY delete assessment record ${prop.taxDeclarationNumber}? A backup CSV will be downloaded first. This action cannot be undone.`, 'danger'))) {
      return;
    }

    try {
      downloadSingleRecordCSV(
        [
          'Tax Declaration No.',
          'Owner Name',
          'NewPSPIN',
          'Barangay',
          'Property Type',
          'Assessed Value',
          'Tax Due',
          'Payment Status',
          'Record Status',
        ],
        [
          `"${prop.taxDeclarationNumber}"`,
          `"${prop.ownerName}"`,
          `"${prop.newPspin}"`,
          `"${prop.barangay}"`,
          `"${prop.propertyType}"`,
          prop.assessedValue || 0,
          prop.balance || prop.totalAssessment || 0,
          `"${prop.paymentStatus}"`,
          `"${prop.status}"`,
        ],
        `QC_RPT_Backup_${prop.taxDeclarationNumber}`
      );

      if (!(await confirmAction(`Backup CSV for ${prop.taxDeclarationNumber} has been downloaded. Proceed with PERMANENT deletion?`, 'danger'))) {
        triggerToast('Deletion cancelled. Backup CSV was saved to your downloads.', 'warning');
        return;
      }

      await deleteLguMasterRptRecord(prop.id);
      setMasterProperties((prev) => prev.filter((p) => p.id !== prop.id));
      triggerToast(`Assessment record ${prop.taxDeclarationNumber} permanently deleted.`, 'success');
    } catch (err: any) {
      triggerToast(err.message || 'Failed to delete record.', 'error');
    }
  };

  const handleValuationChange = (marketVal: number, propType: string) => {
    let assessmentLevel = 0.2;
    if (propType === 'Commercial') assessmentLevel = 0.5;
    else if (propType === 'Industrial') assessmentLevel = 0.5;
    else if (propType === 'Building') assessmentLevel = 0.4;

    const assessedVal = marketVal * assessmentLevel;
    const basicTax = assessedVal * 0.015;
    const sefTax = assessedVal * 0.01;
    const totalDue = basicTax + sefTax;

    setEditingProperty((prev) => ({
      ...prev,
      marketValue: marketVal,
      assessedValue: assessedVal,
      basicTax,
      sefTax,
      totalAssessment: totalDue,
      balance: totalDue,
    }));
  };

  const handleExportMasterCSV = () => {
    const list = masterTab === 'Active'
      ? masterProperties.filter((p) => p.status !== 'Archived')
      : filteredMasterProperties;

    if (list.length === 0) {
      triggerToast('No records available to export.', 'warning');
      return;
    }

    const headers = [
      'Tax Declaration No.',
      'Owner Name',
      'NewPSPIN',
      'Barangay',
      'Property Type',
      'Assessed Value',
      'Tax Due',
      'Payment Status',
      'Record Status',
    ];

    const rows = list.map((p) => [
      `"${p.taxDeclarationNumber}"`,
      `"${p.ownerName}"`,
      `"${p.newPspin}"`,
      `"${p.barangay}"`,
      `"${p.propertyType}"`,
      p.assessedValue || 0,
      p.balance || p.totalAssessment || 0,
      `"${p.paymentStatus}"`,
      `"${p.status}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `QC_RPT_Master_Assessment_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast('Master assessment CSV exported successfully.', 'success');
  };

  // -------------------------------------------------------------
  // Citizen Application Operations (Status, Archive, Restore, Delete)
  // -------------------------------------------------------------
  const handleUpdateStatus = async (newStatus: ExtendedStatusType) => {
    if (!currentApp) return;

    try {
      const result = await updateRptApplicationStatus(
        String(currentApp.id),
        newStatus
      );

      const serverRecord = result?.record;
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);

      setApplications((prev) =>
        prev.map((app) => {
          if (app.id !== currentApp.id) return app;

          return {
            ...app,
            ...(serverRecord || {}),
            status: serverRecord?.status || newStatus,
            auditLogs: [
              {
                id: `LOG-${Date.now()}`,
                timestamp,
                officer: app.assignedOfficer || 'City Assessor',
                action: `Status advanced to "${newStatus}".`,
              },
              ...(app.auditLogs || []),
            ],
          };
        })
      );

      triggerToast(`Application workflow advanced to "${newStatus}".`, 'success');
    } catch (error: any) {
      console.error('Failed to update status:', error);
      triggerToast(error?.message || 'Failed to update application status.', 'error');
    }
  };

  const handleArchiveApplication = async (app: ExtendedApplicationRecord) => {
    if (await confirmAction(`Are you sure you want to move application ${app.referenceNumber} to the Archiver?`)) {
      try {
        await updateRptApplicationStatus(String(app.id), 'Archived');
        setApplications((prev) =>
          prev.map((a) => (a.id === app.id ? { ...a, status: 'Archived' } : a))
        );
        triggerToast(`Application ${app.referenceNumber} moved to Archiver.`, 'success');
      } catch (err: any) {
        triggerToast(err.message || 'Failed to archive application.', 'error');
      }
    }
  };

  const handleRestoreApplication = async (app: ExtendedApplicationRecord) => {
    if (await confirmAction(`Are you sure you want to restore application ${app.referenceNumber}?`)) {
      try {
        await updateRptApplicationStatus(String(app.id), 'Under Evaluation');
        setApplications((prev) =>
          prev.map((a) => (a.id === app.id ? { ...a, status: 'Under Evaluation' } : a))
        );
        triggerToast(`Application ${app.referenceNumber} restored to active evaluation.`, 'success');
      } catch (err: any) {
        triggerToast(err.message || 'Failed to restore application.', 'error');
      }
    }
  };

  const handlePermanentDeleteApplication = async (app: ExtendedApplicationRecord) => {
    if (!(await confirmAction(`WARNING: Are you sure you want to PERMANENTLY delete application ${app.referenceNumber}? A backup CSV will be downloaded first. This action cannot be undone.`, 'danger'))) {
      return;
    }

    try {
      downloadSingleRecordCSV(
        [
          'Reference Number',
          'Applicant Name',
          'Category',
          'TDN',
          'Payment Amount',
          'Payment Status',
          'Official Receipt No.',
          'Status',
        ],
        [
          `"${app.referenceNumber}"`,
          `"${app.applicantName}"`,
          `"${app.category}"`,
          `"${app.propertyDetails?.titleNumber || ''}"`,
          app.paymentAmount || 0,
          `"${app.paymentStatus || ''}"`,
          `"${app.officialReceiptNumber || ''}"`,
          `"${app.status}"`,
        ],
        `QC_RPT_Application_Backup_${app.referenceNumber}`
      );

      if (!(await confirmAction(`Backup CSV for ${app.referenceNumber} has been downloaded. Proceed with PERMANENT deletion?`, 'danger'))) {
        triggerToast('Deletion cancelled. Backup CSV was saved to your downloads.', 'warning');
        return;
      }

      await deleteRptApplication(app.id);
      setApplications((prev) => prev.filter((a) => a.id !== app.id));
      if (selectedAppId === app.id) {
        const remaining = applications.filter((a) => a.id !== app.id);
        setSelectedAppId(remaining.length > 0 ? remaining[0].id : '');
      }
      triggerToast(`Application ${app.referenceNumber} permanently deleted.`, 'success');
    } catch (err: any) {
      triggerToast(err.message || 'Failed to delete application.', 'error');
    }
  };

  const handleSetRPTServiceForPayment = async () => {
    if (!currentApp) return;

    const amount = Number(rptServiceAmountInput);
    const serviceName = currentApp.category || currentApp.service || 'RPT Service';

    if (!Number.isFinite(amount) || amount <= 0) {
      triggerToast(`Enter the assessed ${serviceName} fee before sending the application for payment.`, 'warning');
      return;
    }

    try {
      const result = await updateRptApplicationStatus(
        String(currentApp.id),
        'For Payment',
        `${serviceName} fee assessed and payment bill posted for citizen payment.`,
        {
          paymentAmount: amount,
          paymentStatus: 'Pending',
          paymentDueDate: currentApp.paymentDueDate,
        }
      );

      const serverRecord = result?.record;
      setApplications((prev) =>
        prev.map((app) =>
          app.id === currentApp.id
            ? {
              ...app,
              ...(serverRecord || {}),
              status: serverRecord?.status || 'For Payment',
              paymentAmount: amount,
              paymentStatus: serverRecord?.payment_status || 'Pending',
            }
            : app
        )
      );

      triggerToast(`${serviceName} assessment posted: ${formatCurrency(amount)}. Citizen can now pay online.`, 'success');
    } catch (error: any) {
      triggerToast(error?.message || `Failed to post the ${serviceName} assessment.`, 'error');
    }
  };

  const handleOpenCashierSettleModal = (app: ExtendedApplicationRecord) => {
    const fee = Number(app.paymentAmount || rptServiceAmountInput || 0);
    const autoOr = `eOR-RPT-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    setCashierOrNumber(app.officialReceiptNumber || autoOr);
    setCashierPaymentMethod('Treasury Cashier (Cash)');
    setCashierPaymentAmount(fee);
    setIsCashierSettleModalOpen(true);
  };

  const handleConfirmCashierSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentApp) return;
    if (cashierPaymentAmount <= 0) {
      triggerToast('Please enter a valid assessment fee amount to settle.', 'warning');
      return;
    }
    if (!cashierOrNumber.trim()) {
      triggerToast('Please enter an Official Receipt (eOR) Number.', 'warning');
      return;
    }

    setIsSubmittingSettle(true);
    try {
      const nowIso = new Date().toISOString();
      const result = await updateRptApplicationStatus(
        String(currentApp.id),
        'Payment Completed',
        `Payment settled over the counter: ${cashierOrNumber} via ${cashierPaymentMethod}`,
        {
          paymentAmount: cashierPaymentAmount,
          paymentStatus: 'Paid',
          officialReceiptNumber: cashierOrNumber.trim(),
          paymentMethod: cashierPaymentMethod,
          paymentReference: `MANUAL-${Date.now()}`,
          paymentDate: nowIso,
        }
      );

      const serverRecord = result?.record;
      setApplications((prev) =>
        prev.map((app) =>
          app.id === currentApp.id
            ? {
              ...app,
              ...(serverRecord || {}),
              status: 'Payment Completed',
              paymentStatus: 'Paid',
              paymentAmount: cashierPaymentAmount,
              officialReceiptNumber: cashierOrNumber.trim(),
              paymentMethod: cashierPaymentMethod,
              paymentDate: nowIso,
            }
            : app
        )
      );

      setIsCashierSettleModalOpen(false);
      triggerToast(`Payment Settled: Official e-OR ${cashierOrNumber} recorded!`, 'success');
      loadPayments();
    } catch (err: any) {
      triggerToast(err?.message || 'Failed to record settlement.', 'error');
    } finally {
      setIsSubmittingSettle(false);
    }
  };

  const handleQuickSettleMasterProperty = async (prop: LguMasterProperty) => {
    try {
      const autoOr = `eOR-RPT-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
      const paymentDate = new Date().toISOString();
      const paymentMethod = 'Treasury Cashier (Cash)';

      await updateLguMasterRptRecord(prop.id, {
        paymentStatus: 'Paid',
        balance: 0,
        amountPaid: prop.totalAssessment,
        officialReceiptNumber: autoOr,
        paymentMethod,
        paymentDate,
      });

      setMasterProperties((prev) =>
        prev.map((p) =>
          p.id === prop.id
            ? {
              ...p,
              paymentStatus: 'Paid',
              balance: 0,
              amountPaid: p.totalAssessment,
            }
            : p
        )
      );

      try {
        await recordPaymentLedgerEntry({
          taxDeclarationNumber: prop.taxDeclarationNumber,
          ownerName: prop.ownerName,
          amountPaid: prop.totalAssessment,
          officialReceiptNumber: autoOr,
          paymentDate,
          paymentMethod,
          quarterCoverage: 'Full Year',
          paymentOption: 'Full',
          status: 'Verified',
        });
      } catch (ledgerErr) {
        console.error('Failed to record payment ledger entry for', prop.taxDeclarationNumber, ledgerErr);
      }

      triggerToast(`Assessment for ${prop.taxDeclarationNumber} settled successfully!`, 'success');
      loadPayments();
    } catch (err: any) {
      triggerToast(err?.message || 'Failed to settle property assessment.', 'error');
    }
  };

  const combinedSettledPayments = useMemo(() => {
    const list: Array<{
      id: string | number;
      receiptNumber: string;
      identifier: string;
      payor: string;
      paymentMethod: string;
      category: string;
      paymentDate: string;
      amount: number;
      type: 'MASTER' | 'APPLICATION';
    }> = [];

    paymentsLedger.forEach((p) => {
      list.push({
        id: `PAY-${p.id}`,
        receiptNumber: p.officialReceiptNumber || `OR-${p.id}`,
        identifier: p.taxDeclarationNumber || '—',
        payor: p.ownerName,
        paymentMethod: p.paymentMethod || 'Online Gateway',
        category: `Annual Property Tax (${p.quarterCoverage || 'Full Year'})`,
        paymentDate: p.paymentDate || '',
        amount: Number(p.amountPaid || 0),
        type: 'MASTER',
      });
    });

    applications.forEach((a) => {
      if (a.paymentStatus === 'Paid' || a.status === 'Payment Completed') {
        list.push({
          id: `APP-PAY-${a.id}`,
          receiptNumber: a.officialReceiptNumber || `eOR-RPT-${a.id.toString().slice(0, 8)}`,
          identifier: a.referenceNumber || a.propertyDetails?.titleNumber || '—',
          payor: a.applicantName,
          paymentMethod: a.paymentMethod || 'Treasury / PayMongo',
          category: `Service Fee (${a.category})`,
          paymentDate: a.paymentDate || a.submissionDate || '',
          amount: Number(a.paymentAmount || 0),
          type: 'APPLICATION',
        });
      }
    });

    return list.sort((a, b) => {
      const dateA = a.paymentDate ? new Date(a.paymentDate).getTime() : 0;
      const dateB = b.paymentDate ? new Date(b.paymentDate).getTime() : 0;
      return dateB - dateA;
    });
  }, [paymentsLedger, applications]);

  const handleDigitalRelease = async () => {
    if (!currentApp) return;
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const qrCode = `QC-RPT-${currentApp.referenceNumber}-${Date.now()}`;

    const releasedApp: ExtendedApplicationRecord = {
      ...currentApp,
      status: 'Digital Certificate Issued',
      digitalRelease: {
        releaseMethod: 'Digital',
        releasedAt: timestamp,
        releasedBy: 'City Assessor Officer',
        certificateType: 'Tax Declaration / CTC',
        digitalSignatureStatus: 'Signed',
        qrVerificationCode: qrCode,
        downloadCount: 1,
        citizenNotified: true,
      },
    };

    try {
      await updateRptApplicationStatus(String(currentApp.id), 'Digital Certificate Issued');
    } catch (err) {
      console.error('Failed to persist Digital Certificate Issued status:', err);
    }

    setApplications((prev) =>
      prev.map((a) => (a.id === currentApp.id ? releasedApp : a))
    );
    triggerToast(`Digital Tax Certificate issued for ${currentApp.referenceNumber}.`, 'success');
  };

  // -------------------------------------------------------------
  // Document Inspection & Preview Pop-Up Tab Modal Handlers
  // -------------------------------------------------------------
  const createDocumentFallbackSvg = (title: string, docStatus = 'VERIFIED ON FILE') => {
    const cleanTitle = title.replace(/^\d+-\d+-/, '').replace(/\.[^/.]+$/, '').replace(/[._-]/g, ' ');
    const ext = (title.split('.').pop() || 'DOC').toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1050" width="100%" height="100%">
      <rect width="800" height="1050" fill="#F8FAFC" rx="16"/>
      <rect x="20" y="20" width="760" height="1010" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="2" rx="12"/>
      <rect x="40" y="40" width="720" height="110" fill="#0B3B60" rx="8"/>
      <text x="400" y="80" fill="#93C5FD" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="700" letter-spacing="2" text-anchor="middle">REPUBLIC OF THE PHILIPPINES</text>
      <text x="400" y="115" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="900" text-anchor="middle">CITY ASSESSOR &amp; TREASURY OFFICE</text>
      
      <rect x="60" y="190" width="680" height="400" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5" rx="10"/>
      <rect x="60" y="190" width="680" height="42" fill="#F1F5F9" rx="10"/>
      <text x="90" y="217" fill="#475569" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="800" letter-spacing="1">ATTACHED DOCUMENT RECORD</text>
      
      <text x="90" y="275" fill="#64748B" font-family="system-ui, -apple-system, sans-serif" font-size="13">Document Name:</text>
      <text x="250" y="275" fill="#0F172A" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700">${title}</text>
      
      <text x="90" y="325" fill="#64748B" font-family="system-ui, -apple-system, sans-serif" font-size="13">Document Type:</text>
      <text x="250" y="325" fill="#0284C7" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700">${ext} Document</text>
      
      <text x="90" y="375" fill="#64748B" font-family="system-ui, -apple-system, sans-serif" font-size="13">Classification:</text>
      <text x="250" y="375" fill="#0F172A" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="600">${cleanTitle}</text>
      
      <text x="90" y="425" fill="#64748B" font-family="system-ui, -apple-system, sans-serif" font-size="13">Verification Status:</text>
      <rect x="250" y="407" width="160" height="26" fill="#DCFCE7" rx="6"/>
      <text x="330" y="425" fill="#166534" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="800" text-anchor="middle">${docStatus}</text>

      <text x="90" y="475" fill="#64748B" font-family="system-ui, -apple-system, sans-serif" font-size="13">Registry Archive:</text>
      <text x="250" y="475" fill="#0F172A" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="600">Quezon City Local Government Unit</text>

      <line x1="90" y1="510" x2="710" y2="510" stroke="#E2E8F0" stroke-width="1"/>
      <text x="400" y="545" fill="#64748B" font-family="system-ui, -apple-system, sans-serif" font-size="12" text-anchor="middle">This document is certified and recorded in the Real Property Tax management archive.</text>

      <rect x="60" y="630" width="680" height="240" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5" rx="10"/>
      <text x="90" y="670" fill="#0B3B60" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700">DOCUMENT PREVIEW CERTIFICATION</text>
      <text x="90" y="700" fill="#475569" font-family="system-ui, -apple-system, sans-serif" font-size="12">Registered under Application Filing. Official documentation acknowledged by treasury evaluation officers.</text>
      <text x="90" y="725" fill="#64748B" font-family="system-ui, -apple-system, sans-serif" font-size="12">Documentary proof is recognized for Assessment, Tax Declaration, and Transfer of Ownership procedures.</text>

      <circle cx="620" cy="750" r="50" fill="none" stroke="#0284C7" stroke-width="2" stroke-dasharray="4 2"/>
      <circle cx="620" cy="750" r="44" fill="none" stroke="#0B3B60" stroke-width="1.5"/>
      <text x="620" y="746" fill="#0B3B60" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="900" text-anchor="middle">OFFICIAL</text>
      <text x="620" y="760" fill="#0284C7" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="900" text-anchor="middle">ARCHIVE</text>

      <text x="90" y="930" fill="#0F172A" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700">CITY ASSESSOR &amp; TREASURER</text>
      <text x="90" y="950" fill="#64748B" font-family="system-ui, -apple-system, sans-serif" font-size="12">Document Repository &amp; Compliance Office</text>
    </svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  };

  const getResolvedDocUrl = (doc: ApplicationDocument): string => {
    let targetUrl = doc.url || '';
    if (!targetUrl || targetUrl.trim() === '') targetUrl = doc.name;
    if (targetUrl.startsWith('data:') || targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
      return targetUrl;
    } else if (targetUrl.startsWith('/uploads/')) {
      return `${API_BASE_URL}${targetUrl}`;
    } else if (targetUrl.trim() !== '') {
      return `${API_BASE_URL}/uploads/${targetUrl}`;
    }
    return createDocumentFallbackSvg(doc.name, doc.status === 'Verified' ? 'VERIFIED' : 'PENDING');
  };

  const handleOpenDocPreview = (docList: ApplicationDocument[], initialIndex = 0) => {
    if (!docList || docList.length === 0) return;
    setPreviewDocList(docList);
    setActiveDocIndex(Math.max(0, Math.min(initialIndex, docList.length - 1)));
    setPreviewTabMode('viewer');
    setPreviewZoom(100);
    setPreviewDocError(false);
    setPreviewModalOpen(true);
  };

  const handleToggleDocStatus = (docIndex: number, newStatus: 'Verified' | 'Rejected' | 'Pending') => {
    if (!currentApp || !previewDocList[docIndex]) return;
    const targetDoc = previewDocList[docIndex];

    const updatedDocs = previewDocList.map((d, i) =>
      i === docIndex ? { ...d, status: newStatus } : d
    );
    setPreviewDocList(updatedDocs);

    // Update in application documents
    setApplications((prev) =>
      prev.map((app) =>
        app.id === currentApp.id ? { ...app, documents: updatedDocs } : app
      )
    );

    triggerToast(`Document "${targetDoc.name}" marked as ${newStatus}.`, 'success');
  };

  const activeDoc = previewDocList[activeDocIndex] || null;
  const activeDocUrl = activeDoc ? getResolvedDocUrl(activeDoc) : '';

  return (
    <div
      style={{
        marginLeft: isCollapsed ? '80px' : '256px',
        width: isCollapsed ? 'calc(100% - 80px)' : 'calc(100% - 256px)',
      }}
      className="min-h-screen bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 p-6 pt-24 transition-all duration-300 box-border flex flex-col font-sans"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-70 animate-in fade-in slide-in-from-top-4 duration-300">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 text-xs font-bold ${toastMessage.type === 'success'
              ? 'bg-emerald-950 text-emerald-200 border-emerald-800'
              : toastMessage.type === 'warning'
                ? 'bg-amber-950 text-amber-200 border-amber-800'
                : 'bg-rose-950 text-rose-200 border-rose-800'
              }`}
          >
            <i
              className={`fa-solid ${toastMessage.type === 'success'
                ? 'fa-circle-check'
                : toastMessage.type === 'warning'
                  ? 'fa-triangle-exclamation'
                  : 'fa-circle-exclamation'
                }`}
            ></i>
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* In-App Confirmation Modal (replaces window.confirm) */}
      {confirmState && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-5">
            <div className="flex items-start gap-3">
              <span
                className={`p-2.5 rounded-xl ${confirmState.tone === 'danger'
                  ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                  }`}
              >
                <i
                  className={`fa-solid ${confirmState.tone === 'danger' ? 'fa-triangle-exclamation' : 'fa-circle-question'} text-sm`}
                ></i>
              </span>
              <div className="flex-1 pt-0.5">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  {confirmState.tone === 'danger' ? 'Confirm Permanent Action' : 'Please Confirm'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  {confirmState.message}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => resolveConfirm(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => resolveConfirm(true)}
                className={`px-5 py-2 rounded-xl text-white font-bold text-xs cursor-pointer shadow-md transition ${confirmState.tone === 'danger'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-blue-600 hover:bg-blue-700'
                  }`}
              >
                {confirmState.tone === 'danger' ? 'Yes, Proceed' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Admin Header Card */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 bg-white dark:bg-slate-900/80 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs backdrop-blur-md">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-blue-600"></span>
            <span className="text-[11px] font-semibold tracking-wider text-blue-600 dark:text-blue-400 uppercase">
              Office of the City Assessor &amp; Treasury
            </span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Real Property Tax &amp; Assessment Hub
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            QC E-Services RPT Search DB, Group Bill Sets, Assessment Valuation &amp; Electronic Official Receipts
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={refreshAllData}
            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center gap-2 shadow-xs"
          >
            <i className="fa-solid fa-arrows-rotate text-[11px]"></i> Refresh List
          </button>
          <button
            onClick={handleExportMasterCSV}
            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center gap-2 shadow-xs"
          >
            <i className="fa-solid fa-download text-[11px]"></i> Export Masterlist
          </button>
          <button
            onClick={() => {
              setEditingProperty({
                taxDeclarationNumber: '',
                newPspin: '',
                ownerName: '',
                barangay: '',
                propertyType: 'Residential',
                marketValue: 1000000,
                assessedValue: 200000,
                basicTax: 3000,
                sefTax: 2000,
                totalAssessment: 5000,
                paymentStatus: 'Unpaid',
                status: 'Active',
              });
              setIsPropertyModalOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-2"
          >
            <i className="fa-solid fa-plus text-[11px]"></i> New Assessment Record
          </button>
        </div>
      </div>

      {/* KPI Summary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-900/80 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex justify-between items-start">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Registered Parcels</p>
            <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <i className="fa-solid fa-file-contract text-xs"></i>
            </span>
          </div>
          <h4 className="text-2xl font-bold text-slate-900 dark:text-white mt-3">{metrics.totalMaster}</h4>
        </div>

        <div className="bg-white dark:bg-slate-900/80 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex justify-between items-start">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Citizen Applications</p>
            <span className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <i className="fa-solid fa-clock-rotate-left text-xs"></i>
            </span>
          </div>
          <h4 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-3">{metrics.activeApps}</h4>
        </div>

        <div className="bg-white dark:bg-slate-900/80 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex justify-between items-start">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">RPT Revenue Settled</p>
            <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <i className="fa-solid fa-peso-sign text-xs"></i>
            </span>
          </div>
          <h4 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-3">
            {formatCurrency(metrics.totalPaidRevenue)}
          </h4>
          <p className="mt-2 text-[11px] text-slate-400">
            {metrics.totalSettledReceipts} verified e-Receipts settled
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900/80 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex justify-between items-start">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Pending Receivables &amp; Fees</p>
            <span className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
              <i className="fa-solid fa-triangle-exclamation text-xs"></i>
            </span>
          </div>
          <h4 className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-3">
            {formatCurrency(metrics.totalPendingReceivables)}
          </h4>
          <p className="mt-2 text-[11px] text-slate-400">
            {metrics.pendingMasterCount} unpaid parcels · {metrics.pendingPaymentAppsCount} pending fees
          </p>
        </div>
      </div>

      {/* Main View Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-4 mb-6">
        <button
          onClick={() => switchMainViewTab('master')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${mainViewTab === 'master'
            ? 'bg-blue-600 text-white shadow-md'
            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
        >
          <i className="fa-solid fa-database text-xs"></i>
          <span>Master Database</span>
        </button>

        <button
          onClick={() => switchMainViewTab('queue')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${mainViewTab === 'queue'
            ? 'bg-blue-600 text-white shadow-md'
            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
        >
          <i className="fa-solid fa-list-check text-xs"></i>
          <span>Citizen Applications</span>
        </button>

        <button
          onClick={() => switchMainViewTab('payments')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${mainViewTab === 'payments'
            ? 'bg-blue-600 text-white shadow-md'
            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
        >
          <i className="fa-solid fa-receipt text-xs"></i>
          <span>Payment Ledger</span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* 1. MASTER DATABASE VIEW TAB */}
      {/* ============================================================ */}
      {mainViewTab === 'master' && (
        <section className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            {/* Master Subtab Switcher: Active vs Archiver */}
            <div className="flex space-x-1 bg-slate-200/60 dark:bg-slate-800/60 p-1.5 rounded-xl w-fit">
              <button
                onClick={() => setMasterTab('Active')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${masterTab === 'Active'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
              >
                <i className="fa-solid fa-list-check text-xs"></i>
                <span>Active Registry</span>
              </button>

              <button
                onClick={() => setMasterTab('Archived')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${masterTab === 'Archived'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
              >
                <i className="fa-solid fa-box-archive text-xs"></i>
                <span>Archiver</span>
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Show entries:</span>
              <select
                value={masterEntriesPerPage}
                onChange={(e) => {
                  setMasterEntriesPerPage(Number(e.target.value));
                  setMasterCurrentPage(1);
                }}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs outline-none font-semibold text-slate-700 dark:text-slate-300"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          {/* Master Filters Bar */}
          <div className="p-4 bg-slate-50/70 dark:bg-slate-950/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5 text-xs">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Search Records</label>
              <div className="relative">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input
                  type="text"
                  value={masterSearch}
                  onChange={(e) => {
                    setMasterSearch(e.target.value);
                    setMasterCurrentPage(1);
                  }}
                  placeholder="Search TDN, Owner, PSPIN, Barangay..."
                  className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-all text-xs"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 text-xs">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Property Type</label>
              <select
                value={masterTypeFilter}
                onChange={(e) => {
                  setMasterTypeFilter(e.target.value);
                  setMasterCurrentPage(1);
                }}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-all text-xs font-semibold"
              >
                <option value="ALL">All Property Types</option>
                <option value="Residential">Residential</option>
                <option value="Commercial">Commercial</option>
                <option value="Industrial">Industrial</option>
                <option value="Building">Building</option>
                <option value="Land">Land</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5 text-xs">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Payment Status</label>
              <select
                value={masterStatusFilter}
                onChange={(e) => {
                  setMasterStatusFilter(e.target.value);
                  setMasterCurrentPage(1);
                }}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-all text-xs font-semibold"
              >
                <option value="ALL">All Payment Statuses (All)</option>
                <option value="Paid">Settled (Paid)</option>
                <option value="Unpaid">Pending (Unpaid)</option>
              </select>
            </div>
          </div>

          {/* Master Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4">Tax Declaration No.</th>
                    <th className="p-4">Owner Name</th>
                    <th className="p-4">NewPSPIN</th>
                    <th className="p-4">Barangay</th>
                    <th className="p-4">Type</th>
                    <th className="p-4 text-right">Assessed Value</th>
                    <th className="p-4 text-right">Tax Due</th>
                    <th className="p-4 text-center">Payment Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedMasterProperties.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400 italic">
                        {masterTab === 'Active'
                          ? 'No active property assessment records match your search filter.'
                          : 'No archived records found in the archiver.'}
                      </td>
                    </tr>
                  ) : (
                    paginatedMasterProperties.map((prop) => (
                      <tr key={prop.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                        <td className="p-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {prop.taxDeclarationNumber}
                        </td>
                        <td className="p-4 font-semibold text-slate-900 dark:text-white">
                          {prop.ownerName}
                        </td>
                        <td className="p-4 font-mono text-slate-500 text-[11px]">
                          {prop.newPspin}
                        </td>
                        <td className="p-4 text-slate-600 dark:text-slate-300">
                          {prop.barangay}
                        </td>
                        <td className="p-4">
                          <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-2 py-0.5 rounded text-[10px]">
                            {prop.propertyType}
                          </span>
                        </td>
                        <td className="p-4 text-right font-mono font-semibold">
                          {formatCurrency(prop.assessedValue)}
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {formatCurrency(prop.balance || prop.totalAssessment)}
                        </td>
                        <td className="p-4 text-center">
                          {prop.paymentStatus === 'Paid' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800">
                              <i className="fa-solid fa-circle-check text-[9px]"></i> Settled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800">
                              <i className="fa-solid fa-clock text-[9px]"></i> Pending
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right space-x-1.5 whitespace-nowrap">
                          {prop.status !== 'Archived' ? (
                            <>
                              {prop.paymentStatus !== 'Paid' && (
                                <button
                                  onClick={() => handleQuickSettleMasterProperty(prop)}
                                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition cursor-pointer"
                                  title="Quick Settle Assessment"
                                >
                                  <i className="fa-solid fa-cash-register mr-1"></i> Settle
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setEditingProperty(prop);
                                  setIsPropertyModalOpen(true);
                                }}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition cursor-pointer"
                                title="Edit Property"
                              >
                                <i className="fa-solid fa-pen-to-square mr-1"></i> Edit
                              </button>
                              <button
                                onClick={() => handleArchiveMasterProperty(prop)}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100 transition cursor-pointer"
                                title="Move to Archiver"
                              >
                                <i className="fa-solid fa-box-archive mr-1"></i> Archive
                              </button>
                              <button
                                onClick={() => handleDeleteMasterProperty(prop)}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 hover:bg-rose-100 transition cursor-pointer"
                                title="Delete Property"
                              >
                                <i className="fa-solid fa-trash-can mr-1"></i> Delete
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleRestoreMasterProperty(prop)}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 transition cursor-pointer"
                                title="Restore to Active"
                              >
                                <i className="fa-solid fa-rotate-left mr-1"></i> Restore
                              </button>
                              <button
                                onClick={() => handleDeleteMasterProperty(prop)}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 hover:bg-rose-100 transition cursor-pointer"
                                title="Permanent Delete"
                              >
                                <i className="fa-solid fa-trash-can mr-1"></i> Permanent Delete
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-500">
              <div>
                Showing{' '}
                <strong className="text-slate-800 dark:text-slate-200">
                  {filteredMasterProperties.length === 0
                    ? 0
                    : (masterCurrentPage - 1) * masterEntriesPerPage + 1}
                </strong>{' '}
                to{' '}
                <strong className="text-slate-800 dark:text-slate-200">
                  {Math.min(masterCurrentPage * masterEntriesPerPage, filteredMasterProperties.length)}
                </strong>{' '}
                of <strong className="text-slate-800 dark:text-slate-200">{filteredMasterProperties.length}</strong>{' '}
                records
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={masterCurrentPage <= 1}
                  onClick={() => setMasterCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer font-semibold"
                >
                  Previous
                </button>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  Page {masterCurrentPage} of {masterTotalPages}
                </span>
                <button
                  disabled={masterCurrentPage >= masterTotalPages}
                  onClick={() => setMasterCurrentPage((p) => Math.min(masterTotalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer font-semibold"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ============================================================ */}
      {/* 2. CITIZEN APPLICATIONS VIEW TAB */}
      {/* ============================================================ */}
      {mainViewTab === 'queue' && (
        <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-[680px]">
          {/* Left Column: Applications List & Queue Subtab */}
          <div className="w-full lg:w-[420px] xl:w-[460px] flex-shrink-0 flex flex-col gap-4">
            <div className="bg-white dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col gap-3">
              {/* Queue Subtabs: Active vs Archiver */}
              <div className="flex space-x-1 bg-slate-200/60 dark:bg-slate-800/60 p-1.5 rounded-xl w-full">
                <button
                  onClick={() => setQueueTab('Active')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${queueTab === 'Active'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                  <i className="fa-solid fa-list-check text-xs"></i>
                  <span>Active Processing</span>
                </button>

                <button
                  onClick={() => setQueueTab('Archived')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${queueTab === 'Archived'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                  <i className="fa-solid fa-box-archive text-xs"></i>
                  <span>Archiver</span>
                </button>
              </div>

              {/* Search & Filter */}
              <div className="relative">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search application reference or applicant..."
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 outline-none"
                />
              </div>

              <div className="flex gap-2">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-1/2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 outline-none"
                >
                  <option value="ALL">All Services</option>
                  <option value="Transfer of Ownership">Transfer of Ownership</option>
                  <option value="Consolidation / Segregation">Consolidation / Segregation</option>
                  <option value="New Assessment / Reassessment / Reclassification">New Assessment</option>
                  <option value="Correction / Updating / Revision">Correction</option>
                  <option value="Declaration of New / Undeclared Land">Undeclared Land</option>
                </select>

                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="w-1/2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 outline-none"
                >
                  <option value="ALL">All Applications</option>
                  <option value="PENDING_PAYMENT">Pending Payment</option>
                  <option value="SETTLED_PAYMENT">Settled Payment</option>
                  <option value="Under Evaluation">Under Evaluation</option>
                  <option value="For Payment">For Payment</option>
                  <option value="Payment Completed">Payment Completed</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            </div>

            {/* Applications List Scroll Area */}
            <div className="flex-1 bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col min-h-[480px]">
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 p-3 space-y-2">
                {filteredApplications.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs italic">
                    {queueTab === 'Active'
                      ? 'No active citizen applications found matching criteria.'
                      : 'No archived applications currently stored in archiver.'}
                  </div>
                ) : (
                  filteredApplications.map((app) => (
                    <div
                      key={app.id}
                      onClick={() => setSelectedAppId(app.id)}
                      className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col gap-1.5 ${currentApp?.id === app.id
                        ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-400 dark:border-blue-700 shadow-xs'
                        : 'border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
                          {app.referenceNumber}
                        </span>
                        <div className="flex items-center gap-1">
                          {app.paymentStatus === 'Paid' || app.status === 'Payment Completed' ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <i className="fa-solid fa-circle-check text-[8px]"></i> Settled
                            </span>
                          ) : app.status === 'For Payment' || (Number(app.paymentAmount || 0) > 0 && app.paymentStatus === 'Pending') ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              <i className="fa-solid fa-hourglass-half text-[8px]"></i> Due: {formatCurrency(app.paymentAmount || 0)}
                            </span>
                          ) : null}
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${app.status === 'Approved'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : app.status === 'Archived'
                                ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                : app.status === 'Rejected'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                              }`}
                          >
                            {app.status}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-between items-end">
                        <div>
                          <p className="font-bold text-xs text-slate-900 dark:text-white">{app.applicantName}</p>
                          <p className="text-[11px] text-slate-500 truncate max-w-[220px]">{app.category}</p>
                        </div>

                        <div className="flex items-center gap-1">
                          {app.status !== 'Archived' ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleArchiveApplication(app);
                              }}
                              className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition"
                              title="Archive Application"
                            >
                              <i className="fa-solid fa-box-archive text-xs"></i>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRestoreApplication(app);
                              }}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition"
                              title="Restore Application"
                            >
                              <i className="fa-solid fa-rotate-left text-xs"></i>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Application Details & Verification Panel */}
          <div className="flex-1 bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col overflow-hidden min-h-[680px]">
            {!currentApp ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-xs text-slate-400">
                <i className="fa-solid fa-file-circle-check text-4xl text-slate-300 dark:text-slate-700 mb-3"></i>
                <span>Select an application from the queue to review documents and proceed with assessment.</span>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Header & Main Actions */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400 tracking-wider">
                      CONTROL REFERENCE NUMBER
                    </span>
                    <h2 className="text-xl font-black font-mono text-slate-900 dark:text-white">
                      {currentApp.referenceNumber}
                    </h2>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                      {currentApp.category} • Filed on {currentApp.submissionDate || 'N/A'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {currentApp.status !== 'Archived' ? (
                      <>
                        <button
                          onClick={handleDigitalRelease}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer shadow-sm flex items-center gap-1.5"
                        >
                          <i className="fa-solid fa-stamp text-xs"></i> Approve &amp; Issue Certificate
                        </button>

                        <button
                          onClick={() => handleArchiveApplication(currentApp)}
                          className="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100 border border-amber-200 dark:border-amber-800 font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                        >
                          <i className="fa-solid fa-box-archive text-xs"></i> Move to Archiver
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleRestoreApplication(currentApp)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer shadow-sm flex items-center gap-1.5"
                        >
                          <i className="fa-solid fa-rotate-left text-xs"></i> Restore Application
                        </button>

                        <button
                          onClick={() => handlePermanentDeleteApplication(currentApp)}
                          className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer shadow-sm flex items-center gap-1.5"
                        >
                          <i className="fa-solid fa-trash-can text-xs"></i> Permanent Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Applicant & Property Details Card */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50/70 dark:bg-slate-950/50 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-xs">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Applicant Details</span>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">{currentApp.applicantName}</p>
                    <p className="text-slate-500 mt-0.5">Email: {currentApp.applicantEmail || 'Not provided'}</p>
                    <p className="text-slate-500">Phone: {currentApp.applicantPhone || 'Not provided'}</p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Target Property</span>
                    <p className="font-mono font-bold text-slate-900 dark:text-white">
                      TDN: {currentApp.propertyDetails.titleNumber || 'Pending'}
                    </p>
                    <p className="font-mono text-slate-500 text-[11px]">PIN: {currentApp.propertyDetails.pin || 'Pending'}</p>
                    <p className="text-slate-500 mt-0.5">{currentApp.propertyDetails.address || 'Address unrecorded'}</p>
                  </div>
                </div>

                {/* Workflow Status Advance Toolbar */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Assessor Workflow Stage:</span>
                  <div className="flex flex-wrap gap-2">
                    {(['For Review', 'Under Evaluation', 'For Compliance', 'Processing', 'Approved', 'Ready for Release', 'Rejected'] as ExtendedStatusType[]).map((st) => (
                      <button
                        key={st}
                        onClick={() => handleUpdateStatus(st)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${currentApp.status === st
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-blue-400'
                          }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Assessment Billing / Service Fee Card with Pending & Settled Detection */}
                {currentApp.paymentStatus === 'Paid' || currentApp.status === 'Payment Completed' ? (
                  <div className="p-5 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800/80 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-emerald-100 dark:border-emerald-900/60">
                      <div className="flex items-center gap-2.5">
                        <span className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                          <i className="fa-solid fa-circle-check text-sm"></i>
                        </span>
                        <div>
                          <h3 className="text-xs font-black uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                            Payment Settled &amp; Verified
                          </h3>
                          <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                            Official electronic receipt generated and transaction recorded in Treasury Ledger.
                          </p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-600 text-white shadow-xs">
                        <i className="fa-solid fa-check-double text-[10px]"></i> Settled: {formatCurrency(Number(currentApp.paymentAmount))}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                      <div className="bg-white/90 dark:bg-slate-900/80 rounded-xl p-2.5 border border-emerald-100 dark:border-emerald-900/50">
                        <span className="text-slate-400 block">Amount Settled</span>
                        <strong className="font-mono text-slate-900 dark:text-white text-xs">{formatCurrency(Number(currentApp.paymentAmount))}</strong>
                      </div>
                      <div className="bg-white/90 dark:bg-slate-900/80 rounded-xl p-2.5 border border-emerald-100 dark:border-emerald-900/50">
                        <span className="text-slate-400 block">Official e-OR No.</span>
                        <strong className="font-mono text-emerald-600 dark:text-emerald-400 text-xs">{currentApp.officialReceiptNumber || 'eOR-VERIFIED'}</strong>
                      </div>
                      <div className="bg-white/90 dark:bg-slate-900/80 rounded-xl p-2.5 border border-emerald-100 dark:border-emerald-900/50">
                        <span className="text-slate-400 block">Payment Method</span>
                        <strong className="text-slate-900 dark:text-white">{currentApp.paymentMethod || 'PayMongo / Gateway'}</strong>
                      </div>
                      <div className="bg-white/90 dark:bg-slate-900/80 rounded-xl p-2.5 border border-emerald-100 dark:border-emerald-900/50">
                        <span className="text-slate-400 block">Date Settled</span>
                        <strong className="font-mono text-slate-900 dark:text-white">
                          {currentApp.paymentDate ? new Date(currentApp.paymentDate).toLocaleDateString() : 'Confirmed'}
                        </strong>
                      </div>
                    </div>
                  </div>
                ) : Number(currentApp.paymentAmount || 0) > 0 || currentApp.status === 'For Payment' ? (
                  <div className="p-5 bg-amber-50/70 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-900/70 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-amber-200/60 dark:border-amber-900/60">
                      <div className="flex items-center gap-2.5">
                        <span className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
                          <i className="fa-solid fa-hourglass-half text-sm"></i>
                        </span>
                        <div>
                          <h3 className="text-xs font-black uppercase tracking-wide text-amber-900 dark:text-amber-200">
                            Payment Pending from Citizen
                          </h3>
                          <p className="text-[11px] text-amber-700 dark:text-amber-400">
                            Assessment posted. Awaiting citizen payment or record an in-person cashier settlement below.
                          </p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-500 text-white shadow-xs">
                        <i className="fa-solid fa-clock text-[10px]"></i> Fee Due: {formatCurrency(Number(currentApp.paymentAmount || rptServiceAmountInput || 0))}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end pt-1">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-300 mb-1">
                          Modify Assessment Fee (₱)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">₱</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={rptServiceAmountInput}
                            onChange={(e) => setRptServiceAmountInput(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-white dark:bg-slate-900 border border-amber-200 dark:border-slate-700 rounded-xl pl-7 pr-3 py-2.5 text-sm font-black outline-none focus:ring-2 focus:ring-amber-400 text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleSetRPTServiceForPayment()}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                      >
                        <i className="fa-solid fa-arrows-rotate text-[11px]"></i> Update Bill
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenCashierSettleModal(currentApp)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-md transition cursor-pointer flex items-center gap-2"
                      >
                        <i className="fa-solid fa-cash-register text-xs"></i> Record Cashier Settlement
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 bg-blue-50/60 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-900 space-y-3">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wide text-blue-900 dark:text-blue-200 flex items-center gap-2">
                        <i className="fa-solid fa-calculator text-blue-600"></i>
                        RPT Service Assessment &amp; Payment Billing
                      </h3>
                      <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">
                        Assign statutory evaluation fees. Once posted, the citizen can settle this payment via PayMongo or at the City Hall counter.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-300 mb-1">
                          Assessed Service Fee (₱)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">₱</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={rptServiceAmountInput}
                            onChange={(e) => setRptServiceAmountInput(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-white dark:bg-slate-900 border border-blue-200 dark:border-slate-700 rounded-xl pl-7 pr-3 py-2.5 text-sm font-black outline-none focus:ring-2 focus:ring-blue-400 text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleSetRPTServiceForPayment()}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
                      >
                        <i className="fa-solid fa-file-invoice-dollar"></i> Post Service Assessment Bill
                      </button>
                    </div>
                  </div>
                )}

                {/* Documentary Verification Vault Section */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <i className="fa-solid fa-folder-open text-blue-600"></i>
                      Documentary Verification Vault ({currentApp.documents.length})
                    </h3>

                    {currentApp.documents.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleOpenDocPreview(currentApp.documents, 0)}
                        className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i> Open Document Inspector
                      </button>
                    )}
                  </div>

                  {currentApp.documents.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800">
                      No documents currently attached to this filing.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {currentApp.documents.map((doc, idx) => (
                        <div
                          key={doc.id || idx}
                          className="p-4 border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-950/40 space-y-2.5 hover:border-blue-300 transition"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              <i className={`fa-solid ${doc.type === 'PDF' ? 'fa-file-pdf text-rose-500' : 'fa-file-image text-blue-500'} text-base shrink-0`}></i>
                              <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate" title={doc.name}>
                                {doc.name}
                              </span>
                            </div>
                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${doc.status === 'Verified'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : doc.status === 'Rejected'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                }`}
                            >
                              {doc.status}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleOpenDocPreview(currentApp.documents, idx)}
                            className="w-full py-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 transition cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                          >
                            <i className="fa-solid fa-eye text-xs"></i> Inspect Document
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. PAYMENT LEDGER VIEW TAB */}
      {/* ============================================================ */}
      {mainViewTab === 'payments' && (
        <section className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Category Filter Tabs */}
            <div className="flex space-x-1 bg-slate-200/60 dark:bg-slate-800/60 p-1.5 rounded-xl w-full sm:w-auto">
              <button
                onClick={() => setLedgerCategoryFilter('ALL')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${ledgerCategoryFilter === 'ALL'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
              >
                <i className="fa-solid fa-receipt text-xs"></i>
                <span>All Settled</span>
              </button>

              <button
                onClick={() => setLedgerCategoryFilter('MASTER')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${ledgerCategoryFilter === 'MASTER'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
              >
                <i className="fa-solid fa-landmark text-xs"></i>
                <span>Annual Taxes</span>
              </button>

              <button
                onClick={() => setLedgerCategoryFilter('APPLICATION')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${ledgerCategoryFilter === 'APPLICATION'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
              >
                <i className="fa-solid fa-file-invoice text-xs"></i>
                <span>Application Fees</span>
              </button>
            </div>

            <div className="text-xs text-slate-500 font-semibold flex items-center gap-2">
              <span>Total Settled Revenue:</span>
              <strong className="text-emerald-600 dark:text-emerald-400 font-mono text-base">
                {formatCurrency(metrics.totalPaidRevenue)}
              </strong>
            </div>
          </div>

          <div className="relative w-full sm:w-80">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input
              type="text"
              value={paymentSearch}
              onChange={(e) => setPaymentSearch(e.target.value)}
              placeholder="Search OR No., TDN, Reference, Payor..."
              className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 outline-none"
            />
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4">Official Receipt (eOR)</th>
                    <th className="p-4">TDN / Reference No.</th>
                    <th className="p-4">Payor / Property Owner</th>
                    <th className="p-4">Revenue Stream</th>
                    <th className="p-4">Payment Method</th>
                    <th className="p-4">Payment Date</th>
                    <th className="p-4 text-right">Amount Settled</th>
                    <th className="p-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {combinedSettledPayments
                    .filter((pay) => {
                      if (ledgerCategoryFilter !== 'ALL' && pay.type !== ledgerCategoryFilter) return false;
                      const lower = paymentSearch.toLowerCase();
                      return (
                        !lower ||
                        pay.receiptNumber.toLowerCase().includes(lower) ||
                        pay.identifier.toLowerCase().includes(lower) ||
                        pay.payor.toLowerCase().includes(lower) ||
                        pay.paymentMethod.toLowerCase().includes(lower)
                      );
                    })
                    .map((pay) => (
                      <tr key={pay.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                        <td className="p-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {pay.receiptNumber}
                        </td>
                        <td className="p-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {pay.identifier}
                        </td>
                        <td className="p-4 font-semibold text-slate-900 dark:text-white">
                          {pay.payor}
                        </td>
                        <td className="p-4 text-slate-600 dark:text-slate-300">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${pay.type === 'MASTER'
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                              : 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                              }`}
                          >
                            {pay.category}
                          </span>
                        </td>
                        <td className="p-4 text-slate-600 dark:text-slate-300">
                          {pay.paymentMethod}
                        </td>
                        <td className="p-4 font-mono text-slate-500">
                          {pay.paymentDate ? new Date(pay.paymentDate).toLocaleDateString() : 'Recorded'}
                        </td>
                        <td className="p-4 text-right font-mono font-black text-slate-900 dark:text-white">
                          {formatCurrency(pay.amount)}
                        </td>
                        <td className="p-4 text-center">
                          <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 px-2.5 py-1 rounded-full text-[10px] font-extrabold flex items-center justify-center gap-1">
                            <i className="fa-solid fa-circle-check text-[9px]"></i> Settled
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ============================================================ */}
      {/* ADD / EDIT MASTER PROPERTY RECORD MODAL */}
      {/* ============================================================ */}
      {isPropertyModalOpen && editingProperty && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <i className="fa-solid fa-landmark text-blue-600"></i>
                {editingProperty.id ? 'Edit Property Assessment Record' : 'Add New Property Assessment Record'}
              </h3>
              <button
                type="button"
                onClick={() => setIsPropertyModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer font-bold transition"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleSavePropertyRecord} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Tax Declaration No. *</label>
                  <input
                    type="text"
                    required
                    value={editingProperty.taxDeclarationNumber || ''}
                    onChange={(e) => setEditingProperty({ ...editingProperty, taxDeclarationNumber: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-mono font-bold outline-none text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">NewPSPIN *</label>
                  <input
                    type="text"
                    required
                    value={editingProperty.newPspin || ''}
                    onChange={(e) => setEditingProperty({ ...editingProperty, newPspin: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-mono outline-none text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Owner Name / Corporation *</label>
                  <input
                    type="text"
                    required
                    value={editingProperty.ownerName || ''}
                    onChange={(e) => setEditingProperty({ ...editingProperty, ownerName: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none font-semibold text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Property Type *</label>
                  <select
                    value={editingProperty.propertyType || 'Residential'}
                    onChange={(e) => {
                      const newType = e.target.value;
                      handleValuationChange(editingProperty.marketValue || 1000000, newType);
                      setEditingProperty((prev) => ({ ...prev, propertyType: newType }));
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none font-semibold text-slate-900 dark:text-white"
                  >
                    <option value="Residential">Residential</option>
                    <option value="Commercial">Commercial</option>
                    <option value="Industrial">Industrial</option>
                    <option value="Building">Building</option>
                    <option value="Land">Land</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Barangay *</label>
                  <input
                    type="text"
                    required
                    value={editingProperty.barangay || ''}
                    onChange={(e) => setEditingProperty({ ...editingProperty, barangay: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Market Value (₱)</label>
                  <input
                    type="number"
                    value={editingProperty.marketValue || 0}
                    onChange={(e) => handleValuationChange(Number(e.target.value), editingProperty.propertyType || 'Residential')}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Computed Assessed Value (₱)</label>
                  <input
                    type="number"
                    value={editingProperty.assessedValue || 0}
                    readOnly
                    className="w-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Annual Basic Tax (1.5%)</label>
                  <input
                    type="number"
                    value={editingProperty.basicTax || 0}
                    onChange={(e) => setEditingProperty({ ...editingProperty, basicTax: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Annual SEF Tax (1.0%)</label>
                  <input
                    type="number"
                    value={editingProperty.sefTax || 0}
                    onChange={(e) => setEditingProperty({ ...editingProperty, sefTax: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Payment Status</label>
                  <select
                    value={editingProperty.paymentStatus || 'Unpaid'}
                    onChange={(e) => setEditingProperty({ ...editingProperty, paymentStatus: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none font-semibold text-slate-900 dark:text-white"
                  >
                    <option value="Unpaid">Pending (Unpaid)</option>
                    <option value="Paid">Settled (Paid)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPropertyModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer shadow-md"
                >
                  Save Assessment Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* OVERHAULED DOCUMENT PREVIEW POP-UP TAB MODAL */}
      {/* ============================================================ */}
      {previewModalOpen && activeDoc && currentApp && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl h-[88vh] shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap justify-between items-center gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <i className={`fa-solid ${activeDoc.type === 'PDF' ? 'fa-file-pdf text-rose-500' : 'fa-file-image text-blue-600'} text-base`}></i>
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate max-w-md" title={activeDoc.name}>
                    {activeDoc.name}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Application {currentApp?.referenceNumber} • Document {activeDocIndex + 1} of {previewDocList.length}
                  </p>
                </div>
              </div>

              {/* Header Action Tools */}
              <div className="flex items-center gap-2">
                {/* Mode Tabs: Viewer vs Details */}
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setPreviewTabMode('viewer')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${previewTabMode === 'viewer'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                  >
                    <i className="fa-solid fa-eye text-xs"></i>
                    <span>Viewer</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewTabMode('details')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${previewTabMode === 'details'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                  >
                    <i className="fa-solid fa-circle-info text-xs"></i>
                    <span>Details &amp; Audit</span>
                  </button>
                </div>

                {activeDocUrl && (
                  <a
                    href={activeDocUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition"
                    title="Open in New Tab"
                  >
                    <i className="fa-solid fa-arrow-up-right-from-square"></i>
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setPreviewModalOpen(false);
                    setPreviewDocError(false);
                  }}
                  className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer font-bold text-base transition"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            </div>

            {/* Document Tabs Strip (Switch between attached documents) */}
            {previewDocList.length > 1 && (
              <div className="px-6 py-2.5 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto">
                <span className="text-[10px] font-bold uppercase text-slate-400 shrink-0 mr-1">
                  Attached Files:
                </span>
                {previewDocList.map((doc, idx) => (
                  <button
                    key={doc.id || idx}
                    type="button"
                    onClick={() => {
                      setActiveDocIndex(idx);
                      setPreviewDocError(false);
                      setPreviewZoom(100);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${activeDocIndex === idx
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                  >
                    <i className={`fa-solid ${doc.type === 'PDF' ? 'fa-file-pdf' : 'fa-file-image'} text-[11px]`}></i>
                    <span className="truncate max-w-[150px]">{doc.name}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded-full font-extrabold ${doc.status === 'Verified'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : doc.status === 'Rejected'
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-amber-500/20 text-amber-300'
                        }`}
                    >
                      {doc.status}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Modal Body Canvas */}
            <div className="flex-1 bg-slate-100 dark:bg-slate-950 overflow-hidden flex flex-col min-h-0 relative">
              {previewTabMode === 'viewer' ? (
                <div className="flex-1 overflow-auto flex items-center justify-center p-4 min-h-0 relative">
                  {/* Floating Zoom Controls for Image Viewer */}
                  {!activeDocUrl.toLowerCase().includes('.pdf') && !activeDocUrl.startsWith('data:application/pdf') && !previewDocError && (
                    <div className="absolute bottom-6 right-6 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 p-1.5 flex items-center gap-1 shadow-lg">
                      <button
                        type="button"
                        onClick={() => setPreviewZoom((z) => Math.max(50, z - 25))}
                        className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer font-bold text-xs"
                        title="Zoom Out"
                      >
                        <i className="fa-solid fa-minus"></i>
                      </button>
                      <span className="text-[11px] font-mono font-bold px-2 text-slate-700 dark:text-slate-300 min-w-[48px] text-center">
                        {previewZoom}%
                      </span>
                      <button
                        type="button"
                        onClick={() => setPreviewZoom((z) => Math.min(250, z + 25))}
                        className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer font-bold text-xs"
                        title="Zoom In"
                      >
                        <i className="fa-solid fa-plus"></i>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewZoom(100)}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                        title="Reset Zoom"
                      >
                        Reset
                      </button>
                    </div>
                  )}

                  {activeDocUrl.toLowerCase().includes('.pdf') || activeDocUrl.startsWith('data:application/pdf') ? (
                    <iframe
                      src={activeDocUrl}
                      title={activeDoc.name}
                      className="w-full h-full border-0 rounded-2xl bg-white shadow-md"
                    />
                  ) : previewDocError ? (
                    <div className="text-center p-8 max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl space-y-4">
                      <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center text-xl">
                        <i className="fa-solid fa-file-circle-question"></i>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Inline Preview Fallback</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          File <span className="font-mono font-bold text-slate-700 dark:text-slate-300">"{activeDoc.name}"</span> could not be rendered as a direct raster image. Official archive certificate generated.
                        </p>
                      </div>
                      <div className="pt-2 flex justify-center gap-2">
                        <a
                          href={activeDocUrl}
                          download={activeDoc.name}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition shadow-md"
                        >
                          <i className="fa-solid fa-download text-xs"></i> Download File
                        </a>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={activeDocUrl}
                      alt={activeDoc.name}
                      style={{ transform: `scale(${previewZoom / 100})`, transformOrigin: 'center center' }}
                      onError={() => {
                        if (activeDocUrl && !activeDocUrl.startsWith('data:image/svg+xml')) {
                          activeDoc.url = createDocumentFallbackSvg(activeDoc.name, activeDoc.status);
                          setPreviewDocError(false);
                        } else {
                          setPreviewDocError(true);
                        }
                      }}
                      className="max-w-full max-h-[72vh] object-contain rounded-2xl shadow-md transition-transform duration-150"
                    />
                  )}
                </div>
              ) : (
                /* Document Details & Verification Metadata Tab */
                <div className="p-8 overflow-y-auto space-y-6 max-w-3xl mx-auto w-full">
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <i className="fa-solid fa-shield-halved text-blue-600"></i>
                      Document Metadata &amp; Compliance Summary
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Document Title</span>
                        <strong className="text-slate-800 dark:text-slate-200">{activeDoc.name}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Format / MIME Category</span>
                        <strong className="text-blue-600 dark:text-blue-400">{activeDoc.type} Document</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Associated Application</span>
                        <strong className="font-mono text-slate-800 dark:text-slate-200">{currentApp.referenceNumber}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Applicant Name</span>
                        <strong className="text-slate-800 dark:text-slate-200">{currentApp.applicantName}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Upload Timestamp</span>
                        <strong className="text-slate-800 dark:text-slate-200">{activeDoc.uploadedAt || currentApp.submissionDate || 'N/A'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Verification Status</span>
                        <span
                          className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${activeDoc.status === 'Verified'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : activeDoc.status === 'Rejected'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}
                        >
                          {activeDoc.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase">
                      Assessor Verification Decision
                    </h4>
                    <p className="text-xs text-slate-500">
                      Update the regulatory compliance status of this document. Changes are recorded in the application audit log.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleToggleDocStatus(activeDocIndex, 'Verified')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${activeDoc.status === 'Verified'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          }`}
                      >
                        <i className="fa-solid fa-check"></i> Mark as Verified
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleDocStatus(activeDocIndex, 'Rejected')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${activeDoc.status === 'Rejected'
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                          }`}
                      >
                        <i className="fa-solid fa-xmark"></i> Flag as Rejected
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleDocStatus(activeDocIndex, 'Pending')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${activeDoc.status === 'Pending'
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          }`}
                      >
                        <i className="fa-solid fa-hourglass-half"></i> Set as Pending
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="px-6 py-3.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-wrap justify-between items-center gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleDocStatus(activeDocIndex, 'Verified')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${activeDoc.status === 'Verified'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800'
                    }`}
                >
                  <i className="fa-solid fa-check text-xs"></i> Verified
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleDocStatus(activeDocIndex, 'Rejected')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${activeDoc.status === 'Rejected'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 hover:bg-rose-100 border border-rose-200 dark:border-rose-800'
                    }`}
                >
                  <i className="fa-solid fa-xmark text-xs"></i> Rejected
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={activeDocIndex <= 0}
                  onClick={() => {
                    setActiveDocIndex((i) => Math.max(0, i - 1));
                    setPreviewDocError(false);
                    setPreviewZoom(100);
                  }}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  <i className="fa-solid fa-chevron-left mr-1"></i> Prev
                </button>

                <button
                  type="button"
                  disabled={activeDocIndex >= previewDocList.length - 1}
                  onClick={() => {
                    setActiveDocIndex((i) => Math.min(previewDocList.length - 1, i + 1));
                    setPreviewDocError(false);
                    setPreviewZoom(100);
                  }}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Next <i className="fa-solid fa-chevron-right ml-1"></i>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPreviewModalOpen(false);
                    setPreviewDocError(false);
                  }}
                  className="px-4 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs cursor-pointer transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cashier In-Person Settlement Modal */}
      {isCashierSettleModalOpen && currentApp && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-5">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                  <i className="fa-solid fa-cash-register text-sm"></i>
                </span>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    Record Over-The-Counter Settlement
                  </h3>
                  <p className="text-xs text-slate-500">
                    Issue an Official Receipt (eOR) and mark application as settled.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCashierSettleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer font-bold"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleConfirmCashierSettlement} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1 text-slate-700 dark:text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Application Reference:</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{currentApp.referenceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Applicant:</span>
                  <span className="font-bold">{currentApp.applicantName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Service:</span>
                  <span>{currentApp.category}</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Settlement Amount (₱) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={cashierPaymentAmount}
                  onChange={(e) => setCashierPaymentAmount(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none font-black text-sm text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Official Receipt (eOR) Number *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={cashierOrNumber}
                    onChange={(e) => setCashierOrNumber(e.target.value)}
                    placeholder="eOR-RPT-2025-XXXXXX"
                    className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none font-mono font-bold text-slate-900 dark:text-white text-xs"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setCashierOrNumber(
                        `eOR-RPT-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`
                      )
                    }
                    className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Auto Generate
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Payment Collection Method *
                </label>
                <select
                  value={cashierPaymentMethod}
                  onChange={(e) => setCashierPaymentMethod(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none font-semibold text-slate-900 dark:text-white"
                >
                  <option value="Treasury Cashier (Cash)">Treasury Cashier (Cash)</option>
                  <option value="Treasury POS (Debit/Credit Card)">Treasury POS (Debit/Credit Card)</option>
                  <option value="Manager's Check / Cashier Check">Manager's Check / Cashier Check</option>
                  <option value="LandBank LGU Deposit">LandBank LGU Deposit</option>
                  <option value="Online e-Payment Verification">Online e-Payment Verification</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCashierSettleModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSettle}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer shadow-md disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmittingSettle ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i> Processing...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-circle-check"></i> Settle &amp; Issue e-OR
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RealPropertyTaxView;