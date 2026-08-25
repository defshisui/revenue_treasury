import React, { useState } from 'react';

export default function MarketLeaseSearch() {
    const [leaseId, setLeaseId] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [marketName, setMarketName] = useState('');
    const [leaseStatus, setLeaseStatus] = useState('');
    const [paymentStatus, setPaymentStatus] = useState('');
    const [entriesCount, setEntriesCount] = useState('0');
    const [showInactive, setShowInactive] = useState(false);

    const handleSearch = () => {
        console.log("Searching with:", {
            leaseId,
            firstName,
            lastName,
            marketName,
            leaseStatus,
            paymentStatus,
            showInactive
        });
    };

    const handleBack = () => {
        window.history.back();
    };

    return (
        <div className="w-full min-h-screen bg-[#eef2f6] font-['Segoe_UI',Tahoma,Geneva,Verdana,sans-serif] text-[#1a202c] flex flex-col pb-12">

            {/* =====================================================
                HEADER
            ====================================================== */}
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


            {/* =====================================================
                MAIN CONTENT AREA
            ====================================================== */}
            <main className="flex-grow p-[30px_40px] flex justify-center">

                <div className="w-full max-w-[1400px] bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden flex flex-col pb-5">

                    {/* Top Header Bar inside card with Back Button */}
                    <div className="flex justify-between items-center p-[20px_24px] border-b-2 border-[#e2e8f0]">
                        <h2 className="text-[1.1rem] font-bold text-[#1a202c] tracking-[0.5px] border-l-4 border-[#0a369d] pl-3 uppercase">
                            Hanapin ang Market Lease
                        </h2>
                        <button
                            onClick={handleBack}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-[#cbd5e1] hover:bg-[#edf2f7] text-[#1a202c] rounded-md text-[0.85rem] font-semibold transition-colors cursor-pointer"
                        >
                            <span>&larr;</span> Back
                        </button>
                    </div>


                    {/* Filters */}
                    <div className="p-6 bg-white grid grid-cols-1 lg:grid-cols-3 gap-x-6 gap-y-5 items-end border-b border-[#e2e8f0]">

                        <div className="flex flex-col gap-[6px]">
                            <label htmlFor="leaseId" className="text-[0.85rem] font-semibold text-[#1a202c]">
                                Lease ID
                            </label>
                            <input
                                type="text"
                                id="leaseId"
                                value={leaseId}
                                onChange={(e) => setLeaseId(e.target.value)}
                                className="w-full px-[14px] py-[10px] border border-[#cbd5e1] rounded-md text-[0.9rem] outline-none transition-all bg-white text-[#1a202c] focus:border-[#3182ce] focus:ring-[3px] focus:ring-[#3182ce]/15"
                            />
                        </div>

                        <div className="flex flex-col gap-[6px]">
                            <label htmlFor="firstName" className="text-[0.85rem] font-semibold text-[#1a202c]">
                                Unang Pangalan ng Stallholder
                            </label>
                            <input
                                type="text"
                                id="firstName"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                className="w-full px-[14px] py-[10px] border border-[#cbd5e1] rounded-md text-[0.9rem] outline-none transition-all bg-white text-[#1a202c] focus:border-[#3182ce] focus:ring-[3px] focus:ring-[#3182ce]/15"
                            />
                        </div>

                        <div className="flex flex-col gap-[6px]">
                            <label htmlFor="lastName" className="text-[0.85rem] font-semibold text-[#1a202c]">
                                Apelyido ng Stallholder
                            </label>
                            <input
                                type="text"
                                id="lastName"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                className="w-full px-[14px] py-[10px] border border-[#cbd5e1] rounded-md text-[0.9rem] outline-none transition-all bg-white text-[#1a202c] focus:border-[#3182ce] focus:ring-[3px] focus:ring-[#3182ce]/15"
                            />
                        </div>

                        <div className="flex flex-col gap-[6px]">
                            <label htmlFor="marketName" className="text-[0.85rem] font-semibold text-[#1a202c]">
                                Pangalan ng Palengke
                            </label>
                            <select
                                id="marketName"
                                value={marketName}
                                onChange={(e) => setMarketName(e.target.value)}
                                className="w-full px-[14px] py-[10px] border border-[#cbd5e1] rounded-md text-[0.9rem] outline-none transition-all bg-white text-[#718096] appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.36%22%20height%3D%22292.36%22%3E%3Cpath%20fill%3D%22%23718096%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[length:10px] bg-[position:right_14px_center] pr-[35px] focus:border-[#3182ce] focus:ring-[3px] focus:ring-[#3182ce]/15"
                            >
                                <option value="" disabled>-- Select --</option>
                                <option value="Galas City-Owned Market">Galas City-Owned Market</option>
                                <option value="Kamuning City-Owned Market">Kamuning City-Owned Market</option>
                                <option value="Murphy City-owned Market">Murphy City-owned Market</option>
                                <option value="Project 2 City-Owned Market">Project 2 City-Owned Market</option>
                                <option value="Project 4 City-Owned Market (New)">Project 4 City-Owned Market (New)</option>
                                <option value="R.A. Calalay City-Owned Market - Temporary">R.A. Calalay City-Owned Market - Temporary</option>
                                <option value="Roxas City-Owned Market">Roxas City-Owned Market</option>
                                <option value="San Jose City-Owned Market">San Jose City-Owned Market</option>
                            </select>
                        </div>

                        <div className="flex flex-col gap-[6px]">
                            <label htmlFor="leaseStatus" className="text-[0.85rem] font-semibold text-[#1a202c]">
                                Katayuan ng Lease
                            </label>
                            <select
                                id="leaseStatus"
                                value={leaseStatus}
                                onChange={(e) => setLeaseStatus(e.target.value)}
                                className="w-full px-[14px] py-[10px] border border-[#cbd5e1] rounded-md text-[0.9rem] outline-none transition-all bg-white text-[#718096] appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.36%22%20height%3D%22292.36%22%3E%3Cpath%20fill%3D%22%23718096%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[length:10px] bg-[position:right_14px_center] pr-[35px] focus:border-[#3182ce] focus:ring-[3px] focus:ring-[#3182ce]/15"
                            >
                                <option value="" disabled>-- Select --</option>
                                <option value="Active">Active</option>
                                <option value="Termination Requested">Termination Requested</option>
                                <option value="For Termination">For Termination</option>
                                <option value="Terminated">Terminated</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </div>

                        <div className="flex flex-col gap-[6px]">
                            <label htmlFor="paymentStatus" className="text-[0.85rem] font-semibold text-[#1a202c]">
                                Katayuan ng Pagbabayad
                            </label>
                            <select
                                id="paymentStatus"
                                value={paymentStatus}
                                onChange={(e) => setPaymentStatus(e.target.value)}
                                className="w-full px-[14px] py-[10px] border border-[#cbd5e1] rounded-md text-[0.9rem] outline-none transition-all bg-white text-[#718096] appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.36%22%20height%3D%22292.36%22%3E%3Cpath%20fill%3D%22%23718096%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[length:10px] bg-[position:right_14px_center] pr-[35px] focus:border-[#3182ce] focus:ring-[3px] focus:ring-[#3182ce]/15"
                            >
                                <option value="" disabled>-- Select --</option>
                                <option value="Pending Payment">Pending Payment</option>
                                <option value="For Payment Verification">For Payment Verification</option>
                                <option value="Payment Information Requested">Payment Information Requested</option>
                                <option value="Paid">Paid</option>
                            </select>
                        </div>

                        <div className="flex justify-end col-span-1 lg:col-span-3">
                            <button
                                onClick={handleSearch}
                                className="bg-[#0b2545] text-white border-none px-8 py-[10px] rounded-md font-semibold cursor-pointer transition-colors text-[0.9rem] hover:bg-[#13315c]"
                            >
                                Hanapin
                            </button>
                        </div>

                    </div>


                    {/* Due Date Header */}
                    <div className="p-[16px_24px] font-bold text-[0.9rem] text-[#1a202c]">
                        Due Date: 08/20/2026
                    </div>


                    {/* Table Section */}
                    <div className="w-full overflow-x-auto min-h-[280px] bg-[#f8fafc] border-t border-b border-[#cbd5e1] flex flex-col justify-center">
                        <table className="w-full border-collapse text-left whitespace-nowrap">
                            <thead>
                                <tr>
                                    <th className="bg-[#0b2545] text-white text-[0.75rem] uppercase tracking-[0.5px] p-[12px_14px] font-bold border-r border-white/10">
                                        <div className="flex items-center justify-between gap-[6px]">
                                            <span className="cursor-pointer">LEASE ID</span>
                                            <span className="cursor-pointer">↕</span>
                                        </div>
                                    </th>
                                    <th className="bg-[#0b2545] text-white text-[0.75rem] uppercase tracking-[0.5px] p-[12px_14px] font-bold border-r border-white/10">
                                        <div className="flex items-center justify-between gap-[6px]">
                                            <span className="cursor-pointer">UNANG PANGALAN</span>
                                            <span className="cursor-pointer">↕</span>
                                        </div>
                                    </th>
                                    <th className="bg-[#0b2545] text-white text-[0.75rem] uppercase tracking-[0.5px] p-[12px_14px] font-bold border-r border-white/10">
                                        <div className="flex items-center justify-between gap-[6px]">
                                            <span className="cursor-pointer">APELYIDO</span>
                                            <span className="cursor-pointer">↕</span>
                                        </div>
                                    </th>
                                    <th className="bg-[#0b2545] text-white text-[0.75rem] uppercase tracking-[0.5px] p-[12px_14px] font-bold border-r border-white/10">
                                        <div className="flex items-center justify-between gap-[6px]">
                                            <span className="cursor-pointer">PANGALAN NG PALENGKE</span>
                                            <span></span>
                                        </div>
                                    </th>
                                    <th className="bg-[#0b2545] text-white text-[0.75rem] uppercase tracking-[0.5px] p-[12px_14px] font-bold border-r border-white/10">
                                        <div className="flex items-center justify-between gap-[6px]">
                                            <span className="cursor-pointer">SEKSYON</span>
                                            <span className="cursor-pointer">↕</span>
                                        </div>
                                    </th>
                                    <th className="bg-[#0b2545] text-white text-[0.75rem] uppercase tracking-[0.5px] p-[12px_14px] font-bold border-r border-white/10">
                                        <div className="flex items-center justify-between gap-[6px]">
                                            <span className="cursor-pointer">NUMERO NG STALL</span>
                                            <span className="cursor-pointer">↕</span>
                                        </div>
                                    </th>
                                    <th className="bg-[#0b2545] text-white text-[0.75rem] uppercase tracking-[0.5px] p-[12px_14px] font-bold border-r border-white/10">
                                        <div className="flex items-center justify-between gap-[6px]">
                                            <span className="cursor-pointer">KATAYUAN NG LEASE</span>
                                            <span></span>
                                        </div>
                                    </th>
                                    <th className="bg-[#0b2545] text-white text-[0.75rem] uppercase tracking-[0.5px] p-[12px_14px] font-bold border-r border-white/10">
                                        <div className="flex items-center justify-between gap-[6px]">
                                            <span className="cursor-pointer">HALAGANG DAPAT BAYARAN</span>
                                            <span></span>
                                        </div>
                                    </th>
                                    <th className="bg-[#0b2545] text-white text-[0.75rem] uppercase tracking-[0.5px] p-[12px_14px] font-bold border-r border-white/10">
                                        <div className="flex items-center justify-between gap-[6px]">
                                            <span className="cursor-pointer">HELPER APPROVAL STATUS</span>
                                            <span className="cursor-pointer">⚙</span>
                                        </div>
                                    </th>
                                    <th className="bg-[#0b2545] text-white text-[0.75rem] uppercase tracking-[0.5px] p-[12px_14px] font-bold border-r border-white/10">
                                        <div className="flex items-center justify-between gap-[6px]">
                                            <span className="cursor-pointer">ADVANCE PAYMENT STATUS</span>
                                            <span className="cursor-pointer">⚙</span>
                                        </div>
                                    </th>
                                    <th className="bg-[#0b2545] text-white text-[0.75rem] uppercase tracking-[0.5px] p-[12px_14px] font-bold border-r border-white/10">
                                        <div className="flex items-center justify-between gap-[6px]">
                                            <span className="cursor-pointer">KATAYUAN NG PAGBABAYAD</span>
                                            <span></span>
                                        </div>
                                    </th>
                                    <th className="bg-[#0b2545] text-white text-[0.75rem] uppercase tracking-[0.5px] p-[12px_14px] font-bold">
                                        <div className="flex items-center justify-between gap-[6px]">
                                            <span className="cursor-pointer">AKSYON</span>
                                            <span></span>
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td colSpan={12} className="p-[16px_14px] text-[0.85rem] border-b border-[#e2e8f0] bg-white text-center">
                                        <div className="text-center p-[50px_20px] text-[#718096]">
                                            <div className="w-[40px] h-[40px] mx-auto mb-[10px] opacity-30 bg-[#94a3b8] rounded-[6px]"></div>
                                            <p>No Data</p>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>


                    {/* Footer Controls / Pagination */}
                    <div className="flex flex-col gap-4 p-[20px_24px_10px_24px]">
                        <div className="flex justify-between items-center text-[0.85rem] text-[#718096]">
                            <div>
                                Ipakita{' '}
                                <select
                                    value={entriesCount}
                                    onChange={(e) => setEntriesCount(e.target.value)}
                                    className="p-[4px_8px] border border-[#cbd5e1] rounded-[4px] outline-none text-[#1a202c] bg-white w-auto inline-block"
                                >
                                    <option value="0">0</option>
                                    <option value="10">10</option>
                                    <option value="25">25</option>
                                </select>{' '}
                                ng 0 entries
                            </div>
                            <div className="flex items-center gap-1">
                                <button className="bg-white border border-[#cbd5e1] p-[6px_12px] rounded-[4px] cursor-pointer text-[#1a202c] text-[0.85rem] opacity-40 cursor-not-allowed" disabled>&laquo;</button>
                                <button className="bg-white border border-[#cbd5e1] p-[6px_12px] rounded-[4px] cursor-pointer text-[#1a202c] text-[0.85rem] opacity-40 cursor-not-allowed" disabled>&lsaquo;</button>
                                <button className="border p-[6px_12px] rounded-[4px] cursor-pointer text-[0.85rem] bg-[#0b2545] text-white border-[#0b2545]">1</button>
                                <button className="bg-white border border-[#cbd5e1] p-[6px_12px] rounded-[4px] cursor-pointer text-[#1a202c] text-[0.85rem] opacity-40 cursor-not-allowed" disabled>&rsaquo;</button>
                                <button className="bg-white border border-[#cbd5e1] p-[6px_12px] rounded-[4px] cursor-pointer text-[#1a202c] text-[0.85rem] opacity-40 cursor-not-allowed" disabled>&raquo;</button>
                            </div>
                        </div>

                        <div>
                            <label className="flex items-center gap-2 text-[0.85rem] text-[#1a202c] cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={showInactive}
                                    onChange={(e) => setShowInactive(e.target.checked)}
                                    className="w-4 h-4 cursor-pointer"
                                />
                                Ipakita ang hindi aktibong lease
                            </label>
                        </div>
                    </div>

                </div>

            </main>

        </div>
    );
}