import { UnifiedHeader } from './UnifiedHeader';
import { UnifiedFooter } from './UnifiedFooter';

export default function CitizenPortalLanding() {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans transition-colors duration-300">

      <div>

        <UnifiedHeader />

        {/* HERO */}
        <section className="bg-[#1D2F86] text-white border-b-2 border-[#2563EB] bg-[radial-gradient(#3152B5_1px,transparent_1px)] [background-size:16px_16px]">

          <div className="max-w-7xl mx-auto px-4 py-12 sm:py-14 text-center">

            <h1 className="text-3xl sm:text-4xl font-black tracking-wide uppercase">
              WELCOME TO MARKET &amp; VENDORS HUB
            </h1>

            <p className="max-w-2xl mx-auto mt-2 text-sm sm:text-base text-white/95 leading-relaxed">
              This portal is one of our digital Gov Serve initiatives catering
              to the needs of market vendors and operators in securing their
              permits and licenses.
            </p>

          </div>

        </section>


        {/* SERVICES */}
        <main className="flex-1">

          <div className="max-w-6xl mx-auto px-4 py-8 sm:py-10">

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* CITY-OWNED MARKET */}
              <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-7 text-center transition-colors duration-300">

                <p className="text-sm font-extrabold text-[#1D2F86] dark:text-blue-400 uppercase tracking-wide">
                  CITY-OWNED MARKET
                </p>

                <h2 className="mt-2 text-lg font-black text-slate-900 dark:text-white">
                  Public Market Stall Services
                </h2>

                <p className="max-w-xl mx-auto mt-3 text-xs sm:text-sm text-[#36527A] dark:text-slate-400 leading-relaxed">
                  Galas, Kamuning, Murphy, Project 2, Project 4, RA Calalay,
                  Roxas, and San Jose public wet/dry market stalls. You can now
                  submit your stall applications and manage accounts online
                  through this portal.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    window.location.href = '/citizen-portal-stall';
                  }}
                  className="mt-6 inline-flex items-center justify-center bg-[#1D3F99] hover:bg-[#17357F] text-white font-black text-xs uppercase px-6 py-3 rounded-full shadow-md transition cursor-pointer"
                >
                  PROCEED WITH CITY-OWNED MARKET
                </button>

              </section>


              {/* HAWKERS */}
              <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-7 text-center transition-colors duration-300">

                <p className="text-sm font-extrabold text-[#1D2F86] dark:text-blue-400 uppercase tracking-wide">
                  HAWKERS &amp; STREET VENDORS REGISTRATION
                </p>

                <h2 className="mt-2 text-lg font-black text-slate-900 dark:text-white">
                  Hawker Registration Services
                </h2>

                <p className="max-w-xl mx-auto mt-3 text-xs sm:text-sm text-[#36527A] dark:text-slate-400 leading-relaxed">
                  Do you want to register your mobile vending association or
                  certified sidewalk cart spot? Click below to start your
                  application.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    window.location.href = '/hawker-application';
                  }}
                  className="mt-6 inline-flex items-center justify-center bg-[#1D3F99] hover:bg-[#17357F] text-white font-black text-xs uppercase px-6 py-3 rounded-full shadow-md transition cursor-pointer"
                >
                  PROCEED WITH HAWKERS REGISTRATION
                </button>

              </section>

            </div>

          </div>

        </main>

      </div>

      <UnifiedFooter />

    </div>
  );
}