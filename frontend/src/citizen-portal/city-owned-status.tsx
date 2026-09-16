import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import CitizenLayout from './CitizenLayout';
import { getLeases, updateLease, type LeaseRecord } from '../services/marketService';
import { API_BASE_URL } from '../config/api';
import {
    createPayMongoQrPaymentIntent,
    createQrPhPaymentMethod,
    attachQrPhPaymentMethod,
} from '../services/paymongoService';

interface EnrichedLeaseRecord extends LeaseRecord {
    id?: string;
    createdAt?: string;
    paymentDate?: string;
}

export default function ApplicationList() {
    const navigate = useNavigate();

    const [user, setUser] = useState<{
        fullname: string;
        email: string;
        firstName: string;
        lastName: string;
    } | null>(null);

    const [leases, setLeases] = useState<EnrichedLeaseRecord[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [searchType, setSearchType] = useState<string>('Tracking/Lease No.');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [submittedSearch, setSubmittedSearch] = useState<string>('');
    const [currentPage, setCurrentPage] = useState<number>(1);
    const pageSize = 10;

    // View Modal State
    const [selectedLease, setSelectedLease] = useState<EnrichedLeaseRecord | null>(null);

    // QR Payment Flow
    const [isPaymentStep, setIsPaymentStep] = useState<boolean>(false);
    const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
    const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
    const [qrReferenceNumber, setQrReferenceNumber] = useState<string>('');
    const [qrPaymentIntentId, setQrPaymentIntentId] = useState<string>('');
    const [qrError, setQrError] = useState<string>('');
    const [qrSecondsRemaining, setQrSecondsRemaining] = useState<number>(300);
    const [qrPaymentPaid, setQrPaymentPaid] = useState<boolean>(false);
    const [paymentConfirmedAt, setPaymentConfirmedAt] = useState<Date | null>(null);
    const [isPaymentSuccess, setIsPaymentSuccess] = useState<boolean>(false);

    // Citizen Proof Submission State
    const [isProofModalOpen, setIsProofModalOpen] = useState<boolean>(false);
    const [proofRefNumber, setProofRefNumber] = useState<string>('');
    const [proofImage, setProofImage] = useState<string>('');
    const [proofNotes, setProofNotes] = useState<string>('');
    const [isSubmittingProof, setIsSubmittingProof] = useState<boolean>(false);

    const handleProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setProofImage(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleOpenProofModal = (lease: EnrichedLeaseRecord) => {
        setSelectedLease(lease);
        setProofRefNumber(lease.paymentReference || '');
        setProofImage('');
        setProofNotes('');
        setIsProofModalOpen(true);
    };

    const handleSubmitProof = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedLease) return;
        if (!proofRefNumber && !proofImage && !proofNotes) {
            alert('Please provide at least a transaction reference number or receipt upload.');
            return;
        }
        setIsSubmittingProof(true);
        try {
            const updatedRecord: EnrichedLeaseRecord = {
                ...selectedLease,
                paymentStatus: 'Proof Submitted - For Treasury Verification',
                paymentReference: proofRefNumber || selectedLease.paymentReference,
                paymentProof: proofImage || proofNotes || `Reference No: ${proofRefNumber}`,
                paymentDate: new Date().toISOString(),
            };

            await updateLease(updatedRecord);
            setSelectedLease(updatedRecord);
            setLeases((prev) => prev.map((l) => (l.leaseId === updatedRecord.leaseId ? updatedRecord : l)));
            setIsProofModalOpen(false);
            window.dispatchEvent(new Event('db_treasury_updated'));
            alert('Proof of transaction submitted successfully! Treasury personnel has been notified and will verify your payment.');
        } catch (err: any) {
            console.error('Failed to submit proof:', err);
            alert(err?.message || 'Failed to submit proof of payment.');
        } finally {
            setIsSubmittingProof(false);
        }
    };

    // Load active citizen session
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
                console.error('Failed to parse user session:', err);
            }
        }
    }, []);

    // Load leases from API
    const fetchLeases = async () => {
        setLoading(true);
        try {
            const data = await getLeases();
            setLeases(data || []);
        } catch (err) {
            console.error('Error fetching market stall applications:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLeases();
    }, []);

    // Filter and search logic
    const filteredLeases = useMemo(() => {
        let result = [...leases];

        // Filter by logged-in user only — require BOTH first AND last name to
        // match exactly so that users never see another account's applications.
        if (user && user.fullname && user.fullname !== 'Citizen User') {
            const userFirst = user.firstName.toLowerCase().trim();
            const userLast = user.lastName.toLowerCase().trim();

            result = result.filter(r => {
                const recordFirst = (r.firstName || '').toLowerCase().trim();
                const recordLast = (r.lastName || '').toLowerCase().trim();

                // Exact first+last match (most secure, preferred)
                if (userFirst && userLast) {
                    return recordFirst === userFirst && recordLast === userLast;
                }
                // Fallback: full-name exact match when last name is absent
                const userFull = user.fullname.toLowerCase().trim();
                const holderFull = `${recordFirst} ${recordLast}`.trim();
                return holderFull === userFull;
            });
        }

        // Filter by Status
        if (statusFilter !== 'ALL') {
            result = result.filter((r) => {
                const status = (r.leaseStatus || '').toUpperCase();
                const payStatus = (r.paymentStatus || '').toUpperCase();
                if (statusFilter === 'PAID') return payStatus.includes('PAID');
                if (statusFilter === 'UNPAID') return !payStatus.includes('PAID');
                return status === statusFilter.toUpperCase() || payStatus === statusFilter.toUpperCase();
            });
        }

        // Search Query
        if (submittedSearch.trim()) {
            const q = submittedSearch.trim().toLowerCase();
            result = result.filter((r) => {
                if (searchType === 'Tracking/Lease No.') {
                    return (r.leaseId || '').toLowerCase().includes(q);
                }
                if (searchType === 'Market Name') {
                    return (r.marketName || '').toLowerCase().includes(q);
                }
                if (searchType === 'Stall No.') {
                    return (r.stallNumber || '').toLowerCase().includes(q);
                }
                if (searchType === 'Applicant Name') {
                    const name = `${r.firstName || ''} ${r.lastName || ''}`.toLowerCase();
                    return name.includes(q);
                }
                return (
                    (r.leaseId || '').toLowerCase().includes(q) ||
                    (r.marketName || '').toLowerCase().includes(q) ||
                    (r.stallNumber || '').toLowerCase().includes(q)
                );
            });
        }

        return result;
    }, [leases, user, statusFilter, searchType, submittedSearch]);

    // Pagination
    const totalPages = Math.max(1, Math.ceil(filteredLeases.length / pageSize));
    const paginatedLeases = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredLeases.slice(start, start + pageSize);
    }, [filteredLeases, currentPage, pageSize]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmittedSearch(searchQuery);
        setCurrentPage(1);
    };

    // PayMongo QR Payment Handler
    const handlePayMongoMarketQrPayment = async (record: EnrichedLeaseRecord) => {
        setIsProcessingPayment(true);
        setQrCodeUrl('');
        setQrReferenceNumber('');
        setQrPaymentIntentId('');
        setQrError('');
        setQrPaymentPaid(false);
        setPaymentConfirmedAt(null);
        setQrSecondsRemaining(300);

        const computedAmount = Number(record.amountDue || 0);
        if (!Number.isFinite(computedAmount) || computedAmount <= 0) {
            setIsProcessingPayment(false);
            setQrError('No outstanding payment balance found for this stall.');
            return;
        }

        try {
            const paymentIntent = await createPayMongoQrPaymentIntent({
                amount: computedAmount,
                type: 'MARKET_STALL',
                businessTrackingNumber: record.leaseId,
                customerName: `${record.firstName} ${record.lastName}`.trim() || user?.fullname || 'Market Vendor',
                customerEmail: user?.email || 'vendor@gov.ph',
                description: `Market Stall Rental Payment (${record.leaseId} - Stall ${record.stallNumber})`,
            });

            setQrPaymentIntentId(paymentIntent.paymentIntentId);
            setQrReferenceNumber(paymentIntent.referenceNumber);

            const paymentMethodId = await createQrPhPaymentMethod(paymentIntent.publicKey, 300);
            const attachedPayment = await attachQrPhPaymentMethod(
                paymentIntent.paymentIntentId,
                paymentMethodId,
                paymentIntent.clientKey,
                paymentIntent.publicKey
            );

            const imageUrl =
                attachedPayment?.attributes?.next_action?.code?.image_url ||
                attachedPayment?.next_action?.code?.image_url ||
                attachedPayment?.attributes?.next_action?.qr_code?.image_url ||
                attachedPayment?.qr_code?.image_url ||
                '';

            if (!imageUrl) {
                throw new Error('PayMongo did not return the QRPh code image. Please try again.');
            }

            setQrCodeUrl(imageUrl);
        } catch (err: any) {
            console.error('PayMongo Market QRPh payment error:', err);
            setQrError(err?.message || 'Unable to generate the PayMongo QRPh code. Please try again.');
        } finally {
            setIsProcessingPayment(false);
        }
    };

    // QR Countdown Timer
    useEffect(() => {
        if (!isPaymentStep || !qrCodeUrl || qrPaymentPaid) return;
        const timer = window.setInterval(() => {
            setQrSecondsRemaining((seconds) => {
                if (seconds <= 1) {
                    window.clearInterval(timer);
                    setQrCodeUrl('');
                    if (selectedLease) void handlePayMongoMarketQrPayment(selectedLease);
                    return 300;
                }
                return seconds - 1;
            });
        }, 1000);
        return () => window.clearInterval(timer);
    }, [isPaymentStep, qrCodeUrl, qrPaymentPaid, selectedLease]);

    // QR Payment Polling
    useEffect(() => {
        if (!isPaymentStep || !qrPaymentIntentId || qrPaymentPaid) return;
        const poll = window.setInterval(async () => {
            try {
                const response = await fetch(
                    `${API_BASE_URL}/api/payments/qr-status/${encodeURIComponent(qrPaymentIntentId)}`
                );
                if (!response.ok) return;
                const data = await response.json();
                if (data.paid) {
                    setQrPaymentPaid(true);
                    setPaymentConfirmedAt(new Date());
                    setQrSecondsRemaining(0);
                    setQrCodeUrl('');

                    await fetchLeases();
                    setIsPaymentStep(false);
                    setQrPaymentIntentId('');
                    setQrError('');
                    setIsPaymentSuccess(true);
                }
            } catch (error) {
                console.error('QR payment status check failed:', error);
            }
        }, 3000);
        return () => window.clearInterval(poll);
    }, [isPaymentStep, qrPaymentIntentId, qrPaymentPaid]);

    const openPaymentModal = (record: EnrichedLeaseRecord) => {
        setSelectedLease(record);
        setIsPaymentStep(true);
        void handlePayMongoMarketQrPayment(record);
    };

    const closePaymentModal = () => {
        if (isProcessingPayment) return;
        setIsPaymentStep(false);
        setIsPaymentSuccess(false);
        setQrCodeUrl('');
        setQrReferenceNumber('');
        setQrPaymentIntentId('');
        setQrError('');
        setPaymentConfirmedAt(null);
        setQrPaymentPaid(false);
    };

    return (
        <CitizenLayout activeTitle="City-Owned Market" activeNav="market">
            <div className="flex flex-col justify-between w-full">
                <div>
                    {/* Top Hero Banner Matching Business Tax */}
                    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8 relative bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 h-36 sm:h-48 overflow-hidden flex items-center justify-center border-b-4 border-blue-600">
                        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]"></div>

                        <div className="relative z-10 text-center px-4">
                            <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-wide uppercase">
                                City-Owned Market Stall Portal
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-200 mt-1 max-w-xl mx-auto">
                                Manage your stall applications, view market assignments, and monitor lease payment status.
                            </p>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
                        {leases.some(l => (l.paymentStatus || '').toLowerCase().includes('information requested') || (l.paymentStatus || '').toLowerCase().includes('mismatch')) && (
                            <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                                <div className="flex items-center gap-3">
                                    <svg className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                                        <line x1="12" y1="9" x2="12" y2="13"/>
                                        <line x1="12" y1="17" x2="12.01" y2="17"/>
                                    </svg>
                                    <div>
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                                            Action Required: Payment Mismatch Flagged
                                        </h4>
                                        <p className="text-xs text-amber-800 dark:text-amber-300 m-0">
                                            The Treasury office has flagged a transaction mismatch and requires proof of payment for your stall lease.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const flagged = leases.find(l => (l.paymentStatus || '').toLowerCase().includes('information requested') || (l.paymentStatus || '').toLowerCase().includes('mismatch'));
                                        if (flagged) handleOpenProofModal(flagged);
                                    }}
                                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs whitespace-nowrap cursor-pointer transition-all"
                                >
                                    Upload Proof of Payment →
                                </button>
                            </div>
                        )}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 space-y-6">
                            {/* Primary Action Button */}
                            <div className="flex justify-between items-center">
                                <button
                                    type="button"
                                    onClick={() => navigate('/citizen-portal-stall')}
                                    className="bg-blue-900 hover:bg-blue-950 text-white text-xs font-extrabold uppercase px-5 py-2.5 rounded-lg shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                    </svg>
                                    Apply for Market Stall
                                </button>
                            </div>

                            {/* Search and Filters */}
                            <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                                <div className="md:col-span-4">
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Application / Lease Status
                                    </label>
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => {
                                            setStatusFilter(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-900"
                                    >
                                        <option value="ALL">ALL</option>
                                        <option value="Active">Active</option>
                                        <option value="Pending">Pending</option>
                                        <option value="Approved">Approved</option>
                                        <option value="PAID">Paid</option>
                                        <option value="UNPAID">Pending Payment / Unpaid</option>
                                        <option value="Terminated">Terminated</option>
                                    </select>
                                </div>

                                <div className="md:col-span-8 flex flex-col sm:flex-row gap-2 items-end">
                                    <div className="w-full sm:w-1/3">
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                            Search By:
                                        </label>
                                        <select
                                            value={searchType}
                                            onChange={(e) => setSearchType(e.target.value)}
                                            className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-900"
                                        >
                                            <option value="Tracking/Lease No.">Tracking/Lease No.</option>
                                            <option value="Market Name">Market Name</option>
                                            <option value="Stall No.">Stall No.</option>
                                            <option value="Applicant Name">Applicant Name</option>
                                        </select>
                                    </div>

                                    <div className="w-full sm:w-2/3 flex gap-2">
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search..."
                                            className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-900"
                                        />
                                        <button
                                            type="submit"
                                            className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold px-4 py-2.5 rounded-lg text-xs transition-colors whitespace-nowrap cursor-pointer"
                                        >
                                            Search
                                        </button>
                                    </div>
                                </div>
                            </form>

                            {/* Data Table */}
                            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="bg-blue-900 dark:bg-blue-950 text-white font-bold uppercase tracking-wider text-[11px]">
                                            <th className="py-3 px-4">Tracking/Lease Number ↕</th>
                                            <th className="py-3 px-4">Market Name</th>
                                            <th className="py-3 px-4">Stall &amp; Section</th>
                                            <th className="py-3 px-4">Applicant Name</th>
                                            <th className="py-3 px-4">Application Status</th>
                                            <th className="py-3 px-4">Payment Status</th>
                                            <th className="py-3 px-4">Application Date</th>
                                            <th className="py-3 px-4 text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={8} className="py-12 text-center text-slate-400">
                                                    <div className="inline-block animate-spin rounded-full h-7 w-7 border-4 border-blue-600 border-t-transparent mb-2"></div>
                                                    <p className="text-xs font-semibold">Loading market stall records...</p>
                                                </td>
                                            </tr>
                                        ) : paginatedLeases.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-slate-500">
                                                    <svg className="w-10 h-10 mx-auto mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                    <p className="text-xs font-bold uppercase tracking-wider">No Market Stall Records Found</p>
                                                    <p className="text-[11px] text-slate-400 mt-1">Submit a new stall application using the button above.</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            paginatedLeases.map((lease) => {
                                                const isPaid = (lease.paymentStatus || '').toLowerCase().includes('paid');
                                                const isPending = (lease.leaseStatus || '').toLowerCase().includes('pending');
                                                const isApproved = (lease.leaseStatus || '').toLowerCase().includes('active') || (lease.leaseStatus || '').toLowerCase().includes('approved');
                                                const formattedDate = lease.createdAt
                                                    ? new Date(lease.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric' })
                                                    : '9/13/2026';

                                                return (
                                                    <tr key={lease.leaseId || lease.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                        <td className="py-3 px-4 font-mono font-bold text-blue-900 dark:text-blue-400">
                                                            {lease.leaseId}
                                                        </td>
                                                        <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                                                            {lease.marketName}
                                                        </td>
                                                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                                                            Stall {lease.stallNumber} ({lease.section})
                                                        </td>
                                                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                                                            {lease.firstName} {lease.lastName}
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <span
                                                                className={`font-bold px-2.5 py-0.5 rounded text-[10px] uppercase ${isApproved
                                                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                                    : isPending
                                                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                                                        : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                                                                    }`}
                                                            >
                                                                {lease.leaseStatus || 'PENDING'}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <span
                                                                className={`font-bold px-2.5 py-0.5 rounded text-[10px] uppercase ${isPaid
                                                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                                                    }`}
                                                            >
                                                                {isPaid ? 'PAID' : 'UNPAID'}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                                                            {formattedDate}
                                                        </td>
                                                        <td className="py-3 px-4 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedLease(lease)}
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

                            {/* Pagination */}
                            <div className="flex justify-between items-center pt-2 text-xs text-slate-500 dark:text-slate-400">
                                <div>
                                    Page {currentPage} of {totalPages}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${currentPage === 1
                                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer'
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
                                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer'
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

            {/* View Details Modal */}
            {selectedLease && !isPaymentStep && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="bg-blue-900 px-6 py-4 flex justify-between items-center text-white">
                            <div>
                                <span className="text-[10px] uppercase font-bold text-blue-300 tracking-wider">Application Details</span>
                                <h3 className="text-base font-extrabold">{selectedLease.leaseId}</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedLease(null)}
                                className="text-white/80 hover:text-white text-lg font-bold p-1 cursor-pointer"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="p-6 space-y-5 text-xs text-slate-700 dark:text-slate-300 max-h-[75vh] overflow-y-auto">
                            {/* Summary Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                                <div>
                                    <span className="block text-[10px] uppercase font-bold text-slate-400">Market Name</span>
                                    <span className="font-bold text-slate-900 dark:text-white text-sm">{selectedLease.marketName}</span>
                                </div>
                                <div>
                                    <span className="block text-[10px] uppercase font-bold text-slate-400">Stall Number</span>
                                    <span className="font-bold text-slate-900 dark:text-white text-sm">Stall #{selectedLease.stallNumber}</span>
                                </div>
                                <div>
                                    <span className="block text-[10px] uppercase font-bold text-slate-400">Section</span>
                                    <span className="font-bold text-slate-900 dark:text-white text-sm">{selectedLease.section}</span>
                                </div>
                                <div>
                                    <span className="block text-[10px] uppercase font-bold text-slate-400">Applicant / Holder</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedLease.firstName} {selectedLease.lastName}</span>
                                </div>
                                <div>
                                    <span className="block text-[10px] uppercase font-bold text-slate-400">Lease Status</span>
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400 uppercase">{selectedLease.leaseStatus}</span>
                                </div>
                                <div>
                                    <span className="block text-[10px] uppercase font-bold text-slate-400">Monthly Rental Due</span>
                                    <span className="font-extrabold text-blue-900 dark:text-blue-400 text-sm">
                                        ₱{(selectedLease.amountDue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>

                            {/* Payment & Compliance Info */}
                            <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-4">
                                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                                    Payment Information &amp; Official Receipts
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                        <span className="block text-[10px] uppercase font-bold text-slate-400">Payment Status</span>
                                        <span className={`font-bold ${selectedLease.paymentStatus?.toLowerCase().includes('paid') ? 'text-emerald-600' : 'text-amber-600'}`}>
                                            {selectedLease.paymentStatus || 'Pending Payment'}
                                        </span>
                                    </div>
                                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                        <span className="block text-[10px] uppercase font-bold text-slate-400">Payment Method</span>
                                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                                            {selectedLease.paymentMethod || 'PayMongo (QR Ph)'}
                                        </span>
                                    </div>
                                    {selectedLease.officialReceiptNumber && (
                                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                            <span className="block text-[10px] uppercase font-bold text-slate-400">Official Receipt (O.R.) No.</span>
                                            <span className="font-mono font-bold text-blue-900 dark:text-blue-400">{selectedLease.officialReceiptNumber}</span>
                                        </div>
                                    )}
                                    {selectedLease.paymentReference && (
                                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                            <span className="block text-[10px] uppercase font-bold text-slate-400">Payment Reference</span>
                                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{selectedLease.paymentReference}</span>
                                        </div>
                                    )}
                                 </div>
                            </div>

                            {/* Mismatch Notice & Proof Status */}
                            {((selectedLease.paymentStatus || '').toLowerCase().includes('information requested') ||
                                (selectedLease.paymentStatus || '').toLowerCase().includes('mismatch') ||
                                (selectedLease.paymentStatus || '').toLowerCase().includes('proof required')) && (
                                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                                                <line x1="12" y1="9" x2="12" y2="13"/>
                                                <line x1="12" y1="17" x2="12.01" y2="17"/>
                                            </svg>
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                                                Proof of Transaction Required
                                            </h4>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleOpenProofModal(selectedLease)}
                                            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
                                        >
                                            Submit Proof Now
                                        </button>
                                    </div>
                                    <p className="text-xs text-amber-800 dark:text-amber-300">
                                        The Treasury department flagged a transaction mismatch and requires your updated proof of payment.
                                    </p>
                                    {selectedLease.mismatchNotes && (
                                        <div className="p-2.5 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300 italic">
                                            <strong>Treasury Officer Note:</strong> "{selectedLease.mismatchNotes}"
                                        </div>
                                    )}
                                </div>
                            )}

                            {selectedLease.paymentStatus === 'Proof Submitted - For Treasury Verification' && (
                                <div className="p-4 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-300 dark:border-cyan-800 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4 text-cyan-600 dark:text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                                        </svg>
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-900 dark:text-cyan-200">
                                            Proof of Transaction Submitted
                                        </h4>
                                    </div>
                                    <p className="text-xs text-cyan-800 dark:text-cyan-300">
                                        Your payment proof has been forwarded to the Treasury office. A personnel officer is reviewing your record.
                                    </p>
                                    {selectedLease.paymentProof && (
                                        <div className="text-[11px] text-cyan-900 dark:text-cyan-200 font-mono bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg border border-cyan-200 dark:border-cyan-900">
                                            {selectedLease.paymentProof.startsWith('data:image') ? (
                                                <img src={selectedLease.paymentProof} alt="Submitted proof" className="max-h-36 rounded-md object-contain" />
                                            ) : (
                                                <span>Proof details: {selectedLease.paymentProof}</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer Actions */}
                        <div className="bg-slate-50 dark:bg-slate-800/80 px-6 py-4 flex flex-wrap justify-between items-center gap-2 border-t border-slate-200 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() => setSelectedLease(null)}
                                className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
                            >
                                Close
                            </button>

                            <div className="flex items-center gap-2">
                                {!(selectedLease.paymentStatus || '').toLowerCase().includes('paid') && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => handleOpenProofModal(selectedLease)}
                                            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                                            </svg>
                                            Upload Proof
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => openPaymentModal(selectedLease)}
                                            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                            </svg>
                                            Pay Online (QR Ph)
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Proof of Payment Submission Modal */}
            {isProofModalOpen && selectedLease && (
                <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
                        <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white">Submit Proof of Payment</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Stall {selectedLease.stallNumber} ({selectedLease.leaseId})</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsProofModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1 rounded-lg"
                                title="Close"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>

                        {selectedLease.mismatchNotes && (
                            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                                <strong>Treasury Reason:</strong> "{selectedLease.mismatchNotes}"
                            </div>
                        )}

                        <form onSubmit={handleSubmitProof} className="space-y-3.5 text-xs">
                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Transaction / Reference Number <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. GCash Ref / Bank Ref / PayMongo Ref"
                                    value={proofRefNumber}
                                    onChange={(e) => setProofRefNumber(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-slate-100 font-mono"
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Attach Receipt Screenshot / Photo Proof
                                </label>
                                <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={handleProofFileChange}
                                    className="w-full text-xs text-slate-500 dark:text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-950 dark:file:text-blue-300 hover:file:bg-blue-100 cursor-pointer"
                                />
                                {proofImage && proofImage.startsWith('data:image') && (
                                    <div className="mt-2">
                                        <img src={proofImage} alt="Proof preview" className="max-h-36 rounded-lg border border-slate-200 dark:border-slate-700 object-contain mx-auto" />
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Additional Notes / Remarks (Optional)
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="Payment date, channel used, or bank name..."
                                    value={proofNotes}
                                    onChange={(e) => setProofNotes(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-slate-100"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsProofModalOpen(false)}
                                    className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingProof}
                                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                                >
                                    {isSubmittingProof ? 'Submitting...' : 'Submit Proof to Treasury'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* QR Payment Modal */}
            {isPaymentStep && selectedLease && (
                <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-center space-y-5 animate-in fade-in zoom-in-95">
                        <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                                PayMongo QR Ph Checkout
                            </span>
                            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                                Market Stall Rental Payment
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5 font-mono">{selectedLease.leaseId} - Stall {selectedLease.stallNumber}</p>
                        </div>

                        {isProcessingPayment ? (
                            <div className="py-10 space-y-3">
                                <div className="animate-spin rounded-full h-10 w-10 border-4 border-emerald-500 border-t-transparent mx-auto"></div>
                                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                    Generating dynamic QR Ph code...
                                </p>
                            </div>
                        ) : qrError ? (
                            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                                {qrError}
                            </div>
                        ) : qrCodeUrl ? (
                            <div className="space-y-4">
                                <div className="p-4 bg-white rounded-2xl border-2 border-emerald-500 shadow-inner inline-block">
                                    <img src={qrCodeUrl} alt="QR Ph Code" className="w-56 h-56 mx-auto object-contain" />
                                    {qrReferenceNumber && (
                                        <p className="text-[10px] font-mono text-slate-500 mt-1.5">Ref: {qrReferenceNumber}</p>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <div className="text-xs text-slate-500">Amount Due:</div>
                                    <div className="text-xl font-black text-slate-900 dark:text-white">
                                        ₱{(selectedLease.amountDue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </div>
                                    <div className="text-[11px] font-semibold text-amber-600">
                                        Expires in: {Math.floor(qrSecondsRemaining / 60)}:{(qrSecondsRemaining % 60).toString().padStart(2, '0')}
                                    </div>
                                </div>

                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                    Scan with GCash, Maya, or any InstaPay/QRPh mobile banking app.
                                </p>
                            </div>
                        ) : null}

                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={closePaymentModal}
                                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
                            >
                                Cancel / Back
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Success Notification */}
            {isPaymentSuccess && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full border border-emerald-500 p-6 text-center space-y-4 shadow-2xl">
                        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Payment Confirmed!</h3>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                            Your market stall rental payment has been successfully recorded and processed.
                        </p>
                        {paymentConfirmedAt && (
                            <p className="text-[11px] font-mono text-slate-400">
                                Confirmed at: {paymentConfirmedAt.toLocaleTimeString()}
                            </p>
                        )}
                        <button
                            type="button"
                            onClick={() => setIsPaymentSuccess(false)}
                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs cursor-pointer"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </CitizenLayout>
    );
}