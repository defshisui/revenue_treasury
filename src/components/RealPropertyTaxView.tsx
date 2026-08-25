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

// Extended application interface with audit trail,
// notification logs, and digital release information.
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

  // Digital release metadata
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
  const [applications, setApplications] = useState<
    ExtendedApplicationRecord[]
  >([]);

  const [citizenAuditTrail, setCitizenAuditTrail] = useState<ExtendedApplicationRecord[]>([]);
  const [selectedCitizenAppId, setSelectedCitizenAppId] = useState<string>('');

  const [selectedAppId, setSelectedAppId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] =
    useState<string>('ALL');

  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);
  const [mainViewTab, setMainViewTab] = useState<'queue' | 'citizenAudit'>('queue');

  const [detailTab, setDetailTab] = useState<
    'overview' | 'audit' | 'notifications'
  >('overview');

  const [isCertModalOpen, setIsCertModalOpen] = useState(false);

  // Toast Notification Feedback State
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'warning' | 'error';
  } | null>(null);

  const triggerToast = (
    text: string,
    type: 'success' | 'warning' | 'error'
  ) => {
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
        const mapped: ExtendedApplicationRecord[] = (Array.isArray(data) ? data : []).map((item: any) => ({
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
          documents: (Array.isArray(item.documents) ? item.documents : []).map((doc: any, idx: number) => {
            if (!doc) {
              return {
                id: `DOC-${idx + 1}`,
                name: `Document ${idx + 1}`,
                type: 'PDF',
                status: 'Pending' as const,
                uploadedAt: item.filedDate || ''
              };
            }
            if (typeof doc === 'string') {
              return {
                id: `DOC-${idx + 1}`,
                name: doc,
                type: 'PDF',
                status: 'Pending' as const,
                uploadedAt: item.filedDate || ''
              };
            }
            return {
              id: doc.id || `DOC-${idx + 1}`,
              name: doc.name || doc.fileName || `Document ${idx + 1}`,
              type: doc.type || 'PDF',
              status: doc.status || 'Pending',
              uploadedAt: doc.uploadedAt || item.filedDate || ''
            };
          }),
          auditLogs: item.auditLogs || [],
          notificationLogs: item.notificationLogs || []
        }));
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
        app.referenceNumber
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        app.applicantName
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        app.propertyDetails.pin.includes(searchTerm);

      const matchesCategory =
        selectedCategory === 'ALL' ||
        app.category === selectedCategory;

      const matchesStatus =
        selectedStatusFilter === 'ALL' ||
        app.status === selectedStatusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [
    applications,
    searchTerm,
    selectedCategory,
    selectedStatusFilter
  ]);

  const persistChanges = async (updatedList: ExtendedApplicationRecord[]) => {
    setApplications(updatedList);
    if (currentApp) {
      const target = updatedList.find(a => a.id === currentApp.id);
      if (target) {
        try {
          // Explicitly map target to match RPTApplicationRecord interface expectations
          const servicePayload: RPTApplicationRecord = {
            id: target.id,
            status: target.status,
            applicantName: target.applicantName,
            documents: target.documents.map(d => d.name),
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

  const handleCloseAndDelete = (appId: string) => {
    const targetApp = applications.find(a => a.id === appId);
    if (!targetApp) return;

    const updatedList = applications.filter(a => a.id !== appId);
    setApplications(updatedList);

    if (updatedList.length > 0) {
      setSelectedAppId(updatedList[0].id);
    } else {
      setSelectedAppId('');
    }

    triggerToast(`Application ${targetApp.referenceNumber} has been closed and deleted from active queue.`, 'warning');
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
              action: 'All citizen uploaded documents verified. Automatically closed and transferred to Citizen Documents Audit Trail.'
            },
            ...(app.auditLogs || [])
          ]
        };

        setCitizenAuditTrail(prev => [closedRecord, ...prev]);
        setSelectedCitizenAppId(closedRecord.id);
        triggerToast(`Queue item ${app.referenceNumber} successfully verified! Automatically closed and moved to Audit Trail.`, 'success');
      }, 300);
    }
  };

  const handleUpdateStatus = (newStatus: StatusType) => {
    if (!currentApp) return;

    const timestamp = new Date()
      .toISOString()
      .replace('T', ' ')
      .substring(0, 16);

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
    triggerToast(
      `Application workflow successfully updated to "${newStatus}".`,
      'success'
    );
  };

  const handleDocumentStatusChange = (
    docId: string,
    status: 'Verified' | 'Rejected' | 'Pending'
  ) => {
    if (!currentApp) return;

    const timestamp = new Date()
      .toISOString()
      .replace('T', ' ')
      .substring(0, 16);

    let updatedDocsState: typeof currentApp.documents = [];

    const updatedList = applications.map((app) => {
      if (app.id === currentApp.id) {
        updatedDocsState = app.documents.map((doc) =>
          doc.id === docId ? { ...doc, status } : doc
        );

        const docName =
          app.documents.find((d) => d.id === docId)?.name || docId;

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
      triggerToast(
        'Citizen uploaded document successfully verified & matched against registry records.',
        'success'
      );
      checkAndAutoCloseQueueItem(currentApp, updatedDocsState);
    } else if (status === 'Rejected') {
      triggerToast(
        'Citizen uploaded document flagged and marked as rejected.',
        'warning'
      );
    }
  };

  const handleDigitalRelease = () => {
    if (!currentApp) return;

    const timestamp = new Date()
      .toISOString()
      .replace('T', ' ')
      .substring(0, 16);

    const qrVerificationCode =
      `QC-${currentApp.referenceNumber}-${Date.now()}`
        .replace(/[^A-Za-z0-9-]/g, '');

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
          action: 'Application approved with citizen documents checked and archived.'
        },
        ...(currentApp.auditLogs || [])
      ],
      notificationLogs: [
        {
          id: `NOTIF-${Date.now()}`,
          timestamp,
          type: 'Email' as const,
          message: `Your application ${currentApp.referenceNumber} has been approved and your digital documents are available.`,
          status: 'Delivered' as const
        },
        ...(currentApp.notificationLogs || [])
      ]
    };

    setApplications(prev => prev.filter(a => a.id !== currentApp.id));
    setCitizenAuditTrail(prev => [releasedApp, ...prev]);
    setSelectedCitizenAppId(releasedApp.id);
    setMainViewTab('citizenAudit');

    triggerToast(
      'Application approved and moved to Citizen Documents Audit Trail.',
      'success'
    );
  };

  const handleDownloadCertificate = (appId?: string) => {
    const target = appId ? citizenAuditTrail.find(a => a.id === appId) || currentCitizenApp : currentCitizenApp;
    if (!target) return;

    triggerToast(
      `Citizen uploaded document package for ${target.referenceNumber} downloaded successfully.`,
      'success'
    );
  };

  const handleDownloadAllCitizenDocuments = () => {
    if (citizenAuditTrail.length === 0) {
      triggerToast('No citizen documents available for download.', 'warning');
      return;
    }
    triggerToast(`Successfully initiated bulk download for ${citizenAuditTrail.length} citizen document records.`, 'success');
  };

  const toggleSelectAll = () => {
    if (
      selectedAppIds.length ===
      filteredApplications.length
    ) {
      setSelectedAppIds([]);
    } else {
      setSelectedAppIds(
        filteredApplications.map((a) => a.id)
      );
    }
  };

  const toggleSelectApp = (id: string) => {
    setSelectedAppIds((prev) =>
      prev.includes(id)
        ? prev.filter((i) => i !== id)
        : [...prev, id]
    );
  };

  const batchVerifyDocuments = () => {
    const updatedList = applications.map((app) => {
      if (selectedAppIds.includes(app.id)) {
        const verifiedDocs = app.documents.map((d) => ({
          ...d,
          status: 'Verified' as const
        }));

        return {
          ...app,
          documents: verifiedDocs
        };
      }
      return app;
    });

    setApplications(updatedList);
    setSelectedAppIds([]);
    triggerToast(
      'Batch verification completed for citizen uploaded documents.',
      'success'
    );
  };

  const batchApproveApplications = () => {
    const timestamp = new Date()
      .toISOString()
      .replace('T', ' ')
      .substring(0, 16);

    const newlyReleased: ExtendedApplicationRecord[] = [];
    const remainingQueue: ExtendedApplicationRecord[] = [];

    applications.forEach((app) => {
      if (selectedAppIds.includes(app.id)) {
        const qrVerificationCode =
          `QC-${app.referenceNumber}-${Date.now()}`
            .replace(/[^A-Za-z0-9-]/g, '');

        const auditLog = {
          id: `LOG-${Date.now()}-${app.id}`,
          timestamp,
          officer: app.assignedOfficer || 'System Admin',
          action: 'Batch-approved and transferred with citizen uploaded documents.'
        };

        const notificationLog = {
          id: `NOTIF-${Date.now()}-${app.id}`,
          timestamp,
          type: 'Email' as const,
          message: `Your application ${app.referenceNumber} has been approved and released.`,
          status: 'Delivered' as const
        };

        newlyReleased.push({
          ...app,
          status: 'Digital Certificate Issued' as StatusType,
          digitalRelease: {
            releaseMethod: 'Digital' as const,
            releasedAt: timestamp,
            releasedBy: app.assignedOfficer || 'System Admin',
            certificateType: 'Tax Declaration / CTC' as const,
            digitalSignatureStatus: 'Signed' as const,
            qrVerificationCode,
            downloadCount: 1,
            citizenNotified: true
          },
          auditLogs: [auditLog, ...(app.auditLogs || [])],
          notificationLogs: [notificationLog, ...(app.notificationLogs || [])]
        });
      } else {
        remainingQueue.push(app);
      }
    });

    setApplications(remainingQueue);
    setCitizenAuditTrail(prev => [...newlyReleased, ...prev]);
    if (newlyReleased.length > 0) {
      setSelectedCitizenAppId(newlyReleased[0].id);
    }
    setSelectedAppIds([]);
    setMainViewTab('citizenAudit');

    triggerToast(
      'Selected applications approved and transferred to Citizen Documents Audit Trail.',
      'success'
    );
  };

  return (
    <div
      style={{
        marginLeft: isCollapsed ? '80px' : '256px',
        width: isCollapsed
          ? 'calc(100% - 80px)'
          : 'calc(100% - 256px)'
      }}
      className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 p-4 sm:p-6 pt-24 transition-all duration-300 box-border flex flex-col font-sans relative selection:bg-blue-600 selection:text-white"
    >
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div
            className={`px-4 py-3 rounded-xl shadow-lg border flex items-center gap-3 text-xs font-semibold ${
              toastMessage.type === 'success'
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

      {/* Top Header & Main View Switcher */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800/80 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-100 dark:border-blue-900/50">
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Real Property Assessment & Treasury Portal
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 ml-0.5">
            GovServe • Electronic Processing, Citizen Uploads Inspection & Document Verification
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setMainViewTab('queue')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mainViewTab === 'queue'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Active Queue ({applications.length})
          </button>
          <button
            onClick={() => setMainViewTab('citizenAudit')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mainViewTab === 'citizenAudit'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Citizen Documents Audit Trail ({citizenAuditTrail.length})
          </button>
        </div>
      </div>

      {/* MAIN VIEW: ACTIVE QUEUE */}
      {mainViewTab === 'queue' && (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden gap-6 h-[calc(100vh-13rem)] min-h-0 w-full">
          <div className="w-full lg:w-[420px] xl:w-[460px] flex-shrink-0 flex flex-col gap-4 min-h-0 h-1/2 lg:h-full">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800/80 shadow-2xs">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">
                  Under Evaluation
                </span>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2">
                  {stats.pendingReview}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800/80 shadow-2xs">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">
                  Inspection / Other
                </span>
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2">
                  {stats.pendingInspectionOrGIS}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800/80 shadow-2xs">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">
                  Ready for Release
                </span>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                  {stats.readyForRelease}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800/80 shadow-2xs">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">
                  Penalties Paid
                </span>
                <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-2">
                  ₱{stats.totalPenaltiesCollected.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800/80 shadow-2xs flex flex-col gap-3">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Search Ref No, Applicant, PIN..."
                  className="w-full pl-10 pr-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 transition-all"
                  value={searchTerm}
                  onChange={(e) =>
                    setSearchTerm(e.target.value)
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="text-xs p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 truncate cursor-pointer"
                  value={selectedCategory}
                  onChange={(e) =>
                    setSelectedCategory(e.target.value)
                  }
                >
                  <option value="ALL">All Categories</option>
                  <option value="1.1 Transfer of Ownership">1.1 Transfer of Ownership</option>
                  <option value="1.2 Consolidation / Segregation">1.2 Consolidation / Segregation</option>
                  <option value="1.3 New Assessment / Reassessment / Reclassification">1.3 New / Reassessment</option>
                  <option value="1.4 Correction of Entry / Updating / Revision">1.4 Correction of Entry</option>
                  <option value="3. Cancellation of Assessment Records">3. Cancellation</option>
                </select>
                <select
                  className="text-xs p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 truncate cursor-pointer"
                  value={selectedStatusFilter}
                  onChange={(e) =>
                    setSelectedStatusFilter(e.target.value)
                  }
                >
                  <option value="ALL">All Statuses</option>
                  <option value="Under Evaluation">Under Evaluation</option>
                  <option value="Field Inspection Scheduled">Field Inspection Scheduled</option>
                  <option value="Payment Pending">Payment Pending</option>
                  <option value="Ready for Approval">Ready for Approval</option>
                  <option value="Approved & Ready for Release">Approved & Ready for Release</option>
                  <option value="Digital Certificate Issued">Digital Certificate Issued</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            </div>

            <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800/80 shadow-2xs overflow-hidden flex flex-col min-h-0">
              <div className="p-3.5 bg-slate-50/80 dark:bg-slate-950 border-b border-slate-200/90 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex justify-between items-center sticky top-0 z-10 gap-2">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={
                      filteredApplications.length > 0 &&
                      selectedAppIds.length ===
                        filteredApplications.length
                    }
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <span>Queue ({selectedAppIds.length} selected)</span>
                </div>
                <span className="px-2 py-0.5 bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full text-[11px] font-mono">
                  {filteredApplications.length}
                </span>
              </div>

              {selectedAppIds.length > 0 && (
                <div className="bg-blue-50/80 dark:bg-blue-950/50 p-2.5 border-b border-blue-100 dark:border-blue-900/60 flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-blue-900 dark:text-blue-300 text-[11px]">
                    Batch Actions:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={batchVerifyDocuments}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-[11px] shadow-2xs transition-all cursor-pointer"
                    >
                      Verify Docs
                    </button>
                    <button
                      onClick={batchApproveApplications}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-[11px] shadow-2xs transition-all cursor-pointer"
                    >
                      Close & Release
                    </button>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/50 p-2 space-y-1">
                {filteredApplications.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-2.5">
                    <p>Application queue is currently empty.</p>
                  </div>
                ) : (
                  filteredApplications.map((app) => {
                    const isSelected = app.id === currentApp?.id;
                    const isChecked = selectedAppIds.includes(app.id);

                    return (
                      <div
                        key={app.id}
                        className={`w-full text-left p-3 rounded-xl transition-all flex items-start gap-3 border ${
                          isSelected
                            ? 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-500/40 shadow-2xs'
                            : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectApp(app.id)}
                          className="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer flex-shrink-0"
                        />
                        <button
                          onClick={() => setSelectedAppId(app.id)}
                          className="flex-1 text-left flex flex-col gap-1.5 cursor-pointer"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 tracking-tight font-mono">
                              {app.referenceNumber}
                            </span>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                                  app.status === 'Under Evaluation'
                                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900'
                                    : app.status === 'Digital Certificate Issued' ||
                                      app.status === 'Approved & Ready for Release'
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900'
                                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900'
                                }`}
                              >
                                {app.status}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCloseAndDelete(app.id);
                                }}
                                title="Close and Delete"
                                className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors cursor-pointer"
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
                          <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1.5 border-t border-slate-100 dark:border-slate-800/60 mt-0.5">
                            <span className="truncate font-mono">
                              PIN: {app.propertyDetails.pin}
                            </span>
                            <span className="flex-shrink-0">
                              {app.submissionDate}
                            </span>
                          </div>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800/80 shadow-2xs flex flex-col overflow-hidden min-h-0 h-1/2 lg:h-full">
            {!currentApp ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
                <div className="p-4 bg-slate-100 dark:bg-slate-800/80 rounded-full text-slate-400">
                  <svg
                    className="w-8 h-8"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">
                  No Application Selected
                </h3>
                <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                  Select an application from the queue to inspect citizen uploaded documents and process workflow steps.
                </p>
              </div>
            ) : (
              <>
                <div className="p-5 sm:p-6 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
                        {currentApp.referenceNumber}
                      </h2>
                      <span className="text-xs bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-medium">
                        {currentApp.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                      Filed on{' '}
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {currentApp.submissionDate}
                      </span>
                      {' • '}
                      Assigned Officer:{' '}
                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                        {currentApp.assignedOfficer || 'Unassigned'}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end flex-wrap">
                    <button
                      onClick={() => handleCloseAndDelete(currentApp.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950 border border-rose-200 dark:border-rose-900 transition-all cursor-pointer"
                    >
                      Close & Delete
                    </button>
                    <div className="flex flex-col items-start md:items-end gap-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Workflow Phase Control
                      </label>
                      <select
                        value={currentApp.status}
                        onChange={(e) =>
                          handleUpdateStatus(
                            e.target.value as StatusType
                          )
                        }
                        className="text-xs font-semibold px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-600/50 cursor-pointer"
                      >
                        <option value="Under Evaluation">Under Evaluation</option>
                        <option value="Field Inspection Scheduled">Field Inspection Scheduled</option>
                        <option value="Payment Pending">Payment Pending</option>
                        <option value="Ready for Approval">Ready for Approval</option>
                        <option value="Approved & Ready for Release">Approved & Ready for Release</option>
                        <option value="Digital Certificate Issued">Digital Certificate Issued</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 px-5 text-xs font-semibold overflow-x-auto">
                  {(
                    [
                      ['overview', 'Overview & Citizen Uploads'],
                      [
                        'audit',
                        `Staff Audit Trail (${currentApp.auditLogs?.length || 0})`
                      ],
                      [
                        'notifications',
                        `SMS / Email Log (${currentApp.notificationLogs?.length || 0})`
                      ]
                    ] as const
                  ).map(([tab, label]) => (
                    <button
                      key={tab}
                      onClick={() => setDetailTab(tab as any)}
                      className={`py-3.5 px-4 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                        detailTab === tab
                          ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
                          : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
                  {detailTab === 'overview' && (
                    <>
                      <section className="bg-slate-50/60 dark:bg-slate-950/40 p-4 sm:p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 text-xs space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                          <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px]">
                            Applicant Information
                          </h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <span className="text-slate-400 block text-[11px] mb-0.5">
                              Owner / Agency Name
                            </span>
                            <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                              {currentApp.applicantName}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px] mb-0.5">
                              Contact Details
                            </span>
                            <span className="font-medium text-slate-800 dark:text-slate-200 break-all">
                              {currentApp.applicantEmail} • {currentApp.applicantPhone}
                            </span>
                          </div>
                        </div>
                      </section>

                      <section className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 rounded-2xl space-y-3 shadow-2xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                          <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px]">
                            Real Property Technical Record
                          </h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                          <div>
                            <span className="text-slate-400 block text-[11px] mb-0.5">
                              Property Index Number (PIN)
                            </span>
                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                              {currentApp.propertyDetails.pin}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px] mb-0.5">
                              Title Number (TCT/CCT)
                            </span>
                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                              {currentApp.propertyDetails.titleNumber}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px] mb-0.5">
                              Lot Area
                            </span>
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              {currentApp.propertyDetails.lotAreaSqM} sq.m
                            </span>
                          </div>
                          <div className="col-span-1 sm:col-span-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                            <span className="text-slate-400 block text-[11px] mb-0.5">
                              Property Address / Location
                            </span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {currentApp.propertyDetails.address}
                            </span>
                          </div>
                        </div>
                      </section>

                      {/* Citizen Uploaded Documents Section */}
                      <section className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                            <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px]">
                              Documents Uploaded by Citizen ({currentApp.documents.length})
                            </h3>
                          </div>
                          <span className="text-xs text-slate-400 font-medium">
                            Auto-closes queue when all verified
                          </span>
                        </div>
                        <div className="space-y-3">
                          {currentApp.documents.length === 0 ? (
                            <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                              No documents uploaded by citizen for this application.
                            </div>
                          ) : (
                            currentApp.documents.map((doc) => (
                              <div
                                key={doc.id}
                                className="flex flex-col p-4 border border-slate-200/90 dark:border-slate-800 rounded-xl text-xs bg-white dark:bg-slate-900 gap-3.5 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  <div className="flex items-center space-x-3.5 min-w-0">
                                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-bold px-2.5 py-1.5 rounded-lg text-[11px] flex-shrink-0 border border-slate-200/80 dark:border-slate-700">
                                      {doc.type}
                                    </span>
                                    <div className="min-w-0">
                                      <p className="font-bold text-slate-900 dark:text-slate-100 truncate">
                                        {doc.name}
                                      </p>
                                      <p className="text-[10px] text-slate-400 mt-0.5">
                                        Uploaded by citizen on {doc.uploadedAt}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-end space-x-2 flex-shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-800 flex-wrap">
                                    <span
                                      className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${
                                        doc.status === 'Verified'
                                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900'
                                          : doc.status === 'Rejected'
                                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200/60 dark:border-rose-900'
                                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900'
                                      }`}
                                    >
                                      {doc.status}
                                    </span>
                                    <button
                                      onClick={() => triggerToast(`Previewing citizen upload: ${doc.name}`, 'success')}
                                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                                    >
                                      Preview
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleDocumentStatusChange(
                                          doc.id,
                                          'Verified'
                                        )
                                      }
                                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold shadow-2xs transition-colors cursor-pointer"
                                    >
                                      Verify
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleDocumentStatusChange(
                                          doc.id,
                                          'Rejected'
                                        )
                                      }
                                      className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/70 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </section>

                      <section className="bg-slate-50/60 dark:bg-slate-950/40 border border-slate-200/90 dark:border-slate-800 p-5 rounded-2xl space-y-5 shadow-2xs">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                            <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px]">
                              Digital Release & Certificate Issuance
                            </h3>
                          </div>
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-900">
                            DIGITAL WORKFLOW
                          </span>
                        </div>

                        <button
                          onClick={handleDigitalRelease}
                          className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-semibold rounded-xl shadow-xs text-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                        >
                          Approve, Release & Move to Citizen Documents Audit Trail
                        </button>
                      </section>
                    </>
                  )}

                  {detailTab === 'audit' && (
                    <section className="space-y-4">
                      <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px]">
                        Security & Officer Audit Trail Log
                      </h3>
                      <div className="space-y-2.5">
                        {(!currentApp.auditLogs || currentApp.auditLogs.length === 0) ? (
                          <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                            No audit logs recorded for this file yet.
                          </div>
                        ) : (
                          currentApp.auditLogs.map((log) => (
                            <div
                              key={log.id}
                              className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs"
                            >
                              <div className="space-y-0.5">
                                <p className="font-bold text-slate-900 dark:text-slate-100">{log.action}</p>
                                <p className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">Officer / System: {log.officer}</p>
                              </div>
                              <span className="font-mono text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg">
                                {log.timestamp}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </section>
                  )}

                  {detailTab === 'notifications' && (
                    <section className="space-y-4">
                      <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px]">
                        Automated SMS & Email Notification History
                      </h3>
                      <div className="space-y-2.5">
                        {(!currentApp.notificationLogs || currentApp.notificationLogs.length === 0) ? (
                          <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                            No notification logs sent yet.
                          </div>
                        ) : (
                          currentApp.notificationLogs.map((notif) => (
                            <div
                              key={notif.id}
                              className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                            >
                              <div className="flex items-start gap-3">
                                <span className={`px-2 py-1 rounded-lg font-mono font-bold text-[10px] ${notif.type === 'Email' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'}`}>
                                  {notif.type}
                                </span>
                                <p className="text-slate-800 dark:text-slate-200 font-medium">{notif.message}</p>
                              </div>
                              <span className="font-mono text-[10px] text-slate-400">{notif.timestamp}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </section>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MAIN VIEW: CITIZEN DOCUMENTS AUDIT TRAIL */}
      {mainViewTab === 'citizenAudit' && (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden gap-6 h-[calc(100vh-13rem)] min-h-0 w-full">
          <div className="w-full lg:w-[420px] xl:w-[460px] flex-shrink-0 flex flex-col gap-4 min-h-0 h-1/2 lg:h-full">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800/80 shadow-2xs flex justify-between items-center">
              <div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Citizen Documents Trail</h3>
                <p className="text-[11px] text-slate-400">Verified & closed citizen records archive</p>
              </div>
              <button
                onClick={handleDownloadAllCitizenDocuments}
                disabled={citizenAuditTrail.length === 0}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-semibold text-xs transition-all cursor-pointer shadow-2xs"
              >
                Download All ({citizenAuditTrail.length})
              </button>
            </div>

            <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800/80 shadow-2xs overflow-hidden flex flex-col min-h-0">
              <div className="p-3.5 bg-slate-50/80 dark:bg-slate-950 border-b border-slate-200/90 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex justify-between items-center">
                <span>Archived Records</span>
                <span className="px-2 py-0.5 bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full text-[11px] font-mono">
                  {citizenAuditTrail.length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/50 p-2 space-y-1">
                {citizenAuditTrail.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-2.5">
                    <p>No verified citizen documents in the audit trail yet.</p>
                    <p className="text-[11px]">Verify all documents in a queue application or release an approval to populate this trail.</p>
                  </div>
                ) : (
                  citizenAuditTrail.map((app) => {
                    const isSelected = app.id === currentCitizenApp?.id;
                    return (
                      <div
                        key={app.id}
                        onClick={() => setSelectedCitizenAppId(app.id)}
                        className={`w-full text-left p-3 rounded-xl transition-all flex flex-col gap-1.5 border cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-500/40 shadow-2xs'
                            : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 font-mono">
                            {app.referenceNumber}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
                            Closed / Verified
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {app.applicantName}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {app.category}
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1.5 border-t border-slate-100 dark:border-slate-800/60 mt-0.5">
                          <span className="font-mono">PIN: {app.propertyDetails.pin}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadCertificate(app.id);
                            }}
                            className="text-blue-600 hover:underline font-semibold"
                          >
                            Download Package
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800/80 shadow-2xs flex flex-col overflow-hidden min-h-0 h-1/2 lg:h-full">
            {!currentCitizenApp ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
                <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">
                  No Citizen Document Record Selected
                </h3>
                <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                  Select a verified record from the citizen audit trail to inspect full details and view citizen uploaded documents.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="flex justify-between items-center border-b pb-4">
                  <div>
                    <h2 className="text-lg font-bold font-mono text-slate-900 dark:text-white">{currentCitizenApp.referenceNumber}</h2>
                    <p className="text-xs text-slate-500">Citizen Audit Trail Record • Owner: {currentCitizenApp.applicantName}</p>
                  </div>
                  <button
                    onClick={() => handleDownloadCertificate(currentCitizenApp.id)}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
                  >
                    Download Citizen Upload Package
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Property Index Number</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{currentCitizenApp.propertyDetails.pin}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Title Number</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{currentCitizenApp.propertyDetails.titleNumber}</span>
                  </div>
                </div>

                {/* Citizen Uploaded Documents Inspection Panel in Audit Trail */}
                <div className="space-y-3">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Citizen Uploaded Documents Archive ({currentCitizenApp.documents.length})
                  </h3>
                  <div className="space-y-2">
                    {currentCitizenApp.documents.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-950 rounded-xl border">
                        No archived citizen documents found for this record.
                      </div>
                    ) : (
                      currentCitizenApp.documents.map((doc) => (
                        <div key={doc.id} className="p-3.5 border rounded-xl flex justify-between items-center text-xs bg-white dark:bg-slate-900 shadow-2xs">
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">{doc.name}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Type: {doc.type} • Status: <span className="text-emerald-600 font-semibold">{doc.status}</span> • Uploaded on {doc.uploadedAt}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => triggerToast(`Previewing archived citizen upload: ${doc.name}`, 'success')}
                              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg font-semibold text-xs cursor-pointer"
                            >
                              Preview
                            </button>
                            <button
                              onClick={() => triggerToast(`Downloaded ${doc.name}`, 'success')}
                              className="px-3 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg font-semibold text-xs cursor-pointer"
                            >
                              Download
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Digital Certificate Modal */}
      {isCertModalOpen && currentApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
              <h3 className="font-bold text-sm text-slate-300">Office of the City Assessor — Digital Document</h3>
              <button onClick={() => setIsCertModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
            </div>
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto bg-slate-50 dark:bg-slate-950 text-xs">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
                <div className="text-center space-y-1 border-b pb-4">
                  <h4 className="font-bold text-base text-slate-900 dark:text-white">CERTIFIED TRUE COPY OF TAX DECLARATION</h4>
                  <p className="font-mono text-xs text-blue-600 font-semibold">{currentApp.referenceNumber}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Property Owner</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{currentApp.applicantName}</span>
                  </div>
                  <div>
                    <span className="text-slate-900 dark:text-slate-100 block text-[10px] uppercase font-semibold">PIN</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{currentApp.propertyDetails.pin}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 bg-white dark:bg-slate-900 border-t flex justify-end gap-2">
              <button onClick={() => setIsCertModalOpen(false)} className="px-4 py-2 bg-slate-100 rounded-xl text-xs cursor-pointer">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RealPropertyTaxView;