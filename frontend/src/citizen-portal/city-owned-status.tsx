import React, { useState, useEffect, useRef } from 'react';
import CitizenLayout from './CitizenLayout';

export default function ApplicationList() {
    const [selectedValues, setSelectedValues] = useState<string[]>([]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [appIdInput, setAppIdInput] = useState('');
    const [entriesPerPage, setEntriesPerPage] = useState('10');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const availableApplicationTypes = [
        "New Stall Application",
        "Removal of Stall Extension Application",
        "Renewal of Stall Application",
        "Repair Permit Application",
        "Stall Extension Application",
        "Transfer Stall Application"
    ];
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        }
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);
    const handleToggleSelect = (value: string) => {
        if (selectedValues.includes(value)) {
            setSelectedValues(selectedValues.filter(v => v !== value));
        } else {
            setSelectedValues([...selectedValues, value]);
        }
    };
    const handleRemoveTag = (e: React.MouseEvent, val: string) => {
        e.stopPropagation();
        setSelectedValues(selectedValues.filter(v => v !== val));
    };
    const handleSearch = () => {
        console.log("Searching for Application ID:", appIdInput);
        console.log("Selected Application Types:", selectedValues);
    };

    return (
        <CitizenLayout activeTitle="View Application List" activeNav="market">
            <div className="max-w-6xl mx-auto w-full space-y-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
                    <div className="flex justify-between items-center px-6 sm:px-8 py-5 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight border-l-4 border-blue-700 pl-3">
                                View Application List
                            </h2>
                        </div>
                    </div>

                    <div className="p-6 sm:p-8 bg-white dark:bg-slate-900 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
                        <div className="flex flex-col gap-2">
                            <label htmlFor="appId" className="text-xs font-bold text-slate-700 dark:text-slate-300">Application ID</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    id="appId"
                                    value={appIdInput}
                                    onChange={(e) => setAppIdInput(e.target.value)}
                                    placeholder="Search ID..."
                                    className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:border-blue-600 focus:ring-[3px] focus:ring-blue-600/15 transition-all bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                />
                                <button
                                    onClick={handleSearch}
                                    className="bg-blue-900 hover:bg-blue-950 text-white border-none px-5 rounded-lg font-bold text-sm cursor-pointer transition-colors whitespace-nowrap"
                                >
                                    Search
                                </button>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Application Type</label>
                            <div className="relative" ref={dropdownRef}>
                                <div
                                    className="min-h-[44px] flex flex-wrap gap-1.5 items-center cursor-pointer px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus-within:border-blue-600 focus-within:ring-[3px] focus-within:ring-blue-600/15 transition-all"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsDropdownOpen(!isDropdownOpen);
                                    }}
                                >
                                    {selectedValues.length === 0 ? (
                                        <span className="text-slate-400 dark:text-slate-500 text-sm">-- Select --</span>
                                    ) : (
                                        selectedValues.map((val) => (
                                            <span key={val} className="bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-2 py-1 rounded-md text-xs flex items-center gap-1.5 border border-slate-200 dark:border-slate-600 font-medium">
                                                {val}
                                                <span
                                                    className="cursor-pointer font-bold text-slate-400 dark:text-slate-500 hover:text-rose-600"
                                                    onClick={(e) => handleRemoveTag(e, val)}
                                                >
                                                    &times;
                                                </span>
                                            </span>
                                        ))
                                    )}
                                </div>
                                <div className={`absolute top-[calc(100%+4px)] left-0 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10 max-h-[250px] overflow-y-auto ${isDropdownOpen ? 'block' : 'hidden'}`}>
                                    {availableApplicationTypes.map((type) => {
                                        const isSelected = selectedValues.includes(type);
                                        return (
                                            <div
                                                key={type}
                                                className={`px-3.5 py-2.5 text-sm cursor-pointer flex justify-between items-center border-b border-slate-50 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-blue-700 dark:hover:text-blue-400 ${isSelected ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'}`}
                                                onClick={() => handleToggleSelect(type)}
                                            >
                                                <span>{type}</span>
                                                <span className={`text-xs text-blue-600 dark:text-blue-400 ${isSelected ? 'inline' : 'hidden'}`}>✓</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="w-full overflow-x-auto min-h-[300px] bg-slate-50 dark:bg-slate-950/40 border-t border-b border-slate-200 dark:border-slate-800 flex flex-col justify-center">
                        <table className="w-full border-collapse text-left">
                            <thead>
                                <tr>
                                    <th className="bg-blue-900 dark:bg-blue-950 text-white text-[11px] uppercase tracking-wider py-3.5 px-5 font-bold">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="cursor-pointer">Form ID</span>
                                            <span className="cursor-pointer text-blue-300">▲</span>
                                        </div>
                                    </th>
                                    <th className="bg-blue-900 dark:bg-blue-950 text-white text-[11px] uppercase tracking-wider py-3.5 px-5 font-bold">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="cursor-pointer">Market Name</span>
                                            <svg className="w-3 h-3 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                        </div>
                                    </th>
                                    <th className="bg-blue-900 dark:bg-blue-950 text-white text-[11px] uppercase tracking-wider py-3.5 px-5 font-bold">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="cursor-pointer">Section</span>
                                        </div>
                                    </th>
                                    <th className="bg-blue-900 dark:bg-blue-950 text-white text-[11px] uppercase tracking-wider py-3.5 px-5 font-bold">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="cursor-pointer">Status</span>
                                            <svg className="w-3 h-3 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                        </div>
                                    </th>
                                    <th className="bg-blue-900 dark:bg-blue-950 text-white text-[11px] uppercase tracking-wider py-3.5 px-5 font-bold">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="cursor-pointer">Date Submitted</span>
                                        </div>
                                    </th>
                                    <th className="bg-blue-900 dark:bg-blue-950 text-white text-[11px] uppercase tracking-wider py-3.5 px-5 font-bold">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="cursor-pointer">Action</span>
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td colSpan={6} className="py-4 px-5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                                        <div className="text-center py-14 px-5 text-slate-400 dark:text-slate-600">
                                            <div className="w-11 h-11 mx-auto mb-3 opacity-40 bg-slate-200 dark:bg-slate-700 rounded-md"></div>
                                            <p className="text-xs font-semibold uppercase tracking-widest">No Data</p>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-between items-center py-5 px-6 sm:px-8 bg-white dark:bg-slate-900 text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-2">
                            <span>Show</span>
                            <select
                                value={entriesPerPage}
                                onChange={(e) => setEntriesPerPage(e.target.value)}
                                className="py-1 px-2 border border-slate-200 dark:border-slate-700 rounded-md outline-none text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800"
                            >
                                <option value="0">0</option>
                                <option value="10">10</option>
                                <option value="25">25</option>
                            </select>
                            <span>of 0 entries</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 py-1.5 px-3 rounded-md text-slate-800 dark:text-slate-300 text-xs opacity-40 cursor-not-allowed" disabled>&laquo;</button>
                            <button className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 py-1.5 px-3 rounded-md text-slate-800 dark:text-slate-300 text-xs opacity-40 cursor-not-allowed" disabled>&lsaquo;</button>
                            <button className="py-1.5 px-3 rounded-md text-xs bg-blue-900 dark:bg-blue-800 text-white border border-blue-900 dark:border-blue-800">1</button>
                            <button className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 py-1.5 px-3 rounded-md text-slate-800 dark:text-slate-300 text-xs opacity-40 cursor-not-allowed" disabled>&rsaquo;</button>
                            <button className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 py-1.5 px-3 rounded-md text-slate-800 dark:text-slate-300 text-xs opacity-40 cursor-not-allowed" disabled>&raquo;</button>
                        </div>
                    </div>
                </div>
            </div>
        </CitizenLayout>
    );
}