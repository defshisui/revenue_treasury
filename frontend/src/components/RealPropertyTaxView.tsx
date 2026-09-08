import React, { useState, useMemo, useEffect } from 'react';
import type {
  StatusType
} from '../types/treasury';
import {
  getRPTApplications,
  getLguMasterRptRecords,
  createLguMasterRptRecord,
  updateRptApplicationStatus,
  updateLguMasterRptRecord,
  deleteLguMasterRptRecord,
  type RPTApplicationRecord
} from '../services/realpropertytaxService';
import { API_BASE_URL } from '../config/api';

type ExtendedStatusType = StatusType | 'Archived';

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
  documents: {
    id: string;
    name: string;
    type: string;
    url?: string;
    status: 'Verified' | 'Rejected' | 'Pending';
    uploadedAt: string;
  }[];

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
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(val || 0);
}

export const RealPropertyTaxView: React.FC<RealPropertyTaxViewProps> = ({
  isCollapsed
}) => {

  const [mainViewTab, setMainViewTab] = useState<'master' | 'queue' | 'payments' | 'citizenAudit'>(
    () => (localStorage.getItem('rpt_admin_tab') as 'master' | 'queue' | 'payments' | 'citizenAudit') || 'master'
  );


  const switchMainViewTab = (tab: 'master' | 'queue' | 'payments' | 'citizenAudit') => {
    setMainViewTab(tab);
    localStorage.setItem('rpt_admin_tab', tab);
  };
  const [queueTab, setQueueTab] = useState<'Active' | 'Archived'>('Active');

  const [masterProperties, setMasterProperties] = useState<LguMasterProperty[]>([]);
  const [masterSearch, setMasterSearch] = useState<string>('');
  const [masterTypeFilter, setMasterTypeFilter] = useState<string>('ALL');
  const [masterStatusFilter, setMasterStatusFilter] = useState<string>('ALL');
  const [isPropertyModalOpen, setIsPropertyModalOpen] = useState<boolean>(false);
  const [editingProperty, setEditingProperty] = useState<Partial<LguMasterProperty> | null>(null);

  const [paymentsLedger, setPaymentsLedger] = useState<PaymentLedgerRecord[]>([]);
  const [paymentSearch, setPaymentSearch] = useState<string>('');

  const [applications, setApplications] = useState<ExtendedApplicationRecord[]>([]);
  const [citizenAuditTrail, setCitizenAuditTrail] = useState<ExtendedApplicationRecord[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [rptServiceAmountInput, setRptServiceAmountInput] = useState<string>('');

  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);
  const [previewDocTitle, setPreviewDocTitle] = useState<string>('');
  const [previewDocError, setPreviewDocError] = useState<boolean>(false);

  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'warning' | 'error';
  } | null>(null);

  const triggerToast = (text: string, type: 'success' | 'warning' | 'error') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const loadMasterRecords = async () => {
    try {
      const records = await getLguMasterRptRecords();
      const mapped: LguMasterProperty[] = records.map((r: any) => ({
        id: r.id,
        propertyIndexNumber: r.property_index_number || r.propertyIndexNumber || '',
        newPspin: r.new_pspin || r.newPspin || '09-021-009-166- - -',
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
        amountPaid: Number(r.amount_paid || r.amountPaid || 0),
        balance: Number(r.balance || 0),
        delinquentStatus: Boolean(r.delinquent_status || r.delinquentStatus),
        status: r.status || 'Active',
        paymentStatus: r.payment_status || r.paymentStatus || 'Unpaid',
      }));
      setMasterProperties(mapped);
    } catch (e) {
      console.error('Failed to load master records:', e);
    }
  };

  const loadPayments = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/citizen-rpt-payments`);
      if (response.ok) {
        const data = await response.json();
        setPaymentsLedger(
          data.map((p: any) => ({
            id: p.id,
            taxDeclarationNumber: p.tax_declaration_number || p.taxDeclarationNumber,
            ownerName: p.owner_name || p.ownerName,
            amountPaid: Number(p.amount_paid || p.amountPaid || 0),
            officialReceiptNumber: p.official_receipt_number || p.officialReceiptNumber,
            paymentDate: p.payment_date || p.paymentDate,
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
  };

  const AUDIT_STATUSES = ['Digital Certificate Issued', 'Completed', 'Archived'];

  const loadApplications = async () => {
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
          propertyDetails: item.propertyDetails || {
            pin: item.pin || '',
            titleNumber: item.taxDeclarationNumber || '',
            lotAreaSqM: item.lotAreaSqM || 0,
            address: item.propertyLocation || '',
            currentValuation: item.currentValuation || 0,
          },
          documents: (Array.isArray(rawDocs) ? rawDocs : []).reduce((acc: any[], doc: any, idx: number) => {
            // Skip null/undefined entries — do not inject placeholder docs
            if (!doc) return acc;
            if (typeof doc === 'string') {
              if (!doc.trim()) return acc; // skip empty strings
              acc.push({
                id: `DOC-${idx + 1}`,
                name: doc,
                type: doc.includes('.pdf') ? 'PDF' : 'IMAGE',
                url: doc.startsWith('data:') || doc.startsWith('http') ? doc : `${API_BASE_URL}/uploads/${doc}`,
                status: 'Pending' as const,
                uploadedAt: item.filedDate || '',
              });
              return acc;
            }
            const docName = doc.name || doc.fileName || '';
            if (!docName) return acc; // skip entries with no real filename
            acc.push({
              id: doc.id || `DOC-${idx + 1}`,
              name: docName,
              type: doc.type || 'PDF',
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


      const auditApps = mapped.filter((a) => AUDIT_STATUSES.includes(a.status as string));
      const activeApps = mapped.filter((a) => !AUDIT_STATUSES.includes(a.status as string));

      setApplications(activeApps);
      setCitizenAuditTrail(auditApps);

      if (activeApps.length > 0) {
        setSelectedAppId(activeApps[0].id);
      }
    } catch (err) {
      console.error('Failed to load RPT applications:', err);
    }
  };

  useEffect(() => {
    loadMasterRecords();
    loadPayments();
    loadApplications();
  }, []);

  const currentApp = useMemo(() => {
    return applications.find((app) => app.id === selectedAppId) || applications[0];
  }, [applications, selectedAppId]);

  useEffect(() => {
    setRptServiceAmountInput(
      currentApp ? String(currentApp.paymentAmount || '') : ''
    );
  }, [currentApp?.id, currentApp?.paymentAmount]);

  const filteredMasterProperties = useMemo(() => {
    return masterProperties.filter((p) => {
      const matchesSearch =
        p.taxDeclarationNumber.toLowerCase().includes(masterSearch.toLowerCase()) ||
        p.ownerName.toLowerCase().includes(masterSearch.toLowerCase()) ||
        p.newPspin.toLowerCase().includes(masterSearch.toLowerCase()) ||
        p.barangay.toLowerCase().includes(masterSearch.toLowerCase());
      const matchesType = masterTypeFilter === 'ALL' || p.propertyType === masterTypeFilter;
      const matchesStatus = masterStatusFilter === 'ALL' || p.paymentStatus === masterStatusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [masterProperties, masterSearch, masterTypeFilter, masterStatusFilter]);

  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      if (queueTab === 'Active' && app.status === 'Archived') return false;
      if (queueTab === 'Archived' && app.status !== 'Archived') return false;

      const matchesSearch =
        app.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.applicantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.propertyDetails.address.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'ALL' || app.category === selectedCategory;
      const matchesStatus = selectedStatusFilter === 'ALL' || app.status === selectedStatusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [applications, searchTerm, selectedCategory, selectedStatusFilter, queueTab]);

  const handleSavePropertyRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProperty?.taxDeclarationNumber || !editingProperty?.ownerName) {
      triggerToast('Please provide TDN and Owner Name.', 'warning');
      return;
    }

    try {
      if (editingProperty.id) {
        await updateLguMasterRptRecord(editingProperty.id, editingProperty);
        triggerToast(`Property record ${editingProperty.taxDeclarationNumber} updated successfully.`, 'success');
      } else {
        await createLguMasterRptRecord(editingProperty);
        triggerToast(`New Property ${editingProperty.taxDeclarationNumber} added to master database.`, 'success');
      }
      setIsPropertyModalOpen(false);
      setEditingProperty(null);
      loadMasterRecords();
    } catch (err: any) {
      triggerToast(err.message || 'Failed to save property record.', 'error');
    }
  };

  const handleDeleteMasterProperty = async (id: string | number, tdn: string) => {
    if (!window.confirm(`Are you sure you want to delete assessment record ${tdn}?`)) return;
    try {
      await deleteLguMasterRptRecord(id);
      triggerToast(`Assessment record ${tdn} deleted.`, 'success');
      loadMasterRecords();
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

  const createDocumentFallbackSvg = (title: string) => {
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
      <rect x="250" y="407" width="140" height="26" fill="#DCFCE7" rx="6"/>
      <text x="320" y="425" fill="#166534" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="800" text-anchor="middle">VERIFIED ON FILE</text>

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

  const handleOpenPreview = (doc: { name: string; url?: string }) => {
    let targetUrl = doc.url || '';
    if (!targetUrl || targetUrl.trim() === '') targetUrl = doc.name;
    if (targetUrl.startsWith('data:') || targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
    } else if (targetUrl.startsWith('/uploads/')) {
      targetUrl = `${API_BASE_URL}${targetUrl}`;
    } else if (targetUrl.trim() !== '') {
      targetUrl = `${API_BASE_URL}/uploads/${targetUrl}`;
    } else {
      targetUrl = createDocumentFallbackSvg(doc.name || 'Document');
    }
    setPreviewDocError(false);
    setPreviewDocTitle(doc.name || 'Document');
    setPreviewDocUrl(targetUrl);
  };

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
      console.error('Failed to persist RPT application status:', error);
      triggerToast(
        error?.message || 'Failed to save the application status. Please try again.',
        'error'
      );
    }
  };

  const handleSetRPTServiceForPayment = async () => {
    if (!currentApp) return;

    const amount = Number(rptServiceAmountInput);
    const serviceName = currentApp.category || currentApp.service || 'RPT Service';

    if (!Number.isFinite(amount) || amount <= 0) {
      triggerToast(
        `Enter the assessed ${serviceName} fee before sending the application for payment.`,
        'warning'
      );
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
              paymentStatus:
                serverRecord?.payment_status || 'Pending',
            }
            : app
        )
      );

      triggerToast(
        `${serviceName} assessment posted: ${formatCurrency(amount)}. Citizen can now pay online.`,
        'success'
      );
    } catch (error: any) {
      triggerToast(
        error?.message || `Failed to post the ${serviceName} assessment.`,
        'error'
      );
    }
  };


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

    setApplications((prev) => prev.filter((a) => a.id !== currentApp.id));
    setCitizenAuditTrail((prev) => [releasedApp, ...prev]);
    switchMainViewTab('citizenAudit');
    triggerToast(`Digital Tax Certificate issued for ${currentApp.referenceNumber}. Transferred to Audit Trail.`, 'success');
  };

  return (
    <div
      style={{
        marginLeft: isCollapsed ? '80px' : '256px',
        width: isCollapsed ? 'calc(100% - 80px)' : 'calc(100% - 256px)',
      }}
      className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 px-4 sm:px-6 pb-6 pt-28 sm:pt-32 transition-all duration-300 box-border flex flex-col font-sans relative"
    >
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div
            className={`px-4 py-3 rounded-xl shadow-lg border flex items-center gap-3 text-xs font-semibold ${toastMessage.type === 'success'
              ? 'bg-emerald-950 text-emerald-200 border-emerald-800'
              : toastMessage.type === 'warning'
                ? 'bg-amber-950 text-amber-200 border-amber-800'
                : 'bg-rose-950 text-rose-200 border-rose-800'
              }`}
          >
            <span>{toastMessage.type === 'success' ? '✓' : 'ℹ'}</span>
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 tracking-wider uppercase">
              OFFICE OF THE CITY ASSESSOR &amp; TREASURER
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white mt-1">
            Real Property Tax &amp; Assessment Management Hub
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            QC E-Services RPT Search DB, Group Bill Sets, Assessment Valuation &amp; Electronic Official Receipts
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
          <button
            onClick={() => switchMainViewTab('master')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${mainViewTab === 'master'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            <span>Master Database ({masterProperties.length})</span>
          </button>
          <button
            onClick={() => switchMainViewTab('queue')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${mainViewTab === 'queue'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            <span>Citizen Applications ({applications.length})</span>
          </button>
          <button
            onClick={() => switchMainViewTab('payments')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${mainViewTab === 'payments'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            <span>Payment Ledger ({paymentsLedger.length})</span>
          </button>
          <button
            onClick={() => switchMainViewTab('citizenAudit')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${mainViewTab === 'citizenAudit'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            <span>Audit Trail ({citizenAuditTrail.length})</span>
          </button>
        </div>
      </div>

      {mainViewTab === 'master' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <input
                type="text"
                value={masterSearch}
                onChange={(e) => setMasterSearch(e.target.value)}
                placeholder="Search TDN, Owner, PSPIN, Barangay..."
                className="w-full sm:w-72 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={masterTypeFilter}
                onChange={(e) => setMasterTypeFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold outline-none text-slate-700 dark:text-slate-300"
              >
                <option value="ALL">All Types</option>
                <option value="Land">Land</option>
                <option value="Building">Building</option>
                <option value="Commercial">Commercial</option>
                <option value="Residential">Residential</option>
              </select>
              <select
                value={masterStatusFilter}
                onChange={(e) => setMasterStatusFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold outline-none text-slate-700 dark:text-slate-300"
              >
                <option value="ALL">All Status</option>
                <option value="Paid">Paid</option>
                <option value="Unpaid">Unpaid</option>
              </select>
            </div>

          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4">Tax Declaration No.</th>
                    <th className="p-4">Owner Name</th>
                    <th className="p-4">NewPSPIN</th>
                    <th className="p-4">Barangay / Location</th>
                    <th className="p-4">Type</th>
                    <th className="p-4 text-right">Assessed Value</th>
                    <th className="p-4 text-right">Tax Due</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredMasterProperties.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400 italic">
                        No property assessment records match your search filter.
                      </td>
                    </tr>
                  ) : (
                    filteredMasterProperties.map((prop) => (
                      <tr key={prop.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
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
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${prop.paymentStatus === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                              }`}
                          >
                            {prop.paymentStatus}
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() => {
                              setEditingProperty(prop);
                              setIsPropertyModalOpen(true);
                            }}
                            className="text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteMasterProperty(prop.id, prop.taxDeclarationNumber)}
                            className="text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {mainViewTab === 'queue' && (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden gap-6 h-[calc(100vh-22rem)] min-h-0 w-full">

          <div className="w-full lg:w-[420px] xl:w-[460px] flex-shrink-0 flex flex-col gap-4 min-h-0 h-1/2 lg:h-full">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col gap-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setQueueTab('Active')}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${queueTab === 'Active'
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-600'
                    : 'text-slate-500 border-transparent'
                    }`}
                >
                  Active Processing
                </button>
                <button
                  onClick={() => setQueueTab('Archived')}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${queueTab === 'Archived'
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-600'
                    : 'text-slate-500 border-transparent'
                    }`}
                >
                  System Archiver
                </button>
              </div>

              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search applications..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none"
              />
              <div className="flex gap-2">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-1/2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 outline-none"
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
                  className="w-1/2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 outline-none"
                >
                  <option value="ALL">All Status</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Under Evaluation">Under Evaluation</option>
                  <option value="For Payment">For Payment</option>
                  <option value="Payment Completed">Payment Completed</option>
                  <option value="Field Inspection Scheduled">Field Inspection</option>
                  <option value="Ready for Release">Ready for Release</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            </div>

            <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 p-2 space-y-1">
                {filteredApplications.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">No applications found.</div>
                ) : (
                  filteredApplications.map((app) => (
                    <div
                      key={app.id}
                      onClick={() => setSelectedAppId(app.id)}
                      className={`p-3 rounded-xl border transition cursor-pointer ${currentApp?.id === app.id
                        ? 'bg-blue-50/60 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
                          {app.referenceNumber}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                          {app.status}
                        </span>
                      </div>
                      <p className="font-bold text-xs text-slate-900 dark:text-white mt-1">{app.applicantName}</p>
                      <p className="text-[11px] text-slate-500 truncate">{app.category}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col overflow-hidden min-h-0 h-1/2 lg:h-full">
            {!currentApp ? (
              <div className="flex-1 flex items-center justify-center p-8 text-center text-xs text-slate-400">
                Select an application from the queue to review documents and update evaluation status.
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400">
                      CONTROL NUMBER
                    </span>
                    <h2 className="text-lg font-black font-mono text-slate-900 dark:text-white">
                      {currentApp.referenceNumber}
                    </h2>
                    <p className="text-xs text-slate-500 font-semibold">{currentApp.category}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDigitalRelease}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer shadow-sm"
                    >
                      ✓ Approve &amp; Issue Digital Certificate
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Advance Assessor Workflow:</span>
                  <div className="flex flex-wrap gap-2">
                    {(['For Review', 'Under Evaluation', 'For Compliance', 'Processing', 'Approved', 'Ready for Release', 'Rejected'] as ExtendedStatusType[]).map((st) => (
                      <button
                        key={st}
                        onClick={() => handleUpdateStatus(st)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${currentApp.status === st
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-blue-400'
                          }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-900 space-y-3">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wide text-blue-900 dark:text-blue-200">
                      RPT Service Assessment / Payment Bill
                    </h3>
                    <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-1">
                      Enter the assessed fee for the selected RPT service. Once posted, the citizen can pay the assessed amount online through PayMongo.
                    </p>
                  </div>

                  <div className="mb-2 px-3 py-2 bg-white/70 dark:bg-slate-900/50 rounded-lg border border-blue-100 dark:border-blue-900">
                    <span className="text-[10px] font-bold uppercase text-slate-500">RPT Service</span>
                    <p className="text-sm font-black text-[#0B3B60] dark:text-white">
                      {currentApp.category || currentApp.service || 'Real Property Tax Service'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-300 mb-1">
                        Assessed Service Fee
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
                          className="w-full bg-white dark:bg-slate-900 border border-blue-200 dark:border-slate-700 rounded-xl pl-7 pr-3 py-2.5 text-sm font-black outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleSetRPTServiceForPayment()}
                      className="bg-[#1D3F99] hover:bg-[#17357F] text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-sm transition"
                    >
                      {currentApp.paymentStatus === 'Paid'
                        ? 'Payment Recorded'
                        : 'Post Service Bill / For Payment'}
                    </button>
                  </div>

                  {Number(currentApp.paymentAmount || 0) > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                      <div className="bg-white/80 dark:bg-slate-900/60 rounded-lg p-2">
                        <span className="text-slate-500 block">Amount</span>
                        <strong>{formatCurrency(Number(currentApp.paymentAmount))}</strong>
                      </div>
                      <div className="bg-white/80 dark:bg-slate-900/60 rounded-lg p-2">
                        <span className="text-slate-500 block">Payment</span>
                        <strong>{currentApp.paymentStatus || 'Pending'}</strong>
                      </div>
                      <div className="bg-white/80 dark:bg-slate-900/60 rounded-lg p-2">
                        <span className="text-slate-500 block">Reference</span>
                        <strong className="font-mono">{currentApp.paymentReference || '—'}</strong>
                      </div>
                      <div className="bg-white/80 dark:bg-slate-900/60 rounded-lg p-2">
                        <span className="text-slate-500 block">eOR</span>
                        <strong className="font-mono">{currentApp.officialReceiptNumber || '—'}</strong>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                    Documentary Verification Vault
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {currentApp.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950/40 space-y-2"
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                            {doc.name}
                          </span>
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded">
                            {doc.type}
                          </span>
                        </div>
                        <button
                          onClick={() => handleOpenPreview(doc)}
                          className="w-full py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 transition cursor-pointer"
                        >
                          Inspect Document
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {mainViewTab === 'payments' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
            <input
              type="text"
              value={paymentSearch}
              onChange={(e) => setPaymentSearch(e.target.value)}
              placeholder="Search OR No., TDN, Payor..."
              className="w-72 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none"
            />
            <span className="text-xs font-bold text-slate-500">
              Total Real Property Tax Revenue Settled: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{formatCurrency(paymentsLedger.reduce((sum, p) => sum + p.amountPaid, 0))}</strong>
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-4">Official Receipt (eOR)</th>
                  <th className="p-4">Tax Declaration No.</th>
                  <th className="p-4">Payor / Property Owner</th>
                  <th className="p-4">Payment Method</th>
                  <th className="p-4">Coverage</th>
                  <th className="p-4">Payment Date</th>
                  <th className="p-4 text-right">Amount Settled</th>
                  <th className="p-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paymentsLedger.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                      No online payments recorded yet.
                    </td>
                  </tr>
                ) : (
                  paymentsLedger.map((pay) => (
                    <tr key={pay.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                      <td className="p-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {pay.officialReceiptNumber}
                      </td>
                      <td className="p-4 font-mono font-bold text-[#0B3B60] dark:text-sky-400">
                        {pay.taxDeclarationNumber}
                      </td>
                      <td className="p-4 font-semibold text-slate-900 dark:text-white">
                        {pay.ownerName}
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-300">
                        {pay.paymentMethod}
                      </td>
                      <td className="p-4 text-slate-500">
                        {pay.quarterCoverage || 'Full Year'}
                      </td>
                      <td className="p-4 font-mono text-slate-500">
                        {new Date(pay.paymentDate).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-right font-mono font-black text-slate-900 dark:text-white">
                        {formatCurrency(pay.amountPaid)}
                      </td>
                      <td className="p-4 text-center">
                        <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 px-2.5 py-1 rounded-full text-[10px] font-bold">
                          ✓ {pay.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {mainViewTab === 'citizenAudit' && (
        <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-4">
          <h2 className="text-lg font-black text-slate-900 dark:text-white">Archived &amp; Certified Applications</h2>
          <p className="text-xs text-slate-500">
            Immutable log of all released Tax Declarations and Certified True Copies.
          </p>

          {citizenAuditTrail.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs italic bg-slate-50 dark:bg-slate-950 rounded-xl">
              No applications in the audit trail yet. Approved applications will appear here.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
              {citizenAuditTrail.map((app) => (
                <div key={app.id} className="p-4 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{app.referenceNumber}</span>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{app.applicantName} • {app.category}</p>
                  </div>
                  <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full font-bold text-[10px]">
                    ✓ Digital Certificate Issued
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isPropertyModalOpen && editingProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {editingProperty.id ? 'Edit Property Assessment Record' : 'Add New Property Assessment Record'}
              </h3>
              <button
                onClick={() => setIsPropertyModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg cursor-pointer"
              >
                ✕
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
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-mono font-bold outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">NewPSPIN *</label>
                  <input
                    type="text"
                    required
                    value={editingProperty.newPspin || ''}
                    onChange={(e) => setEditingProperty({ ...editingProperty, newPspin: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-mono outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Owner Name / Corporation *</label>
                  <input
                    type="text"
                    required
                    value={editingProperty.ownerName || ''}
                    onChange={(e) => setEditingProperty({ ...editingProperty, ownerName: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none font-semibold"
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
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none font-semibold"
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
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Lot Area (sqm)</label>
                  <input
                    type="number"
                    value={editingProperty.lotAreaSqm || 0}
                    onChange={(e) => setEditingProperty({ ...editingProperty, lotAreaSqm: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Market Value (₱)</label>
                  <input
                    type="number"
                    value={editingProperty.marketValue || 0}
                    onChange={(e) => handleValuationChange(Number(e.target.value), editingProperty.propertyType || 'Residential')}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none font-mono font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Computed Assessed Value (₱)</label>
                  <input
                    type="number"
                    value={editingProperty.assessedValue || 0}
                    readOnly
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none font-mono font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Annual Basic Tax (1.5%)</label>
                  <input
                    type="number"
                    value={editingProperty.basicTax || 0}
                    onChange={(e) => setEditingProperty({ ...editingProperty, basicTax: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Annual SEF Tax (1.0%)</label>
                  <input
                    type="number"
                    value={editingProperty.sefTax || 0}
                    onChange={(e) => setEditingProperty({ ...editingProperty, sefTax: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Payment Status</label>
                  <select
                    value={editingProperty.paymentStatus || 'Unpaid'}
                    onChange={(e) => setEditingProperty({ ...editingProperty, paymentStatus: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 outline-none font-semibold"
                  >
                    <option value="Unpaid">Unpaid</option>
                    <option value="Paid">Paid</option>
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

      {previewDocUrl && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl h-[85vh] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <span className="text-xs uppercase font-bold text-blue-400 shrink-0">Document Inspector</span>
                <span className="text-xs text-slate-300 truncate max-w-md">({previewDocTitle})</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setPreviewDocUrl(null);
                    setPreviewDocError(false);
                  }}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 dark:bg-slate-950 overflow-auto flex items-center justify-center p-4">
              {previewDocUrl.toLowerCase().includes('.pdf') || previewDocUrl.startsWith('data:application/pdf') ? (
                <iframe
                  src={previewDocUrl}
                  title={previewDocTitle}
                  className="w-full h-full border-0 rounded-xl bg-white shadow-md"
                />
              ) : previewDocError ? (
                <div className="text-center p-8 max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl space-y-4">
                  <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Document Preview Unavailable</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      The file <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">"{previewDocTitle}"</span> could not be loaded directly in the inline viewer.
                    </p>
                  </div>
                  <div className="pt-2">
                    <a
                      href={previewDocUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={previewDocTitle}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition shadow-md"
                    >
                      Download File
                    </a>
                  </div>
                </div>
              ) : (
                <img
                  src={previewDocUrl}
                  alt={previewDocTitle}
                  onError={() => {
                    if (previewDocUrl && !previewDocUrl.startsWith('data:image/svg+xml')) {
                      setPreviewDocUrl(createDocumentFallbackSvg(previewDocTitle));
                    } else {
                      setPreviewDocError(true);
                    }
                  }}
                  className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RealPropertyTaxView;