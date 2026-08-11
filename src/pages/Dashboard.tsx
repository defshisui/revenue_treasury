import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { FormEvent } from "react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isErrorState, setIsErrorState] = useState(false);
  const navigate = useNavigate();

  // Timer effect to count down backend-enforced lockout period
  useEffect(() => {
    if (timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (timeLeft > 0) return;

    setIsLoading(true);
    setIsErrorState(false);
    setErrorMessage("");

    try {
      // Connect to your secure backend endpoint
      const response = await fetch("https://your-backend-api.com/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Successful login
        setIsLoading(false);
        navigate("/legacy-treasury");
      } else {
        // Handle failures & server-enforced lockouts
        setIsErrorState(true);
        setErrorMessage(data.message || "Invalid credentials.");

        if (response.status === 429 && data.retryAfterSeconds) {
          // Server dictates the exact countdown, preventing browser refresh bypasses
          setTimeLeft(data.retryAfterSeconds);
        }

        setTimeout(() => {
          setIsLoading(false);
          setIsErrorState(false);
        }, 1000);
      }
    } catch (error) {
      setIsLoading(false);
      setIsErrorState(true);
      setErrorMessage("Network error. Please try again later.");
    }
  };

  const isLockedOut = timeLeft > 0;

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    return `${mins}m ${secs}s`;
  };

  return (
    <main className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-2 bg-white relative overflow-x-hidden">
      {/* Left Branding Panel */}
      <section className="flex flex-col justify-between p-6 sm:p-10 lg:p-12 bg-blue-950 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('src/assets/logo-system.png')] bg-cover bg-left opacity-20 lg:opacity-30 z-0" aria-hidden="true" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1),transparent_50%)] pointer-events-none" />
        
        <div className="z-10">
          <span className="text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.3em] font-semibold text-white">
            Revenue Management System
          </span>
        </div>

        <div className="max-w-lg z-10 my-8 lg:my-0">
          <h1 className="text-2xl sm:text-3xl xl:text-5xl font-extrabold leading-tight tracking-tight">
            Municipal Treasury
            <span className="block text-white mt-1 text-xl sm:text-2xl xl:text-4xl">& Revenue Management System</span>
          </h1>
          <p className="mt-3 sm:mt-4 text-blue-200 text-xs sm:text-sm xl:text-base leading-relaxed">
            A centralized digital platform for securely managing local government revenue services, taxpayer accounts, and treasury records.
          </p>
        </div>

        <div className="text-[10px] sm:text-xs text-blue-200 tracking-wider uppercase font-medium z-10">
          Official Government Portal
        </div>
      </section>

      {/* Right Login Form Panel */}
      <section className="flex items-center justify-center p-6 sm:p-10 lg:p-12 bg-white relative w-full">
        <div 
          className={`w-full max-w-md space-y-6 sm:space-y-8 bg-white border border-slate-200 p-6 sm:p-8 rounded-2xl shadow-xl transition-all duration-700 ease-in-out ${
            isLoading 
              ? `absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full! w-32! h-32! p-0! flex flex-col items-center justify-center overflow-hidden shadow-xl scale-110 ${
                  isErrorState 
                    ? "border-rose-600 shadow-rose-600/30 animate-[shake_0.2s_ease-in-out_infinite]" 
                    : "border-blue-600 shadow-blue-600/30"
                }` 
              : ""
          }`}
        >
          {isLoading ? (
            <div className="flex flex-col items-center justify-center space-y-2">
              {isErrorState ? (
                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-xl animate-bounce">
                  ✕
                </div>
              ) : (
                <>
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-semibold text-slate-700 tracking-wider">LOADING</span>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-1 sm:space-y-2 text-center lg:text-left">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Sign in to your account</h2>
                <p className="text-xs sm:text-sm text-slate-500">Enter your credentials to access the municipal portal.</p>
              </div>

              {errorMessage && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 sm:p-4 rounded-xl text-xs sm:text-sm space-y-1">
                  <p className="font-semibold">{errorMessage}</p>
                  {isLockedOut && (
                    <p>Please try again in <span className="font-mono font-bold">{formatTime(timeLeft)}</span>.</p>
                  )}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4 sm:space-y-6">
                <div className="space-y-1">
                  <label className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-700">Email Address</label>
                  <input 
                    type="email" 
                    required 
                    disabled={isLockedOut}
                    placeholder="name@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 disabled:opacity-50 transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-700">Password</label>
                  <input 
                    type="password" 
                    required 
                    disabled={isLockedOut}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 disabled:opacity-50 transition-colors"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={isLockedOut}
                  className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 text-sm shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
                >
                  Sign In →
                </button>
              </form>

              <div className="text-center pt-2">
                <p className="text-[11px] sm:text-xs text-slate-400">
                  Need access or assistance? Contact your system administrator.
                </p>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}