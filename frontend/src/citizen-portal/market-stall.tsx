import { useState, useEffect } from 'react';
import { UnifiedHeader } from './UnifiedHeader';
import { UnifiedFooter } from './UnifiedFooter';

export default function CitizenPortalLanding() {
  const [user, setUser] = useState<{ firstName: string } | null>(null);

  useEffect(() => {
    const checkUserSession = () => {
      const rawData =
        localStorage.getItem('currentUser') ||
        localStorage.getItem('user') ||
        sessionStorage.getItem('currentUser') ||
        sessionStorage.getItem('user');

      if (!rawData) return null;

      try {
        const parsed = JSON.parse(rawData);

        const target =
          parsed.user && typeof parsed.user === 'object'
            ? parsed.user
            : parsed;

        const fullName =
          target.fullname ||
          target.name ||
          target.fullName ||
          target.firstName ||
          target.email;

        if (!fullName) return null;

        const firstName = String(fullName).trim().split(' ')[0];

        return { firstName };
      } catch (error) {
        console.error('Failed to parse user session', error);
        return null;
      }
    };

    setUser(checkUserSession());
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans transition-colors duration-300">

      <UnifiedHeader />

      {/* HERO */}
      <section className="bg-[#1D2F86] text-white border-b-2 border-[#2563EB] bg-[radial-gradient(#3152B5_1px,transparent_1px)] [background-size:16px_16px]">

        <div className="max-w-7xl mx-auto px-4 py-12 sm:py-14 text-center">

          <h1 className="text-3xl sm:text-4xl font-black tracking-wide uppercase">
            WELCOME TO GOV SERVE
          </h1>

          <p className="max-w-2xl mx-auto mt-2 text-sm sm:text-base text-white/95 leading-relaxed">
            Welcome{user ? `, ${user.firstName}` : ''}! Access your revenue
            and treasury services quickly and securely.
          </p>

        </div>

      </section>


      {/* SERVICES */}
      <main className="flex-1">

        <div className="max-w-6xl mx-auto px-4 py-8 sm:py-10">

          <div className="text-center mb-6">

            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              AVAILABLE ONLINE SERVICES
            </h2>

            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Select a service below to continue.
            </p>

          </div>


          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            {/* MARKET & VENDORS */}
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 text-center transition-colors duration-300">

              <p className="text-sm font-extrabold text-[#1D2F86] dark:text-blue-400 uppercase tracking-wide">
                MARKET &amp; VENDORS
              </p>

              <h3 className="mt-2 text-lg font-black text-slate-900 dark:text-white">
                Market &amp; Vendors Hub
              </h3>

              <p className="mt-3 text-xs sm:text-sm text-[#36527A] dark:text-slate-400 leading-relaxed">
                Access city-owned market stalls, private market services,
                and hawker registration services through the online portal.
              </p>

              <button
                type="button"
                onClick={() => {
                  window.location.href = '/market-vendor-tab';
                }}
                className="mt-6 inline-flex items-center justify-center bg-[#1D3F99] hover:bg-[#17357F] text-white font-black text-xs uppercase px-5 py-3 rounded-full shadow-md transition cursor-pointer"
              >
                MARKET &amp; VENDORS
              </button>

            </section>


            {/* REAL PROPERTY TAX */}
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 text-center transition-colors duration-300">

              <p className="text-sm font-extrabold text-[#1D2F86] dark:text-blue-400 uppercase tracking-wide">
                REAL PROPERTY TAX
              </p>

              <h3 className="mt-2 text-lg font-black text-slate-900 dark:text-white">
                Real Property Tax Hub
              </h3>

              <p className="mt-3 text-xs sm:text-sm text-[#36527A] dark:text-slate-400 leading-relaxed">
                Search your property tax information, view assessments,
                check balances, and access Real Property Tax services.
              </p>

              <button
                type="button"
                onClick={() => {
                  window.location.href = '/real-property-tax-hub';
                }}
                className="mt-6 inline-flex items-center justify-center bg-[#1D3F99] hover:bg-[#17357F] text-white font-black text-xs uppercase px-5 py-3 rounded-full shadow-md transition cursor-pointer"
              >
                REAL PROPERTY TAX
              </button>

            </section>


            {/* BUSINESS TAX */}
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 text-center transition-colors duration-300">

              <p className="text-sm font-extrabold text-[#1D2F86] dark:text-blue-400 uppercase tracking-wide">
                BUSINESS TAX
              </p>

              <h3 className="mt-2 text-lg font-black text-slate-900 dark:text-white">
                Business Tax Assessment
              </h3>

              <p className="mt-3 text-xs sm:text-sm text-[#36527A] dark:text-slate-400 leading-relaxed">
                Process business tax assessments, submit requirements,
                schedule appointments, and manage your business tax services.
              </p>

              <button
                type="button"
                onClick={() => {
                  window.location.href = '/business-tax-assessment';
                }}
                className="mt-6 inline-flex items-center justify-center bg-[#1D3F99] hover:bg-[#17357F] text-white font-black text-xs uppercase px-5 py-3 rounded-full shadow-md transition cursor-pointer"
              >
                BUSINESS TAX
              </button>

            </section>

          </div>

        </div>

      </main>


      <UnifiedFooter />

    </div>
  );
}