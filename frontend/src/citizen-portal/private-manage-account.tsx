import CitizenLayout from './CitizenLayout';
import { useState } from 'react';

export default function MarketOperatorAccount() {
    const [entriesCount, setEntriesCount] = useState('0');

    return (
        <CitizenLayout activeTitle="Market Operator Account" activeNav="market">
            <div className="max-w-6xl mx-auto w-full space-y-6">
                <div>
                    <p className="text-[10px] font-bold tracking-widest text-blue-700 dark:text-blue-400 uppercase mb-0.5">
                        Market &amp; Vendors
                    </p>
                    <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                        Market Operator Account
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Manage your private market permits and business records.
                    </p>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-blue-900 dark:bg-blue-950 text-white text-[11px] font-bold uppercase tracking-wider">
                                    <th className="py-3.5 px-4 cursor-pointer hover:bg-blue-800/60 transition-colors">
                                        <div className="flex items-center justify-between gap-2">
                                            <span>Business Permit No.</span>
                                            <span className="text-blue-300">↕</span>
                                        </div>
                                    </th>
                                    <th className="py-3.5 px-4 cursor-pointer hover:bg-blue-800/60 transition-colors">
                                        <div className="flex items-center justify-between gap-2">
                                            <span>Market Name</span>
                                            <span className="text-blue-300">↕</span>
                                        </div>
                                    </th>
                                    <th className="py-3.5 px-4 cursor-pointer hover:bg-blue-800/60 transition-colors">
                                        <div className="flex items-center justify-between gap-2">
                                            <span>Market Type</span>
                                            <span className="text-blue-300">↕</span>
                                        </div>
                                    </th>
                                    <th className="py-3.5 px-4 cursor-pointer hover:bg-blue-800/60 transition-colors">
                                        <div className="flex items-center justify-between gap-2">
                                            <span>First Name</span>
                                            <span className="text-blue-300">↕</span>
                                        </div>
                                    </th>
                                    <th className="py-3.5 px-4 cursor-pointer hover:bg-blue-800/60 transition-colors">
                                        <div className="flex items-center justify-between gap-2">
                                            <span>Last Name</span>
                                            <span className="text-blue-300">↕</span>
                                        </div>
                                    </th>
                                    <th className="py-3.5 px-4 cursor-pointer hover:bg-blue-800/60 transition-colors">
                                        <div className="flex items-center justify-between gap-2">
                                            <span>Status</span>
                                            <svg className="w-3 h-3 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                        </div>
                                    </th>
                                    <th className="py-3.5 px-4 text-right">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td colSpan={7} className="bg-slate-50/70 dark:bg-slate-950/40 py-16 px-4 text-center">
                                        <div className="flex flex-col items-center justify-center space-y-2">
                                            <svg className="w-12 h-12 text-slate-300 dark:text-slate-700 stroke-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
                                            </svg>
                                            <span className="text-xs font-semibold text-slate-400 dark:text-slate-600 uppercase tracking-widest">No Data</span>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div className="bg-white dark:bg-slate-900 px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600 dark:text-slate-400">
                        <div className="flex items-center space-x-2">
                            <span>Show</span>
                            <select
                                value={entriesCount}
                                onChange={(e) => setEntriesCount(e.target.value)}
                                className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600"
                            >
                                <option value="0">0</option>
                                <option value="10">10</option>
                                <option value="25">25</option>
                                <option value="50">50</option>
                            </select>
                            <span>of 0 entries</span>
                        </div>
                        <div className="flex items-center space-x-1">
                            <button className="w-8 h-8 rounded border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50" disabled>&laquo;</button>
                            <button className="w-8 h-8 rounded border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50" disabled>&lsaquo;</button>
                            <button className="w-8 h-8 rounded bg-blue-900 dark:bg-blue-800 font-bold border border-blue-900 dark:border-blue-800 flex items-center justify-center text-white">1</button>
                            <button className="w-8 h-8 rounded border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50" disabled>&rsaquo;</button>
                            <button className="w-8 h-8 rounded border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50" disabled>&raquo;</button>
                        </div>
                    </div>
                </div>
            </div>
        </CitizenLayout>
    );
}