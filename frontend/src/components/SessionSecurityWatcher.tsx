import { useState, useEffect, useRef } from "react";
import { API_BASE_URL } from "../config/api";

interface ConcurrentAlert {
  id: string;
  time: string;
  browser: string;
  location: string;
}

export default function SessionSecurityWatcher() {
  const [loggedOffMessage, setLoggedOffMessage] = useState<string | null>(null);
  const [concurrentAlert, setConcurrentAlert] = useState<ConcurrentAlert | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionNotice, setResolutionNotice] = useState<string | null>(null);

  const isPollingRef = useRef(false);

  const performForceLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("session_id");
    localStorage.removeItem("currentUser");
    localStorage.removeItem("user");
    localStorage.removeItem("user_role");
    sessionStorage.clear();
    window.location.href = "/";
  };

  useEffect(() => {
    const checkSession = async () => {
      const token = localStorage.getItem("token");
      if (!token || isPollingRef.current) return;

      const sessionId = localStorage.getItem("session_id") || "";

      try {
        isPollingRef.current = true;
        const res = await fetch(`${API_BASE_URL}/auth/session-status?sessionId=${encodeURIComponent(sessionId)}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "x-session-id": sessionId,
          },
        });

        if (!res.ok && (res.status === 401 || res.status === 403)) {
          const data = await res.json().catch(() => ({}));
          if (data.loggedOff) {
            setLoggedOffMessage(data.message || "You have been logged off");
            return;
          }
        }

        const data = await res.json().catch(() => null);
        if (!data) return;

        if (data.loggedOff) {
          setLoggedOffMessage(data.message || "You have been logged off");
          return;
        }

        if (data.concurrentAlert) {
          setConcurrentAlert(data.concurrentAlert);
        }
      } catch (err) {
        // Network errors or backend restart - silent retry
      } finally {
        isPollingRef.current = false;
      }
    };

    // Initial check and interval every 4 seconds
    checkSession();
    const intervalId = setInterval(checkSession, 4000);
    return () => clearInterval(intervalId);
  }, []);

  const handleResolveConcurrent = async (action: "YES" | "NO") => {
    if (!concurrentAlert || isResolving) return;

    setIsResolving(true);
    const token = localStorage.getItem("token");

    try {
      await fetch(`${API_BASE_URL}/auth/resolve-concurrent-login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          alertId: concurrentAlert.id,
          action,
        }),
      });

      if (action === "YES") {
        setResolutionNotice("Owner identity verified. Additional login session permitted.");
        setTimeout(() => {
          setConcurrentAlert(null);
          setResolutionNotice(null);
        }, 2000);
      } else {
        setResolutionNotice("The other session has been logged off and denied access.");
        setTimeout(() => {
          setConcurrentAlert(null);
          setResolutionNotice(null);
        }, 2500);
      }
    } catch (err) {
      console.error("Failed to resolve concurrent login:", err);
      setConcurrentAlert(null);
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <>
      {/* Forced Logout Modal (When Archived or Revoked) */}
      {loggedOffMessage && (
        <div className="fixed inset-0 z-[99999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-100 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                <line x1="12" y1="2" x2="12" y2="12"></line>
              </svg>
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                You have been logged off
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {loggedOffMessage}
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={performForceLogout}
                className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-bold text-sm transition-all shadow-md cursor-pointer"
              >
                Return to Login
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Concurrent Login Prompt Modal */}
      {concurrentAlert && !loggedOffMessage && (
        <div className="fixed inset-0 z-[99998] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Security Alert: Concurrent Login Attempt
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Another device or browser has attempted to sign into your account.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 space-y-2.5">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Your account has tried to login with details:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/60">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Time</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{concurrentAlert.time}</span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/60">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Browser</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{concurrentAlert.browser}</span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/60">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Location</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{concurrentAlert.location}</span>
                </div>
              </div>
            </div>

            {resolutionNotice ? (
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-semibold text-center">
                {resolutionNotice}
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <p className="text-center font-bold text-sm text-slate-900 dark:text-white">
                  Is this you?
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={isResolving}
                    onClick={() => handleResolveConcurrent("YES")}
                    className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    Yes, it is me
                  </button>

                  <button
                    type="button"
                    disabled={isResolving}
                    onClick={() => handleResolveConcurrent("NO")}
                    className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs transition-all shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    No, log them off
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
