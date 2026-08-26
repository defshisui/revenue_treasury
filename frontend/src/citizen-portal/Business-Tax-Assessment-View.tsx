import React, { useState, useEffect, useRef } from 'react';

export interface BusinessTaxAssessmentViewProps {
  isCollapsed?: boolean;
}

type ActiveScreen = 'home' | 'assessment-list';

interface AssessmentRecord {
  id: string;
  trackingNumber: string;
  businessName: string;
  businessOwner: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  applicationDate: string;
  psicCode?: string;
  grossSales?: number;
}

export const BusinessTaxAssessmentView: React.FC<BusinessTaxAssessmentViewProps> = ({ isCollapsed = false }) => {
  const [currentScreen, setCurrentScreen] = useState<ActiveScreen>('home');
  const [isModalOpen, setIsModalOpen] = useState<false | 'appointment' | 'tax-bill' | 'or-number' | 'sales-declaration'>(false);

  // Authentication & Dropdown State
  const [user, setUser] = useState<{ fullname: string; email: string; initials: string; firstName: string; token: string } | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Functional Data States
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  // Search, Filter & Pagination States
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchType, setSearchType] = useState<string>('Tracking/MP No.');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const pageSize = 10;

  // Verification & Sales Declaration Form States (Updated with TIN & PSIC requirements)
  const [taxBillForm, setTaxBillForm] = useState({ permitNo: '', taxBillNo: '', tin: '' });
  const [orForm, setOrForm] = useState({ permitNo: '', orNo: '', tin: '' });
  const [salesForm, setSalesForm] = useState({ 
    businessName: '', 
    grossSales: '', 
    year: '2026', 
    psicCode: '47110', 
    tin: '',
    file: null as File | null 
  });

  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

  useEffect(() => {
    const checkUserSession = () => {
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
        console.error("Failed to parse user session", e);
        return null;
      }
    };

    setUser(checkUserSession());

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch Real Assessments from Backend when switching to list screen or changing page/filters
  useEffect(() => {
    if (currentScreen === 'assessment-list' && user) {
      fetchAssessments();
    }
  }, [currentScreen, user, statusFilter, currentPage]);

  const fetchAssessments = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const queryParams = new URLSearchParams();
      if (statusFilter !== 'ALL') queryParams.append('status', statusFilter);
      if (user?.email) queryParams.append('email', user.email);
      queryParams.append('page', currentPage.toString());
      queryParams.append('limit', pageSize.toString());
      if (searchQuery) queryParams.append('search', searchQuery);
      queryParams.append('searchType', searchType);

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (user?.token) {
        headers['Authorization'] = `Bearer ${user.token}`;
      }

      const response = await fetch(`${API_BASE_URL}/business-assessments?${queryParams.toString()}`, { headers });

      if (!response.ok) {
        throw new Error(`Failed to fetch assessments: ${response.statusText}`);
      }

      const data = await response.json();
      setAssessments(Array.isArray(data) ? data : (data.assessments || []));
      setTotalPages(data.totalPages || 1);
    } catch (err: any) {
      console.error("Error fetching assessments:", err);
      setFetchError(err.message || "Failed to load records from server.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    const userName = user?.fullname || user?.email || "Citizen User";
    const userEmail = user?.email || "Unknown";

    const auditPayload = JSON.stringify({
      auditId: `AUD-${Math.floor(100000 + Math.random() * 900000)}`,
      user: userName,
      role: "Citizen",
      module: "Authentication",
      action: "User Logged Out",
      severity: "INFO",
      ipAddress: "127.0.0.1",
      userAgent: navigator.userAgent,
      previousData: `Active session for ${userEmail}`,
      newData: "Session terminated / Logged out",
      timestamp: new Date().toISOString()
    });

    if (navigator.sendBeacon) {
      const blob = new Blob([auditPayload], { type: 'application/json' });
      navigator.sendBeacon(`${API_BASE_URL}/audit-logs`, blob);
    } else {
      fetch(`${API_BASE_URL}/audit-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: auditPayload,
        keepalive: true
      }).catch(err => console.error("Logout log failed:", err));
    }

    localStorage.removeItem('currentUser');
    localStorage.removeItem('user');
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('user');
    setUser(null);
    setIsDropdownOpen(false);
    
    window.location.href = '/'; 
  };

  // Form states
  const [aptForm, setAptForm] = useState({
    department: 'City Treasurer\'s Office',
    appointmentType: '',
    address: '',
    description: '',
    fullName: user?.fullname || '',
    email: user?.email || '',
    phone: '',
    date: '',
    remarks: '',
    notARobot: false,
  });

  const [submitting, setSubmitting] = useState(false);

  const handleAppointmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aptForm.notARobot) {
      alert("Please confirm you are not a robot.");
      return;
    }
    setSubmitting(true);
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (user?.token) headers['Authorization'] = `Bearer ${user.token}`;

      const res = await fetch(`${API_BASE_URL}/appointments`, {
        method: 'POST',
        headers,
        body: JSON.stringify(aptForm)
      });
      if (!res.ok) throw new Error("Failed to submit appointment request.");
      alert("Appointment submitted successfully!");
      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message || "An error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTaxBillVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (user?.token) headers['Authorization'] = `Bearer ${user.token}`;

      const res = await fetch(`${API_BASE_URL}/verify/tax-bill`, {
        method: 'POST',
        headers,
        body: JSON.stringify(taxBillForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Verification failed.");
      alert(`Tax Bill Verified Successfully! Status: ${data.status || 'Valid'}`);
      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleOrVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (user?.token) headers['Authorization'] = `Bearer ${user.token}`;

      const res = await fetch(`${API_BASE_URL}/verify/or-number`, {
        method: 'POST',
        headers,
        body: JSON.stringify(orForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Verification failed.");
      alert(`Official Receipt Verified Successfully! Paid Amount: ₱${data.amount || 'N/A'}`);
      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSalesDeclarationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('businessName', salesForm.businessName);
    formData.append('grossSales', salesForm.grossSales);
    formData.append('year', salesForm.year);
    formData.append('psicCode', salesForm.psicCode);
    formData.append('tin', salesForm.tin);
    if (salesForm.file) formData.append('financialStatement', salesForm.file);
    if (user?.email) formData.append('email', user.email);

    setSubmitting(true);
    try {
      const headers: HeadersInit = {};
      if (user?.token) headers['Authorization'] = `Bearer ${user.token}`;

      const res = await fetch(`${API_BASE_URL}/business-assessments/sales-declaration`, {
        method: 'POST',
        headers,
        body: formData
      });
      if (!res.ok) throw new Error("Failed to submit sales declaration.");
      alert("Sales declaration submitted successfully!");
      setIsModalOpen(false);
      fetchAssessments();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openModal = (type: 'appointment' | 'tax-bill' | 'or-number' | 'sales-declaration') => {
    setIsModalOpen(type);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  return (
    <div 
      style={{
        marginLeft: isCollapsed ? "80px" : "0px",
        width: isCollapsed ? "calc(100% - 80px)" : "100%",
      }}
      className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 pt-0 transition-all duration-300 box-border flex flex-col justify-between"
    >
      <div>
        {/* Top Header / Banner Area */}
        <div className="w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.location.href = '/citizen-portal'}>
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xs flex items-center justify-center">
                  <img 
                    src="/src/assets/logo-system.png" 
                    alt="System Logo" 
                    className="h-8 w-8 object-contain" 
                    onError={(e)=>{(e.target as HTMLElement).style.display='none';}}
                  />
                </div>
                <div className="flex flex-col">
                  <span className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-white leading-tight">
                    Gov Serv
                  </span>
                  <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 tracking-wider uppercase">
                    Unified Portal
                  </span>
                </div>
              </div>
            </div>

            <div className="hidden md:flex items-center space-x-6 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span className="hover:text-blue-700 cursor-pointer" onClick={() => window.location.href = '/citizen-portal'}>HOME</span>
              
              <div className="relative group py-2">
                <span className="hover:text-blue-700 cursor-pointer flex items-center gap-1 select-none">
                  SERVICES ▾
                </span>
                <div className="absolute left-0 top-full h-2 w-full"></div>
                <div className="absolute left-0 top-[calc(100%+8px)] w-60 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-1 group-hover:translate-y-0">
                  <button onClick={() => window.location.href = '/citizen-portal'} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-700 transition-colors cursor-pointer">Home</button>
                  <button onClick={() => window.location.href = '/market-vendor-tab'} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-700 transition-colors cursor-pointer">Market &amp; Vendors Hub</button>
                  <button onClick={() => window.location.href = '/real-property-tax-hub'} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-700 transition-colors cursor-pointer">Real Property Tax Hub</button>
                  <button onClick={() => window.location.href = '/business-tax-assessment'} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-700 transition-colors cursor-pointer">Business Tax Assessment Hub</button>
                </div>
              </div>

              <span className="hover:text-blue-700 cursor-pointer">CONTACT US</span>
            </div>

            <div className="flex items-center space-x-3">
              {user ? (
                <div className="relative" ref={dropdownRef}>
                  <button 
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center space-x-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs group"
                  >
                    <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 tracking-tight">
                      Hi, {user.firstName}
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-[10px] shadow-sm tracking-wider">
                      {user.initials}
                    </div>
                  </button>

                  {isDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 z-50">
                      <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user.fullname}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                      </div>
                      <button onClick={() => { setIsDropdownOpen(false); window.location.href = '/edit-profile'; }} className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-700 transition-colors cursor-pointer">Edit Profile</button>
                      <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer border-t border-slate-100 dark:border-slate-800 mt-1 pt-2">Log Out</button>
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={() => window.location.href = '/login'} className="bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs px-4 py-2 rounded-xl shadow transition-all cursor-pointer">
                  Login / Register
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Hero Banner Illustration Area */}
        <div className="relative w-full bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 h-36 sm:h-48 overflow-hidden flex items-center justify-center border-b-4 border-blue-600">
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]"></div>
          <div className="relative z-10 text-center px-4">
            <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-wide">
              {currentScreen === 'home' ? 'WELCOME TO BUSINESS TAX ASSESSMENT' : '2026 BUSINESS TAX PAYMENT'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-1 max-w-xl mx-auto">
              {currentScreen === 'home' 
                ? "This portal is one of our digital Gov Serv initiatives catering to the needs of business owners in securing their permits and licenses."
                : "Manage your online sales declarations and monitor permit assessment status."}
            </p>
          </div>
        </div>

        {/* Main Body Content Container */}
        <div className="max-w-6xl mx-auto px-4 py-8">
          {currentScreen === 'home' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 flex flex-col justify-between text-center">
                  <div>
                    <h3 className="text-blue-900 dark:text-blue-400 font-bold text-sm tracking-wider uppercase mb-1">2026 Business Tax</h3>
                    <h4 className="text-slate-800 dark:text-slate-100 font-semibold text-base mb-3">Proceed and Pay Online</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
                      You can now submit your Online Sales Declaration along with your Financial Statements and other requirements online. Assessment and settlement of payment can also be done through this portal.
                    </p>
                  </div>
                  <div>
                    <button onClick={() => setCurrentScreen('assessment-list')} className="w-full sm:w-auto px-6 py-2.5 bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold rounded-full shadow-md transition-all cursor-pointer">
                      PROCEED WITH BUSINESS TAX ASSESSMENT
                    </button>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 flex flex-col justify-between text-center">
                  <div>
                    <h3 className="text-blue-900 dark:text-blue-400 font-bold text-sm tracking-wider uppercase mb-1">Appointment</h3>
                    <h4 className="text-slate-800 dark:text-slate-100 font-semibold text-base mb-3">&nbsp;</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
                      Do you have any concerns regarding your Business Tax Assessment? You may visit the City Treasurer's Office by scheduling an appointment below:
                    </p>
                  </div>
                  <div>
                    <button onClick={() => openModal('appointment')} className="w-full sm:w-auto px-6 py-2.5 bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold rounded-full shadow-md transition-all cursor-pointer">
                      SET AN APPOINTMENT
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 text-center">
                <h3 className="text-blue-900 dark:text-blue-400 font-bold text-sm tracking-wider uppercase mb-2">
                  TAX BILL NUMBER AND O.R. NUMBER VERIFICATION
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                  Do you want to verify your Tax Bill Number or O.R. Number?<br />Just click below
                </p>
                <div className="flex flex-col sm:flex-row justify-center items-center gap-3">
                  <button onClick={() => openModal('tax-bill')} className="w-full sm:w-auto px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold rounded-full shadow-md transition-all cursor-pointer">
                    TAX BILL NUMBER VERIFICATION
                  </button>
                  <button onClick={() => openModal('or-number')} className="w-full sm:w-auto px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold rounded-full shadow-md transition-all cursor-pointer">
                    O.R. NUMBER VERIFICATION
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setCurrentScreen('home')} className="text-xs text-blue-700 hover:underline font-semibold flex items-center gap-1 cursor-pointer">
                  ← Back to Home
                </button>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button onClick={() => openModal('sales-declaration')} className="px-4 py-2 bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold rounded-md shadow-xs cursor-pointer">
                    SUBMIT ONLINE SALES DECLARATION
                  </button>
                </div>
              </div>

              {/* Filters & Search Row */}
              <div className="flex flex-col md:flex-row justify-between items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="w-full md:w-64">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Application Status</label>
                  <select 
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                    className="w-full p-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="ALL">ALL</option>
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                  <div className="w-full sm:w-48">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Search By:</label>
                    <select 
                      value={searchType}
                      onChange={(e) => setSearchType(e.target.value)}
                      className="w-full p-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-950"
                    >
                      <option value="Tracking/MP No.">Tracking/MP No.</option>
                      <option value="Business Name">Business Name</option>
                    </select>
                  </div>
                  <div className="w-full sm:w-64 pt-5">
                    <div className="flex gap-1">
                      <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search..." 
                        className="w-full p-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-950" 
                      />
                      <button onClick={() => { setCurrentPage(1); fetchAssessments(); }} className="px-3 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded cursor-pointer">
                        Search
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-blue-900 text-white font-semibold">
                    <tr>
                      <th className="p-3">TRACKING/MAYOR'S PERMIT NUMBER ↕</th>
                      <th className="p-3">BUSINESS NAME</th>
                      <th className="p-3">BUSINESS OWNER</th>
                      <th className="p-3">APPLICATION STATUS</th>
                      <th className="p-3">APPLICATION DATE</th>
                      <th className="p-3">ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500 bg-slate-50 dark:bg-slate-950/50">
                          Loading records from server...
                        </td>
                      </tr>
                    ) : fetchError ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-rose-500 bg-slate-50 dark:bg-slate-950/50">
                          Error: {fetchError}
                        </td>
                      </tr>
                    ) : assessments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400 bg-slate-50 dark:bg-slate-950/50">
                          No data available in table
                        </td>
                      </tr>
                    ) : (
                      assessments.map((item) => (
                        <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                          <td className="p-3 font-medium">{item.trackingNumber}</td>
                          <td className="p-3">{item.businessName}</td>
                          <td className="p-3">{item.businessOwner}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400' :
                              item.status === 'REJECTED' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-400' :
                              'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400'
                            }`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="p-3">{new Date(item.applicationDate).toLocaleDateString()}</td>
                          <td className="p-3">
                            <button onClick={() => window.location.href = `/assessment-detail/${item.id}`} className="text-blue-600 hover:underline font-semibold cursor-pointer">
                              View
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Functional Pagination Footer */}
              <div className="flex justify-between items-center text-xs text-slate-500 pt-2">
                <span>Page {currentPage} of {totalPages}</span>
                <div className="flex gap-1">
                  <button 
                    disabled={currentPage <= 1 || loading} 
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    className="px-3 py-1 border border-slate-300 dark:border-slate-700 rounded disabled:opacity-40 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Previous
                  </button>
                  <button 
                    disabled={currentPage >= totalPages || loading} 
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    className="px-3 py-1 border border-slate-300 dark:border-slate-700 rounded disabled:opacity-40 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer bar */}
      <footer className="w-full bg-blue-950 text-slate-300 text-xs py-4 px-6 border-t border-blue-900 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-4">
            <span className="font-bold">FOLLOW US</span>
            <div className="w-6 h-6 rounded-full bg-blue-900 flex items-center justify-center text-[10px] font-bold cursor-pointer">f</div>
            <div className="w-6 h-6 rounded-full bg-blue-900 flex items-center justify-center text-[10px] font-bold cursor-pointer">x</div>
          </div>
          <div className="flex items-center gap-6 text-[11px]">
            <span>📞 122</span>
            <span>✉️ helpdesk@domain.gov.ph</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="hover:underline cursor-pointer">TERMS OF SERVICE</span>
            <span className="hover:underline cursor-pointer">FAQS</span>
            <span className="hover:underline cursor-pointer">PRIVACY POLICY</span>
          </div>
        </div>
        <div className="max-w-7xl mx-auto text-center text-[10px] text-slate-400 mt-3 pt-3 border-t border-blue-900/50">
          © 2026 Local Government. All rights reserved.
        </div>
      </footer>

      {/* MODALS */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          
          {/* APPOINTMENT MODAL */}
          {isModalOpen === 'appointment' && (
            <form onSubmit={handleAppointmentSubmit} className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl overflow-hidden">
              <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">Request New Appointment</h3>
                <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer">✕</button>
              </div>
              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-red-600 mb-1">* Department</label>
                  <select 
                    value={aptForm.department}
                    onChange={(e) => setAptForm({...aptForm, department: e.target.value})}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-950"
                  >
                    <option>City Treasurer's Office</option>
                    <option>Business Permits and Licensing Department</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-red-600 mb-1">* Appointment Type</label>
                  <select 
                    required
                    value={aptForm.appointmentType}
                    onChange={(e) => setAptForm({...aptForm, appointmentType: e.target.value})}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="">Nothing selected</option>
                    <option value="Assessment">Business Tax Assessment</option>
                    <option value="Payment">Payment Verification</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Appointment Address</label>
                  <input 
                    type="text" 
                    value={aptForm.address}
                    onChange={(e) => setAptForm({...aptForm, address: e.target.value})}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-950" 
                    placeholder="Enter location / office branch" 
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Appointment Description</label>
                  <input 
                    type="text" 
                    value={aptForm.description}
                    onChange={(e) => setAptForm({...aptForm, description: e.target.value})}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-950" 
                    placeholder="Brief description of concerns" 
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-red-600 mb-1">* Full Name</label>
                  <input 
                    required
                    type="text" 
                    value={aptForm.fullName}
                    onChange={(e) => setAptForm({...aptForm, fullName: e.target.value})}
                    placeholder="Enter full name"
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-red-600 mb-1">* Email Address</label>
                  <input 
                    required
                    type="email" 
                    value={aptForm.email}
                    onChange={(e) => setAptForm({...aptForm, email: e.target.value})}
                    placeholder="Enter email address" 
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-950" 
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-red-600 mb-1">* Phone Number</label>
                  <input 
                    required
                    type="text" 
                    value={aptForm.phone}
                    onChange={(e) => setAptForm({...aptForm, phone: e.target.value})}
                    placeholder="Enter phone number" 
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-950" 
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-red-600 mb-1">* Date</label>
                  <input 
                    required
                    type="date" 
                    value={aptForm.date}
                    onChange={(e) => setAptForm({...aptForm, date: e.target.value})}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-950" 
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Remarks (Optional)</label>
                  <textarea 
                    rows={2} 
                    value={aptForm.remarks}
                    onChange={(e) => setAptForm({...aptForm, remarks: e.target.value})}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-950 resize-none" 
                  />
                </div>
                <div className="p-3 border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={aptForm.notARobot}
                      onChange={(e) => setAptForm({...aptForm, notARobot: e.target.checked})}
                      className="w-4 h-4 rounded text-blue-600" 
                    />
                    <span>I'm not a robot</span>
                  </label>
                  <span className="text-[10px] text-slate-400">reCAPTCHA</span>
                </div>
              </div>
              <div className="flex justify-end gap-2 px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                <button type="button" onClick={closeModal} className="px-4 py-2 border border-slate-300 rounded font-semibold hover:bg-slate-100 cursor-pointer">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow-xs cursor-pointer">
                  {submitting ? 'Submitting...' : 'SUBMIT'}
                </button>
              </div>
            </form>
          )}

          {/* TAX BILL NUMBER VERIFICATION MODAL */}
          {isModalOpen === 'tax-bill' && (
            <form onSubmit={handleTaxBillVerification} className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden">
              <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">TAX BILL NUMBER VERIFICATION</h3>
                <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer">✕</button>
              </div>
              <div className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Tax Identification Number (TIN)</label>
                  <input 
                    required
                    type="text" 
                    value={taxBillForm.tin}
                    onChange={(e) => setTaxBillForm({...taxBillForm, tin: e.target.value})}
                    placeholder="000-000-000-000" 
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-950" 
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Mayor's Permit Number</label>
                  <input 
                    required
                    type="text" 
                    value={taxBillForm.permitNo}
                    onChange={(e) => setTaxBillForm({...taxBillForm, permitNo: e.target.value})}
                    placeholder="Enter Mayor's Permit No." 
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-950" 
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Tax Bill Number</label>
                  <input 
                    required
                    type="text" 
                    value={taxBillForm.taxBillNo}
                    onChange={(e) => setTaxBillForm({...taxBillForm, taxBillNo: e.target.value})}
                    placeholder="Enter Tax Bill No." 
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-950" 
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                <button type="button" onClick={closeModal} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded shadow-xs cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded shadow-xs cursor-pointer">Verify</button>
              </div>
            </form>
          )}

          {/* O.R. NUMBER VERIFICATION MODAL */}
          {isModalOpen === 'or-number' && (
            <form onSubmit={handleOrVerification} className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden">
              <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">O.R. NUMBER VERIFICATION</h3>
                <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer">✕</button>
              </div>
              <div className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Tax Identification Number (TIN)</label>
                  <input 
                    required
                    type="text" 
                    value={orForm.tin}
                    onChange={(e) => setOrForm({...orForm, tin: e.target.value})}
                    placeholder="000-000-000-000" 
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-950" 
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Mayor's Permit Number</label>
                  <input 
                    required
                    type="text" 
                    value={orForm.permitNo}
                    onChange={(e) => setOrForm({...orForm, permitNo: e.target.value})}
                    placeholder="Enter Mayor's Permit No." 
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-950" 
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">O.R. Number</label>
                  <input 
                    required
                    type="text" 
                    value={orForm.orNo}
                    onChange={(e) => setOrForm({...orForm, orNo: e.target.value})}
                    placeholder="Enter Official Receipt (O.R.) No." 
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-950" 
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                <button type="button" onClick={closeModal} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded shadow-xs cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded shadow-xs cursor-pointer">Verify</button>
              </div>
            </form>
          )}

          {/* ONLINE SALES DECLARATION MODAL */}
          {isModalOpen === 'sales-declaration' && (
            <form onSubmit={handleSalesDeclarationSubmit} className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden">
              <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">SUBMIT ONLINE SALES DECLARATION</h3>
                <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer">✕</button>
              </div>
              <div className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Business Name</label>
                  <input 
                    required
                    type="text" 
                    value={salesForm.businessName}
                    onChange={(e) => setSalesForm({...salesForm, businessName: e.target.value})}
                    placeholder="Enter registered business name" 
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-950" 
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Tax Identification Number (TIN)</label>
                  <input 
                    required
                    type="text" 
                    value={salesForm.tin}
                    onChange={(e) => setSalesForm({...salesForm, tin: e.target.value})}
                    placeholder="000-000-000-000" 
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-950" 
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">PSIC Code (Line of Business)</label>
                  <select
                    value={salesForm.psicCode}
                    onChange={(e) => setSalesForm({...salesForm, psicCode: e.target.value})}
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="47110">47110 - Retail Sale in Non-Specialized Stores (Supermarkets/Sari-Sari)</option>
                    <option value="56101">56101 - Restaurants and Mobile Food Service Activities</option>
                    <option value="62010">62010 - Computer Programming, Consultancy and Related Activities</option>
                    <option value="45200">45200 - Maintenance and Repair of Motor Vehicles</option>
                    <option value="10710">10710 - Manufacture of Bakery Products</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Gross Sales / Receipts (PHP)</label>
                  <input 
                    required
                    type="number" 
                    step="0.01"
                    value={salesForm.grossSales}
                    onChange={(e) => setSalesForm({...salesForm, grossSales: e.target.value})}
                    placeholder="0.00" 
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-950" 
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Tax Year</label>
                  <input 
                    required
                    type="text" 
                    value={salesForm.year}
                    onChange={(e) => setSalesForm({...salesForm, year: e.target.value})}
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-950" 
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Financial Statement / ITR (PDF/Image)</label>
                  <input 
                    required
                    type="file" 
                    accept=".pdf,image/*"
                    onChange={(e) => setSalesForm({...salesForm, file: e.target.files ? e.target.files[0] : null})}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-950 text-xs" 
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                <button type="button" onClick={closeModal} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded shadow-xs cursor-pointer">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded shadow-xs cursor-pointer">
                  {submitting ? 'Submitting...' : 'Submit Declaration'}
                </button>
              </div>
            </form>
          )}

        </div>
      )}
    </div>
  );
};

export default BusinessTaxAssessmentView;