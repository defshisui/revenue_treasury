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

  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);
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
        if (mapped.length > 0) {
          setSelectedAppId(mapped[0].id);
        }
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

      if (updatedList.length > 0) {
        setSelectedAppId(updatedList[0].id);
      } else {
        setSelectedAppId('');
      }

      triggerToast(`Application ${targetApp.referenceNumber} has been deleted successfully.`, 'warning');
    } catch (err) {
      console.error("Delete error:", err);
      triggerToast("Failed to delete application from the server database.", "error");
    }
  };

  // Foolproof Preview Lightbox Handler
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
          if (filtered.length > 0 && selectedAppId === app.id) {
            setSelectedAppId(filtered[0].id);
          }
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
        setSelectedCitizenAppId(closedRecord.id);
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
    setSelectedCitizenAppId(releasedApp.id);
    setMainViewTab('citizenAudit');

    triggerToast('Application approved and moved to Audit Trail.', 'success');
  };

  const handleDownloadCertificate = (appId?: string) => {
    const target = appId ? citizenAuditTrail.find(a => a.id === appId) || currentCitizenApp : currentCitizenApp;
    if (!target) return;
    triggerToast(`Document package for ${target.referenceNumber} downloaded successfully.`, 'success');
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
        marginLeft: isCollapsed ? '80px' : '256px',
        width: isCollapsed ? 'calc(100% - 80px)' : 'calc(100% - 256px)'
      }}
      className="min-h-screen bg-slate-950 text-slate-100 p-6 pt-24 transition-all duration-300 flex flex-col font-sans relative selection:bg-blue-600 selection:text-white"
    >
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div
            className={`px-4 py-3 rounded-xl shadow-lg border flex items-center gap-3 text-xs font-semibold ${toastMessage.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-200 border-emerald-800 shadow-emerald-950/50'
                : toastMessage.type === 'warning'
                  ? 'bg-amber-950/90 text-amber-200 border-amber-800 shadow-amber-950/50'
                  : 'bg-rose-950/90 text-rose-200 border-rose-800 shadow-rose-950/50'
              }`}
          >
            <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-blue-950/50 text-blue-400 rounded-xl border border-blue-900/50">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 v5m-4 0h4" />
              </svg>
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              Real Property Assessment & Treasury Portal
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1.5 ml-0.5">
            GovServe • Electronic Processing, Citizen Uploads Inspection & Document Verification
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setMainViewTab('queue')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${mainViewTab === 'queue'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                : 'text-slate-400 hover:text-white'
              }`}
          >
            Active Queue ({applications.length})
          </button>
          <button
            onClick={() => setMainViewTab('citizenAudit')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${mainViewTab === 'citizenAudit'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                : 'text-slate-400 hover:text-white'
              }`}
          >
            Citizen Audit Trail ({citizenAuditTrail.length})
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Applications</span>
          <div className="text-2xl font-bold text-white mt-1">{stats.totalApplications}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Under Evaluation</span>
          <div className="text-2xl font-bold text-blue-400 mt-1">{stats.pendingReview}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Inspection / GIS</span>
          <div className="text-2xl font-bold text-amber-400 mt-1">{stats.pendingInspectionOrGIS}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Ready for Release</span>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{stats.readyForRelease}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Penalties Collected</span>
          <div className="text-2xl font-bold text-indigo-400 mt-1">₱{stats.totalPenaltiesCollected.toLocaleString()}</div>
        </div>
      </div>

      {/* Single Unified Table View for Active Queue */}
      {mainViewTab === 'queue' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col p-6 shadow-xl flex-1">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={filteredApplications.length > 0 && selectedAppIds.length === filteredApplications.length}
                onChange={toggleSelectAll}
                className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
              />
              <h2 className="text-sm font-bold text-white tracking-wide">
                Applications Masterlist ({filteredApplications.length})
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                placeholder="Search Ref No, Applicant, PIN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs text-slate-200 px-3.5 py-2 rounded-xl focus:outline-none focus:border-blue-500 w-64"
              />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs text-slate-200 px-3 py-2 rounded-xl focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                <option value="1.1 Transfer of Ownership">1.1 Transfer of Ownership</option>
                <option value="1.2 Consolidation / Segregation">1.2 Consolidation / Segregation</option>
                <option value="1.3 New Assessment / Reassessment / Reclassification">1.3 New / Reassessment</option>
              </select>
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs text-slate-200 px-3 py-2 rounded-xl focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="Under Evaluation">Under Evaluation</option>
                <option value="Field Inspection Scheduled">Field Inspection Scheduled</option>
                <option value="Approved & Ready for Release">Approved & Ready for Release</option>
              </select>
            </div>
          </div>

          {/* Full Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-950/50">
                  <th className="py-3.5 px-4"></th>
                  <th className="py-3.5 px-4">Reference No.</th>
                  <th className="py-3.5 px-4">Applicant</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Penalty Fee</th>
                  <th className="py-3.5 px-4">Status & Workflow</th>
                  <th className="py-3.5 px-4 text-right">Actions & Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredApplications.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      No matching records in the current queue.
                    </td>
                  </tr>
                ) : (
                  filteredApplications.map((app) => {
                    const isChecked = selectedAppIds.includes(app.id);
                    return (
                      <tr
                        key={app.id}
                        onClick={() => setSelectedAppId(app.id)}
                        className={`hover:bg-slate-800/50 transition-colors ${selectedAppId === app.id ? 'bg-slate-800/80' : ''
                          }`}
                      >
                        <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectApp(app.id)}
                            className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-blue-400">
                          {app.referenceNumber}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white">{app.applicantName}</div>
                          <div className="text-[10px] text-slate-400">{app.propertyDetails.address || 'N/A'}</div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-300">
                          {app.category || 'General Assessment'}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-300">
                          ₱{app.penaltyFee.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={app.status}
                            onChange={(e) => {
                              setSelectedAppId(app.id);
                              handleUpdateStatus(e.target.value as StatusType);
                            }}
                            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 cursor-pointer focus:outline-none focus:border-blue-500"
                          >
                            <option value="Under Evaluation">Under Evaluation</option>
                            <option value="Field Inspection Scheduled">Field Inspection Scheduled</option>
                            <option value="Approved & Ready for Release">Approved & Ready for Release</option>
                            <option value="Digital Certificate Issued">Digital Certificate Issued</option>
                          </select>
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              setSelectedAppId(app.id);
                              if (app.documents.length > 0) {
                                handleOpenPreview(app.documents[0]);
                              } else {
                                triggerToast('No documents available for preview.', 'warning');
                              }
                            }}
                            className="px-3 py-1 bg-blue-950 hover:bg-blue-900 text-blue-300 border border-blue-800/80 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            Preview Doc
                          </button>
                          <button
                            onClick={() => {
                              setSelectedAppId(app.id);
                              handleDigitalRelease();
                            }}
                            className="px-3 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleDeleteApplication(app.id)}
                            className="px-2.5 py-1 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800/80 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Active Detail Modal / Expanded Tab Drawer at Bottom */}
          {currentApp && (
            <div className="mt-6 pt-6 border-t border-slate-800 bg-slate-950/60 rounded-xl p-5">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Selected Application Drawer</span>
                  <h3 className="text-base font-bold text-white font-mono">{currentApp.referenceNumber} - {currentApp.applicantName}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDetailTab('overview')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${detailTab === 'overview' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'
                      }`}
                  >
                    Documents ({currentApp.documents.length})
                  </button>
                  <button
                    onClick={() => setDetailTab('audit')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${detailTab === 'audit' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'
                      }`}
                  >
                    Audit Logs ({currentApp.auditLogs?.length || 0})
                  </button>
                  <button
                    onClick={() => setDetailTab('notifications')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${detailTab === 'notifications' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'
                      }`}
                  >
                    Notification Logs ({currentApp.notificationLogs?.length || 0})
                  </button>
                </div>
              </div>

              {detailTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {currentApp.documents.map((doc) => (
                    <div key={doc.id} className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="font-bold text-white text-xs">{doc.name}</p>
                        <p className="text-[10px] text-slate-400">Status: {doc.status}</p>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleOpenPreview(doc)}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-xs rounded text-white cursor-pointer"
                        >
                          Preview
                        </button>
                        <button
                          onClick={() => handleDocumentStatusChange(doc.id, 'Verified')}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-xs rounded text-white cursor-pointer"
                        >
                          Verify
                        </button>
                        <button
                          onClick={() => handleDocumentStatusChange(doc.id, 'Rejected')}
                          className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-xs rounded text-white cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {detailTab === 'audit' && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {currentApp.auditLogs?.map((log) => (
                    <div key={log.id} className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs">
                      <p className="font-semibold text-slate-200">{log.action}</p>
                      <span className="text-[10px] text-slate-500">{log.timestamp} • {log.officer}</span>
                    </div>
                  ))}
                </div>
              )}

              {detailTab === 'notifications' && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {currentApp.notificationLogs?.map((notif) => (
                    <div key={notif.id} className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs">
                      <p className="text-slate-200">{notif.message}</p>
                      <span className="text-[10px] text-slate-500">{notif.timestamp} • {notif.type}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Citizen Audit Trail View */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex-1">
          <h2 className="text-sm font-bold text-white tracking-wide mb-4 pb-4 border-b border-slate-800">
            Citizen Document Audit Vault
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-950/50">
                  <th className="py-3.5 px-4">Reference No.</th>
                  <th className="py-3.5 px-4">Applicant</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Release Status</th>
                  <th className="py-3.5 px-4 text-right">Certificate Vault</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {citizenAuditTrail.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      No archived records in the audit trail.
                    </td>
                  </tr>
                ) : (
                  citizenAuditTrail.map((app) => (
                    <tr key={app.id} className="hover:bg-slate-800/50">
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-400">{app.referenceNumber}</td>
                      <td className="py-3.5 px-4 font-semibold text-white">{app.applicantName}</td>
                      <td className="py-3.5 px-4 text-slate-300">{app.category}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/50">
                          {app.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleDownloadCertificate(app.id)}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Export Package
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lightbox Preview Modal */}
      {previewDocUrl && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl h-[85vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 bg-slate-950 text-white flex justify-between items-center border-b border-slate-800">
              <span className="text-xs font-bold text-blue-400 uppercase">Document Vault Inspector ({previewDocTitle})</span>
              <button
                onClick={() => setPreviewDocUrl(null)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Close ✕
              </button>
            </div>
            <div className="flex-1 bg-slate-950 flex items-center justify-center p-4 overflow-auto">
              {previewDocUrl.toLowerCase().includes('.pdf') || previewDocUrl.startsWith('data:application/pdf') ? (
                <iframe
                  src={previewDocUrl}
                  className="w-full h-full rounded-xl border-0 bg-white"
                  title="PDF Preview"
                />
              ) : (
                <img
                  src={previewDocUrl}
                  alt="Preview"
                  className="max-w-full max-h-full object-contain rounded-xl shadow-lg"
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