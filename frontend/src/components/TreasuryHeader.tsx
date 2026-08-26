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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

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
          className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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
          className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mr-1"
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
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white shadow-inner">
              {activeRole.charAt(0)}
            </div>

            <div className="hidden md:flex flex-col items-start leading-none pr-2">
              <span className="text-[13px] font-bold text-slate-800 dark:text-white mb-0.5">
                {activeRole}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                Staff
              </span>
            </div>
          </button>

          {/* Inline Dropdown Menu (Drops downwards) */}
          {isProfileMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 overflow-hidden">
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
                  notify("You have been logged out.");
                  navigate("/");
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