import { useState, useEffect, useRef } from 'react';
import logoSystem from '../assets/logo-system.png';
import { API_BASE_URL } from '../config/api';

export default function CitizenPortalLanding() {
  // Authentication & Dropdown State
  const [user, setUser] = useState<{ fullname: string; email: string; initials: string; firstName: string } | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
        const nameParts = String(fullName).trim().split(" ");
        const firstName = nameParts[0];
        const initials = nameParts.length > 1
          ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
          : nameParts[0].slice(0, 2).toUpperCase();

        return { fullname: String(fullName), email, firstName, initials };
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

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 pt-0 transition-all duration-300 box-border flex flex-col justify-between">
      <div>
        {/* Main Navigation Header */}
        <div className="w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.location.href = '/citizen-portal'}>
              <div className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xs flex items-center justify-center">
                <img
                  src={logoSystem}
                  alt="System Logo"
                  className="h-8 w-8 object-contain"
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

            <div className="hidden md:flex items-center space-x-6 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span className="hover:text-blue-700 cursor-pointer" onClick={() => window.location.href = '/citizen-portal'}>HOME</span>

              {/* Services Dropdown using Tailwind Group Hover with a Hover Bridge */}
              <div className="relative group py-2">
                <span className="hover:text-blue-700 cursor-pointer flex items-center gap-1 select-none">
                  SERVICES ▾
                </span>

                {/* Invisible hover bridge padding to prevent closing when moving the cursor down */}
                <div className="absolute left-0 top-full h-2 w-full"></div>

                <div className="absolute left-0 top-[calc(100%+8px)] w-60 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-1 group-hover:translate-y-0">
                  <button
                    onClick={() => window.location.href = '/citizen-portal'}
                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-700 transition-colors cursor-pointer"
                  >
                    Home
                  </button>
                  <button
                    onClick={() => window.location.href = '/market-vendors-hub'}
                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-700 transition-colors cursor-pointer"
                  >
                    Market &amp; Vendors Hub
                  </button>
                  <button
                    onClick={() => window.location.href = '/real-property-tax-hub'}
                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-700 transition-colors cursor-pointer"
                  >
                    Real Proerty Tax Hub
                  </button>
                  <button
                    onClick={() => window.location.href = '/business-tax-assessment'}
                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-700 transition-colors cursor-pointer"
                  >
                    Business Tax Assessment Hub
                  </button>
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

                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          window.location.href = '/edit-profile';
                        }}
                        className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-700 transition-colors cursor-pointer"
                      >
                        Edit Profile
                      </button>

                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer border-t border-slate-100 dark:border-slate-800 mt-1 pt-2"
                      >
                        Log Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => window.location.href = '/'}
                  className="bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs px-4 py-2 rounded-xl shadow transition-all cursor-pointer"
                >
                  Login / Register
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Container / Landing Page */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

          {/* Hero Welcome Banner matching the exact reference style */}
          <div className="relative overflow-hidden bg-[#122261] rounded-3xl p-8 sm:p-12 text-white shadow-lg flex flex-col justify-center bg-[radial-gradient(#1e3a8a_1px,transparent_1px)] [background-size:16px_16px]">

            {/* Background Watermark Logo */}
            <div className="absolute right-[-20px] bottom-[-40px] pointer-events-none opacity-10 select-none">
              <img
                src={logoSystem}
                alt=""
                className="w-80 h-80 sm:w-96 sm:h-96 object-contain"
              />
            </div>

            {/* Foreground Content */}
            <div className="relative z-10 flex flex-col items-start space-y-4 max-w-2xl">
              <span className="bg-blue-500/30 text-blue-200 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-blue-400/30">
                CITIZEN PORTAL DASHBOARD
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                Welcome{user ? `, ${user.firstName}` : ''}! Access Your Services Here.
              </h1>
              <p className="text-xs sm:text-sm text-blue-100 leading-relaxed">
                Manage your applications, check local business registrations, pay dues, and access government support services quickly and securely.
              </p>
            </div>
          </div>

          {/* Quick Access Services Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Available Online Services</h2>
              <span className="text-xs font-bold text-blue-700 cursor-pointer hover:underline">View All &rarr;</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

              <div
                onClick={() => window.location.href = '/market-vendor-tab'}
                className="bg-white hover:bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 22V12h6v10" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 group-hover:text-blue-900">Market &amp; Vendors Hub</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">Access public/private market stalls, hawker registrations, and market operator guidelines.</p>
                </div>
                <div className="text-xs font-bold text-blue-700 flex items-center gap-1 pt-2">
                  Launch Service &rarr;
                </div>
              </div>

              <div
                onClick={() => window.location.href = '/citizen-rpt'}
                className="bg-white hover:bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
              >
                <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 border border-teal-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 group-hover:text-teal-900">Real Property Tax</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">View property evaluations, file tax details, pay statements, and track assessment requests.</p>
                </div>
                <div className="text-xs font-bold text-teal-700 flex items-center gap-1 pt-2">
                  Launch Service &rarr;
                </div>
              </div>

              <div
                onClick={() => window.location.href = '/business-tax-assessment'}
                className="bg-white hover:bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
              >
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-700 border border-purple-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 group-hover:text-purple-900">Business Tax Assessment</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">Compute assessments, review business gross receipts, and process local business taxes.</p>
                </div>
                <div className="text-xs font-bold text-purple-700 flex items-center gap-1 pt-2">
                  Launch Service &rarr;
                </div>
              </div>

            </div>
          </div>

        </main>
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
    </div>
  );
}