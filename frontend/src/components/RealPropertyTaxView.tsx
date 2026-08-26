// src/components/RealPropertyTaxView.tsx
import React, { useState, useMemo, useEffect } from 'react';
import type {
  StatusType,
  AdminStats
} from '../types/treasury';
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

export const RealPropertyTaxView: React.FC<RealPropertyTaxViewProps> = ({
  isCollapsed
}) => {
  const [applications, setApplications] = useState<ExtendedApplicationRecord[]>([]);
  const [citizenAuditTrail, setCitizenAuditTrail] = useState<ExtendedApplicationRecord[]>([]);

  const [selectedCitizenAppId, setSelectedCitizenAppId] = useState<string>('');
  const [selectedAppId, setSelectedAppId] = useState<string>('');

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');

  const [mainViewTab, setMainViewTab] = useState<'queue' | 'citizenAudit'>('queue');
  const [detailTab, setDetailTab] = useState<'overview' | 'audit' | 'notifications'>('overview');

  // Document Preview Lightbox State
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);
  const [previewDocTitle, setPreviewDocTitle] = useState<string>('');

  // Toast Notification Feedback State
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

          return {
            ...item,
            id: item.id || `RPT-${Math.random().toString(36).substring(2, 9)}`,
            applicantName: item.applicantName || item.ownerName || 'Unknown Applicant',
            status: item.status || 'Under Evaluation',
            referenceNumber: item.controlNumber || item.referenceNumber || `REF-${item.id}`,
            applicantEmail: item.email || '',
            applicantPhone: item.mobileNumber || '',
            category: item.service || '',
            submissionDate: item.filedDate || '',
            penaltyFee: item.penalty ? Number(item.penalty) : 0,
            propertyDetails: item.propertyDetails || {
              pin: item.pin || '',
              titleNumber: item.taxDeclarationNumber || '',
              lotAreaSqM: item.lotAreaSqM || 0,
              address: item.propertyLocation || '',
              currentValuation: item.currentValuation || 0
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
      })
      .catch((err) => {
        console.error("Failed to load RPT applications:", err);
        triggerToast("Failed to fetch applications from server database.", "error");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const currentApp = useMemo(() => {
    return applications.find((app) => app.id === selectedAppId);
  }, [applications, selectedAppId]);

  const currentCitizenApp = useMemo(() => {
    return citizenAuditTrail.find((app) => app.id === selectedCitizenAppId);
  }, [citizenAuditTrail, selectedCitizenAppId]);

  const stats: AdminStats = useMemo(() => {
    return {
      totalApplications: applications.length,
      pendingReview: applications.filter(
        (a) => a.status === 'Under Evaluation'
      ).length,
      pendingInspectionOrGIS: applications.filter(
        (a) =>
          a.status === 'Field Inspection Scheduled' ||
          a.status === 'Technical Plotting (GIS)'
      ).length,
      readyForRelease: applications.filter(
        (a) =>
          a.status === 'Approved & Ready for Release' ||
          a.status === 'Digital Certificate Issued'
      ).length,
      totalPenaltiesCollected: applications.reduce(
        (acc, curr) =>
          acc + (curr.paymentStatus === 'Paid' ? curr.penaltyFee : 0),
        0
      )
    };
  }, [applications]);

  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      const matchesSearch =
        app.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.applicantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.propertyDetails.pin.includes(searchTerm);

      const matchesCategory =
        selectedCategory === 'ALL' || app.category === selectedCategory;

      const matchesStatus =
        selectedStatusFilter === 'ALL' || app.status === selectedStatusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [applications, searchTerm, selectedCategory, selectedStatusFilter]);

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
            penalty: target.penaltyFee,
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

    try {
      const response = await fetch(`${API_BASE_URL}/citizen-rpt-applications/${appId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete application from server');
      }

      const updatedList = applications.filter(a => a.id !== appId);
      setApplications(updatedList);

      if (selectedAppId === appId) {
        setSelectedAppId('');
      }

      triggerToast(`Application ${targetApp.referenceNumber} has been deleted successfully.`, 'warning');
    } catch (err) {
      console.error("Delete error:", err);
      triggerToast("Failed to delete application from the server database.", "error");
    }
  };

  const handleOpenPreview = (doc: { name: string; url?: string }) => {
    let targetUrl = doc.url || '';

    if (!targetUrl || targetUrl.trim() === '') {
      targetUrl = doc.name;
    }

    if (targetUrl.startsWith('data:')) {
      // Base64 string ready for lightbox
    } else if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
      // Fully qualified absolute URL
    } else if (targetUrl.startsWith('/uploads/')) {
      targetUrl = `${API_BASE_URL}${targetUrl}`;
    } else {
      targetUrl = `${API_BASE_URL}/uploads/${targetUrl}`;
    }

    setPreviewDocTitle(doc.name);
    setPreviewDocUrl(targetUrl);
  };

  const checkAndAutoCloseQueueItem = (app: ExtendedApplicationRecord, updatedDocs: typeof app.documents) => {
    const allVerified = updatedDocs.length > 0 && updatedDocs.every(d => d.status === 'Verified');
    if (allVerified) {
      setTimeout(() => {
        setApplications(prev => {
          const filtered = prev.filter(a => a.id !== app.id);
          if (selectedAppId === app.id) setSelectedAppId('');
          return filtered;
        });

        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
        const closedRecord: ExtendedApplicationRecord = {
          ...app,
          documents: updatedDocs,
          status: 'Digital Certificate Issued',
          auditLogs: [
            {
              id: `LOG-${Date.now()}`,
              timestamp,
              officer: 'System Automation',
              action: 'All citizen uploaded documents verified. Automatically closed and transferred to Audit Trail.'
            },
            ...(app.auditLogs || [])
          ]
        };

        setCitizenAuditTrail(prev => [closedRecord, ...prev]);
        triggerToast(`Queue item ${app.referenceNumber} verified and moved to Audit Trail.`, 'success');
      }, 300);
    }
  };

  const handleUpdateStatus = (newStatus: StatusType) => {
    if (!currentApp) return;

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const updatedList = applications.map((app) => {
      if (app.id === currentApp.id) {
        const newLog = {
          id: `LOG-${Date.now()}`,
          timestamp,
          officer: app.assignedOfficer || 'System Admin',
          action: `Status updated to "${newStatus}".`
        };

        const newNotif = {
          id: `NOTIF-${Date.now()}`,
          timestamp,
          type: 'SMS' as const,
          message: `Your application ${app.referenceNumber} status has been updated to ${newStatus}.`,
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
    triggerToast(`Application workflow updated to "${newStatus}".`, 'success');
  };

  const handleDocumentStatusChange = (
    docId: string,
    status: 'Verified' | 'Rejected' | 'Pending'
  ) => {
    if (!currentApp) return;

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    let updatedDocsState: typeof currentApp.documents = [];

    const updatedList = applications.map((app) => {
      if (app.id === currentApp.id) {
        updatedDocsState = app.documents.map((doc) =>
          doc.id === docId ? { ...doc, status } : doc
        );

        const docName = app.documents.find((d) => d.id === docId)?.name || docId;
        const newLog = {
          id: `LOG-${Date.now()}`,
          timestamp,
          officer: app.assignedOfficer || 'System Admin',
          action: `Citizen uploaded document "${docName}" marked as ${status}.`
        };

        return {
          ...app,
          documents: updatedDocsState,
          auditLogs: [newLog, ...(app.auditLogs || [])]
        };
      }
      return app;
    });

    persistChanges(updatedList);

    if (status === 'Verified') {
      triggerToast('Document successfully verified.', 'success');
      checkAndAutoCloseQueueItem(currentApp, updatedDocsState);
    } else if (status === 'Rejected') {
      triggerToast('Document marked as rejected.', 'warning');
    }
  };

  const handleDigitalRelease = () => {
    if (!currentApp) return;

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const qrVerificationCode = `QC-${currentApp.referenceNumber}-${Date.now()}`.replace(/[^A-Za-z0-9-]/g, '');

    const releasedApp: ExtendedApplicationRecord = {
      ...currentApp,
      status: 'Digital Certificate Issued' as StatusType,
      digitalRelease: {
        releaseMethod: 'Digital' as const,
        releasedAt: timestamp,
        releasedBy: currentApp.assignedOfficer || 'System Admin',
        certificateType: 'Tax Declaration / CTC' as const,
        digitalSignatureStatus: 'Signed' as const,
        qrVerificationCode,
        downloadCount: (currentApp.digitalRelease?.downloadCount || 0) + 1,
        citizenNotified: true
      },
      auditLogs: [
        {
          id: `LOG-${Date.now()}`,
          timestamp,
          officer: currentApp.assignedOfficer || 'System Admin',
          action: 'Application approved and archived.'
        },
        ...(currentApp.auditLogs || [])
      ],
      notificationLogs: [
        {
          id: `NOTIF-${Date.now()}`,
          timestamp,
          type: 'Email' as const,
          message: `Your application ${currentApp.referenceNumber} has been approved.`,
          status: 'Delivered' as const
        },
        ...(currentApp.notificationLogs || [])
      ]
    };

    setApplications(prev => prev.filter(a => a.id !== currentApp.id));
    setCitizenAuditTrail(prev => [releasedApp, ...prev]);
    setSelectedAppId('');

    triggerToast('Application approved and moved to Audit Trail.', 'success');
  };

  const handleDownloadCertificate = (appId?: string) => {
    const target = appId ? citizenAuditTrail.find(a => a.id === appId) || currentCitizenApp : currentCitizenApp;
    if (!target) return;
    triggerToast(`Document package for ${target.referenceNumber} downloaded successfully.`, 'success');
  };

  return (
    <div
      style={{
        marginLeft: isCollapsed ? '80px' : '256px',
        width: isCollapsed ? 'calc(100% - 80px)' : 'calc(100% - 256px)'
      }}
      className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 pt-24 transition-all duration-300 box-border flex flex-col font-sans relative selection:bg-blue-600 selection:text-white"
    >
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
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <span className="p-2 bg-blue-600/20 border border-blue-500/30 rounded-xl text-blue-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </span>
            Real Property Assessment & Treasury Portal
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1.5 ml-0.5">
            GovServe • Electronic Processing, Citizen Uploads Inspection & Document Verification
          </p>
        </div>

        <div className="flex items-center gap-3 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => { setMainViewTab('queue'); setSelectedAppId(''); }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${mainViewTab === 'queue'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            Active Queue ({applications.length})
          </button>
          <button
            onClick={() => { setMainViewTab('citizenAudit'); setSelectedCitizenAppId(''); }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${mainViewTab === 'citizenAudit'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            Citizen Documents Audit Trail ({citizenAuditTrail.length})
          </button>
        </div>
      </div>

      {/* Top Cards & Search Controls Row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Under Evaluation</span>
          <div className="text-3xl font-bold text-white mt-2">{stats.pendingReview}</div>
        </div>
        <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Inspection / Other</span>
          <div className="text-3xl font-bold text-white mt-2">{stats.pendingInspectionOrGIS}</div>
        </div>
        <div className="lg:col-span-2 bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 shadow-sm flex flex-col sm:flex-row gap-3 items-center">
          <input
            type="text"
            placeholder="Search Ref No, Applicant, PIN..."
            className="w-full sm:flex-1 px-4 py-2.5 rounded-xl border border-slate-700/80 bg-slate-950 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-700/80 bg-slate-950 text-slate-200 text-xs cursor-pointer focus:outline-none focus:border-blue-500"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="ALL">All Categories</option>
            <option value="1.1 Transfer of Ownership">1.1 Transfer of Ownership</option>
            <option value="1.2 Consolidation / Segregation">1.2 Consolidation / Segregation</option>
            <option value="1.3 New Assessment / Reassessment / Reclassification">1.3 New / Reassessment</option>
          </select>
          <select
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-700/80 bg-slate-950 text-slate-200 text-xs cursor-pointer focus:outline-none focus:border-blue-500"
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="Under Evaluation">Under Evaluation</option>
            <option value="Field Inspection Scheduled">Field Inspection Scheduled</option>
            <option value="Approved & Ready for Release">Approved & Ready for Release</option>
          </select>
        </div>
      </div>

      {/* Main Split-Screen Container matching your layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">

        {/* LEFT COLUMN: Queue / Archive List (Span 4) */}
        <div className="lg:col-span-4 bg-slate-900/60 rounded-2xl border border-slate-800/80 shadow-sm overflow-hidden flex flex-col h-[650px]">
          <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center gap-3">
            <input type="checkbox" className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0 cursor-pointer" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              {mainViewTab === 'queue' ? `Queue (${filteredApplications.length})` : `Archives (${citizenAuditTrail.length})`}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
            {mainViewTab === 'queue' ? (
              filteredApplications.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs">Application queue is currently empty.</div>
              ) : (
                filteredApplications.map(app => {
                  const isSelected = selectedAppId === app.id;
                  return (
                    <div
                      key={app.id}
                      onClick={() => setSelectedAppId(app.id)}
                      className={`p-4 cursor-pointer transition-colors flex items-start gap-3 ${isSelected ? 'bg-blue-600/10 border-l-4 border-blue-500' : 'hover:bg-slate-800/40'}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => { }}
                        className="mt-1 rounded border-slate-700 bg-slate-950 text-blue-600 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-mono font-bold text-xs text-white truncate">{app.referenceNumber}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-blue-400 font-semibold">{app.status}</span>
                        </div>
                        <p className="text-xs font-semibold text-slate-200 truncate">{app.applicantName}</p>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{app.category}</p>
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              citizenAuditTrail.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs">No archived items found.</div>
              ) : (
                citizenAuditTrail.map(app => {
                  const isSelected = selectedCitizenAppId === app.id;
                  return (
                    <div
                      key={app.id}
                      onClick={() => setSelectedCitizenAppId(app.id)}
                      className={`p-4 cursor-pointer transition-colors flex items-start gap-3 ${isSelected ? 'bg-blue-600/10 border-l-4 border-blue-500' : 'hover:bg-slate-800/40'}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-mono font-bold text-xs text-white truncate">{app.referenceNumber}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-semibold">Released</span>
                        </div>
                        <p className="text-xs font-semibold text-slate-200 truncate">{app.applicantName}</p>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{app.digitalRelease?.releasedAt || 'N/A'}</p>
                      </div>
                    </div>
                  );
                })
              )
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Application Inspector / Detail Panel (Span 8) */}
        <div className="lg:col-span-8 bg-slate-900/60 rounded-2xl border border-slate-800/80 shadow-sm overflow-hidden flex flex-col h-[650px]">
          {mainViewTab === 'queue' ? (
            !currentApp ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-500">
                <div className="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center mb-4 text-slate-400">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round5" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-white">No Application Selected</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">Select an application from the queue to inspect documents and workflow steps.</p>
              </div>
            ) : (
              <div className="flex flex-col h-full bg-slate-900/40">
                <div className="p-5 bg-slate-900 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h2 className="text-base font-bold font-mono text-white">{currentApp.referenceNumber}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Applicant: <span className="text-slate-200 font-semibold">{currentApp.applicantName}</span></p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={currentApp.status}
                      onChange={(e) => handleUpdateStatus(e.target.value as StatusType)}
                      className="text-xs font-semibold px-3 py-2 border border-slate-700 rounded-xl bg-slate-950 text-slate-200 cursor-pointer focus:outline-none"
                    >
                      <option value="Under Evaluation">Under Evaluation</option>
                      <option value="Field Inspection Scheduled">Field Inspection Scheduled</option>
                      <option value="Approved & Ready for Release">Approved & Ready for Release</option>
                      <option value="Digital Certificate Issued">Digital Certificate Issued</option>
                    </select>
                    <button
                      onClick={() => handleDeleteApplication(currentApp.id)}
                      className="px-3 py-2 bg-rose-950/40 hover:bg-rose-900 text-rose-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="flex border-b border-slate-800 bg-slate-900/60 px-5 text-xs font-semibold">
                  {(
                    [
                      ['overview', 'Overview & Uploads'],
                      ['audit', `Audit Trail (${currentApp.auditLogs?.length || 0})`],
                      ['notifications', `SMS / Email Log (${currentApp.notificationLogs?.length || 0})`]
                    ] as const
                  ).map(([tab, label]) => (
                    <button
                      key={tab}
                      onClick={() => setDetailTab(tab as any)}
                      className={`py-3 px-4 border-b-2 transition-colors cursor-pointer ${detailTab === tab ? 'border-blue-500 text-blue-400 font-bold' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                  {detailTab === 'overview' && (
                    <>
                      <div className="space-y-3">
                        <h3 className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Uploaded Documents ({currentApp.documents.length})</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {currentApp.documents.map((doc) => (
                            <div key={doc.id} className="p-3.5 border border-slate-800 rounded-xl bg-slate-950/50 flex flex-col justify-between gap-3 text-xs">
                              <div>
                                <p className="font-bold text-slate-200 truncate">{doc.name}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">Status: <span className={doc.status === 'Verified' ? 'text-emerald-400' : doc.status === 'Rejected' ? 'text-rose-400' : 'text-amber-400'}>{doc.status}</span></p>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => handleOpenPreview(doc)} className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-semibold transition-colors cursor-pointer">Preview</button>
                                <button onClick={() => handleDocumentStatusChange(doc.id, 'Verified')} className="flex-1 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-lg font-semibold transition-colors cursor-pointer">Verify</button>
                                <button onClick={() => handleDocumentStatusChange(doc.id, 'Rejected')} className="flex-1 py-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white rounded-lg font-semibold transition-colors cursor-pointer">Reject</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-800">
                        <button
                          onClick={handleDigitalRelease}
                          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-lg cursor-pointer"
                        >
                          Approve, Release & Move to Audit Trail
                        </button>
                      </div>
                    </>
                  )}

                  {detailTab === 'audit' && (
                    <div className="space-y-2">
                      {currentApp.auditLogs?.map((log) => (
                        <div key={log.id} className="p-3 border border-slate-800 rounded-xl text-xs bg-slate-950/40">
                          <p className="font-semibold text-slate-200">{log.action}</p>
                          <div className="flex justify-between mt-1 text-[10px] text-slate-500">
                            <span>{log.timestamp}</span>
                            <span>{log.officer}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {detailTab === 'notifications' && (
                    <div className="space-y-2">
                      {currentApp.notificationLogs?.map((notif) => (
                        <div key={notif.id} className="p-3 border border-slate-800 rounded-xl text-xs bg-slate-950/40">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-1.5 py-0.5 bg-slate-800 rounded text-[9px] font-bold text-slate-300">{notif.type}</span>
                            <span className={`text-[9px] font-bold ${notif.status === 'Delivered' ? 'text-emerald-500' : 'text-amber-500'}`}>{notif.status}</span>
                          </div>
                          <p className="text-slate-300">{notif.message}</p>
                          <span className="block mt-1 text-[10px] text-slate-500">{notif.timestamp}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          ) : (
            !currentCitizenApp ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-500">
                <h3 className="text-sm font-bold text-white">No Archive Selected</h3>
                <p className="text-xs text-slate-400 mt-1">Select an archived item from the left to review released files.</p>
              </div>
            ) : (
              <div className="flex flex-col h-full bg-slate-900/40 p-6 space-y-6 overflow-y-auto">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-base font-bold font-mono text-white">{currentCitizenApp.referenceNumber}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Applicant: <span className="text-slate-200 font-semibold">{currentCitizenApp.applicantName}</span></p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-xl text-xs font-bold">Released</span>
                </div>

                <div className="space-y-3">
                  <h3 className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Archived Documents</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {currentCitizenApp.documents.map((doc) => (
                      <div key={doc.id} className="p-3 border border-slate-800 rounded-xl flex justify-between items-center text-xs bg-slate-950/50">
                        <span className="font-semibold text-slate-200 truncate">{doc.name}</span>
                        <button onClick={() => handleOpenPreview(doc)} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold cursor-pointer">Preview</button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <button onClick={() => handleDownloadCertificate(currentCitizenApp.id)} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow cursor-pointer">
                    Download Document Package
                  </button>
                </div>
              </div>
            )
          )}
        </div>

      </div>

      {/* DOCUMENT PREVIEW LIGHTBOX MODAL */}
      {previewDocUrl && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl h-[85vh] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-950 text-white flex justify-between items-center border-b border-slate-800">
              <div className="flex items-center gap-3">
                <span className="text-xs uppercase font-bold text-blue-500">Document Inspector</span>
                <span className="text-xs text-slate-400 truncate max-w-md">({previewDocTitle})</span>
              </div>
              <button
                onClick={() => setPreviewDocUrl(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
              >
                Close ✕
              </button>
            </div>
            <div className="flex-1 bg-slate-950/50 overflow-auto flex items-center justify-center p-4">
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