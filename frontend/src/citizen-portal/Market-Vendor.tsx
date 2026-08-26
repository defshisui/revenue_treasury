import { useState, useEffect, useRef } from 'react';
import type { FC } from 'react';
import { API_BASE_URL } from '../config/api';

export interface MarketVendorsHubProps {
  isCollapsed?: boolean;
}

export const MarketVendorsHub: FC<MarketVendorsHubProps> = ({ isCollapsed = false }) => {
  const [marketCategoryModal, setMarketCategoryModal] = useState<string | null>(null);
  const [submitOptionsModal, setSubmitOptionsModal] = useState(false);

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
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => { window.location.href = '/citizen-portal'; }}>
                <div className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xs flex items-center justify-center">
                  <img
                    src="/src/assets/logo-system.png"
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
                    onClick={() => window.location.href = '/Market-Vendor'}
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
                    onClick={() => window.location.href = '/Bsiness-Tax-Assessment-View'}
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

        {/* Hero Banner Illustration Area */}
        <div className="relative w-full bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 h-36 sm:h-48 overflow-hidden flex items-center justify-center border-b-4 border-blue-600">
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]"></div>
          <div className="relative z-10 text-center px-4">
            <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-wide uppercase">
              WELCOME TO MARKET &amp; VENDORS HUB
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-1 max-w-xl mx-auto">
              This portal is one of our digital Gov Serv initiatives catering to the needs of market vendors and operators in securing their permits and licenses.
            </p>
          </div>
        </div>

        {/* Main Body Content Container */}
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">

          {/* City-Owned Market - Full Width */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 flex flex-col justify-between text-center">
            <div>
              <h3 className="text-blue-900 dark:text-blue-400 font-bold text-sm tracking-wider uppercase mb-1">CITY-OWNED MARKET</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
                Galas, Kamuning, Murphy, Project 2, Project 4, RA Calalay, Roxas, and San Jose public wet/dry market stalls.
                You can now submit your stall applications and manage accounts online through this portal.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <button
                onClick={() => setMarketCategoryModal('cityOwned')}
                className="px-6 py-2.5 bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold rounded-full shadow-md transition-all cursor-pointer"
              >
                PROCEED WITH CITY-OWNED MARKET
              </button>
            </div>
          </div>

          {/* Bottom Full Width Card: Hawkers & Street Vendors */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 text-center">
            <h3 className="text-blue-900 dark:text-blue-400 font-bold text-sm tracking-wider uppercase mb-2">
              HAWKERS &amp; STREET VENDORS REGISTRATION
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 max-w-xl mx-auto">
              Do you want to register your mobile vending association or certified sidewalk cart spot? Click below to start your application:
            </p>
            <div className="flex justify-center">
              <button
                onClick={() => setMarketCategoryModal('hawkers')}
                className="w-full sm:w-auto px-6 py-2.5 bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold rounded-full shadow-md transition-all cursor-pointer"
              >
                PROCEED WITH HAWKERS REGISTRATION
              </button>
            </div>
          </div>

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
      {marketCategoryModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">QC MDAD Portal</span>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                  {marketCategoryModal === 'cityOwned' && 'City-Owned Market'}
                  {marketCategoryModal === 'hawkers' && 'Hawkers'}
                </h3>
              </div>
              <button onClick={() => setMarketCategoryModal(null)} className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer">✕</button>
            </div>

            <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto text-xs">
              {marketCategoryModal === 'cityOwned' && (
                <>
                  <button
                    onClick={() => { setMarketCategoryModal(null); setSubmitOptionsModal(true); }}
                    className="w-full text-left bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex items-center justify-between transition-all shadow-xs group cursor-pointer"
                  >
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-blue-700">Submit Stall Application</h4>
                      <p className="text-[11px] text-slate-500">New processing for public market spaces</p>
                    </div>
                    <span className="text-sm font-bold text-slate-400 group-hover:text-blue-700">&rarr;</span>
                  </button>

                  <button
                    onClick={() => { window.location.href = '/citizen-portal-stall-manage-account'; setMarketCategoryModal(null); }}
                    className="w-full text-left bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex items-center justify-between transition-all shadow-xs group cursor-pointer"
                  >
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-blue-700">Manage City-Owned Market Account</h4>
                      <p className="text-[11px] text-slate-500">Access profile settings, bills, and payment records</p>
                    </div>
                    <span className="text-sm font-bold text-slate-400 group-hover:text-blue-700">&rarr;</span>
                  </button>
                </>
              )}


              {marketCategoryModal === 'hawkers' && (
                <>
                  <button
                    onClick={() => { window.location.href = '/hawker-application'; setMarketCategoryModal(null); }}
                    className="w-full text-left bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex items-center justify-between transition-all shadow-xs group cursor-pointer"
                  >
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-blue-700">Register Hawker Association</h4>
                      <p className="text-[11px] text-slate-500">Official group registration for vendor collectives</p>
                    </div>
                    <span className="text-sm font-bold text-slate-400 group-hover:text-blue-700">&rarr;</span>
                  </button>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <button onClick={() => setMarketCategoryModal(null)} className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded font-semibold hover:bg-slate-100 text-xs cursor-pointer">Close Menu</button>
            </div>
          </div>
        </div>
      )}

      {submitOptionsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">City-Owned Market</span>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">Stall Application Options</h3>
              </div>
              <button onClick={() => setSubmitOptionsModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer">✕</button>
            </div>

            <div className="p-6 space-y-3 text-xs">
              <button
                onClick={() => { window.location.href = '/citizen-portal-stall'; setSubmitOptionsModal(false); }}
                className="w-full text-left bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex items-center justify-between transition-all shadow-xs group cursor-pointer"
              >
                <div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-blue-700">New Stall Application</h4>
                  <p className="text-[11px] text-slate-500">Apply for vacant public market stalls</p>
                </div>
                <span className="text-sm font-bold text-slate-400 group-hover:text-blue-700">&rarr;</span>
              </button>
            </div>

            <div className="flex justify-between items-center px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs">
              <button onClick={() => { setSubmitOptionsModal(false); setMarketCategoryModal('cityOwned'); }} className="font-semibold text-slate-600 hover:underline cursor-pointer">
                &larr; Back to Menu
              </button>
              <button onClick={() => setSubmitOptionsModal(false)} className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded font-semibold hover:bg-slate-100 cursor-pointer">Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default MarketVendorsHub;