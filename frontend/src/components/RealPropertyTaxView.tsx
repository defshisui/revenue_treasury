// src/components/RealPropertyTaxView.tsx
import React, { useState, useMemo, useEffect } from 'react';
import type { StatusType } from '../types/treasury';
import {
  getRPTApplications,
  saveRPTApplication,
  type RPTApplicationRecord
} from '../services/realpropertytaxService';
import { API_BASE_URL } from '../config/api';

interface ExtendedApplicationRecord extends Omit<RPTApplicationRecord, 'documents'> {
  referenceNumber: string;
  applicantEmail: string;
  applicantPhone: string;
  category: string;
  submissionDate: string;
  assignedOfficer?: string;
  paymentStatus?: 'Paid' | 'Pending';
  taxDeclarationNumber: string;
  assessedValue: number;
  basicTaxDue: number;
  sefTaxDue: number;
  propertyDetails: {
    pin: string;
    titleNumber: string;
    lotAreaSqM: number;
    address: string;
    classification: 'Residential' | 'Commercial' | 'Industrial' | 'Agricultural';
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

  digitalRelease?: {
    releaseMethod: 'Digital';
    releasedAt?: string;
    releasedBy?: string;
    certificateType: 'Tax Declaration' | 'Tax Clearance' | 'Official Receipt';
    digitalSignatureStatus: 'Pending' | 'Signed' | 'Invalidated';
    qrVerificationCode?: string;
    downloadCount: number;
    citizenNotified: boolean;
  };
}

export interface RealPropertyTaxViewProps {
  isCollapsed?: boolean;
}

export const RealPropertyTaxView: React.FC<RealPropertyTaxViewProps> = ({
  isCollapsed = false
}) => {
  const [applications, setApplications] = useState<ExtendedApplicationRecord[]>([]);
  const [citizenAuditTrail, setCitizenAuditTrail] = useState<ExtendedApplicationRecord[]>([]);
  const [selectedCitizenAppId, setSelectedCitizenAppId] = useState<string>('');

  const [selectedAppId, setSelectedAppId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassification, setSelectedClassification] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');

  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);
  const [mainViewTab, setMainViewTab] = useState<'queue' | 'citizenAudit'>('queue');
  const [detailTab, setDetailTab] = useState<'overview' | 'audit' | 'notifications'>('overview');

  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);
  const [previewDocTitle, setPreviewDocTitle] = useState<string>('');

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

  useEffect(() => {
    let isMounted = true;
    getRPTApplications()
      .then((data) => {
        if (!isMounted) return;
        const mapped: ExtendedApplicationRecord[] = (Array.isArray(data) ? data : []).map((item: any) => {
          let rawDocs = item.documents;
          if (typeof rawDocs === 'string') {
            try { rawDocs = JSON.parse(rawDocs); } catch { rawDocs = []; }
          }
          if (rawDocs && !Array.isArray(rawDocs) && typeof rawDocs === 'object') {
            rawDocs = Object.values(rawDocs);
          }

          const valuation = item.currentValuation || item.propertyDetails?.currentValuation || 1500000;
          const basicTax = valuation * 0.01; // 1% Basic RPT
          const sefTax = valuation * 0.01;   // 1% Special Education Fund

          return {
            ...item,
            id: item.id || `RPT-${Math.random().toString(36).substring(2, 9)}`,
            applicantName: item.applicantName || item.ownerName || 'Unknown Owner',
            status: item.status || 'Under Evaluation',
            referenceNumber: item.controlNumber || item.referenceNumber || `RPT-2026-${item.id}`,
            applicantEmail: item.email || '',
            applicantPhone: item.mobileNumber || '',
            category: item.service || 'Tax Assessment & Clearance',
            submissionDate: item.filedDate || '',
            taxDeclarationNumber: item.taxDeclarationNumber || `TD-${Math.floor(100000 + Math.random() * 900000)}`,
            assessedValue: valuation,
            basicTaxDue: basicTax,
            sefTaxDue: sefTax,
            propertyDetails: {
              pin: item.pin || item.propertyDetails?.pin || '000-00-0000-000-00',
              titleNumber: item.titleNumber || item.propertyDetails?.titleNumber || 'TCT-123456',
              lotAreaSqM: item.lotAreaSqM || item.propertyDetails?.lotAreaSqM || 120,
              address: item.propertyLocation || item.propertyDetails?.address || 'Barangay Central, City Proper',
              classification: item.classification || item.propertyDetails?.classification || 'Residential',
              currentValuation: valuation
            },
            documents: (Array.isArray(rawDocs) ? rawDocs : []).map((doc: any, idx: number) => {
              if (!doc) {
                return {
                  id: `DOC-${idx + 1}`,
                  name: `Document ${idx + 1}`,
                  type: 'PDF',
                  url: '',
                  status: 'Pending' as const,
                  uploadedAt: item.filedDate || ''
                };
              }
              if (typeof doc === 'string') {
                return {
                  id: `DOC-${idx + 1}`,
                  name: doc,
                  type: doc.includes('.pdf') ? 'PDF' : 'IMAGE',
                  url: doc.startsWith('data:') || doc.startsWith('http') ? doc : `${API_BASE_URL}/uploads/${doc}`,
                  status: 'Pending' as const,
                  uploadedAt: item.filedDate || ''
                };
              }
              return {
                id: doc.id || `DOC-${idx + 1}`,
                name: doc.name || doc.fileName || `Document ${idx + 1}`,
                type: doc.type || 'PDF',
                url: doc.url ? (doc.url.startsWith('data:') || doc.url.startsWith('http') ? doc.url : `${API_BASE_URL}${doc.url.startsWith('/') ? '' : '/'}${doc.url}`) : '',
                status: doc.status || 'Pending',
                uploadedAt: doc.uploadedAt || item.filedDate || ''
              };
            }),
            auditLogs: item.auditLogs || [],
            notificationLogs: item.notificationLogs || []
          };
        });
        setApplications(mapped);
        if (mapped.length > 0) {
          setSelectedAppId(mapped[0].id);
        }
      })
      .catch((err) => {
        console.error("Failed to load RPT applications:", err);
        triggerToast("Failed to fetch assessment records from server database.", "error");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const currentApp = useMemo(() => {
    return (
      applications.find((app) => app.id === selectedAppId) ||
      applications[0]
    );
  }, [applications, selectedAppId]);

  const currentCitizenApp = useMemo(() => {
    return (
      citizenAuditTrail.find((app) => app.id === selectedCitizenAppId) ||
      citizenAuditTrail[0]
    );
  }, [citizenAuditTrail, selectedCitizenAppId]);

  const rptMetrics = useMemo(() => {
    const totalAssessed = applications.reduce((acc, curr) => acc + (curr.assessedValue || 0), 0);
    const totalBasicRPT = applications.reduce((acc, curr) => acc + (curr.basicTaxDue || 0), 0);
    const totalSEF = applications.reduce((acc, curr) => acc + (curr.sefTaxDue || 0), 0);

    return {
      totalDeclarations: applications.length,
      pendingValuation: applications.filter((a) => a.status === 'Under Evaluation').length,
      gisPlotting: applications.filter((a) => a.status === 'Technical Plotting (GIS)' || a.status === 'Field Inspection Scheduled').length,
      totalAssessedValue: totalAssessed,
      projectedRPTRevenue: totalBasicRPT,
      projectedSEFAllocation: totalSEF
    };
  }, [applications]);

  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      const matchesSearch =
        app.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.applicantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.taxDeclarationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.propertyDetails.pin.includes(searchTerm);

      const matchesClassification =
        selectedClassification === 'ALL' || app.propertyDetails.classification === selectedClassification;

      const matchesStatus =
        selectedStatusFilter === 'ALL' || app.status === selectedStatusFilter;

      return matchesSearch && matchesClassification && matchesStatus;
    });
  }, [applications, searchTerm, selectedClassification, selectedStatusFilter]);

  const persistChanges = async (updatedList: ExtendedApplicationRecord[]) => {
    setApplications(updatedList);
    if (currentApp) {
      const target = updatedList.find(a => a.id === currentApp.id);
      if (target) {
        try {
          const servicePayload: RPTApplicationRecord = {
            id: target.id,
            status: target.status,
            applicantName: target.applicantName,
            documents: target.documents.map(d => ({ name: d.name, url: d.url || '' })),
            controlNumber: target.referenceNumber,
            email: target.applicantEmail,
            mobileNumber: target.applicantPhone,
            service: target.category,
            filedDate: target.submissionDate,
            assignedOfficer: target.assignedOfficer,
            taxDeclarationNumber: target.taxDeclarationNumber,
            propertyDetails: target.propertyDetails
          };
          await saveRPTApplication(servicePayload);
        } catch (e) {
          console.error("Sync error:", e);
        }
      }
    }
  };

  const handleDeleteApplication = async (appId: string) => {
    const targetApp = applications.find(a => a.id === appId);
    if (!targetApp) return;

    if (!confirm(`Are you sure you want to remove Tax Declaration ${targetApp.taxDeclarationNumber}?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/citizen-rpt-applications/${appId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete property record from server');
      }

      const updatedList = applications.filter(a => a.id !== appId);
      setApplications(updatedList);

      if (updatedList.length > 0) {
        setSelectedAppId(updatedList[0].id);
      } else {
        setSelectedAppId('');
      }

      triggerToast(`Property record ${targetApp.referenceNumber} has been purged.`, 'warning');
    } catch (err) {
      console.error("Delete error:", err);
      triggerToast("Failed to delete record from the treasury database.", "error");
    }
  };

  const handleOpenPreview = (doc: { name: string; url?: string }) => {
    let targetUrl = doc.url || '';

    if (!targetUrl || targetUrl.trim() === '') {
      targetUrl = doc.name;
    }

    if (targetUrl.startsWith('data:') || targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
      // Direct base64 or remote URL
    } else if (targetUrl.startsWith('/uploads/')) {
      targetUrl = `${API_BASE_URL}${targetUrl}`;
    } else {
      targetUrl = `${API_BASE_URL}/uploads/${targetUrl}`;
    }

    setPreviewDocTitle(doc.name);
    setPreviewDocUrl(targetUrl);
  };

  const handleUpdateStatus = (newStatus: StatusType) => {
    if (!currentApp) return;

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const updatedList = applications.map((app) => {
      if (app.id === currentApp.id) {
        const newLog = {
          id: `LOG-${Date.now()}`,
          timestamp,
          officer: app.assignedOfficer || 'Assessor Admin',
          action: `Assessment status updated to "${newStatus}".`
        };

        const newNotif = {
          id: `NOTIF-${Date.now()}`,
          timestamp,
          type: 'SMS' as const,
          message: `RPT Update: Property Declaration ${app.taxDeclarationNumber} is now set to ${newStatus}.`,
          status: 'Delivered' as const
        };

        return {
          ...app,
          status: newStatus,
          auditLogs: [newLog, ...(app.auditLogs || [])],
          notificationLogs: [newNotif, ...(app.notificationLogs || [])]
        };
      }
      return app;
    });

    persistChanges(updatedList);
    triggerToast(`Assessment stage updated to "${newStatus}".`, 'success');
  };

  const handleDocumentStatusChange = (
    docId: string,
    status: 'Verified' | 'Rejected' | 'Pending'
  ) => {
    if (!currentApp) return;

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const updatedList = applications.map((app) => {
      if (app.id === currentApp.id) {
        const updatedDocs = app.documents.map((doc) =>
          doc.id === docId ? { ...doc, status } : doc
        );

        const docName = app.documents.find((d) => d.id === docId)?.name || docId;
        const newLog = {
          id: `LOG-${Date.now()}`,
          timestamp,
          officer: app.assignedOfficer || 'Assessor Admin',
          action: `Title/Boundary document "${docName}" marked as ${status}.`
        };

        return {
          ...app,
          documents: updatedDocs,
          auditLogs: [newLog, ...(app.auditLogs || [])]
        };
      }
      return app;
    });

    persistChanges(updatedList);
    triggerToast(`Document validation updated to ${status}.`, status === 'Verified' ? 'success' : 'warning');
  };

  const handleDigitalRelease = () => {
    if (!currentApp) return;

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const qrVerificationCode = `RPT-CERT-${currentApp.taxDeclarationNumber}-${Date.now()}`.replace(/[^A-Za-z0-9-]/g, '');

    const releasedApp: ExtendedApplicationRecord = {
      ...currentApp,
      status: 'Digital Certificate Issued' as StatusType,
      digitalRelease: {
        releaseMethod: 'Digital' as const,
        releasedAt: timestamp,
        releasedBy: currentApp.assignedOfficer || 'Municipal Assessor',
        certificateType: 'Tax Clearance' as const,
        digitalSignatureStatus: 'Signed' as const,
        qrVerificationCode,
        downloadCount: (currentApp.digitalRelease?.downloadCount || 0) + 1,
        citizenNotified: true
      },
      auditLogs: [
        {
          id: `LOG-${Date.now()}`,
          timestamp,
          officer: currentApp.assignedOfficer || 'Municipal Assessor',
          action: 'Official Real Property Tax Clearance issued and archived.'
        },
        ...(currentApp.auditLogs || [])
      ]
    };

    setApplications(prev => prev.filter(a => a.id !== currentApp.id));
    setCitizenAuditTrail(prev => [releasedApp, ...prev]);
    setSelectedCitizenAppId(releasedApp.id);
    setMainViewTab('citizenAudit');

    triggerToast('Official Tax Clearance approved and transferred to Treasury Archive.', 'success');
  };

  const handleExportCSV = () => {
    const headers = ["Tax Dec No", "PIN", "Property Owner", "Classification", "Assessed Value", "Basic RPT (1%)", "SEF (1%)", "Status"];
    const rows = applications.map((a) => [
      `"${a.taxDeclarationNumber}"`,
      `"${a.propertyDetails?.pin || ''}"`,
      `"${a.applicantName}"`,
      `"${a.propertyDetails?.classification || 'Residential'}"`,
      a.assessedValue || 0,
      a.basicTaxDue || 0,
      a.sefTaxDue || 0,
      `"${a.status}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `RPT_TaxRoll_Masterlist_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleSelectAll = () => {
    if (selectedAppIds.length === filteredApplications.length) {
      setSelectedAppIds([]);
    } else {
      setSelectedAppIds(filteredApplications.map((a) => a.id));
    }
  };

  const toggleSelectApp = (id: string) => {
    setSelectedAppIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <div
      style={{
        marginLeft: isCollapsed ? "80px" : "256px",
        width: isCollapsed ? "calc(100% - 80px)" : "calc(100% - 256px)",
      }}
      className="min-h-screen bg-slate-50/60 dark:bg-slate-950 text-slate-800 dark:text-slate-100 p-6 pt-24 transition-all duration-300 box-border relative"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div
            className={`px-4 py-3 rounded-xl shadow-lg border flex items-center gap-3 text-xs font-semibold ${toastMessage.type === 'success'
                ? 'bg-emerald-950 text-emerald-200 border-emerald-800/80 shadow-emerald-950/20'
                : toastMessage.type === 'warning'
                  ? 'bg-amber-950 text-amber-200 border-amber-800/80 shadow-amber-950/20'
                  : 'bg-rose-950 text-rose-200 border-rose-800/80 shadow-rose-950/20'
              }`}
          >
            <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8 bg-white dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse"></span>
            <span className="text-[11px] font-semibold tracking-wider text-emerald-600 dark:text-emerald-400 uppercase">
              Assessor & Treasury Assessment Division
            </span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Real Property Tax (RPT) & Assessment Roll
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Land Assessments, Tax Declarations, Special Education Fund (SEF) & Clearance Issuance
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setMainViewTab('queue')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${mainViewTab === 'queue'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
            >
              Tax Assessment Roll ({applications.length})
            </button>
            <button
              onClick={() => setMainViewTab('citizenAudit')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${mainViewTab === 'citizenAudit'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
            >
              Issued Clearances ({citizenAuditTrail.length})
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center gap-1.5"
          >
            <i className="fa-solid fa-file-csv text-xs"></i> Export Tax Roll
          </button>
        </div>
      </div>

      {/* RPT Specific Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-white dark:bg-slate-900/80 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex justify-between items-start">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tax Declarations</p>
            <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <i className="fa-solid fa-building-user text-xs"></i>
            </span>
          </div>
          <h4 className="text-2xl font-bold text-slate-900 dark:text-white mt-3">{rptMetrics.totalDeclarations}</h4>
          <p className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Active assessment properties</p>
        </div>

        <div className="bg-white dark:bg-slate-900/80 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex justify-between items-start">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Pending Re-Appraisal</p>
            <span className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <i className="fa-solid fa-calculator text-xs"></i>
            </span>
          </div>
          <h4 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-3">{rptMetrics.pendingValuation}</h4>
          <p className="mt-2 text-[11px] text-slate-400">Under market valuation</p>
        </div>

        <div className="bg-white dark:bg-slate-900/80 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex justify-between items-start">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Assessed Value</p>
            <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <i className="fa-solid fa-scale-balanced text-xs"></i>
            </span>
          </div>
          <h4 className="text-lg font-bold text-slate-900 dark:text-white mt-3 truncate">
            ₱{rptMetrics.totalAssessedValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </h4>
          <p className="mt-2 text-[11px] text-slate-400">Taxable land & structures</p>
        </div>

        <div className="bg-white dark:bg-slate-900/80 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex justify-between items-start">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Basic RPT Levy (1%)</p>
            <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <i className="fa-solid fa-coins text-xs"></i>
            </span>
          </div>
          <h4 className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-3 truncate">
            ₱{rptMetrics.projectedRPTRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </h4>
          <p className="mt-2 text-[11px] text-slate-400">General fund allocation</p>
        </div>

        <div className="bg-white dark:bg-slate-900/80 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex justify-between items-start">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">SEF Allocation (1%)</p>
            <span className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <i className="fa-solid fa-graduation-cap text-xs"></i>
            </span>
          </div>
          <h4 className="text-lg font-bold text-purple-600 dark:text-purple-400 mt-3 truncate">
            ₱{rptMetrics.projectedSEFAllocation.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </h4>
          <p className="mt-2 text-[11px] text-slate-400">Special Education Fund</p>
        </div>
      </div>

      {/* RPT TAX ROLL QUEUE */}
      {mainViewTab === 'queue' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Directory */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <i className="fa-solid fa-magnifying-glass text-xs"></i>
                </span>
                <input
                  type="text"
                  placeholder="Search TD No, PIN, Owner Name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={selectedClassification}
                  onChange={(e) => setSelectedClassification(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="ALL">All Property Classes</option>
                  <option value="Residential">Residential</option>
                  <option value="Commercial">Commercial</option>
                  <option value="Industrial">Industrial</option>
                  <option value="Agricultural">Agricultural</option>
                </select>

                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="ALL">All Stages</option>
                  <option value="Under Evaluation">Under Evaluation</option>
                  <option value="Field Inspection Scheduled">Field Inspection Scheduled</option>
                  <option value="Approved & Ready for Release">Approved & Ready for Release</option>
                </select>
              </div>
            </div>

            <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="p-3 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filteredApplications.length > 0 && selectedAppIds.length === filteredApplications.length}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer"
                  />
                  <span>Assessment Roll ({filteredApplications.length})</span>
                </div>
              </div>

              <div className="max-h-[500px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-1">
                {filteredApplications.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-xs italic">
                    <i className="fa-solid fa-map text-xl mb-2 block"></i>
                    No real property assessment records match criteria.
                  </div>
                ) : (
                  filteredApplications.map((app) => {
                    const isSelected = app.id === currentApp?.id;
                    const isChecked = selectedAppIds.includes(app.id);

                    return (
                      <div
                        key={app.id}
                        className={`w-full p-3 rounded-xl transition-all flex items-start gap-3 border my-1 ${isSelected
                            ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-500/40 shadow-2xs'
                            : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectApp(app.id)}
                          className="mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer flex-shrink-0"
                        />
                        <button
                          onClick={() => setSelectedAppId(app.id)}
                          className="flex-1 text-left flex flex-col gap-1 cursor-pointer"
                        >
                          <div className="flex justify-between items-center gap-2">
                            <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                              {app.taxDeclarationNumber}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              {app.status}
                            </span>
                          </div>
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {app.applicantName}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            PIN: {app.propertyDetails.pin} • {app.propertyDetails.classification}
                          </div>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteApplication(app.id);
                          }}
                          title="Purge Record"
                          className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                        >
                          <i className="fa-solid fa-xmark text-xs"></i>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Detail Panel */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            {!currentApp ? (
              <div className="p-16 text-center space-y-3">
                <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 inline-block">
                  <i className="fa-solid fa-house-flag text-2xl"></i>
                </div>
                <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">No Assessment Selected</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">Select a property declaration from the assessment roll to calculate basic tax levies and inspect boundaries.</p>
              </div>
            ) : (
              <>
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h2 className="text-xl font-bold font-mono text-slate-900 dark:text-white flex items-center gap-2">
                      <i className="fa-solid fa-landmark text-emerald-600 text-base"></i> {currentApp.taxDeclarationNumber}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Property Owner: <span className="font-semibold text-slate-800 dark:text-slate-200">{currentApp.applicantName}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={currentApp.status}
                      onChange={(e) => handleUpdateStatus(e.target.value as StatusType)}
                      className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                    >
                      <option value="Under Evaluation">Under Evaluation</option>
                      <option value="Field Inspection Scheduled">Field Inspection Scheduled</option>
                      <option value="Approved & Ready for Release">Approved & Ready for Release</option>
                      <option value="Digital Certificate Issued">Digital Certificate Issued</option>
                    </select>

                    <button
                      onClick={() => handleDeleteApplication(currentApp.id)}
                      className="bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500 dark:bg-slate-800 dark:text-slate-400 font-semibold px-3 py-2 rounded-xl transition-all border border-slate-200 dark:border-slate-700 text-xs cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-950 px-6 text-xs font-semibold">
                  {(
                    [
                      ['overview', 'Property & Valuation Breakdown'],
                      ['audit', `Audit Log (${currentApp.auditLogs?.length || 0})`],
                      ['notifications', `Notice History (${currentApp.notificationLogs?.length || 0})`]
                    ] as const
                  ).map(([tab, label]) => (
                    <button
                      key={tab}
                      onClick={() => setDetailTab(tab as any)}
                      className={`py-3 px-4 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${detailTab === tab
                          ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="p-6 space-y-6">
                  {detailTab === 'overview' && (
                    <>
                      {/* Property Technical Details & Tax Computation */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                        <div>
                          <p className="text-[11px] font-semibold text-slate-400 uppercase">Property Identification No. (PIN)</p>
                          <p className="text-xs font-bold font-mono text-slate-900 dark:text-white mt-1">{currentApp.propertyDetails.pin}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-slate-400 uppercase">Land Title No. (TCT / OCT)</p>
                          <p className="text-xs font-bold font-mono text-slate-900 dark:text-white mt-1">{currentApp.propertyDetails.titleNumber}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-slate-400 uppercase">Property Classification</p>
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">{currentApp.propertyDetails.classification}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-slate-400 uppercase">Total Lot Area</p>
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">{currentApp.propertyDetails.lotAreaSqM} sq. meters</p>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl border border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/10 space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Assessor Assessment & Levy Schedule</h4>
                        <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                          <div>
                            <span className="text-[10px] text-slate-500 block">Assessed Value</span>
                            <span className="font-bold text-slate-900 dark:text-white">₱{currentApp.assessedValue.toLocaleString('en-PH')}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">Basic RPT (1%)</span>
                            <span className="font-bold text-slate-900 dark:text-white">₱{currentApp.basicTaxDue.toLocaleString('en-PH')}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">SEF (1%)</span>
                            <span className="font-bold text-slate-900 dark:text-white">₱{currentApp.sefTaxDue.toLocaleString('en-PH')}</span>
                          </div>
                        </div>
                      </div>

                      {/* Submitted Documents */}
                      <section className="space-y-3">
                        <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-2">
                          <i className="fa-solid fa-file-contract text-emerald-600"></i> Title & Boundary Evidence Documents ({currentApp.documents.length})
                        </h3>

                        <div className="space-y-3">
                          {currentApp.documents.map((doc) => (
                            <div key={doc.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                              <div>
                                <p className="font-semibold text-xs text-slate-900 dark:text-white">{doc.name}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">Status: <span className="font-medium text-slate-600 dark:text-slate-300">{doc.status}</span></p>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleOpenPreview(doc)}
                                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 font-semibold px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-900 text-xs cursor-pointer transition-colors"
                                >
                                  Preview
                                </button>
                                <button
                                  onClick={() => handleDocumentStatusChange(doc.id, 'Verified')}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1.5 rounded-xl text-xs cursor-pointer transition-colors"
                                >
                                  Verify
                                </button>
                                <button
                                  onClick={() => handleDocumentStatusChange(doc.id, 'Rejected')}
                                  className="bg-rose-600 hover:bg-rose-700 text-white font-semibold px-3 py-1.5 rounded-xl text-xs cursor-pointer transition-colors"
                                >
                                  Reject
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section className="pt-4 border-t border-slate-100 dark:border-slate-800">
                        <button
                          onClick={handleDigitalRelease}
                          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                        >
                          <i className="fa-solid fa-stamp"></i> Issue Official Tax Clearance & Transfer to Archive
                        </button>
                      </section>
                    </>
                  )}

                  {detailTab === 'audit' && (
                    <div className="space-y-2">
                      {currentApp.auditLogs?.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No audit log generated for this property.</p>
                      ) : (
                        currentApp.auditLogs?.map((log) => (
                          <div key={log.id} className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl text-xs bg-slate-50/50 dark:bg-slate-950/50">
                            <p className="font-semibold text-slate-800 dark:text-slate-200">{log.action}</p>
                            <span className="text-[10px] text-slate-400 mt-1 block">{log.timestamp} • {log.officer}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {detailTab === 'notifications' && (
                    <div className="space-y-2">
                      {currentApp.notificationLogs?.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No notice records present.</p>
                      ) : (
                        currentApp.notificationLogs?.map((notif) => (
                          <div key={notif.id} className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl text-xs bg-slate-50/50 dark:bg-slate-950/50">
                            <p className="text-slate-800 dark:text-slate-200">{notif.message}</p>
                            <span className="text-[10px] text-slate-400 mt-1 block">{notif.timestamp} • {notif.type}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ISSUED CLEARANCES ARCHIVE */}
      {mainViewTab === 'citizenAudit' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs flex flex-col gap-4">
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white">Archived Tax Clearances</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Historical property assessment clearances</p>
            </div>

            <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="max-h-[500px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-1">
                {citizenAuditTrail.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-xs italic">
                    <i className="fa-solid fa-box-archive text-xl mb-2 block"></i>
                    No archived property clearances present.
                  </div>
                ) : (
                  citizenAuditTrail.map((app) => (
                    <div
                      key={app.id}
                      onClick={() => setSelectedCitizenAppId(app.id)}
                      className={`p-3 rounded-xl border cursor-pointer my-1 transition-all ${app.id === currentCitizenApp?.id
                          ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-500/40'
                          : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                    >
                      <div className="font-mono font-bold text-xs text-slate-900 dark:text-white">{app.taxDeclarationNumber}</div>
                      <div className="text-xs font-medium text-slate-700 dark:text-slate-300">{app.applicantName}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs">
            {!currentCitizenApp ? (
              <div className="p-16 text-center text-xs text-slate-400 italic">
                Select an archived clearance record to inspect certified attachments.
              </div>
            ) : (
              <div className="space-y-4">
                <h2 className="text-xl font-bold font-mono text-slate-900 dark:text-white">{currentCitizenApp.taxDeclarationNumber}</h2>
                <p className="text-xs text-slate-500">Property Owner: <span className="font-bold text-slate-800 dark:text-slate-200">{currentCitizenApp.applicantName}</span></p>

                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <h3 className="text-xs font-bold uppercase text-slate-500">Certified Documents</h3>
                  {currentCitizenApp.documents.map((doc) => (
                    <div key={doc.id} className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl flex justify-between items-center text-xs bg-slate-50/50 dark:bg-slate-950/50">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{doc.name}</span>
                      <button
                        onClick={() => handleOpenPreview(doc)}
                        className="bg-emerald-50 text-emerald-700 font-semibold px-3 py-1 rounded-lg text-xs cursor-pointer border border-emerald-200"
                      >
                        Preview
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LIGHTBOX PREVIEW */}
      {previewDocUrl && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full h-[85vh] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col my-8">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Document Inspector</span>
                <span className="text-xs text-slate-300 truncate max-w-md">({previewDocTitle})</span>
              </div>
              <button
                onClick={() => setPreviewDocUrl(null)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                Close ✕
              </button>
            </div>
            <div className="flex-1 bg-slate-100 dark:bg-slate-950 overflow-auto flex items-center justify-center p-4">
              {(() => {
                const url = previewDocUrl;
                const isPdf = url.toLowerCase().includes('.pdf') || url.startsWith('data:application/pdf') || url.toLowerCase().endsWith('.pdf');

                if (isPdf) {
                  return (
                    <iframe
                      src={url}
                      className="w-full h-full rounded-xl border-0 shadow-inner bg-white"
                      title="PDF Document Preview"
                    />
                  );
                }

                return (
                  <div className="overflow-auto w-full h-full flex items-center justify-center">
                    <img
                      src={url}
                      alt="Document Preview"
                      className="max-w-none object-contain rounded-xl shadow-lg transition-transform duration-200 hover:scale-105 cursor-zoom-in"
                      style={{ minHeight: '50vh', maxHeight: '75vh' }}
                    />
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RealPropertyTaxView;