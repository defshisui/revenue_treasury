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
      // Base64 string ready
    } else if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
      // Absolute URL ready
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

      {/* Header Banner - Updated Dark Dashboard Layout matching target image */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-800 shadow-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-500 mb-1 block">
            MARKET DEVELOPMENT & ADMINISTRATION DEPARTMENT (MDAD)
          </span>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase">
            Real Property Assessment & Treasury Portal
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Zoning Accreditation, Document Vault, Fee Licensing &amp; Violation Enforcement
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
            <button
              onClick={() => setMainViewTab('queue')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${mainViewTab === 'queue'
                ? 'bg-slate-900 text-blue-400 shadow-sm border border-slate-700/50'
                : 'text-slate-400 hover:text-white'
                }`}
            >
              Active Queue ({applications.length})
            </button>
            <button
              onClick={() => setMainViewTab('citizenAudit')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${mainViewTab === 'citizenAudit'
                ? 'bg-slate-900 text-blue-400 shadow-sm border border-slate-700/50'
                : 'text-slate-400 hover:text-white'
                }`}
            >
              Citizen Documents Audit Trail ({citizenAuditTrail.length})
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Cards Row - Matching dark theme layout style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Applications</span>
          <div className="text-2xl font-black text-white mt-3">{stats.totalApplications}</div>
          <span className="text-[10px] text-blue-400 mt-1 font-semibold">Active in registry</span>
        </div>
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Under Evaluation</span>
          <div className="text-2xl font-black text-blue-400 mt-3">{stats.pendingReview}</div>
          <span className="text-[10px] text-slate-500 mt-1 font-semibold">Requires document check</span>
        </div>
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Inspection Scheduled</span>
          <div className="text-2xl font-black text-amber-400 mt-3">{stats.pendingInspectionOrGIS}</div>
          <span className="text-[10px] text-slate-500 mt-1 font-semibold">Field mapping pending</span>
        </div>
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Ready for Release</span>
          <div className="text-2xl font-black text-emerald-400 mt-3">{stats.readyForRelease}</div>
          <span className="text-[10px] text-slate-500 mt-1 font-semibold">Permits ready</span>
        </div>
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Penalties Collected</span>
          <div className="text-2xl font-black text-indigo-400 mt-3">{stats.totalPenaltiesCollected > 0 ? `₱${stats.totalPenaltiesCollected.toLocaleString()}` : '0%'}</div>
          <span className="text-[10px] text-slate-500 mt-1 font-semibold">Annual dues paid</span>
        </div>
      </div>

      {/* ACTIVE QUEUE VIEW */}
      {mainViewTab === 'queue' && (
        <div className="flex-1 flex flex-col overflow-hidden gap-6 bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-xs">
          {/* Masterlist Header Filter Toolbar */}
          <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white">Assessment &amp; Property Masterlist</h3>
              <p className="text-[11px] text-slate-400">Manage real property tax queue items, verify files, and process digital releases</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search reference, applicant name, PIN..."
                className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-600 w-full sm:w-72"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select
                className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-semibold cursor-pointer focus:outline-none"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="ALL">All Categories</option>
                <option value="1.1 Transfer of Ownership">Transfer of Ownership</option>
                <option value="1.2 Consolidation / Segregation">Consolidation / Segregation</option>
                <option value="1.3 New Assessment / Reassessment / Reclassification">New Assessment</option>
              </select>
              <select
                className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-semibold cursor-pointer focus:outline-none"
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

          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden gap-6 min-h-0 w-full">
            {/* Queue Selection Column */}
            <div className="w-full lg:w-[360px] xl:w-[400px] flex-shrink-0 flex flex-col bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden min-h-0">
              <div className="p-3 bg-slate-900 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filteredApplications.length > 0 && selectedAppIds.length === filteredApplications.length}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-700 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Queue Items ({filteredApplications.length})</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2 space-y-1">
                {filteredApplications.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">No matching queue records found.</div>
                ) : (
                  filteredApplications.map((app) => {
                    const isSelected = app.id === currentApp?.id;
                    const isChecked = selectedAppIds.includes(app.id);

                    return (
                      <div
                        key={app.id}
                        className={`w-full text-left p-3 rounded-xl transition-all flex items-start gap-3 border ${isSelected
                          ? 'bg-blue-950/30 border-blue-600/50 shadow-xs'
                          : 'bg-transparent border-transparent hover:bg-slate-900'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectApp(app.id)}
                          className="mt-1 rounded border-slate-700 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer flex-shrink-0"
                        />
                        <button
                          onClick={() => setSelectedAppId(app.id)}
                          className="flex-1 text-left flex flex-col gap-1 cursor-pointer"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-bold text-xs text-white font-mono">{app.referenceNumber}</span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-900">
                              {app.status}
                            </span>
                          </div>
                          <div className="text-xs font-semibold text-slate-200 truncate">{app.applicantName}</div>
                          <div className="text-[10px] text-slate-400 truncate">{app.category}</div>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Application Detail Inspection Panel */}
            <div className="flex-1 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col overflow-hidden min-h-0">
              {!currentApp ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-2">
                  <h3 className="text-sm font-bold text-slate-300">No Queue Record Selected</h3>
                  <p className="text-xs text-slate-500 max-w-xs">Select an application from the left panel to examine records, verify documents, and update processing workflow.</p>
                </div>
              ) : (
                <>
                  <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <h2 className="text-base font-black tracking-tight text-white font-mono">{currentApp.referenceNumber}</h2>
                      <p className="text-xs text-slate-400 mt-0.5">Applicant: <span className="font-semibold text-slate-200">{currentApp.applicantName}</span></p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDeleteApplication(currentApp.id)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-950/40 text-rose-300 border border-rose-900 hover:bg-rose-900/40 cursor-pointer"
                      >
                        Delete
                      </button>
                      <select
                        value={currentApp.status}
                        onChange={(e) => handleUpdateStatus(e.target.value as StatusType)}
                        className="text-xs font-semibold px-3 py-1.5 border border-slate-700 rounded-xl bg-slate-900 text-white cursor-pointer"
                      >
                        <option value="Under Evaluation">Under Evaluation</option>
                        <option value="Field Inspection Scheduled">Field Inspection Scheduled</option>
                        <option value="Approved & Ready for Release">Approved & Ready for Release</option>
                        <option value="Digital Certificate Issued">Digital Certificate Issued</option>
                      </select>
                    </div>
                  </div>

                  {/* Sub Tabs */}
                  <div className="flex border-b border-slate-800 bg-slate-900 px-4 text-xs font-semibold">
                    {(
                      [
                        ['overview', 'Overview & Documents'],
                        ['audit', `Audit Trail (${currentApp.auditLogs?.length || 0})`],
                        ['notifications', `SMS / Email Log (${currentApp.notificationLogs?.length || 0})`]
                      ] as const
                    ).map(([tab, label]) => (
                      <button
                        key={tab}
                        onClick={() => setDetailTab(tab as any)}
                        className={`py-3 px-4 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${detailTab === tab
                          ? 'border-blue-500 text-blue-400 font-bold'
                          : 'border-transparent text-slate-400 hover:text-slate-200'
                          }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {detailTab === 'overview' && (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 text-xs">
                          <div><span className="text-slate-500 block text-[10px] uppercase font-bold">Email Address</span><span className="font-semibold text-slate-200">{currentApp.applicantEmail || '—'}</span></div>
                          <div><span className="text-slate-500 block text-[10px] uppercase font-bold">Mobile Number</span><span className="font-semibold text-slate-200">{currentApp.applicantPhone || '—'}</span></div>
                          <div><span className="text-slate-500 block text-[10px] uppercase font-bold">Property Location</span><span className="font-semibold text-slate-200">{currentApp.propertyDetails?.address || '—'}</span></div>
                          <div><span className="text-slate-500 block text-[10px] uppercase font-bold">Tax Declaration / PIN</span><span className="font-semibold text-slate-200 font-mono">{currentApp.propertyDetails?.titleNumber || '—'}</span></div>
                        </div>

                        <section className="space-y-3">
                          <h3 className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                            Uploaded Documentary Requirements ({currentApp.documents.length})
                          </h3>
                          <div className="space-y-2.5">
                            {currentApp.documents.map((doc) => (
                              <div key={doc.id} className="flex items-center justify-between p-3.5 border border-slate-800 rounded-xl text-xs bg-slate-900">
                                <div>
                                  <p className="font-bold text-white">{doc.name}</p>
                                  <p className="text-[10px] text-slate-400 mt-0.5">Status: <span className="text-blue-400 font-semibold">{doc.status}</span></p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleOpenPreview(doc)}
                                    className="px-3 py-1.5 bg-blue-950 text-blue-300 border border-blue-900 rounded-lg font-semibold cursor-pointer hover:bg-blue-900/40"
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
                                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold cursor-pointer transition-colors shadow-xs"
                                  >
                                    Reject
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>

                        <section className="pt-2">
                          <button
                            onClick={handleDigitalRelease}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-sm transition-all"
                          >
                            Approve, Release &amp; Move to Audit Trail
                          </button>
                        </section>
                      </>
                    )}

                    {detailTab === 'audit' && (
                      <div className="space-y-2">
                        {currentApp.auditLogs?.map((log) => (
                          <div key={log.id} className="p-3 border border-slate-800 rounded-xl text-xs bg-slate-900">
                            <p className="font-bold text-slate-200">{log.action}</p>
                            <span className="text-[10px] text-slate-500">{log.timestamp} • {log.officer}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {detailTab === 'notifications' && (
                      <div className="space-y-2">
                        {currentApp.notificationLogs?.map((notif) => (
                          <div key={notif.id} className="p-3 border border-slate-800 rounded-xl text-xs bg-slate-900">
                            <p className="text-slate-200">{notif.message}</p>
                            <span className="text-[10px] text-slate-500">{notif.timestamp} • {notif.type}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CITIZEN DOCUMENTS AUDIT TRAIL VIEW */}
      {mainViewTab === 'citizenAudit' && (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden gap-6 bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-xs min-h-[60vh]">
          <div className="w-full lg:w-[360px] xl:w-[400px] flex-shrink-0 flex flex-col bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden min-h-0">
            <div className="p-3 bg-slate-900 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Archived Audit Trail Records ({citizenAuditTrail.length})
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2 space-y-1">
              {citizenAuditTrail.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">No verified records in the audit trail.</div>
              ) : (
                citizenAuditTrail.map((app) => (
                  <div
                    key={app.id}
                    onClick={() => setSelectedCitizenAppId(app.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${app.id === currentCitizenApp?.id ? 'bg-blue-950/30 border-blue-600/50' : 'bg-transparent border-transparent hover:bg-slate-900'}`}
                  >
                    <div className="font-bold text-xs font-mono text-white">{app.referenceNumber}</div>
                    <div className="text-xs text-slate-300 mt-0.5">{app.applicantName}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex-1 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col overflow-hidden p-6 justify-between">
            {!currentCitizenApp ? (
              <div className="flex-1 flex items-center justify-center text-center text-xs text-slate-500">
                Select an archived audit trail record from the sidebar.
              </div>
            ) : (
              <div className="space-y-5 overflow-y-auto">
                <div>
                  <h2 className="text-lg font-black font-mono text-white">{currentCitizenApp.referenceNumber}</h2>
                  <p className="text-xs text-slate-400">Approved Applicant: <span className="text-slate-200 font-semibold">{currentCitizenApp.applicantName}</span></p>
                </div>
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Archived Documents Package</h3>
                  {currentCitizenApp.documents.map((doc) => (
                    <div key={doc.id} className="p-3.5 border border-slate-800 rounded-xl flex justify-between items-center text-xs bg-slate-900">
                      <span className="font-semibold text-slate-200">{doc.name}</span>
                      <button
                        onClick={() => handleOpenPreview(doc)}
                        className="px-3 py-1.5 bg-blue-950 text-blue-300 border border-blue-900 rounded-lg font-semibold cursor-pointer hover:bg-blue-900/40"
                      >
                        Preview Document
                      </button>
                    </div>
                  ))}
                </div>
                <div>
                  <button
                    onClick={() => handleDownloadCertificate(currentCitizenApp.id)}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs"
                  >
                    Download Certified Documents Package
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* POP-UP DOCUMENT PREVIEW LIGHTBOX MODAL */}
      {previewDocUrl && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl h-[85vh] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-950 text-white flex justify-between items-center border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-black text-blue-400 tracking-wider">Document Inspector</span>
                <span className="text-xs text-slate-400 truncate max-w-md font-mono">({previewDocTitle})</span>
              </div>
              <button
                onClick={() => setPreviewDocUrl(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
              >
                Close ✕
              </button>
            </div>
            <div className="flex-1 bg-slate-950 overflow-auto flex items-center justify-center p-4">
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