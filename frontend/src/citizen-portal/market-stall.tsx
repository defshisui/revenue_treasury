import { useState, useEffect } from 'react';
import logoSystem from '../assets/logo-system.png';
import { UnifiedHeader } from './UnifiedHeader';

export default function CitizenPortalLanding() {
  // Authentication State for Hero Banner Greeting
  const [user, setUser] = useState<{ firstName: string } | null>(null);

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

        const nameParts = String(fullName).trim().split(" ");
        const firstName = nameParts[0];

        return { firstName };
      } catch (e) {
        console.error("Failed to parse user session", e);
        return null;
      }
    };

    setUser(checkUserSession());
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 pt-0 transition-all duration-300 box-border flex flex-col justify-between font-['Segoe_UI',Tahoma,Geneva,Verdana,sans-serif]">
      <div>

        {/* Unified Main Navigation Header */}
        <UnifiedHeader />

        {/* Main Content Container / Landing Page */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 mt-4">

          {/* Hero Welcome Banner */}
          <div className="relative overflow-hidden bg-[#122261] rounded-3xl p-8 sm:p-12 text-white shadow-lg flex flex-col justify-center bg-[radial-gradient(#1e3a8a_1px,transparent_1px)] [background-size:16px_16px]">

            {/* Background Watermark Logo */}
            <div className="absolute right-[-20px] bottom-[-40px] pointer-events-none opacity-10 select-none">
              <img
                src={logoSystem}
                alt=""
                className="w-80 h-80 sm:w-96 sm:h-96 object-contain"
              />
            </div>

            {/* Foreground Content */}
            <div className="relative z-10 flex flex-col items-start space-y-4 max-w-2xl">
              <span className="bg-blue-500/30 text-blue-200 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-blue-400/30">
                CITIZEN PORTAL DASHBOARD
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                Welcome{user ? `, ${user.firstName}` : ''}! Access Your Services Here.
              </h1>
              <p className="text-xs sm:text-sm text-blue-100 leading-relaxed">
                Manage your applications, check local business registrations, pay dues, and access government support services quickly and securely.
              </p>
            </div>
          </div>

          {/* Quick Access Services Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Available Online Services</h2>
              <span className="text-xs font-bold text-blue-700 cursor-pointer hover:underline">View All &rarr;</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

              <div
                onClick={() => window.location.href = '/market-vendor-tab'}
                className="bg-white hover:bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 22V12h6v10" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 group-hover:text-blue-900">Market &amp; Vendors Hub</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">Access public/private market stalls, hawker registrations, and market operator guidelines.</p>
                </div>
                <div className="text-xs font-bold text-blue-700 flex items-center gap-1 pt-2">
                  Launch Service &rarr;
                </div>
              </div>

              <div
                onClick={() => window.location.href = '/citizen-rpt'}
                className="bg-white hover:bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
              >
                <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 border border-teal-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 group-hover:text-teal-900">Real Property Tax</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">View property evaluations, file tax details, pay statements, and track assessment requests.</p>
                </div>
                <div className="text-xs font-bold text-teal-700 flex items-center gap-1 pt-2">
                  Launch Service &rarr;
                </div>
              </div>

              <div
                onClick={() => window.location.href = '/business-tax-assessment'}
                className="bg-white hover:bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
              >
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-700 border border-purple-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 group-hover:text-purple-900">Business Tax Assessment</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">Compute assessments, review business gross receipts, and process local business taxes.</p>
                </div>
                <div className="text-xs font-bold text-purple-700 flex items-center gap-1 pt-2">
                  Launch Service &rarr;
                </div>
              </div>

            </div>
          </div>

        </main>
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
    </div>
  );
}