// src/components/BusinessTaxAssessmentAdminView.tsx

import React, { useState, useEffect, useRef } from 'react';

export interface BusinessTaxAssessmentAdminViewProps {
  isCollapsed?: boolean;
}

interface AttachmentFile {
  name: string;
  url: string;
  type?: string;
}

interface AssessmentRecord {
  id: string;
  trackingNumber: string;
  businessName: string;
  businessOwner: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  applicationDate: string;
  psicCode?: string;
  grossSales?: number;
  tin?: string;
  businessType?: 'Manufacturer' | 'Wholesaler' | 'Retailer' | 'Exporter' | 'Service';
  attachments?: AttachmentFile[];
  remarks?: string;
}

interface AuditLog {
  id: string;
  adminName: string;
  action: string;
  details: string;
  timestamp: string;
}

export const BusinessTaxAssessmentAdminView: React.FC<BusinessTaxAssessmentAdminViewProps> = ({ isCollapsed = false }) => {
  // Authentication & Dropdown State
  const [adminUser, setAdminUser] = useState<{ fullname: string; email: string; initials: string; firstName: string; token: string } | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Active Tab State ('assessments' or 'audit_logs')
  const [activeTab, setActiveTab] = useState<'assessments' | 'audit_logs'>('assessments');

  // Functional Data States (No dummy data initialized)
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  // Search, Filter & Pagination States
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchType, setSearchType] = useState<string>('Tracking/MP No.');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const pageSize = 10;

  // Selected Record Modal / Review State
  const [selectedAssessment, setSelectedAssessment] = useState<AssessmentRecord | null>(null);
  const [actionRemarks, setActionRemarks] = useState<string>('');
  const [submittingAction, setSubmittingAction] = useState<boolean>(false);

  // Document Preview Modal State
  const [previewFile, setPreviewFile] = useState<AttachmentFile | null>(null);

  // Verification Checklist State
  const [checklist, setChecklist] = useState({
    itrChecked: false,
    clearanceVerified: false,
    financialStatementValid: false
  });

  // Order of Payment Modal State
  const [showOrderOfPaymentModal, setShowOrderOfPaymentModal] = useState<boolean>(false);
  const [computedFees, setComputedFees] = useState({
    lbt: 0,
    mayorsPermit: 0,
    sanitaryFee: 0,
    garbageFee: 0,
    fireSafetyFee: 0,
    total: 0
  });

  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

  useEffect(() => {
    const checkAdminSession = () => {
      const rawData = localStorage.getItem('currentUser') || 
                      localStorage.getItem('user') || 
                      sessionStorage.getItem('currentUser') || 
                      sessionStorage.getItem('user');

      if (!rawData) return null;

      try {
        const parsed = JSON.parse(rawData);
        const target = parsed.user && typeof parsed.user === 'object' ? parsed.user : parsed;

        const fullName = target.fullname || target.name || target.fullName || target.firstName || target.email;
        if (!fullName) return null;

        const email = target.email || "";
        const token = parsed.token || target.token || "";
        const nameParts = String(fullName).trim().split(" ");
        const firstName = nameParts[0];
        const initials = nameParts.length > 1 
          ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
          : nameParts[0].slice(0, 2).toUpperCase();

        return { fullname: String(fullName), email, firstName, initials, token };
      } catch (e) {
        console.error("Failed to parse admin session", e);
        return null;
      }
    };

    setAdminUser(checkAdminSession());

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch Data based on active tab
  useEffect(() => {
    if (activeTab === 'assessments') {
      fetchAdminAssessments();
    } else {
      fetchAuditLogs();
    }
  }, [statusFilter, currentPage, activeTab]);

  // Compute standard LGU fees whenever selectedAssessment changes
  useEffect(() => {
    if (selectedAssessment) {
      const gross = selectedAssessment.grossSales || 0;
      const bType = selectedAssessment.businessType || 'Retailer';
      let lbtRate = 0.01; 
      if (bType === 'Manufacturer') lbtRate = 0.005;
      else if (bType === 'Wholesaler') lbtRate = 0.012;
      else if (bType === 'Exporter') lbtRate = 0.003;
      else if (bType === 'Service') lbtRate = 0.015;

      const lbt = gross * lbtRate;
      const mayorsPermit = Math.max(500, gross * 0.001);
      const sanitaryFee = 350;
      const garbageFee = 500;
      const fireSafetyFee = mayorsPermit * 0.15;
      const total = lbt + mayorsPermit + sanitaryFee + garbageFee + fireSafetyFee;

      setComputedFees({
        lbt: Number(lbt.toFixed(2)),
        mayorsPermit: Number(mayorsPermit.toFixed(2)),
        sanitaryFee,
        garbageFee,
        fireSafetyFee: Number(fireSafetyFee.toFixed(2)),
        total: Number(total.toFixed(2))
      });

      setChecklist({
        itrChecked: false,
        clearanceVerified: false,
        financialStatementValid: false
      });
    }
  }, [selectedAssessment]);

  const fetchAdminAssessments = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const queryParams = new URLSearchParams();
      if (statusFilter !== 'ALL') queryParams.append('status', statusFilter);
      queryParams.append('page', currentPage.toString());
      queryParams.append('limit', pageSize.toString());
      if (searchQuery) queryParams.append('search', searchQuery);
      queryParams.append('searchType', searchType);

      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (adminUser?.token) headers['Authorization'] = `Bearer ${adminUser.token}`;

      const response = await fetch(`${API_BASE_URL}/admin/business-assessments?${queryParams.toString()}`, { headers });

      if (!response.ok) {
        throw new Error(`Failed to fetch records: ${response.statusText}`);
      }

      const data = await response.json();
      setAssessments(Array.isArray(data) ? data : (data.assessments || []));
      setTotalPages(data.totalPages || 1);
    } catch (err: any) {
      console.error("Error fetching admin assessments:", err);
      setFetchError(err.message || "Failed to communicate with municipal server.");
      setAssessments([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (adminUser?.token) headers['Authorization'] = `Bearer ${adminUser.token}`;

      const res = await fetch(`${API_BASE_URL}/admin/audit-logs`, { headers });
      if (!res.ok) throw new Error("Failed to fetch logs");
      const data = await res.json();
      setAuditLogs(Array.isArray(data) ? data : (data.logs || []));
    } catch (e) {
      setAuditLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: 'APPROVED' | 'REJECTED') => {
    if (!selectedAssessment) return;
    if (newStatus === 'APPROVED' && (!checklist.itrChecked || !checklist.clearanceVerified || !checklist.financialStatementValid)) {
      alert("Please complete the document verification checklist before approving this assessment.");
      return;
    }

    setSubmittingAction(true);
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (adminUser?.token) headers['Authorization'] = `Bearer ${adminUser.token}`;

      const res = await fetch(`${API_BASE_URL}/admin/business-assessments/${selectedAssessment.id}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: newStatus, remarks: actionRemarks, computedFees })
      });

      if (!res.ok) throw new Error("Failed to update assessment status.");

      alert(`Assessment successfully marked as ${newStatus}.`);
      setSelectedAssessment(null);
      setActionRemarks('');
      fetchAdminAssessments();
    } catch (err: any) {
      alert(`Error updating status: ${err.message || "Server error"}`);
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleExportCSV = () => {
    if (assessments.length === 0) {
      alert("No data available to export.");
      return;
    }
    const headers = ["Tracking Number", "Business Name", "Owner", "TIN", "Gross Sales", "Status", "Date Filed"];
    const rows = assessments.map(item => [
      item.trackingNumber,
      `"${item.businessName}"`,
      `"${item.businessOwner}"`,
      item.tin || 'N/A',
      item.grossSales || 0,
      item.status,
      item.applicationDate
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `LGU_Business_Assessments_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('user');
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('user');
    setAdminUser(null);
    setIsDropdownOpen(false);
    window.location.href = '/login'; 
  };

  return (
    <div 
      style={{
        marginLeft: isCollapsed ? "80px" : "256px",
        width: isCollapsed ? "calc(100% - 80px)" : "calc(100% - 256px)",
      }}
      className="min-h-screen bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 p-6 pt-24 transition-all duration-300 box-border flex flex-col justify-between"
    >
      <div className="space-y-6">
        {/* Top Header Banner Area */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs backdrop-blur-md">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse"></span>
              <span className="text-[11px] font-semibold tracking-wider text-blue-600 dark:text-blue-400 uppercase">
                Municipal Treasurer & BPLPO Portal
              </span>
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Business Tax Assessment & Permit Management
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Verify digital sales declarations, compute statutory local business taxes, and issue official orders of payment.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {adminUser && (
              <div className="relative" ref={dropdownRef}>
                <button 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center space-x-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-xs"
                >
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Admin, {adminUser.firstName}
                  </span>
                  <div className="w-6 h-6 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold text-[10px] tracking-wider">
                    {adminUser.initials}
                  </div>
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 z-50">
                    <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{adminUser.fullname}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{adminUser.email}</p>
                    </div>
                    <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer flex items-center gap-2">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg> Log Out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex gap-2">
            <button 
              onClick={() => setActiveTab('assessments')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'assessments' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
              }`}
            >
              Tax Assessments & Filings
            </button>
            <button 
              onClick={() => setActiveTab('audit_logs')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'audit_logs' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
              }`}
            >
              Audit Trail & COA Compliance Logs
            </button>
          </div>

          {activeTab === 'assessments' && (
            <button 
              onClick={handleExportCSV}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition-all shadow-xs cursor-pointer flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> Export BLGF / CSV Report
            </button>
          )}
        </div>

        {/* Main Content Area */}
        {activeTab === 'assessments' ? (
          <section className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-5">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg> Assessment Submissions Control Panel
              </h3>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                System Active
              </span>
            </div>

            {/* Filters & Search Toolbar Card */}
            <div className="p-5 bg-slate-50/50 dark:bg-slate-950/50 rounded-2xl border border-slate-200/80 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
              <div className="flex flex-col gap-1.5 text-xs">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Filter by Status</label>
                <select 
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none cursor-pointer focus:border-blue-500 transition-all"
                >
                  <option value="ALL">ALL APPLICATIONS</option>
                  <option value="PENDING">Pending Review</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5 text-xs">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Search Parameter</label>
                <select 
                  value={searchType}
                  onChange={(e) => setSearchType(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none cursor-pointer focus:border-blue-500 transition-all"
                >
                  <option value="Tracking/MP No.">Tracking/MP No.</option>
                  <option value="Business Name">Business Name</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5 text-xs sm:col-span-2 lg:col-span-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Search Query</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search submissions..." 
                    className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-all" 
                  />
                  <button 
                    onClick={() => { setCurrentPage(1); fetchAdminAssessments(); }} 
                    className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl transition-all cursor-pointer shadow-xs shrink-0 flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg> Search
                  </button>
                </div>
              </div>
            </div>

            {/* Admin Data Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
              <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4">TRACKING / PERMIT NO.</th>
                    <th className="p-4">BUSINESS NAME</th>
                    <th className="p-4">OWNER</th>
                    <th className="p-4">GROSS SALES (PHP)</th>
                    <th className="p-4 text-center">STATUS</th>
                    <th className="p-4">DATE FILED</th>
                    <th className="p-4 text-center">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-16 text-slate-400 italic">
                        Loading assessment declarations...
                      </td>
                    </tr>
                  ) : fetchError ? (
                    <tr>
                      <td colSpan={7} className="text-center py-16 text-rose-500 font-medium">
                        Error: {fetchError}
                      </td>
                    </tr>
                  ) : assessments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-16 text-slate-400 italic">
                        No business tax assessment records found.
                      </td>
                    </tr>
                  ) : (
                    assessments.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-4 font-mono font-bold text-blue-600 dark:text-blue-400">{item.trackingNumber}</td>
                        <td className="p-4 font-semibold text-slate-900 dark:text-slate-100">{item.businessName}</td>
                        <td className="p-4 font-medium text-slate-700 dark:text-slate-300">{item.businessOwner}</td>
                        <td className="p-4 font-mono font-bold text-slate-900 dark:text-white">₱{item.grossSales ? item.grossSales.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}</td>
                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border ${
                            item.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800' :
                            item.status === 'REJECTED' ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800' :
                            'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="p-4 text-slate-500">{new Date(item.applicationDate).toLocaleDateString()}</td>
                        <td className="p-4 text-center">
                          <button 
                            onClick={() => setSelectedAssessment(item)} 
                            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-3.5 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                          >
                            Review / Action
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 pt-2">
              <span className="font-medium">Page {currentPage} of {totalPages}</span>
              <div className="flex gap-2">
                <button 
                  disabled={currentPage <= 1 || loading} 
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl disabled:opacity-40 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-all font-semibold flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg> Previous
                </button>
                <button 
                  disabled={currentPage >= totalPages || loading} 
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl disabled:opacity-40 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-all font-semibold flex items-center gap-1"
                >
                  Next <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> System Audit Trail & Administrative Activity Logs
            </h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
              <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4">TIMESTAMP</th>
                    <th className="p-4">ADMINISTRATOR</th>
                    <th className="p-4">ACTION TYPE</th>
                    <th className="p-4">DETAILS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-16 text-slate-400 italic">No audit logs recorded yet.</td>
                    </tr>
                  ) : (
                    auditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="p-4 font-mono text-slate-500">{log.timestamp}</td>
                        <td className="p-4 font-bold text-slate-900 dark:text-white">{log.adminName}</td>
                        <td className="p-4 font-semibold text-blue-600">{log.action}</td>
                        <td className="p-4 text-slate-600 dark:text-slate-300">{log.details}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {/* DETAILED REVIEW & COMPUTATION MODAL */}
      {selectedAssessment && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-8 shadow-2xl border border-slate-200 dark:border-slate-800 my-8">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-4 mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Comprehensive Assessment & Tax Computation
                </h3>
                <p className="text-xs font-mono text-blue-600 dark:text-blue-400 mt-0.5">Tracking No: {selectedAssessment.trackingNumber}</p>
              </div>
              <button type="button" onClick={() => setSelectedAssessment(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            
            <div className="space-y-5 text-xs max-h-[70vh] overflow-y-auto pr-1">
              {/* Business Info Grid */}
              <div className="grid grid-cols-2 gap-3.5 bg-slate-50/50 dark:bg-slate-950/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                <div>
                  <span className="block text-[10px] text-slate-400 uppercase font-bold mb-0.5">Business Name</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedAssessment.businessName}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 uppercase font-bold mb-0.5">Owner / Applicant</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedAssessment.businessOwner}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 uppercase font-bold mb-0.5">Classification</span>
                  <span className="font-semibold text-blue-600">{selectedAssessment.businessType || 'Retailer'}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 uppercase font-bold mb-0.5">Declared Gross Sales</span>
                  <span className="font-semibold text-emerald-600">₱{selectedAssessment.grossSales ? selectedAssessment.grossSales.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}</span>
                </div>
              </div>

              {/* Automated Tax Computation Box (RA 7160 Compliant) */}
              <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 space-y-2">
                <h4 className="font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wide text-[11px] mb-2 flex items-center gap-1.5">
                  Computed Local Government Statutory Fees (RA 7160)
                </h4>
                <div className="flex justify-between py-1 border-b border-blue-100 dark:border-blue-900/30">
                  <span className="text-slate-600 dark:text-slate-400">Local Business Tax (LBT)</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">₱{computedFees.lbt.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-blue-100 dark:border-blue-900/30">
                  <span className="text-slate-600 dark:text-slate-400">Mayor's Permit Fee</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">₱{computedFees.mayorsPermit.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-blue-100 dark:border-blue-900/30">
                  <span className="text-slate-600 dark:text-slate-400">Sanitary Inspection Fee</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">₱{computedFees.sanitaryFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-blue-100 dark:border-blue-900/30">
                  <span className="text-slate-600 dark:text-slate-400">Garbage Fee</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">₱{computedFees.garbageFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-blue-100 dark:border-blue-900/30">
                  <span className="text-slate-600 dark:text-slate-400">Fire Safety Inspection Fee (10% BFP share)</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">₱{computedFees.fireSafetyFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-2 text-sm font-extrabold text-blue-700 dark:text-blue-400">
                  <span>Total Payable Assessment</span>
                  <span className="font-mono">₱{computedFees.total.toLocaleString()}</span>
                </div>
              </div>

              {/* Uploaded Documents & Verification Checklist */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide text-[11px]">
                  Attached Requirements & Verification Checklist
                </h4>
                
                <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Uploaded Files:</div>
                  {selectedAssessment.attachments && selectedAssessment.attachments.length > 0 ? (
                    selectedAssessment.attachments.map((file, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[280px] flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg> {file.name}
                        </span>
                        <div className="flex items-center gap-3">
                          <button 
                            type="button"
                            onClick={() => setPreviewFile(file)}
                            className="text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg> Preview
                          </button>
                          <a 
                            href={file.url} 
                            download 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-slate-600 dark:text-slate-300 hover:text-blue-600 font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg> Download
                          </a>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400 italic">No digital attachments uploaded.</p>
                  )}
                </div>

                {/* Checklist checkboxes */}
                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={checklist.itrChecked}
                      onChange={(e) => setChecklist({...checklist, itrChecked: e.target.checked})}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-300">I have verified the Income Tax Return (ITR) or Financial Statements.</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={checklist.clearanceVerified}
                      onChange={(e) => setChecklist({...checklist, clearanceVerified: e.target.checked})}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-300">Barangay Clearance and Zoning permits are authentic and valid.</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={checklist.financialStatementValid}
                      onChange={(e) => setChecklist({...checklist, financialStatementValid: e.target.checked})}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-300">Declared gross sales match the submitted financial records.</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Official Remarks / Assessment Notes</label>
                <textarea 
                  rows={2} 
                  value={actionRemarks}
                  onChange={(e) => setActionRemarks(e.target.value)}
                  placeholder="Enter evaluation notes or reason for approval/rejection..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-800 dark:text-slate-100 resize-none outline-none focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-800 mt-6">
              <button 
                type="button" 
                onClick={() => setShowOrderOfPaymentModal(true)}
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg> Generate Order of Payment (OP)
              </button>

              <div className="flex gap-2">
                <button 
                  type="button" 
                  disabled={submittingAction}
                  onClick={() => handleStatusUpdate('REJECTED')}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-xs shadow-xs cursor-pointer disabled:opacity-50 transition-all"
                >
                  Reject
                </button>
                <button 
                  type="button" 
                  disabled={submittingAction}
                  onClick={() => handleStatusUpdate('APPROVED')}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs shadow-xs cursor-pointer disabled:opacity-50 transition-all"
                >
                  Approve Assessment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FILE PREVIEW MODAL */}
      {previewFile && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate max-w-[320px]">{previewFile.name}</h4>
              </div>
              <button type="button" onClick={() => setPreviewFile(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>

            <div className="h-64 bg-slate-100 dark:bg-slate-950 rounded-2xl flex flex-col items-center justify-center border border-slate-200 dark:border-slate-800 p-4 text-center">
              <svg className="w-12 h-12 text-slate-400 mb-2" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Document Preview Ready</p>
              <p className="text-[11px] text-slate-500 mt-1">Click the download button below to view the full attachment locally.</p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button 
                type="button" 
                onClick={() => setPreviewFile(null)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 font-bold rounded-xl text-xs cursor-pointer"
              >
                Close
              </button>
              <a 
                href={previewFile.url} 
                download 
                target="_blank" 
                rel="noreferrer"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg> Download File
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ORDER OF PAYMENT PRINTABLE MODAL */}
      {showOrderOfPaymentModal && selectedAssessment && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-3xl max-w-lg w-full p-8 shadow-2xl space-y-6">
            <div className="text-center border-b border-slate-200 pb-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Republic of the Philippines</p>
              <h3 className="text-base font-extrabold uppercase">Office of the Municipal Treasurer</h3>
              <h4 className="text-sm font-bold text-blue-600">OFFICIAL ORDER OF PAYMENT (OP)</h4>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div><span className="text-slate-500 font-semibold">Tracking No:</span> <span className="font-mono font-bold">{selectedAssessment.trackingNumber}</span></div>
                <div><span className="text-slate-500 font-semibold">Date:</span> <span>{new Date().toLocaleDateString()}</span></div>
                <div className="col-span-2"><span className="text-slate-500 font-semibold">Business Name:</span> <span className="font-bold">{selectedAssessment.businessName}</span></div>
                <div className="col-span-2"><span className="text-slate-500 font-semibold">Owner:</span> <span>{selectedAssessment.businessOwner}</span></div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Fee Description</th>
                      <th className="p-2.5 text-right">Amount (PHP)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr><td className="p-2.5">Local Business Tax (LBT)</td><td className="p-2.5 text-right font-mono">₱{computedFees.lbt.toLocaleString()}</td></tr>
                    <tr><td className="p-2.5">Mayor's Permit Fee</td><td className="p-2.5 text-right font-mono">₱{computedFees.mayorsPermit.toLocaleString()}</td></tr>
                    <tr><td className="p-2.5">Sanitary Inspection Fee</td><td className="p-2.5 text-right font-mono">₱{computedFees.sanitaryFee.toLocaleString()}</td></tr>
                    <tr><td className="p-2.5">Garbage Fee</td><td className="p-2.5 text-right font-mono">₱{computedFees.garbageFee.toLocaleString()}</td></tr>
                    <tr><td className="p-2.5">Fire Safety Inspection Fee</td><td className="p-2.5 text-right font-mono">₱{computedFees.fireSafetyFee.toLocaleString()}</td></tr>
                    <tr className="bg-slate-50 font-extrabold"><td className="p-2.5">TOTAL DUE</td><td className="p-2.5 text-right font-mono text-blue-600">₱{computedFees.total.toLocaleString()}</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="text-center pt-2">
                <p className="text-[10px] text-slate-500">Please present this Order of Payment at the Municipal Treasury Cashier Window or scan QR via LandBank Link.Biz / GCash portal.</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button 
                onClick={() => setShowOrderOfPaymentModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 font-bold rounded-xl text-xs cursor-pointer"
              >
                Close Preview
              </button>
              <button 
                onClick={() => window.print()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg> Print / Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer bar */}
      <footer className="w-full text-slate-400 text-xs py-6 border-t border-slate-200 dark:border-slate-800 mt-12 text-center">
        <p>© 2026 Local Government Treasury Unit. All rights reserved. Production-Ready LGU Module.</p>
      </footer>
    </div>
  );
};

export default BusinessTaxAssessmentAdminView;