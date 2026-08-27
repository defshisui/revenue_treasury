// src/components/TreasuryHeader.tsx
import { useState, useRef, useEffect, type Dispatch, type SetStateAction } from "react";
import { useNavigate } from "react-router-dom";

import type { Role } from "../types/treasury";
import { useTheme } from "./ThemeContext";
import { API_BASE_URL } from "../config/api";

interface TreasuryHeaderProps {
  activeRole: Role;
  setActiveRole: Dispatch<SetStateAction<Role>>;
  notify: (message: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: Dispatch<SetStateAction<boolean>>;
}

interface AppNotification {
  id: string;
  message: string;
  time: string;
  read: boolean;
}

export default function TreasuryHeader({
  activeRole,
  notify,
  isCollapsed,
}: TreasuryHeaderProps) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotifMenuOpen, setIsNotifMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Keep track of read notification IDs so they don't reset when polling fetches fresh data
  const readIdsRef = useRef<Set<string>>(new Set());

  // Updated state to include avatar
  const [adminUser, setAdminUser] = useState<{ fullname: string; firstName: string; initials: string; avatar: string | null; } | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

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

  // Fetch and filter Notifications based on Role
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/audit-logs`);
        if (res.ok) {
          const data = await res.json();
          const logs = Array.isArray(data) ? data : (data.logs || []);

          const filtered = logs.filter((log: any) => {
            const isAccountRelated = log.module === 'User Management' || log.action?.includes('USER_') || log.action?.includes('LOGIN');
            // Admin gets account-related notifications. Audit/Treasury gets everything else.
            if (activeRole.toLowerCase() === 'admin') {
              return isAccountRelated;
            } else {
              return !isAccountRelated;
            }
          });

          setNotifications(filtered.slice(0, 10).map((log: any) => ({
            id: log.id,
            message: log.details || log.action,
            time: log.timestamp || "Recently",
            // Check if this ID was previously marked as read
            read: readIdsRef.current.has(log.id)
          })));
        } else {
          throw new Error("Failed to fetch logs");
        }
      } catch (e) {
        // Mock Fallback Data if backend is unavailable
        const mockLogs = [
          { id: '1', module: 'User Management', message: 'System User changed their password.', time: '2 mins ago' },
          { id: '2', module: 'User Management', message: 'Admin archived account for john.doe', time: '1 hour ago' },
          { id: '3', module: 'User Management', message: 'New personnel logged into the system.', time: '2 hours ago' },
          { id: '4', module: 'Tax Assessment', message: 'New Business Tax Assessment filed (TRK-9182)', time: '3 hours ago' },
          { id: '5', module: 'Property Tax', message: 'Payment received for Property PIN-123', time: '5 hours ago' },
          { id: '6', module: 'Appointments', message: 'Citizen cancelled their appointment schedule.', time: '1 day ago' },
        ];

        const filtered = mockLogs.filter(log => {
          const isAccountRelated = log.module === 'User Management';
          return activeRole.toLowerCase() === 'admin' ? isAccountRelated : !isAccountRelated;
        });

        setNotifications(filtered.map(log => ({
          ...log,
          read: readIdsRef.current.has(log.id) // Ensure mock data respects the read status too
        })));
      }
    };

    fetchNotifications();

    // Poll every 60 seconds
    const intervalId = setInterval(fetchNotifications, 60000);
    return () => clearInterval(intervalId);
  }, [activeRole]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAllAsRead = () => {
    setNotifications(prev => {
      const updated = prev.map(n => {
        readIdsRef.current.add(n.id); // Save the ID to the reference set
        return { ...n, read: true };
      });
      return updated;
    });
  };

  const handleViewAll = () => {
    markAllAsRead(); // Mark all as read to remove the red dot
    setIsNotifMenuOpen(false); // Close the dropdown
    // If you have a dedicated notifications page, you could add:
    // navigate('/notifications');
  };

  const unreadCount = notifications.filter(n => !n.read).length;

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

        {/* Notification Dropdown Container */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setIsNotifMenuOpen(v => !v)}
            className="relative p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mr-1 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {/* Unread Badge indicator */}
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 border border-white dark:border-slate-900"></span>
            )}
          </button>

          {isNotifMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-2 z-50 overflow-hidden flex flex-col max-h-[28rem]">
              <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  {activeRole.toLowerCase() === 'admin' ? 'Security Alerts' : 'System Notifications'}
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-slate-500 dark:text-slate-400 italic">
                    No new notifications.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`px-4 py-3 transition-colors ${notif.read ? 'bg-transparent' : 'bg-blue-50/50 dark:bg-blue-950/20'}`}
                      >
                        <p className={`text-xs ${notif.read ? 'text-slate-600 dark:text-slate-400' : 'text-slate-900 dark:text-slate-200 font-medium'}`}>
                          {notif.message}
                        </p>
                        <span className="block text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-mono">
                          {notif.time}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* View All Button */}
              {notifications.length > 0 && (
                <div className="border-t border-slate-100 dark:border-slate-800 p-2 bg-white dark:bg-slate-900">
                  <button
                    onClick={handleViewAll}
                    className="w-full text-center text-xs font-semibold text-blue-600 dark:text-blue-400 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                  >
                    View All Notifications
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

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
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium capitalize">
                {activeRole.replace('-', ' ')}
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
                  localStorage.removeItem('currentUser');
                  localStorage.removeItem('user');
                  sessionStorage.removeItem('currentUser');
                  sessionStorage.removeItem('user');
                  notify("You have been logged out.");
                  navigate("/", { replace: true });
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