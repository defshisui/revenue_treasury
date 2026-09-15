import { useState, useEffect } from 'react';
import logoSystem from '../assets/logo-system.png';
import { submitHawkerApplication } from '../services/hawkerservice';
import { API_BASE_URL } from '../config/api';
import CitizenLayout from './CitizenLayout';
interface Props {
    onSubmitApplication?: (record: any) => void;
}
export interface HawkerDocument {
    id: string;
    document_type: 'SEC_DTI_PERMIT' | 'MEMBER_ROSTER' | 'BARANGAY_CLEARANCE';
    file_name: string;
    file_url: string;
    mime_type: string;
    status: string;
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
    const [isViewOnly, setIsViewOnly] = useState(false);
    const [viewedAppStatus, setViewedAppStatus] = useState<string>('New');
    const [viewedAppRemarks, setViewedAppRemarks] = useState<string>('');
    const [entriesCount, setEntriesCount] = useState('10');
    const [searchQuery, setSearchQuery] = useState('');
    const [applications, setApplications] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loggedInUser, setLoggedInUser] = useState<any>(null);
    const [uploadedDocs, setUploadedDocs] = useState<HawkerDocument[]>([]);
    const [previewAttachment, setPreviewAttachment] = useState<{ url: string; mime: string } | null>(null);
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
    const [formData, setFormData] = useState(initialFormState);
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
    }, []);
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'telephone') {
            const numericValue = value.replace(/\D/g, '').slice(0, 11);
            setFormData(prev => ({ ...prev, [name]: numericValue }));
            return;
        }
        if (name === 'dateGranted') {
            const numbersOnly = value.replace(/\D/g, '').slice(0, 8);
            let formattedDate = '';
            if (numbersOnly.length > 0) formattedDate = numbersOnly.slice(0, 2);
            if (numbersOnly.length >= 3) formattedDate += '/' + numbersOnly.slice(2, 4);
            if (numbersOnly.length >= 5) formattedDate += '/' + numbersOnly.slice(4, 8);
            setFormData(prev => ({ ...prev, [name]: formattedDate }));
            return;
        }
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, docType: HawkerDocument['document_type']) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        if (!validTypes.includes(file.type)) {
            alert('Invalid file format. Please upload a JPG, PNG image or a PDF document.');
            e.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            const newDoc: HawkerDocument = {
                id: crypto.randomUUID(),
                document_type: docType,
                file_name: file.name,
                file_url: base64String,
                mime_type: file.type,
                status: 'PENDING'
            };
            setUploadedDocs(prev => {
                const filtered = prev.filter(d => d.document_type !== docType);
                return [...filtered, newDoc];
            });
        };
        reader.readAsDataURL(file);
    };
    const openAttachment = (url: string | undefined, mimeType: string | undefined) => {
        if (!url) return;
        setPreviewAttachment({ url, mime: mimeType || '' });
    };
    const showApplicationForm = () => {
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
        setUploadedDocs([]);
        setIsPreviewMode(false);
        setIsViewOnly(false);
        setIsModalOpen(true);
    };
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
        setUploadedDocs(app.lguMeta?.uploadedDocuments || app.uploadedDocuments || []);
        setViewedAppStatus(app.status || 'New');
        setViewedAppRemarks(app.remarks || '');
        setIsPreviewMode(true);
        setIsViewOnly(true);
        setIsModalOpen(true);
    };
    const showListView = () => {
        setIsModalOpen(false);
        setIsPreviewMode(false);
        setIsViewOnly(false);
        setIsConfirmationOpen(false);
    };
    const handleInitialSubmitClick = (e: React.FormEvent) => {
        e.preventDefault();
        const hasSecDti = uploadedDocs.some(d => d.document_type === 'SEC_DTI_PERMIT');
        const hasRoster = uploadedDocs.some(d => d.document_type === 'MEMBER_ROSTER');
        const hasClearance = uploadedDocs.some(d => d.document_type === 'BARANGAY_CLEARANCE');
        if (!hasSecDti || !hasRoster || !hasClearance) {
            alert("Please upload all required documents (SEC/DTI Permit, Member Roster, and Barangay Clearance) before proceeding.");
            return;
        }
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
                uploadedDocuments: uploadedDocs,
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
            setUploadedDocs([]);
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
        setUploadedDocs([]);
        showListView();
    };
    const handleConfirmNo = () => {
        setIsConfirmationOpen(false);
    };
    const displayedApplications = applications.filter(app =>
        app.associationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.associationNumber.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const getDocByType = (docType: HawkerDocument['document_type']) => {
        return uploadedDocs.find(d => d.document_type === docType);
    };
    return (
        <CitizenLayout activeTitle="Hawker Association" activeNav="market">
            <div className="w-full font-['Segoe_UI',Tahoma,Geneva,Verdana,sans-serif] space-y-6">
                {/* Blue Hero Banner - matching other citizen portal pages */}
                <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8 relative bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 h-36 sm:h-48 overflow-hidden flex items-center justify-center border-b-4 border-blue-600">
                    <div className="absolute inset-0 opacity-30 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]"></div>
                    <div className="relative z-10 text-center px-4">
                        <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-wide uppercase">
                            Hawkers &amp; Street Vendors Portal
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-200 mt-1 max-w-xl mx-auto">
                            Manage your hawker association applications and track submission status.
                        </p>
                    </div>
                </div>
                <div className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg p-6 md:p-10 relative shadow-md">
                    <div className="flex flex-col md:flex-row justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-5 gap-4">
                        <h1 className="text-slate-800 dark:text-white font-bold text-sm tracking-wide uppercase">
                            VIEW HAWKER ASSOCIATION LIST
                        </h1>
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
                                <span className="text-xs text-slate-600 dark:text-slate-300">Search:</span>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-800 w-full sm:w-56"
                                />
                            </div>
                        </div>
                        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-blue-900 text-white text-[11px] uppercase tracking-wider">
                                        <th className="py-2.5 px-4 font-semibold">Association Number</th>
                                        <th className="py-2.5 px-4 font-semibold">Name of Association</th>
                                        <th className="py-2.5 px-4 font-semibold">Date Submitted</th>
                                        <th className="py-2.5 px-4 font-semibold">Status</th>
                                        <th className="py-2.5 px-4 font-semibold text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={5} className="bg-slate-50 dark:bg-slate-900 py-10 text-center">
                                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 animate-pulse">Loading backend records...</p>
                                            </td>
                                        </tr>
                                    ) : displayedApplications.length > 0 ? (
                                        displayedApplications.map((app) => (
                                            <tr key={app.id} className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-xs text-slate-700 dark:text-slate-200">
                                                <td className="py-2.5 px-4 font-semibold text-blue-600 dark:text-blue-400">{app.associationNumber}</td>
                                                <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-white">{app.associationName}</td>
                                                <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">{app.submissionDate}</td>
                                                <td className="py-2.5 px-4">
                                                    <span className={`px-2 py-1 rounded font-bold uppercase tracking-wider text-[10px] ${app.status === 'Approved' ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' :
                                                        app.status === 'Rejected' || app.status === 'Suspended' ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800' :
                                                            'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                                        }`}>
                                                        {app.status || 'New'}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-4 text-center">
                                                    <button
                                                        onClick={() => handleViewClick(app)}
                                                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-semibold hover:underline text-[11px] cursor-pointer"
                                                    >
                                                        View
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="bg-slate-50 dark:bg-slate-900 py-20 text-center">
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
                        <div className="flex flex-col sm:flex-row justify-between items-center text-xs text-slate-600 dark:text-slate-400 pt-1 gap-4">
                            <div className="flex items-center space-x-2">
                                <span>Show</span>
                                <select
                                    value={entriesCount}
                                    onChange={(e) => setEntriesCount(e.target.value)}
                                    className="border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs focus:outline-none"
                                >
                                    <option value="10">10</option>
                                    <option value="25">25</option>
                                    <option value="50">50</option>
                                </select>
                                <span>of {displayedApplications.length} entries</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg max-w-4xl w-full relative shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
                        <div className="flex flex-col md:flex-row justify-between items-center border-b border-slate-200 dark:border-slate-800 px-6 md:px-8 pt-6 md:pt-8 pb-4 gap-4 sticky top-0 bg-white dark:bg-slate-900 z-10 rounded-t-lg">
                            <h1 className="text-slate-800 dark:text-white font-bold text-sm tracking-wide uppercase">
                                {isViewOnly ? "HAWKER ASSOCIATION APPLICATION - RECORD VIEW" : (isPreviewMode ? "CLARIFICATION PREVIEW - HAWKER ASSOCIATION APPLICATION" : "HAWKER ASSOCIATION APPLICATION & LGU COMPLIANCE")}
                            </h1>
                            <button
                                onClick={handleModalCloseClick}
                                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm font-bold px-2 py-1 rounded cursor-pointer"
                            >
                                &times; Close
                            </button>
                        </div>
                        <div className="px-6 md:px-8 pb-6 md:pb-8">
                            <form onSubmit={handleInitialSubmitClick} className="mt-4 space-y-6">
                                <div className="flex flex-col md:flex-row justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-5 gap-4">
                                    <div className="w-14 h-14 flex items-center justify-center border border-slate-200 dark:border-slate-700 rounded-full bg-white dark:bg-slate-800 p-2 shadow-xs">
                                        <img src={logoSystem} alt="Logo Left" className="w-full h-full object-contain" />
                                    </div>
                                    <div className="text-center space-y-0.5">
                                        <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium">Government Service</p>
                                        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-white">Gov Serv</h2>
                                        <p className="text-[10px] uppercase font-semibold text-slate-700 dark:text-slate-300 tracking-wide">Market Development and Administration Department</p>
                                        <p className="text-[9px] text-slate-500 dark:text-slate-400">Tel No. 1122-3344 Local 1234</p>
                                    </div>
                                    <div className="w-14 h-14 flex items-center justify-center border border-slate-200 dark:border-slate-700 rounded-full bg-white dark:bg-slate-800 p-2 shadow-xs">
                                        <img src={logoSystem} alt="Logo Right" className="w-full h-full object-contain" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3 text-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-700 dark:text-slate-300">Application Type:</span>
                                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold tracking-wide">HAWKER ASSOCIATION APPLICATION</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-700 dark:text-slate-300">Date Submitted:</span>
                                        <input
                                            type="text"
                                            value={formData.dateSubmitted}
                                            readOnly
                                            className="border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 w-56 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs cursor-not-allowed focus:outline-none"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-700 dark:text-slate-300">Application Status:</span>
                                        {isViewOnly ? (
                                            <div className="w-56 text-right md:text-left md:pl-1">
                                                <span className={`px-3 py-1 rounded-full font-bold uppercase tracking-wider text-[10px] border ${viewedAppStatus === 'Approved' ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' :
                                                    viewedAppStatus === 'Rejected' || viewedAppStatus === 'Suspended' ? 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800' :
                                                        'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                                    }`}>
                                                    {viewedAppStatus}
                                                </span>
                                            </div>
                                        ) : (
                                            <input
                                                type="text"
                                                value="New"
                                                readOnly
                                                className="border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 w-56 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs cursor-not-allowed focus:outline-none"
                                            />
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-700 dark:text-slate-300">Association Number:</span>
                                        <input
                                            type="text"
                                            value={formData.associationNumber}
                                            readOnly
                                            className="border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 w-56 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs cursor-not-allowed focus:outline-none"
                                        />
                                    </div>
                                    {isViewOnly && viewedAppRemarks && (
                                        <div className="col-span-1 md:col-span-2 mt-3 p-3 bg-blue-50/50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg">
                                            <h4 className="text-[11px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider mb-1">
                                                <i className="fa-solid fa-comment-dots mr-1"></i> LGU Official Remarks / Assessment
                                            </h4>
                                            <p className="text-xs text-blue-900 dark:text-blue-200 font-medium">{viewedAppRemarks}</p>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-5 pt-1">
                                    <div>
                                        <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wide mb-2.5">Information</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                                            <div>
                                                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Name of Association <span className="text-red-500">*</span></label>
                                                <input
                                                    type="text"
                                                    name="associationName"
                                                    value={formData.associationName}
                                                    onChange={handleInputChange}
                                                    readOnly={isPreviewMode}
                                                    required
                                                    className={`w-full border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-800 ${isPreviewMode ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed text-slate-600 dark:text-slate-300' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white'}`}
                                                />
                                            </div>
                                            <div>
                                                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">SEC Number</label>
                                                <input
                                                    type="text"
                                                    name="secNumber"
                                                    value={formData.secNumber}
                                                    onChange={handleInputChange}
                                                    readOnly={isPreviewMode}
                                                    className={`w-full border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-800 ${isPreviewMode ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed text-slate-600 dark:text-slate-300' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white'}`}
                                                />
                                            </div>
                                            <div>
                                                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Date Granted</label>
                                                <input
                                                    type="text"
                                                    name="dateGranted"
                                                    maxLength={10}
                                                    placeholder="MM/DD/YYYY"
                                                    value={formData.dateGranted}
                                                    onChange={handleInputChange}
                                                    readOnly={isPreviewMode}
                                                    className={`w-full border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-800 ${isPreviewMode ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed text-slate-600 dark:text-slate-300' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white'}`}
                                                />
                                            </div>
                                            <div>
                                                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Telephone <span className="text-red-500">*</span></label>
                                                <input
                                                    type="text"
                                                    name="telephone"
                                                    maxLength={11}
                                                    placeholder="11 digits max"
                                                    value={formData.telephone}
                                                    onChange={handleInputChange}
                                                    readOnly={isPreviewMode}
                                                    required
                                                    className={`w-full border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-800 ${isPreviewMode ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed text-slate-600 dark:text-slate-300' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white'}`}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                                        <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wide mb-2.5">LGU Market Zone & Location Allocation</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                            <div>
                                                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Assigned Public Market Zone <span className="text-red-500">*</span></label>
                                                <select
                                                    name="marketZone"
                                                    value={formData.marketZone}
                                                    onChange={handleInputChange}
                                                    disabled={isPreviewMode}
                                                    className={`w-full border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs focus:outline-none ${isPreviewMode ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed text-slate-600 dark:text-slate-300' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white cursor-pointer'}`}
                                                >
                                                    {MARKET_ZONES.map((zone, idx) => (
                                                        <option key={idx} value={zone}>{zone}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Requested Vending Stalls / Meters Count <span className="text-red-500">*</span></label>
                                                <input
                                                    type="number"
                                                    name="assignedStallCount"
                                                    min={1}
                                                    value={formData.assignedStallCount}
                                                    onChange={handleInputChange}
                                                    readOnly={isPreviewMode}
                                                    required
                                                    className={`w-full border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs focus:outline-none ${isPreviewMode ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed text-slate-600 dark:text-slate-300' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white'}`}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                                        <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wide mb-1">Digital Vault Statutory Documents</h3>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">Upload required municipal compliance attachments (JPG, PNG images or PDF files):</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                                            <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                                                <div>
                                                    <p className="font-semibold text-slate-800 dark:text-white mb-1">SEC / DTI Permit <span className="text-red-500">*</span></p>
                                                    {!isPreviewMode && (
                                                        <input
                                                            type="file"
                                                            accept="image/jpeg, image/png, application/pdf"
                                                            onChange={(e) => handleFileChange(e, 'SEC_DTI_PERMIT')}
                                                            className="w-full text-[10px] text-slate-500 dark:text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 dark:file:bg-blue-950 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100"
                                                        />
                                                    )}
                                                </div>
                                                {getDocByType('SEC_DTI_PERMIT') ? (
                                                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                                        {getDocByType('SEC_DTI_PERMIT')?.mime_type.startsWith('image/') ? (
                                                            <div className="w-full h-24 rounded overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                                                                <img
                                                                    src={getDocByType('SEC_DTI_PERMIT')?.file_url}
                                                                    alt="SEC Permit Preview"
                                                                    className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                                                                    onClick={() => openAttachment(getDocByType('SEC_DTI_PERMIT')?.file_url, getDocByType('SEC_DTI_PERMIT')?.mime_type)}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div
                                                                className="w-full h-24 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                                                                onClick={() => openAttachment(getDocByType('SEC_DTI_PERMIT')?.file_url, getDocByType('SEC_DTI_PERMIT')?.mime_type)}
                                                            >
                                                                <i className="fa-solid fa-file-pdf text-rose-500 text-3xl mb-1"></i>
                                                                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold hover:underline">View PDF</span>
                                                            </div>
                                                        )}
                                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-1">{getDocByType('SEC_DTI_PERMIT')?.file_name}</p>
                                                    </div>
                                                ) : isPreviewMode && (
                                                    <p className="text-[10px] text-amber-600 dark:text-amber-400 italic mt-2">No SEC/DTI file attached</p>
                                                )}
                                            </div>
                                            <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                                                <div>
                                                    <p className="font-semibold text-slate-800 dark:text-white mb-1">Member Roster List <span className="text-red-500">*</span></p>
                                                    {!isPreviewMode && (
                                                        <input
                                                            type="file"
                                                            accept="image/jpeg, image/png, application/pdf"
                                                            onChange={(e) => handleFileChange(e, 'MEMBER_ROSTER')}
                                                            className="w-full text-[10px] text-slate-500 dark:text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 dark:file:bg-blue-950 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100"
                                                        />
                                                    )}
                                                </div>
                                                {getDocByType('MEMBER_ROSTER') ? (
                                                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                                        {getDocByType('MEMBER_ROSTER')?.mime_type.startsWith('image/') ? (
                                                            <div className="w-full h-24 rounded overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                                                                <img
                                                                    src={getDocByType('MEMBER_ROSTER')?.file_url}
                                                                    alt="Roster Preview"
                                                                    className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                                                                    onClick={() => openAttachment(getDocByType('MEMBER_ROSTER')?.file_url, getDocByType('MEMBER_ROSTER')?.mime_type)}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div
                                                                className="w-full h-24 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                                                                onClick={() => openAttachment(getDocByType('MEMBER_ROSTER')?.file_url, getDocByType('MEMBER_ROSTER')?.mime_type)}
                                                            >
                                                                <i className="fa-solid fa-file-pdf text-rose-500 text-3xl mb-1"></i>
                                                                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold hover:underline">View PDF</span>
                                                            </div>
                                                        )}
                                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-1">{getDocByType('MEMBER_ROSTER')?.file_name}</p>
                                                    </div>
                                                ) : isPreviewMode && (
                                                    <p className="text-[10px] text-amber-600 dark:text-amber-400 italic mt-2">No Roster file attached</p>
                                                )}
                                            </div>
                                            <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                                                <div>
                                                    <p className="font-semibold text-slate-800 dark:text-white mb-1">Barangay Clearance <span className="text-red-500">*</span></p>
                                                    {!isPreviewMode && (
                                                        <input
                                                            type="file"
                                                            accept="image/jpeg, image/png, application/pdf"
                                                            onChange={(e) => handleFileChange(e, 'BARANGAY_CLEARANCE')}
                                                            className="w-full text-[10px] text-slate-500 dark:text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 dark:file:bg-blue-950 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100"
                                                        />
                                                    )}
                                                </div>
                                                {getDocByType('BARANGAY_CLEARANCE') ? (
                                                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                                        {getDocByType('BARANGAY_CLEARANCE')?.mime_type.startsWith('image/') ? (
                                                            <div className="w-full h-24 rounded overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                                                                <img
                                                                    src={getDocByType('BARANGAY_CLEARANCE')?.file_url}
                                                                    alt="Clearance Preview"
                                                                    className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                                                                    onClick={() => openAttachment(getDocByType('BARANGAY_CLEARANCE')?.file_url, getDocByType('BARANGAY_CLEARANCE')?.mime_type)}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div
                                                                className="w-full h-24 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                                                                onClick={() => openAttachment(getDocByType('BARANGAY_CLEARANCE')?.file_url, getDocByType('BARANGAY_CLEARANCE')?.mime_type)}
                                                            >
                                                                <i className="fa-solid fa-file-pdf text-rose-500 text-3xl mb-1"></i>
                                                                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold hover:underline">View PDF</span>
                                                            </div>
                                                        )}
                                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-1">{getDocByType('BARANGAY_CLEARANCE')?.file_name}</p>
                                                    </div>
                                                ) : isPreviewMode && (
                                                    <p className="text-[10px] text-amber-600 dark:text-amber-400 italic mt-2">No Barangay Clearance attached</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wide mb-2.5">Chairperson</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                                            <div>
                                                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">First Name <span className="text-red-500">*</span></label>
                                                <input
                                                    type="text"
                                                    name="firstName"
                                                    value={formData.firstName}
                                                    onChange={handleInputChange}
                                                    readOnly={isPreviewMode}
                                                    required
                                                    className={`w-full border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-800 ${isPreviewMode ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed text-slate-600 dark:text-slate-300' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white'}`}
                                                />
                                            </div>
                                            <div>
                                                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Middle Name</label>
                                                <input
                                                    type="text"
                                                    name="middleName"
                                                    value={formData.middleName}
                                                    onChange={handleInputChange}
                                                    readOnly={isPreviewMode}
                                                    className={`w-full border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-800 ${isPreviewMode ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed text-slate-600 dark:text-slate-300' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white'}`}
                                                />
                                            </div>
                                            <div>
                                                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Last Name <span className="text-red-500">*</span></label>
                                                <input
                                                    type="text"
                                                    name="lastName"
                                                    value={formData.lastName}
                                                    onChange={handleInputChange}
                                                    readOnly={isPreviewMode}
                                                    required
                                                    className={`w-full border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-800 ${isPreviewMode ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed text-slate-600 dark:text-slate-300' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white'}`}
                                                />
                                            </div>
                                            <div>
                                                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address <span className="text-red-500">*</span></label>
                                                <input
                                                    type="email"
                                                    name="email"
                                                    value={formData.email}
                                                    onChange={handleInputChange}
                                                    readOnly={isPreviewMode}
                                                    required
                                                    className={`w-full border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-800 ${isPreviewMode ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed text-slate-600 dark:text-slate-300' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white'}`}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                                        <div>
                                            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Submitted By: <span className="text-red-500">*</span></label>
                                            <input
                                                type="text"
                                                name="submittedBy"
                                                value={formData.submittedBy}
                                                onChange={handleInputChange}
                                                readOnly={isPreviewMode}
                                                required
                                                className={`w-full border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-800 ${isPreviewMode ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed text-slate-600 dark:text-slate-300' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white'}`}
                                            />
                                        </div>
                                        <div>
                                            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address of Submitter: <span className="text-red-500">*</span></label>
                                            <input
                                                type="email"
                                                name="submitterEmail"
                                                value={formData.submitterEmail}
                                                onChange={handleInputChange}
                                                readOnly={isPreviewMode}
                                                required
                                                className={`w-full border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-800 ${isPreviewMode ? 'bg-slate-100 dark:bg-slate-800 cursor-not-allowed text-slate-600 dark:text-slate-300' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white'}`}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-center space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                                    {isViewOnly ? (
                                        <button
                                            type="button"
                                            onClick={showListView}
                                            className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-blue-800 dark:text-blue-300 border border-blue-600 dark:border-blue-500 font-semibold text-xs py-1.5 px-8 rounded shadow-sm transition-colors cursor-pointer"
                                        >
                                            Close View
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                type="button"
                                                onClick={handleCancelClick}
                                                className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-blue-800 dark:text-blue-300 border border-blue-600 dark:border-blue-500 font-semibold text-xs py-1.5 px-6 rounded shadow-sm transition-colors cursor-pointer"
                                            >
                                                {isPreviewMode ? "Back to Edit" : "Cancel"}
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
                </div>
            )}
            {isConfirmationOpen && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg max-w-sm w-full p-6 text-center space-y-4 shadow-xl">
                        <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto text-lg font-bold">
                            ?
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase">Are you sure?</h3>
                            <p className="text-xs text-slate-600 dark:text-slate-300">You are about to cancel. Any inputs or progress will be discarded.</p>
                        </div>
                        <div className="flex items-center justify-center space-x-2 pt-2">
                            <button
                                onClick={handleConfirmNo}
                                className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 font-semibold text-xs py-1.5 px-6 rounded shadow-xs cursor-pointer"
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
            {previewAttachment && (
                <div
                    className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-2 sm:p-4"
                    onClick={() => setPreviewAttachment(null)}
                >
                    <div
                        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col items-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center w-full mb-2 px-1">
                            <span className="text-white text-xs font-semibold opacity-75">Document Preview</span>
                            <button
                                type="button"
                                onClick={() => setPreviewAttachment(null)}
                                className="text-white bg-slate-700 hover:bg-slate-600 rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold cursor-pointer transition-colors"
                            >
                                ✕
                            </button>
                        </div>
                        {previewAttachment.mime === 'application/pdf' ? (
                            <iframe
                                src={previewAttachment.url}
                                className="w-full rounded-xl border border-slate-600"
                                style={{ height: '80vh' }}
                                title="Document Preview"
                            />
                        ) : (
                            <img
                                src={previewAttachment.url}
                                alt="Document Preview"
                                className="max-w-full max-h-[80vh] object-contain rounded-xl border border-slate-600 shadow-2xl"
                            />
                        )}
                        <p className="text-slate-400 text-[11px] mt-2">Click anywhere outside to close</p>
                    </div>
                </div>
            )}
        </CitizenLayout>
    );
}