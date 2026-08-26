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
  const [showDetail, setShowDetail] = useState<boolean>(false);

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
        setShowDetail(false);
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
          if (selectedAppId === app.id) setShowDetail(false);
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
    setShowDetail(false);

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
      className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 pt-24 transition-all duration-300 box-border flex flex-col font-sans relative selection:bg-blue-600 selection:text-white"
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
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Real Property Assessment & Treasury Portal
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1.5 ml-0.5">
            GovServe • Electronic Processing, Citizen Uploads Inspection & Document Verification
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => { setMainViewTab('queue'); setShowDetail(false); }}
            className={`px-4 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${mainViewTab === 'queue'
              ? 'bg-blue-600 text-white border-blue-500 shadow-2xs'
              : 'bg-slate-800/50 text-slate-300 border-slate-700/50 hover:bg-slate-800'
              }`}
          >
            Active Queue ({applications.length})
          </button>
          <button
            onClick={() => { setMainViewTab('citizenAudit'); setShowDetail(false); }}
            className={`px-4 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${mainViewTab === 'citizenAudit'
              ? 'bg-blue-600 text-white border-blue-500 shadow-2xs'
              : 'bg-slate-800/50 text-slate-300 border-slate-700/50 hover:bg-slate-800'
              }`}
          >
            Citizen Documents Audit Trail ({citizenAuditTrail.length})
          </button>
        </div>
      </div>

      {/* Horizontal Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800/80 shadow-2xs">
          <span className="text-[11px] text-slate-500 font-medium tracking-wide">Total Applications</span>
          <div className="text-2xl font-bold text-white mt-1">{stats.totalApplications}</div>
          <div className="text-[10px] text-blue-500 mt-1 font-semibold">Active Queue</div>
        </div>
        <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800/80 shadow-2xs">
          <span className="text-[11px] text-slate-500 font-medium tracking-wide">Under Evaluation</span>
          <div className="text-2xl font-bold text-amber-500 mt-1">{stats.pendingReview}</div>
          <div className="text-[10px] text-slate-500 mt-1">Requires document check</div>
        </div>
        <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800/80 shadow-2xs">
          <span className="text-[11px] text-slate-500 font-medium tracking-wide">Inspection / Other</span>
          <div className="text-2xl font-bold text-emerald-500 mt-1">{stats.pendingInspectionOrGIS}</div>
          <div className="text-[10px] text-slate-500 mt-1">Field visits & GIS pending</div>
        </div>
        <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800/80 shadow-2xs">
          <span className="text-[11px] text-slate-500 font-medium tracking-wide">Ready for Release</span>
          <div className="text-2xl font-bold text-blue-500 mt-1">{stats.readyForRelease}</div>
          <div className="text-[10px] text-slate-500 mt-1">Approved for issuance</div>
        </div>
      </div>

      {/* Main Data Container */}
      <div className="flex-1 bg-slate-900/60 rounded-xl border border-slate-800/80 shadow-2xs flex flex-col overflow-hidden min-h-[500px]">

        {/* ACTIVE QUEUE */}
        {mainViewTab === 'queue' && (
          <>
            {!showDetail ? (
              /* Masterlist Table View */
              <div className="flex flex-col h-full">
                <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-900/80">
                  <h3 className="font-bold text-white text-sm">Applications Masterlist</h3>
                  <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <input
                      type="text"
                      placeholder="Search Ref No, Applicant, PIN..."
                      className="w-full sm:w-64 px-4 py-2 rounded-lg border border-slate-700 bg-slate-950/50 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <select
                      className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-950/50 text-slate-200 text-xs cursor-pointer focus:outline-none focus:border-blue-500"
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                    >
                      <option value="ALL">All Categories</option>
                      <option value="1.1 Transfer of Ownership">1.1 Transfer of Ownership</option>
                      <option value="1.2 Consolidation / Segregation">1.2 Consolidation / Segregation</option>
                      <option value="1.3 New Assessment / Reassessment / Reclassification">1.3 New / Reassessment</option>
                    </select>
                    <select
                      className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-950/50 text-slate-200 text-xs cursor-pointer focus:outline-none focus:border-blue-500"
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

                <div className="flex-1 overflow-auto">
                  {filteredApplications.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 text-sm">No applications found in the queue.</div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-950 text-[10px] uppercase text-slate-500 sticky top-0 border-b border-slate-800 z-10">
                        <tr>
                          <th className="p-4 font-semibold whitespace-nowrap">REFERENCE NO.</th>
                          <th className="p-4 font-semibold whitespace-nowrap">APPLICANT & CATEGORY</th>
                          <th className="p-4 font-semibold whitespace-nowrap">PROPERTY PIN</th>
                          <th className="p-4 font-semibold whitespace-nowrap">STATUS</th>
                          <th className="p-4 font-semibold text-right whitespace-nowrap">ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-sm">
                        {filteredApplications.map(app => (
                          <tr
                            key={app.id}
                            className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                            onClick={() => { setSelectedAppId(app.id); setShowDetail(true); }}
                          >
                            <td className="p-4 font-mono font-bold text-slate-200">{app.referenceNumber}</td>
                            <td className="p-4">
                              <div className="font-semibold text-slate-100">{app.applicantName}</div>
                              <div className="text-[11px] text-slate-400 mt-0.5">{app.category}</div>
                            </td>
                            <td className="p-4 text-slate-300 font-mono text-xs">{app.propertyDetails.pin || 'N/A'}</td>
                            <td className="p-4">
                              <span className="px-2.5 py-1 bg-slate-800/80 text-blue-400 rounded-full text-[10px] font-semibold border border-blue-900/30 whitespace-nowrap">
                                {app.status}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  className="px-3 py-1.5 text-xs font-medium bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/30 transition-colors"
                                  onClick={(e) => { e.stopPropagation(); setSelectedAppId(app.id); setShowDetail(true); }}
                                >
                                  Inspect
                                </button>
                                <button
                                  className="px-3 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-900/30 rounded transition-colors opacity-0 group-hover:opacity-100"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteApplication(app.id); }}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ) : (
              /* Detail View Drill-down */
              <div className="flex flex-col h-full bg-slate-900">
                <div className="p-3 bg-slate-950/50 border-b border-slate-800 flex items-center justify-between">
                  <button
                    onClick={() => setShowDetail(false)}
                    className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to Masterlist
                  </button>
                  {currentApp && (
                    <button
                      onClick={() => handleDeleteApplication(currentApp.id)}
                      className="text-xs font-semibold text-rose-400 hover:bg-rose-950 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      Delete Application
                    </button>
                  )}
                </div>

                {!currentApp ? (
                  <div className="flex-1 flex items-center justify-center text-slate-500">Record not found.</div>
                ) : (
                  <>
                    <div className="p-5 sm:p-6 border-b border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white font-mono">
                          {currentApp.referenceNumber}
                        </h2>
                        <p className="text-sm text-slate-400 mt-1">
                          Applicant: <span className="font-semibold text-slate-200">{currentApp.applicantName}</span>
                        </p>
                      </div>
                      <select
                        value={currentApp.status}
                        onChange={(e) => handleUpdateStatus(e.target.value as StatusType)}
                        className="text-xs font-semibold px-4 py-2 border border-slate-700 rounded-xl bg-slate-950 text-slate-200 cursor-pointer focus:outline-none focus:border-blue-500"
                      >
                        <option value="Under Evaluation">Under Evaluation</option>
                        <option value="Field Inspection Scheduled">Field Inspection Scheduled</option>
                        <option value="Approved & Ready for Release">Approved & Ready for Release</option>
                        <option value="Digital Certificate Issued">Digital Certificate Issued</option>
                      </select>
                    </div>

                    <div className="flex border-b border-slate-800 bg-slate-900 px-5 text-xs font-semibold">
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
                          className={`py-3.5 px-4 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${detailTab === tab
                            ? 'border-blue-500 text-blue-400 font-bold'
                            : 'border-transparent text-slate-500 hover:text-slate-300'
                            }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
                      {detailTab === 'overview' && (
                        <>
                          <section className="space-y-4">
                            <h3 className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                              Documents Uploaded by Citizen ({currentApp.documents.length})
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {currentApp.documents.map((doc) => (
                                <div key={doc.id} className="flex flex-col p-4 border border-slate-700/50 rounded-xl text-xs bg-slate-800/30 gap-4 shadow-2xs">
                                  <div>
                                    <p className="font-bold text-white mb-1">{doc.name}</p>
                                    <p className="text-[10px] text-slate-400">Status: <span className={doc.status === 'Verified' ? 'text-emerald-400' : doc.status === 'Rejected' ? 'text-rose-400' : 'text-amber-400'}>{doc.status}</span></p>
                                  </div>
                                  <div className="flex gap-2 flex-wrap">
                                    <button
                                      onClick={() => handleOpenPreview(doc)}
                                      className="flex-1 px-3 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg font-semibold cursor-pointer transition-colors"
                                    >
                                      Preview
                                    </button>
                                    <button
                                      onClick={() => handleDocumentStatusChange(doc.id, 'Verified')}
                                      className="flex-1 px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/50 rounded-lg font-semibold cursor-pointer transition-colors"
                                    >
                                      Verify
                                    </button>
                                    <button
                                      onClick={() => handleDocumentStatusChange(doc.id, 'Rejected')}
                                      className="flex-1 px-3 py-2 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/50 rounded-lg font-semibold cursor-pointer transition-colors"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </section>

                          <section className="pt-6 border-t border-slate-800">
                            <button
                              onClick={handleDigitalRelease}
                              className="w-full md:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm cursor-pointer transition-colors shadow-lg shadow-blue-900/20"
                            >
                              Approve, Release & Move to Audit Trail
                            </button>
                          </section>
                        </>
                      )}

                      {detailTab === 'audit' && (
                        <div className="space-y-3">
                          {currentApp.auditLogs?.map((log) => (
                            <div key={log.id} className="p-4 border border-slate-800 rounded-xl text-xs bg-slate-900/50">
                              <p className="font-bold text-slate-200">{log.action}</p>
                              <div className="flex items-center justify-between mt-2 text-[10px] text-slate-500">
                                <span>{log.timestamp}</span>
                                <span>{log.officer}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {detailTab === 'notifications' && (
                        <div className="space-y-3">
                          {currentApp.notificationLogs?.map((notif) => (
                            <div key={notif.id} className="p-4 border border-slate-800 rounded-xl text-xs bg-slate-900/50">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="px-2 py-0.5 bg-slate-800 rounded text-[10px] font-bold text-slate-300">{notif.type}</span>
                                <span className={`text-[10px] font-bold ${notif.status === 'Delivered' ? 'text-emerald-500' : 'text-amber-500'}`}>{notif.status}</span>
                              </div>
                              <p className="text-slate-300">{notif.message}</p>
                              <span className="block mt-2 text-[10px] text-slate-500">{notif.timestamp}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* CITIZEN DOCUMENTS AUDIT TRAIL */}
        {mainViewTab === 'citizenAudit' && (
          <>
            {!showDetail ? (
              <div className="flex flex-col h-full">
                <div className="p-4 border-b border-slate-800 bg-slate-900/80">
                  <h3 className="font-bold text-white text-sm">Archived Records</h3>
                  <p className="text-[11px] text-slate-400 mt-1">Successfully processed and digitally released certificates.</p>
                </div>

                <div className="flex-1 overflow-auto">
                  {citizenAuditTrail.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 text-sm">No verified records in the audit trail.</div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-950 text-[10px] uppercase text-slate-500 sticky top-0 border-b border-slate-800 z-10">
                        <tr>
                          <th className="p-4 font-semibold whitespace-nowrap">REFERENCE NO.</th>
                          <th className="p-4 font-semibold whitespace-nowrap">APPLICANT</th>
                          <th className="p-4 font-semibold whitespace-nowrap">RELEASE DATE</th>
                          <th className="p-4 font-semibold text-right whitespace-nowrap">ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-sm">
                        {citizenAuditTrail.map(app => (
                          <tr
                            key={app.id}
                            className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                            onClick={() => { setSelectedCitizenAppId(app.id); setShowDetail(true); }}
                          >
                            <td className="p-4 font-mono font-bold text-slate-200">{app.referenceNumber}</td>
                            <td className="p-4 font-semibold text-slate-100">{app.applicantName}</td>
                            <td className="p-4 text-slate-400 text-xs">{app.digitalRelease?.releasedAt || 'N/A'}</td>
                            <td className="p-4 text-right">
                              <button
                                className="px-3 py-1.5 text-xs font-medium bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/30 transition-colors"
                                onClick={(e) => { e.stopPropagation(); setSelectedCitizenAppId(app.id); setShowDetail(true); }}
                              >
                                View Archive
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full bg-slate-900">
                <div className="p-3 bg-slate-950/50 border-b border-slate-800">
                  <button
                    onClick={() => setShowDetail(false)}
                    className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer w-fit"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to Archives
                  </button>
                </div>

                {!currentCitizenApp ? (
                  <div className="flex-1 flex items-center justify-center text-slate-500">Archive not found.</div>
                ) : (
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <h2 className="text-xl font-bold font-mono text-white">{currentCitizenApp.referenceNumber}</h2>
                        <p className="text-sm text-slate-400 mt-1">Applicant: <span className="text-slate-200">{currentCitizenApp.applicantName}</span></p>
                      </div>
                      <span className="px-3 py-1 bg-emerald-900/30 text-emerald-400 border border-emerald-800 rounded-lg text-xs font-bold">
                        Released
                      </span>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-slate-800">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Archived Documents</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {currentCitizenApp.documents.map((doc) => (
                          <div key={doc.id} className="p-4 border border-slate-700/50 rounded-xl flex justify-between items-center text-sm bg-slate-800/30">
                            <span className="font-medium text-slate-200">{doc.name}</span>
                            <button
                              onClick={() => handleOpenPreview(doc)}
                              className="px-3 py-1.5 bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold cursor-pointer hover:bg-slate-600 transition-colors"
                            >
                              Preview
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4">
                      <button
                        onClick={() => handleDownloadCertificate(currentCitizenApp.id)}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold cursor-pointer shadow-lg transition-colors"
                      >
                        Download Document Package
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

      </div>

      {/* POP-UP DOCUMENT PREVIEW LIGHTBOX MODAL */}
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