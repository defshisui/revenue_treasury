
import React, { useState, useEffect, useRef } from "react";
import logoSystem from '../assets/logo-system.png';
import { API_BASE_URL } from "../config/api";
import { saveLease, getLeases } from "../services/marketService";
import type { LeaseRecord } from "../services/marketService";
import {
    verifyPayMongoSession,
    createPayMongoQrPaymentIntent,
    createQrPhPaymentMethod,
    attachQrPhPaymentMethod,
} from "../services/paymongoService";

// Interfaces for Market Data
interface MarketInfo {
    address: string;
    name: string;
    title: string;
    phone: string;
    email: string;
    total: number;
    vacant: number;
    occupied: number;
    floors: number;
}

interface StallDetails {
    stallNum: number;
    holder: string;
    availability: "Occupied" | "Vacant";
    section: string;
    type: string;
    size: string;
    classification: string;
    fee: string;
}

const marketDatabase: Record<string, MarketInfo> = {
    "Galas": {
        address: "Luzon Avenue cor. Unang Hakbang St., Barangay San Isidro, District 4, Quezon City",
        name: "Mr. Leon S Kenndy",
        title: "Market Supervisor",
        phone: "8426-30-03",
        email: "LeonSK1998@gmail.com",
        total: 620,
        vacant: 44,
        occupied: 572,
        floors: 3
    },
    "Kamuning": {
        address: "K-J St., Kamuning, Quezon City",
        name: "Atty. Galbrena Domingo",
        title: "Market Supervisor",
        phone: "8928-12-34",
        email: "GalbrenaDomingo@quezoncity.gov.ph",
        total: 450,
        vacant: 22,
        occupied: 428,
        floors: 2
    },
    "Murphy": {
        address: "Boni Serrano Ave, Cubao, Quezon City",
        name: "Mrs. Rhaenyra Targaryen",
        title: "Market Supervisor",
        phone: "8721-55-88",
        email: "murphymarket@quezoncity.gov.ph",
        total: 310,
        vacant: 15,
        occupied: 295,
        floors: 2
    },
    "Project 2": {
        address: "Anonas St., Project 2, Quezon City",
        name: "Arya Stark",
        title: "Market Supervisor",
        phone: "8911-22-33",
        email: "project2market@quezoncity.gov.ph",
        total: 280,
        vacant: 10,
        occupied: 270,
        floors: 1
    },
    "Project 4": {
        address: "F. Castillo St., Project 4, Quezon City",
        name: "Market Supervisor Office",
        title: "Market Supervisor",
        phone: "8732-44-11",
        email: "project4market@quezoncity.gov.ph",
        total: 400,
        vacant: 30,
        occupied: 370,
        floors: 2
    },
    "RA Calalay": {
        address: "Congressional Ave, Quezon City",
        name: "Temporary Operations Lead",
        title: "Operations Lead",
        phone: "8451-99-00",
        email: "racalalaymarket@quezoncity.gov.ph",
        total: 150,
        vacant: 8,
        occupied: 142,
        floors: 1
    },
    "Roxas": {
        address: "Roxas District, Quezon City",
        name: "Market Supervisor Office",
        title: "Market Supervisor",
        phone: "8925-77-66",
        email: "roxasmarket@quezoncity.gov.ph",
        total: 220,
        vacant: 12,
        occupied: 208,
        floors: 1
    },
    "San Jose": {
        address: "San Jose, Quezon City",
        name: "Market Supervisor Office",
        title: "Market Supervisor",
        phone: "8361-88-22",
        email: "sanjosemarket@quezoncity.gov.ph",
        total: 190,
        vacant: 9,
        occupied: 181,
        floors: 1
    }
};

