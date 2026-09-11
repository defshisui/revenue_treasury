import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { UnifiedHeader } from "./UnifiedHeader";
import { UnifiedFooter } from "./UnifiedFooter";
import {
  createPayMongoQrPaymentIntent,
  createQrPhPaymentMethod,
  attachQrPhPaymentMethod,
} from "../services/paymongoService";
import {
  searchRPTByTDN,
  processGroupRPTPayment,
  getRPTApplications,
  saveRPTApplication,
  type RPTApplicationRecord
} from "../services/realpropertytaxService";

export type ApplicantType = "Property Owner" | "Authorized Representative" | "Corporation / Company";
export type RPTApplicationStatus =
  | "Submitted"
  | "For Review"
  | "Under Evaluation"
  | "For Compliance"
  | "Processing"
  | "For Payment"
  | "Payment Completed"
  | "Approved"
  | "Ready for Release"
  | "Completed"
  | "Rejected";

export interface PropertyItem {
  id: string | number;
  taxDeclarationNumber: string;
  pin?: string;
  newPspin: string;
  ownerName: string;
  propertyLocation: string;
  barangay: string;
  propertyType: string;
  billingYear: number;
  billExpiryDate: string;
  lotAreaSqM: number;
  assessedValue: number;
  marketValue: number;
  basicTax: number;
  sefTax: number;
  shttcApplied: number;
  specialLevy?: number;
  penalty: number;
  discount: number;
  totalAssessment: number;
  amountPaid: number;
  balance: number;
  status: string;
  paymentStatus: string;
  quarterlyAmounts?: {
    q1: number;
    q2: number;
    q3: number;
    q4: number;
  };

  selectedPaymentOption?: "Quarterly" | "Full" | "";
  selectedQuarters?: { q1: boolean; q2: boolean; q3: boolean; q4: boolean };
  computedPayableAmount?: number;
}

export interface CartItem {
  tdn: string;
  ownerName: string;
  propertyType: string;
  billCoverage: string;
  paymentOption: "Quarterly" | "Full";
  amountDue: number;
  shttcApplied: number;
  discount: number;
  penalty: number;
  totalPayable: number;
  rawProperty: PropertyItem;
}

export interface ElectronicReceipt {
  officialReceiptNumber: string;
  groupReferenceNumber: string;
  paymentDate: string;
  customerName: string;
  paymentMethod: string;
  totalAmount: number;
  items: Array<{
    taxDeclarationNumber: string;
    ownerName: string;
    amount: number;
    officialReceiptNumber: string;
    paymentOption?: string;
  }>;
}

interface RPTPaymentHistoryItem {
  id: string;
  tdn: string;
  ownerName: string;
  location: string;
  year: number;
  assessedValue: number;
  taxDue: number;
  paymentDate: string;
  officialReceiptNumber: string;
  paymentMethod: string;
}

const services = [
  "Transfer of Ownership",
  "Consolidation / Segregation",
  "New Assessment / Reassessment / Reclassification",
  "Correction / Updating / Revision",
  "Declaration of New / Undeclared Land",
  "Cancellation of Assessment Records",
];

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(val || 0);
}

function getStoredCitizenSession() {
  const rawUser =
    localStorage.getItem("currentUser") ||
    localStorage.getItem("user") ||
    sessionStorage.getItem("currentUser") ||
    sessionStorage.getItem("user");
  if (!rawUser) return null;
  try {
    const parsed = JSON.parse(rawUser);
    const target = parsed.user && typeof parsed.user === "object" ? parsed.user : parsed;
    const fullName = target.fullname || target.name || target.fullName || target.firstName || target.email;
    if (!fullName) return null;
    const email = target.email || "";
    return { fullname: String(fullName), email };
  } catch {
    return null;
  }
}
export function RealPropertyTaxHub() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F6F9] text-slate-800 font-sans">

      <UnifiedHeader />

      <div className="relative w-full bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 h-36 sm:h-48 overflow-hidden flex items-center justify-center border-b-4 border-blue-600">
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]"></div>

        <div className="relative z-10 text-center px-4">
          <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-wide uppercase">
            WELCOME TO REAL PROPERTY TAX
          </h1>

          <p className="text-xs sm:text-sm text-slate-200 mt-1 max-w-xl mx-auto">
            This portal is one of our digital Gov Serv initiatives catering to property owners and taxpayers in accessing their Real Property Tax services.
          </p>
        </div>
      </div>


      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-8 sm:py-10">

          <div className="flex justify-center">

            <section className="w-full max-w-[650px] bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-7 text-center">

              <h2 className="text-blue-900 font-bold text-sm tracking-wider uppercase mb-2">
                PROCEED AND PAY ONLINE
              </h2>

              <p className="max-w-xl mx-auto mt-3 text-xs sm:text-sm text-[#36527A] leading-relaxed">
                Search your Tax Declaration Number, view your property
                assessment and outstanding balance and pay your Real Property Tax Online.
              </p>

              <button
                type="button"
                onClick={() => navigate("/citizen-rpt")}
                className="mt-5 w-full sm:w-auto px-6 py-2.5 bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold rounded-full shadow-md transition-all cursor-pointer"
              >
                PROCEED WITH REAL PROPERTY TAX
              </button>

            </section>

          </div>
        </div>
      </main>

      <UnifiedFooter />

    </div>
  );
}

