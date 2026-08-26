// src/components/MarketStallApplication.tsx
import React, { useState, useEffect, useRef } from "react";
import { saveLease, getLeases } from "../services/marketService";
import type { LeaseRecord } from "../services/marketService";

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
    const [selectedEPayment, setSelectedEPayment] = useState<string>("gcash");

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
            } catch (err) {
                console.error("Error loading initial data:", err);
            }
        };
        fetchInitialData();
    }, []);

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

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeStall || !selectedMarket) return;

        setIsApplicationFormOpen(false);
        setIsPaymentStep(true);
    };

    const handleCompletePaymentAndSubmission = async () => {
        if (!activeStall || !selectedMarket) return;
        setIsProcessingPayment(true);

        const feeAmount = parseFloat(activeStall.fee.replace(/[^\d.]/g, "")) || 1500.00;

        const newLease: LeaseRecord = {
            leaseId: `LEASE-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            marketName: `${selectedMarket} City-Owned Market`,
            section: activeStall.section + " Section",
            stallNumber: `${activeStall.stallNum}`,
            leaseStatus: "Active",
            amountDue: feeAmount,
            helperApprovalStatus: "Pending",
            advancePaymentStatus: "Paid",
            paymentStatus: "Paid",
            paymentMethod: selectedEPayment
        };

        try {
            await saveLease(newLease);
            setLeases((prev) => [...prev, newLease]);
            alert(`Payment Successful via ${selectedEPayment.toUpperCase()}!\nApplication successfully submitted to Admin database.\nLease ID: ${newLease.leaseId}`);
        } catch (err) {
            console.error("Error saving lease record to database:", err);
            alert("Error processing your lease application record.");
        } finally {
            setIsProcessingPayment(false);
            setIsPaymentStep(false);
            setActiveStall(null);
            setIsFloorPlanOpen(false);
            setFirstName("");
            setLastName("");
        }
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
                                    src="/src/assets/logo-system.png"
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
                                                                    <button onClick={() => handleStallClick({ stallNum: 1, holder: st1.holder, availability: st1.availability, section: "Fish", type: "Permanent", size: "3 sqm", classification: "Regular", fee: "₱1,200.00" })} className={`${st1.availability === 'Occupied' ? 'bg-blue-700' : 'bg-blue-500'} hover:opacity-90 text-white text-[10px] font-bold h-10 rounded flex items-center justify-center relative shadow-sm cursor-pointer`}>
                                                                        1
                                                                        <span className={`absolute top-1 right-1 w-1.5 h-1.5 ${st1.availability === 'Occupied' ? 'bg-red-500' : 'bg-emerald-300'} rounded-full`}></span>
                                                                    </button>
                                                                );
                                                            })()}
                                                            {(() => {
                                                                const st5 = getStallRealtimeStatus(5, "Fish");
                                                                return (
                                                                    <button onClick={() => handleStallClick({ stallNum: 5, holder: st5.holder, availability: st5.availability, section: "Fish", type: "Permanent", size: "3 sqm", classification: "Regular", fee: "₱1,200.00" })} className={`${st5.availability === 'Occupied' ? 'bg-blue-700' : 'bg-blue-500'} hover:opacity-90 text-white text-[10px] font-bold h-10 rounded flex items-center justify-center relative shadow-sm cursor-pointer`}>
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
                                                                    <button onClick={() => handleStallClick({ stallNum: 12, holder: st12.holder, availability: st12.availability, section: "Vegetables", type: "Permanent", size: "3 sqm", classification: "Regular", fee: "₱1,380.00" })} className={`${st12.availability === 'Occupied' ? 'bg-emerald-700' : 'bg-emerald-400'} hover:opacity-90 text-white text-[10px] font-bold h-10 rounded flex items-center justify-center relative shadow-sm cursor-pointer`}>
                                                                        12
                                                                        <span className={`absolute top-1 right-1 w-1.5 h-1.5 ${st12.availability === 'Occupied' ? 'bg-red-500' : 'bg-emerald-200'} rounded-full`}></span>
                                                                    </button>
                                                                );
                                                            })()}
                                                            {(() => {
                                                                const st14 = getStallRealtimeStatus(14, "Vegetables");
                                                                return (
                                                                    <button onClick={() => handleStallClick({ stallNum: 14, holder: st14.holder, availability: st14.availability, section: "Vegetables", type: "Permanent", size: "3 sqm", classification: "Regular", fee: "₱1,380.00" })} className={`${st14.availability === 'Occupied' ? 'bg-emerald-700' : 'bg-emerald-400'} hover:opacity-90 text-white text-[10px] font-bold h-10 rounded flex items-center justify-center relative shadow-sm cursor-pointer`}>
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
                                                                    <button onClick={() => handleStallClick({ stallNum: 102, holder: st102.holder, availability: st102.availability, section: "Dry Goods", type: "Permanent", size: "2.5 sqm", classification: "Regular", fee: "₱1,000.00" })} className={`${st102.availability === 'Occupied' ? 'bg-slate-700' : 'bg-slate-400'} hover:opacity-90 text-white text-[10px] font-bold h-10 rounded flex items-center justify-center relative shadow-sm cursor-pointer`}>
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
                                                        <button onClick={() => handleStallClick({ stallNum: 202, holder: st202.holder, availability: st202.availability, section: "Apparel", type: "Permanent", size: "4 sqm", classification: "Commercial", fee: "₱2,500.00" })} className={`${st202.availability === 'Occupied' ? 'bg-purple-700' : 'bg-purple-400'} hover:opacity-90 text-white text-xs font-bold h-12 rounded flex items-center justify-center relative shadow-sm cursor-pointer`}>
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

            {/* Modal: Digital Payment Integration Gateway with E-Payment Options */}
            {isPaymentStep && activeStall && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative border border-slate-300 space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 uppercase">Gov Pay - Secure Checkout Gateway</h3>
                                <p className="text-[11px] text-slate-500">Advance Rental &amp; Permit Fee</p>
                            </div>
                            <button onClick={() => setIsPaymentStep(false)} className="text-slate-500 hover:text-slate-800 font-bold text-sm cursor-pointer">✕</button>
                        </div>

                        <div className="space-y-4 text-xs">
                            <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl text-blue-900 space-y-1">
                                <p className="font-bold">Stall #{activeStall.stallNum} ({activeStall.section}) - {selectedMarket}</p>
                                <p className="text-[11px]">Total Amount Due: <span className="font-black text-sm">{activeStall.fee}</span></p>
                            </div>

                            {/* E-Payment Option Selector */}
                            <div className="space-y-1.5">
                                <label htmlFor="epayment-select" className="block font-bold text-slate-700 uppercase text-[10px]">Pumili ng E-Payment Method :</label>
                                <select
                                    id="epayment-select"
                                    value={selectedEPayment}
                                    onChange={(e) => setSelectedEPayment(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-900 shadow-sm"
                                >
                                    <option value="GCash">GCash</option>
                                    <option value="Visa / Mastercard">Visa / Mastercard</option>
                                    <option value="Maya">Maya</option>
                                    <option value="Online Banking">Online Banking</option>
                                    <option value="QR Ph">QR Ph</option>
                                    <option value="Bayad Center">Bayad Center</option>
                                    <option value="Cash / Direct">Cash / Direct</option>
                                    <option value="Landbank Online">Landbank Online</option>
                                </select>
                            </div>

                            {/* QR Ph / Payment Gateway Display Area */}
                            <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center space-y-2 bg-slate-50">
                                <div className="w-32 h-32 bg-white border border-slate-200 rounded-lg flex items-center justify-center font-mono text-[10px] text-slate-400 text-center p-2 shadow-inner">
                                    {selectedEPayment.toLowerCase().includes('qr') || selectedEPayment.toLowerCase() === 'gcash' || selectedEPayment.toLowerCase() === 'maya' ? '[ QR Ph Standard Dynamic Code ]' : '[ Secure Gateway Redirect ]'}
                                </div>
                                <p className="text-[11px] font-semibold text-slate-600 text-center">Selected Channel: <span className="text-blue-900 uppercase font-bold">{selectedEPayment}</span></p>
                            </div>

                            <div className="space-y-2">
                                <button
                                    type="button"
                                    disabled={isProcessingPayment}
                                    onClick={handleCompletePaymentAndSubmission}
                                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md cursor-pointer transition-all text-center flex items-center justify-center gap-2"
                                >
                                    {isProcessingPayment ? "Processing Online Payment..." : "Complete Payment & Submit Application"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsPaymentStep(false);
                                        setIsApplicationFormOpen(true);
                                    }}
                                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-all text-center cursor-pointer"
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