export default function MarketStallApplication() {
    const [selectedMarket, setSelectedMarket] = useState<string>("");
    const [isFloorPlanOpen, setIsFloorPlanOpen] = useState<boolean>(false);
    const [selectedFloor, setSelectedFloor] = useState<string>("1");

    // Auth Session State matching MarketVendorsHub layout
    const [currentUser, setCurrentUser] = useState<{ fullname: string; email: string; initials: string; firstName: string } | null>(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Leases synced from database layer to dynamically track occupancy status
    const [leases, setLeases] = useState<LeaseRecord[]>([]);

    // Modal state for active stall details
    const [activeStall, setActiveStall] = useState<StallDetails | null>(null);

    // Application Form States
    const [isApplicationFormOpen, setIsApplicationFormOpen] = useState<boolean>(false);
    const [firstName, setFirstName] = useState<string>("");
    const [lastName, setLastName] = useState<string>("");

    // Digital Payment Integration States
    const [isPaymentStep, setIsPaymentStep] = useState<boolean>(false);
    const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
    const [qrImageUrl, setQrImageUrl] = useState<string>("");
    const [, setQrReferenceNumber] = useState<string>("");
    const [paymentLeaseId, setPaymentLeaseId] = useState<string>("");
    const [paymentIntentId, setPaymentIntentId] = useState<string>("");
    const [isGeneratingQr, setIsGeneratingQr] = useState<boolean>(false);
    const [qrGenerationError, setQrGenerationError] = useState<string>("");
    const [qrTimeLeft, setQrTimeLeft] = useState<number>(300);

    // Payment success animation / confirmation modal
    const [isPaymentSuccess, setIsPaymentSuccess] = useState<boolean>(false);
    const [paymentSuccessCountdown, setPaymentSuccessCountdown] = useState<number>(5);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Fetch leases and check active user session on initial mount
    useEffect(() => {
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
                const initials = nameParts.length > 1
                    ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
                    : nameParts[0].slice(0, 2).toUpperCase();

                return { fullname: String(fullName), email, firstName, initials };
            } catch (e) {
                console.error("Failed to parse user session", e);
                return null;
            }
        };

        const fetchInitialData = async () => {
            try {
                setCurrentUser(checkUserSession());
                const data = await getLeases();
                setLeases(data);

                // Check for PayMongo return callback
                const urlParams = new URLSearchParams(window.location.search);
                const paymentSuccess = urlParams.get("payment") === "success";
                const sessionId = urlParams.get("session_id");

                if (paymentSuccess && sessionId) {
                    try {
                        const verifyRes = await verifyPayMongoSession(sessionId);
                        if (verifyRes.paid) {
                            alert(`PayMongo Payment Verified!\nOfficial Receipt: ${verifyRes.officialReceiptNumber}\nReference: ${verifyRes.paymentReference}`);
                            const updatedLeases = await getLeases();
                            setLeases(updatedLeases);
                        }
                    } catch (verifyErr) {
                        console.error("PayMongo return verification error:", verifyErr);
                    } finally {
                        window.history.replaceState({}, document.title, window.location.pathname);
                    }
                }
            } catch (err) {
                console.error("Error loading initial data:", err);
            }
        };
        fetchInitialData();
    }, []);

    /**
     * Creates the Dynamic QR Ph payment and keeps the customer inside our
     * own payment screen. No PayMongo hosted checkout redirect is used.
     */
    const handlePayMongoQrPayment = async (refreshExistingQr = false) => {
        if (!activeStall || !selectedMarket) return;

        setIsProcessingPayment(true);
        setIsGeneratingQr(true);
        setQrGenerationError("");
        if (!refreshExistingQr) {
            setQrImageUrl("");
            setQrReferenceNumber("");
            setPaymentLeaseId("");
        }

        const feeAmount =
            parseFloat(activeStall.fee.replace(/[^\d.]/g, "")) || 1500.00;
        const generatedLeaseId =
            refreshExistingQr && paymentLeaseId
                ? paymentLeaseId
                : `LEASE-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

        const pendingLease: LeaseRecord = {
            leaseId: generatedLeaseId,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            marketName: `${selectedMarket} City-Owned Market`,
            section: activeStall.section + " Section",
            stallNumber: `${activeStall.stallNum}`,
            leaseStatus: "Active",
            amountDue: feeAmount,
            helperApprovalStatus: "Pending",
            advancePaymentStatus: "Pending",
            paymentStatus: "Pending Payment",
            paymentMethod: "QR Ph",
        };

        try {
            // Save the application only on the first QR generation.
            // When the 5-minute QR expires, refresh the QR for the same lease
            // instead of creating duplicate lease records.
            if (!refreshExistingQr) {
                await saveLease(pendingLease);
                setLeases((prev) => [...prev, pendingLease]);
                setPaymentLeaseId(generatedLeaseId);
            }

            // 1. Create a PayMongo Payment Intent for QR Ph.
            const intent = await createPayMongoQrPaymentIntent({
                amount: feeAmount,
                leaseId: generatedLeaseId,
                customerName: `${firstName.trim()} ${lastName.trim()}`,
                customerEmail: currentUser?.email || "vendor@gov.ph",
                description:
                    `Market Stall Rental - Stall #${activeStall.stallNum} - ${selectedMarket}`,
            });

            setPaymentIntentId(intent.paymentIntentId);
            setQrReferenceNumber(intent.referenceNumber || generatedLeaseId);

            // 2. Create the QR Ph Payment Method using the PayMongo public key.
            const paymentMethodId = await createQrPhPaymentMethod(
                intent.publicKey
            );

            // 3. Attach the QR Ph Payment Method to the Payment Intent.
            const attachedIntent = await attachQrPhPaymentMethod(
                intent.paymentIntentId,
                paymentMethodId,
                intent.clientKey,
                intent.publicKey
            );

            // 4. PayMongo returns the actual Dynamic QR image here.
            const imageUrl =
                attachedIntent?.attributes?.next_action?.code?.image_url;

            if (!imageUrl) {
                console.error("PayMongo QR response:", attachedIntent);
                throw new Error(
                    "PayMongo did not return a QR code image. Check QR Ph activation and the PayMongo API response."
                );
            }

            setQrImageUrl(imageUrl);
            setQrTimeLeft(300);
        } catch (err: any) {
            console.error("PayMongo QR Ph payment error:", err);
            setQrGenerationError(err?.message || "Unable to generate the QR Ph payment.");
        } finally {
            setIsGeneratingQr(false);
            setIsProcessingPayment(false);
        }
    };

    // QR Ph countdown: 5 minutes per generated QR code.
    // When the timer reaches zero, a fresh QR is generated automatically
    // for the same lease/payment record.
    useEffect(() => {
        if (!isPaymentStep || !qrImageUrl || isGeneratingQr) return;

        const timer = window.setInterval(() => {
            setQrTimeLeft((previous) => {
                if (previous <= 1) {
                    window.clearInterval(timer);
                    void handlePayMongoQrPayment(true);
                    return 0;
                }
                return previous - 1;
            });
        }, 1000);

        return () => window.clearInterval(timer);
    }, [isPaymentStep, qrImageUrl, isGeneratingQr]);

    // Poll PayMongo while the Dynamic QR Ph code is displayed.
    // PayMongo marks the Payment Intent as "succeeded" after the citizen pays.
    // The webhook remains the primary server-side confirmation; this polling
    // simply makes the citizen portal update immediately without requiring a refresh.
    useEffect(() => {
        if (!isPaymentStep || !paymentIntentId || isGeneratingQr) return;

        let cancelled = false;

        const checkQrPaymentStatus = async () => {
            try {
                const response = await fetch(
                    `${API_BASE_URL}/api/payments/qr-status/${encodeURIComponent(paymentIntentId)}`
                );

                const data = await response.json();

                if (!response.ok || !data.success || cancelled) return;

                if (data.paid) {
                    const updatedLeases = await getLeases();
                    if (cancelled) return;

                    setLeases(updatedLeases);
                    setIsPaymentStep(false);
                    setQrImageUrl("");
                    setPaymentIntentId("");
                    setQrGenerationError("");

                    // Show the animated payment-success screen instead of a plain alert.
                    setPaymentSuccessCountdown(5);
                    setIsPaymentSuccess(true);
                }
            } catch (error) {
                console.error("QR Ph payment status check failed:", error);
            }
        };

        void checkQrPaymentStatus();

        const interval = window.setInterval(() => {
            void checkQrPaymentStatus();
        }, 2000);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, [isPaymentStep, paymentIntentId, isGeneratingQr]);

    // Automatically close the success screen after 5 seconds.
    useEffect(() => {
        if (!isPaymentSuccess) return;

        const timer = window.setInterval(() => {
            setPaymentSuccessCountdown((previous) => {
                if (previous <= 1) {
                    window.clearInterval(timer);
                    setIsPaymentSuccess(false);
                    setActiveStall(null);
                    setPaymentLeaseId("");
                    return 0;
                }
                return previous - 1;
            });
        }, 1000);

        return () => window.clearInterval(timer);
    }, [isPaymentSuccess]);

    const formatQrTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
    };

    const marketData = marketDatabase[selectedMarket];

    // Helper to dynamically evaluate if a specific stall is paid/occupied based on backend lease records
    const getStallRealtimeStatus = (stallNum: number, section: string) => {
        const matchedLease = leases.find((l) =>
            l.marketName.includes(selectedMarket) &&
            l.stallNumber === String(stallNum) &&
            l.section.toLowerCase().includes(section.toLowerCase())
        );

        const isTerminated = matchedLease?.leaseStatus?.toLowerCase() === "terminated" ||
            matchedLease?.leaseStatus?.toLowerCase() === "cancelled";

        if (matchedLease && matchedLease.paymentStatus === "Paid" && !isTerminated) {
            return {
                availability: "Occupied" as const,
                holder: `${matchedLease.firstName} ${matchedLease.lastName}`
            };
        }

        return {
            availability: "Vacant" as const,
            holder: "Available (Bakante)"
        };
    };

    const handleStallClick = (baseStall: StallDetails) => {
        const dynamicStatus = getStallRealtimeStatus(baseStall.stallNum, baseStall.section);
        setActiveStall({
            ...baseStall,
            availability: dynamicStatus.availability,
            holder: dynamicStatus.holder
        });
    };

    // Trigger opening the application form and autofilling the detected session user's name
    const handleOpenApplicationForm = () => {
        if (!currentUser) {
            alert("Please log in to your citizen portal account first to submit a market stall application.");
            return;
        }

        if (currentUser.fullname) {
            const nameParts = currentUser.fullname.trim().split(" ");
            if (nameParts.length > 1) {
                setLastName(nameParts.pop() || "");
                setFirstName(nameParts.join(" "));
            } else {
                setFirstName(currentUser.fullname);
                setLastName("");
            }
        }

        setIsApplicationFormOpen(true);
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeStall || !selectedMarket) return;

        // Close the application form and immediately open the custom
        // payment screen. The QR code is generated automatically, so the
        // customer does not need to click another payment button.
        setIsApplicationFormOpen(false);
        setIsPaymentStep(true);

        await handlePayMongoQrPayment();
    };

    const handleLogout = () => {
        localStorage.removeItem("currentUser");
        localStorage.removeItem("user");
        localStorage.removeItem("citizen_user");
        sessionStorage.removeItem("currentUser");
        sessionStorage.removeItem("user");
        setCurrentUser(null);
        setIsDropdownOpen(false);
        window.location.href = "/login";
    };

    return (
        <div className="bg-slate-100 font-sans text-slate-800 min-h-screen flex flex-col antialiased">
            {/* Main Navigation Header */}
            <header className="w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xs sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">

                    {/* Logo & Branding */}
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => { window.location.href = '/citizen-portal'; }}>
                            <div className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xs flex items-center justify-center">
                                <img
                                    src={logoSystem}
                                    alt="System Logo"
                                    className="h-8 w-8 object-contain"
                                />
                            </div>
                            <div className="flex flex-col">
                                <span className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-white leading-tight">
                                    Gov Serv
                                </span>
                                <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 tracking-wider uppercase">
                                    Unified Portal
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center space-x-6 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <span className="hover:text-blue-700 cursor-pointer" onClick={() => window.location.href = '/citizen-portal'}>HOME</span>

                        {/* Services Dropdown */}
                        <div className="relative group py-2">
                            <span className="hover:text-blue-700 cursor-pointer flex items-center gap-1 select-none">
                                SERVICES ▾
                            </span>

                            <div className="absolute left-0 top-full h-2 w-full"></div>

                            <div className="absolute left-0 top-[calc(100%+8px)] w-60 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-1 group-hover:translate-y-0">
                                <button
                                    onClick={() => window.location.href = '/citizen-portal'}
                                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-700 transition-colors cursor-pointer"
                                >
                                    Home
                                </button>
                                <button
                                    onClick={() => window.location.href = '/Market-Vendor'}
                                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-700 transition-colors cursor-pointer"
                                >
                                    Market &amp; Vendors Hub
                                </button>
                                <button
                                    onClick={() => window.location.href = '/real-property-tax-hub'}
                                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-700 transition-colors cursor-pointer"
                                >
                                    Real Property Tax Hub
                                </button>
                                <button
                                    onClick={() => window.location.href = '/Bsiness-Tax-Assessment-View'}
                                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-700 transition-colors cursor-pointer"
                                >
                                    Business Tax Assessment Hub
                                </button>
                            </div>
                        </div>

                        <span className="hover:text-blue-700 cursor-pointer">CONTACT US</span>
                    </div>

                    {/* Authentication & User Dropdown */}
                    <div className="flex items-center space-x-3">
                        {currentUser ? (
                            <div className="relative" ref={dropdownRef}>
                                <button
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    className="flex items-center space-x-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs group"
                                >
                                    <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 tracking-tight">
                                        Hi, {currentUser.firstName}
                                    </span>
                                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-[10px] shadow-sm tracking-wider">
                                        {currentUser.initials}
                                    </div>
                                </button>

                                {isDropdownOpen && (
                                    <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 z-50">
                                        <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{currentUser.fullname}</p>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{currentUser.email}</p>
                                        </div>

                                        <button
                                            onClick={() => {
                                                setIsDropdownOpen(false);
                                                window.location.href = '/edit-profile';
                                            }}
                                            className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-700 transition-colors cursor-pointer"
                                        >
                                            Edit Profile
                                        </button>

                                        <button
                                            onClick={handleLogout}
                                            className="w-full text-left px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer border-t border-slate-100 dark:border-slate-800 mt-1 pt-2"
                                        >
                                            Log Out
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <button
                                onClick={() => window.location.href = '/login'}
                                className="bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs px-4 py-2 rounded-xl shadow transition-all cursor-pointer"
                            >
                                Login / Register
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content Container */}
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-sm space-y-8">
                    <div className="border-b border-slate-200 pb-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider">Gov Serv MDAD Portal</span>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">NEW MARKET STALL APPLICATION</h2>
                        </div>
                        <button onClick={() => window.history.back()} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer inline-block border-0">
                            &larr; Back to Previous Page
                        </button>
                    </div>

                    {/* Palengke Selection Dropdown Row */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                        <label htmlFor="palengke-select" className="font-bold text-sm text-slate-700 w-44">Pamilihang Lungsod :</label>
                        <div className="flex-1 w-full max-w-md">
                            <select
                                id="palengke-select"
                                value={selectedMarket}
                                onChange={(e) => setSelectedMarket(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-900 shadow-sm"
                            >
                                <option value="">-- Pumili ng Palengke --</option>
                                <option value="Galas">Galas City-Owned Market</option>
                                <option value="Kamuning">Kamuning City-Owned Market</option>
                                <option value="Murphy">Murphy City-Owned Market</option>
                                <option value="Project 2">Project 2 City-Owned Market</option>
                                <option value="Project 4">Project 4 City-Owned Market (New)</option>
                                <option value="RA Calalay">R.A. Calalay City-Owned Market - Temporary</option>
                                <option value="Roxas">Roxas City-Owned Market</option>
                                <option value="San Jose">San Jose City-Owned Market</option>
                            </select>
                        </div>
                    </div>

                    {/* Details & Map Grid (Shown after selection) */}
                    {marketData && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-2">
                            {/* Left Column: Contact & Info */}
                            <div className="lg:col-span-5 space-y-6">
                                <div className="space-y-1.5 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                    <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Address:</h4>
                                    <p className="text-sm font-bold text-slate-800 leading-relaxed">{marketData.address}</p>
                                </div>

                                <div className="space-y-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                    <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Contact Person:</h4>
                                    <div className="space-y-1 text-sm">
                                        <p className="font-bold text-slate-900">{marketData.name}</p>
                                        <p className="font-medium text-slate-600">{marketData.title}</p>
                                        <p className="font-semibold text-slate-700">{marketData.phone}</p>
                                        <a href={`mailto:${marketData.email}`} className="font-semibold text-blue-900 hover:underline block">{marketData.email}</a>
                                    </div>
                                </div>

                                <div className="space-y-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                    <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Impormasyon sa Palengke</h4>
                                    <div className="space-y-1 text-xs font-semibold text-slate-700">
                                        <p>Kabuuang bilang ng mga stall: <span className="font-bold text-slate-900">{marketData.total}</span></p>
                                        <p>Kabuuang bilang ng mga stall na bakante: <span className="font-bold text-emerald-600">{marketData.vacant}</span></p>
                                        <p>Kabuuang bilang ng mga stall na okupado: <span className="font-bold text-rose-600">{marketData.occupied}</span></p>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                    <button onClick={() => setIsFloorPlanOpen(true)} className="flex-1 bg-blue-900 hover:bg-blue-800 text-white font-bold px-5 py-3.5 rounded-xl text-xs shadow-md transition-all text-center cursor-pointer">
                                        Tingnan ang Listahan ng available stall
                                    </button>
                                    <button onClick={() => window.history.back()} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-6 py-3.5 rounded-xl text-xs transition-colors text-center cursor-pointer border-0">
                                        Ibalik
                                    </button>
                                </div>
                            </div>

                            {/* Right Column: Floor Plan Thumbnail Placeholder */}
                            <div className="lg:col-span-7 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[380px] text-center space-y-3 cursor-pointer hover:border-blue-500 transition-all" onClick={() => setIsFloorPlanOpen(true)}>
                                <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-900 flex items-center justify-center text-2xl font-bold shadow-inner">
                                    🗺️
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-base">Market Floor Plan Preview</h3>
                                    <p className="text-xs text-slate-500 mt-1 max-w-xs">Click here or on the button to open the interactive floor plan layout and check available stalls by floor.</p>
                                </div>
                                <span className="inline-block bg-white text-blue-900 border border-blue-200 text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm">Open Floor Plan &rarr;</span>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Modal: Floor Selection & Floor Plan Interactive Popup */}
            {isFloorPlanOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-40 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-6xl w-full max-h-[92vh] flex flex-col shadow-2xl relative overflow-hidden">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900">Interactive Layout</span>
                                <h3 className="text-lg font-black text-slate-900">Market Floor Plan - {selectedMarket || "Galas"} City-Owned Market</h3>
                            </div>
                            <button onClick={() => setIsFloorPlanOpen(false)} className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold flex items-center justify-center transition-colors">✕</button>
                        </div>

                        {/* Floor Selector Bar */}
                        <div className="p-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center space-x-3">
                                <label htmlFor="floor-select" className="text-xs font-bold text-slate-700 uppercase">Pumili ng Palapag:</label>
                                <select
                                    id="floor-select"
                                    value={selectedFloor}
                                    onChange={(e) => setSelectedFloor(e.target.value)}
                                    className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-900 shadow-sm"
                                >
                                    {Array.from({ length: marketData?.floors || 3 }, (_, i) => i + 1).map((f) => (
                                        <option key={f} value={f}>
                                            Floor {f} ({f === 1 ? 'Ground Floor - Wet & Dry / Main' : f === 2 ? 'Dry Goods & Food Stalls' : 'Admin & Storage'})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-100">
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-x-auto flex flex-col items-center">
                                <div className="relative w-full max-w-4xl bg-white border-4 border-slate-800 rounded-xl p-4 shadow-inner min-h-[500px]">

                                    {selectedFloor === "1" && (
                                        <div>
                                            <div className="text-center font-bold text-xs bg-slate-200 py-1 border border-slate-400 mb-4 tracking-widest text-slate-700">
                                                {(selectedMarket || "GALAS").toUpperCase()} MARKET - GROUND FLOOR (WET & DRY SECTION)
                                            </div>
                                            <div className="grid grid-cols-12 gap-4 relative py-2">
                                                <div className="col-span-6 bg-slate-100 border-2 border-slate-700 rounded-lg p-3 relative space-y-4">
                                                    <div>
                                                        <div className="text-[10px] font-bold text-center text-blue-900 bg-blue-100 py-0.5 border border-blue-300 mb-2 uppercase">FISH SECTION</div>
                                                        <div className="grid grid-cols-6 gap-1">
                                                            {(() => {
                                                                const st1 = getStallRealtimeStatus(1, "Fish");
                                                                return (
                                                                    <button onClick={() => handleStallClick({ stallNum: 1, holder: st1.holder, availability: st1.availability, section: "Fish", type: "Permanent", size: "3 sqm", classification: "Regular", fee: "₱1.00" })} className={`${st1.availability === 'Occupied' ? 'bg-blue-700' : 'bg-blue-500'} hover:opacity-90 text-white text-[10px] font-bold h-10 rounded flex items-center justify-center relative shadow-sm cursor-pointer`}>
                                                                        1
                                                                        <span className={`absolute top-1 right-1 w-1.5 h-1.5 ${st1.availability === 'Occupied' ? 'bg-red-500' : 'bg-emerald-300'} rounded-full`}></span>
                                                                    </button>
                                                                );
                                                            })()}
                                                            {(() => {
                                                                const st5 = getStallRealtimeStatus(5, "Fish");
                                                                return (
                                                                    <button onClick={() => handleStallClick({ stallNum: 5, holder: st5.holder, availability: st5.availability, section: "Fish", type: "Permanent", size: "3 sqm", classification: "Regular", fee: "₱1.10" })} className={`${st5.availability === 'Occupied' ? 'bg-blue-700' : 'bg-blue-500'} hover:opacity-90 text-white text-[10px] font-bold h-10 rounded flex items-center justify-center relative shadow-sm cursor-pointer`}>
                                                                        5
                                                                        <span className={`absolute top-1 right-1 w-1.5 h-1.5 ${st5.availability === 'Occupied' ? 'bg-red-500' : 'bg-emerald-300'} rounded-full`}></span>
                                                                    </button>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                    <div className="bg-slate-300 text-slate-800 font-extrabold text-xs text-center py-2 tracking-widest border border-slate-400">M A I N &nbsp; H A L L W A Y</div>
                                                    <div>
                                                        <div className="text-[10px] font-bold text-center text-emerald-900 bg-emerald-100 py-0.5 border border-emerald-300 mb-2 uppercase">VEGETABLE SECTION</div>
                                                        <div className="grid grid-cols-6 gap-1">
                                                            {(() => {
                                                                const st12 = getStallRealtimeStatus(12, "Vegetables");
                                                                return (
                                                                    <button onClick={() => handleStallClick({ stallNum: 12, holder: st12.holder, availability: st12.availability, section: "Vegetables", type: "Permanent", size: "3 sqm", classification: "Regular", fee: "₱1.20" })} className={`${st12.availability === 'Occupied' ? 'bg-emerald-700' : 'bg-emerald-400'} hover:opacity-90 text-white text-[10px] font-bold h-10 rounded flex items-center justify-center relative shadow-sm cursor-pointer`}>
                                                                        12
                                                                        <span className={`absolute top-1 right-1 w-1.5 h-1.5 ${st12.availability === 'Occupied' ? 'bg-red-500' : 'bg-emerald-200'} rounded-full`}></span>
                                                                    </button>
                                                                );
                                                            })()}
                                                            {(() => {
                                                                const st14 = getStallRealtimeStatus(14, "Vegetables");
                                                                return (
                                                                    <button onClick={() => handleStallClick({ stallNum: 14, holder: st14.holder, availability: st14.availability, section: "Vegetables", type: "Permanent", size: "3 sqm", classification: "Regular", fee: "₱1.30" })} className={`${st14.availability === 'Occupied' ? 'bg-emerald-700' : 'bg-emerald-400'} hover:opacity-90 text-white text-[10px] font-bold h-10 rounded flex items-center justify-center relative shadow-sm cursor-pointer`}>
                                                                        14
                                                                        <span className={`absolute top-1 right-1 w-1.5 h-1.5 ${st14.availability === 'Occupied' ? 'bg-red-500' : 'bg-emerald-200'} rounded-full`}></span>
                                                                    </button>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="col-span-6 bg-slate-100 border-2 border-slate-700 rounded-lg p-3 relative flex flex-col justify-between space-y-4">
                                                    <div>
                                                        <div className="text-[10px] font-bold text-center text-slate-800 bg-slate-200 py-0.5 border border-slate-400 mb-2 uppercase">DRY GOODS SECTION</div>
                                                        <div className="grid grid-cols-4 gap-1">
                                                            {(() => {
                                                                const st102 = getStallRealtimeStatus(102, "Dry Goods");
                                                                return (
                                                                    <button onClick={() => handleStallClick({ stallNum: 102, holder: st102.holder, availability: st102.availability, section: "Dry Goods", type: "Permanent", size: "2.5 sqm", classification: "Regular", fee: "₱1.40" })} className={`${st102.availability === 'Occupied' ? 'bg-slate-700' : 'bg-slate-400'} hover:opacity-90 text-white text-[10px] font-bold h-10 rounded flex items-center justify-center relative shadow-sm cursor-pointer`}>
                                                                        102
                                                                        <span className={`absolute top-1 right-1 w-1.5 h-1.5 ${st102.availability === 'Occupied' ? 'bg-red-500' : 'bg-emerald-200'} rounded-full`}></span>
                                                                    </button>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {selectedFloor === "2" && (
                                        <div>
                                            <div className="text-center font-bold text-xs bg-purple-200 py-1 border border-purple-400 mb-4 tracking-widest text-purple-900">
                                                {(selectedMarket || "GALAS").toUpperCase()} MARKET - SECOND FLOOR (APPAREL &amp; FOOD STALLS)
                                            </div>
                                            <div className="grid grid-cols-4 gap-2">
                                                {(() => {
                                                    const st202 = getStallRealtimeStatus(202, "Apparel");
                                                    return (
                                                        <button onClick={() => handleStallClick({ stallNum: 202, holder: st202.holder, availability: st202.availability, section: "Apparel", type: "Permanent", size: "4 sqm", classification: "Commercial", fee: "₱1.50" })} className={`${st202.availability === 'Occupied' ? 'bg-purple-700' : 'bg-purple-400'} hover:opacity-90 text-white text-xs font-bold h-12 rounded flex items-center justify-center relative shadow-sm cursor-pointer`}>
                                                            202
                                                            <span className={`absolute top-1 right-1 w-2 h-2 ${st202.availability === 'Occupied' ? 'bg-red-500' : 'bg-emerald-300'} rounded-full`}></span>
                                                        </button>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    )}

                                    {selectedFloor === "3" && (
                                        <div className="grid grid-cols-12 gap-4 relative py-6 text-center">
                                            <div className="col-span-6 bg-slate-200 border-2 border-slate-400 rounded-xl p-6 flex flex-col justify-center items-center">
                                                <span className="text-2xl mb-2">🏢</span>
                                                <h4 className="font-bold text-slate-800 text-sm">Market Admin Office</h4>
                                                <p className="text-xs text-slate-500 mt-1">Open Monday to Friday, 8AM - 5PM</p>
                                            </div>
                                            <div className="col-span-6 bg-slate-200 border-2 border-slate-400 rounded-xl p-6 flex flex-col justify-center items-center">
                                                <span className="text-2xl mb-2">📦</span>
                                                <h4 className="font-bold text-slate-800 text-sm">Cold Storage &amp; Warehouse</h4>
                                                <p className="text-xs text-slate-500 mt-1">For vendor cargo and surplus goods</p>
                                            </div>
                                        </div>
                                    )}

                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
                            <button onClick={() => setIsFloorPlanOpen(false)} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-5 py-2 rounded-xl text-xs transition-colors cursor-pointer">
                                Close Floor Plan
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Individual Stall Details Popup */}
            {activeStall && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg p-6 max-w-sm w-full space-y-4 shadow-2xl relative border border-slate-300">
                        <div className="flex justify-between items-center pb-2">
                            <div className="flex items-center space-x-2">
                                <span className={`w-4 h-4 rounded-sm inline-block ${activeStall.availability === 'Occupied' ? 'bg-rose-600' : 'bg-emerald-500'}`}></span>
                                <h3 className="text-base font-bold text-slate-900">Stall {activeStall.stallNum}</h3>
                            </div>
                            <button onClick={() => setActiveStall(null)} className="text-slate-500 hover:text-slate-800 font-bold text-base px-1 cursor-pointer">✕</button>
                        </div>

                        <div className="space-y-2 text-xs text-slate-800">
                            <p><strong>Stallholder Name:</strong> <span className="text-slate-700">{activeStall.holder}</span></p>
                            <p className="flex items-center gap-1.5">
                                <strong>Stall Availability:</strong>
                                <span className="inline-flex items-center gap-1 text-slate-700">
                                    <span className={`w-2 h-2 rounded-full ${activeStall.availability === 'Occupied' ? 'bg-rose-600' : 'bg-emerald-500'} inline-block`}></span>
                                    {activeStall.availability}
                                </span>
                            </p>
                            <p><strong>Seksyon:</strong> <span className="text-slate-700">{activeStall.section}</span></p>
                            <p><strong>Uri:</strong> <span className="text-slate-700">{activeStall.type}</span></p>
                            <p><strong>Sukat:</strong> <span className="text-slate-700">{activeStall.size}</span></p>
                            <p><strong>Location Classification:</strong> <span className="text-slate-700">{activeStall.classification}</span></p>
                            <p className="pt-1"><strong>Rental Fee (kada buwan):</strong> <span className="text-slate-900">{activeStall.fee}</span></p>
                        </div>

                        <div className="pt-2">
                            {activeStall.availability === 'Occupied' ? (
                                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-center font-bold py-2 px-3 rounded text-xs cursor-not-allowed select-none">
                                    This stall is currently occupied and cannot be applied for.
                                </div>
                            ) : currentUser ? (
                                <button
                                    onClick={handleOpenApplicationForm}
                                    className="w-full bg-[#7a92c4] hover:bg-[#6881b5] text-white font-medium py-2 px-4 rounded text-xs shadow-sm transition-all text-center cursor-pointer"
                                >
                                    Apply Now
                                </button>
                            ) : (
                                <div className="space-y-1.5">
                                    <button
                                        disabled
                                        className="w-full bg-slate-200 text-slate-400 font-medium py-2 px-4 rounded text-xs cursor-not-allowed text-center"
                                    >
                                        Apply Now
                                    </button>
                                    <p className="text-[10px] text-rose-600 text-center font-medium">Please log in to your portal account to apply.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Application Form Popup */}
            {isApplicationFormOpen && activeStall && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative border border-slate-300 space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 uppercase">Stall Lease Application Form</h3>
                                <p className="text-[11px] text-slate-500">Stall #{activeStall.stallNum} ({activeStall.section}) - {selectedMarket} Market</p>
                            </div>
                            <button onClick={() => setIsApplicationFormOpen(false)} className="text-slate-500 hover:text-slate-800 font-bold text-sm cursor-pointer">✕</button>
                        </div>

                        <form onSubmit={handleFormSubmit} className="space-y-3 text-xs">
                            {currentUser && (
                                <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-xl text-[11px] text-blue-900 flex items-center justify-between">
                                    <span>Logged in as: <strong>{currentUser.fullname}</strong></span>
                                    <span className="text-[10px] bg-blue-200 px-2 py-0.5 rounded font-semibold">Active Session</span>
                                </div>
                            )}

                            <div>
                                <label className="block font-semibold text-slate-700 mb-1">Unang Pangalan (First Name)</label>
                                <input
                                    type="text"
                                    required
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    placeholder="Ilagay ang unang pangalan..."
                                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
                                />
                            </div>

                            <div>
                                <label className="block font-semibold text-slate-700 mb-1">Apelyido (Last Name)</label>
                                <input
                                    type="text"
                                    required
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    placeholder="Ilagay ang apelyido..."
                                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
                                />
                            </div>

                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] space-y-1 text-slate-600">
                                <p><strong>Rental Fee:</strong> {activeStall.fee}</p>
                                <p><strong>Market Location:</strong> {selectedMarket} Market</p>
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsApplicationFormOpen(false)}
                                    className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-xl shadow-md cursor-pointer transition-all"
                                >
                                    Proceed to Digital Payment &rarr;
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Animated Payment Success Screen */}
            {isPaymentSuccess && activeStall && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto bg-slate-950/75 backdrop-blur-md payment-success-backdrop">
                    <div className="relative w-full max-w-lg my-6 payment-success-card">
                        {/* Floating confetti */}
                        <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden="true">
                            {Array.from({ length: 24 }).map((_, index) => (
                                <span
                                    key={index}
                                    className={`payment-confetti payment-confetti-${index % 8}`}
                                />
                            ))}
                        </div>

                        {/* Success check badge */}
                        <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-1/2">
                            <div className="payment-success-check-ring">
                                <div className="payment-success-check-circle">
                                    <svg
                                        viewBox="0 0 52 52"
                                        className="h-14 w-14 text-white payment-checkmark"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d="M14 27l8 8 17-19" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="relative overflow-hidden rounded-[28px] border border-white/80 bg-white px-6 pb-6 pt-14 shadow-[0_30px_100px_rgba(0,0,0,0.35)] sm:px-8">
                            {/* Soft decorative background */}
                            <div className="pointer-events-none absolute left-1/2 top-0 h-48 w-96 -translate-x-1/2 rounded-full bg-emerald-100/70 blur-3xl" />

                            <div className="relative text-center">
                                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                                    PAYMENT CONFIRMED
                                </div>

                                <h2 className="mt-3 text-3xl font-black tracking-tight text-emerald-700 sm:text-4xl">
                                    Payment Successful!
                                </h2>
                                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600 sm:text-base">
                                    Your market stall payment has been successfully confirmed through PayMongo.
                                </p>
                            </div>

                            {/* Simple market illustration */}
                            <div className="relative mx-auto mt-5 h-28 max-w-sm overflow-hidden rounded-2xl bg-gradient-to-b from-emerald-50 to-white">
                                <div className="absolute bottom-0 left-0 right-0 h-10 bg-emerald-100/70" />
                                <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
                                    <div className="h-10 w-40 rounded-t-xl border-2 border-emerald-600 bg-white shadow-sm">
                                        <div className="flex h-full items-center justify-center gap-3 text-emerald-600">
                                            <span className="text-xl">🛍️</span>
                                            <span className="text-xs font-black tracking-widest">MARKET</span>
                                        </div>
                                    </div>
                                    <div className="mx-auto h-7 w-32 rounded-b-lg bg-emerald-600" />
                                </div>
                                <div className="absolute bottom-7 left-10 h-9 w-1 rounded-full bg-emerald-300" />
                                <div className="absolute bottom-7 right-10 h-9 w-1 rounded-full bg-emerald-300" />
                            </div>

                            {/* Payment details */}
                            <div className="relative mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
                                        <div className="flex items-center gap-3">
                                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">📄</span>
                                            <span className="text-sm text-slate-500">Lease ID</span>
                                        </div>
                                        <span className="text-sm font-bold text-slate-800">{paymentLeaseId || "—"}</span>
                                    </div>

                                    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
                                        <div className="flex items-center gap-3">
                                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-lg font-bold text-emerald-600">₱</span>
                                            <span className="text-sm text-slate-500">Amount Paid</span>
                                        </div>
                                        <span className="text-base font-black text-emerald-600">{activeStall.fee}</span>
                                    </div>

                                    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
                                        <div className="flex items-center gap-3">
                                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">📅</span>
                                            <span className="text-sm text-slate-500">Payment Date</span>
                                        </div>
                                        <span className="text-right text-sm font-semibold text-slate-800">
                                            {new Date().toLocaleString("en-PH", {
                                                year: "numeric",
                                                month: "short",
                                                day: "numeric",
                                                hour: "numeric",
                                                minute: "2-digit",
                                                hour12: true,
                                            })}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">✓</span>
                                            <span className="text-sm text-slate-500">Payment Method</span>
                                        </div>
                                        <span className="text-sm font-bold text-slate-800">PayMongo (QR Ph)</span>
                                    </div>
                                </div>
                            </div>

                            <div className="relative mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                                <div className="flex items-start gap-3">
                                    <span className="text-2xl">🎉</span>
                                    <div>
                                        <p className="font-extrabold text-emerald-700">Thank you!</p>
                                        <p className="mt-1 text-xs leading-5 text-emerald-800/80 sm:text-sm">
                                            Your payment has been recorded and your market stall lease is now marked as paid.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    setIsPaymentSuccess(false);
                                    setActiveStall(null);
                                    setPaymentLeaseId("");
                                }}
                                className="relative mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-emerald-600/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-700 active:translate-y-0"
                            >
                                View My Leases
                                <span className="text-lg">→</span>
                            </button>

                            <p className="relative mt-3 text-center text-[11px] text-slate-400">
                                This confirmation will close automatically in <span className="font-bold text-emerald-600">{paymentSuccessCountdown}</span> seconds.
                            </p>
                        </div>
                    </div>

                    <style>{`
                        @keyframes paymentSuccessBackdrop {
                            from { opacity: 0; }
                            to { opacity: 1; }
                        }

                        @keyframes paymentSuccessCard {
                            0% { opacity: 0; transform: translateY(24px) scale(.94); }
                            70% { transform: translateY(-4px) scale(1.015); }
                            100% { opacity: 1; transform: translateY(0) scale(1); }
                        }

                        @keyframes paymentSuccessCheck {
                            0% { transform: scale(0) rotate(-20deg); opacity: 0; }
                            70% { transform: scale(1.12) rotate(4deg); opacity: 1; }
                            100% { transform: scale(1) rotate(0); opacity: 1; }
                        }

                        @keyframes paymentSuccessRing {
                            0% { transform: scale(.65); opacity: 0; }
                            70% { transform: scale(1.08); opacity: 1; }
                            100% { transform: scale(1); opacity: 1; }
                        }

                        @keyframes paymentConfetti {
                            0% { opacity: 0; transform: translateY(20px) rotate(0deg) scale(.5); }
                            15% { opacity: 1; }
                            100% { opacity: 0; transform: translateY(190px) rotate(540deg) scale(1); }
                        }

                        .payment-success-backdrop {
                            animation: paymentSuccessBackdrop .25s ease-out both;
                        }

                        .payment-success-card {
                            animation: paymentSuccessCard .55s cubic-bezier(.2,.8,.2,1) both;
                        }

                        .payment-success-check-ring {
                            width: 104px;
                            height: 104px;
                            display: grid;
                            place-items: center;
                            border-radius: 9999px;
                            background: rgba(74, 222, 128, .28);
                            box-shadow: 0 0 0 12px rgba(74, 222, 128, .08), 0 15px 45px rgba(16, 185, 129, .28);
                            animation: paymentSuccessRing .65s cubic-bezier(.2,.8,.2,1) both;
                        }

                        .payment-success-check-circle {
                            width: 76px;
                            height: 76px;
                            display: grid;
                            place-items: center;
                            border-radius: 9999px;
                            background: linear-gradient(145deg, #22c55e, #059669);
                            box-shadow: inset 0 2px 0 rgba(255,255,255,.35), 0 10px 25px rgba(5,150,105,.25);
                            animation: paymentSuccessCheck .65s .08s cubic-bezier(.2,.8,.2,1) both;
                        }

                        .payment-checkmark {
                            animation: paymentSuccessCheck .45s .28s ease-out both;
                        }

                        .payment-confetti {
                            position: absolute;
                            top: 15%;
                            left: 50%;
                            width: 8px;
                            height: 14px;
                            border-radius: 2px;
                            animation: paymentConfetti 1.8s ease-out infinite;
                        }

                        .payment-confetti-0 { background: #22c55e; left: 10%; animation-delay: .05s; }
                        .payment-confetti-1 { background: #3b82f6; left: 20%; animation-delay: .25s; }
                        .payment-confetti-2 { background: #f59e0b; left: 30%; animation-delay: .45s; }
                        .payment-confetti-3 { background: #ec4899; left: 40%; animation-delay: .15s; }
                        .payment-confetti-4 { background: #8b5cf6; left: 60%; animation-delay: .35s; }
                        .payment-confetti-5 { background: #14b8a6; left: 70%; animation-delay: .55s; }
                        .payment-confetti-6 { background: #f97316; left: 80%; animation-delay: .2s; }
                        .payment-confetti-7 { background: #84cc16; left: 90%; animation-delay: .4s; }
                    `}</style>
                </div>
            )}

            {/* Modal: Custom Digital Payment Screen with Dynamic QR Ph */}
            {isPaymentStep && activeStall && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[80] flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl relative border border-slate-200 overflow-hidden my-4">
                        <div className="p-6 sm:p-8">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                                {/* Invoice / Payment Details */}
                                <div className="space-y-5">
                                    <div>
                                        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                                            Market Stall Lease Payment ({paymentLeaseId || "Generating..."})
                                        </h2>
                                    </div>

                                    <div className="text-4xl sm:text-5xl font-extrabold text-emerald-600 tracking-tight">
                                        {activeStall.fee}
                                    </div>

                                    <p className="text-sm text-slate-500 border-b border-slate-200 pb-5">
                                        Billed to <span className="font-semibold text-slate-700">{firstName.trim()} {lastName.trim()}</span>
                                        {currentUser?.email ? <>, {currentUser.email}</> : null}
                                    </p>


                                    <div className="space-y-3 text-sm">
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-500">Subtotal</span>
                                            <span className="font-medium text-slate-700">{activeStall.fee}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-500">Fees</span>
                                            <span className="font-medium text-slate-700">Free</span>
                                        </div>
                                    </div>

                                    <div className="border-t border-slate-300 pt-4 flex justify-between items-center">
                                        <span className="font-bold text-slate-900">Total Due</span>
                                        <span className="font-extrabold text-slate-900 text-lg">{activeStall.fee}</span>
                                    </div>
                                </div>

                                {/* QR Ph */}
                                <div className="flex flex-col items-center justify-center min-h-[360px] lg:border-l lg:border-slate-200 lg:pl-10">
                                    <div className="w-full max-w-sm border border-slate-200 rounded-2xl p-6 bg-slate-50 text-center shadow-sm">
                                        <div className="mb-4">
                                            <p className="text-base font-bold text-slate-900">Scan QR Ph code to pay</p>
                                            <p className="text-xs text-slate-500 mt-1">Use your supported banking or e-wallet app.</p>
                                        </div>

                                        {isGeneratingQr ? (
                                            <div className="w-64 h-64 mx-auto bg-white border border-slate-200 rounded-xl flex flex-col items-center justify-center shadow-inner">
                                                <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-700 rounded-full animate-spin mb-4"></div>
                                                <p className="text-sm font-semibold text-blue-700">Generating QR Ph...</p>
                                                <p className="text-[11px] text-slate-400 mt-1">Please wait</p>
                                            </div>
                                        ) : qrImageUrl ? (
                                            <div className="w-64 h-64 mx-auto bg-white border border-slate-200 rounded-xl p-3 shadow-md flex items-center justify-center">
                                                <img
                                                    src={qrImageUrl}
                                                    alt="PayMongo Dynamic QR Ph"
                                                    className="w-full h-full object-contain"
                                                />
                                            </div>
                                        ) : (
                                            <div className="w-64 h-64 mx-auto bg-white border border-rose-200 rounded-xl flex flex-col items-center justify-center px-6">
                                                <p className="text-sm font-bold text-rose-600">QR code unavailable</p>
                                                <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                                                    {qrGenerationError || "Unable to generate the payment QR code."}
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => handlePayMongoQrPayment(true)}
                                                    disabled={isProcessingPayment}
                                                    className="mt-4 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                                                >
                                                    Try Again
                                                </button>
                                            </div>
                                        )}

                                        <div className="mt-4">
                                            <p className="text-xs font-bold text-slate-700">QR Ph</p>
                                            {qrImageUrl && (
                                                <div className={`mt-3 rounded-xl border px-4 py-3 ${qrTimeLeft <= 30 ? "border-rose-200 bg-rose-50" : "border-blue-200 bg-blue-50"}`}>
                                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                                        QR code refreshes in
                                                    </p>
                                                    <p className={`mt-1 text-2xl font-extrabold font-mono ${qrTimeLeft <= 30 ? "text-rose-600" : "text-blue-700"}`}>
                                                        {formatQrTime(qrTimeLeft)}
                                                    </p>
                                                    <p className="text-[10px] text-slate-500 mt-1">
                                                        A new QR code will be generated automatically when the timer expires.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <p className="text-xs text-slate-500 text-center mt-5 max-w-sm">
                                        {qrImageUrl
                                            ? "Scan the QR code with your preferred supported payment app. Your payment will be confirmed through PayMongo."
                                            : "Your payment QR code is being prepared automatically."}
                                    </p>
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="mt-8 pt-5 border-t border-slate-200 flex flex-col sm:flex-row gap-3 justify-end">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!isProcessingPayment) {
                                            setIsPaymentStep(false);
                                            setIsApplicationFormOpen(true);
                                        }
                                    }}
                                    disabled={isProcessingPayment}
                                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    &larr; Back to Form
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Official Government Footer */}
            <footer className="bg-slate-900 text-slate-400 text-xs mt-16 py-10 border-t border-slate-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div>
                        <p className="font-bold text-white text-sm">Gov Serv Unified Citizen Portal</p>
                        <p className="mt-1 text-slate-400">Official digital transformation platform under Zero-Corruption &amp; Red Tape Reduction governance.</p>
                    </div>
                    <div className="flex space-x-6 text-slate-400">
                        <span className="hover:text-white cursor-pointer">Terms of Service</span>
                        <span className="hover:text-white cursor-pointer">Data Privacy Policy</span>
                        <span className="hover:text-white cursor-pointer">Citizen Helpdesk (122)</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}