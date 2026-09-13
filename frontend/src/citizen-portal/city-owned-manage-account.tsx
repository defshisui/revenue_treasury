import { useState, useEffect } from 'react';
import { getLeases } from '../services/marketService';
import type { LeaseRecord } from '../services/marketService';
import CitizenLayout from './CitizenLayout';
import { API_BASE_URL } from "../config/api";
import {
    createPayMongoQrPaymentIntent,
    createQrPhPaymentMethod,
    attachQrPhPaymentMethod,
} from "../services/paymongoService";
type CitizenLeaseRecord = LeaseRecord & {
    officialReceiptNumber?: string;
    paymentReference?: string;
};

export default function MarketLeaseSearch() {
    const [leaseId, setLeaseId] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [marketName, setMarketName] = useState('');
    const [leaseStatus, setLeaseStatus] = useState('');
    const [paymentStatus, setPaymentStatus] = useState('');
    const [entriesCount, setEntriesCount] = useState('10');
    const [showInactive, setShowInactive] = useState(false);
    const [allLeases, setAllLeases] = useState<CitizenLeaseRecord[]>([]);
    const [filteredLeases, setFilteredLeases] = useState<CitizenLeaseRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [selectedLease, setSelectedLease] = useState<CitizenLeaseRecord | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);
    const [paymentLeaseId, setPaymentLeaseId] = useState("");
    const [paymentIntentId, setPaymentIntentId] = useState("");
    const [qrImageUrl, setQrImageUrl] = useState("");
    const [qrReferenceNumber, setQrReferenceNumber] = useState("");
    const [qrTimeLeft, setQrTimeLeft] = useState(300);
    const [isGeneratingQr, setIsGeneratingQr] = useState(false);
    const [qrGenerationError, setQrGenerationError] = useState("");
    const [isPaymentSuccess, setIsPaymentSuccess] = useState(false);
    const [paymentOfficialReceipt, setPaymentOfficialReceipt] = useState("");
    const [paymentConfirmedAt, setPaymentConfirmedAt] = useState<Date | null>(null);
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
    useEffect(() => {
        const fetchLeases = async () => {
            setIsLoading(true);
            try {
                const session = checkUserSession();
                const data = await getLeases();
                if (session) {
                    setFirstName(session.firstName);
                    setLastName(session.lastName);
                    const userLeases = data.filter(l => {
                        const sessionName = session.fullname.toLowerCase();
                        const lFirst = l.firstName.toLowerCase();
                        const lLast = l.lastName.toLowerCase();
                        return (lFirst === session.firstName.toLowerCase() && lLast === session.lastName.toLowerCase()) ||
                            (sessionName.includes(lFirst) && sessionName.includes(lLast));
                    });
                    setAllLeases(userLeases as CitizenLeaseRecord[]);
                } else {
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
    useEffect(() => {
        handleSearch();
    }, [allLeases, showInactive]);
    const handleSearch = () => {
        let result = [...allLeases];
        if (leaseId) {
            result = result.filter(l => l.leaseId.toLowerCase().includes(leaseId.toLowerCase()));
        }
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
        if (!showInactive) {
            result = result.filter(l => l.leaseStatus !== 'Inactive' && l.leaseStatus !== 'Terminated');
        }
        setFilteredLeases(result as CitizenLeaseRecord[]);
    };
    const openLeaseDetails = (lease: CitizenLeaseRecord) => {
        setSelectedLease(lease);
        setIsDetailsOpen(true);
        setIsPaymentSuccess(false);
        setPaymentOfficialReceipt("");
        setPaymentConfirmedAt(null);
    };

    const closeLeaseDetails = () => {
        setIsDetailsOpen(false);
        setSelectedLease(null);
    };



    const openPaymentForLease = async (lease: CitizenLeaseRecord) => {
        const session = checkUserSession();

        if (!session) {
            alert("Please log in to your citizen portal account first.");
            return;
        }

        if (String(lease.paymentStatus).toLowerCase() === "paid") {
            return;
        }

        setSelectedLease(lease);
        setIsDetailsOpen(false);
        setIsPaymentOpen(true);
        setIsPaymentSuccess(false);
        setPaymentLeaseId(lease.leaseId);
        setPaymentIntentId("");
        setQrImageUrl("");
        setQrReferenceNumber("");
        setQrGenerationError("");
        setPaymentOfficialReceipt("");
        setPaymentConfirmedAt(null);
        setQrTimeLeft(300);
        setIsGeneratingQr(true);

        try {
            const amount = Number(lease.amountDue || 0);

            if (!Number.isFinite(amount) || amount <= 0) {
                throw new Error("This lease does not have a valid amount due.");
            }

            const intent = await createPayMongoQrPaymentIntent({
                amount,
                type: "MARKET_STALL",
                leaseId: lease.leaseId,
                customerName: `${lease.firstName} ${lease.lastName}`.trim(),
                customerEmail: session.email || "citizen@gov.ph",
                description:
                    `Market Stall Rental - Stall #${lease.stallNumber} - ${lease.marketName}`,
            });

            setPaymentIntentId(intent.paymentIntentId);
            setQrReferenceNumber(intent.referenceNumber || lease.leaseId);

            const paymentMethodId = await createQrPhPaymentMethod(intent.publicKey);

            const attachedIntent = await attachQrPhPaymentMethod(
                intent.paymentIntentId,
                paymentMethodId,
                intent.clientKey,
                intent.publicKey
            );

            const imageUrl =
                attachedIntent?.attributes?.next_action?.code?.image_url;

            if (!imageUrl) {
                throw new Error(
                    "PayMongo did not return a QR code image. Please try again."
                );
            }

            setQrImageUrl(imageUrl);
            setQrTimeLeft(300);
        } catch (err: any) {
            console.error("Market lease payment error:", err);
            setQrGenerationError(
                err?.message || "Unable to generate the QR Ph payment."
            );
        } finally {
            setIsGeneratingQr(false);
        }
    };

    const closePayment = () => {
        setIsPaymentOpen(false);
        setPaymentIntentId("");
        setQrImageUrl("");
        setQrGenerationError("");
        setPaymentLeaseId("");
        setQrReferenceNumber("");
        setQrTimeLeft(300);
    };

    useEffect(() => {
        if (!isPaymentOpen || !qrImageUrl || isGeneratingQr || isPaymentSuccess) {
            return;
        }

        const timer = window.setInterval(() => {
            setQrTimeLeft((previous) => {
                if (previous <= 1) {
                    window.clearInterval(timer);
                    if (selectedLease) {
                        void openPaymentForLease(selectedLease);
                    }
                    return 0;
                }

                return previous - 1;
            });
        }, 1000);

        return () => window.clearInterval(timer);
    }, [isPaymentOpen, qrImageUrl, isGeneratingQr, isPaymentSuccess, selectedLease]);

    useEffect(() => {
        if (!isPaymentOpen || !paymentIntentId || isGeneratingQr || isPaymentSuccess) {
            return;
        }

        let cancelled = false;

        const checkPaymentStatus = async () => {
            try {
                const response = await fetch(
                    `${API_BASE_URL}/api/payments/qr-status/${encodeURIComponent(paymentIntentId)}`
                );

                const data = await response.json();

                if (!response.ok || !data.success || cancelled) {
                    return;
                }

                if (data.paid) {
                    const updatedLeases = await getLeases();
                    if (cancelled) return;

                    const updatedLease =
                        (updatedLeases as CitizenLeaseRecord[]).find(
                            (item) => item.leaseId === paymentLeaseId
                        ) || selectedLease;

                    const officialReceiptNumber =
                        data.officialReceiptNumber ||
                        updatedLease?.officialReceiptNumber ||
                        "";

                    setAllLeases(updatedLeases as CitizenLeaseRecord[]);
                    setFilteredLeases((previous) =>
                        previous.map((item) =>
                            item.leaseId === paymentLeaseId
                                ? {
                                    ...item,
                                    ...(updatedLease || {}),
                                    paymentStatus: "Paid",
                                    officialReceiptNumber,
                                    paymentReference:
                                        data.paymentReference ||
                                        updatedLease?.paymentReference ||
                                        qrReferenceNumber,
                                }
                                : item
                        )
                    );

                    setSelectedLease(
                        updatedLease
                            ? {
                                ...updatedLease,
                                paymentStatus: "Paid",
                                officialReceiptNumber,
                                paymentReference:
                                    data.paymentReference ||
                                    updatedLease.paymentReference ||
                                    qrReferenceNumber,
                            }
                            : null
                    );

                    setPaymentOfficialReceipt(officialReceiptNumber);
                    setPaymentConfirmedAt(new Date());
                    setIsPaymentSuccess(true);
                    setQrImageUrl("");
                    setPaymentIntentId("");
                }
            } catch (error) {
                console.error("Market lease payment status check failed:", error);
            }
        };

        void checkPaymentStatus();

        const interval = window.setInterval(() => {
            void checkPaymentStatus();
        }, 2000);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, [
        isPaymentOpen,
        paymentIntentId,
        isGeneratingQr,
        isPaymentSuccess,
        paymentLeaseId,
        selectedLease,
        qrReferenceNumber,
    ]);



    const getOfficialReceiptNumber = (lease: CitizenLeaseRecord | null) =>
        lease?.officialReceiptNumber ||
        "";

    return (
        <CitizenLayout activeTitle="City-Owned Market" activeNav="market">
            <div className="flex flex-col justify-between w-full">
                <div>
                    {/* Top Hero Banner Matching Business Tax */}
                    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8 relative bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 h-36 sm:h-48 overflow-hidden flex items-center justify-center border-b-4 border-blue-600">
                        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]"></div>

                        <div className="relative z-10 text-center px-4">
                            <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-wide uppercase">
                                2026 City-Owned Market Stall Portal
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-200 mt-1 max-w-xl mx-auto">
                                Manage active market leases, review account statements, and process rental payments.
                            </p>
                        </div>
                    </div>

                    <div className="max-w-6xl mx-auto px-4 py-6">
                        <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col pb-5">
                            <div className="flex justify-between items-center px-6 py-5 border-b border-slate-200 dark:border-slate-800">
                                <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-wide uppercase">
                                    My Active Market Leases &amp; Accounts
                                </h2>
                            </div>
                    <div className="p-6 bg-white dark:bg-slate-900 grid grid-cols-1 lg:grid-cols-3 gap-x-6 gap-y-5 items-end border-b border-slate-200 dark:border-slate-800">
                        <div className="flex flex-col gap-[6px]">
                            <label htmlFor="leaseId" className="text-[0.85rem] font-semibold text-slate-800 dark:text-slate-200">Lease ID</label>
                            <input
                                type="text" id="leaseId" value={leaseId} onChange={(e) => setLeaseId(e.target.value)}
                                className="w-full px-[14px] py-[10px] border border-slate-300 dark:border-slate-700 rounded-md text-[0.9rem] outline-none transition-all bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:border-blue-800 focus:ring-[3px] focus:ring-blue-800/15"
                            />
                        </div>
                        <div className="flex flex-col gap-[6px]">
                            <label htmlFor="firstName" className="text-[0.85rem] font-semibold text-slate-800 dark:text-slate-200">First Name of Stallholder</label>
                            <input
                                type="text" id="firstName" value={firstName} readOnly disabled
                                className="w-full px-[14px] py-[10px] border border-slate-300 dark:border-slate-700 rounded-md text-[0.9rem] outline-none transition-all bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                            />
                        </div>
                        <div className="flex flex-col gap-[6px]">
                            <label htmlFor="lastName" className="text-[0.85rem] font-semibold text-slate-800 dark:text-slate-200">Last Name of Stallholder</label>
                            <input
                                type="text" id="lastName" value={lastName} readOnly disabled
                                className="w-full px-[14px] py-[10px] border border-slate-300 dark:border-slate-700 rounded-md text-[0.9rem] outline-none transition-all bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                            />
                        </div>
                        <div className="flex flex-col gap-[6px]">
                            <label htmlFor="marketName" className="text-[0.85rem] font-semibold text-slate-800 dark:text-slate-200">Name of City Market</label>
                            <select
                                id="marketName" value={marketName} onChange={(e) => setMarketName(e.target.value)}
                                className="w-full px-[14px] py-[10px] border border-slate-300 dark:border-slate-700 rounded-md text-[0.9rem] outline-none transition-all bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.36%22%20height%3D%22292.36%22%3E%3Cpath%20fill%3D%22%23718096%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[length:10px] bg-[position:right_14px_center] pr-[35px] focus:border-blue-800 focus:ring-[3px] focus:ring-blue-800/15"
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
                            <label htmlFor="leaseStatus" className="text-[0.85rem] font-semibold text-slate-800 dark:text-slate-200">Lease Status</label>
                            <select
                                id="leaseStatus" value={leaseStatus} onChange={(e) => setLeaseStatus(e.target.value)}
                                className="w-full px-[14px] py-[10px] border border-slate-300 dark:border-slate-700 rounded-md text-[0.9rem] outline-none transition-all bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.36%22%20height%3D%22292.36%22%3E%3Cpath%20fill%3D%22%23718096%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[length:10px] bg-[position:right_14px_center] pr-[35px] focus:border-blue-800 focus:ring-[3px] focus:ring-blue-800/15"
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
                            <label htmlFor="paymentStatus" className="text-[0.85rem] font-semibold text-slate-800 dark:text-slate-200">Payment Status</label>
                            <select
                                id="paymentStatus" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}
                                className="w-full px-[14px] py-[10px] border border-slate-300 dark:border-slate-700 rounded-md text-[0.9rem] outline-none transition-all bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.36%22%20height%3D%22292.36%22%3E%3Cpath%20fill%3D%22%23718096%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[length:10px] bg-[position:right_14px_center] pr-[35px] focus:border-blue-800 focus:ring-[3px] focus:ring-blue-800/15"
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
                                className="bg-blue-900 text-white border-none px-8 py-[10px] rounded-md font-semibold cursor-pointer transition-colors text-[0.9rem] hover:bg-blue-950"
                            >
                                Search
                            </button>
                        </div>
                    </div>
                    <div className="p-[16px_24px] font-bold text-[0.9rem] text-slate-800 dark:text-slate-200 flex justify-between items-center bg-white dark:bg-slate-900">
                        <span className="text-[0.75rem] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
                            Showing {filteredLeases.length} results
                        </span>
                    </div>
                    <div className="w-full overflow-x-auto min-h-[280px] bg-slate-50 dark:bg-slate-950 border-t border-b border-slate-300 dark:border-slate-800 flex flex-col justify-start">
                        <table className="w-full border-collapse text-left whitespace-nowrap">
                            <thead>
                                <tr>
                                    <th className="bg-blue-900 text-white text-[0.75rem] uppercase tracking-[0.5px] p-[12px_14px] font-bold border-r border-white/10">LEASE ID</th>
                                    <th className="bg-blue-900 text-white text-[0.75rem] uppercase tracking-[0.5px] p-[12px_14px] font-bold border-r border-white/10">FIRST NAME</th>
                                    <th className="bg-blue-900 text-white text-[0.75rem] uppercase tracking-[0.5px] p-[12px_14px] font-bold border-r border-white/10">LAST NAME</th>
                                    <th className="bg-blue-900 text-white text-[0.75rem] uppercase tracking-[0.5px] p-[12px_14px] font-bold border-r border-white/10">NAME OF CITY MARKET</th>
                                    <th className="bg-blue-900 text-white text-[0.75rem] uppercase tracking-[0.5px] p-[12px_14px] font-bold border-r border-white/10">SECTION</th>
                                    <th className="bg-blue-900 text-white text-[0.75rem] uppercase tracking-[0.5px] p-[12px_14px] font-bold border-r border-white/10">STALL NO.</th>
                                    <th className="bg-blue-900 text-white text-[0.75rem] uppercase tracking-[0.5px] p-[12px_14px] font-bold border-r border-white/10">LEASE STATUS</th>
                                    <th className="bg-blue-900 text-white text-[0.75rem] uppercase tracking-[0.5px] p-[12px_14px] font-bold border-r border-white/10">AMOUNT TO BE PAID</th>
                                    <th className="bg-blue-900 text-white text-[0.75rem] uppercase tracking-[0.5px] p-[12px_14px] font-bold border-r border-white/10">HELPER APPROVAL</th>
                                    <th className="bg-blue-900 text-white text-[0.75rem] uppercase tracking-[0.5px] p-[12px_14px] font-bold border-r border-white/10">ADVANCE PAYMENT</th>
                                    <th className="bg-blue-900 text-white text-[0.75rem] uppercase tracking-[0.5px] p-[12px_14px] font-bold border-r border-white/10">PAYMENT STATUS</th>
                                    <th className="bg-blue-900 text-white text-[0.75rem] uppercase tracking-[0.5px] p-[12px_14px] font-bold">ACTION</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={12} className="p-[16px_14px] text-[0.85rem] border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center">
                                            <div className="text-center p-[50px_20px] text-slate-500 dark:text-slate-400">
                                                <p className="font-semibold animate-pulse">Loading lease records...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredLeases.length > 0 ? (
                                    filteredLeases.map((lease) => (
                                        <tr key={lease.leaseId} className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-[0.85rem] text-slate-800 dark:text-slate-200">
                                            <td className="p-[12px_14px] font-medium text-blue-600 dark:text-blue-400">{lease.leaseId}</td>
                                            <td className="p-[12px_14px] capitalize">{lease.firstName}</td>
                                            <td className="p-[12px_14px] capitalize">{lease.lastName}</td>
                                            <td className="p-[12px_14px]">{lease.marketName}</td>
                                            <td className="p-[12px_14px]">{lease.section}</td>
                                            <td className="p-[12px_14px] text-center font-semibold">{lease.stallNumber}</td>
                                            <td className="p-[12px_14px]">
                                                <span className={`px-2 py-1 rounded-[4px] text-[0.7rem] font-bold uppercase tracking-wider ${lease.leaseStatus === 'Active' ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' :
                                                    lease.leaseStatus === 'Terminated' || lease.leaseStatus === 'Inactive' ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800' :
                                                        'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                                    }`}>
                                                    {lease.leaseStatus}
                                                </span>
                                            </td>
                                            <td className="p-[12px_14px] font-semibold text-slate-900 dark:text-white">
                                                {lease.amountDue.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}
                                            </td>
                                            <td className="p-[12px_14px]">{lease.helperApprovalStatus}</td>
                                            <td className="p-[12px_14px]">{lease.advancePaymentStatus}</td>
                                            <td className="p-[12px_14px]">
                                                <span className={`px-2 py-1 rounded-[4px] text-[0.7rem] font-bold uppercase tracking-wider ${lease.paymentStatus === 'Paid' ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800' :
                                                    'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                                    }`}>
                                                    {lease.paymentStatus}
                                                </span>
                                            </td>
                                            <td className="p-[12px_14px]">
                                                <button
                                                    type="button"
                                                    onClick={() => openLeaseDetails(lease)}
                                                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-semibold hover:underline text-[0.8rem] cursor-pointer"
                                                >
                                                    View Details
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={12} className="p-[16px_14px] text-[0.85rem] border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center">
                                            <div className="text-center p-[50px_20px] text-slate-500 dark:text-slate-400">
                                                <div className="w-[40px] h-[40px] mx-auto mb-[10px] opacity-30 bg-slate-400 rounded-[6px]"></div>
                                                <p>No Active Leases Found for Your Account</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex flex-col gap-4 p-[20px_24px_10px_24px] bg-white dark:bg-slate-900">
                        <div className="flex justify-between items-center text-[0.85rem] text-slate-500 dark:text-slate-400">
                            <div>
                                Show{' '}
                                <select
                                    value={entriesCount}
                                    onChange={(e) => setEntriesCount(e.target.value)}
                                    className="p-[4px_8px] border border-slate-300 dark:border-slate-700 rounded-[4px] outline-none text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 w-auto inline-block"
                                >
                                    <option value="0">0</option>
                                    <option value="10">10</option>
                                    <option value="25">25</option>
                                </select>{' '}
                                of {filteredLeases.length} entries
                            </div>
                            <div className="flex items-center gap-1">
                                <button className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 p-[6px_12px] rounded-[4px] cursor-pointer text-slate-800 dark:text-slate-300 text-[0.85rem] opacity-40 cursor-not-allowed" disabled>&laquo;</button>
                                <button className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 p-[6px_12px] rounded-[4px] cursor-pointer text-slate-800 dark:text-slate-300 text-[0.85rem] opacity-40 cursor-not-allowed" disabled>&lsaquo;</button>
                                <button className="border p-[6px_12px] rounded-[4px] cursor-pointer text-[0.85rem] bg-blue-900 text-white border-blue-900">1</button>
                                <button className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 p-[6px_12px] rounded-[4px] cursor-pointer text-slate-800 dark:text-slate-300 text-[0.85rem] opacity-40 cursor-not-allowed" disabled>&rsaquo;</button>
                                <button className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 p-[6px_12px] rounded-[4px] cursor-pointer text-slate-800 dark:text-slate-300 text-[0.85rem] opacity-40 cursor-not-allowed" disabled>&raquo;</button>
                            </div>
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-[0.85rem] text-slate-800 dark:text-slate-200 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={showInactive}
                                    onChange={(e) => setShowInactive(e.target.checked)}
                                    className="w-4 h-4 cursor-pointer"
                                />
                                Show Inactive Leases
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            {isDetailsOpen && selectedLease && (
                <div className="fixed inset-0 z-[70] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-800">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                                    Market Stall Lease
                                </p>
                                <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">
                                    Lease Details
                                </h3>
                                <p className="text-xs font-mono text-blue-600 dark:text-blue-400 mt-1">
                                    {selectedLease.leaseId}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={closeLeaseDetails}
                                className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Stallholder</p>
                                    <p className="mt-1 font-bold text-slate-900 dark:text-white">
                                        {selectedLease.firstName} {selectedLease.lastName}
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Market</p>
                                    <p className="mt-1 font-bold text-slate-900 dark:text-white">
                                        {selectedLease.marketName}
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Section / Stall</p>
                                    <p className="mt-1 font-bold text-slate-900 dark:text-white">
                                        {selectedLease.section} / Stall {selectedLease.stallNumber}
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Lease Status</p>
                                    <p className="mt-1 font-bold text-slate-900 dark:text-white">
                                        {selectedLease.leaseStatus}
                                    </p>
                                </div>
                            </div>

                            <div className="p-5 rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/40">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                                            Market Stall Assessment
                                        </p>
                                        <p className="text-2xl font-black text-[#0B3B60] dark:text-blue-300 mt-1">
                                            {selectedLease.amountDue.toLocaleString("en-PH", {
                                                style: "currency",
                                                currency: "PHP",
                                                minimumFractionDigits: 2,
                                            })}
                                        </p>
                                    </div>

                                    <span
                                        className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase ${selectedLease.paymentStatus === "Paid"
                                            ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                                            : "bg-white dark:bg-slate-900 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                                            }`}
                                    >
                                        {selectedLease.paymentStatus === "Paid"
                                            ? "PAID"
                                            : "FOR PAYMENT"}
                                    </span>
                                </div>

                                <div className="mt-5 pt-4 border-t border-blue-200 dark:border-blue-900/60">
                                    {selectedLease.paymentStatus === "Paid" ? (
                                        <div className="space-y-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                                            <p className="flex items-center gap-1.5">
                                                <svg className="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                                <span>Payment confirmed</span>
                                            </p>

                                            <div className="rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 p-3">
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                    Official Receipt (O.R.) Number
                                                </p>
                                                <p className="mt-1 font-mono text-sm font-black text-slate-900 dark:text-white">
                                                    {getOfficialReceiptNumber(selectedLease) || "Not yet issued"}
                                                </p>
                                            </div>

                                            {selectedLease.paymentReference && (
                                                <p className="text-slate-700 dark:text-slate-300">
                                                    Reference:{" "}
                                                    <span className="font-mono">
                                                        {selectedLease.paymentReference}
                                                    </span>
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-[11px] text-blue-800 dark:text-blue-200 leading-relaxed mb-4">
                                                Pay the posted market stall amount online. Your lease will
                                                update automatically after PayMongo confirms the payment.
                                            </p>

                                            <button
                                                type="button"
                                                onClick={() => void openPaymentForLease(selectedLease)}
                                                className="w-full bg-[#1D3F99] hover:bg-[#17357F] text-white font-extrabold py-3 rounded-xl text-xs uppercase tracking-wide shadow-sm transition cursor-pointer"
                                            >
                                                Pay Market Stall Lease →
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={closeLeaseDetails}
                                className="w-full bg-[#0B3B60] hover:bg-[#082944] text-white font-bold py-3 rounded-xl text-xs transition cursor-pointer"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isPaymentOpen && paymentLeaseId && selectedLease && (
                <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto overscroll-contain">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl w-full max-w-5xl max-h-[96vh] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-y-auto my-auto">
                        <>
                            <div className="grid grid-cols-1 lg:grid-cols-2 min-w-0">
                                <div className="p-4 sm:p-6 lg:p-8 lg:border-r border-slate-200 dark:border-slate-800 min-w-0">
                                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
                                        Market Stall Payment
                                    </h2>

                                    <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 break-all">
                                        ({paymentLeaseId})
                                    </p>

                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">
                                        Market Stall Lease Payment ({selectedLease.marketName})
                                    </p>

                                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-4">
                                        Billed to{" "}
                                        <span className="font-bold text-slate-900 dark:text-white">
                                            {selectedLease.firstName} {selectedLease.lastName}
                                        </span>
                                    </p>

                                    <div className="mt-6 rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/40 p-5">
                                        <p className="text-xs font-black uppercase tracking-wide text-blue-900 dark:text-blue-300 mb-3">
                                            Market Stall Lease Assessment
                                        </p>

                                        <div className="space-y-0 text-sm">
                                            <div className="flex justify-between items-center gap-4 py-2 border-b border-blue-200 dark:border-blue-900/60">
                                                <span className="text-slate-600 dark:text-slate-400">Market</span>
                                                <span className="font-bold text-slate-900 dark:text-white text-right">
                                                    {selectedLease.marketName}
                                                </span>
                                            </div>

                                            <div className="flex justify-between items-center gap-4 py-2 border-b border-blue-200 dark:border-blue-900/60">
                                                <span className="text-slate-600 dark:text-slate-400">Section</span>
                                                <span className="font-bold text-slate-900 dark:text-white">
                                                    {selectedLease.section}
                                                </span>
                                            </div>

                                            <div className="flex justify-between items-center gap-4 py-2">
                                                <span className="text-slate-600 dark:text-slate-400">Stall Number</span>
                                                <span className="font-bold text-slate-900 dark:text-white">
                                                    {selectedLease.stallNumber}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center gap-4 mt-3 pt-3 border-t border-blue-300 dark:border-blue-800">
                                            <span className="font-black text-blue-800 dark:text-blue-300">Total Payable Assessment</span>
                                            <span className="font-black text-lg text-blue-700 dark:text-blue-400 whitespace-nowrap">
                                                ₱{Number(selectedLease.amountDue || 0).toLocaleString("en-PH", {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                })}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800">
                                        <p className="text-4xl sm:text-5xl font-black text-emerald-600 dark:text-emerald-400">
                                            ₱{Number(selectedLease.amountDue || 0).toLocaleString("en-PH", {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </p>

                                        <div className="flex justify-between items-center mt-8 text-sm">
                                            <span className="text-slate-600 dark:text-slate-400">Subtotal</span>
                                            <span className="font-bold text-slate-900 dark:text-white">
                                                ₱{Number(selectedLease.amountDue || 0).toLocaleString("en-PH", {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                })}
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center mt-4 text-sm">
                                            <span className="text-slate-600 dark:text-slate-400">Payment Fees</span>
                                            <span className="font-semibold text-slate-900 dark:text-white">Free</span>
                                        </div>

                                        <div className="flex justify-between items-center mt-5 pt-5 border-t border-slate-200 dark:border-slate-800">
                                            <span className="font-black text-slate-900 dark:text-white">Total Due</span>
                                            <span className="font-black text-lg text-slate-900 dark:text-white">
                                                ₱{Number(selectedLease.amountDue || 0).toLocaleString("en-PH", {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 sm:p-6 lg:p-8 bg-slate-50/60 dark:bg-slate-950/40 flex flex-col items-center min-w-0">
                                    <div className="w-full text-center">
                                        <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                                            Scan QR Ph code to pay
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                            Use your supported banking or e-wallet app.
                                        </p>
                                    </div>

                                    {isGeneratingQr && !qrImageUrl && (
                                        <div className="w-full max-w-sm mt-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-10 flex flex-col items-center text-center shadow-sm">
                                            <div className="h-10 w-10 border-4 border-blue-200 border-t-blue-700 rounded-full animate-spin mb-4" />
                                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                                Generating QR Ph code...
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                Please wait while PayMongo prepares your secure payment.
                                            </p>
                                        </div>
                                    )}

                                    {!isGeneratingQr && qrGenerationError && !qrImageUrl && (
                                        <div className="w-full max-w-sm mt-5 rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/60 p-4 sm:p-5 text-center">
                                            <p className="text-xs font-bold text-rose-700 dark:text-rose-300">
                                                {qrGenerationError}
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => void openPaymentForLease(selectedLease)}
                                                className="mt-4 px-5 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold cursor-pointer"
                                            >
                                                Generate QR Again
                                            </button>
                                        </div>
                                    )}

                                    {qrImageUrl && !isPaymentSuccess && (
                                        <div className="w-full flex flex-col items-center mt-5">
                                            <div className="w-full max-w-sm rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/50 px-3 sm:px-4 py-3 text-center mb-4">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300">
                                                    QR Code Refreshes In
                                                </p>
                                                <p className="text-xl sm:text-2xl font-black tabular-nums text-blue-700 dark:text-blue-300">
                                                    {Math.floor(qrTimeLeft / 60)}:{String(qrTimeLeft % 60).padStart(2, "0")}
                                                </p>
                                                {qrReferenceNumber && (
                                                    <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                                                        Ref: {qrReferenceNumber}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="bg-white border border-slate-200 dark:border-slate-700 rounded-2xl p-3 sm:p-4 shadow-md max-w-full">
                                                <img
                                                    src={qrImageUrl}
                                                    alt="PayMongo Dynamic QR Ph payment code"
                                                    className="w-[min(72vw,18rem)] h-[min(72vw,18rem)] max-w-full object-contain"
                                                />
                                            </div>

                                            <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-3 max-w-sm px-2">
                                                Scan the QR code with your preferred supported payment app. Your payment will be confirmed automatically through PayMongo.
                                            </p>

                                            <div className="mt-4 flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-400">
                                                <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                                                Waiting for payment...
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end sticky bottom-0">
                                <button
                                    type="button"
                                    onClick={closePayment}
                                    disabled={isGeneratingQr}
                                    className="px-6 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 dark:text-slate-200 font-bold text-sm transition-colors cursor-pointer"
                                >
                                    Close
                                </button>
                            </div>
                        </>
                    </div>
                </div>
            )}

            {isPaymentSuccess && selectedLease && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-md overflow-y-auto overscroll-contain">
                    <div className="relative w-full max-w-lg max-h-[94vh] overflow-y-auto rounded-2xl sm:rounded-[28px] bg-white dark:bg-slate-900 p-5 sm:p-8 shadow-2xl text-center border border-slate-200 dark:border-slate-800">
                        <div className="mx-auto mb-4 sm:mb-5 h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
                            <svg viewBox="0 0 52 52" className="h-10 w-10 sm:h-12 sm:w-12 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 27l8 8 17-19" />
                            </svg>
                        </div>

                        <p className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950/80 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                            PAYMENT CONFIRMED
                        </p>

                        <h2 className="mt-3 sm:mt-4 text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                            Payment Successful!
                        </h2>

                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                            Your Market Stall payment has been confirmed.
                        </p>

                        <div className="mt-5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-4 sm:p-5 text-left space-y-3 text-sm overflow-x-auto text-slate-800 dark:text-slate-200">
                            <div className="flex justify-between gap-4">
                                <span className="text-slate-500 dark:text-slate-400">Service</span>
                                <span className="font-bold text-right text-slate-900 dark:text-white">Market Stall Lease</span>
                            </div>

                            <div className="flex justify-between gap-4">
                                <span className="text-slate-500 dark:text-slate-400">Lease ID</span>
                                <span className="font-mono font-bold text-right text-slate-900 dark:text-white">{selectedLease.leaseId}</span>
                            </div>

                            <div className="flex justify-between gap-4">
                                <span className="text-slate-500 dark:text-slate-400">Amount Paid</span>
                                <span className="font-black text-slate-900 dark:text-white">
                                    ₱{Number(selectedLease.amountDue || 0).toLocaleString("en-PH", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                    })}
                                </span>
                            </div>

                            <div className="flex justify-between gap-4">
                                <span className="text-slate-500 dark:text-slate-400">Reference</span>
                                <span className="font-mono font-bold text-right break-all text-slate-900 dark:text-white">
                                    {selectedLease.paymentReference || qrReferenceNumber || selectedLease.leaseId}
                                </span>
                            </div>

                            {paymentConfirmedAt && (
                                <div className="flex justify-between gap-4">
                                    <span className="text-slate-500 dark:text-slate-400">Date</span>
                                    <span className="font-bold text-right text-slate-900 dark:text-white">
                                        {paymentConfirmedAt.toLocaleString("en-PH")}
                                    </span>
                                </div>
                            )}

                            <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    Official Receipt (O.R.) Number
                                </p>
                                <p className="mt-1 font-mono text-base font-black text-emerald-600 dark:text-emerald-400">
                                    {paymentOfficialReceipt || selectedLease.officialReceiptNumber || "Not yet issued"}
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                setIsPaymentSuccess(false);
                                setIsPaymentOpen(false);
                                setPaymentOfficialReceipt("");
                                setPaymentConfirmedAt(null);
                                setSelectedLease(null);
                                setQrReferenceNumber("");
                                void (async () => {
                                    try {
                                        const fresh = await getLeases();
                                        setAllLeases(fresh as CitizenLeaseRecord[]);
                                        setFilteredLeases(fresh as CitizenLeaseRecord[]);
                                    } catch (error) {
                                        console.error("Failed to refresh market leases:", error);
                                    }
                                })();
                            }}
                            className="mt-6 w-full rounded-xl bg-[#1D3F99] hover:bg-[#17357F] text-white py-3 font-extrabold text-sm cursor-pointer"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
                </div>
            </div>
        </CitizenLayout>
    );
}