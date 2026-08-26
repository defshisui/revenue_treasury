import React, { useState, useMemo, useEffect } from 'react';
import type {
  AdminStats
} from '../types/treasury';
import {
  getRPTApplications,
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
  const [citizenAuditTrail] = useState<ExtendedApplicationRecord[]>([]);

  const [selectedAppId, setSelectedAppId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');

  const [mainViewTab, setMainViewTab] = useState<'queue' | 'citizenAudit'>('queue');

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

      const matchesStatus =
        selectedStatusFilter === 'ALL' || app.status === selectedStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [applications, searchTerm, selectedStatusFilter]);

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

    if (targetUrl.startsWith('data:') || targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
      // Direct load
    } else if (targetUrl.startsWith('/uploads/')) {
      targetUrl = `${API_BASE_URL}${targetUrl}`;
    } else {
      targetUrl = `${API_BASE_URL}/uploads/${targetUrl}`;
    }

    setPreviewDocTitle(doc.name);
    setPreviewDocUrl(targetUrl);
  };

  const handleDownloadCertificate = (appId?: string) => {
    const target = appId ? citizenAuditTrail.find(a => a.id === appId) : undefined;
    if (!target) return;
    triggerToast(`Document package for ${target.referenceNumber} downloaded successfully.`, 'success');
  };

  return (
    <div
      style={{
        marginLeft: isCollapsed ? '80px' : '256px',
        width: isCollapsed ? 'calc(100% - 80px)' : 'calc(100% - 256px)'
      }}
      className="min-h-screen bg-[#070b14] text-slate-200 p-6 pt-20 transition-all duration-300 flex flex-col font-sans relative selection:bg-blue-600 selection:text-white"
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

      {/* Hero Header Section */}
      <div className="mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#0b1329]/80 backdrop-blur border border-slate-800/80 p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
            <span className="text-[11px] font-bold tracking-wider uppercase text-blue-400">
              REAL PROPERTY ASSESSMENT & TREASURY
            </span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            Real Property Tax Portal
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Zoning Accreditation, Document Vault, Fee Licensing & Assessment Processing
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setMainViewTab('queue')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${mainViewTab === 'queue'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                : 'bg-slate-900/80 text-slate-300 border border-slate-800 hover:bg-slate-800'
              }`}
          >
            Active Queue ({applications.length})
          </button>
          <button
            onClick={() => setMainViewTab('citizenAudit')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${mainViewTab === 'citizenAudit'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                : 'bg-slate-900/80 text-slate-300 border border-slate-800 hover:bg-slate-800'
              }`}
          >
            Audit Trail ({citizenAuditTrail.length})
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-[#0b132b]/80 border border-slate-800/80 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400">Total Applications</span>
          <div className="text-2xl font-bold text-white mt-2">{stats.totalApplications}</div>
          <span className="text-[10px] text-slate-500 mt-1">System Masterlist</span>
        </div>

        <div className="bg-[#0b132b]/80 border border-slate-800/80 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400">Pending Review</span>
          <div className="text-2xl font-bold text-amber-400 mt-2">{stats.pendingReview}</div>
          <span className="text-[10px] text-amber-500/70 mt-1">Requires document check</span>
        </div>

        <div className="bg-[#0b132b]/80 border border-slate-800/80 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400">Inspection / GIS</span>
          <div className="text-2xl font-bold text-emerald-400 mt-2">{stats.pendingInspectionOrGIS}</div>
          <span className="text-[10px] text-emerald-500/70 mt-1">Active field checks</span>
        </div>

        <div className="bg-[#0b132b]/80 border border-slate-800/80 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400">Ready for Release</span>
          <div className="text-2xl font-bold text-blue-400 mt-2">{stats.readyForRelease}</div>
          <span className="text-[10px] text-blue-500/70 mt-1">Certificates issued</span>
        </div>

        <div className="bg-[#0b132b]/80 border border-slate-800/80 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[11px] font-medium text-slate-400">Penalties Collected</span>
          <div className="text-2xl font-bold text-indigo-400 mt-2">₱{stats.totalPenaltiesCollected.toLocaleString()}</div>
          <span className="text-[10px] text-indigo-500/70 mt-1">Paid dues</span>
        </div>
      </div>

      {/* Main View Area */}
      {mainViewTab === 'queue' ? (
        <div className="bg-[#0b132b]/80 border border-slate-800/80 rounded-2xl flex flex-col p-5 shadow-xl flex-1">
          {/* Controls Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-800/80">
            <h2 className="text-sm font-bold text-white tracking-wide">
              Real Property Assessment Masterlist
            </h2>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search association, zone, PIN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-[#070d1e] border border-slate-800 text-xs text-slate-200 px-3.5 py-2 rounded-lg focus:outline-none focus:border-blue-500 w-64"
              />
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="bg-[#070d1e] border border-slate-800 text-xs text-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="Under Evaluation">Under Evaluation</option>
                <option value="Field Inspection Scheduled">Field Inspection Scheduled</option>
                <option value="Approved & Ready for Release">Approved & Ready for Release</option>
              </select>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-[#070d1e]/50">
                  <th className="py-3 px-4">Reference No.</th>
                  <th className="py-3 px-4">Applicant & Location</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Penalty Fee</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredApplications.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-800/50 flex items-center justify-center text-slate-600">
                          •
                        </div>
                        <p>No matching property records found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredApplications.map((app) => (
                    <tr
                      key={app.id}
                      onClick={() => setSelectedAppId(app.id)}
                      className={`hover:bg-slate-800/40 cursor-pointer transition-colors ${selectedAppId === app.id ? 'bg-slate-800/60' : ''
                        }`}
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-blue-400">
                        {app.referenceNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{app.applicantName}</div>
                        <div className="text-[10px] text-slate-400">{app.propertyDetails.address || 'N/A'}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-300">{app.category || 'General Assessment'}</td>
                      <td className="py-3 px-4 text-slate-300">₱{app.penaltyFee.toLocaleString()}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 rounded text-[10px] font-semibold bg-blue-950 text-blue-300 border border-blue-800/50">
                          {app.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenPreview(app.documents[0] || { name: app.referenceNumber })}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-semibold transition-colors"
                        >
                          View Vault
                        </button>
                        <button
                          onClick={() => handleDeleteApplication(app.id)}
                          className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900 text-rose-300 rounded text-[11px] font-semibold transition-colors"
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
      ) : (
        /* Audit Trail Table Layout */
        <div className="bg-[#0b132b]/80 border border-slate-800/80 rounded-2xl p-5 shadow-xl flex-1">
          <h2 className="text-sm font-bold text-white tracking-wide mb-4 pb-4 border-b border-slate-800/80">
            Citizen Document Audit Vault
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-[#070d1e]/50">
                  <th className="py-3 px-4">Reference No.</th>
                  <th className="py-3 px-4">Applicant</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Release Status</th>
                  <th className="py-3 px-4 text-right">Certificate Vault</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {citizenAuditTrail.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      No archived records in the audit trail.
                    </td>
                  </tr>
                ) : (
                  citizenAuditTrail.map((app) => (
                    <tr key={app.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono font-semibold text-blue-400">{app.referenceNumber}</td>
                      <td className="py-3 px-4 font-semibold text-white">{app.applicantName}</td>
                      <td className="py-3 px-4 text-slate-300">{app.category}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/50">
                          {app.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDownloadCertificate(app.id)}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-semibold transition-colors"
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b132b] border border-slate-800 rounded-2xl w-full max-w-4xl h-[85vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 bg-[#070d1e] text-white flex justify-between items-center border-b border-slate-800">
              <span className="text-xs font-bold text-blue-400 uppercase">Document Vault Inspector ({previewDocTitle})</span>
              <button
                onClick={() => setPreviewDocUrl(null)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-bold transition-colors cursor-pointer"
              >
                Close ✕
              </button>
            </div>
            <div className="flex-1 bg-[#050811] flex items-center justify-center p-4 overflow-auto">
              <iframe
                src={previewDocUrl}
                className="w-full h-full rounded-xl border-0 bg-white"
                title="Document Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RealPropertyTaxView;