import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import logoSystem from '../assets/logo-system.png';
import { API_BASE_URL } from '../config/api';
import { initCitizenSecurity, getEncryptedItem } from './citizenSecurity';

interface CitizenLayoutProps {
  children: React.ReactNode;
  activeTitle?: string;
  activeNav?: string;
}

export default function CitizenLayout({
  children,
  activeTitle = 'Help & Service Guide',
  activeNav = 'guide',
}: CitizenLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // Live clock
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');

  // Notifications
  const [notifications, setNotifications] = useState<
    { id: string | number; title: string; desc: string; time: string; link: string; unread: boolean }[]
  >([]);

  // Dark mode initialized from localStorage
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('citizenDarkMode');
    if (saved !== null) {
      return saved === '1';
    }
    return document.documentElement.classList.contains('dark');
  });

  // Signed-in citizen
  const [user, setUser] = useState<{
    fullname: string;
    email: string;
    initials: string;
    firstName: string;
    avatar?: string | null;
  }>({
    fullname: 'Citizen User',
    email: 'citizen@govserve.gov.ph',
    initials: 'CU',
    firstName: 'CITIZEN',
    avatar: null,
  });

  // Load the signed-in citizen's session (encrypted storage first, then plain fallback)
  useEffect(() => {
    const cleanupSecurity = initCitizenSecurity();

    const checkUserSession = async () => {
      const encData = (await getEncryptedItem('currentUser')) || (await getEncryptedItem('user'));
      if (encData && typeof encData === 'object') {
        const target =
          (encData as any).user && typeof (encData as any).user === 'object' ? (encData as any).user : encData;
        const fullName = target.fullname || target.name || target.fullName || target.firstName || target.email;
        if (fullName) {
          const email = target.email || '';
          const nameParts = String(fullName).trim().split(' ');
          const firstName = nameParts[0];
          const initials =
            nameParts.length > 1
              ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
              : nameParts[0].slice(0, 2).toUpperCase();
          return { fullname: String(fullName), email, firstName, initials, avatar: target.avatar || null };
        }
      }

      const rawData =
        localStorage.getItem('currentUser') ||
        localStorage.getItem('user') ||
        sessionStorage.getItem('currentUser') ||
        sessionStorage.getItem('user');
      if (!rawData) return null;
      try {
        const parsed = JSON.parse(rawData);
        const target = parsed.user && typeof parsed.user === 'object' ? parsed.user : parsed;
        const fullName = target.fullname || target.name || target.fullName || target.firstName || target.email;
        if (!fullName) return null;
        const email = target.email || '';
        const nameParts = String(fullName).trim().split(' ');
        const firstName = nameParts[0];
        const initials =
          nameParts.length > 1
            ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
            : nameParts[0].slice(0, 2).toUpperCase();
        return { fullname: String(fullName), email, firstName, initials, avatar: target.avatar || null };
      } catch {
        return null;
      }
    };

    checkUserSession().then((result) => {
      if (result) setUser(result);
    });

    const handleProfileUpdated = () => {
      checkUserSession().then((result) => {
        if (result) setUser(result);
      });
    };
    window.addEventListener('profileUpdated', handleProfileUpdated);

    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdated);
      cleanupSecurity();
    };
  }, []);

  // Sync Dark Mode state on mount & ensure html class matches
  useEffect(() => {
    const saved = localStorage.getItem('citizenDarkMode');
    const shouldBeDark = saved !== null ? saved === '1' : document.documentElement.classList.contains('dark');
    setIsDarkMode(shouldBeDark);
    if (shouldBeDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Load and persist notifications for the citizen user
  useEffect(() => {
    if (!user.email) return;
    const storageKey = `citizen_notifications_${user.email.toLowerCase().trim()}`;
    const stored = localStorage.getItem(storageKey);
    let list: { id: string | number; title: string; desc: string; time: string; link: string; unread: boolean }[] = [];
    if (stored) {
      try {
        list = JSON.parse(stored);
      } catch {
        list = [];
      }
    }

    if (!list || list.length === 0) {
      list = [
        {
          id: 1,
          title: 'Account Registered',
          desc: 'Your citizen tax portal account has been verified and activated.',
          time: 'Today',
          link: '/edit-profile',
          unread: true,
        },
        {
          id: 2,
          title: '2026 Tax Declaration Notice',
          desc: 'Annual business tax and real property assessment payments are now available.',
          time: 'Today',
          link: '/business-tax-assessment',
          unread: true,
        },
        {
          id: 3,
          title: 'Market Stall & Hawker Services',
          desc: 'Submit lease applications and review active permits directly online.',
          time: 'Yesterday',
          link: '/citizen-portal-stall-status',
          unread: false,
        },
      ];
      localStorage.setItem(storageKey, JSON.stringify(list));
    }
    setNotifications(list);
  }, [user.email]);

  // Live clock, updated every second
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
      );
      setCurrentDate(now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Close the profile / notifications dropdowns when clicking outside them
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('citizenDarkMode', next ? '1' : '0');
      return next;
    });
  };

  const handleLogout = () => {
    const userName = user.fullname || user.email || 'Citizen User';
    const userEmail = user.email || 'Unknown';
    const auditPayload = JSON.stringify({
      auditId: `AUD-${Math.floor(100000 + Math.random() * 900000)}`,
      user: userName,
      role: 'Citizen',
      module: 'Authentication',
      action: 'User Logged Out',
      severity: 'INFO',
      ipAddress: '127.0.0.1',
      userAgent: navigator.userAgent,
      previousData: `Active session for ${userEmail}`,
      newData: 'Session terminated / Logged out',
      timestamp: new Date().toISOString(),
    });
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([auditPayload], { type: 'application/json' });
        navigator.sendBeacon(`${API_BASE_URL}/audit-logs`, blob);
      } else {
        fetch(`${API_BASE_URL}/audit-logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: auditPayload,
          keepalive: true,
        }).catch(() => { });
      }
    } catch {
      // best-effort audit log only
    }
    localStorage.removeItem('currentUser');
    localStorage.removeItem('user');
    localStorage.removeItem('__enc_currentUser');
    localStorage.removeItem('__enc_user');
    localStorage.removeItem('token');
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('user');
    setIsProfileDropdownOpen(false);
    navigate('/');
  };

  // Navigation Items matching the Revenue & Treasury system
  const navItems = [
    {
      id: 'guide',
      label: 'Help & Service Guide',
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      path: '/citizen-portal',
    },
    {
      id: 'rpt',
      label: 'Real Property Tax',
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      path: '/citizen-rpt',
      subItems: [
        { label: 'Proceed and Pay Online', path: '/citizen-rpt' },
      ],
    },
    {
      id: 'btax',
      label: 'Business Tax',
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      path: '/business-tax-assessment',
      subItems: [
        { label: 'Proceed and Pay Online', path: '/business-tax-assessment' },
        { label: 'Appointment', path: '/business-tax-assessment?tab=appointments' },
        { label: 'Tax Bill Number and O.R. Number Verification', path: '/business-tax-assessment?tab=verify' },
      ],
    },
    {
      id: 'market',
      label: 'Market & Vendors',
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      path: '/citizen-portal-stall-status',
      subItems: [
        { label: 'Stall Applications & Status', path: '/citizen-portal-stall-status' },
        { label: 'Apply for New Stall', path: '/citizen-portal-stall' },
        { label: 'Manage Stalls & Payments', path: '/citizen-portal-stall-manage-account' },
        { label: 'Hawkers & Street Vendors Registration', path: '/hawker-application' },
      ],
    },
  ];

  // Submenu open states
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);

  const toggleSubmenu = (menuId: string) => {
    setOpenSubmenu((prev) => (prev === menuId ? null : menuId));
  };

  useEffect(() => {
    for (const item of navItems) {
      if (
        item.path === location.pathname ||
        item.subItems?.some((s) => {
          if (s.path.includes('?')) {
            const [subRoute, subQuery] = s.path.split('?');
            return location.pathname === subRoute && location.search.includes(subQuery);
          }
          return s.path === location.pathname;
        })
      ) {
        setOpenSubmenu(item.id);
        break;
      }
    }
  }, [location.pathname, location.search]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-['Segoe_UI',Tahoma,Geneva,Verdana,sans-serif]">
      {/* ===================== SIDEBAR ===================== */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-[#0b132b] text-slate-300 transition-all duration-300 ease-in-out border-r border-[#1c284f] ${isSidebarCollapsed ? 'w-20' : 'w-64'
          } ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        {/* Brand / Logo Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-[#1c284f] h-18">
          <div
            onClick={() => navigate('/citizen-portal')}
            className="flex items-center gap-3 cursor-pointer overflow-hidden"
          >
            <div className="w-10 h-10 rounded-full bg-white/10 p-1 flex items-center justify-center border border-white/20 shrink-0 shadow-inner">
              <img
                src={logoSystem}
                alt="GovServe Seal"
                className="w-8 h-8 object-contain"
              />
            </div>
            {!isSidebarCollapsed && (
              <div className="flex flex-col truncate">
                <span className="font-extrabold text-base tracking-wide text-white leading-tight">
                  GovServe
                </span>
                <span className="text-[10px] font-semibold text-blue-400 tracking-wider uppercase">
                  Citizen Portal
                </span>
              </div>
            )}
          </div>

          {/* Desktop Collapse Toggle */}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden md:flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${isSidebarCollapsed ? 'rotate-180' : ''
                }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-700">
          {navItems.map((item) => {
            const isActive = activeNav === item.id || (item.path && location.pathname === item.path);
            const hasSubmenu = Boolean(item.subItems && item.subItems.length > 0);
            const isSubmenuOpen = openSubmenu === item.id;

            return (
              <div key={item.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    if (hasSubmenu) {
                      toggleSubmenu(item.id);
                    }
                    if (item.path) {
                      navigate(item.path);
                      setIsMobileMenuOpen(false);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${isActive
                    ? 'bg-[#1a3885] text-white shadow-md shadow-blue-950/40'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  title={isSidebarCollapsed ? item.label : undefined}
                >
                  <div className="flex items-center gap-3 truncate">
                    <span className={isActive ? 'text-blue-300' : 'text-slate-400 group-hover:text-blue-300'}>
                      {item.icon}
                    </span>
                    {!isSidebarCollapsed && (
                      <span className="truncate tracking-wide">{item.label}</span>
                    )}
                  </div>

                  {!isSidebarCollapsed && (
                    <div className="flex items-center">
                      {hasSubmenu ? (
                        <svg
                          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isSubmenuOpen ? 'rotate-180 text-white' : ''
                            }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      ) : isActive ? (
                        <svg
                          className="w-3.5 h-3.5 text-blue-200"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="3"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      ) : null}
                    </div>
                  )}
                </button>

                {/* Dropdown sub-items */}
                {hasSubmenu && isSubmenuOpen && !isSidebarCollapsed && (
                  <div className="pl-9 pr-2 py-1.5 space-y-1.5">
                    {item.subItems?.map((sub, sIdx) => {
                      const isSubActive = (() => {
                        if (sub.path.includes('?')) {
                          const [subRoute, subQuery] = sub.path.split('?');
                          if (location.pathname !== subRoute) return false;
                          const subParams = new URLSearchParams(subQuery);
                          const currentParams = new URLSearchParams(location.search);
                          let matches = true;
                          subParams.forEach((v, k) => {
                            if (currentParams.get(k) !== v) matches = false;
                          });
                          return matches;
                        }
                        if (location.pathname === sub.path) {
                          const currentParams = new URLSearchParams(location.search);
                          return !currentParams.has('tab');
                        }
                        return false;
                      })();

                      return (
                        <button
                          key={sIdx}
                          type="button"
                          onClick={() => {
                            navigate(sub.path);
                            setIsMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-lg text-xs transition-all cursor-pointer truncate ${isSubActive
                            ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/30 ring-1 ring-blue-400'
                            : 'text-slate-300 hover:text-white hover:bg-white/10 font-medium'
                            }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${isSubActive ? 'bg-white shadow-xs' : 'bg-slate-500'
                              }`}
                          />
                          <span className="truncate">{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* HISTORIES HEADER */}
          <div className="pt-5 pb-1">
            {!isSidebarCollapsed ? (
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Histories
              </p>
            ) : (
              <div className="border-t border-slate-700/60 my-2" />
            )}
          </div>

          {/* Application History Link */}
          <button
            type="button"
            onClick={() => {
              navigate('/application-history');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${location.pathname === '/application-history' || activeNav === 'history'
              ? 'bg-[#1a3885] text-white shadow-md'
              : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            title="Application History"
          >
            <svg
              className="w-5 h-5 shrink-0 text-slate-400 group-hover:text-blue-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {!isSidebarCollapsed && (
              <span className="truncate tracking-wide">Application History</span>
            )}
          </button>

          {/* Manage Profile Link */}
          <button
            type="button"
            onClick={() => {
              navigate('/edit-profile');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${location.pathname === '/edit-profile'
              ? 'bg-[#1a3885] text-white shadow-md'
              : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            title="My Profile & Security"
          >
            <svg
              className="w-5 h-5 shrink-0 text-slate-400 group-hover:text-blue-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {!isSidebarCollapsed && (
              <span className="truncate tracking-wide">Citizen Profile</span>
            )}
          </button>
        </div>

        {/* User Card at Bottom of Sidebar */}
        <div className="p-3 border-t border-[#1c284f] bg-[#070e22]">
          <div className="flex items-center gap-3 px-1 py-1">
            <div className="w-9 h-9 rounded-full bg-linear-to-tr from-blue-600 to-indigo-500 text-white font-extrabold text-xs flex items-center justify-center shrink-0 border border-white/20">
              {user.avatar ? (
                <img src={user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                user.initials
              )}
            </div>
            {!isSidebarCollapsed && (
              <div className="truncate flex-1">
                <p className="text-xs font-bold text-white truncate leading-tight">
                  {user.fullname}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {user.email}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      {/* ===================== MAIN CONTENT WRAPPER ===================== */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 h-screen overflow-hidden ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'
          }`}
      >
        {/* ===================== TOP BAR ===================== */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between shrink-0 z-30 shadow-xs">
          {/* Left: Mobile Toggle & Breadcrumb Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <h1 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 tracking-tight">
              {activeTitle}
            </h1>
          </div>

          {/* Right: Clock, Dark Mode, Bell, User Pill */}
          <div className="flex items-center gap-3 sm:gap-5">
            {/* Live Clock & Date */}
            <div className="hidden sm:flex flex-col text-right pr-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 font-mono tracking-tight">
                {currentTime || '09:32:48 PM'}
              </span>
              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                {currentDate || 'Sat, Sep 12'}
              </span>
            </div>

            {/* Dark / Light Toggle */}
            <button
              type="button"
              onClick={toggleDarkMode}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
              title="Toggle Dark Mode"
            >
              {isDarkMode ? (
                <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {/* Notification Bell */}
            <div className="relative" ref={notificationsRef}>
              <button
                type="button"
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="relative p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
                title="Notifications"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {notifications.some((n) => n.unread) && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-900" />
                )}
              </button>

              {/* Notification Dropdown */}
              {isNotificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                      Notifications
                    </span>
                    <button
                      onClick={() => {
                        setNotifications((prev) => {
                          const updated = prev.map((n) => ({ ...n, unread: false }));
                          if (user.email) {
                            localStorage.setItem(
                              `citizen_notifications_${user.email.toLowerCase().trim()}`,
                              JSON.stringify(updated)
                            );
                          }
                          return updated;
                        });
                      }}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                    >
                      Mark all as read
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">
                        No notifications at this time
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => {
                            navigate(n.link);
                            setIsNotificationsOpen(false);
                          }}
                          className={`p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer flex gap-3 ${n.unread ? 'bg-blue-50/40 dark:bg-blue-950/30' : ''
                            }`}
                        >
                          <div className="w-2 h-2 mt-1.5 rounded-full shrink-0 bg-blue-600" />
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{n.title}</p>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500">{n.time}</span>
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                              {n.desc}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Greeting & Avatar Badge */}
            <div className="relative" ref={profileDropdownRef}>
              <button
                type="button"
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer group"
              >
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 hidden md:inline">
                  Hi, {user.firstName || 'RENZ'}
                </span>
                <div className="w-8 h-8 rounded-full bg-[#1e40af] text-white font-extrabold text-xs flex items-center justify-center shadow-xs">
                  {user.avatar ? (
                    <img src={user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    user.initials
                  )}
                </div>
              </button>

              {/* Profile Dropdown */}
              {isProfileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100 leading-tight">
                      {user.fullname}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {user.email}
                    </p>
                    <span className="inline-block mt-2 px-2 py-0.5 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 text-[10px] font-bold rounded-md border border-blue-200 dark:border-blue-900">
                      Verified Citizen
                    </span>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-1">
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2 cursor-pointer"
                    >
                      <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ===================== SCROLLABLE CONTENT BODY ===================== */}
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 space-y-8">
          {children}
        </main>
      </div>
    </div>
  );
}