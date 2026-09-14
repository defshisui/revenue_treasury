import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import CitizenLayout from './CitizenLayout';
import { API_BASE_URL } from '../config/api';
import { getLeases, type LeaseRecord } from '../services/marketService';
import { getRPTApplications, type RPTApplicationRecord } from '../services/realpropertytaxService';
import { getHawkerApplications, type HawkerApplicationPayload } from '../services/hawkerservice';

export type ServiceCategory = 'ALL' | 'BUSINESS_TAX' | 'RPT' | 'MARKET_STALL' | 'HAWKER' | 'APPOINTMENT';

export interface UnifiedApplication {
    id: string;
    referenceNumber: string;
    category: ServiceCategory;
    serviceName: string;
    department: string;
    particulars: string;
    applicantName: string;
    applicantEmail?: string;
    status: string;
    paymentStatus?: string;
    amount?: number;
    officialReceiptNumber?: string;
    paymentReference?: string;
    dateFiled: string;
    rawRecord: any;
    targetRoute?: string;
}

export default function ApplicationHistory() {
    const navigate = useNavigate();

    const [user, setUser] = useState<{
        fullname: string;
        email: string;
        firstName: string;
        lastName: string;
    } | null>(null);

    const [selectedCategory, setSelectedCategory] = useState<ServiceCategory>('ALL');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [submittedSearch, setSubmittedSearch] = useState<string>('');
    const [currentPage, setCurrentPage] = useState<number>(1);
    const pageSize = 10;

    const [loading, setLoading] = useState<boolean>(true);
    const [unifiedList, setUnifiedList] = useState<UnifiedApplication[]>([]);
    const [selectedItem, setSelectedItem] = useState<UnifiedApplication | null>(null);

    // Read citizen session
    useEffect(() => {
        const rawData =
            localStorage.getItem('currentUser') ||
            localStorage.getItem('user') ||
            localStorage.getItem('citizen_user') ||
            sessionStorage.getItem('currentUser') ||
            sessionStorage.getItem('user');

        if (rawData) {
            try {
                const parsed = JSON.parse(rawData);
                const target = parsed.user && typeof parsed.user === 'object' ? parsed.user : parsed;
                const fullName = target.fullname || target.name || target.fullName || target.firstName || target.email || 'Citizen';
                const email = target.email || '';
                const parts = String(fullName).trim().split(' ');
                const firstName = parts[0] || 'Citizen';
                const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '';
                setUser({ fullname: String(fullName), email, firstName, lastName });
            } catch (err) {
                console.error('Failed to parse citizen user session:', err);
            }
        }
    }, []);

    // Load and aggregate applications across all modules
    const fetchAllApplications = async () => {
        // Guard: never fetch/filter with an unresolved session. Without this,
        // this function can run once with user === null (before the session
        // is read from storage) and once after — and since both calls are
        // async, the no-user call can resolve last and overwrite the correct,
        // filtered result with an unfiltered one (see isMatch guards below).
        if (!user || !user.email) {
            setUnifiedList([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const combined: UnifiedApplication[] = [];

        const activeEmail = (user.email || '').toLowerCase().trim();
        const activeName = (user.fullname || '').toLowerCase().trim();

        // 1. Business Tax Assessments
        try {
            const btaxRes = await fetch(`${API_BASE_URL}/business-assessments?limit=100`);
            if (btaxRes.ok) {
                const btaxData = await btaxRes.json();
                const list = Array.isArray(btaxData) ? btaxData : (btaxData.assessments || []);
                list.forEach((item: any) => {
                    const itemEmail = (item.email || '').toLowerCase().trim();
                    const itemOwner = (item.businessOwner || item.business_owner || '').toLowerCase().trim();

                    // Match user (never fall back to "match everything" — an
                    // empty activeEmail must never be treated as a wildcard)
                    const isMatch = itemEmail === activeEmail || (!!activeName && itemOwner.includes(activeName));
                    if (isMatch) {
                        combined.push({
                            id: `btax-${item.id || item.trackingNumber}`,
                            referenceNumber: item.trackingNumber || item.tracking_number || item.id,
                            category: 'BUSINESS_TAX',
                            serviceName: 'Business Tax Assessment',
                            department: "City Treasurer's Office",
                            particulars: `${item.businessName || item.business_name || 'Business Permit'} (${item.taxBillNumber || 'Pending Tax Bill'})`,
                            applicantName: item.businessOwner || item.business_owner || user?.fullname || 'Taxpayer',
                            applicantEmail: item.email || user?.email,
                            status: item.status || 'PENDING',
                            paymentStatus: item.paymentStatus || (String(item.remarks || '').toLowerCase().includes('paid') ? 'PAID' : 'UNPAID'),
                            amount: item.computedFees?.total || item.grossSales || 0,
                            officialReceiptNumber: item.officialReceiptNumber || '',
                            dateFiled: item.applicationDate || item.application_date || new Date().toISOString(),
                            rawRecord: item,
                            targetRoute: '/business-tax-assessment',
                        });
                    }
                });
            }
        } catch (err) {
            console.warn('Could not load business tax applications:', err);
        }

        // 2. Real Property Tax Applications
        try {
            const rptApps = await getRPTApplications();
            rptApps.forEach((item: RPTApplicationRecord) => {
                const itemEmail = (item.email || '').toLowerCase().trim();
                const itemApplicant = (item.applicantName || item.ownerName || '').toLowerCase().trim();

                const isMatch = itemEmail === activeEmail || (!!activeName && itemApplicant.includes(activeName));
                if (isMatch) {
                    combined.push({
                        id: `rpt-${item.id}`,
                        referenceNumber: item.controlNumber || item.referenceNumber || item.id,
                        category: 'RPT',
                        serviceName: `Real Property Tax (${item.service || 'Assessment / Transfer'})`,
                        department: "City Assessor & Treasury Office",
                        particulars: `TDN: ${item.taxDeclarationNumber || item.pin || 'Pending TDN'} • ${item.propertyType || 'Real Property'} (${item.barangay || 'City'})`,
                        applicantName: item.applicantName || item.ownerName || user?.fullname || 'Property Owner',
                        applicantEmail: item.email || user?.email,
                        status: item.status || 'Submitted',
                        paymentStatus: item.paymentStatus || 'Pending',
                        amount: item.paymentAmount || 0,
                        officialReceiptNumber: item.officialReceiptNumber || '',
                        paymentReference: item.paymentReference || '',
                        dateFiled: item.filedDate || item.created_at || new Date().toISOString(),
                        rawRecord: item,
                        targetRoute: '/citizen-rpt',
                    });
                }
            });
        } catch (err) {
            console.warn('Could not load RPT applications:', err);
        }

        // 3. Market Stall Applications & Leases
        try {
            const marketLeases = await getLeases();
            marketLeases.forEach((item: LeaseRecord & { id?: string; createdAt?: string }) => {
                const holder = `${item.firstName || ''} ${item.lastName || ''}`.toLowerCase().trim();
                const isMatch = !!activeName && (holder.includes(activeName) || activeName.includes(holder));

                if (isMatch) {
                    combined.push({
                        id: `market-${item.leaseId || item.id}`,
                        referenceNumber: item.leaseId || `LEASE-${item.id}`,
                        category: 'MARKET_STALL',
                        serviceName: 'City-Owned Market Stall Lease',
                        department: 'Market Development & Administration (MDAD)',
                        particulars: `${item.marketName} • Stall #${item.stallNumber} (${item.section})`,
                        applicantName: `${item.firstName} ${item.lastName}`.trim(),
                        applicantEmail: user?.email,
                        status: item.leaseStatus || 'Active',
                        paymentStatus: item.paymentStatus || 'Pending Payment',
                        amount: item.amountDue || 0,
                        officialReceiptNumber: item.officialReceiptNumber || '',
                        paymentReference: item.paymentReference || '',
                        dateFiled: item.createdAt || new Date().toISOString(),
                        rawRecord: item,
                        targetRoute: '/citizen-portal-stall-status',
                    });
                }
            });
        } catch (err) {
            console.warn('Could not load market leases:', err);
        }

        // 4. Hawker & Street Vendor Registrations
        try {
            const hawkers = await getHawkerApplications();
            hawkers.forEach((item: HawkerApplicationPayload) => {
                const submitter = (item.submitterEmail || item.chairperson?.email || '').toLowerCase().trim();
                const chairName = `${item.chairperson?.firstName || ''} ${item.chairperson?.lastName || ''}`.toLowerCase().trim();

                const isMatch = submitter === activeEmail || (!!activeName && chairName.includes(activeName));
                if (isMatch) {
                    combined.push({
                        id: `hawker-${item.id || item.associationNumber}`,
                        referenceNumber: item.associationNumber || item.id,
                        category: 'HAWKER',
                        serviceName: 'Hawkers & Street Vendors Association Registration',
                        department: 'Market Development & Administration (MDAD)',
                        particulars: `${item.associationName} (SEC Reg: ${item.secRegistrationNo || 'Pending'})`,
                        applicantName: `${item.chairperson?.firstName || ''} ${item.chairperson?.lastName || ''}`.trim() || item.submittedBy,
                        applicantEmail: item.chairperson?.email || item.submitterEmail,
                        status: item.status || 'New',
                        paymentStatus: 'Exempt / Processed',
                        dateFiled: item.submissionDate || new Date().toISOString(),
                        rawRecord: item,
                        targetRoute: '/hawker-application',
                    });
                }
            });
        } catch (err) {
            console.warn('Could not load hawker applications:', err);
        }

        // 5. Scheduled Appointments
        try {
            const aptRes = await fetch(`${API_BASE_URL}/appointments?email=${encodeURIComponent(activeEmail)}`);
            if (aptRes.ok) {
                const aptData = await aptRes.json();
                const appointments = Array.isArray(aptData) ? aptData : (aptData.appointments || []);
                appointments.forEach((item: any) => {
                    combined.push({
                        id: `apt-${item.id}`,
                        referenceNumber: `APT-${item.id.slice(0, 8).toUpperCase()}`,
                        category: 'APPOINTMENT',
                        serviceName: `Appointment (${item.appointmentType || 'Consultation'})`,
                        department: item.department || "City Treasurer's Office",
                        particulars: `Scheduled: ${item.date} ${item.timeSlot ? `• ${item.timeSlot}` : ''} (${item.businessName || 'General Service'})`,
                        applicantName: item.fullName || user?.fullname || 'Citizen',
                        applicantEmail: item.email || user?.email,
                        status: item.status || 'PENDING',
                        paymentStatus: 'N/A',
                        dateFiled: item.createdAt || item.date || new Date().toISOString(),
                        rawRecord: item,
                        targetRoute: '/business-tax-assessment?tab=appointments',
                    });
                });
            }
        } catch (err) {
            console.warn('Could not load appointments:', err);
        }

        // Sort descending by date
        combined.sort((a, b) => {
            const timeA = new Date(a.dateFiled).getTime() || 0;
            const timeB = new Date(b.dateFiled).getTime() || 0;
            return timeB - timeA;
        });

        setUnifiedList(combined);
        setLoading(false);
    };

    useEffect(() => {
        fetchAllApplications();
    }, [user]);

    // Filter and search
    const filteredList = useMemo(() => {
        let list = [...unifiedList];

        if (selectedCategory !== 'ALL') {
            list = list.filter((item) => item.category === selectedCategory);
        }

        if (statusFilter !== 'ALL') {
            list = list.filter((item) => {
                const st = (item.status || '').toUpperCase();
                const pay = (item.paymentStatus || '').toUpperCase();
                if (statusFilter === 'PAID') return pay.includes('PAID');
                if (statusFilter === 'UNPAID') return !pay.includes('PAID') && pay !== 'N/A';
                return st.includes(statusFilter.toUpperCase());
            });
        }

        if (submittedSearch.trim()) {
            const q = submittedSearch.trim().toLowerCase();
            list = list.filter((item) =>
                (item.referenceNumber || '').toLowerCase().includes(q) ||
                (item.serviceName || '').toLowerCase().includes(q) ||
                (item.particulars || '').toLowerCase().includes(q) ||
                (item.applicantName || '').toLowerCase().includes(q) ||
                (item.department || '').toLowerCase().includes(q)
            );
        }

        return list;
    }, [unifiedList, selectedCategory, statusFilter, submittedSearch]);

    // Pagination
    const totalPages = Math.max(1, Math.ceil(filteredList.length / pageSize));
    const paginatedList = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredList.slice(start, start + pageSize);
    }, [filteredList, currentPage, pageSize]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmittedSearch(searchQuery);
        setCurrentPage(1);
    };

    const getCategoryBadge = (category: ServiceCategory) => {
        switch (category) {
            case 'BUSINESS_TAX':
                return <span className="bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-bold px-2 py-0.5 rounded text-[10px]">Business Tax</span>;
            case 'RPT':
                return <span className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 font-bold px-2 py-0.5 rounded text-[10px]">Real Property Tax</span>;
            case 'MARKET_STALL':
                return <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold px-2 py-0.5 rounded text-[10px]">Market Stall</span>;
            case 'HAWKER':
                return <span className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-bold px-2 py-0.5 rounded text-[10px]">Hawkers &amp; Vendors</span>;
            case 'APPOINTMENT':
                return <span className="bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 font-bold px-2 py-0.5 rounded text-[10px]">Appointment</span>;
            default:
                return <span className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 font-bold px-2 py-0.5 rounded text-[10px]">General Service</span>;
        }
    };

    const getStatusBadge = (status: string) => {
        const s = (status || '').toUpperCase();
        if (s.includes('APPROV') || s.includes('ACTIVE') || s.includes('COMPLET')) {
            return <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold px-2.5 py-0.5 rounded text-[10px] uppercase">{status}</span>;
        }
        if (s.includes('PENDING') || s.includes('SUBMIT') || s.includes('NEW') || s.includes('REVIEW')) {
            return <span className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-bold px-2.5 py-0.5 rounded text-[10px] uppercase">{status}</span>;
        }
        if (s.includes('REJECT') || s.includes('CANCEL') || s.includes('TERMINAT')) {
            return <span className="bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 font-bold px-2.5 py-0.5 rounded text-[10px] uppercase">{status}</span>;
        }
        return <span className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 font-bold px-2.5 py-0.5 rounded text-[10px] uppercase">{status}</span>;
    };

    const getPaymentBadge = (payStatus?: string) => {
        if (!payStatus || payStatus === 'N/A') {
            return <span className="text-slate-400 dark:text-slate-500 font-mono text-[10px]">N/A</span>;
        }
        const p = payStatus.toUpperCase();
        if (p.includes('PAID') || p.includes('EXEMPT') || p.includes('COMPLETED')) {
            return <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold px-2 py-0.5 rounded text-[10px] uppercase">PAID</span>;
        }
        return <span className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-bold px-2 py-0.5 rounded text-[10px] uppercase">UNPAID</span>;
    };

    return (
        <CitizenLayout activeTitle="Application History" activeNav="history">
            <div className="flex flex-col justify-between w-full">
                <div>
                    {/* Top Hero Banner Matching Design System */}
                    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8 relative bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 h-36 sm:h-48 overflow-hidden flex items-center justify-center border-b-4 border-blue-600">
                        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]"></div>

                        <div className="relative z-10 text-center px-4">
                            <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-wide uppercase">
                                2026 Citizen Application &amp; Transaction History
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-200 mt-1 max-w-xl mx-auto">
                                View and monitor all your filed applications, assessments, appointments, and payments across all municipal services.
                            </p>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="max-w-6xl mx-auto px-4 py-6">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 space-y-6">
                            {/* Search and Filters */}
                            <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                                <div className="md:col-span-3">
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Service Category
                                    </label>
                                    <select
                                        value={selectedCategory}
                                        onChange={(e) => {
                                            setSelectedCategory(e.target.value as ServiceCategory);
                                            setCurrentPage(1);
                                        }}
                                        className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-900"
                                    >
                                        <option value="ALL">All Services</option>
                                        <option value="BUSINESS_TAX">Business Tax</option>
                                        <option value="RPT">Real Property Tax</option>
                                        <option value="MARKET_STALL">Market Stalls</option>
                                        <option value="HAWKER">Hawkers &amp; Vendors</option>
                                        <option value="APPOINTMENT">Appointments</option>
                                    </select>
                                </div>

                                <div className="md:col-span-3">
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Filter by Status
                                    </label>
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => {
                                            setStatusFilter(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-900"
                                    >
                                        <option value="ALL">ALL STATUSES</option>
                                        <option value="PENDING">Pending / Under Review</option>
                                        <option value="APPROVED">Approved / Active</option>
                                        <option value="PAID">Paid / Settled</option>
                                        <option value="UNPAID">Unpaid / Payment Due</option>
                                        <option value="REJECTED">Rejected / Terminated</option>
                                    </select>
                                </div>

                                <div className="md:col-span-6 flex gap-2">
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                            Search Applications:
                                        </label>
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search by Tracking/Reference No, Particulars, Department..."
                                            className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-900"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        className="self-end bg-blue-900 hover:bg-blue-950 text-white font-bold px-5 py-2.5 rounded-lg text-xs transition-colors whitespace-nowrap cursor-pointer shadow-sm"
                                    >
                                        Search
                                    </button>
                                </div>
                            </form>

                            {/* Applications Table */}
                            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="bg-blue-900 dark:bg-blue-950 text-white font-bold uppercase tracking-wider text-[11px]">
                                            <th className="py-3 px-4">Tracking/Reference No. ↕</th>
                                            <th className="py-3 px-4">Service Category</th>
                                            <th className="py-3 px-4">Details &amp; Particulars</th>
                                            <th className="py-3 px-4">Applicant</th>
                                            <th className="py-3 px-4">Application Status</th>
                                            <th className="py-3 px-4">Payment Status</th>
                                            <th className="py-3 px-4">Date Filed</th>
                                            <th className="py-3 px-4 text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={8} className="py-12 text-center text-slate-400">
                                                    <div className="inline-block animate-spin rounded-full h-7 w-7 border-4 border-blue-600 border-t-transparent mb-2"></div>
                                                    <p className="text-xs font-semibold">Loading all citizen application records...</p>
                                                </td>
                                            </tr>
                                        ) : paginatedList.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-slate-500">
                                                    <svg className="w-10 h-10 mx-auto mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                    <p className="text-xs font-bold uppercase tracking-wider">No Application Records Found</p>
                                                    <p className="text-[11px] text-slate-400 mt-1">Applications filed across any municipal service will appear here.</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            paginatedList.map((item) => {
                                                const formattedDate = item.dateFiled
                                                    ? new Date(item.dateFiled).toLocaleDateString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric' })
                                                    : '9/13/2026';

                                                return (
                                                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                        <td className="py-3 px-4 font-mono font-bold text-blue-900 dark:text-blue-400">
                                                            {item.referenceNumber}
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            {getCategoryBadge(item.category)}
                                                        </td>
                                                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium max-w-xs truncate" title={item.particulars}>
                                                            {item.particulars}
                                                        </td>
                                                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                                                            {item.applicantName}
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            {getStatusBadge(item.status)}
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            {getPaymentBadge(item.paymentStatus)}
                                                        </td>
                                                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                                                            {formattedDate}
                                                        </td>
                                                        <td className="py-3 px-4 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedItem(item)}
                                                                className="text-blue-700 dark:text-blue-400 hover:text-blue-900 font-bold hover:underline cursor-pointer"
                                                            >
                                                                View
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Controls */}
                            <div className="flex justify-between items-center pt-2 text-xs text-slate-500 dark:text-slate-400">
                                <div>
                                    Showing page {currentPage} of {totalPages} ({filteredList.length} total entries)
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${currentPage === 1
                                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-50 cursor-pointer'
                                            }`}
                                    >
                                        Previous
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${currentPage === totalPages
                                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-50 cursor-pointer'
                                            }`}
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Application Detail Modal */}
            {selectedItem && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="bg-blue-900 px-6 py-4 flex justify-between items-center text-white">
                            <div>
                                <span className="text-[10px] uppercase font-bold text-blue-300 tracking-wider">{selectedItem.serviceName}</span>
                                <h3 className="text-base font-extrabold">{selectedItem.referenceNumber}</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedItem(null)}
                                className="text-white/80 hover:text-white text-lg font-bold p-1 cursor-pointer"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="p-6 space-y-5 text-xs text-slate-700 dark:text-slate-300 max-h-[75vh] overflow-y-auto">
                            {/* Summary Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                                <div>
                                    <span className="block text-[10px] uppercase font-bold text-slate-400">Department</span>
                                    <span className="font-bold text-slate-900 dark:text-white text-xs">{selectedItem.department}</span>
                                </div>
                                <div>
                                    <span className="block text-[10px] uppercase font-bold text-slate-400">Applicant Name</span>
                                    <span className="font-bold text-slate-900 dark:text-white text-xs">{selectedItem.applicantName}</span>
                                </div>
                                <div>
                                    <span className="block text-[10px] uppercase font-bold text-slate-400">Application Status</span>
                                    <div className="mt-0.5">{getStatusBadge(selectedItem.status)}</div>
                                </div>
                                <div>
                                    <span className="block text-[10px] uppercase font-bold text-slate-400">Payment Status</span>
                                    <div className="mt-0.5">{getPaymentBadge(selectedItem.paymentStatus)}</div>
                                </div>
                                <div>
                                    <span className="block text-[10px] uppercase font-bold text-slate-400">Amount Assessment</span>
                                    <span className="font-extrabold text-blue-900 dark:text-blue-400 text-sm">
                                        {selectedItem.amount ? `₱${Number(selectedItem.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : 'N/A'}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-[10px] uppercase font-bold text-slate-400">Date Filed</span>
                                    <span className="font-mono text-slate-800 dark:text-slate-200">
                                        {new Date(selectedItem.dateFiled).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                                    </span>
                                </div>
                            </div>

                            {/* Particulars & Additional info */}
                            <div className="space-y-3 border-t border-slate-200 dark:border-slate-800 pt-4">
                                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                                    Application Particulars &amp; Details
                                </h4>
                                <div className="p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                                        {selectedItem.particulars}
                                    </p>
                                </div>

                                {selectedItem.officialReceiptNumber && (
                                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between">
                                        <div>
                                            <span className="block text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400">Official Receipt (O.R.) Issued</span>
                                            <span className="font-mono font-black text-emerald-900 dark:text-emerald-200 text-sm">{selectedItem.officialReceiptNumber}</span>
                                        </div>
                                        <span className="text-[10px] font-bold bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 px-2 py-0.5 rounded">Validated</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-slate-50 dark:bg-slate-800/80 px-6 py-4 flex justify-between items-center border-t border-slate-200 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() => setSelectedItem(null)}
                                className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
                            >
                                Close
                            </button>

                            {selectedItem.targetRoute && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        navigate(selectedItem.targetRoute!);
                                    }}
                                    className="px-5 py-2 bg-blue-900 hover:bg-blue-950 text-white rounded-lg text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer"
                                >
                                    Open Service Portal &rarr;
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </CitizenLayout>
    );
}