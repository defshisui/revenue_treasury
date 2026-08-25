// src/components/MarketAdminDashboard.tsx

import { useState } from "react";

interface MarketAdminDashboardProps {
  marketSubView?: "stalls" | "city-owned-admin";
}

export default function MarketAdminDashboard({
  marketSubView = "stalls",
}: MarketAdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<"city-owned" | "private">(
    marketSubView === "city-owned-admin" ? "city-owned" : "private"
  );

  // Form filter states
  const [businessPermitNo, setBusinessPermitNo] = useState("");
  const [marketName, setMarketName] = useState("");

  return (
    <div className="space-y-6">
      {/* Sub-navigation switcher to toggle between the two views */}
      <div className="flex border-b border-slate-200 bg-white px-6 pt-4 rounded-t-2xl shadow-sm">
        <button
          onClick={() => setActiveTab("city-owned")}
          className={`pb-3 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-colors ${
            activeTab === "city-owned"
              ? "border-[#15418c] text-[#15418c]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Market Operator Account (City-Owned)
        </button>
        <button
          onClick={() => setActiveTab("private")}
          className={`pb-3 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-colors ${
            activeTab === "private"
              ? "border-[#15418c] text-[#15418c]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Private Market / Private Talipapa Stallholder
        </button>
      </div>

      {activeTab === "city-owned" ? (
        /* MARKET OPERATOR ACCOUNT SECTION */
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="relative pt-4">
            <div className="absolute top-0 left-0 w-24 h-1 bg-[#0f316e]"></div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
              Market Operator Account
            </h2>
          </div>

          {/* Table Container */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[rgb(11,46,134)] text-white text-xs font-bold uppercase tracking-wider">
                    <th className="py-3.5 px-4 cursor-pointer hover:bg-blue-900/80 transition-colors">
                      <div className="flex items-center justify-between">
                        <span>Business Permit No.</span>
                        <span className="text-[10px] text-blue-200">↕</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-4 cursor-pointer hover:bg-blue-900/80 transition-colors">
                      <div className="flex items-center justify-between">
                        <span>Pangalan ng Palengke</span>
                        <span className="text-[10px] text-blue-200">↕</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-4 cursor-pointer hover:bg-blue-900/80 transition-colors">
                      <div className="flex items-center justify-between">
                        <span>Uri ng Pamilihan</span>
                        <span className="text-[10px] text-blue-200">↕</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-4 cursor-pointer hover:bg-blue-900/80 transition-colors">
                      <div className="flex items-center justify-between">
                        <span>Unang Pangalan</span>
                        <span className="text-[10px] text-blue-200">↕</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-4 cursor-pointer hover:bg-blue-900/80 transition-colors">
                      <div className="flex items-center justify-between">
                        <span>Apelyido</span>
                        <span className="text-[10px] text-blue-200">↕</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-4 cursor-pointer hover:bg-blue-900/80 transition-colors">
                      <div className="flex items-center justify-between">
                        <span>Katayuan</span>
                        <span className="text-[10px] text-blue-200">filter</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-4 text-right uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={7} className="bg-slate-50/70 py-16 px-4 text-center">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <svg
                          className="w-12 h-12 text-slate-300 stroke-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.5"
                            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                          ></path>
                        </svg>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                          No Data
                        </span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            <div className="bg-white px-4 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
              <div className="flex items-center space-x-2">
                <span>Ipakita</span>
                <select className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#15418c]">
                  <option value="0">0</option>
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                </select>
                <span>ng 0 entries</span>
              </div>
              <div className="flex items-center space-x-1">
                <button className="w-8 h-8 rounded border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 disabled:opacity-50" disabled>&laquo;</button>
                <button className="w-8 h-8 rounded border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 disabled:opacity-50" disabled>&lsaquo;</button>
                <button className="w-8 h-8 rounded bg-slate-100 font-bold border border-slate-300 flex items-center justify-center text-slate-800">1</button>
                <button className="w-8 h-8 rounded border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 disabled:opacity-50" disabled>&rsaquo;</button>
                <button className="w-8 h-8 rounded border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 disabled:opacity-50" disabled>&raquo;</button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* PRIVATE MARKET / PRIVATE TALIPAPA STALLHOLDER SECTION */
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="relative pt-4">
            <div className="absolute top-0 left-0 w-24 h-1 bg-[#0f316e]"></div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
              Private Market / Private Talipapa Stallholder
            </h2>
          </div>

          {/* Filter Search Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-slate-50/60 p-4 rounded-xl border border-slate-200">
            <div className="md:col-span-5 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Business Permit No.
              </label>
              <input
                type="text"
                value={businessPermitNo}
                onChange={(e) => setBusinessPermitNo(e.target.value)}
                placeholder="Enter business permit no."
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#15418c] shadow-inner"
              />
            </div>
            <div className="md:col-span-5 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Pangalan ng Palengke
              </label>
              <input
                type="text"
                value={marketName}
                onChange={(e) => setMarketName(e.target.value)}
                placeholder="Enter pangalan ng palengke"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#15418c] shadow-inner"
              />
            </div>
            <div className="md:col-span-2">
              <button className="w-full bg-[rgb(11,46,134)] hover:bg-blue-900 text-white font-bold text-xs uppercase tracking-wider py-2.5 px-4 rounded-lg shadow transition-all flex items-center justify-center space-x-1.5">
                <span>Hanapin</span>
              </button>
            </div>
          </div>

          <div className="border-t border-slate-200"></div>

          {/* Table Container */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[rgb(11,46,134)] text-white text-xs font-bold uppercase tracking-wider">
                    <th className="py-3.5 px-4 cursor-pointer hover:bg-blue-900/80 transition-colors">
                      <div className="flex items-center justify-between">
                        <span>Business Permit No.</span>
                        <span className="text-[10px] text-blue-200">↕</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-4 cursor-pointer hover:bg-blue-900/80 transition-colors">
                      <div className="flex items-center justify-between">
                        <span>Unang Pangalan</span>
                        <span className="text-[10px] text-blue-200">↕</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-4 cursor-pointer hover:bg-blue-900/80 transition-colors">
                      <div className="flex items-center justify-between">
                        <span>Apelyido</span>
                        <span className="text-[10px] text-blue-200">↕</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-4 cursor-pointer hover:bg-blue-900/80 transition-colors">
                      <div className="flex items-center justify-between">
                        <span>Pangalan ng Palengke</span>
                        <span className="text-[10px] text-blue-200">↕</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-4 cursor-pointer hover:bg-blue-900/80 transition-colors">
                      <div className="flex items-center justify-between">
                        <span>Market Type</span>
                        <span className="text-[10px] text-blue-200">filter</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-4 cursor-pointer hover:bg-blue-900/80 transition-colors">
                      <div className="flex items-center justify-between">
                        <span>Stall Number</span>
                        <span className="text-[10px] text-blue-200">↕</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-4 cursor-pointer hover:bg-blue-900/80 transition-colors">
                      <div className="flex items-center justify-between">
                        <span>Section</span>
                        <span className="text-[10px] text-blue-200">↕</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-4 text-right uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={8} className="bg-slate-50/70 py-16 px-4 text-center">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <svg
                          className="w-12 h-12 text-slate-300 stroke-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.5"
                            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                          ></path>
                        </svg>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                          No Data
                        </span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            <div className="bg-white px-4 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
              <div className="flex items-center space-x-2">
                <span>Ipakita</span>
                <select className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#15418c]">
                  <option value="0">0</option>
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                </select>
                <span>ng 0 entries</span>
              </div>
              <div className="flex items-center space-x-1">
                <button className="w-8 h-8 rounded border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 disabled:opacity-50" disabled>&laquo;</button>
                <button className="w-8 h-8 rounded border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 disabled:opacity-50" disabled>&lsaquo;</button>
                <button className="w-8 h-8 rounded bg-slate-100 font-bold border border-slate-300 flex items-center justify-center text-slate-800">1</button>
                <button className="w-8 h-8 rounded border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 disabled:opacity-50" disabled>&rsaquo;</button>
                <button className="w-8 h-8 rounded border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 disabled:opacity-50" disabled>&raquo;</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}