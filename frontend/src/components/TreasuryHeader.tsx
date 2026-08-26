// src/components/TreasuryHeader.tsx
import { useState, useRef, useEffect, type Dispatch, type SetStateAction } from "react";
import { useNavigate } from "react-router-dom";

import type { Role } from "../types/treasury";
import { useTheme } from "./ThemeContext";

interface TreasuryHeaderProps {
  activeRole: Role;
  setActiveRole: Dispatch<SetStateAction<Role>>;
  notify: (message: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: Dispatch<SetStateAction<boolean>>;
}

export default function TreasuryHeader({
  activeRole,
  notify,
  isCollapsed,
}: TreasuryHeaderProps) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  // Updated state to include avatar
  const [adminUser, setAdminUser] = useState<{ fullname: string; firstName: string; initials: string; avatar: string | null; } | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  // Fetch logged-in user details from local/session storage and listen for updates
  useEffect(() => {
    const checkAdminSession = () => {
      const rawData = localStorage.getItem('currentUser') ||
        localStorage.getItem('user') ||
        sessionStorage.getItem('currentUser') ||
        sessionStorage.getItem('user');

      if (!rawData) {
        setAdminUser(null);
        return;
      }

      try {
        const parsed = JSON.parse(rawData);
        const target = parsed.user && typeof parsed.user === 'object' ? parsed.user : parsed;

        const fullName = target.fullname || target.name || target.fullName || target.firstName || target.email;
        if (!fullName) return;

        // Retrieve avatar from storage
        const avatar = target.avatar || target.profile_picture || null;

        const nameParts = String(fullName).trim().split(" ");
        const firstName = nameParts[0];
        const initials = nameParts.length > 1
          ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
          : nameParts[0].slice(0, 2).toUpperCase();

        setAdminUser({ fullname: String(fullName), firstName, initials, avatar });
      } catch (e) {
        console.error("Failed to parse admin session", e);
        setAdminUser(null);
      }
    };

    // Initial check on mount
    checkAdminSession();

    // Listen for cross-tab storage changes and same-tab custom updates
    window.addEventListener('storage', checkAdminSession);
    window.addEventListener('profileUpdated', checkAdminSession);

    // Cleanup listeners on unmount
    return () => {
      window.removeEventListener('storage', checkAdminSession);
      window.removeEventListener('profileUpdated', checkAdminSession);
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header
      style={{
        width: isCollapsed ? "calc(100% - 80px)" : "calc(100% - 256px)",
      }}
      className="fixed top-0 right-0 z-40 h-16 px-6 flex items-center justify-between bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 transition-all duration-300"
    >
      {/* Left side spacer / branding placeholder */}
      <div className="flex items-center">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Treasury Portal
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364-6.364-1.414 1.414M7.05 16.95l-1.414 1.414m12.728 0-1.414-1.414M7.05 7.05 5.636 5.636M12 8a4 4 0 100 8 4 4 0 000-8z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9 9 0 1019.354 14.354c.348.348.348.91 0 1z" />
            </svg>
          )}
        </button>

        {/* Notification */}
        <button
          type="button"
          className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mr-1 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </button>

        {/* Profile Dropdown Container */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsProfileMenuOpen((v) => !v)}
            className="flex items-center gap-2.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer shadow-xs"
          >
            {/* Dynamic Avatar or Initials */}
            <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-blue-600 text-[11px] font-bold text-white shadow-inner shrink-0">
              {adminUser?.avatar ? (
                <img src={adminUser.avatar} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                adminUser ? adminUser.initials : activeRole.charAt(0)
              )}
            </div>

            <div className="hidden md:flex flex-col items-start leading-none pr-2">
              {/* Dynamic Name based on Account Name */}
              <span className="text-[13px] font-bold text-slate-800 dark:text-white mb-0.5 truncate max-w-[120px]">
                {adminUser ? adminUser.firstName : activeRole}
              </span>
              {/* Uses the Active Role (e.g. Administrator) as the sub-title */}
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                {activeRole}
              </span>
            </div>
          </button>

          {/* Inline Dropdown Menu (Drops downwards) */}
          {isProfileMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 overflow-hidden">
              {/* Display full name in dropdown header */}
              {adminUser && (
                <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{adminUser.fullname}</p>
                </div>
              )}
              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  navigate("/profile", { state: { activeRole } });
                }}
                className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Profile Settings
              </button>
              <div className="border-t border-slate-100 dark:border-slate-800 my-1"></div>
              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  // Using your existing logout logic here
                  localStorage.removeItem('currentUser');
                  localStorage.removeItem('user');
                  sessionStorage.removeItem('currentUser');
                  sessionStorage.removeItem('user');
                  notify("You have been logged out.");
                  navigate("/login");
                }}
                className="w-full text-left px-4 py-2.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
              >
                Logout Account
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}