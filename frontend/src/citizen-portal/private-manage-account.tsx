import { useState } from 'react';

export default function MarketOperatorAccount() {
    const [entriesCount, setEntriesCount] = useState('0');

    const handleBack = () => {
        window.history.back();
    };

    return (
        <div className="w-full min-h-screen bg-slate-100 font-sans text-slate-800 flex flex-col antialiased">

            {/* =====================================================
                MAIN NAVIGATION HEADER (Updated)
            ====================================================== */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
                    <div className="flex items-center space-x-3.5 cursor-pointer group">
                        <div className="overflow-hidden rounded-xl border border-slate-200/60 shadow-sm transition-transform duration-300 group-hover:scale-105 bg-white p-1">
                            <img 
                                src="/src/assets/logo-system.png" 
                                alt="Gov Serv Logo" 
                                className="h-12 w-auto object-contain" 
                            />
                        </div>
                        <div>
                            <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">Gov Serv</h1>
                            <p className="text-[11px] text-slate-500 font-semibold tracking-wide uppercase">Unified Portal</p>
                        </div>
                    </div>

                    <div className="hidden md:flex items-center space-x-8 text-sm font-semibold text-slate-700">
                        <span className="hover:text-blue-700 cursor-pointer">HOME</span>
                        <span className="hover:text-blue-700 cursor-pointer flex items-center gap-1">SERVICES ▾</span>
                    </div>

                    <div className="flex items-center space-x-3">
                        <button className="bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow transition-all">
                            Login / Register
                        </button>
                    </div>
                </div>
            </header>


            {/* =====================================================
                MAIN CONTENT CONTAINER
            ====================================================== */}
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                
                {/* MARKET OPERATOR ACCOUNT SECTION */}
                <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                    
                    {/* Section Header Title with Top Border Line Accent and Back Button */}
                    <div className="relative pt-4 flex justify-between items-center">
                        <div className="absolute top-0 left-0 w-24 h-1 bg-[#0f316e]"></div>
                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
                            Market Operator Account
                        </h2>
                        <button
                            onClick={handleBack}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-md text-xs font-semibold transition-colors cursor-pointer"
                        >
                            <span>&larr;</span> Back
                        </button>
                    </div>

                    {/* Table Container */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                {/* Table Header */}
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
                                        <th className="py-3.5 px-4 text-right uppercase">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>

                                {/* Table Body - Empty State Matching Reference */}
                                <tbody>
                                    <tr>
                                        <td colSpan={7} className="bg-slate-50/70 py-16 px-4 text-center">
                                            <div className="flex flex-col items-center justify-center space-y-2">
                                                {/* Minimal folder icon */}
                                                <svg className="w-12 h-12 text-slate-300 stroke-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
                                                </svg>
                                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">No Data</span>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Table Footer / Pagination Bar */}
                        <div className="bg-white px-4 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
                            {/* Entries Selector */}
                            <div className="flex items-center space-x-2">
                                <span>Ipakita</span>
                                <select 
                                    value={entriesCount}
                                    onChange={(e) => setEntriesCount(e.target.value)}
                                    className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#15418c]"
                                >
                                    <option value="0">0</option>
                                    <option value="10">10</option>
                                    <option value="25">25</option>
                                    <option value="50">50</option>
                                </select>
                                <span>ng 0 entries</span>
                            </div>

                            {/* Pagination Controls */}
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

            </main>

        </div>
    );
}