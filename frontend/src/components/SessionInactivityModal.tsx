import { useState, useEffect, useRef, useCallback } from 'react';
import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';

interface SessionInactivityModalProps {
  idleTimeoutMinutes?: number;
  countdownSeconds?: number;
}

export const SessionInactivityModal: FC<SessionInactivityModalProps> = ({
  idleTimeoutMinutes = 10,
  countdownSeconds = 60,
}) => {
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(countdownSeconds);
  const [hasSession, setHasSession] = useState(false);
  const navigate = useNavigate();

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isWarningOpenRef = useRef(false);

  useEffect(() => {
    const checkSession = () => {
      const data = localStorage.getItem('currentUser') ||
        localStorage.getItem('user') ||
        sessionStorage.getItem('currentUser') ||
        sessionStorage.getItem('user');
      setHasSession(!!data);
    };
    checkSession();
    window.addEventListener('storage', checkSession);
    return () => window.removeEventListener('storage', checkSession);
  }, []);

  useEffect(() => {
    isWarningOpenRef.current = isWarningOpen;
  }, [isWarningOpen]);

  const performLogout = useCallback(() => {
    const rawData = localStorage.getItem('currentUser') || localStorage.getItem('user');
    let userName = 'Admin User';
    let userEmail = 'Unknown';
    if (rawData) {
      try {
        const parsed = JSON.parse(rawData);
        const target = parsed.user && typeof parsed.user === 'object' ? parsed.user : parsed;
        userName = target.fullname || target.name || target.email || 'Admin User';
        userEmail = target.email || 'Unknown';
      } catch { }
    }

    const auditPayload = JSON.stringify({
      auditId: `AUD-${Math.floor(100000 + Math.random() * 900000)}`,
      user: userName,
      role: localStorage.getItem('user_role') || 'Admin',
      module: 'Authentication',
      action: 'Session Auto-Locked Due to Inactivity',
      severity: 'WARN',
      ipAddress: '127.0.0.1',
      userAgent: navigator.userAgent,
      previousData: `Active session for ${userEmail}`,
      newData: 'Session auto-terminated due to idle timeout',
      timestamp: new Date().toISOString(),
    });

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

    localStorage.removeItem('currentUser');
    localStorage.removeItem('user');
    localStorage.removeItem('user_role');
    localStorage.removeItem('token');
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('user');
    setIsWarningOpen(false);
    navigate('/', { replace: true });
  }, [navigate]);

  const startCountdown = useCallback(() => {
    setIsWarningOpen(true);
    setSecondsRemaining(countdownSeconds);

    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    countdownIntervalRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          performLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [countdownSeconds, performLogout]);

  const resetIdleTimer = useCallback(() => {
    if (isWarningOpenRef.current) return;

    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }

    const timeoutMs = idleTimeoutMinutes * 60 * 1000;
    idleTimerRef.current = setTimeout(() => {
      startCountdown();
    }, timeoutMs);
  }, [idleTimeoutMinutes, startCountdown]);

  const handleStayLoggedIn = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    setIsWarningOpen(false);
    setSecondsRemaining(countdownSeconds);
    resetIdleTimer();
  };

  useEffect(() => {

    if (!hasSession) {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      setIsWarningOpen(false);
      return;
    }

    const handleAdminShortcuts = (e: KeyboardEvent) => {
      if (e.key === 'F12') {
        e.preventDefault();
        return false;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        ['I', 'i', 'J', 'j', 'C', 'c', 'K', 'k'].includes(e.key)
      ) {
        e.preventDefault();
        return false;
      }
      if ((e.ctrlKey || e.metaKey) && ['U', 'u', 'S', 's'].includes(e.key)) {
        e.preventDefault();
        return false;
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];
    const handleUserActivity = () => {
      resetIdleTimer();
    };

    activityEvents.forEach((evt) => window.addEventListener(evt, handleUserActivity, { passive: true }));
    //document.addEventListener('keydown', handleAdminShortcuts);
    //document.addEventListener('contextmenu', handleContextMenu);

    resetIdleTimer();

    return () => {
      activityEvents.forEach((evt) => window.removeEventListener(evt, handleUserActivity));
      document.removeEventListener('keydown', handleAdminShortcuts);
      document.removeEventListener('contextmenu', handleContextMenu);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [resetIdleTimer, hasSession]);

  if (!isWarningOpen) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const percentage = ((countdownSeconds - secondsRemaining) / countdownSeconds) * 100;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-md p-6 sm:p-8 text-center relative overflow-hidden transform scale-100 transition-all">
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-100 dark:border-rose-900 flex items-center justify-center text-rose-600 mb-4 shadow-sm">
            <svg className="w-8 h-8 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <span className="text-[11px] font-black tracking-widest text-rose-600 uppercase bg-rose-50 dark:bg-rose-950/60 px-3 py-1 rounded-full border border-rose-200 dark:border-rose-900/60 mb-2">
            SECURITY INACTIVITY LOCKOUT
          </span>

          <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Session Expiring Soon
          </h3>

          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed max-w-sm">
            You have been inactive for a while. To protect municipal records and treasury data, you will be automatically logged out in:
          </p>

          <div className="my-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 w-full flex flex-col items-center justify-center">
            <div className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-rose-600 dark:text-rose-400">
              {formattedTime}
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-rose-500 to-amber-500 h-full transition-all duration-1000 ease-linear"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mt-2">
            <button
              onClick={performLogout}
              type="button"
              className="w-full py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer shadow-xs"
            >
              Log Out Now
            </button>
            <button
              onClick={handleStayLoggedIn}
              type="button"
              className="w-full py-3 px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-md shadow-blue-700/20 transition-all cursor-pointer hover:scale-[1.02]"
            >
              Stay Logged In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionInactivityModal;