export default function RealPropertyApplication({ isCollapsed = false }: { isCollapsed?: boolean }) {
  const location = useLocation();

  const [activePortalTab, setActivePortalTab] = useState<"search" | "summary">("search");
  const [isServiceRequestModalOpen, setIsServiceRequestModalOpen] = useState(false);



  const [rptSearchStep, setRptSearchStep] = useState<1 | 2 | 3>(1);

  const [searchTdnInput, setSearchTdnInput] = useState<string>("");
  const [searchType, setSearchType] = useState<string>("Tax Declaration No. (TDN)");
  const [assessmentYear, setAssessmentYear] = useState<string>("All Years");
  const [dailySearchQuota, setDailySearchQuota] = useState<number>(20);
  const [isSearchingTdn, setIsSearchingTdn] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string>("");

  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState<boolean>(false);
  const [verifiedOwnerName, setVerifiedOwnerName] = useState<string>("");

  const [associatedProperties, setAssociatedProperties] = useState<PropertyItem[]>([]);
  const [selectedTdnIds, setSelectedTdnIds] = useState<Set<string>>(new Set());

  const [isUnselectedWarningOpen, setIsUnselectedWarningOpen] = useState<boolean>(false);
  const [hasAcknowledgedUnselected, setHasAcknowledgedUnselected] = useState<boolean>(false);

  const [isOptionModalOpen, setIsOptionModalOpen] = useState<boolean>(false);
  const [activeConfiguringTdn, setActiveConfiguringTdn] = useState<PropertyItem | null>(null);
  const [tempOptionChoice, setTempOptionChoice] = useState<"Quarterly" | "Full">("Full");
  const [tempQuarterSelection, setTempQuarterSelection] = useState<{ q1: boolean; q2: boolean; q3: boolean; q4: boolean }>({
    q1: true,
    q2: true,
    q3: true,
    q4: true,
  });

  const [isGroupApplyConfirmOpen, setIsGroupApplyConfirmOpen] = useState<boolean>(false);
  const [isSuccessFeedbackOpen, setIsSuccessFeedbackOpen] = useState<boolean>(false);
  const [successFeedbackMessage, setSuccessFeedbackMessage] = useState<string>("");

  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isCheckingOut, setIsCheckingOut] = useState<boolean>(false);
  const [issuedReceipt, setIssuedReceipt] = useState<ElectronicReceipt | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);

  const [isQrPaymentOpen, setIsQrPaymentOpen] = useState<boolean>(false);
  const [isGeneratingQr, setIsGeneratingQr] = useState<boolean>(false);
  const [rptQrCodeUrl, setRptQrCodeUrl] = useState<string>("");
  const [rptQrReferenceNumber, setRptQrReferenceNumber] = useState<string>("");
  const [rptQrPaymentIntentId, setRptQrPaymentIntentId] = useState<string>("");
  const [rptQrSecondsRemaining, setRptQrSecondsRemaining] = useState<number>(300);
  const [rptQrPaid, setRptQrPaid] = useState<boolean>(false);
  const [rptPaymentSuccessCountdown, setRptPaymentSuccessCountdown] = useState<number>(5);
  const [rptQrError, setRptQrError] = useState<string>("");

  // --- Applications Queue (Assessor Request Form) ---
  const [applications, setApplications] = useState<RPTApplicationRecord[]>([]);
  const [appForm, setAppForm] = useState({
    service: services[0],
    applicantType: "Property Owner" as ApplicantType,
    ownerName: "",
    applicantName: "",
    email: "",
    mobileNumber: "",
    taxDeclarationNumber: "",
    tin: "",
    propertyLocation: "",
    barangay: "",
    propertyType: "Residential",
    notes: "",
  });
  const [appDocuments, setAppDocuments] = useState<{ [key: string]: { name: string; url: string } }>({
    ownershipProof: { name: "", url: "" },
    validId: { name: "", url: "" },
    taxRecord: { name: "", url: "" },
    propertySketch: { name: "", url: "" },
    authorization: { name: "", url: "" },
  });
  const [appRawFiles, setAppRawFiles] = useState<{ [key: string]: File | null }>({
    ownershipProof: null,
    validId: null,
    taxRecord: null,
    propertySketch: null,
    authorization: null,
  });
  const [isSubmittingApp, setIsSubmittingApp] = useState(false);
  const [appNotice, setAppNotice] = useState("");
  const [selectedAppDetail, setSelectedAppDetail] = useState<RPTApplicationRecord | null>(null);
  const [rptServicePaymentNotice, setRptServicePaymentNotice] = useState("");

  const [citizenPreviewDoc, setCitizenPreviewDoc] = useState<{ name: string; url: string } | null>(null);
  const [citizenPreviewError, setCitizenPreviewError] = useState<boolean>(false);

  const resolveCitizenDocUrl = (url?: string, name?: string) => {
    let target = url || '';
    if (!target || target.trim() === '') target = name || '';
    if (target.startsWith('data:') || target.startsWith('http://') || target.startsWith('https://')) {
      return target;
    }
    if (target.startsWith('/uploads/')) {
      return `${API_BASE_URL}${target}`;
    }
    if (target.trim() !== '') {
      return `${API_BASE_URL}/uploads/${target}`;
    }
    return '';
  };

  const getAppDocumentsList = (app?: RPTApplicationRecord | null): Array<{ name: string; url: string }> => {
    if (!app || !app.documents) return [];
    let raw = app.documents;
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw); } catch { return []; }
    }
    if (raw && !Array.isArray(raw) && typeof raw === 'object') {
      raw = Object.values(raw);
    }
    if (!Array.isArray(raw)) return [];
    return raw.reduce((acc: Array<{ name: string; url: string }>, d: any) => {
      // Skip null/undefined or empty entries — show only real uploaded documents
      if (!d) return acc;
      if (typeof d === 'string') {
        if (!d.trim()) return acc;
        acc.push({ name: d, url: d });
        return acc;
      }
      const docName = d.name || d.fileName || '';
      if (!docName) return acc; // skip entries with no real filename
      acc.push({ name: docName, url: d.url || '' });
      return acc;
    }, []);
  };

  const getAppForTdn = (tdn: string): RPTApplicationRecord | null => {
    if (!tdn) return null;
    const matches = applications.filter((app) => app.taxDeclarationNumber === tdn);
    if (matches.length === 0) return null;
    // Most recently filed application takes priority when there are several for the same TDN.
    return matches.reduce((latest, app) => ((app.filedDate || "") > (latest.filedDate || "") ? app : latest), matches[0]);
  };

  const getAppStatusBadgeClass = (status?: string): string => {
    if (status === "Approved" || status === "Ready for Release" || status === "Payment Completed" || status === "Completed") {
      return "bg-emerald-100 text-emerald-800";
    }
    if (status === "Rejected") return "bg-rose-100 text-rose-800";
    if (status === "For Payment") return "bg-blue-100 text-blue-800";
    return "bg-amber-100 text-amber-800";
  };

  const createDocumentFallbackSvg = (title: string) => {
    const cleanTitle = title.replace(/^\d+-\d+-/, '').replace(/\.[^/.]+$/, '').replace(/[._-]/g, ' ');
    const ext = (title.split('.').pop() || 'DOC').toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1050" width="100%" height="100%">
      <rect width="800" height="1050" fill="#F8FAFC" rx="16"/>
      <rect x="20" y="20" width="760" height="1010" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="2" rx="12"/>
      <rect x="40" y="40" width="720" height="110" fill="#0B3B60" rx="8"/>
      <text x="400" y="80" fill="#93C5FD" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="700" letter-spacing="2" text-anchor="middle">REPUBLIC OF THE PHILIPPINES</text>
      <text x="400" y="115" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="900" text-anchor="middle">CITY ASSESSOR &amp; TREASURY OFFICE</text>
      
      <rect x="60" y="190" width="680" height="400" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5" rx="10"/>
      <rect x="60" y="190" width="680" height="42" fill="#F1F5F9" rx="10"/>
      <text x="90" y="217" fill="#475569" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="800" letter-spacing="1">ATTACHED DOCUMENT RECORD</text>
      
      <text x="90" y="275" fill="#64748B" font-family="system-ui, -apple-system, sans-serif" font-size="13">Document Name:</text>
      <text x="250" y="275" fill="#0F172A" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700">${title}</text>
      
      <text x="90" y="325" fill="#64748B" font-family="system-ui, -apple-system, sans-serif" font-size="13">Document Type:</text>
      <text x="250" y="325" fill="#0284C7" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700">${ext} Document</text>
      
      <text x="90" y="375" fill="#64748B" font-family="system-ui, -apple-system, sans-serif" font-size="13">Classification:</text>
      <text x="250" y="375" fill="#0F172A" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="600">${cleanTitle}</text>
      
      <text x="90" y="425" fill="#64748B" font-family="system-ui, -apple-system, sans-serif" font-size="13">Verification Status:</text>
      <rect x="250" y="407" width="140" height="26" fill="#DCFCE7" rx="6"/>
      <text x="320" y="425" fill="#166534" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="800" text-anchor="middle">VERIFIED ON FILE</text>

      <text x="90" y="475" fill="#64748B" font-family="system-ui, -apple-system, sans-serif" font-size="13">Registry Archive:</text>
      <text x="250" y="475" fill="#0F172A" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="600">Quezon City Local Government Unit</text>

      <line x1="90" y1="510" x2="710" y2="510" stroke="#E2E8F0" stroke-width="1"/>
      <text x="400" y="545" fill="#64748B" font-family="system-ui, -apple-system, sans-serif" font-size="12" text-anchor="middle">This document is certified and recorded in the Real Property Tax management archive.</text>

      <rect x="60" y="630" width="680" height="240" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5" rx="10"/>
      <text x="90" y="670" fill="#0B3B60" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700">DOCUMENT PREVIEW CERTIFICATION</text>
      <text x="90" y="700" fill="#475569" font-family="system-ui, -apple-system, sans-serif" font-size="12">Registered under Application Filing. Official documentation acknowledged by treasury evaluation officers.</text>
      <text x="90" y="725" fill="#64748B" font-family="system-ui, -apple-system, sans-serif" font-size="12">Documentary proof is recognized for Assessment, Tax Declaration, and Transfer of Ownership procedures.</text>

      <circle cx="620" cy="750" r="50" fill="none" stroke="#0284C7" stroke-width="2" stroke-dasharray="4 2"/>
      <circle cx="620" cy="750" r="44" fill="none" stroke="#0B3B60" stroke-width="1.5"/>
      <text x="620" y="746" fill="#0B3B60" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="900" text-anchor="middle">OFFICIAL</text>
      <text x="620" y="760" fill="#0284C7" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="900" text-anchor="middle">ARCHIVE</text>

      <text x="90" y="930" fill="#0F172A" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700">CITY ASSESSOR &amp; TREASURER</text>
      <text x="90" y="950" fill="#64748B" font-family="system-ui, -apple-system, sans-serif" font-size="12">Document Repository &amp; Compliance Office</text>
    </svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  };

  const handleCitizenOpenDocPreview = (doc: { name: string; url?: string }) => {
    let resolvedUrl = resolveCitizenDocUrl(doc.url, doc.name);
    if (!resolvedUrl || resolvedUrl.trim() === '') {
      resolvedUrl = createDocumentFallbackSvg(doc.name || 'Document');
    }
    setCitizenPreviewError(false);
    setCitizenPreviewDoc({ name: doc.name || 'Document', url: resolvedUrl });
  };

  const [isRPTServiceQrOpen, setIsRPTServiceQrOpen] = useState(false);
  const [isGeneratingRPTServiceQr, setIsGeneratingRPTServiceQr] = useState(false);
  const [rptServiceQrCodeUrl, setRptServiceQrCodeUrl] = useState("");
  const [rptServiceQrReferenceNumber, setRptServiceQrReferenceNumber] = useState("");
  const [rptServiceQrPaymentIntentId, setRptServiceQrPaymentIntentId] = useState("");
  const [rptServiceQrSecondsRemaining, setRptServiceQrSecondsRemaining] = useState(300);
  const [rptServiceQrPaid, setRptServiceQrPaid] = useState(false);
  const [rptServicePaymentSuccess, setRptServicePaymentSuccess] = useState(false);
  const [rptServicePaymentConfirmedAt, setRptServicePaymentConfirmedAt] = useState<Date | null>(null);
  const [rptServicePaymentApplication, setRptServicePaymentApplication] = useState<RPTApplicationRecord | null>(null);

  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);

  const [currentUser, setCurrentUser] = useState<{ fullname: string; email: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
  const [rptPaymentHistory, setRptPaymentHistory] = useState<RPTPaymentHistoryItem[]>([]);
  const [isPaymentHistoryOpen, setIsPaymentHistoryOpen] = useState(false);

  const showToast = (text: string, type: "success" | "error" | "info" = "info") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    const session = getStoredCitizenSession();
    if (session) {
      setCurrentUser(session);
      setAppForm((prev) => ({
        ...prev,
        ownerName: session.fullname,
        applicantName: session.fullname,
        email: session.email,
      }));
    }

    const params = new URLSearchParams(location.search);
    const viewParam = params.get("view");
    if (viewParam === "status") setActivePortalTab("search");
    else if (viewParam === "form") setIsServiceRequestModalOpen(true);
    else if (viewParam === "summary") setActivePortalTab("summary");

    try {
      const storedHistory = localStorage.getItem("rptPaymentHistory");
      if (storedHistory) {
        const parsedHistory = JSON.parse(storedHistory);
        if (Array.isArray(parsedHistory)) setRptPaymentHistory(parsedHistory);
      }
    } catch {
    }

  }, [location.search]);

  const loadApplications = async () => {
    try {
      const data = await getRPTApplications();
      setApplications(data);
    } catch (e) {
      console.error("Failed to load applications:", e);
    }
  };

  useEffect(() => {
    loadApplications();
  }, []);


  const handleExecuteTdnSearch = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setSearchError("");

    if (!searchTdnInput.trim()) {
      setSearchError("Please enter a valid Tax Declaration Number.");
      return;
    }

    if (dailySearchQuota <= 0) {
      setSearchError("You have reached your 20/20 daily search quota limit. Please try again tomorrow.");
      return;
    }

    setIsSearchingTdn(true);

    try {
      const result = await searchRPTByTDN(searchTdnInput);

      if (result.found && result.properties && result.properties.length > 0) {
        setDailySearchQuota((prev) => Math.max(0, prev - 1));
        setVerifiedOwnerName(result.ownerName || result.properties[0].ownerName || "Property Owner");

        const mappedProps: PropertyItem[] = result.properties.map((p: any) => ({
          ...p,
          selectedPaymentOption: "Full",
          computedPayableAmount: p.balance || p.totalAssessment || 1020.0,
          selectedQuarters: { q1: true, q2: true, q3: true, q4: true },
        }));

        setAssociatedProperties(mappedProps);
        setSelectedTdnIds(new Set(mappedProps.map((p) => p.taxDeclarationNumber)));

        setIsOwnerModalOpen(true);
      } else {
        setSearchError(result.message || `Tax Declaration Number "${searchTdnInput}" not found in city records.`);
      }
    } catch (err: any) {
      setSearchError(err.message || "Failed to query city database.");
    } finally {
      setIsSearchingTdn(false);
    }
  };

  const handleConfirmOwnerVerification = (isCorrect: boolean) => {
    setIsOwnerModalOpen(false);
    if (isCorrect) {
      setRptSearchStep(2);
      showToast(`Verified ownership for ${verifiedOwnerName}. Found associated properties.`, "success");
    } else {
      setSearchError("Please double check the Tax Declaration Number you typed in and try again.");
    }
  };


  const toggleSelectAllTdns = () => {
    if (selectedTdnIds.size === associatedProperties.length) {
      setSelectedTdnIds(new Set());
    } else {
      setSelectedTdnIds(new Set(associatedProperties.map((p) => p.taxDeclarationNumber)));
    }
  };

  const toggleTdnSelection = (tdn: string) => {
    const next = new Set(selectedTdnIds);
    if (next.has(tdn)) {
      next.delete(tdn);
    } else {
      next.add(tdn);
    }
    setSelectedTdnIds(next);
  };

  const unselectedTdns = useMemo(() => {
    return associatedProperties
      .filter((p) => !selectedTdnIds.has(p.taxDeclarationNumber))
      .map((p) => p.taxDeclarationNumber);
  }, [associatedProperties, selectedTdnIds]);

  const handleProceedToPaymentOptions = () => {
    if (selectedTdnIds.size === 0) {
      showToast("Please select at least one Tax Declaration Number to proceed.", "error");
      return;
    }

    if (unselectedTdns.length > 0) {
      setHasAcknowledgedUnselected(false);
      setIsUnselectedWarningOpen(true);
    } else {
      setRptSearchStep(3);
    }
  };

  const handleConfirmUnselectedProceed = () => {
    if (!hasAcknowledgedUnselected) {
      showToast("Please check the acknowledgment box to confirm your review.", "error");
      return;
    }
    setIsUnselectedWarningOpen(false);
    setRptSearchStep(3);
  };


  const selectedPropertiesList = useMemo(() => {
    return associatedProperties.filter((p) => selectedTdnIds.has(p.taxDeclarationNumber));
  }, [associatedProperties, selectedTdnIds]);

  const openPaymentOptionModal = (prop: PropertyItem) => {
    setActiveConfiguringTdn(prop);
    setTempOptionChoice(prop.selectedPaymentOption === "Quarterly" ? "Quarterly" : "Full");
    setTempQuarterSelection(prop.selectedQuarters || { q1: true, q2: true, q3: true, q4: true });
    setIsOptionModalOpen(true);
  };

  const handleConfirmPaymentOptionModal = () => {
    if (!activeConfiguringTdn) return;
    setIsOptionModalOpen(false);
    setIsGroupApplyConfirmOpen(true);
  };

  const applyOptionSettingsToTdns = (applyToAll: boolean) => {
    setIsGroupApplyConfirmOpen(false);

    setAssociatedProperties((prev) =>
      prev.map((prop) => {
        const isTarget = applyToAll || (activeConfiguringTdn && prop.taxDeclarationNumber === activeConfiguringTdn.taxDeclarationNumber);
        if (!isTarget) return prop;

        let computedAmount = prop.balance || prop.totalAssessment || 1020;
        if (tempOptionChoice === "Quarterly") {
          const qAmount = (prop.totalAssessment || 1020) / 4;
          let count = 0;
          if (tempQuarterSelection.q1) count++;
          if (tempQuarterSelection.q2) count++;
          if (tempQuarterSelection.q3) count++;
          if (tempQuarterSelection.q4) count++;
          computedAmount = qAmount * count;
        }

        return {
          ...prop,
          selectedPaymentOption: tempOptionChoice,
          selectedQuarters: tempQuarterSelection,
          computedPayableAmount: computedAmount,
        };
      })
    );

    setSuccessFeedbackMessage(
      applyToAll
        ? "Successfully applied to all TDN"
        : `Successfully applied to TDN ${activeConfiguringTdn?.taxDeclarationNumber}`
    );
    setIsSuccessFeedbackOpen(true);
  };


  const handleAddToCart = () => {
    if (selectedPropertiesList.length === 0) {
      showToast("No Tax Declaration Numbers selected.", "error");
      return;
    }

    const newCartItems: CartItem[] = selectedPropertiesList.map((prop) => {
      const isQuarterly = prop.selectedPaymentOption === "Quarterly";
      const totalPayable = prop.computedPayableAmount || prop.balance || 1020;
      const coverage = isQuarterly
        ? `2025 (${Object.entries(prop.selectedQuarters || {})
          .filter(([, v]) => v)
          .map(([k]) => k.toUpperCase())
          .join(", ")})`
        : "2025 (Q1) - 2025 (Q4)";

      return {
        tdn: prop.taxDeclarationNumber,
        ownerName: prop.ownerName,
        propertyType: prop.propertyType,
        billCoverage: coverage,
        paymentOption: isQuarterly ? "Quarterly" : "Full",
        amountDue: prop.basicTax + prop.sefTax || 1020,
        shttcApplied: prop.shttcApplied || 0,
        discount: prop.discount || 0,
        penalty: prop.penalty || 0,
        totalPayable: totalPayable,
        rawProperty: prop,
      };
    });

    setCart(newCartItems);
    setIsCartOpen(true);
    showToast(`Added ${newCartItems.length} Group Bill Set item(s) to Cart!`, "success");
  };

  const grandCartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.totalPayable, 0);
  }, [cart]);

  const generateRPTQrPayment = async () => {
    if (cart.length === 0) return;
    setIsGeneratingQr(true);
    setRptQrCodeUrl("");
    setRptQrReferenceNumber("");
    setRptQrPaymentIntentId("");
    setRptQrError("");
    setRptQrPaid(false);
    setRptQrSecondsRemaining(300);

    try {
      const paymentIntent = await createPayMongoQrPaymentIntent({
        amount: grandCartTotal,
        type: "RPT",
        taxDeclarationNumber: cart.map((item) => item.tdn).join(", "),
        rptRecordId: cart[0]?.rawProperty?.id,
        customerName: currentUser?.fullname || cart[0]?.ownerName || "Taxpayer",
        customerEmail: currentUser?.email || "citizen@gov.ph",
        description: `RPT Group Payment (${cart.length} Properties)`,
      });

      setRptQrPaymentIntentId(paymentIntent.paymentIntentId);
      setRptQrReferenceNumber(paymentIntent.referenceNumber);

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
        "";

      if (!imageUrl) {
        throw new Error("PayMongo did not return the QRPh code image. Please try again.");
      }

      setRptQrCodeUrl(imageUrl);
    } catch (error: any) {
      console.error("RPT PayMongo QR error:", error);
      setRptQrError(error?.message || "Unable to generate the PayMongo QRPh code.");
    } finally {
      setIsGeneratingQr(false);
    }
  };

  const openRPTQrPayment = async () => {
    if (cart.length === 0) return;
    setIsQrPaymentOpen(true);
    await generateRPTQrPayment();
  };

  const closeRPTQrPayment = () => {
    if (isGeneratingQr) return;
    setIsQrPaymentOpen(false);
    setRptQrCodeUrl("");
    setRptQrReferenceNumber("");
    setRptQrPaymentIntentId("");
    setRptQrError("");
    setRptQrPaid(false);
    setRptQrSecondsRemaining(300);
  };

  useEffect(() => {
    if (!rptQrPaid) return;

    setRptPaymentSuccessCountdown(5);
    const timer = window.setInterval(() => {
      setRptPaymentSuccessCountdown((seconds) => {
        if (seconds <= 1) {
          window.clearInterval(timer);
          closeRPTQrPayment();
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [rptQrPaid]);

  useEffect(() => {
    if (!isQrPaymentOpen || !rptQrCodeUrl || rptQrPaid) return;
    const timer = window.setInterval(() => {
      setRptQrSecondsRemaining((seconds) => {
        if (seconds <= 1) {
          window.clearInterval(timer);
          setRptQrCodeUrl("");
          void generateRPTQrPayment();
          return 300;
        }
        return seconds - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isQrPaymentOpen, rptQrCodeUrl, rptQrPaid]);

  useEffect(() => {
    if (!isQrPaymentOpen || !rptQrPaymentIntentId || rptQrPaid) return;
    const poll = window.setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/payments/qr-status/${encodeURIComponent(rptQrPaymentIntentId)}`);
        if (!response.ok) return;
        const data = await response.json();
        if (data.paid) {
          setRptQrPaid(true);
          setRptQrSecondsRemaining(0);
          setRptQrCodeUrl("");
          addRPTPaymentHistory(
            cart,
            new Date().toISOString(),
            rptQrReferenceNumber || "QRPH-PAYMENT",
            "PayMongo QR Ph"
          );
          await loadApplications();
          showToast("Real Property Tax payment confirmed!", "success");
        }
      } catch (error) {
        console.error("RPT QR payment status check failed:", error);
      }
    }, 3000);
    return () => window.clearInterval(poll);
  }, [isQrPaymentOpen, rptQrPaymentIntentId, rptQrPaid]);

  const addRPTPaymentHistory = (items: CartItem[], paymentDate: string, officialReceiptNumber: string, paymentMethod: string) => {
    const historyItems: RPTPaymentHistoryItem[] = items.map((item) => ({
      id: `${Date.now()}-${item.tdn}`,
      tdn: item.tdn,
      ownerName: item.ownerName,
      location: item.rawProperty.propertyLocation || item.rawProperty.barangay || "—",
      year: item.rawProperty.billingYear || new Date().getFullYear(),
      assessedValue: item.rawProperty.assessedValue || 0,
      taxDue: item.totalPayable,
      paymentDate,
      officialReceiptNumber,
      paymentMethod,
    }));

    setRptPaymentHistory((previous) => {
      const next = [...historyItems, ...previous].slice(0, 50);
      try {
        localStorage.setItem("rptPaymentHistory", JSON.stringify(next));
      } catch {
      }
      return next;
    });
  };

  const handleExecuteGroupCheckout = async (method: "PayMongo" | "DirectSimulated") => {
    if (cart.length === 0) return;
    setIsCheckingOut(true);

    try {
      if (method === "PayMongo") {
        await openRPTQrPayment();
        setIsCartOpen(false);
        setIsCheckingOut(false);
        return;
      }

      const groupPayload = {
        items: cart.map((item) => ({
          id: item.rawProperty.id,
          taxDeclarationNumber: item.tdn,
          ownerName: item.ownerName,
          totalAmount: item.totalPayable,
          selectedOption: item.paymentOption,
          billCoverage: item.billCoverage,
        })),
        customerName: currentUser?.fullname || cart[0].ownerName || "Taxpayer",
        customerEmail: currentUser?.email || "citizen@gov.ph",
        paymentMethod: "Electronic LGU Payment Gateway (Direct)",
      };

      const result = await processGroupRPTPayment(groupPayload);

      setIssuedReceipt({
        officialReceiptNumber: result.groupOfficialReceipt,
        groupReferenceNumber: result.groupReferenceNumber,
        paymentDate: result.paymentDate,
        customerName: currentUser?.fullname || cart[0].ownerName || "Taxpayer",
        paymentMethod: "Electronic LGU Payment Gateway",
        totalAmount: result.totalAmount,
        items: result.items || [],
      });

      addRPTPaymentHistory(
        cart,
        result.paymentDate,
        result.groupOfficialReceipt,
        "Electronic LGU Payment Gateway"
      );

      setCart([]);
      setIsCartOpen(false);
      setIsReceiptModalOpen(true);
      showToast("Group Real Property Tax payment completed successfully!", "success");

      loadApplications();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Failed to process payment checkout.", "error");
    } finally {
      setIsCheckingOut(false);
    }
  };


  const handleAppFileChange = (e: ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAppRawFiles((prev) => ({ ...prev, [field]: file }));

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = (reader.result as string) || '';
      setAppDocuments((prev) => ({
        ...prev,
        [field]: { name: file.name, url: dataUrl },
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleAppSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAppNotice("");

    if (!appDocuments.ownershipProof.name || !appDocuments.validId.name) {
      setAppNotice("Please attach Proof of Ownership and a Valid Government ID.");
      return;
    }

    setIsSubmittingApp(true);

    const attachedList = Object.entries(appDocuments)
      .filter(([, d]) => d.name)
      .map(([, d]) => ({ name: d.name, url: d.url || "" }));

    const rawFiles: File[] = Object.values(appRawFiles).filter(Boolean) as File[];

    const payload: Partial<RPTApplicationRecord> = {
      controlNumber: `RPT-QC-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`,
      taxDeclarationNumber: appForm.taxDeclarationNumber || "For Issuance",
      ownerName: appForm.ownerName,
      applicantName: appForm.applicantName,
      applicantType: appForm.applicantType,
      email: appForm.email,
      mobileNumber: appForm.mobileNumber,
      service: appForm.service,
      propertyLocation: appForm.propertyLocation,
      barangay: appForm.barangay,
      propertyType: appForm.propertyType,
      status: "Submitted",
      filedDate: new Date().toISOString().split("T")[0],
      documents: attachedList,
      notes: appForm.notes,
    };

    try {
      await saveRPTApplication(payload, rawFiles);
      showToast("Application submitted successfully to the City Assessor's Office!", "success");
      setAppNotice(`Application created with Control No: ${payload.controlNumber}`);
      loadApplications();
      setIsServiceRequestModalOpen(false);
    } catch (err: any) {
      setAppNotice("Failed to submit application: " + err.message);
    } finally {
      setIsSubmittingApp(false);
    }
  };

  const handlePayMongoRPTServiceQrPayment = async (application: RPTApplicationRecord) => {
    setIsGeneratingRPTServiceQr(true);
    setRptServiceQrCodeUrl("");
    setRptServiceQrReferenceNumber("");
    setRptServiceQrPaymentIntentId("");
    setRptServiceQrPaid(false);
    setRptServicePaymentConfirmedAt(null);

    const amount = Number(application.paymentAmount || 0);
    const serviceName = application.service || "Real Property Tax Service";

    if (!Number.isFinite(amount) || amount <= 0) {
      setIsGeneratingRPTServiceQr(false);
      setRptServicePaymentNotice(`The City Assessor has not posted a ${serviceName} fee yet.`);
      return;
    }

    try {
      const paymentIntent = await createPayMongoQrPaymentIntent({
        amount,
        type: "RPT_SERVICE",
        rptApplicationId: String(application.id),
        customerName: application.applicantName || application.ownerName || currentUser?.fullname || "Taxpayer",
        customerEmail: application.email || currentUser?.email || "taxpayer@gov.ph",
        customerPhone: application.mobileNumber,
        description: `${serviceName} - ${application.controlNumber || application.taxDeclarationNumber || "RPT Application"}`,
      } as any);

      setRptServiceQrPaymentIntentId(paymentIntent.paymentIntentId);
      setRptServiceQrReferenceNumber(paymentIntent.referenceNumber);

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
        "";

      if (!imageUrl) {
        throw new Error("PayMongo did not return the QRPh code image. Please try again.");
      }

      setRptServiceQrCodeUrl(imageUrl);
      setRptServicePaymentNotice("");
    } catch (error: any) {
      console.error("PayMongo RPT Service QRPh payment error:", error);
      setRptServicePaymentNotice(
        error?.message || "Unable to generate the PayMongo QRPh code. Please try again."
      );
    } finally {
      setIsGeneratingRPTServiceQr(false);
    }
  };

  const openRPTServicePayment = (application: RPTApplicationRecord) => {
    setRptServicePaymentApplication(application);
    setSelectedAppDetail(null);
    setIsRPTServiceQrOpen(true);
    setRptServicePaymentSuccess(false);
    void handlePayMongoRPTServiceQrPayment(application);
  };

  const closeRPTServicePayment = () => {
    if (isGeneratingRPTServiceQr) return;
    setIsRPTServiceQrOpen(false);
    setRptServicePaymentApplication(null);
    setRptServiceQrCodeUrl("");
    setRptServiceQrReferenceNumber("");
    setRptServiceQrPaymentIntentId("");
    setRptServiceQrPaid(false);
    setRptServicePaymentConfirmedAt(null);
    setRptServicePaymentNotice("");
    setRptServicePaymentSuccess(false);
  };

  useEffect(() => {
    if (!isRPTServiceQrOpen || !rptServiceQrCodeUrl || rptServiceQrPaid) return;

    const timer = window.setInterval(() => {
      setRptServiceQrSecondsRemaining((seconds) => {
        if (seconds <= 1) {
          window.clearInterval(timer);
          setRptServiceQrCodeUrl("");
          if (rptServicePaymentApplication) {
            void handlePayMongoRPTServiceQrPayment(rptServicePaymentApplication);
          }
          return 300;
        }
        return seconds - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRPTServiceQrOpen, rptServiceQrCodeUrl, rptServiceQrPaid, rptServicePaymentApplication]);

  useEffect(() => {
    if (!isRPTServiceQrOpen || !rptServiceQrPaymentIntentId || rptServiceQrPaid) return;

    const poll = window.setInterval(async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/payments/qr-status/${encodeURIComponent(rptServiceQrPaymentIntentId)}`
        );
        if (!response.ok) return;

        const data = await response.json();
        if (data.paid) {
          setRptServiceQrPaid(true);
          setRptServicePaymentConfirmedAt(new Date());
          setRptServiceQrSecondsRemaining(0);
          setRptServiceQrCodeUrl("");
          setIsRPTServiceQrOpen(false);
          setRptServiceQrPaymentIntentId("");
          setRptServicePaymentSuccess(true);
          loadApplications();
        }
      } catch (error) {
        console.error("RPT service QR payment status check failed:", error);
      }
    }, 3000);

    return () => window.clearInterval(poll);
  }, [isRPTServiceQrOpen, rptServiceQrPaymentIntentId, rptServiceQrPaid]);

  const handleRPTServicePayment = async (application: RPTApplicationRecord) => {
    const amount = Number(application.paymentAmount || 0);
    const serviceName = application.service || "Real Property Tax Service";

    if (!amount || amount <= 0) {
      showToast(`The City Assessor has not posted a ${serviceName} fee yet.`, "info");
      return;
    }


    try {
      const latestApplications = await getRPTApplications();
      const latestApplication = latestApplications.find(
        (item) => String(item.id) === String(application.id)
      );

      if (latestApplication?.paymentStatus && String(latestApplication.paymentStatus).toLowerCase() === "paid") {
        setApplications(latestApplications);
        setSelectedAppDetail({ ...application, ...latestApplication });
        showToast("This RPT service application has already been paid.", "info");
        return;
      }

      if (latestApplication) {
        application = { ...application, ...latestApplication };
      }
    } catch (error) {
      console.error("Failed to refresh RPT service payment status:", error);
    }

    if (String(application.paymentStatus || "").toLowerCase() === "paid") {
      showToast("This RPT service application has already been paid.", "info");
      return;
    }

    if (!application.email && !currentUser?.email) {
      showToast("A valid email address is required before online payment.", "error");
      return;
    }

    openRPTServicePayment(application);
  };



  return (
    <div
      style={{
        marginLeft: isCollapsed ? "80px" : "0px",
        width: isCollapsed ? "calc(100% - 80px)" : "100%",
      }}
      className="rpt-portal min-h-screen flex flex-col bg-[#F4F6F9] text-slate-800 font-sans transition-all duration-300"
    >
      <UnifiedHeader />

      <style>{`
        .rpt-portal {
          --rpt-blue: #1D3F99;
          --rpt-blue-dark: #17357F;
          --rpt-navy: #0B3B60;
          --rpt-border: #E2E8F0;
          --rpt-bg: #F4F6F9;
          font-family: inherit;
        }

        .rpt-portal .rpt-main-shell {
          background: #ffffff !important;
          border: 1px solid #E2E8F0 !important;
          border-radius: 16px !important;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08) !important;
          color: #1E293B !important;
        }

        .rpt-portal .rpt-nav-row {
          border-bottom: 1px solid #E2E8F0 !important;
        }

        .rpt-portal .rpt-nav-button {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          min-height: 36px !important;
          padding: 0 14px !important;
          color: #ffffff !important;
          background: #1D3F99 !important;
          border: 1px solid #1D3F99 !important;
          border-radius: 6px !important;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08) !important;
          font-family: inherit !important;
          font-size: 11px !important;
          font-weight: 800 !important;
          letter-spacing: .01em !important;
          text-transform: uppercase !important;
          transition: background .15s ease, border-color .15s ease !important;
        }

        .rpt-portal .rpt-nav-button:hover {
          color: #ffffff !important;
          background: #17357F !important;
          border-color: #17357F !important;
          text-decoration: none !important;
        }

        .rpt-portal .rpt-back {
          color: #2563EB !important;
          font-family: inherit !important;
          font-size: 12px !important;
          font-weight: 700 !important;
        }

        .rpt-portal .rpt-back:hover {
          color: #1D4ED8 !important;
          text-decoration: underline !important;
        }

        .rpt-portal .rpt-title {
          color: #0B3B60 !important;
          font-family: inherit !important;
          font-size: 13px !important;
          font-weight: 900 !important;
          letter-spacing: .02em !important;
        }

        .rpt-portal .rpt-label {
          color: #0B3B60 !important;
          font-family: inherit !important;
          font-size: 11px !important;
          font-weight: 700 !important;
        }

        .rpt-portal .rpt-field {
          height: 36px !important;
          border: 1px solid #CBD5E1 !important;
          border-radius: 6px !important;
          background: #ffffff !important;
          color: #1E293B !important;
          font-family: inherit !important;
          font-size: 12px !important;
          font-weight: 500 !important;
          box-shadow: none !important;
          outline: none !important;
        }

        .rpt-portal .rpt-field:focus {
          border-color: #2563EB !important;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.10) !important;
        }

        .rpt-portal .rpt-field::placeholder {
          color: #94A3B8 !important;
        }

        .rpt-portal .rpt-action {
          height: 36px !important;
          border: 1px solid #1D3F99 !important;
          border-radius: 6px !important;
          background: #1D3F99 !important;
          color: #ffffff !important;
          font-family: inherit !important;
          font-size: 11px !important;
          font-weight: 800 !important;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08) !important;
        }

        .rpt-portal .rpt-action:hover {
          background: #17357F !important;
          border-color: #17357F !important;
          color: #ffffff !important;
        }

        .rpt-portal .rpt-table {
          border-color: #E2E8F0 !important;
          border-radius: 8px !important;
          background: #ffffff !important;
        }

        .rpt-portal .rpt-table th,
        .rpt-portal .rpt-table td {
          border-color: #E2E8F0 !important;
          color: #334155 !important;
          background: #ffffff !important;
          font-family: inherit !important;
          font-size: 11px !important;
          padding: 10px 12px !important;
        }

        .rpt-portal .rpt-table th {
          color: #ffffff !important;
          background: #2846A0 !important;
          font-weight: 800 !important;
          text-transform: uppercase !important;
          white-space: nowrap !important;
        }

        .rpt-portal .rpt-table tbody tr:hover td {
          background: #F8FAFC !important;
        }

        .rpt-portal .rpt-history {
          border: 1px solid #E2E8F0 !important;
          border-radius: 10px !important;
          background: #ffffff !important;
          color: #334155 !important;
        }

        .rpt-portal .rpt-history button {
          color: #0B3B60 !important;
          background: #ffffff !important;
          border: 0 !important;
          border-radius: 10px !important;
          font-family: inherit !important;
          font-size: 11px !important;
          font-weight: 800 !important;
        }

        .rpt-portal .rpt-history button:hover {
          background: #F8FAFC !important;
        }

        .rpt-portal .rpt-empty {
          color: #94A3B8 !important;
          font-family: inherit !important;
          font-size: 11px !important;
        }

        .rpt-portal .rpt-link {
          color: #2563EB !important;
          font-family: inherit !important;
          font-weight: 800 !important;
          text-decoration: none !important;
        }

        .rpt-portal .rpt-link:hover {
          color: #1D4ED8 !important;
          text-decoration: underline !important;
        }

        .rpt-portal .rpt-divider {
          border-color: #E2E8F0 !important;
        }

        .rpt-portal .rpt-main-shell input,
        .rpt-portal .rpt-main-shell select,
        .rpt-portal .rpt-main-shell textarea {
          font-family: inherit;
        }
      `}</style>
      <div className="flex-1">

        {toastMessage && (
          <div className="fixed top-20 right-6 z-50 animate-bounce">
            <div
              className={`px-5 py-3 rounded-2xl shadow-xl font-bold text-xs flex items-center gap-2 border ${toastMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                : toastMessage.type === "error"
                  ? "bg-rose-50 text-rose-800 border-rose-300"
                  : "bg-blue-50 text-blue-800 border-blue-300"
                }`}
            >
              <span>{toastMessage.type === "success" ? "✓" : "ℹ"}</span>
              <span>{toastMessage.text}</span>
            </div>
          </div>
        )}

        <div className="w-full max-w-[1120px] mx-auto px-4 py-8 sm:py-10">
          {activePortalTab === "search" && (
            <div className="space-y-6">
              {rptSearchStep === 1 && (
                <>
                  <div className="rpt-main-shell p-5 sm:p-6 mt-2">
                    <div className="mb-5">
                      <button
                        type="button"
                        onClick={() => window.history.back()}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer inline-block border-0"
                      >
                        &larr; Back to Previous Page
                      </button>
                    </div>

                    <div className="rpt-nav-row border-b pb-4 flex items-center gap-6">
                      <button
                        type="button"
                        onClick={() => setIsServiceRequestModalOpen(true)}
                        className="rpt-nav-button cursor-pointer"
                      >
                        NEW SERVICE REQUEST
                      </button>
                    </div>

                    <div className="rpt-divider border-b pb-5 pt-5">
                      <p className="rpt-title uppercase">RPT PAYMENT / AMILYAR</p>
                    </div>

                    {searchError && (
                      <div className="mt-4 p-3 border border-white text-white text-[10px] font-bold">
                        {searchError}
                      </div>
                    )}

                    <form onSubmit={handleExecuteTdnSearch} className="mt-5">
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.2fr_auto_1fr] gap-x-6 gap-y-4 items-end">
                        <div>
                          <label className="rpt-label block mb-1.5">
                            Search By:
                          </label>
                          <select
                            value={searchType}
                            onChange={(e) => setSearchType(e.target.value)}
                            className="rpt-field w-full px-3 outline-none"
                          >
                            <option value="Tax Declaration No. (TDN)">TDN</option>
                            <option value="Property Owner">Owner</option>
                            <option value="Property Identification No. (PIN)">PIN</option>
                          </select>
                        </div>

                        <div>
                          <label className="rpt-label block mb-1.5">
                            TDN:
                          </label>
                          <input
                            type="text"
                            required
                            value={searchTdnInput}
                            onChange={(e) => setSearchTdnInput(e.target.value.toUpperCase())}
                            placeholder="____________"
                            className="rpt-field w-full px-3 uppercase"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={isSearchingTdn}
                          className="rpt-action px-4 disabled:opacity-50 cursor-pointer"
                        >
                          {isSearchingTdn ? "Searching..." : "Search"}
                        </button>

                        <div>
                          <label className="rpt-label block mb-1.5">
                            Year:
                          </label>
                          <select
                            value={assessmentYear}
                            onChange={(e) => setAssessmentYear(e.target.value)}
                            className="rpt-field w-full px-3 outline-none"
                          >
                            <option>All Years</option>
                            <option>2026</option>
                            <option>2025</option>
                            <option>2024</option>
                            <option>2023</option>
                          </select>
                        </div>
                      </div>
                    </form>

                    <div className="overflow-x-auto border border-white mt-6 rpt-table">
                      <table className="w-full min-w-[760px] text-left border-collapse rpt-table">
                        <thead className="text-white font-black uppercase">
                          <tr>
                            <th>TDN</th>
                            <th>OWNER</th>
                            <th>LOCATION</th>
                            <th>YEAR</th>
                            <th>ASSESSED</th>
                            <th>TAX DUE</th>
                            <th>STATUS</th>
                            <th>VIEW</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {associatedProperties.length > 0 ? (
                            associatedProperties
                              .filter((property) => assessmentYear === "All Years" || String(property.billingYear) === assessmentYear)
                              .map((property) => {
                                const matchedApp = getAppForTdn(property.taxDeclarationNumber);
                                return (
                                  <tr key={property.taxDeclarationNumber} className="hover:bg-slate-50 transition">
                                    <td className="font-mono font-black">{property.taxDeclarationNumber}</td>
                                    <td className="font-bold">{property.ownerName}</td>
                                    <td>{property.propertyLocation || property.barangay || "—"}</td>
                                    <td>{property.billingYear || "—"}</td>
                                    <td className="font-bold">{formatCurrency(property.assessedValue)}</td>
                                    <td className="font-bold">{formatCurrency(property.balance || property.totalAssessment)}</td>
                                    <td>
                                      {matchedApp ? (
                                        <div className="flex items-center gap-2">
                                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${getAppStatusBadgeClass(matchedApp.status)}`}>
                                            {matchedApp.status}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => setSelectedAppDetail(matchedApp)}
                                            className="rpt-link cursor-pointer text-[10px]"
                                          >
                                            View Details
                                          </button>
                                        </div>
                                      ) : (
                                        <span className="text-[10px] text-slate-400 italic">No Application</span>
                                      )}
                                    </td>
                                    <td>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedTdnIds(new Set([property.taxDeclarationNumber]));
                                          setRptSearchStep(2);
                                        }}
                                        className="rpt-link cursor-pointer"
                                      >
                                        VIEW
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })
                          ) : (
                            <tr>
                              <td colSpan={8} className="px-4 py-10 text-center rpt-empty italic">
                                Search for a Tax Declaration Number to view real property tax records.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="hidden">
                      <span>Page 1 of 1</span>
                      <div className="flex gap-2">
                        <button type="button" disabled className="px-3 py-1.5 rounded-md border border-slate-200 text-slate-300">
                          Previous
                        </button>
                        <button type="button" disabled className="px-3 py-1.5 rounded-md border border-slate-200 text-slate-300">
                          Next
                        </button>
                      </div>
                    </div>

                    <div className="hidden">
                      <p className="font-bold text-[#0B3B60] mb-2 flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600">i</span>
                        How to search:
                      </p>
                      <ol className="list-decimal ml-5 space-y-1">
                        <li>Select a search type and enter the Tax Declaration Number (TDN) of your property.</li>
                        <li>Choose the assessment year or leave it as All Years to filter results.</li>
                        <li>Click the Search button to query the real property tax records.</li>
                        <li>Click View to continue to the property assessment, payment options, and official receipt records.</li>
                      </ol>
                    </div>
                  </div>
                </>
              )}

              {rptSearchStep === 2 && (
                <div className="rpt-main-shell p-6 sm:p-8 space-y-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                    <div>
                      <button
                        onClick={() => setRptSearchStep(1)}
                        className="text-xs font-bold text-[#0284C7] hover:underline flex items-center gap-1 cursor-pointer mb-2"
                      >
                        &lt; GO BACK TO SEARCH
                      </button>
                      <h2 className="text-lg font-extrabold text-[#0B3B60]">Possible properties you might own</h2>
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                        <span>ℹ️</span>
                        <span>Here is the list of other Tax Declaration Numbers (TDNs) in relation to the TDN that you entered.</span>
                      </p>
                    </div>

                    <div className="text-right bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold text-slate-700">
                      <span>Selected TDN: <span className="text-[#0B3B60] font-black">{selectedTdnIds.size}</span></span>
                      <span className="mx-2 text-slate-300">|</span>
                      <span>Unselected TDN: <span className="text-rose-600 font-black">{unselectedTdns.length}</span></span>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#F8FAFC] text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-4 w-12 text-center">
                            <input
                              type="checkbox"
                              checked={selectedTdnIds.size === associatedProperties.length && associatedProperties.length > 0}
                              onChange={toggleSelectAllTdns}
                              className="size-4 accent-[#0B3B60] rounded cursor-pointer"
                            />
                          </th>
                          <th className="p-4">Tax Declaration No.</th>
                          <th className="p-4">Name of Owner</th>
                          <th className="p-4">Bill Expiry Date</th>
                          <th className="p-4">NewPSPIN</th>
                          <th className="p-4">Type</th>
                          <th className="p-4 text-right">Assessment Due</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {associatedProperties.map((prop) => {
                          const isSelected = selectedTdnIds.has(prop.taxDeclarationNumber);
                          return (
                            <tr key={prop.taxDeclarationNumber} className={`hover:bg-slate-50 transition ${isSelected ? "bg-sky-50/40" : ""}`}>
                              <td className="p-4 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleTdnSelection(prop.taxDeclarationNumber)}
                                  className="size-4 accent-[#0B3B60] rounded cursor-pointer"
                                />
                              </td>
                              <td className="p-4 font-mono font-extrabold text-[#0B3B60]">
                                {prop.taxDeclarationNumber}
                              </td>
                              <td className="p-4 font-semibold text-slate-800">
                                {prop.ownerName}
                              </td>
                              <td className="p-4 font-mono text-slate-600">
                                {prop.billExpiryDate}
                              </td>
                              <td className="p-4 font-mono text-slate-600">
                                {prop.newPspin}
                              </td>
                              <td className="p-4">
                                <span className="bg-slate-100 text-slate-700 font-bold px-2.5 py-1 rounded-lg text-[10px]">
                                  {prop.propertyType}
                                </span>
                              </td>
                              <td className="p-4 text-right font-mono font-bold text-slate-900">
                                {formatCurrency(prop.balance || prop.totalAssessment || 1020)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button
                      onClick={handleProceedToPaymentOptions}
                      className="bg-[#DC2626] hover:bg-red-700 text-white font-extrabold px-8 py-3.5 rounded-2xl text-xs uppercase tracking-wider transition shadow-md cursor-pointer flex items-center gap-2"
                    >
                      <span>GO TO PAYMENT OPTION</span>
                      <span>&gt;</span>
                    </button>
                  </div>
                </div>
              )}

              {rptSearchStep === 3 && (
                <div className="rpt-main-shell p-6 sm:p-8 space-y-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                    <div>
                      <button
                        onClick={() => setRptSearchStep(2)}
                        className="text-xs font-bold text-[#0284C7] hover:underline flex items-center gap-1 cursor-pointer mb-2"
                      >
                        &lt; GO BACK TO GROUP BILL SET
                      </button>
                      <h2 className="text-lg font-extrabold text-[#0B3B60] uppercase tracking-wide">
                        SELECTED TAX DECLARATION NUMBER(S):
                      </h2>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setRptSearchStep(2)}
                        className="bg-[#0B3B60] hover:bg-[#082944] text-white font-bold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer"
                      >
                        Edit Selected TDN(s)
                      </button>
                      <button
                        onClick={handleAddToCart}
                        className="bg-[#DC2626] hover:bg-red-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition shadow-md cursor-pointer flex items-center gap-1.5"
                      >
                        <span>🛒 Add to Cart</span>
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#F8FAFC] text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-4">Tax Declaration No.</th>
                          <th className="p-4">Name of Owner</th>
                          <th className="p-4">Payment Option</th>
                          <th className="p-4">Payable Amount</th>
                          <th className="p-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {selectedPropertiesList.map((prop) => (
                          <tr key={prop.taxDeclarationNumber} className="hover:bg-slate-50 transition">
                            <td className="p-4 font-mono font-extrabold text-[#0B3B60]">
                              {prop.taxDeclarationNumber}
                            </td>
                            <td className="p-4 font-semibold text-slate-800">
                              {prop.ownerName}
                            </td>
                            <td className="p-4">
                              <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-lg text-xs font-bold">
                                <span>✓</span>
                                <span>
                                  {prop.selectedPaymentOption === "Quarterly" ? "Quarterly (Q1-Q4)" : "Full Payment (Annual)"}
                                </span>
                              </span>
                            </td>
                            <td className="p-4 font-mono font-extrabold text-slate-900">
                              {formatCurrency(prop.computedPayableAmount || prop.balance || 1020)}
                            </td>
                            <td className="p-4 text-right">
                              <button
                                onClick={() => openPaymentOptionModal(prop)}
                                className="text-xs font-bold text-[#0284C7] hover:text-sky-800 hover:underline cursor-pointer flex items-center gap-1 justify-end ml-auto"
                              >
                                <span>✏️</span>
                                <span>Select Payment Option</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-50 border border-slate-200 p-5 rounded-2xl gap-4">
                    <div>
                      <p className="text-xs text-slate-500 font-semibold">Group Bill Set Total Assessment</p>
                      <p className="text-2xl font-black text-[#0B3B60]">
                        {formatCurrency(
                          selectedPropertiesList.reduce((sum, p) => sum + (p.computedPayableAmount || p.balance || 1020), 0)
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <button
                        onClick={handleAddToCart}
                        className="w-full sm:w-auto bg-[#DC2626] hover:bg-red-700 text-white font-extrabold px-8 py-3.5 rounded-2xl text-xs uppercase tracking-wider transition shadow-md cursor-pointer"
                      >
                        Add To Cart &amp; Proceed to Checkout →
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {isServiceRequestModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
              <div className="relative bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-8">
                <button
                  type="button"
                  onClick={() => setIsServiceRequestModalOpen(false)}
                  aria-label="Close"
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 font-bold text-lg cursor-pointer"
                >
                  ✕
                </button>

                <div className="border-b border-slate-200 pb-4 pr-8">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#0284C7]">OFFICE OF THE CITY ASSESSOR</p>
                  <h2 className="text-2xl font-extrabold text-[#0B3B60]">Real Property Tax Service Request</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Submit a declaration, transfer of ownership, property reclassification, or correction directly for assessor evaluation.
                  </p>
                </div>

                {appNotice && (
                  <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl text-sky-900 text-xs font-bold">
                    {appNotice}
                  </div>
                )}

                <form onSubmit={handleAppSubmit} className="space-y-8">
                  <div>
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2 mb-4">
                      1. Transaction Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1.5">
                        <label className="font-bold text-slate-700">Requested LGU Service *</label>
                        <select
                          value={appForm.service}
                          onChange={(e) => setAppForm({ ...appForm, service: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold focus:ring-2 focus:ring-[#0284C7] outline-none"
                        >
                          {services.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="font-bold text-slate-700">Applying As *</label>
                        <select
                          value={appForm.applicantType}
                          onChange={(e) => setAppForm({ ...appForm, applicantType: e.target.value as ApplicantType })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold focus:ring-2 focus:ring-[#0284C7] outline-none"
                        >
                          <option value="Property Owner">Property Owner</option>
                          <option value="Authorized Representative">Authorized Representative</option>
                          <option value="Corporation / Company">Corporation / Company</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2 mb-4">
                      2. Applicant &amp; Owner Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div className="space-y-1.5">
                        <label className="font-bold text-slate-700">Owner Name / Company *</label>
                        <input
                          type="text"
                          required
                          value={appForm.ownerName}
                          onChange={(e) => setAppForm({ ...appForm, ownerName: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold focus:ring-2 focus:ring-[#0284C7] outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="font-bold text-slate-700">Applicant Full Name *</label>
                        <input
                          type="text"
                          required
                          value={appForm.applicantName}
                          onChange={(e) => setAppForm({ ...appForm, applicantName: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold focus:ring-2 focus:ring-[#0284C7] outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="font-bold text-slate-700">Email Address *</label>
                        <input
                          type="email"
                          required
                          value={appForm.email}
                          onChange={(e) => setAppForm({ ...appForm, email: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold focus:ring-2 focus:ring-[#0284C7] outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="font-bold text-slate-700">Mobile Number (PH) *</label>
                        <input
                          type="tel"
                          inputMode="numeric"
                          required
                          maxLength={11}
                          pattern="[0-9]{11}"
                          placeholder="09171234567"
                          value={appForm.mobileNumber}
                          onChange={(e) =>
                            setAppForm({
                              ...appForm,
                              mobileNumber: e.target.value.replace(/\D/g, "").slice(0, 11),
                            })
                          }
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold focus:ring-2 focus:ring-[#0284C7] outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="font-bold text-slate-700">TIN Number</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={14}
                          pattern="[0-9]{9,14}"
                          placeholder="00000000000000"
                          value={appForm.tin}
                          onChange={(e) =>
                            setAppForm({
                              ...appForm,
                              tin: e.target.value.replace(/\D/g, "").slice(0, 14),
                            })
                          }
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold focus:ring-2 focus:ring-[#0284C7] outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2 mb-4">
                      3. Real Property Location &amp; Classification
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div className="space-y-1.5">
                        <label className="font-bold text-slate-700">Tax Declaration No. (if existing)</label>
                        <input
                          type="text"
                          placeholder="e.g. F-021-01491"
                          value={appForm.taxDeclarationNumber}
                          onChange={(e) => setAppForm({ ...appForm, taxDeclarationNumber: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold focus:ring-2 focus:ring-[#0284C7] outline-none font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="font-bold text-slate-700">Property Type *</label>
                        <select
                          value={appForm.propertyType}
                          onChange={(e) => setAppForm({ ...appForm, propertyType: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold focus:ring-2 focus:ring-[#0284C7] outline-none"
                        >
                          <option value="Residential">Residential</option>
                          <option value="Commercial">Commercial</option>
                          <option value="Industrial">Industrial</option>
                          <option value="Agricultural">Agricultural</option>
                          <option value="Special">Special / Institutional</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="font-bold text-slate-700">Barangay *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Central, Diliman, Batasan"
                          value={appForm.barangay}
                          onChange={(e) => setAppForm({ ...appForm, barangay: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold focus:ring-2 focus:ring-[#0284C7] outline-none"
                        />
                      </div>
                      <div className="md:col-span-3 space-y-1.5">
                        <label className="font-bold text-slate-700">Complete Property Location Address *</label>
                        <input
                          type="text"
                          required
                          placeholder="House / Lot No., Street, Subdivision, Quezon City"
                          value={appForm.propertyLocation}
                          onChange={(e) => setAppForm({ ...appForm, propertyLocation: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold focus:ring-2 focus:ring-[#0284C7] outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2 mb-4">
                      4. Documentary Requirements (PDF / Images)
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                        <span className="font-bold text-slate-800 block">Proof of Ownership *</span>
                        <p className="text-[10px] text-slate-500">Deed of Absolute Sale, Transfer Certificate of Title (TCT)</p>
                        <input
                          type="file"
                          required
                          accept="image/*,.pdf"
                          onChange={(e) => handleAppFileChange(e, "ownershipProof")}
                          className="text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#0B3B60] file:text-white cursor-pointer"
                        />
                        {appDocuments.ownershipProof.name && (
                          <p className="text-[11px] font-mono text-emerald-700 font-bold">✓ {appDocuments.ownershipProof.name}</p>
                        )}
                      </div>

                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                        <span className="font-bold text-slate-800 block">Valid Government ID *</span>
                        <p className="text-[10px] text-slate-500">Passport, UMID, Driver's License of Owner/Applicant</p>
                        <input
                          type="file"
                          required
                          accept="image/*,.pdf"
                          onChange={(e) => handleAppFileChange(e, "validId")}
                          className="text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#0B3B60] file:text-white cursor-pointer"
                        />
                        {appDocuments.validId.name && (
                          <p className="text-[11px] font-mono text-emerald-700 font-bold">✓ {appDocuments.validId.name}</p>
                        )}
                      </div>

                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                        <span className="font-bold text-slate-800 block">Latest Tax Receipt / Tax Dec</span>
                        <p className="text-[10px] text-slate-500">Official Receipt or Copy of Previous Assessment</p>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => handleAppFileChange(e, "taxRecord")}
                          className="text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#0B3B60] file:text-white cursor-pointer"
                        />
                        {appDocuments.taxRecord.name && (
                          <p className="text-[11px] font-mono text-emerald-700 font-bold">✓ {appDocuments.taxRecord.name}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button
                      type="submit"
                      disabled={isSubmittingApp}
                      className="bg-[#0B3B60] hover:bg-[#082944] disabled:opacity-50 text-white font-extrabold px-8 py-3.5 rounded-2xl text-xs uppercase tracking-wider transition shadow-md cursor-pointer"
                    >
                      {isSubmittingApp ? "Submitting Application..." : "Submit to City Assessor →"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}



          {activePortalTab === "summary" && (
            <div className="rpt-main-shell p-6 sm:p-8 space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <h2 className="text-xl font-extrabold text-[#0B3B60]">Real Property Tax Clearance &amp; Electronic Receipts</h2>
                <p className="text-xs text-slate-500 mt-1">
                  View and download electronic Official Receipts (eOR) and Real Property Tax Clearance certificates.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-6 bg-emerald-50/60 border border-emerald-200 rounded-3xl space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-200/60 px-2.5 py-1 rounded-lg">
                    OFFICIAL LGU TAX CLEARANCE
                  </span>
                  <h3 className="text-base font-extrabold text-emerald-950">Property Tax Status Verified</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    All settled Real Property Taxes are officially transmitted to the Local Government Unit Revenue Repository and recognized by banks, registries, and city assessors.
                  </p>
                  <button
                    onClick={() => showToast("Downloading certified Real Property Tax clearance...", "info")}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer shadow-sm"
                  >
                    Download Clearance Certificate (PDF)
                  </button>
                </div>

                <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 bg-slate-200 px-2.5 py-1 rounded-lg">
                    ONLINE AMILYAR SUPPORT
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900">Need Help with Your Group Bill Set?</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    If your property TDN is missing or if you have questions regarding Socialized Housing Tax Credits (SHTTC), email the City Treasurer's Office at <strong>rptpayment@quezoncity.gov.ph</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="hidden"><UnifiedFooter /></div>

      {isOwnerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-8 max-w-md w-full shadow-2xl text-center space-y-6">
            <div className="size-16 rounded-full border-2 border-sky-400 text-sky-500 flex items-center justify-center text-3xl font-light mx-auto">
              ?
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                Please verify that you are paying the RPT for :
              </p>
              <h3 className="text-base font-black text-slate-900 uppercase tracking-wide">
                {verifiedOwnerName}
              </h3>
            </div>

            <div className="flex items-center justify-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => handleConfirmOwnerVerification(true)}
                className="w-28 bg-[#0284C7] hover:bg-sky-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-md transition cursor-pointer"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => handleConfirmOwnerVerification(false)}
                className="w-28 bg-white hover:bg-slate-100 text-[#D97706] border border-[#D97706] font-bold py-2.5 px-4 rounded-xl text-xs transition cursor-pointer"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {isUnselectedWarningOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-8 max-w-md w-full shadow-2xl text-center space-y-5">
            <div className="size-14 rounded-full border-2 border-sky-400 text-sky-500 flex items-center justify-center text-2xl font-bold mx-auto">
              i
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-900">Info</h3>
              <p className="text-xs text-slate-600">
                Not all associated Tax Declaration Numbers (TDNs) were selected.
              </p>
            </div>

            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-left space-y-1">
              <span className="text-[11px] font-bold text-rose-700 block">Unselected TDNs:</span>
              <p className="text-xs font-mono font-bold text-rose-600">{unselectedTdns.join(", ")}</p>
            </div>

            <label className="flex items-center gap-2.5 text-left text-xs text-slate-700 font-semibold cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasAcknowledgedUnselected}
                onChange={(e) => setHasAcknowledgedUnselected(e.target.checked)}
                className="size-4 accent-[#0B3B60] rounded cursor-pointer"
              />
              <span>I acknowledge that I have reviewed the properties that may be under my ownership.</span>
            </label>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsUnselectedWarningOpen(false)}
                className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold py-2.5 px-4 rounded-xl text-xs transition cursor-pointer"
              >
                Edit Selected TDN
              </button>
              <button
                type="button"
                disabled={!hasAcknowledgedUnselected}
                onClick={handleConfirmUnselectedProceed}
                className="bg-[#0B3B60] hover:bg-[#082944] disabled:opacity-40 text-white font-bold py-2.5 px-6 rounded-xl text-xs transition shadow-md cursor-pointer"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {isOptionModalOpen && activeConfiguringTdn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-[#0B3B60]">
                  CHOOSE A PAYMENT OPTION ({activeConfiguringTdn.taxDeclarationNumber}):
                </h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  Bill Coverage: 2025(Q1) - 2025(Q4)
                </p>
              </div>
              <button
                onClick={() => setIsOptionModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <div
                onClick={() => setTempOptionChoice("Quarterly")}
                className={`p-5 rounded-2xl border-2 transition cursor-pointer space-y-3 ${tempOptionChoice === "Quarterly"
                  ? "border-[#0284C7] bg-sky-50/40 shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-[#0B3B60]">
                    PAYMENT OPTION 1: QUARTERLY
                  </span>
                  <input
                    type="radio"
                    name="optionChoice"
                    checked={tempOptionChoice === "Quarterly"}
                    onChange={() => setTempOptionChoice("Quarterly")}
                    className="size-4 accent-[#0284C7] cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                  <div className="flex justify-between">
                    <span>AMOUNT DUE:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {formatCurrency((activeConfiguringTdn.totalAssessment || 1020) / 4)} / Qtr
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>* SHTTC APPLIED:</span>
                    <span>-₱0.00</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>* DISCOUNT:</span>
                    <span>-₱0.00</span>
                  </div>
                  <div className="flex justify-between font-black text-slate-900 border-t pt-2">
                    <span>TOTAL:</span>
                    <span className="font-mono text-[#0B3B60]">
                      {formatCurrency(
                        ((activeConfiguringTdn.totalAssessment || 1020) / 4) *
                        (Object.values(tempQuarterSelection).filter(Boolean).length || 1)
                      )}
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Select Quarters:</span>
                  <div className="grid grid-cols-4 gap-1 text-center">
                    {(["q1", "q2", "q3", "q4"] as const).map((q) => (
                      <label
                        key={q}
                        className={`p-1.5 rounded-lg border text-[11px] font-mono font-bold cursor-pointer transition ${tempQuarterSelection[q] ? "bg-[#0B3B60] text-white border-[#0B3B60]" : "bg-slate-50 text-slate-600 border-slate-200"
                          }`}
                      >
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={tempQuarterSelection[q]}
                          onChange={(e) =>
                            setTempQuarterSelection({ ...tempQuarterSelection, [q]: e.target.checked })
                          }
                        />
                        {q.toUpperCase()}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div
                onClick={() => setTempOptionChoice("Full")}
                className={`p-5 rounded-2xl border-2 transition cursor-pointer space-y-3 ${tempOptionChoice === "Full"
                  ? "border-[#0284C7] bg-sky-50/40 shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-[#0B3B60]">
                    PAYMENT OPTION 2: FULL
                  </span>
                  <input
                    type="radio"
                    name="optionChoice"
                    checked={tempOptionChoice === "Full"}
                    onChange={() => setTempOptionChoice("Full")}
                    className="size-4 accent-[#0284C7] cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                  <div className="flex justify-between">
                    <span>AMOUNT DUE:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {formatCurrency(activeConfiguringTdn.basicTax + activeConfiguringTdn.sefTax || 1020.0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>* SHTTC APPLIED:</span>
                    <span>-₱0.00</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>* DISCOUNT:</span>
                    <span>-₱0.00</span>
                  </div>
                  {activeConfiguringTdn.penalty > 0 && (
                    <div className="flex justify-between text-[11px] text-rose-600 font-bold">
                      <span>* PENALTY FEE:</span>
                      <span>+({formatCurrency(activeConfiguringTdn.penalty)})</span>
                    </div>
                  )}
                  <div className="flex justify-between font-black text-slate-900 border-t pt-2">
                    <span>TOTAL:</span>
                    <span className="font-mono text-[#0B3B60]">
                      {formatCurrency(activeConfiguringTdn.balance || activeConfiguringTdn.totalAssessment || 1127.1)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsOptionModalOpen(false)}
                className="w-32 bg-white hover:bg-slate-100 text-rose-600 border border-rose-300 font-bold py-2.5 px-4 rounded-xl text-xs transition cursor-pointer"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleConfirmPaymentOptionModal}
                className="w-36 bg-[#DC2626] hover:bg-red-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs transition shadow-md cursor-pointer"
              >
                CONFIRM
              </button>
            </div>
          </div>
        </div>
      )}

      {isGroupApplyConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-8 max-w-md w-full shadow-2xl text-center space-y-6">
            <div className="size-16 rounded-full border-2 border-sky-400 text-sky-500 flex items-center justify-center text-3xl font-light mx-auto">
              ?
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-900">Confirmation</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Would you like to apply this payment option to all TDNs included in the Group Bill Set?
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => applyOptionSettingsToTdns(true)}
                className="w-full sm:w-auto bg-[#0284C7] hover:bg-sky-700 text-white font-bold py-2.5 px-5 rounded-xl text-xs transition shadow-md cursor-pointer"
              >
                Yes, apply to all
              </button>
              <button
                type="button"
                onClick={() => applyOptionSettingsToTdns(false)}
                className="w-full sm:w-auto bg-[#0B3B60] hover:bg-[#082944] text-white font-bold py-2.5 px-5 rounded-xl text-xs transition cursor-pointer"
              >
                No, apply to this TDN only
              </button>
            </div>
          </div>
        </div>
      )}

      {isSuccessFeedbackOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-8 max-w-sm w-full shadow-2xl text-center space-y-5">
            <div className="size-16 rounded-full border-2 border-emerald-400 text-emerald-500 flex items-center justify-center text-3xl font-light mx-auto">
              ✓
            </div>

            <h3 className="text-base font-extrabold text-slate-900">
              {successFeedbackMessage}
            </h3>

            <div>
              <button
                type="button"
                onClick={() => setIsSuccessFeedbackOpen(false)}
                className="w-28 bg-[#0B3B60] hover:bg-[#082944] text-white font-bold py-2.5 px-6 rounded-xl text-xs transition shadow-md cursor-pointer"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-extrabold text-[#0B3B60]">
                🛒 My Cart - Group Bill Set ({cart.length} Properties)
              </h3>
              <button
                onClick={() => setIsCartOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs italic bg-slate-50 rounded-2xl">
                Your cart is empty. Select TDNs to add them here.
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1 text-xs">
                    <div className="flex justify-between items-center font-bold">
                      <span className="text-[#0B3B60] font-mono">{item.tdn}</span>
                      <span className="font-mono text-slate-900">{formatCurrency(item.totalPayable)}</span>
                    </div>
                    <p className="text-slate-600">{item.ownerName} • {item.propertyType}</p>
                    <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                      <span>Coverage: {item.billCoverage}</span>
                      <span className="font-semibold">{item.paymentOption}</span>
                    </div>
                  </div>
                ))}

                <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl space-y-1">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Total Assessed Tax Due:</span>
                    <span className="font-mono font-bold">{formatCurrency(grandCartTotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Convenience / Processing Fee:</span>
                    <span className="font-mono font-bold text-emerald-700">₱0.00 (Waived)</span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-[#0B3B60] pt-2 border-t border-sky-200">
                    <span>GRAND TOTAL PAYABLE:</span>
                    <span className="font-mono">{formatCurrency(grandCartTotal)}</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => handleExecuteGroupCheckout("PayMongo")}
                    disabled={isCheckingOut}
                    className="w-full bg-[#0284C7] hover:bg-sky-700 text-white font-extrabold py-3.5 px-4 rounded-2xl text-xs uppercase tracking-wider transition shadow-md cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>▣ Pay via PayMongo QR Ph</span>
                  </button>
                  <button
                    onClick={() => handleExecuteGroupCheckout("DirectSimulated")}
                    disabled={isCheckingOut}
                    className="w-full bg-[#0B3B60] hover:bg-[#082944] text-white font-extrabold py-3.5 px-4 rounded-2xl text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>Instant Electronic LGU Settlement</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isQrPaymentOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-5xl max-h-[96vh] shadow-2xl border border-slate-200 overflow-y-auto my-auto">
            <div className="px-6 sm:px-8 py-5 border-b border-slate-200">
              <h3 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">Real Property Tax Payment</h3>
              <p className="text-xs text-slate-500 mt-1">PayMongo Secure Checkout</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2">
              <div className="p-6 sm:p-8 border-b lg:border-b-0 lg:border-r border-slate-200">
                <div className="mb-6">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Payment Summary</p>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">Real Property Tax Payment</h2>
                  <p className="text-sm text-slate-500 mt-2">{cart.length} {cart.length === 1 ? 'property' : 'properties'} selected for payment</p>
                </div>

                <div className="text-4xl sm:text-5xl font-black text-emerald-600 tracking-tight">
                  {formatCurrency(grandCartTotal)}
                </div>
                <p className="text-xs text-slate-500 mt-2">Billed to {currentUser?.fullname || cart[0]?.ownerName || 'Taxpayer'}, {currentUser?.email || 'citizen@gov.ph'}</p>

                <div className="mt-7 border-t border-slate-200 pt-5 space-y-4 text-sm">
                  <div className="flex justify-between gap-4 text-slate-600">
                    <span>Subtotal</span>
                    <span className="font-bold text-slate-900">{formatCurrency(grandCartTotal)}</span>
                  </div>
                  <div className="flex justify-between gap-4 text-slate-600">
                    <span>Fees</span>
                    <span className="font-semibold text-slate-900">Free</span>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-slate-200 pt-5">
                    <span className="font-black text-slate-900">Total Due</span>
                    <span className="font-black text-xl text-slate-900">{formatCurrency(grandCartTotal)}</span>
                  </div>
                </div>

                <div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-lg">✓</span>
                    <div>
                      <p className="text-sm font-black text-emerald-900">Secure Payment</p>
                      <p className="text-xs text-emerald-700 mt-1">Your payment is secured by PayMongo.</p>
                    </div>
                  </div>
                  <p className="text-xs text-emerald-700 mt-3 pl-12">We do not store your payment details.</p>
                </div>
              </div>

              <div className="p-4 sm:p-6 lg:p-8 bg-slate-50/60 flex flex-col items-center min-w-0">
                <div className="w-full text-center">
                  <p className="text-lg font-black text-slate-900 uppercase tracking-tight">Scan QR Ph code to pay</p>
                  <p className="text-xs text-slate-500 mt-1">Use your supported banking or e-wallet app.</p>
                </div>

                {isGeneratingQr && !rptQrCodeUrl && (
                  <div className="w-full max-w-sm mt-6 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-10 text-center">
                    <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-700 rounded-full animate-spin mx-auto mb-4" />
                    <p className="font-bold text-slate-800 text-sm">Generating your QR Ph code...</p>
                    <p className="text-xs text-slate-500 mt-1">Please wait while PayMongo prepares your secure payment.</p>
                  </div>
                )}

                {!isGeneratingQr && rptQrError && !rptQrCodeUrl && (
                  <div className="w-full max-w-sm mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center">
                    <p className="text-xs font-bold text-rose-700">{rptQrError}</p>
                    <button type="button" onClick={() => void generateRPTQrPayment()} className="mt-4 px-4 py-2.5 bg-[#0B3B60] hover:bg-[#082944] text-white rounded-xl text-xs font-bold">Generate QR Again</button>
                  </div>
                )}

                {rptQrPaid && (
                  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-hidden">
                    <style>{`
                      @keyframes rptSuccessPop { 0% { opacity: 0; transform: scale(.72) translateY(25px); } 70% { opacity: 1; transform: scale(1.04); } 100% { opacity: 1; transform: scale(1); } }
                      @keyframes rptSuccessCheck { 0% { transform: scale(0) rotate(-45deg); opacity: 0; } 70% { transform: scale(1.15) rotate(0); opacity: 1; } 100% { transform: scale(1); } }
                      @keyframes rptConfettiFall { 0% { transform: translateY(-25px) rotate(0); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(420px) rotate(360deg); opacity: 0; } }
                      .rpt-success-card { animation: rptSuccessPop .55s cubic-bezier(.2,.8,.2,1) both; }
                      .rpt-success-check { animation: rptSuccessCheck .65s cubic-bezier(.2,.8,.2,1) .15s both; }
                      .rpt-payment-confetti { animation: rptConfettiFall 2.7s linear infinite; }
                    `}</style>
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                      {Array.from({ length: 24 }).map((_, i) => (
                        <span key={i} className="rpt-payment-confetti absolute top-[-20px] h-2.5 w-2.5 rounded-sm" style={{ left: `${(i * 41) % 100}%`, animationDelay: `${(i % 8) * 0.18}s`, background: ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'][i % 5] }} />
                      ))}
                    </div>
                    <div className="rpt-success-card relative w-full max-w-md rounded-[2rem] bg-white shadow-2xl border border-emerald-100 overflow-hidden text-center">
                      <div className="absolute top-0 left-0 right-0 h-2 bg-emerald-500" />
                      <div className="p-7 sm:p-9">
                        <div className="rpt-success-check mx-auto mb-5 h-24 w-24 rounded-full bg-emerald-100 border-8 border-white shadow-lg flex items-center justify-center">
                          <div className="h-16 w-16 rounded-full bg-emerald-500 text-white flex items-center justify-center text-4xl font-black">✓</div>
                        </div>
                        <p className="text-2xl sm:text-3xl font-black text-emerald-700">Payment Successful!</p>
                        <p className="text-sm text-slate-600 mt-2">Your Real Property Tax payment has been successfully confirmed.</p>
                        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left space-y-3">
                          <div className="flex justify-between gap-4 text-sm"><span className="text-slate-500">Properties Paid</span><span className="font-bold text-slate-900">{cart.length}</span></div>
                          <div className="flex justify-between gap-4 text-sm"><span className="text-slate-500">Amount Paid</span><span className="font-black text-emerald-700">{formatCurrency(grandCartTotal)}</span></div>
                          <div className="flex justify-between gap-4 text-sm"><span className="text-slate-500">Payment Method</span><span className="font-bold text-slate-900">PayMongo (QR Ph)</span></div>
                        </div>
                        <div className="mt-5 rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-left">
                          <p className="font-black text-emerald-800">🎉 Thank you!</p>
                          <p className="text-xs text-emerald-700 mt-1">Your RPT payment has been recorded and your property records are being updated.</p>
                        </div>
                        <button type="button" onClick={closeRPTQrPayment} className="mt-6 w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 font-black text-sm transition-all shadow-lg shadow-emerald-200">View My RPT Records →</button>
                        <p className="text-[11px] text-slate-400 mt-3">This window will close automatically in <span className="font-black text-emerald-600">{rptPaymentSuccessCountdown}</span> seconds.</p>
                      </div>
                    </div>
                  </div>
                )}

                {rptQrCodeUrl && !rptQrPaid && (
                  <div className="w-full max-w-sm mt-6 flex flex-col items-center">
                    <div className={`w-full rounded-xl border px-4 py-3 text-center mb-4 ${rptQrSecondsRemaining <= 30 ? 'border-rose-200 bg-rose-50' : 'border-blue-200 bg-blue-50'}`}>
                      <p className={`text-[10px] font-black uppercase tracking-widest ${rptQrSecondsRemaining <= 30 ? 'text-rose-600' : 'text-blue-700'}`}>QR code refreshes in</p>
                      <p className={`text-2xl font-black tabular-nums mt-1 ${rptQrSecondsRemaining <= 30 ? 'text-rose-700' : 'text-blue-700'}`}>
                        {Math.floor(rptQrSecondsRemaining / 60)}:{String(rptQrSecondsRemaining % 60).padStart(2, '0')}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">A new QR code will be generated automatically when the timer expires.</p>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-md max-w-full">
                      <img src={rptQrCodeUrl} alt="PayMongo Dynamic QR Ph payment code" className="w-56 h-56 sm:w-64 sm:h-64 object-contain" />
                    </div>

                    <p className="text-xs text-slate-500 text-center mt-4 max-w-sm">Complete the payment by scanning the QR code. Payment confirmation is handled automatically by PayMongo.</p>

                    <div className="w-full mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-left">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-600 text-white text-xs font-black">i</span>
                        <p className="text-xs font-black text-sky-900">How to pay with QR Ph</p>
                      </div>
                      <p className="text-[10px] leading-relaxed text-slate-600">Scan this QR Ph using a participating Philippine bank or e-wallet app. Depending on your provider, supported apps may include GCash, Maya, BPI, BDO, UnionBank, RCBC, LandBank, Metrobank, PNB, Security Bank, and other participating QR Ph institutions.</p>
                      <p className="text-[10px] leading-relaxed text-slate-500 mt-2"><strong>Tip:</strong> Before confirming, check that the amount shown in your banking or e-wallet app matches the Total Due.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 sm:px-8 py-4 border-t border-slate-200 bg-white">
              <button type="button" onClick={closeRPTQrPayment} disabled={isGeneratingQr} className="w-full sm:max-w-xs sm:ml-auto py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl disabled:opacity-50">Close</button>
            </div>
          </div>
        </div>
      )}

      {isReceiptModalOpen && issuedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-8 max-w-lg w-full shadow-2xl space-y-6 text-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="text-center space-y-1 border-b border-slate-200 pb-4">
              <span className="text-[10px] font-black tracking-widest text-[#0B3B60] uppercase">
                REPUBLIC OF THE PHILIPPINES • CITY TREASURER'S OFFICE
              </span>
              <h3 className="text-xl font-black text-slate-900">ELECTRONIC OFFICIAL RECEIPT (eOR)</h3>
              <p className="text-xs font-mono font-bold text-emerald-700">
                OR No: {issuedReceipt.officialReceiptNumber}
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Date &amp; Time:</span>
                <span className="font-mono font-semibold">{new Date(issuedReceipt.paymentDate).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payor / Owner:</span>
                <span className="font-bold text-slate-900">{issuedReceipt.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Gateway:</span>
                <span className="font-semibold">{issuedReceipt.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Group Reference:</span>
                <span className="font-mono text-slate-600">{issuedReceipt.groupReferenceNumber}</span>
              </div>
            </div>

            {issuedReceipt.items && issuedReceipt.items.length > 0 && (
              <div className="border-t border-slate-200 pt-3 space-y-2">
                <span className="text-[11px] font-bold uppercase text-slate-700 block">Settled TDNs:</span>
                {issuedReceipt.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs p-2 bg-slate-50 rounded-lg">
                    <span className="font-mono font-bold text-[#0B3B60]">{item.taxDeclarationNumber}</span>
                    <span className="font-mono font-bold">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex justify-between items-center text-sm font-black text-emerald-950">
              <span>TOTAL AMOUNT PAID:</span>
              <span className="font-mono">{formatCurrency(issuedReceipt.totalAmount)}</span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3 rounded-xl text-xs transition cursor-pointer"
              >
                Print Receipt
              </button>
              <button
                onClick={() => setIsReceiptModalOpen(false)}
                className="w-1/2 bg-[#0B3B60] hover:bg-[#082944] text-white font-bold py-3 rounded-xl text-xs transition shadow-md cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedAppDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-8 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-[#0284C7]">Control Number</span>
                <h3 className="text-base font-extrabold text-[#0B3B60]">{selectedAppDetail.controlNumber}</h3>
              </div>
              <button
                onClick={() => setSelectedAppDetail(null)}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Service:</span>
                <span className="font-bold">{selectedAppDetail.service}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Owner Name:</span>
                <span className="font-bold">{selectedAppDetail.ownerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Property Location:</span>
                <span className="font-semibold text-right max-w-xs">{selectedAppDetail.propertyLocation}, {selectedAppDetail.barangay}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="font-bold text-[#0B3B60]">{selectedAppDetail.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Filed Date:</span>
                <span className="font-mono">{selectedAppDetail.filedDate}</span>
              </div>
            </div>

            {/* Uploaded Documents Section */}
            <div className="pt-3 border-t border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Uploaded Documents ({getAppDocumentsList(selectedAppDetail).length})
                </span>
              </div>
              {getAppDocumentsList(selectedAppDetail).length === 0 ? (
                <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-dashed text-center">
                  No uploaded documents recorded for this application.
                </p>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {getAppDocumentsList(selectedAppDetail).map((doc, idx) => {
                    const isPdf = doc.name.toLowerCase().endsWith('.pdf') || (doc.url && (doc.url.toLowerCase().includes('.pdf') || doc.url.startsWith('data:application/pdf')));
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/80 transition text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-3">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 text-slate-700 shrink-0">
                            {isPdf ? 'PDF' : 'IMG'}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{doc.name}</p>
                            <p className="text-[10px] text-slate-400">{isPdf ? 'PDF Document' : 'Image File'}</p>
                          </div>
                        </div>
                        <div className="shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCitizenOpenDocPreview(doc)}
                            className="px-3 py-1 bg-[#0284C7] hover:bg-sky-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                          >
                            Preview
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {Number(selectedAppDetail.paymentAmount || 0) > 0 && (
              <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">RPT Service Assessment</p>
                    <p className="text-xl font-black text-[#0B3B60]">{formatCurrency(Number(selectedAppDetail.paymentAmount))}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${selectedAppDetail.paymentStatus === "Paid" ? "bg-emerald-100 text-emerald-800" : "bg-white text-blue-800 border border-blue-200"}`}>
                    {selectedAppDetail.paymentStatus === "Paid" ? "PAID" : "FOR PAYMENT"}
                  </span>
                </div>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  The City Assessor has completed the assessment. Pay the posted RPT service fee online to continue the application process.
                </p>
                {selectedAppDetail.paymentStatus === "Paid" ? (
                  <div className="space-y-1 text-[11px] text-emerald-800 font-semibold">
                    <p>✓ Payment confirmed</p>
                    {selectedAppDetail.officialReceiptNumber && <p>Official Receipt: <span className="font-mono">{selectedAppDetail.officialReceiptNumber}</span></p>}
                    {selectedAppDetail.paymentReference && <p>Reference: <span className="font-mono">{selectedAppDetail.paymentReference}</span></p>}
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isGeneratingRPTServiceQr}
                    onClick={() => void handleRPTServicePayment(selectedAppDetail)}
                    className="w-full bg-[#1D3F99] hover:bg-[#17357F] disabled:opacity-50 text-white font-extrabold py-3 rounded-xl text-xs uppercase tracking-wide shadow-sm transition"
                  >
                    {isGeneratingRPTServiceQr ? "Generating QR..." : `Pay ${selectedAppDetail.service || "RPT Service"} →`}
                  </button>
                )}
              </div>
            )}

            <button
              onClick={() => setSelectedAppDetail(null)}
              className="w-full bg-[#0B3B60] hover:bg-[#082944] text-white font-bold py-3 rounded-xl text-xs transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {isRPTServiceQrOpen && rptServicePaymentApplication && (
        <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto overscroll-contain">
          <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-5xl max-h-[96vh] shadow-2xl border border-slate-200 overflow-y-auto my-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2">
              <div className="p-4 sm:p-6 lg:p-8 lg:border-r border-slate-200 min-w-0">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                  RPT Service Payment
                </h2>
                <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1 break-all">
                  ({rptServicePaymentApplication.controlNumber || rptServicePaymentApplication.taxDeclarationNumber || "RPT Application"})
                </p>
                <p className="text-sm text-slate-500 mt-3">
                  {rptServicePaymentApplication.service || "Real Property Tax Service"}
                </p>
                <p className="text-sm text-slate-600 mt-4">
                  Billed to <span className="font-bold text-slate-900">{rptServicePaymentApplication.applicantName || rptServicePaymentApplication.ownerName || currentUser?.fullname || "Taxpayer"}</span>
                  {(rptServicePaymentApplication.email || currentUser?.email) && <> , <span>{rptServicePaymentApplication.email || currentUser?.email}</span></>}
                </p>

                <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50/60 p-5">
                  <p className="text-xs font-black uppercase tracking-wide text-blue-900 mb-3">RPT Service Assessment</p>
                  <div className="flex justify-between items-center gap-4 py-3">
                    <span className="text-slate-600">{rptServicePaymentApplication.service || "Service Fee"}</span>
                    <span className="font-black text-slate-900 whitespace-nowrap">{formatCurrency(Number(rptServicePaymentApplication.paymentAmount || 0))}</span>
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-slate-200">
                  <p className="text-3xl sm:text-4xl lg:text-5xl font-black text-emerald-600">
                    {formatCurrency(Number(rptServicePaymentApplication.paymentAmount || 0))}
                  </p>
                  <div className="flex justify-between items-center mt-8 text-sm">
                    <span className="text-slate-600">Subtotal</span>
                    <span className="font-bold text-slate-900">{formatCurrency(Number(rptServicePaymentApplication.paymentAmount || 0))}</span>
                  </div>
                  <div className="flex justify-between items-center mt-4 text-sm">
                    <span className="text-slate-600">Payment Fees</span>
                    <span className="font-semibold text-slate-900">Free</span>
                  </div>
                  <div className="flex justify-between items-center mt-5 pt-5 border-t border-slate-200">
                    <span className="font-black text-slate-900">Total Due</span>
                    <span className="font-black text-lg text-slate-900">{formatCurrency(Number(rptServicePaymentApplication.paymentAmount || 0))}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-6 lg:p-8 bg-slate-50/60 flex flex-col items-center min-w-0">
                <div className="w-full text-center">
                  <p className="text-base sm:text-lg font-black text-slate-900">Scan QR Ph code to pay</p>
                  <p className="text-xs text-slate-500 mt-2">Use your supported banking or e-wallet app.</p>
                </div>

                {isGeneratingRPTServiceQr && !rptServiceQrCodeUrl && (
                  <div className="w-full max-w-sm mt-6 rounded-2xl border border-slate-200 bg-white p-10 flex flex-col items-center text-center shadow-sm">
                    <div className="h-10 w-10 border-4 border-blue-200 border-t-blue-700 rounded-full animate-spin mb-4" />
                    <p className="text-sm font-bold text-slate-800">Generating QR Ph code...</p>
                    <p className="text-xs text-slate-500 mt-1">Please wait while PayMongo prepares your secure payment.</p>
                  </div>
                )}

                {!isGeneratingRPTServiceQr && rptServicePaymentNotice && !rptServiceQrCodeUrl && (
                  <div className="w-full max-w-sm mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center">
                    <p className="text-xs font-bold text-rose-700">{rptServicePaymentNotice}</p>
                    <button type="button" onClick={() => void handlePayMongoRPTServiceQrPayment(rptServicePaymentApplication)} className="mt-4 px-5 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold">Generate QR Again</button>
                  </div>
                )}

                {rptServiceQrCodeUrl && !rptServiceQrPaid && (
                  <div className="w-full flex flex-col items-center mt-5">
                    <div className="w-full max-w-sm rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-center mb-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">QR Code Refreshes In</p>
                      <p className="text-xl sm:text-2xl font-black tabular-nums text-blue-700">{Math.floor(rptServiceQrSecondsRemaining / 60)}:{String(rptServiceQrSecondsRemaining % 60).padStart(2, "0")}</p>
                      {rptServiceQrReferenceNumber && <p className="text-[10px] font-mono text-slate-500 mt-1">Ref: {rptServiceQrReferenceNumber}</p>}
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-md max-w-full">
                      <img src={rptServiceQrCodeUrl} alt="PayMongo Dynamic QR Ph payment code" className="w-[min(72vw,18rem)] h-[min(72vw,18rem)] max-w-full object-contain" />
                    </div>
                    <p className="text-xs text-slate-500 text-center mt-3 max-w-sm">Scan the QR code with your preferred supported payment app. Your payment will be confirmed automatically through PayMongo.</p>
                    <div className="mt-4 flex items-center gap-2 text-xs font-bold text-blue-700">
                      <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" /> Waiting for payment...
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5 border-t border-slate-200 bg-white flex justify-end sticky bottom-0">
              <button type="button" onClick={closeRPTServicePayment} disabled={isGeneratingRPTServiceQr} className="px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold text-sm transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {rptServicePaymentSuccess && rptServicePaymentApplication && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-md overflow-y-auto overscroll-contain">
          <div className="relative w-full max-w-lg max-h-[94vh] overflow-y-auto rounded-2xl sm:rounded-[28px] bg-white p-5 sm:p-8 shadow-2xl text-center">
            <div className="mx-auto mb-4 sm:mb-5 h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg viewBox="0 0 52 52" className="h-10 w-10 sm:h-12 sm:w-12 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M14 27l8 8 17-19" /></svg>
            </div>
            <p className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">PAYMENT CONFIRMED</p>
            <h2 className="mt-3 sm:mt-4 text-xl sm:text-2xl font-black text-slate-900">Payment Successful!</h2>
            <p className="mt-2 text-sm text-slate-500">Your {rptServicePaymentApplication.service || "RPT service"} payment has been confirmed.</p>
            <div className="mt-5 rounded-2xl bg-slate-50 border border-slate-200 p-4 sm:p-5 text-left space-y-3 text-sm overflow-x-auto">
              <div className="flex justify-between gap-4"><span className="text-slate-500">Service</span><span className="font-bold text-right">{rptServicePaymentApplication.service}</span></div>
              <div className="flex justify-between gap-4"><span className="text-slate-500">Amount Paid</span><span className="font-black">{formatCurrency(Number(rptServicePaymentApplication.paymentAmount || 0))}</span></div>
              <div className="flex justify-between gap-4"><span className="text-slate-500">Reference</span><span className="font-mono font-bold text-right">{rptServicePaymentApplication.paymentReference || rptServiceQrReferenceNumber || "Confirmed"}</span></div>
              {rptServicePaymentApplication.officialReceiptNumber && <div className="flex justify-between gap-4"><span className="text-slate-500">Official Receipt</span><span className="font-mono font-bold">{rptServicePaymentApplication.officialReceiptNumber}</span></div>}
              {rptServicePaymentConfirmedAt && <div className="flex justify-between gap-4"><span className="text-slate-500">Date</span><span className="font-bold">{rptServicePaymentConfirmedAt.toLocaleString("en-PH")}</span></div>}
            </div>
            <button type="button" onClick={() => { setRptServicePaymentSuccess(false); setRptServicePaymentApplication(null); loadApplications(); }} className="mt-6 w-full rounded-xl bg-[#1D3F99] hover:bg-[#17357F] text-white py-3 font-extrabold text-sm">Done</button>
          </div>
        </div>
      )}

      {isGuideModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-8 max-w-xl w-full shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-extrabold text-[#0B3B60]">
                📖 Real Property Tax (RPT) Online Payment Guide
              </h3>
              <button
                onClick={() => setIsGuideModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
              <div className="p-3 bg-sky-50 rounded-xl border border-sky-100">
                <h4 className="font-bold text-[#0B3B60] mb-1">Step 1: Search Tax Declaration Number (TDN)</h4>
                <p>Enter your TDN (e.g. F-021-01491), complete the "I'm not a robot" captcha, and click SEARCH.</p>
              </div>
              <div className="p-3 bg-sky-50 rounded-xl border border-sky-100">
                <h4 className="font-bold text-[#0B3B60] mb-1">Step 2: Verify Property Ownership</h4>
                <p>Confirm the owner or corporation name displayed on the prompt. If correct, click YES.</p>
              </div>
              <div className="p-3 bg-sky-50 rounded-xl border border-sky-100">
                <h4 className="font-bold text-[#0B3B60] mb-1">Step 3: Group Bill Set (Multiple TDNs)</h4>
                <p>Review all properties linked to your ownership or parcel PIN. Select all TDNs you want to pay together.</p>
              </div>
              <div className="p-3 bg-sky-50 rounded-xl border border-sky-100">
                <h4 className="font-bold text-[#0B3B60] mb-1">Step 4: Select Payment Option</h4>
                <p>Choose between Quarterly (Q1-Q4) or Full Annual payment. You can apply the option to all TDNs with one click!</p>
              </div>
              <div className="p-3 bg-sky-50 rounded-xl border border-sky-100">
                <h4 className="font-bold text-[#0B3B60] mb-1">Step 5: Checkout &amp; Electronic Official Receipt</h4>
                <p>Add to Cart and complete payment with GCash, Maya, Cards, or QR Ph. Receive instant downloadable eOR.</p>
              </div>
            </div>
            <div className="rpt-history mt-6">
              <button
                type="button"
                onClick={() => setIsPaymentHistoryOpen((open) => !open)}
                className="w-full px-4 py-4 flex items-center justify-between cursor-pointer"
              >
                <span>[ MY RPT PAYMENT HISTORY ]</span>
                <span>{isPaymentHistoryOpen ? "[-]" : "[+]"}</span>
              </button>

              {isPaymentHistoryOpen && (
                <div className="border-t border-white overflow-x-auto">
                  {rptPaymentHistory.length === 0 ? (
                    <div className="rpt-empty px-4 py-6">
                      No RPT payment history available.
                    </div>
                  ) : (
                    <table className="rpt-table w-full min-w-[760px] text-left border-collapse">
                      <thead>
                        <tr>
                          <th>TDN</th>
                          <th>OWNER</th>
                          <th>LOCATION</th>
                          <th>YEAR</th>
                          <th>TAX DUE</th>
                          <th>OR NO.</th>
                          <th>DATE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rptPaymentHistory.map((payment) => (
                          <tr key={payment.id}>
                            <td className="font-bold">{payment.tdn}</td>
                            <td>{payment.ownerName}</td>
                            <td>{payment.location}</td>
                            <td>{payment.year}</td>
                            <td className="font-bold">{formatCurrency(payment.taxDue)}</td>
                            <td>{payment.officialReceiptNumber}</td>
                            <td>{new Date(payment.paymentDate).toLocaleDateString("en-PH")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => setIsGuideModalOpen(false)}
              className="w-full bg-[#0B3B60] hover:bg-[#082944] text-white font-bold py-3 rounded-xl text-xs transition cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}

      {citizenPreviewDoc && (
        <div className="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl h-[85vh] shadow-2xl overflow-hidden flex flex-col border border-slate-200">
            <div className="p-4 bg-[#0B3B60] text-white flex justify-between items-center">
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <span className="text-xs uppercase font-bold text-sky-300 shrink-0">Document Preview</span>
                <span className="text-xs text-slate-200 truncate max-w-md">({citizenPreviewDoc.name})</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setCitizenPreviewDoc(null);
                    setCitizenPreviewError(false);
                  }}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 overflow-auto flex items-center justify-center p-4">
              {citizenPreviewDoc.url.toLowerCase().includes('.pdf') || citizenPreviewDoc.url.startsWith('data:application/pdf') ? (
                <iframe
                  src={citizenPreviewDoc.url}
                  title={citizenPreviewDoc.name}
                  className="w-full h-full border-0 rounded-xl bg-white shadow-md"
                />
              ) : citizenPreviewError || !citizenPreviewDoc.url ? (
                <div className="text-center p-8 max-w-md bg-white border border-slate-200 rounded-2xl shadow-lg space-y-4">
                  <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Preview Unavailable</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      The document <span className="font-mono font-semibold text-slate-700">"{citizenPreviewDoc.name}"</span> could not be loaded in the inline viewer.
                    </p>
                  </div>
                  {citizenPreviewDoc.url && (
                    <div className="pt-2">
                      <a
                        href={citizenPreviewDoc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={citizenPreviewDoc.name}
                        className="inline-flex items-center px-4 py-2 bg-[#0B3B60] hover:bg-[#082944] text-white font-semibold text-xs rounded-xl transition shadow-md"
                      >
                        Download File
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <img
                  src={citizenPreviewDoc.url}
                  alt={citizenPreviewDoc.name}
                  onError={() => {
                    if (citizenPreviewDoc?.url && !citizenPreviewDoc.url.startsWith('data:image/svg+xml')) {
                      setCitizenPreviewDoc({
                        ...citizenPreviewDoc,
                        url: createDocumentFallbackSvg(citizenPreviewDoc.name),
                      });
                    } else {
                      setCitizenPreviewError(true);
                    }
                  }}
                  className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}

      <UnifiedFooter />
    </div>
  );
}