import { useState, useEffect, useRef } from 'react';
import type { FC } from 'react';
import logoSystem from '../assets/logo-system.png';
import { API_BASE_URL } from '../config/api';
import { initCitizenSecurity, getEncryptedItem } from './citizenSecurity';
import SessionInactivityModal from '../components/SessionInactivityModal';

export const UnifiedHeader: FC = () => {
    const [user, setUser] = useState<{ fullname: string; email: string; initials: string; firstName: string } | null>(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const cleanupSecurity = initCitizenSecurity();
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');

        const checkUserSession = () => {
            const encData = getEncryptedItem('currentUser') || getEncryptedItem('user');
            if (encData && typeof encData === 'object') {
                const target = (encData as any).user && typeof (encData as any).user === 'object' ? (encData as any).user : encData;
                const fullName = target.fullname || target.name || target.fullName || target.firstName || target.email;
                if (fullName) {
                    const email = target.email || "";
                    const nameParts = String(fullName).trim().split(" ");
                    const firstName = nameParts[0];
                    const initials = nameParts.length > 1
                        ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
                        : nameParts[0].slice(0, 2).toUpperCase();
                    return { fullname: String(fullName), email, firstName, initials };
                }
            }

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
            } catch {
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
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            cleanupSecurity();
        };
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
            }).catch(() => {});
        }
        localStorage.removeItem('currentUser');
        localStorage.removeItem('user');
        localStorage.removeItem('__enc_currentUser');
        localStorage.removeItem('__enc_user');
        localStorage.removeItem('token');
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('user');
        setUser(null);
        setIsDropdownOpen(false);
        window.location.href = '/';
    };

    return (
        <>
        <header className="w-full bg-white border-b border-slate-200 shadow-xs z-50 relative">
            <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => { window.location.href = '/citizen-portal'; }}>
                        <div className="p-1.5 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center justify-center">
                            <img
                                src={logoSystem}
                                alt="System Logo"
                                className="h-8 w-8 object-contain"
                            />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-extrabold text-lg tracking-tight text-slate-900 leading-tight">
                                Gov Serve
                            </span>
                            <span className="text-[10px] font-bold text-blue-700 tracking-wider uppercase">
                                Unified Portal
                            </span>
                        </div>
                    </div>
                </div>
                <div className="hidden md:flex items-center space-x-6 text-xs font-semibold text-slate-600">
                    <span className="hover:text-blue-700 cursor-pointer" onClick={() => window.location.href = '/citizen-portal'}>HOME</span>
                    <div className="relative group py-2">
                        <span className="hover:text-blue-700 cursor-pointer flex items-center gap-1 select-none">
                            SERVICES ▾
                        </span>
                        <div className="absolute left-0 top-full h-2 w-full"></div>
                        <div className="absolute left-0 top-[calc(100%+8px)] w-60 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-1 group-hover:translate-y-0">
                            <button
                                onClick={() => window.location.href = '/citizen-portal'}
                                className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors cursor-pointer"
                            >
                                Home
                            </button>
                            <button
                                onClick={() => window.location.href = '/market-vendor-tab'}
                                className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors cursor-pointer"
                            >
                                Market &amp; Vendors Hub
                            </button>
                            <button
                                onClick={() => window.location.href = '/citizen-rpt'}
                                className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors cursor-pointer"
                            >
                                Real Property Tax Hub
                            </button>
                            <button
                                onClick={() => window.location.href = '/business-tax-assessment'}
                                className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors cursor-pointer"
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
                                className="flex items-center space-x-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs group"
                            >
                                <span className="text-xs font-extrabold text-slate-800 tracking-tight">
                                    Hi, {user.firstName}
                                </span>
                                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-[10px] shadow-sm tracking-wider">
                                    {user.initials}
                                </div>
                            </button>
                            {isDropdownOpen && (
                                <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50">
                                    <div className="px-4 py-2 border-b border-slate-100 mb-1">
                                        <p className="text-xs font-bold text-slate-900 truncate">{user.fullname}</p>
                                        <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setIsDropdownOpen(false);
                                            window.location.href = '/edit-profile';
                                        }}
                                        className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors cursor-pointer"
                                    >
                                        Edit Profile
                                    </button>
                                    <button
                                        onClick={handleLogout}
                                        className="w-full text-left px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer border-t border-slate-100 mt-1 pt-2"
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
        </header>
        <SessionInactivityModal idleTimeoutMinutes={15} countdownSeconds={60} />
    </>
    );
};