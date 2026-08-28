import { useState, useEffect } from 'react';
import { getLeases } from '../services/marketService';
import type { LeaseRecord } from '../services/marketService';
import { UnifiedHeader } from './UnifiedHeader';

export default function MarketLeaseSearch() {
    const [leaseId, setLeaseId] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [marketName, setMarketName] = useState('');
    const [leaseStatus, setLeaseStatus] = useState('');
    const [paymentStatus, setPaymentStatus] = useState('');
    const [entriesCount, setEntriesCount] = useState('10');
    const [showInactive, setShowInactive] = useState(false);

    // Data States
    const [allLeases, setAllLeases] = useState<LeaseRecord[]>([]);
    const [filteredLeases, setFilteredLeases] = useState<LeaseRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Helper to get active session user details
    const checkUserSession = () => {
        const rawData = localStorage.getItem('currentUser') ||
            localStorage.getItem('user') ||
            localStorage.getItem('citizen_user') ||
            sessionStorage.getItem('currentUser') ||
            sessionStorage.getItem('user');

        if (!rawData) return null;

        try {
            const parsed = JSON.parse(rawData);
            const target = parsed.user && typeof parsed.user === 'object' ? parsed.user : parsed;

            const fullName = target.fullname || target.name || target.fullName || target.firstName || target.email || "User";
            const email = target.email || "";
            const nameParts = String(fullName).trim().split(" ");
            const firstName = nameParts[0];
            const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

            return { fullname: String(fullName), email, firstName, lastName };
        } catch (e) {
            console.error("Failed to parse user session", e);
            return null;
        }
    };

    // Fetch leases on component mount and filter strictly to the user's own records
    useEffect(() => {
        const fetchLeases = async () => {
            setIsLoading(true);
            try {
                const session = checkUserSession();
                const data = await getLeases();

                if (session) {
                    // Pre-fill search inputs with user's own name
                    setFirstName(session.firstName);
                    setLastName(session.lastName);

                    // Filter so they can ONLY see their own leases
                    const userLeases = data.filter(l => {
                        const sessionName = session.fullname.toLowerCase();
                        const lFirst = l.firstName.toLowerCase();
                        const lLast = l.lastName.toLowerCase();

                        return (lFirst === session.firstName.toLowerCase() && lLast === session.lastName.toLowerCase()) ||
                            (sessionName.includes(lFirst) && sessionName.includes(lLast));
                    });

                    setAllLeases(userLeases);
                } else {
                    // If not logged in, enforce security by hiding all records
                    setAllLeases([]);
                }
            } catch (err) {
                console.error("Error fetching lease records:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchLeases();
    }, []);

    // Filter logic dependent on search parameters and allLeases data
    useEffect(() => {
        handleSearch();
    }, [allLeases, showInactive]); // Re-run if data loads or toggle changes

    const handleSearch = () => {
        let result = [...allLeases];

        if (leaseId) {
            result = result.filter(l => l.leaseId.toLowerCase().includes(leaseId.toLowerCase()));
        }
        // First/Last name matching is handled intrinsically by the security filter above,
        // but we retain these just in case they have minor variations in their own name records.
        if (firstName) {
            result = result.filter(l => l.firstName.toLowerCase().includes(firstName.toLowerCase()));
        }
        if (lastName) {
            result = result.filter(l => l.lastName.toLowerCase().includes(lastName.toLowerCase()));
        }
        if (marketName) {
            result = result.filter(l => l.marketName.toLowerCase().includes(marketName.toLowerCase()));
        }
        if (leaseStatus) {
            result = result.filter(l => l.leaseStatus === leaseStatus);
        }
        if (paymentStatus) {
            result = result.filter(l => l.paymentStatus === paymentStatus);
        }

        // Handle inactive filter toggle
        if (!showInactive) {
            result = result.filter(l => l.leaseStatus !== 'Inactive' && l.leaseStatus !== 'Terminated');
        }

        setFilteredLeases(result);
    };

    const handleBack = () => {
        window.history.back();
    };

    return (
        <div className="w-full min-h-screen bg-[#eef2f6] font-['Segoe_UI',Tahoma,Geneva,Verdana,sans-serif] text-[#1a202c] flex flex-col pb-12">

            {/* Reusable Header */}
            <UnifiedHeader />

            {/* =====================================================
                MAIN CONTENT AREA
            ====================================================== */}
            <main className="flex-grow p-[30px_40px] flex justify-center mt-6">
                <div className="w-full max-w-[1400px] bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden flex flex-col pb-5">

                    {/* Top Header Bar inside card with Back Button */}
                    <div className="flex justify-between items-center p-[20px_24px] border-b-2 border-[#e2e8f0]">
                        <h2 className="text-[1.1rem] font-bold text-[#1a202c] tracking-[0.5px] border-l-4 border-[#0a369d] pl-3 uppercase">
                            My Active Market Leases
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
                            <label htmlFor="leaseId" className="text-[0.85rem] font-semibold text-[#1a202c]">Lease ID</label>
                            <input
                                type="text" id="leaseId" value={leaseId} onChange={(e) => setLeaseId(e.target.value)}
                                className="w-full px-[14px] py-[10px] border border-[#cbd5e1] rounded-md text-[0.9rem] outline-none transition-all bg-white text-[#1a202c] focus:border-[#3182ce] focus:ring-[3px] focus:ring-[#3182ce]/15"
                            />
                        </div>

                        {/* Name fields locked to active user account to reflect individual portal logic */}
                        <div className="flex flex-col gap-[6px]">
                            <label htmlFor="firstName" className="text-[0.85rem] font-semibold text-[#1a202c]">Unang Pangalan ng Stallholder</label>
                            <input
                                type="text" id="firstName" value={firstName} readOnly disabled
                                className="w-full px-[14px] py-[10px] border border-[#cbd5e1] rounded-md text-[0.9rem] outline-none transition-all bg-slate-100 text-slate-500 cursor-not-allowed"
                            />
                        </div>

                        <div className="flex flex-col gap-[6px]">
                            <label htmlFor="lastName" className="text-[0.85rem] font-semibold text-[#1a202c]">Apelyido ng Stallholder</label>
                            <input
                                type="text" id="lastName" value={lastName} readOnly disabled
                                className="w-full px-[14px] py-[10px] border border-[#cbd5e1] rounded-md text-[0.9rem] outline-none transition-all bg-slate-100 text-slate-500 cursor-not-allowed"
                            />
                        </div>

                        <div className="flex flex-col gap-[6px]">
                            <label htmlFor="marketName" className="text-[0.85rem] font-semibold text-[#1a202c]">Pangalan ng Palengke</label>
                            <select
                                id="marketName" value={marketName} onChange={(e) => setMarketName(e.target.value)}
                                className="w-full px-[14px] py-[10px] border border-[#cbd5e1] rounded-md text-[0.9rem] outline-none transition-all bg-white text-[#718096] appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.36%22%20height%3D%22292.36%22%3E%3Cpath%20fill%3D%22%23718096%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[length:10px] bg-[position:right_14px_center] pr-[35px] focus:border-[#3182ce] focus:ring-[3px] focus:ring-[#3182ce]/15"
                            >
                                <option value="">-- All Markets --</option>
                                <option value="Galas City-Owned Market">Galas City-Owned Market</option>
                                <option value="Kamuning City-Owned Market">Kamuning City-Owned Market</option>
                                <option value="Murphy City-owned Market">Murphy City-owned Market</option>
                                <option value="Project 2 City-Owned Market">Project 2 City-Owned Market</option>
                                <option value="Project 4 City-Owned Market">Project 4 City-Owned Market</option>
                                <option value="R.A. Calalay City-Owned Market">R.A. Calalay City-Owned Market</option>
                                <option value="Roxas City-Owned Market">Roxas City-Owned Market</option>
                                <option value="San Jose City-Owned Market">San Jose City-Owned Market</option>
                            </select>
                        </div>

                        <div className="flex flex-col gap-[6px]">
                            <label htmlFor="leaseStatus" className="text-[0.85rem] font-semibold text-[#1a202c]">Katayuan ng Lease</label>
                            <select
                                id="leaseStatus" value={leaseStatus} onChange={(e) => setLeaseStatus(e.target.value)}
                                className="w-full px-[14px] py-[10px] border border-[#cbd5e1] rounded-md text-[0.9rem] outline-none transition-all bg-white text-[#718096] appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.36%22%20height%3D%22292.36%22%3E%3Cpath%20fill%3D%22%23718096%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[length:10px] bg-[position:right_14px_center] pr-[35px] focus:border-[#3182ce] focus:ring-[3px] focus:ring-[#3182ce]/15"
                            >
                                <option value="">-- All Statuses --</option>
                                <option value="Active">Active</option>
                                <option value="Termination Requested">Termination Requested</option>
                                <option value="For Termination">For Termination</option>
                                <option value="Terminated">Terminated</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </div>

                        <div className="flex flex-col gap-[6px]">
                            <label htmlFor="paymentStatus" className="text-[0.85rem] font-semibold text-[#1a202c]">Katayuan ng Pagbabayad</label>
                            <select
                                id="paymentStatus" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}
                                className="w-full px-[14px] py-[10px] border border-[#cbd5e1] rounded-md text-[0.9rem] outline-none transition-all bg-white text-[#718096] appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.36%22%20height%3D%22292.36%22%3E%3Cpath%20fill%3D%22%23718096%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[length:10px] bg-[position:right_14px_center] pr-[35px] focus:border-[#3182ce] focus:ring-[3px] focus:ring-[#3182ce]/15"
                            >
                                <option value="">-- All Payment Statuses --</option>
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
                    <div className="p-[16px_24px] font-bold text-[0.9rem] text-[#1a202c] flex justify-between items-center">
                        <span>Due Date: 08/20/2026</span>
                        <span className="text-[0.75rem] font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200 shadow-sm">
                            Showing {filteredLeases.length} results
                        </span>
                    </div>

                    {/* Table Section */}
                    <div className="w-full overflow-x-auto min-h-[280px] bg-[#f8fafc] border-t border-b border-[#cbd5e1] flex flex-col justify-start">
                        <table className="w-full border-collapse text-left whitespace-nowrap">
                            <thead>
                                <tr>
                                    <th className="bg-[#0b2545] text-white text-[0.75rem] uppercase tracking-[0.5px] p-[12px_14px] font-bold border-r border-white/10">LEASE ID</th>
                                    <th className="bg-[#0b2545] text-white text-[0.75rem] uppercase tracking-[0.5px] p-[12px_14px] font-bold border-r border-white/10">UNANG PANGALAN</th>
                                    <th className="bg-[#0b2545] text-white text-[0.75rem] uppercase tracking-[0.5px] p-[12px_14px] font-bold border-r border-white/10">APELYIDO</th>
                                    <th className="bg-[#0b2545] text-white text-[0.75rem] uppercase tracking-[0.5px] p-[12px_14px] font-bold border-r border-white/10">PANGALAN NG PALENGKE</th>
                                    <th className="bg-[#0b2545] text-white text-[0.75rem] uppercase tracking-[0.5px] p-[12px_14px] font-bold border-r border-white/10">SEKSYON</th>
                                    <th className="bg-[#0b2545] text-white text-[0.75rem] uppercase tracking-[0.5px] p-[12px_14px] font-bold border-r border-white/10">STALL NO.</th>
                                    <th className="bg-[#0b2545] text-white text-[0.75rem] uppercase tracking-[0.5px] p-[12px_14px] font-bold border-r border-white/10">KATAYUAN NG LEASE</th>
                                    <th className="bg-[#0b2545] text-white text-[0.75rem] uppercase tracking-[0.5px] p-[12px_14px] font-bold border-r border-white/10">HALAGANG DAPAT BAYARAN</th>
                                    <th className="bg-[#0b2545] text-white text-[0.75rem] uppercase tracking-[0.5px] p-[12px_14px] font-bold border-r border-white/10">HELPER APPROVAL</th>
                                    <th className="bg-[#0b2545] text-white text-[0.75rem] uppercase tracking-[0.5px] p-[12px_14px] font-bold border-r border-white/10">ADVANCE PAYMENT</th>
                                    <th className="bg-[#0b2545] text-white text-[0.75rem] uppercase tracking-[0.5px] p-[12px_14px] font-bold border-r border-white/10">KATAYUAN NG PAGBABAYAD</th>
                                    <th className="bg-[#0b2545] text-white text-[0.75rem] uppercase tracking-[0.5px] p-[12px_14px] font-bold">AKSYON</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={12} className="p-[16px_14px] text-[0.85rem] border-b border-[#e2e8f0] bg-white text-center">
                                            <div className="text-center p-[50px_20px] text-[#718096]">
                                                <p className="font-semibold animate-pulse">Loading lease records...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredLeases.length > 0 ? (
                                    filteredLeases.map((lease) => (
                                        <tr key={lease.leaseId} className="border-b border-[#e2e8f0] bg-white hover:bg-slate-50 transition-colors text-[0.85rem] text-[#1a202c]">
                                            <td className="p-[12px_14px] font-medium text-blue-800">{lease.leaseId}</td>
                                            <td className="p-[12px_14px] capitalize">{lease.firstName}</td>
                                            <td className="p-[12px_14px] capitalize">{lease.lastName}</td>
                                            <td className="p-[12px_14px]">{lease.marketName}</td>
                                            <td className="p-[12px_14px]">{lease.section}</td>
                                            <td className="p-[12px_14px] text-center font-semibold">{lease.stallNumber}</td>
                                            <td className="p-[12px_14px]">
                                                <span className={`px-2 py-1 rounded-[4px] text-[0.7rem] font-bold uppercase tracking-wider ${lease.leaseStatus === 'Active' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                                    lease.leaseStatus === 'Terminated' || lease.leaseStatus === 'Inactive' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                                                        'bg-amber-100 text-amber-800 border border-amber-200'
                                                    }`}>
                                                    {lease.leaseStatus}
                                                </span>
                                            </td>
                                            <td className="p-[12px_14px] font-semibold">
                                                {lease.amountDue.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}
                                            </td>
                                            <td className="p-[12px_14px]">{lease.helperApprovalStatus}</td>
                                            <td className="p-[12px_14px]">{lease.advancePaymentStatus}</td>
                                            <td className="p-[12px_14px]">
                                                <span className={`px-2 py-1 rounded-[4px] text-[0.7rem] font-bold uppercase tracking-wider ${lease.paymentStatus === 'Paid' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                                    'bg-amber-100 text-amber-800 border border-amber-200'
                                                    }`}>
                                                    {lease.paymentStatus}
                                                </span>
                                            </td>
                                            <td className="p-[12px_14px]">
                                                <button className="text-blue-600 hover:text-blue-800 font-semibold hover:underline text-[0.8rem]">View Details</button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={12} className="p-[16px_14px] text-[0.85rem] border-b border-[#e2e8f0] bg-white text-center">
                                            <div className="text-center p-[50px_20px] text-[#718096]">
                                                <div className="w-[40px] h-[40px] mx-auto mb-[10px] opacity-30 bg-[#94a3b8] rounded-[6px]"></div>
                                                <p>No Active Leases Found for Your Account</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
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
                                ng {filteredLeases.length} entries
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