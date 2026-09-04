import { useState } from 'react';
import type { FC } from 'react';
import { UnifiedHeader } from './UnifiedHeader';
import { UnifiedFooter } from './UnifiedFooter';

export interface MarketVendorsHubProps {
  isCollapsed?: boolean;
}

export const MarketVendorsHub: FC<MarketVendorsHubProps> = ({
  isCollapsed = false,
}) => {
  const [marketCategoryModal, setMarketCategoryModal] = useState<string | null>(
    null
  );
  const [submitOptionsModal, setSubmitOptionsModal] = useState(false);

  /*
   * IMPORTANT:
   * Keep every popup at the same compact size as the reference screenshot.
   * Inline width/maxWidth prevents global CSS from stretching the modal.
   */
  const modalStyle = {
    width: '510px',
    maxWidth: 'calc(100vw - 32px)',
  };

  return (
    <div
      style={{
        marginLeft: isCollapsed ? '80px' : '0px',
        width: isCollapsed ? 'calc(100% - 80px)' : '100%',
      }}
      className="min-h-screen bg-slate-100 font-['Segoe_UI',Tahoma,Geneva,Verdana,sans-serif] text-slate-800 flex flex-col antialiased relative transition-all duration-300 box-border"
    >
      <UnifiedHeader />

      <div className="flex-1 flex flex-col justify-between w-full">
        <div>
          {/* HERO */}
          <div className="relative w-full bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 h-36 sm:h-48 overflow-hidden flex items-center justify-center border-b-4 border-blue-600">
            <div className="absolute inset-0 opacity-30 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]" />

            <div className="relative z-10 text-center px-4">
              <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-wide uppercase">
                WELCOME TO MARKET &amp; VENDORS HUB
              </h1>

              <p className="text-xs sm:text-sm text-slate-200 mt-1 max-w-xl mx-auto">
                This portal is one of our digital Gov Serv initiatives
                catering to the needs of market vendors and operators in
                securing their permits and licenses.
              </p>
            </div>
          </div>

          {/* MAIN CONTENT */}
          <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 relative z-0">
            {/* CITY-OWNED MARKET */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between text-center">
              <div>
                <h3 className="text-blue-900 font-bold text-sm tracking-wider uppercase mb-1">
                  CITY-OWNED MARKET
                </h3>

                <p className="text-xs text-slate-500 leading-relaxed mb-6">
                  Galas, Kamuning, Murphy, Project 2, Project 4, RA Calalay,
                  Roxas, and San Jose public wet/dry market stalls. You can now
                  submit your stall applications and manage accounts online
                  through this portal.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <button
                  onClick={() => setMarketCategoryModal('cityOwned')}
                  className="px-6 py-2.5 bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold rounded-full shadow-md transition-all cursor-pointer"
                >
                  PROCEED WITH CITY-OWNED MARKET
                </button>
              </div>
            </div>

            {/* HAWKERS */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center">
              <h3 className="text-blue-900 font-bold text-sm tracking-wider uppercase mb-2">
                HAWKERS &amp; STREET VENDORS REGISTRATION
              </h3>

              <p className="text-xs text-slate-500 mb-6 max-w-xl mx-auto">
                Do you want to register your mobile vending association or
                certified sidewalk cart spot? Click below to start your
                application:
              </p>

              <div className="flex justify-center">
                <button
                  onClick={() => setMarketCategoryModal('hawkers')}
                  className="w-full sm:w-auto px-6 py-2.5 bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold rounded-full shadow-md transition-all cursor-pointer"
                >
                  PROCEED WITH HAWKERS REGISTRATION
                </button>
              </div>
            </div>
          </div>
        </div>

        <UnifiedFooter />
      </div>

      {/* =========================================================
          MARKET CATEGORY MODAL
          FIXED SIZE: 510px
      ========================================================= */}
      {marketCategoryModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setMarketCategoryModal(null);
            }
          }}
        >
          <div
            style={modalStyle}
            className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
            role="dialog"
            aria-modal="true"
          >
            {/* MODAL HEADER */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                  QC MDAD PORTAL
                </span>

                <h3 className="font-bold text-sm text-slate-800">
                  {marketCategoryModal === 'cityOwned' &&
                    'City-Owned Market'}

                  {marketCategoryModal === 'hawkers' && 'Hawkers'}
                </h3>
              </div>

              <button
                onClick={() => setMarketCategoryModal(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg leading-none cursor-pointer transition-colors"
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>

            {/* MODAL BODY */}
            <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto text-xs">
              {/* CITY-OWNED OPTIONS */}
              {marketCategoryModal === 'cityOwned' && (
                <>
                  {/* SUBMIT STALL APPLICATION */}
                  <button
                    onClick={() => {
                      setMarketCategoryModal(null);
                      setSubmitOptionsModal(true);
                    }}
                    className="w-full text-left bg-white hover:bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between transition-all shadow-sm group cursor-pointer"
                  >
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs text-slate-900 group-hover:text-blue-700">
                        Submit Stall Application
                      </h4>

                      <p className="text-[11px] text-slate-500">
                        New processing for public market spaces
                      </p>
                    </div>

                    <span className="text-sm font-bold text-slate-400 group-hover:text-blue-700 ml-4 shrink-0">
                      →
                    </span>
                  </button>

                  {/* MANAGE ACCOUNT */}
                  <button
                    onClick={() => {
                      window.location.href =
                        '/citizen-portal-stall-manage-account';
                      setMarketCategoryModal(null);
                    }}
                    className="w-full text-left bg-white hover:bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between transition-all shadow-sm group cursor-pointer"
                  >
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs text-slate-900 group-hover:text-blue-700">
                        Manage City-Owned Market Account
                      </h4>

                      <p className="text-[11px] text-slate-500">
                        Access profile settings, bills, and payment records
                      </p>
                    </div>

                    <span className="text-sm font-bold text-slate-400 group-hover:text-blue-700 ml-4 shrink-0">
                      →
                    </span>
                  </button>
                </>
              )}

              {/* HAWKER OPTIONS */}
              {marketCategoryModal === 'hawkers' && (
                <button
                  onClick={() => {
                    window.location.href = '/hawker-application';
                    setMarketCategoryModal(null);
                  }}
                  className="w-full text-left bg-white hover:bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between transition-all shadow-sm group cursor-pointer"
                >
                  <div className="min-w-0">
                    <h4 className="font-bold text-xs text-slate-900 group-hover:text-blue-700">
                      Register Hawker Association
                    </h4>

                    <p className="text-[11px] text-slate-500">
                      Official group registration for vendor collectives
                    </p>
                  </div>

                  <span className="text-sm font-bold text-slate-400 group-hover:text-blue-700 ml-4 shrink-0">
                    →
                  </span>
                </button>
              )}
            </div>

            {/* MODAL FOOTER */}
            <div className="flex justify-end gap-2 px-6 py-3 border-t border-slate-200 bg-slate-50 shrink-0">
              <button
                onClick={() => setMarketCategoryModal(null)}
                className="px-4 py-2 border border-slate-300 rounded font-semibold hover:bg-slate-100 text-xs cursor-pointer transition-colors"
              >
                Close Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          STALL APPLICATION OPTIONS MODAL
          SAME FIXED SIZE: 510px
      ========================================================= */}
      {submitOptionsModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setSubmitOptionsModal(false);
            }
          }}
        >
          <div
            style={modalStyle}
            className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
            role="dialog"
            aria-modal="true"
          >
            {/* MODAL HEADER */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                  QC MDAD PORTAL
                </span>

                <h3 className="font-bold text-sm text-slate-800">
                  City-Owned Market
                </h3>
              </div>

              <button
                onClick={() => setSubmitOptionsModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg leading-none cursor-pointer transition-colors"
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>

            {/* MODAL BODY */}
            <div className="p-6 space-y-3 text-xs">
              <button
                onClick={() => {
                  window.location.href = '/citizen-portal-stall';
                  setSubmitOptionsModal(false);
                }}
                className="w-full text-left bg-white hover:bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between transition-all shadow-sm group cursor-pointer"
              >
                <div className="min-w-0">
                  <h4 className="font-bold text-xs text-slate-900 group-hover:text-blue-700">
                    New Stall Application
                  </h4>

                  <p className="text-[11px] text-slate-500">
                    Apply for vacant public market stalls
                  </p>
                </div>

                <span className="text-sm font-bold text-slate-400 group-hover:text-blue-700 ml-4 shrink-0">
                  →
                </span>
              </button>
            </div>

            {/* MODAL FOOTER */}
            <div className="flex justify-between items-center px-6 py-3 border-t border-slate-200 bg-slate-50 text-xs shrink-0">
              <button
                onClick={() => {
                  setSubmitOptionsModal(false);
                  setMarketCategoryModal('cityOwned');
                }}
                className="font-semibold text-slate-600 hover:text-blue-700 hover:underline cursor-pointer transition-colors"
              >
                ← Back to Menu
              </button>

              <button
                onClick={() => setSubmitOptionsModal(false)}
                className="px-4 py-2 border border-slate-300 rounded font-semibold hover:bg-slate-100 cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketVendorsHub;