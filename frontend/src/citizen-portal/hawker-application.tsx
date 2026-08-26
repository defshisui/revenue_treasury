// src/components/HawkerAssociationApp.tsx
import { useState, useEffect, useRef } from 'react';
import logoSystem from '../assets/logo-system.png';
import { submitHawkerApplication } from '../services/hawkerservice';
import { API_BASE_URL } from '../config/api';

interface Props {
    onSubmitApplication?: (record: any) => void;
}

const MARKET_ZONES = [
    "Cubao Farmers Market Zone",
    "Novaliches Proper Market Zone",
    "Balintawak Agro-Industrial Zone",
    "Project 4 Market Hub",
    "Commonwealth Avenue Vending Strip",
    "Welcome Rotonda Stall Area",
];

export default function HawkerAssociationApp({ onSubmitApplication }: Props) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
    const [isPreviewMode, setIsPreviewMode] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Read-Only View Mode state
    const [isViewOnly, setIsViewOnly] = useState(false);
    const [viewedAppStatus, setViewedAppStatus] = useState<string>('New');
    const [viewedAppRemarks, setViewedAppRemarks] = useState<string>('');

    const [entriesCount, setEntriesCount] = useState('10');
    const [searchQuery, setSearchQuery] = useState('');

    // State to hold submitted applications for the table list
    const [applications, setApplications] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Logged-in user state & dropdown controls
    const [loggedInUser, setLoggedInUser] = useState<any>(null);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Initial empty form state for resetting later (includes LGU zoning & document flags)
    const initialFormState = {
        associationName: '',
        secNumber: '',
        dateGranted: '',
        telephone: '',
        marketZone: MARKET_ZONES[0],
        assignedStallCount: '15',
        firstName: '',
        middleName: '',
        lastName: '',
        email: '',
        submittedBy: '',
        submitterEmail: '',
        dateSubmitted: '',
        associationNumber: '',
        documents: {
            secCertUploaded: true,
            memberRosterUploaded: true,
            barangayClearanceUploaded: true,
        }
    };

    // Form fields state
    const [formData, setFormData] = useState(initialFormState);

    // Fetch applications from Backend
    const fetchApplications = async (userEmail: string) => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/hawkers`);
            if (response.ok) {
                const data = await response.json();
                const userApps = data.filter((app: any) => app.submitterEmail === userEmail);
                setApplications(userApps.reverse());
            }
        } catch (error) {
            console.error("Failed to fetch applications from backend:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Check user session on mount
    useEffect(() => {
        const checkUserSession = () => {
            try {
                const keys = ['currentUser', 'user', 'sessionStorage.currentUser', 'sessionStorage.user'];
                let rawData: string | null = null;
                let parsed: any = null;

                for (const key of keys) {
                    if (key.startsWith('sessionStorage.')) {
                        rawData = sessionStorage.getItem(key.replace('sessionStorage.', ''));
                    } else {
                        rawData = localStorage.getItem(key) || sessionStorage.getItem(key);
                    }
                    if (rawData) break;
                }

                if (rawData) {
                    parsed = JSON.parse(rawData);
                    const target = parsed.user || parsed;
                    const fullname = target.fullname || target.name || target.fullName || `${target.firstName || ''} ${target.lastName || ''}`.trim();
                    const email = target.email || '';
                    const firstName = target.firstName || fullname.split(' ')[0] || '';

                    if (fullname || email) {
                        const nameParts = fullname.split(' ');
                        const initials = nameParts.length > 1
                            ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
                            : (fullname[0] || 'U').toUpperCase();

                        const userObj = {
                            fullname,
                            email,
                            firstName,
                            initials
                        };
                        setLoggedInUser(userObj);

                        if (email) fetchApplications(email);
                        return;
                    }
                }
                setIsLoading(false);
            } catch (err) {
                console.error("Failed to parse user session:", err);
                setIsLoading(false);
            }
        };

        checkUserSession();

        // Close dropdown on outside click
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        // Restrict phone number to 11 digits max (numbers only)
        if (name === 'telephone') {
            const numericValue = value.replace(/\D/g, '').slice(0, 11);
            setFormData(prev => ({ ...prev, [name]: numericValue }));
            return;
        }

        // Automatically format dateGranted as MM/DD/YYYY as digits are typed
        if (name === 'dateGranted') {
            const numbersOnly = value.replace(/\D/g, '').slice(0, 8);
            let formattedDate = '';

            if (numbersOnly.length > 0) {
                formattedDate = numbersOnly.slice(0, 2);
            }
            if (numbersOnly.length >= 3) {
                formattedDate += '/' + numbersOnly.slice(2, 4);
            }
            if (numbersOnly.length >= 5) {
                formattedDate += '/' + numbersOnly.slice(4, 8);
            }

            setFormData(prev => ({ ...prev, [name]: formattedDate }));
            return;
        }

        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const showApplicationForm = () => {
        // Generate automatic fields on open
        const currentDate = new Date().toLocaleDateString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric'
        });
        const randomAssociationNo = 'HA-' + Math.floor(100000 + Math.random() * 900000);

        setFormData(prev => ({
            ...prev,
            dateSubmitted: currentDate,
            associationNumber: randomAssociationNo,
            submittedBy: loggedInUser ? loggedInUser.fullname : prev.submittedBy,
            submitterEmail: loggedInUser ? loggedInUser.email : prev.submitterEmail
        }));

        setIsPreviewMode(false);
        setIsViewOnly(false);
        setIsModalOpen(true);
    };

    // Handler to open an application in View-Only Mode
    const handleViewClick = (app: any) => {
        setFormData({
            associationName: app.associationName || '',
            secNumber: app.secRegistrationNo || '',
            dateGranted: app.dateIssued || '',
            telephone: app.contactNumber || '',
            marketZone: app.lguMeta?.marketZone || MARKET_ZONES[0],
            assignedStallCount: app.lguMeta?.assignedStallCount?.toString() || '15',
            firstName: app.chairperson?.firstName || '',
            middleName: app.chairperson?.middleName || '',
            lastName: app.chairperson?.lastName || '',
            email: app.chairperson?.email || '',
            submittedBy: app.submittedBy || '',
            submitterEmail: app.submitterEmail || '',
            dateSubmitted: app.submissionDate || '',
            associationNumber: app.associationNumber || '',
            documents: app.lguMeta?.documents || initialFormState.documents,
        });

        setViewedAppStatus(app.status || 'New');
        setViewedAppRemarks(app.remarks || '');

        setIsPreviewMode(true); // Makes inputs read-only based on existing logic
        setIsViewOnly(true);
        setIsModalOpen(true);
    };

    const showListView = () => {
        setIsModalOpen(false);
        setIsPreviewMode(false);
        setIsViewOnly(false);
        setIsConfirmationOpen(false);
    };

    const handleBack = () => {
        window.location.href = '/market-vendors-hub';
    };

    const handleInitialSubmitClick = (e: React.FormEvent) => {
        e.preventDefault();
        setIsPreviewMode(true);
    };

    const handleFinalSubmit = async () => {
        const payload = {
            id: crypto.randomUUID(),
            associationNumber: formData.associationNumber,
            associationName: formData.associationName,
            secRegistrationNo: formData.secNumber,
            dateIssued: formData.dateGranted,
            contactNumber: formData.telephone,
            chairperson: {
                firstName: formData.firstName,
                middleName: formData.middleName,
                lastName: formData.lastName,
                email: formData.email,
            },
            submittedBy: formData.submittedBy,
            submitterEmail: formData.submitterEmail,
            submissionDate: formData.dateSubmitted,
            status: "New",
            lguMeta: {
                marketZone: formData.marketZone,
                assignedStallCount: Number(formData.assignedStallCount),
                documents: formData.documents,
                feesPaid: false,
                violationsCount: 0,
                auditTrail: [
                    {
                        timestamp: new Date().toISOString().slice(0, 10),
                        admin: formData.submittedBy || "Citizen Applicant",
                        action: "Online Application submitted with LGU digital vault files.",
                    }
                ]
            }
        };

        try {
            setIsSubmitting(true);

            await submitHawkerApplication(payload);

            if (onSubmitApplication) {
                onSubmitApplication(payload);
            }

            if (loggedInUser?.email) {
                await fetchApplications(loggedInUser.email);
            } else {
                setApplications(prev => [payload, ...prev]);
            }

            alert("Application successfully submitted to the LGU portal!");
            setFormData(initialFormState);
            showListView();
        } catch (error) {
            console.error("Submission failed:", error);
            alert("Failed to submit application. Please check your backend connection.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancelClick = () => {
        if (isPreviewMode && !isViewOnly) {
            setIsPreviewMode(false);
        } else if (isViewOnly) {
            showListView();
        } else {
            setIsConfirmationOpen(true);
        }
    };

    const handleModalCloseClick = () => {
        if (isViewOnly) {
            showListView();
        } else {
            setIsConfirmationOpen(true);
        }
    };

    const handleConfirmYes = () => {
        setIsConfirmationOpen(false);
        setFormData(initialFormState);
        showListView();
    };

    const handleConfirmNo = () => {
        setIsConfirmationOpen(false);
    };

    const handleLogout = () => {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('user');
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('user');
        setLoggedInUser(null);
        setIsUserMenuOpen(false);
        window.location.href = '/';
    };

    // Derived filtered list for search functionality
    const displayedApplications = applications.filter(app =>
        app.associationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.associationNumber.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="w-full min-h-screen bg-slate-100 font-sans text-slate-800 flex flex-col antialiased relative">

            {/* =====================================================
                MAIN NAVIGATION HEADER (Matches CitizenPortalLanding Reference)
            ====================================================== */}
            <header className="w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xs sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">

                    <div className="flex items-center gap-3 cursor-pointer" onClick={showListView}>
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

                    <div className="hidden md:flex items-center space-x-6 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <span className="hover:text-blue-700 cursor-pointer" onClick={() => window.location.href = '/citizen-portal'}>HOME</span>

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
                                    onClick={() => window.location.href = '/market-vendors-hub'}
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
                                    onClick={() => window.location.href = '/business-tax-assessment'}
                                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-700 transition-colors cursor-pointer"
                                >
                                    Business Tax Assessment Hub
                                </button>
                            </div>
                        </div>

                        <span className="hover:text-blue-700 cursor-pointer">CONTACT US</span>
                    </div>

                    <div className="flex items-center space-x-3">
                        {loggedInUser ? (
                            <div className="relative" ref={dropdownRef}>
                                <button
                                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                    className="flex items-center space-x-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs group"
                                >
                                    <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 tracking-tight">
                                        Hi, {loggedInUser.firstName}
                                    </span>
                                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-[10px] shadow-sm tracking-wider">
                                        {loggedInUser.initials}
                                    </div>
                                </button>

                                {isUserMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 z-50">
                                        <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{loggedInUser.fullname}</p>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{loggedInUser.email}</p>
                                        </div>

                                        <button
                                            onClick={() => {
                                                setIsUserMenuOpen(false);
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

            {/* =====================================================
                MAIN CONTENT CONTAINER (LIST VIEW)
            ====================================================== */}
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <div className="w-full bg-white border border-slate-300 rounded-lg p-6 md:p-10 relative shadow-md">
                    <div className="flex flex-col md:flex-row justify-between items-center border-b border-slate-200 pb-5 gap-4">
                        <h1 className="text-slate-800 font-bold text-sm tracking-wide uppercase">
                            VIEW HAWKER ASSOCIATION LIST
                        </h1>
                        <button
                            onClick={handleBack}
                            className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded text-xs font-semibold transition-colors cursor-pointer"
                        >
                            <span>&larr;</span> Back
                        </button>
                    </div>

                    <div className="mt-4 space-y-6">
                        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
                            <button
                                onClick={showApplicationForm}
                                className="bg-blue-800 hover:bg-blue-900 text-white text-xs font-semibold py-2 px-4 rounded shadow-sm flex items-center justify-center space-x-1.5 transition-colors w-fit cursor-pointer"
                            >
                                <span>Add new</span>
                                <i className="fa-solid fa-plus text-[10px]"></i>
                            </button>
                            <div className="flex items-center space-x-2 justify-end">
                                <span className="text-xs text-slate-600">Search:</span>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="border border-slate-300 rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-800 w-full sm:w-56"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto border border-slate-200 rounded">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-blue-900 text-white text-[11px] uppercase tracking-wider">
                                        <th className="py-2.5 px-4 font-semibold">Association Number</th>
                                        <th className="py-2.5 px-4 font-semibold">Pangalan ng Samahan</th>
                                        <th className="py-2.5 px-4 font-semibold">Petsa ng Pagsusumite</th>
                                        <th className="py-2.5 px-4 font-semibold">Katayuan</th>
                                        <th className="py-2.5 px-4 font-semibold text-center">Aksyon</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={5} className="bg-slate-50 py-10 text-center">
                                                <p className="text-xs font-medium text-slate-500 animate-pulse">Loading backend records...</p>
                                            </td>
                                        </tr>
                                    ) : displayedApplications.length > 0 ? (
                                        displayedApplications.map((app) => (
                                            <tr key={app.id} className="border-b border-slate-200 bg-white hover:bg-slate-50 transition-colors text-xs text-slate-700">
                                                <td className="py-2.5 px-4 font-semibold text-blue-800">{app.associationNumber}</td>
                                                <td className="py-2.5 px-4">{app.associationName}</td>
                                                <td className="py-2.5 px-4">{app.submissionDate}</td>
                                                <td className="py-2.5 px-4">
                                                    <span className={`px-2 py-1 rounded font-bold uppercase tracking-wider text-[10px] ${app.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                                                            app.status === 'Rejected' || app.status === 'Suspended' ? 'bg-rose-100 text-rose-800' :
                                                                'bg-amber-100 text-amber-800'
                                                        }`}>
                                                        {app.status || 'New'}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-4 text-center">
                                                    <button
                                                        onClick={() => handleViewClick(app)}
                                                        className="text-blue-600 hover:text-blue-800 font-semibold hover:underline text-[11px] cursor-pointer"
                                                    >
                                                        View
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="bg-slate-50 py-20 text-center">
                                                <div className="flex flex-col items-center justify-center space-y-1.5 text-slate-400">
                                                    <div className="text-2xl"><i className="fa-solid fa-inbox"></i></div>
                                                    <p className="text-xs font-medium">No Data Found</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex flex-col sm:flex-row justify-between items-center text-xs text-slate-600 pt-1 gap-4">
                            <div className="flex items-center space-x-2">
                                <span>Ipakita</span>
                                <select
                                    value={entriesCount}
                                    onChange={(e) => setEntriesCount(e.target.value)}
                                    className="border border-slate-300 rounded px-1.5 py-0.5 bg-white text-xs focus:outline-none"
                                >
                                    <option value="10">10</option>
                                    <option value="25">25</option>
                                    <option value="50">50</option>
                                </select>
                                <span>ng {displayedApplications.length} entries</span>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* =====================================================
                MODAL POPUP (APPLICATION FORM & PREVIEW)
            ====================================================== */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white border border-slate-300 rounded-lg max-w-4xl w-full p-6 md:p-8 relative shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
                        <div className="flex flex-col md:flex-row justify-between items-center border-b border-slate-200 pb-4 gap-4 sticky top-0 bg-white z-10">
                            <h1 className="text-slate-800 font-bold text-sm tracking-wide uppercase">
                                {isViewOnly ? "HAWKER ASSOCIATION APPLICATION - RECORD VIEW" : (isPreviewMode ? "CLARIFICATION PREVIEW - HAWKER ASSOCIATION APPLICATION" : "HAWKER ASSOCIATION APPLICATION & LGU COMPLIANCE")}
                            </h1>
                            <button
                                onClick={handleModalCloseClick}
                                className="text-slate-400 hover:text-slate-700 text-sm font-bold px-2 py-1 rounded cursor-pointer"
                            >
                                &times; Close
                            </button>
                        </div>

                        <form onSubmit={handleInitialSubmitClick} className="mt-4 space-y-6">
                            <div className="flex flex-col md:flex-row justify-between items-center border-b border-slate-200 pb-5 gap-4">
                                <div className="w-14 h-14 flex items-center justify-center border border-slate-200 rounded-full bg-white p-2 shadow-xs">
                                    <img src={logoSystem} alt="Logo Left" className="w-full h-full object-contain" />
                                </div>
                                <div className="text-center space-y-0.5">
                                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Government Service</p>
                                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">Gov Serv</h2>
                                    <p className="text-[10px] uppercase font-semibold text-slate-700 tracking-wide">Market Development and Administration Department</p>
                                    <p className="text-[9px] text-slate-500">Tel No. 1122-3344 Local 1234</p>
                                </div>
                                <div className="w-14 h-14 flex items-center justify-center border border-slate-200 rounded-full bg-white p-2 shadow-xs">
                                    <img src={logoSystem} alt="Logo Right" className="w-full h-full object-contain" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3 text-xs">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-700">Application Type:</span>
                                    <span className="text-emerald-700 font-semibold tracking-wide">HAWKER ASSOCIATION APPLICATION</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-700">Date Submitted:</span>
                                    <input
                                        type="text"
                                        value={formData.dateSubmitted}
                                        readOnly
                                        className="border border-slate-300 rounded px-2.5 py-1 w-56 bg-slate-100 text-slate-600 text-xs cursor-not-allowed focus:outline-none"
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-700">Application Status:</span>
                                    {isViewOnly ? (
                                        <div className="w-56 text-right md:text-left md:pl-1">
                                            <span className={`px-3 py-1 rounded-full font-bold uppercase tracking-wider text-[10px] border ${viewedAppStatus === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                    viewedAppStatus === 'Rejected' || viewedAppStatus === 'Suspended' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                                        'bg-amber-50 text-amber-700 border-amber-200'
                                                }`}>
                                                {viewedAppStatus}
                                            </span>
                                        </div>
                                    ) : (
                                        <input
                                            type="text"
                                            value="New"
                                            readOnly
                                            className="border border-slate-300 rounded px-2.5 py-1 w-56 bg-slate-100 text-slate-600 text-xs cursor-not-allowed focus:outline-none"
                                        />
                                    )}
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-700">Association Number:</span>
                                    <input
                                        type="text"
                                        value={formData.associationNumber}
                                        readOnly
                                        className="border border-slate-300 rounded px-2.5 py-1 w-56 bg-slate-100 text-slate-600 text-xs cursor-not-allowed focus:outline-none"
                                    />
                                </div>

                                {/* Only display remarks if in View-Only mode and remarks exist */}
                                {isViewOnly && viewedAppRemarks && (
                                    <div className="col-span-1 md:col-span-2 mt-3 p-3 bg-blue-50/50 border border-blue-200 rounded-lg">
                                        <h4 className="text-[11px] font-bold text-blue-800 uppercase tracking-wider mb-1">
                                            <i className="fa-solid fa-comment-dots mr-1"></i> LGU Official Remarks / Assessment
                                        </h4>
                                        <p className="text-xs text-blue-900 font-medium">{viewedAppRemarks}</p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-5 pt-1">

                                {/* Group 1: Impormasyon */}
                                <div>
                                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-2.5">Impormasyon</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                                        <div>
                                            <label className="block font-medium text-slate-700 mb-1">Pangalan Ng Samahan <span className="text-red-500">*</span></label>
                                            <input
                                                type="text"
                                                name="associationName"
                                                value={formData.associationName}
                                                onChange={handleInputChange}
                                                readOnly={isPreviewMode}
                                                required
                                                className={`w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-800 ${isPreviewMode ? 'bg-slate-100 cursor-not-allowed text-slate-600' : 'bg-white'}`}
                                            />
                                        </div>
                                        <div>
                                            <label className="block font-medium text-slate-700 mb-1">SEC Bilang</label>
                                            <input
                                                type="text"
                                                name="secNumber"
                                                value={formData.secNumber}
                                                onChange={handleInputChange}
                                                readOnly={isPreviewMode}
                                                className={`w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-800 ${isPreviewMode ? 'bg-slate-100 cursor-not-allowed text-slate-600' : 'bg-white'}`}
                                            />
                                        </div>
                                        <div>
                                            <label className="block font-medium text-slate-700 mb-1">Petsa ng Pagkākaloob</label>
                                            <input
                                                type="text"
                                                name="dateGranted"
                                                maxLength={10}
                                                placeholder="MM/DD/YYYY"
                                                value={formData.dateGranted}
                                                onChange={handleInputChange}
                                                readOnly={isPreviewMode}
                                                className={`w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-800 ${isPreviewMode ? 'bg-slate-100 cursor-not-allowed text-slate-600' : 'bg-white'}`}
                                            />
                                        </div>
                                        <div>
                                            <label className="block font-medium text-slate-700 mb-1">Telepono <span className="text-red-500">*</span></label>
                                            <input
                                                type="text"
                                                name="telephone"
                                                maxLength={11}
                                                placeholder="11 digits max"
                                                value={formData.telephone}
                                                onChange={handleInputChange}
                                                readOnly={isPreviewMode}
                                                required
                                                className={`w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-800 ${isPreviewMode ? 'bg-slate-100 cursor-not-allowed text-slate-600' : 'bg-white'}`}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* LGU MARKET ZONING & STALL ALLOCATION EXTENSION */}
                                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-2.5">LGU Market Zone & Location Allocation</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                        <div>
                                            <label className="block font-medium text-slate-700 mb-1">Assigned Public Market Zone <span className="text-red-500">*</span></label>
                                            <select
                                                name="marketZone"
                                                value={formData.marketZone}
                                                onChange={handleInputChange}
                                                disabled={isPreviewMode}
                                                className={`w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:outline-none ${isPreviewMode ? 'bg-slate-100 cursor-not-allowed text-slate-600' : 'bg-white cursor-pointer'}`}
                                            >
                                                {MARKET_ZONES.map((zone, idx) => (
                                                    <option key={idx} value={zone}>{zone}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block font-medium text-slate-700 mb-1">Requested Vending Stalls / Meters Count <span className="text-red-500">*</span></label>
                                            <input
                                                type="number"
                                                name="assignedStallCount"
                                                min={1}
                                                value={formData.assignedStallCount}
                                                onChange={handleInputChange}
                                                readOnly={isPreviewMode}
                                                required
                                                className={`w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:outline-none ${isPreviewMode ? 'bg-slate-100 cursor-not-allowed text-slate-600' : 'bg-white'}`}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* LGU DIGITAL VAULT ATTACHMENTS */}
                                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-1">Digital Vault Statutory Documents</h3>
                                    <p className="text-[11px] text-slate-500 mb-3">Upload required municipal compliance attachments for MDAD verification:</p>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                        <div className="p-3 bg-white rounded-lg border border-slate-200">
                                            <p className="font-semibold text-slate-800 mb-1">SEC / DTI Permit</p>
                                            <input type="file" disabled={isPreviewMode} className="w-full text-[10px] text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                                        </div>
                                        <div className="p-3 bg-white rounded-lg border border-slate-200">
                                            <p className="font-semibold text-slate-800 mb-1">Member Roster List</p>
                                            <input type="file" disabled={isPreviewMode} className="w-full text-[10px] text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                                        </div>
                                        <div className="p-3 bg-white rounded-lg border border-slate-200">
                                            <p className="font-semibold text-slate-800 mb-1">Barangay Clearance</p>
                                            <input type="file" disabled={isPreviewMode} className="w-full text-[10px] text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                                        </div>
                                    </div>
                                </div>

                                {/* Group 2: Tagapangulo */}
                                <div>
                                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-2.5">Tagapangulo</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                                        <div>
                                            <label className="block font-medium text-slate-700 mb-1">Unang Pangalan <span className="text-red-500">*</span></label>
                                            <input
                                                type="text"
                                                name="firstName"
                                                value={formData.firstName}
                                                onChange={handleInputChange}
                                                readOnly={isPreviewMode}
                                                required
                                                className={`w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-800 ${isPreviewMode ? 'bg-slate-100 cursor-not-allowed text-slate-600' : 'bg-white'}`}
                                            />
                                        </div>
                                        <div>
                                            <label className="block font-medium text-slate-700 mb-1">Gitnang Pangalan</label>
                                            <input
                                                type="text"
                                                name="middleName"
                                                value={formData.middleName}
                                                onChange={handleInputChange}
                                                readOnly={isPreviewMode}
                                                className={`w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-800 ${isPreviewMode ? 'bg-slate-100 cursor-not-allowed text-slate-600' : 'bg-white'}`}
                                            />
                                        </div>
                                        <div>
                                            <label className="block font-medium text-slate-700 mb-1">Apelyido <span className="text-red-500">*</span></label>
                                            <input
                                                type="text"
                                                name="lastName"
                                                value={formData.lastName}
                                                onChange={handleInputChange}
                                                readOnly={isPreviewMode}
                                                required
                                                className={`w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-800 ${isPreviewMode ? 'bg-slate-100 cursor-not-allowed text-slate-600' : 'bg-white'}`}
                                            />
                                        </div>
                                        <div>
                                            <label className="block font-medium text-slate-700 mb-1">Email Address <span className="text-red-500">*</span></label>
                                            <input
                                                type="email"
                                                name="email"
                                                value={formData.email}
                                                onChange={handleInputChange}
                                                readOnly={isPreviewMode}
                                                required
                                                className={`w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-800 ${isPreviewMode ? 'bg-slate-100 cursor-not-allowed text-slate-600' : 'bg-white'}`}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Group 3: Submitter info footer fields */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                                    <div>
                                        <label className="block font-medium text-slate-700 mb-1">Isinumite ni: <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            name="submittedBy"
                                            value={formData.submittedBy}
                                            onChange={handleInputChange}
                                            readOnly={isPreviewMode}
                                            required
                                            className={`w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-800 ${isPreviewMode ? 'bg-slate-100 cursor-not-allowed text-slate-600' : 'bg-white'}`}
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-medium text-slate-700 mb-1">Email Address ng nagsumite: <span className="text-red-500">*</span></label>
                                        <input
                                            type="email"
                                            name="submitterEmail"
                                            value={formData.submitterEmail}
                                            onChange={handleInputChange}
                                            readOnly={isPreviewMode}
                                            required
                                            className={`w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-800 ${isPreviewMode ? 'bg-slate-100 cursor-not-allowed text-slate-600' : 'bg-white'}`}
                                        />
                                    </div>
                                </div>

                            </div>

                            {/* Form Action Buttons */}
                            <div className="flex items-center justify-center space-x-3 pt-4 border-t border-slate-100 mt-6">
                                {isViewOnly ? (
                                    <button
                                        type="button"
                                        onClick={showListView}
                                        className="bg-white hover:bg-slate-50 text-blue-800 border border-blue-600 font-semibold text-xs py-1.5 px-8 rounded shadow-sm transition-colors cursor-pointer"
                                    >
                                        Close View
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            onClick={handleCancelClick}
                                            className="bg-white hover:bg-slate-50 text-blue-800 border border-blue-600 font-semibold text-xs py-1.5 px-6 rounded shadow-sm transition-colors cursor-pointer"
                                        >
                                            {isPreviewMode ? "Back to Edit" : "Kanselahin"}
                                        </button>
                                        {isPreviewMode ? (
                                            <button
                                                type="button"
                                                disabled={isSubmitting}
                                                onClick={handleFinalSubmit}
                                                className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs py-1.5 px-8 rounded shadow transition-colors cursor-pointer disabled:opacity-50"
                                            >
                                                {isSubmitting ? "Submitting..." : "Confirm & Submit"}
                                            </button>
                                        ) : (
                                            <button
                                                type="submit"
                                                className="bg-blue-900 hover:bg-blue-950 text-white font-semibold text-xs py-1.5 px-8 rounded shadow transition-colors cursor-pointer"
                                            >
                                                Submit
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* =====================================================
                CONFIRMATION POPUP
            ====================================================== */}
            {isConfirmationOpen && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
                    <div className="bg-white border border-slate-300 rounded-lg max-w-sm w-full p-6 text-center space-y-4 shadow-xl">
                        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto text-lg font-bold">
                            ?
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-sm font-bold text-slate-900 uppercase">Are you sure?</h3>
                            <p className="text-xs text-slate-600">You are about to cancel. Any inputs or progress will be discarded.</p>
                        </div>
                        <div className="flex items-center justify-center space-x-2 pt-2">
                            <button
                                onClick={handleConfirmNo}
                                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-xs py-1.5 px-6 rounded shadow-xs cursor-pointer"
                            >
                                No
                            </button>
                            <button
                                onClick={handleConfirmYes}
                                className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs py-1.5 px-6 rounded shadow-xs cursor-pointer"
                            >
                                Yes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}