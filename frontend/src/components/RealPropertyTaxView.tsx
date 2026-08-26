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
      className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 p-4 sm:p-6 pt-24 transition-all duration-300 box-border flex flex-col font-sans relative selection:bg-blue-600 selection:text-white"
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

      {/* HEADER BANNER WITH FULL LIGHT/DARK SUPPORT */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 tracking-wider uppercase">
              OFFICE OF THE CITY ASSESSOR & TREASURY
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white mt-1">
            Real Property Tax Assessment & Compliance Hub
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Zoning Accreditation, Document Vault, Fee Licensing & Violation Enforcement
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setMainViewTab('queue')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${mainViewTab === 'queue'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              Active Queue ({applications.length})
            </button>
            <button
              onClick={() => setMainViewTab('citizenAudit')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${mainViewTab === 'citizenAudit'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              Audit Trail ({citizenAuditTrail.length})
            </button>
          </div>
        </div>
      </div>

      {/* STREAMLINED STATS CARDS ROW (Reduced to 3 relevant cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Applications</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-3">{stats.totalApplications}</div>
          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold mt-1">Registered Submissions</span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Under Evaluation</span>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-3">{stats.pendingReview}</div>
          <span className="text-[10px] text-slate-400 font-semibold mt-1">Requires document check</span>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Inspection / GIS</span>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-3">{stats.pendingInspectionOrGIS}</div>
          <span className="text-[10px] text-slate-400 font-semibold mt-1">Field schedule pending</span>
        </div>
      </div>

      {/* ACTIVE QUEUE VIEW */}
      {mainViewTab === 'queue' && (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden gap-6 h-[calc(100vh-22rem)] min-h-0 w-full">
          <div className="w-full lg:w-[420px] xl:w-[460px] flex-shrink-0 flex flex-col gap-4 min-h-0 h-1/2 lg:h-full">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col gap-3">
              <input
                type="text"
                placeholder="Search Ref No, Applicant, PIN..."
                className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="text-xs p-2.5 border border-slate-300 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-medium cursor-pointer"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="ALL">All Categories</option>
                  <option value="1.1 Transfer of Ownership">1.1 Transfer of Ownership</option>
                  <option value="1.2 Consolidation / Segregation">1.2 Consolidation / Segregation</option>
                  <option value="1.3 New Assessment / Reassessment / Reclassification">1.3 New / Reassessment</option>
                </select>
                <select
                  className="text-xs p-2.5 border border-slate-300 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-medium cursor-pointer"
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

            <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col min-h-0">
              <div className="p-3.5 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={filteredApplications.length > 0 && selectedAppIds.length === filteredApplications.length}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <span>Queue Masterlist ({filteredApplications.length})</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 p-2 space-y-1">
                {filteredApplications.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-2.5">
                    <p>No matching application records found</p>
                  </div>
                ) : (
                  filteredApplications.map((app) => {
                    const isSelected = app.id === currentApp?.id;
                    const isChecked = selectedAppIds.includes(app.id);

                    return (
                      <div
                        key={app.id}
                        className={`w-full text-left p-3 rounded-xl transition-all flex items-start gap-3 border ${isSelected
                          ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-600/60 shadow-xs'
                          : 'bg-transparent border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/50'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectApp(app.id)}
                          className="mt-1 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer flex-shrink-0"
                        />
                        <button
                          onClick={() => setSelectedAppId(app.id)}
                          className="flex-1 text-left flex flex-col gap-1.5 cursor-pointer"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white font-mono">
                              {app.referenceNumber}
                            </span>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                {app.status}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteApplication(app.id);
                                }}
                                title="Delete Application"
                                className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {app.applicantName}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {app.category}
                          </div>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col overflow-hidden min-h-0 h-1/2 lg:h-full">
            {!currentApp ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
                <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">No Application Selected</h3>
                <p className="text-xs text-slate-400 max-w-sm">Select an application from the queue to inspect documents and workflow steps.</p>
              </div>
            ) : (
              <>
                <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white font-mono">
                      {currentApp.referenceNumber}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Applicant: <span className="font-semibold text-slate-800 dark:text-slate-200">{currentApp.applicantName}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleDeleteApplication(currentApp.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 hover:bg-rose-100 border border-rose-200 dark:border-rose-800 cursor-pointer"
                    >
                      Delete Application
                    </button>
                    <select
                      value={currentApp.status}
                      onChange={(e) => handleUpdateStatus(e.target.value as StatusType)}
                      className="text-xs font-semibold px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-800 dark:text-white cursor-pointer"
                    >
                      <option value="Under Evaluation">Under Evaluation</option>
                      <option value="Field Inspection Scheduled">Field Inspection Scheduled</option>
                      <option value="Approved & Ready for Release">Approved & Ready for Release</option>
                      <option value="Digital Certificate Issued">Digital Certificate Issued</option>
                    </select>
                  </div>
                </div>

                <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 px-5 text-xs font-bold">
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
                        ? 'border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 font-black'
                        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
                  {detailTab === 'overview' && (
                    <>
                      <section className="space-y-3">
                        <h3 className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px]">
                          Documents Uploaded by Citizen ({currentApp.documents.length})
                        </h3>
                        <div className="space-y-3">
                          {currentApp.documents.map((doc) => (
                            <div key={doc.id} className="flex flex-col p-4 border border-slate-200 dark:border-slate-800 rounded-xl text-xs bg-slate-50 dark:bg-slate-950/40 gap-3">
                              <div className="flex justify-between items-center">
                                <div>
                                  <p className="font-bold text-slate-900 dark:text-white">{doc.name}</p>
                                  <p className="text-[10px] text-slate-400">Status: {doc.status}</p>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleOpenPreview(doc)}
                                    className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg font-semibold cursor-pointer"
                                  >
                                    Preview
                                  </button>
                                  <button
                                    onClick={() => handleDocumentStatusChange(doc.id, 'Verified')}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold cursor-pointer transition-colors"
                                  >
                                    Verify
                                  </button>
                                  <button
                                    onClick={() => handleDocumentStatusChange(doc.id, 'Rejected')}
                                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold cursor-pointer shadow-xs transition-colors"
                                  >
                                    Reject
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section className="pt-4 border-t border-slate-200 dark:border-slate-800">
                        <button
                          onClick={handleDigitalRelease}
                          className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md"
                        >
                          Approve, Release & Move to Audit Trail
                        </button>
                      </section>
                    </>
                  )}

                  {detailTab === 'audit' && (
                    <div className="space-y-2">
                      {currentApp.auditLogs?.map((log) => (
                        <div key={log.id} className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl text-xs bg-slate-50 dark:bg-slate-950/40">
                          <p className="font-bold text-slate-800 dark:text-slate-200">{log.action}</p>
                          <span className="text-[10px] text-slate-400">{log.timestamp}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {detailTab === 'notifications' && (
                    <div className="space-y-2">
                      {currentApp.notificationLogs?.map((notif) => (
                        <div key={notif.id} className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl text-xs bg-slate-50 dark:bg-slate-950/40">
                          <p className="text-slate-800 dark:text-slate-200">{notif.message}</p>
                          <span className="text-[10px] text-slate-400">{notif.timestamp}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* CITIZEN DOCUMENTS AUDIT TRAIL VIEW */}
      {mainViewTab === 'citizenAudit' && (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden gap-6 h-[calc(100vh-22rem)] min-h-0 w-full">
          <div className="w-full lg:w-[420px] xl:w-[460px] flex-shrink-0 flex flex-col gap-4 min-h-0 h-1/2 lg:h-full">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex justify-between items-center">
              <div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Citizen Documents Trail</h3>
                <p className="text-[11px] text-slate-400">Archived records</p>
              </div>
            </div>

            <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 p-2 space-y-1">
                {citizenAuditTrail.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">No verified records in the audit trail.</div>
                ) : (
                  citizenAuditTrail.map((app) => (
                    <div
                      key={app.id}
                      onClick={() => setSelectedCitizenAppId(app.id)}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 bg-slate-50 dark:bg-slate-950/40"
                    >
                      <div className="font-bold text-xs font-mono text-slate-900 dark:text-white">{app.referenceNumber}</div>
                      <div className="text-xs text-slate-600 dark:text-slate-300">{app.applicantName}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col overflow-hidden min-h-0 h-1/2 lg:h-full">
            {!currentCitizenApp ? (
              <div className="flex-1 flex items-center justify-center p-8 text-center text-xs text-slate-400">
                Select an archived record from the list.
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <h2 className="text-lg font-black font-mono text-slate-900 dark:text-white">{currentCitizenApp.referenceNumber}</h2>
                <div className="space-y-2 pt-2">
                  <h3 className="text-xs font-bold uppercase text-slate-500">Archived Documents</h3>
                  {currentCitizenApp.documents.map((doc) => (
                    <div key={doc.id} className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl flex justify-between items-center text-xs bg-slate-50 dark:bg-slate-950/40">
                      <span className="text-slate-800 dark:text-slate-200">{doc.name}</span>
                      <button
                        onClick={() => handleOpenPreview(doc)}
                        className="px-3 py-1 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg font-semibold cursor-pointer"
                      >
                        Preview
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => handleDownloadCertificate(currentCitizenApp.id)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Download Package
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* POP-UP DOCUMENT PREVIEW LIGHTBOX MODAL */}
      {previewDocUrl && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl h-[85vh] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-bold text-blue-400">Document Inspector</span>
                <span className="text-xs text-slate-300 truncate max-w-md">({previewDocTitle})</span>
              </div>
              <button
                onClick={() => setPreviewDocUrl(null)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
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