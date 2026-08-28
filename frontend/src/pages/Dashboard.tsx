import { useState, useEffect } from "react";
import { useLockout } from "../hooks/useLockout";
import { useLogin } from "../hooks/useLogin";
import { useRegister } from "../hooks/useRegister";

// This import ensures Vite correctly links to your dist/assets/logo-system-BmYEKQTP.png file during the build
import systemLogo from "../assets/logo-system.png";

export default function Login() {
  const [isRegistering, setIsRegistering] = useState(false);
  const { timeLeft, setTimeLeft, isLockedOut, formatTime } = useLockout();

  const {
    email, setEmail, password, setPassword, showPassword, setShowPassword,
    errorMessage, isErrorState, handleLogin
  } = useLogin(timeLeft, setTimeLeft);

  const {
    regStep, setRegStep, regEmail, setRegEmail, regPassword, setRegPassword,
    showRegPassword, setShowRegPassword, firstName, setFirstName,
    middleName, setMiddleName, lastName, setLastName, suffix, setSuffix,
    birthDate, setBirthDate, houseNoStreet, setHouseNoStreet,
    barangay, setBarangay, city, setCity, occupation, setOccupation,
    sex, setSex, mobileNumber, setMobileNumber, regMessage, setRegMessage,
    regSuccess, isWorkerNotice, setIsWorkerNotice,
    handleNextStep, handlePrevStep, handleFinalRegisterSubmit, handleWorkerClick
  } = useRegister(() => setIsRegistering(false));

  // ==========================================
  // PREVENT BACK BUTTON AFTER LOGOUT FIX
  // ==========================================
  useEffect(() => {
    // Push a state into the history stack so there's a "forward" state
    window.history.pushState(null, "", window.location.href);

    // When the user clicks "Back", intercept the popstate event and immediately push them back to the login page
    const handleBackButton = () => {
      window.history.pushState(null, "", window.location.href);
    };

    window.addEventListener("popstate", handleBackButton);

    // Cleanup listener when the component unmounts (e.g., after successful login)
    return () => {
      window.removeEventListener("popstate", handleBackButton);
    };
  }, []);

  return (
    <main className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-2 bg-[#F4F6F8]">
      <section className="flex flex-col justify-between p-8 sm:p-10 lg:p-12 bg-[#09101d] text-white relative overflow-hidden min-h-[450px] lg:min-h-screen">
        {/* Fixed Logo Location using React Import */}
        <div
          className="absolute inset-0 m-auto size-[480px] bg-contain bg-center bg-no-repeat opacity-15 pointer-events-none z-0"
          style={{ backgroundImage: `url(${systemLogo})` }}
          aria-hidden="true"
        />

        <div className="z-10">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">Revenue Collection & Treasury Services</h2>
          <p className="text-sm text-slate-400 font-medium mt-1">Republic of the Philippines • Local Government Unit</p>
        </div>
        <div className="max-w-md mx-auto text-center z-10 my-auto py-10">
          <h1 className="text-3xl sm:text-4xl xl:text-[44px] font-extrabold leading-[1.15] text-white tracking-tight">Revenue Collection & Treasury Services</h1>
          <p className="mt-5 text-sm sm:text-base text-slate-300 leading-relaxed max-w-sm mx-auto font-normal">
            A centralized digital platform for managing real property tax collection, business tax and regulatory fees, market stall rentals and billing
          </p>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-400 font-semibold tracking-wider uppercase z-10">
          <span>OFFICIAL LGU PORTAL</span>
          <span>Republic of the Philippines</span>
        </div>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-10 bg-[#F4F6F8] relative w-full overflow-y-auto">
        {!isRegistering ? (
          <div className="w-full max-w-[440px] bg-white rounded-3xl p-8 sm:p-10 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <div className="mb-7">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">Welcome Back</h2>
              <p className="text-sm text-slate-500 mt-1.5">Sign in to access your treasury dashboard</p>
            </div>

            {isLockedOut ? (
              <div role="alert" className="mb-5 bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl text-sm space-y-1">
                <p className="font-semibold">Multiple failed attempts detected.</p>
                <p>Please try again in <span className="font-mono font-bold">{formatTime(timeLeft)}</span>.</p>
              </div>
            ) : errorMessage ? (
              <div role="alert" className="mb-5 bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl text-sm font-semibold">
                {errorMessage}
              </div>
            ) : null}

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">EMAIL ADDRESS</label>
                <div className={`relative flex items-center bg-[#EBF2FE] rounded-2xl px-4 py-3.5 transition-all ${isErrorState ? 'ring-2 ring-rose-500' : 'focus-within:ring-2 focus-within:ring-blue-600'}`}>
                  <input type="email" required disabled={isLockedOut} placeholder="name@email.com" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none font-medium disabled:opacity-50" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">PASSWORD</label>
                </div>
                <div className={`relative flex items-center bg-[#EBF2FE] rounded-2xl px-4 py-3.5 transition-all ${isErrorState ? 'ring-2 ring-rose-500' : 'focus-within:ring-2 focus-within:ring-blue-600'}`}>
                  <input type={showPassword ? "text" : "password"} required disabled={isLockedOut} placeholder="••••••••••••••" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none font-medium pr-10 disabled:opacity-50" />
                  <button type="button" disabled={isLockedOut} onClick={() => setShowPassword(!showPassword)} className="absolute right-4 text-slate-500 hover:text-slate-800 text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={isLockedOut} className="w-full bg-[#2563EB] hover:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-2xl text-base shadow-md transition-all duration-200 cursor-pointer mt-4 disabled:opacity-40 disabled:cursor-not-allowed">
                Sign In
              </button>
            </form>

            <div className="mt-6 text-center border-t border-slate-100 pt-5">
              <p className="text-sm text-slate-600">
                Don't have an account?{" "}
                <button type="button" onClick={() => { setIsRegistering(true); setRegStep(1); setRegMessage(""); setIsWorkerNotice(false); }} className="font-bold text-blue-600 hover:text-blue-700 cursor-pointer underline underline-offset-2">
                  Register here
                </button>
              </p>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-xl bg-white rounded-3xl p-8 sm:p-10 shadow-[0_8px_30px_rgba(0,0,0,0.06)] my-6">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Citizen Registration</h2>
                <p className="text-xs text-slate-500 mt-0.5">Step {regStep} of 4: {regStep === 1 ? "Account Info" : regStep === 2 ? "Personal Details" : regStep === 3 ? "Address & Contact" : "Review Info"}</p>
              </div>
              <button type="button" onClick={() => { setIsRegistering(false); setRegStep(1); }} className="text-xs font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-xl transition-colors cursor-pointer border border-blue-200">
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-6">
              <div className={`h-1.5 rounded-full ${regStep >= 1 ? 'bg-blue-600' : 'bg-slate-200'}`} />
              <div className={`h-1.5 rounded-full ${regStep >= 2 ? 'bg-blue-600' : 'bg-slate-200'}`} />
              <div className={`h-1.5 rounded-full ${regStep >= 3 ? 'bg-blue-600' : 'bg-slate-200'}`} />
              <div className={`h-1.5 rounded-full ${regStep >= 4 ? 'bg-blue-600' : 'bg-slate-200'}`} />
            </div>

            {regMessage && (
              <div className={`mb-6 p-4 rounded-2xl text-sm ${regSuccess ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : isWorkerNotice ? 'bg-amber-50 border border-amber-200 text-amber-900 font-medium' : 'bg-rose-50 border border-rose-200 text-rose-800'}`}>
                <p className="font-bold">{regMessage}</p>
              </div>
            )}

            {regStep === 1 && (
              <form onSubmit={handleNextStep} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">EMAIL ADDRESS *</label>
                  <input type="email" required placeholder="name@email.com" value={regEmail} onChange={e => setRegEmail(e.target.value)} className="w-full bg-[#EBF2FE] rounded-2xl px-4 py-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium" />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">PASSWORD *</label>
                  <div className="relative flex items-center bg-[#EBF2FE] rounded-2xl px-4 py-3.5 focus-within:ring-2 focus-within:ring-blue-600 transition-all">
                    <input type={showRegPassword ? "text" : "password"} required placeholder="••••••••" value={regPassword} onChange={e => setRegPassword(e.target.value)} className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none font-medium pr-10" />
                    <button type="button" onClick={() => setShowRegPassword(!showRegPassword)} className="absolute right-4 text-slate-500 hover:text-slate-800 text-xs font-bold cursor-pointer">
                      {showRegPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <div className="pt-4 space-y-3">
                  <button type="submit" className="w-full bg-[#2563EB] hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-2xl text-base shadow-md transition-all duration-200 cursor-pointer">
                    Next: Personal Details →
                  </button>
                  <button type="button" onClick={handleWorkerClick} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-6 rounded-2xl text-xs transition-all duration-200 cursor-pointer">
                    Register as Worker
                  </button>
                </div>
              </form>
            )}

            {regStep === 2 && (
              <form onSubmit={handleNextStep} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">First Name *</label>
                    <input type="text" required placeholder="First Name" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full bg-[#EBF2FE] rounded-2xl px-4 py-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 font-semibold" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Middle Name</label>
                    <input type="text" placeholder="Middle Name" value={middleName} onChange={e => setMiddleName(e.target.value)} className="w-full bg-[#EBF2FE] rounded-2xl px-4 py-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 font-semibold" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Last Name *</label>
                    <input type="text" required placeholder="Last Name" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full bg-[#EBF2FE] rounded-2xl px-4 py-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 font-semibold" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Suffix</label>
                    <input type="text" placeholder="Jr., Sr., III" value={suffix} onChange={e => setSuffix(e.target.value)} className="w-full bg-[#EBF2FE] rounded-2xl px-4 py-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 font-semibold" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Birth Date *</label>
                    <input type="date" required value={birthDate} onChange={e => setBirthDate(e.target.value)} className="w-full bg-[#EBF2FE] rounded-2xl px-4 py-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 font-semibold cursor-pointer" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Sex *</label>
                    <select value={sex} onChange={e => setSex(e.target.value)} className="w-full bg-[#EBF2FE] rounded-2xl px-4 py-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 font-semibold cursor-pointer">
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Occupation</label>
                  <input type="text" placeholder="Occupation" value={occupation} onChange={e => setOccupation(e.target.value)} className="w-full bg-[#EBF2FE] rounded-2xl px-4 py-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 font-semibold" />
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={handlePrevStep} className="w-1/3 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-3.5 px-4 rounded-2xl text-sm transition-all cursor-pointer">
                    ← Back
                  </button>
                  <button type="submit" className="w-2/3 bg-[#2563EB] hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-2xl text-base shadow-md transition-all cursor-pointer">
                    Next: Address →
                  </button>
                </div>
              </form>
            )}

            {regStep === 3 && (
              <form onSubmit={handleNextStep} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">House No / Street *</label>
                  <input type="text" required placeholder="House No & Street" value={houseNoStreet} onChange={e => setHouseNoStreet(e.target.value)} className="w-full bg-[#EBF2FE] rounded-2xl px-4 py-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 font-semibold" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Barangay *</label>
                    <input type="text" required placeholder="Barangay" value={barangay} onChange={e => setBarangay(e.target.value)} className="w-full bg-[#EBF2FE] rounded-2xl px-4 py-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 font-semibold" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">City *</label>
                    <input type="text" required placeholder="City" value={city} onChange={e => setCity(e.target.value)} className="w-full bg-[#EBF2FE] rounded-2xl px-4 py-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 font-semibold" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Mobile Number (PH) * (Max 11 digits)</label>
                  <input type="text" required maxLength={11} placeholder="09123456789" value={mobileNumber} onChange={e => {
                    const val = e.target.value.replace(/\D/g, "");
                    if (val.length <= 11) setMobileNumber(val);
                  }} className="w-full bg-[#EBF2FE] rounded-2xl px-4 py-3.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 font-semibold tracking-wider" />
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={handlePrevStep} className="w-1/3 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-3.5 px-4 rounded-2xl text-sm transition-all cursor-pointer">
                    ← Back
                  </button>
                  <button type="submit" className="w-2/3 bg-[#2563EB] hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-2xl text-base shadow-md transition-all cursor-pointer">
                    Review Information →
                  </button>
                </div>
              </form>
            )}

            {regStep === 4 && (
              <div className="space-y-5">
                <div className="bg-[#F8FAFC] border-2 border-slate-300 rounded-3xl p-6 space-y-4 text-slate-900 shadow-sm">
                  <div className="pb-3 border-b border-slate-200">
                    <span className="block text-xs font-bold text-blue-700 uppercase tracking-wider">Email Address</span>
                    <span className="text-lg font-bold">{regEmail}</span>
                  </div>

                  <div className="pb-3 border-b border-slate-200">
                    <span className="block text-xs font-bold text-blue-700 uppercase tracking-wider">Mobile Number</span>
                    <span className="text-lg font-bold">{mobileNumber}</span>
                  </div>

                  <div className="pb-3 border-b border-slate-200">
                    <span className="block text-xs font-bold text-blue-700 uppercase tracking-wider">Full Name</span>
                    <span className="text-lg font-bold">{firstName} {middleName} {lastName} {suffix}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pb-3 border-b border-slate-200">
                    <div>
                      <span className="block text-xs font-bold text-blue-700 uppercase tracking-wider">Birth Date</span>
                      <span className="text-base font-bold">{birthDate}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-blue-700 uppercase tracking-wider">Sex</span>
                      <span className="text-base font-bold">{sex}</span>
                    </div>
                  </div>

                  <div>
                    <span className="block text-xs font-bold text-blue-700 uppercase tracking-wider">Complete Address & Occupation</span>
                    <span className="text-base font-bold block mt-0.5">{houseNoStreet}, Barangay {barangay}, {city}</span>
                    <span className="text-sm font-medium text-slate-600 block mt-1">Occupation: {occupation || "None"}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button type="button" onClick={handlePrevStep} className="w-full sm:w-1/2 bg-slate-200 hover:bg-slate-300 text-slate-900 font-extrabold py-4 px-4 rounded-2xl text-base transition-all cursor-pointer">
                    ← Edit Details
                  </button>
                  <button type="button" onClick={handleFinalRegisterSubmit} className="w-full sm:w-1/2 bg-[#2563EB] hover:bg-blue-700 text-white font-extrabold py-4 px-4 rounded-2xl text-base shadow-lg transition-all cursor-pointer">
                    Confirm & Submit
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}