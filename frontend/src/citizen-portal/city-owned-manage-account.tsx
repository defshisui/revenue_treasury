import { useState, useEffect } from 'react';
import { getLeases } from '../services/marketService';
import type { LeaseRecord } from '../services/marketService';
import { UnifiedHeader } from './UnifiedHeader';
import { UnifiedFooter } from './UnifiedFooter';
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

    const handleBack = () => {
        window.history.back();
    };
    return (
        <div className="w-full min-h-screen bg-slate-100 text-slate-800 flex flex-col antialiased relative">
            <UnifiedHeader />
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 font-['Segoe_UI',Tahoma,Geneva,Verdana,sans-serif]">
                <div className="w-full bg-white border border-slate-300 rounded-lg shadow-md overflow-hidden flex flex-col pb-5">
                    <div className="flex justify-between items-center p-[20px_24px] border-b-2 border-slate-200">
                        <h2 className="text-[1.1rem] font-bold text-slate-800 tracking-[0.5px] uppercase">
                            My Active Market Leases
                        </h2>
                        <button
                            onClick={handleBack}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-md text-[0.85rem] font-semibold transition-colors cursor-pointer"
                        >
                            <span>&larr;</span> Back
                        </button>
                    </div>
                    <div className="p-6 bg-white grid grid-cols-1 lg:grid-cols-3 gap-x-6 gap-y-5 items-end border-b border-slate-200">
                        <div className="flex flex-col gap-[6px]">
                            <label htmlFor="leaseId" className="text-[0.85rem] font-semibold text-slate-800">Lease ID</label>
                            <input
                                type="text" id="leaseId" value={leaseId} onChange={(e) => setLeaseId(e.target.value)}
                                className="w-full px-[14px] py-[10px] border border-slate-300 rounded-md text-[0.9rem] outline-none transition-all bg-white text-slate-800 focus:border-blue-800 focus:ring-[3px] focus:ring-blue-800/15"
                            />
                        </div>
                        <div className="flex flex-col gap-[6px]">
                            <label htmlFor="firstName" className="text-[0.85rem] font-semibold text-slate-800">First Name of Stallholder</label>
                            <input
                                type="text" id="firstName" value={firstName} readOnly disabled
                                className="w-full px-[14px] py-[10px] border border-slate-300 rounded-md text-[0.9rem] outline-none transition-all bg-slate-100 text-slate-500 cursor-not-allowed"
                            />
                        </div>
                        <div className="flex flex-col gap-[6px]">
                            <label htmlFor="lastName" className="text-[0.85rem] font-semibold text-slate-800">Last Name of Stallholder</label>
                            <input
                                type="text" id="lastName" value={lastName} readOnly disabled
                                className="w-full px-[14px] py-[10px] border border-slate-300 rounded-md text-[0.9rem] outline-none transition-all bg-slate-100 text-slate-500 cursor-not-allowed"
                            />
                        </div>
                        <div className="flex flex-col gap-[6px]">
                            <label htmlFor="marketName" className="text-[0.85rem] font-semibold text-slate-800">Name of City Market</label>
                            <select
                                id="marketName" value={marketName} onChange={(e) => setMarketName(e.target.value)}
                                className="w-full px-[14px] py-[10px] border border-slate-300 rounded-md text-[0.9rem] outline-none transition-all bg-white text-slate-500 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.36%22%20height%3D%22292.36%22%3E%3Cpath%20fill%3D%22%23718096%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[length:10px] bg-[position:right_14px_center] pr-[35px] focus:border-blue-800 focus:ring-[3px] focus:ring-blue-800/15"
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
                            <label htmlFor="leaseStatus" className="text-[0.85rem] font-semibold text-slate-800">Lease Status</label>
                            <select
                                id="leaseStatus" value={leaseStatus} onChange={(e) => setLeaseStatus(e.target.value)}
                                className="w-full px-[14px] py-[10px] border border-slate-300 rounded-md text-[0.9rem] outline-none transition-all bg-white text-slate-500 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.36%22%20height%3D%22292.36%22%3E%3Cpath%20fill%3D%22%23718096%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[length:10px] bg-[position:right_14px_center] pr-[35px] focus:border-blue-800 focus:ring-[3px] focus:ring-blue-800/15"
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
                            <label htmlFor="paymentStatus" className="text-[0.85rem] font-semibold text-slate-800">Payment Status</label>
                            <select
                                id="paymentStatus" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}
                                className="w-full px-[14px] py-[10px] border border-slate-300 rounded-md text-[0.9rem] outline-none transition-all bg-white text-slate-500 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.36%22%20height%3D%22292.36%22%3E%3Cpath%20fill%3D%22%23718096%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[length:10px] bg-[position:right_14px_center] pr-[35px] focus:border-blue-800 focus:ring-[3px] focus:ring-blue-800/15"
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
                    <div className="p-[16px_24px] font-bold text-[0.9rem] text-slate-800 flex justify-between items-center">
                        <span>Due Date: 08/20/2026</span>
                        <span className="text-[0.75rem] font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200 shadow-sm">
                            Showing {filteredLeases.length} results
                        </span>
                    </div>
                    <div className="w-full overflow-x-auto min-h-[280px] bg-slate-50 border-t border-b border-slate-300 flex flex-col justify-start">
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
                                        <td colSpan={12} className="p-[16px_14px] text-[0.85rem] border-b border-slate-200 bg-white text-center">
                                            <div className="text-center p-[50px_20px] text-slate-500">
                                                <p className="font-semibold animate-pulse">Loading lease records...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredLeases.length > 0 ? (
                                    filteredLeases.map((lease) => (
                                        <tr key={lease.leaseId} className="border-b border-slate-200 bg-white hover:bg-slate-50 transition-colors text-[0.85rem] text-slate-800">
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
                                                <button
                                                    type="button"
                                                    onClick={() => openLeaseDetails(lease)}
                                                    className="text-blue-600 hover:text-blue-800 font-semibold hover:underline text-[0.8rem] cursor-pointer"
                                                >
                                                    View Details
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={12} className="p-[16px_14px] text-[0.85rem] border-b border-slate-200 bg-white text-center">
                                            <div className="text-center p-[50px_20px] text-slate-500">
                                                <div className="w-[40px] h-[40px] mx-auto mb-[10px] opacity-30 bg-slate-400 rounded-[6px]"></div>
                                                <p>No Active Leases Found for Your Account</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex flex-col gap-4 p-[20px_24px_10px_24px]">
                        <div className="flex justify-between items-center text-[0.85rem] text-slate-500">
                            <div>
                                Show{' '}
                                <select
                                    value={entriesCount}
                                    onChange={(e) => setEntriesCount(e.target.value)}
                                    className="p-[4px_8px] border border-slate-300 rounded-[4px] outline-none text-slate-800 bg-white w-auto inline-block"
                                >
                                    <option value="0">0</option>
                                    <option value="10">10</option>
                                    <option value="25">25</option>
                                </select>{' '}
                                of {filteredLeases.length} entries
                            </div>
                            <div className="flex items-center gap-1">
                                <button className="bg-white border border-slate-300 p-[6px_12px] rounded-[4px] cursor-pointer text-slate-800 text-[0.85rem] opacity-40 cursor-not-allowed" disabled>&laquo;</button>
                                <button className="bg-white border border-slate-300 p-[6px_12px] rounded-[4px] cursor-pointer text-slate-800 text-[0.85rem] opacity-40 cursor-not-allowed" disabled>&lsaquo;</button>
                                <button className="border p-[6px_12px] rounded-[4px] cursor-pointer text-[0.85rem] bg-blue-900 text-white border-blue-900">1</button>
                                <button className="bg-white border border-slate-300 p-[6px_12px] rounded-[4px] cursor-pointer text-slate-800 text-[0.85rem] opacity-40 cursor-not-allowed" disabled>&rsaquo;</button>
                                <button className="bg-white border border-slate-300 p-[6px_12px] rounded-[4px] cursor-pointer text-slate-800 text-[0.85rem] opacity-40 cursor-not-allowed" disabled>&raquo;</button>
                            </div>
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-[0.85rem] text-slate-800 cursor-pointer select-none">
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
            </main>

            {isDetailsOpen && selectedLease && (
                <div className="fixed inset-0 z-[70] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
                    <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-900">
                                    Market Stall Lease
                                </p>
                                <h3 className="text-xl font-black text-slate-900 mt-1">
                                    Lease Details
                                </h3>
                                <p className="text-xs font-mono text-blue-600 mt-1">
                                    {selectedLease.leaseId}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={closeLeaseDetails}
                                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Stallholder</p>
                                    <p className="mt-1 font-bold text-slate-900">
                                        {selectedLease.firstName} {selectedLease.lastName}
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Market</p>
                                    <p className="mt-1 font-bold text-slate-900">
                                        {selectedLease.marketName}
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Section / Stall</p>
                                    <p className="mt-1 font-bold text-slate-900">
                                        {selectedLease.section} / Stall {selectedLease.stallNumber}
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Lease Status</p>
                                    <p className="mt-1 font-bold text-slate-900">
                                        {selectedLease.leaseStatus}
                                    </p>
                                </div>
                            </div>

                            <div className="p-5 rounded-2xl border border-blue-200 bg-blue-50">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                                            Market Stall Assessment
                                        </p>
                                        <p className="text-2xl font-black text-[#0B3B60] mt-1">
                                            {selectedLease.amountDue.toLocaleString("en-PH", {
                                                style: "currency",
                                                currency: "PHP",
                                                minimumFractionDigits: 2,
                                            })}
                                        </p>
                                    </div>

                                    <span
                                        className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase ${selectedLease.paymentStatus === "Paid"
                                            ? "bg-emerald-100 text-emerald-800"
                                            : "bg-white text-blue-800 border border-blue-200"
                                            }`}
                                    >
                                        {selectedLease.paymentStatus === "Paid"
                                            ? "PAID"
                                            : "FOR PAYMENT"}
                                    </span>
                                </div>

                                <div className="mt-5 pt-4 border-t border-blue-200">
                                    {selectedLease.paymentStatus === "Paid" ? (
                                        <div className="space-y-2 text-xs font-semibold text-emerald-800">
                                            <p>✓ Payment confirmed</p>

                                            <div className="rounded-xl bg-white border border-emerald-200 p-3">
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                    Official Receipt (O.R.) Number
                                                </p>
                                                <p className="mt-1 font-mono text-sm font-black">
                                                    {getOfficialReceiptNumber(selectedLease) || "Not yet issued"}
                                                </p>
                                            </div>

                                            {selectedLease.paymentReference && (
                                                <p>
                                                    Reference:{" "}
                                                    <span className="font-mono">
                                                        {selectedLease.paymentReference}
                                                    </span>
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-[11px] text-blue-800 leading-relaxed mb-4">
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
                    <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-5xl max-h-[96vh] shadow-2xl border border-slate-200 overflow-y-auto my-auto">
                        <>
                            <div className="grid grid-cols-1 lg:grid-cols-2 min-w-0">
                                <div className="p-4 sm:p-6 lg:p-8 lg:border-r border-slate-200 min-w-0">
                                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                                        Market Stall Payment
                                    </h2>

                                    <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1 break-all">
                                        ({paymentLeaseId})
                                    </p>

                                    <p className="text-sm text-slate-500 mt-3">
                                        Market Stall Lease Payment ({selectedLease.marketName})
                                    </p>

                                    <p className="text-sm text-slate-600 mt-4">
                                        Billed to{" "}
                                        <span className="font-bold text-slate-900">
                                            {selectedLease.firstName} {selectedLease.lastName}
                                        </span>
                                    </p>

                                    <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50/60 p-5">
                                        <p className="text-xs font-black uppercase tracking-wide text-blue-900 mb-3">
                                            Market Stall Lease Assessment
                                        </p>

                                        <div className="space-y-0 text-sm">
                                            <div className="flex justify-between items-center gap-4 py-2 border-b border-blue-200">
                                                <span className="text-slate-600">Market</span>
                                                <span className="font-bold text-slate-900 text-right">
                                                    {selectedLease.marketName}
                                                </span>
                                            </div>

                                            <div className="flex justify-between items-center gap-4 py-2 border-b border-blue-200">
                                                <span className="text-slate-600">Section</span>
                                                <span className="font-bold text-slate-900">
                                                    {selectedLease.section}
                                                </span>
                                            </div>

                                            <div className="flex justify-between items-center gap-4 py-2">
                                                <span className="text-slate-600">Stall Number</span>
                                                <span className="font-bold text-slate-900">
                                                    {selectedLease.stallNumber}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center gap-4 mt-3 pt-3 border-t border-blue-300">
                                            <span className="font-black text-blue-800">Total Payable Assessment</span>
                                            <span className="font-black text-lg text-blue-700 whitespace-nowrap">
                                                ₱{Number(selectedLease.amountDue || 0).toLocaleString("en-PH", {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                })}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-6 pt-5 border-t border-slate-200">
                                        <p className="text-4xl sm:text-5xl font-black text-emerald-600">
                                            ₱{Number(selectedLease.amountDue || 0).toLocaleString("en-PH", {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </p>

                                        <div className="flex justify-between items-center mt-8 text-sm">
                                            <span className="text-slate-600">Subtotal</span>
                                            <span className="font-bold text-slate-900">
                                                ₱{Number(selectedLease.amountDue || 0).toLocaleString("en-PH", {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                })}
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center mt-4 text-sm">
                                            <span className="text-slate-600">Payment Fees</span>
                                            <span className="font-semibold text-slate-900">Free</span>
                                        </div>

                                        <div className="flex justify-between items-center mt-5 pt-5 border-t border-slate-200">
                                            <span className="font-black text-slate-900">Total Due</span>
                                            <span className="font-black text-lg text-slate-900">
                                                ₱{Number(selectedLease.amountDue || 0).toLocaleString("en-PH", {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 sm:p-6 lg:p-8 bg-slate-50/60 flex flex-col items-center min-w-0">
                                    <div className="w-full text-center">
                                        <p className="text-base sm:text-lg font-black text-slate-900">
                                            Scan QR Ph code to pay
                                        </p>
                                        <p className="text-xs text-slate-500 mt-2">
                                            Use your supported banking or e-wallet app.
                                        </p>
                                    </div>

                                    {isGeneratingQr && !qrImageUrl && (
                                        <div className="w-full max-w-sm mt-5 rounded-2xl border border-slate-200 bg-white p-6 sm:p-10 flex flex-col items-center text-center shadow-sm">
                                            <div className="h-10 w-10 border-4 border-blue-200 border-t-blue-700 rounded-full animate-spin mb-4" />
                                            <p className="text-sm font-bold text-slate-800">
                                                Generating QR Ph code...
                                            </p>
                                            <p className="text-xs text-slate-500 mt-1">
                                                Please wait while PayMongo prepares your secure payment.
                                            </p>
                                        </div>
                                    )}

                                    {!isGeneratingQr && qrGenerationError && !qrImageUrl && (
                                        <div className="w-full max-w-sm mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:p-5 text-center">
                                            <p className="text-xs font-bold text-rose-700">
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
                                            <div className="w-full max-w-sm rounded-xl border border-blue-200 bg-blue-50 px-3 sm:px-4 py-3 text-center mb-4">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">
                                                    QR Code Refreshes In
                                                </p>
                                                <p className="text-xl sm:text-2xl font-black tabular-nums text-blue-700">
                                                    {Math.floor(qrTimeLeft / 60)}:{String(qrTimeLeft % 60).padStart(2, "0")}
                                                </p>
                                                {qrReferenceNumber && (
                                                    <p className="text-[10px] font-mono text-slate-500 mt-1">
                                                        Ref: {qrReferenceNumber}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-md max-w-full">
                                                <img
                                                    src={qrImageUrl}
                                                    alt="PayMongo Dynamic QR Ph payment code"
                                                    className="w-[min(72vw,18rem)] h-[min(72vw,18rem)] max-w-full object-contain"
                                                />
                                            </div>

                                            <p className="text-xs text-slate-500 text-center mt-3 max-w-sm px-2">
                                                Scan the QR code with your preferred supported payment app. Your payment will be confirmed automatically through PayMongo.
                                            </p>

                                            <div className="mt-4 flex items-center gap-2 text-xs font-bold text-blue-700">
                                                <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                                                Waiting for payment...
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5 border-t border-slate-200 bg-white flex justify-end sticky bottom-0">
                                <button
                                    type="button"
                                    onClick={closePayment}
                                    disabled={isGeneratingQr}
                                    className="px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 font-bold text-sm transition-colors cursor-pointer"
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
                    <div className="relative w-full max-w-lg max-h-[94vh] overflow-y-auto rounded-2xl sm:rounded-[28px] bg-white p-5 sm:p-8 shadow-2xl text-center">
                        <div className="mx-auto mb-4 sm:mb-5 h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-emerald-100 flex items-center justify-center">
                            <svg viewBox="0 0 52 52" className="h-10 w-10 sm:h-12 sm:w-12 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 27l8 8 17-19" />
                            </svg>
                        </div>

                        <p className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                            PAYMENT CONFIRMED
                        </p>

                        <h2 className="mt-3 sm:mt-4 text-xl sm:text-2xl font-black text-slate-900">
                            Payment Successful!
                        </h2>

                        <p className="mt-2 text-sm text-slate-500">
                            Your Market Stall payment has been confirmed.
                        </p>

                        <div className="mt-5 rounded-2xl bg-slate-50 border border-slate-200 p-4 sm:p-5 text-left space-y-3 text-sm overflow-x-auto">
                            <div className="flex justify-between gap-4">
                                <span className="text-slate-500">Service</span>
                                <span className="font-bold text-right">Market Stall Lease</span>
                            </div>

                            <div className="flex justify-between gap-4">
                                <span className="text-slate-500">Lease ID</span>
                                <span className="font-mono font-bold text-right">{selectedLease.leaseId}</span>
                            </div>

                            <div className="flex justify-between gap-4">
                                <span className="text-slate-500">Amount Paid</span>
                                <span className="font-black">
                                    ₱{Number(selectedLease.amountDue || 0).toLocaleString("en-PH", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                    })}
                                </span>
                            </div>

                            <div className="flex justify-between gap-4">
                                <span className="text-slate-500">Reference</span>
                                <span className="font-mono font-bold text-right break-all">
                                    {selectedLease.paymentReference || qrReferenceNumber || selectedLease.leaseId}
                                </span>
                            </div>

                            {paymentConfirmedAt && (
                                <div className="flex justify-between gap-4">
                                    <span className="text-slate-500">Date</span>
                                    <span className="font-bold text-right">
                                        {paymentConfirmedAt.toLocaleString("en-PH")}
                                    </span>
                                </div>
                            )}

                            <div className="pt-3 border-t border-slate-200">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    Official Receipt (O.R.) Number
                                </p>
                                <p className="mt-1 font-mono text-base font-black text-emerald-600">
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
            <UnifiedFooter />
        </div>
    );
}