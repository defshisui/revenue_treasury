import React, { useState, useEffect, useRef } from 'react';

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

    const handleBack = () => {
        window.history.back();
    };

    return (
        <div className="w-full bg-[#f8fafc] font-['Segoe_UI',Tahoma,Geneva,Verdana,sans-serif] text-[#1a202c] min-h-screen pb-12">
            {/* 
              HEADER
            */}
            <header className="w-full h-[81px] bg-white border-b border-[#dfe4ea] shadow-[0_1px_3px_rgba(0,0,0,0.08)]">

                <div className="relative max-w-[1218px] h-full mx-auto">

                    {/* Logo & Title */}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-[13px]">

                        <div className="w-[60px] h-[60px] rounded-[14px] border border-[#e5e7eb] p-[3px] flex items-center justify-center bg-white shadow-[0_1px_4px_rgba(0,0,0,0.08)]">

                            <img 
                                src="/src/assets/logo-system.png" 
                                alt="Gov Serv Logo" 
                                className="w-full h-full object-contain" 
                            />

                        </div>

                        <div className="flex flex-col leading-none">

                            <span className="text-[16px] font-extrabold text-[#0f172a] tracking-[-0.2px]">
                                Gov Serv
                            </span>

                            <span className="text-[8.5px] font-bold text-[#64748b] tracking-[0.8px] uppercase mt-[6px]">
                                UNIFIED PORTAL
                            </span>

                        </div>

                    </div>

                    {/* Navigation */}
                    <nav className="absolute left-[548px] top-1/2 -translate-y-1/2 flex items-center gap-[32px] text-[13px] font-semibold text-[#172033]">

                        <a 
                            href="#" 
                            className="hover:text-[#1d4ed8] transition-colors whitespace-nowrap"
                        >
                            HOME
                        </a>

                        <a 
                            href="#" 
                            className="flex items-center gap-[5px] hover:text-[#1d4ed8] transition-colors whitespace-nowrap"
                        >
                            SERVICES

                            <span className="text-[8px] leading-none">
                                ▼
                            </span>

                        </a>

                    </nav>

                    {/* Login / Register */}
                    <button 
                        className="
                            absolute
                            right-0
                            top-1/2
                            -translate-y-1/2
                            w-[130px]
                            h-[36px]
                            flex
                            items-center
                            justify-center
                            bg-[#1e3a8a]
                            hover:bg-[#172f73]
                            text-white
                            text-[12px]
                            font-semibold
                            rounded-[12px]
                            shadow-[0_2px_5px_rgba(0,0,0,0.12)]
                            transition-colors
                            whitespace-nowrap
                        "
                    >
                        Login / Register
                    </button>

                </div>

            </header>

            {/* Main Content Area */}
            <main className="p-8 flex flex-col items-center">
                {/* Back Button Container */}
                <div className="w-full max-w-[1100px] mb-4">
                    <button 
                        onClick={handleBack}
                        className="flex items-center gap-2 text-xs font-semibold text-[#475569] bg-white border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 hover:text-[#0f2942] transition-colors shadow-xs cursor-pointer"
                    >
                        <span>&larr;</span> Back
                    </button>
                </div>

                <div className="w-full max-w-[1100px] bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 overflow-hidden flex flex-col">
                    {/* View Application List Title Bar */}
                    <div className="flex justify-between items-center px-8 py-6 border-b border-[#e2e8f0]">
                        <div className="flex items-center gap-3">
                            <h2 className="text-[1.15rem] font-bold text-[#1a202c] tracking-[0.5px] border-l-4 border-[#7b2cbf] pl-3">
                                VIEW APPLICATION LIST
                            </h2>
                        </div>
                    </div>

                    {/* Filters Section */}
                    <div className="p-[30px] bg-white grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
                        <div className="flex flex-col gap-2">
                            <label htmlFor="appId" className="text-[0.85rem] font-semibold text-[#1a202c]">Application ID</label>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    id="appId" 
                                    value={appIdInput}
                                    onChange={(e) => setAppIdInput(e.target.value)}
                                    placeholder="Search ID..." 
                                    className="w-full px-[14px] py-[10px] border border-[#e2e8f0] rounded-lg text-[0.9rem] outline-none focus:border-[#3182ce] focus:ring-[3px] focus:ring-[#3182ce]/15 transition-all bg-white"
                                />
                                <button 
                                    onClick={handleSearch}
                                    className="bg-[#12284c] text-white border-none px-5 rounded-lg font-semibold cursor-pointer hover:bg-[#1a365d] transition-colors whitespace-nowrap"
                                >
                                    Hanapin
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-[0.85rem] font-semibold text-[#1a202c]">Application Type</label>
                            <div className="relative" ref={dropdownRef}>
                                <div 
                                    className="min-h-[44px] flex flex-wrap gap-1.5 items-center cursor-pointer px-[14px] py-[10px] border border-[#e2e8f0] rounded-lg bg-white focus-within:border-[#3182ce] focus-within:ring-[3px] focus-within:ring-[#3182ce]/15 transition-all"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsDropdownOpen(!isDropdownOpen);
                                    }}
                                >
                                    {selectedValues.length === 0 ? (
                                        <span className="text-[#718096] text-[0.9rem]">-- Select --</span>
                                    ) : (
                                        selectedValues.map((val) => (
                                            <span key={val} className="bg-[#edf2f7] text-[#1a202c] px-2 py-1 rounded-md text-[0.8rem] flex items-center gap-1.5 border border-[#e2e8f0] font-medium">
                                                {val} 
                                                <span 
                                                    className="cursor-pointer font-bold text-[#718096] hover:text-[#e53e3e]" 
                                                    onClick={(e) => handleRemoveTag(e, val)}
                                                >
                                                    &times;
                                                </span>
                                            </span>
                                        ))
                                    )}
                                </div>

                                {/* Dropdown list */}
                                <div className={`absolute top-[calc(100%+4px)] left-0 right-0 bg-white border border-[#e2e8f0] rounded-lg shadow-[0_10px_25px_rgba(0,0,0,0.08)] z-10 max-h-[250px] overflow-y-auto ${isDropdownOpen ? 'block' : 'hidden'}`}>
                                    {availableApplicationTypes.map((type) => {
                                        const isSelected = selectedValues.includes(type);
                                        return (
                                            <div 
                                                key={type}
                                                className={`px-[14px] py-[10px] text-[0.9rem] cursor-pointer flex justify-between items-center border-b border-[#f7fafc] hover:bg-[#edf2f7] hover:text-[#3182ce] ${isSelected ? 'bg-[#ebf8ff] text-[#3182ce]' : ''}`}
                                                onClick={() => handleToggleSelect(type)}
                                            >
                                                <span>{type}</span>
                                                <span className={`text-[0.85rem] text-[#3182ce] ${isSelected ? 'inline' : 'hidden'}`}>✓</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Table Section */}
                    <div className="w-full overflow-x-auto min-h-[300px] bg-[#fafbfc] border-t border-b border-[#e2e8f0] flex flex-col justify-center">
                        <table className="w-full border-collapse text-left">
                            <thead>
                                <tr>
                                    <th className="bg-[#12284c] text-white text-[0.75rem] uppercase tracking-[0.8px] py-[14px] px-[20px] font-semibold">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="cursor-pointer">FORM ID</span>
                                            <span className="cursor-pointer">▲</span>
                                        </div>
                                    </th>
                                    <th className="bg-[#12284c] text-white text-[0.75rem] uppercase tracking-[0.8px] py-[14px] px-[20px] font-semibold">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="cursor-pointer">MARKET NAME</span>
                                            <span className="cursor-pointer">🔍</span>
                                        </div>
                                    </th>
                                    <th className="bg-[#12284c] text-white text-[0.75rem] uppercase tracking-[0.8px] py-[14px] px-[20px] font-semibold">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="cursor-pointer">SECTION</span>
                                        </div>
                                    </th>
                                    <th className="bg-[#12284c] text-white text-[0.75rem] uppercase tracking-[0.8px] py-[14px] px-[20px] font-semibold">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="cursor-pointer">STATUS</span>
                                            <span className="cursor-pointer">🔍</span>
                                        </div>
                                    </th>
                                    <th className="bg-[#12284c] text-white text-[0.75rem] uppercase tracking-[0.8px] py-[14px] px-[20px] font-semibold">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="cursor-pointer">DATE SUBMITTED</span>
                                        </div>
                                    </th>
                                    <th className="bg-[#12284c] text-white text-[0.75rem] uppercase tracking-[0.8px] py-[14px] px-[20px] font-semibold">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="cursor-pointer">ACTION</span>
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td colSpan={6} className="p-[16px_20px] bg-white border-b border-[#e2e8f0]">
                                        <div className="text-center py-[60px] px-[20px] text-[#718096]">
                                            <div className="w-[44px] h-[44px] mx-auto mb-[12px] opacity-40 bg-[#e2e8f0] rounded-md"></div>
                                            <p>No Data</p>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Footer Pagination */}
                    <div className="flex justify-between items-center py-[20px] px-[30px] bg-white text-[0.85rem] text-[#718096]">
                        <div>
                            Ipakita{' '}
                            <select 
                                value={entriesPerPage} 
                                onChange={(e) => setEntriesPerPage(e.target.value)}
                                className="py-[4px] px-[8px] border border-[#e2e8f0] rounded-md outline-none text-[#1a202c] bg-white"
                            >
                                <option value="0">0</option>
                                <option value="10">10</option>
                                <option value="25">25</option>
                            </select>{' '}
                            ng 0 entries
                        </div>
                        <div className="flex items-center gap-[6px]">
                            <button className="bg-white border border-[#e2e8f0] py-[6px] px-[12px] rounded-md cursor-pointer text-[#1a202c] text-[0.85rem] opacity-40 not-allowed" disabled>&laquo;</button>
                            <button className="bg-white border border-[#e2e8f0] py-[6px] px-[12px] rounded-md cursor-pointer text-[#1a202c] text-[0.85rem] opacity-40 not-allowed" disabled>&lsaquo;</button>
                            <button className="py-[6px] px-[12px] rounded-md cursor-pointer text-[0.85rem] bg-[#12284c] text-white border border-[#12284c]">1</button>
                            <button className="bg-white border border-[#e2e8f0] py-[6px] px-[12px] rounded-md cursor-pointer text-[#1a202c] text-[0.85rem] opacity-40 not-allowed" disabled>&rsaquo;</button>
                            <button className="bg-white border border-[#e2e8f0] py-[6px] px-[12px] rounded-md cursor-pointer text-[#1a202c] text-[0.85rem] opacity-40 not-allowed" disabled>&raquo;</button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}