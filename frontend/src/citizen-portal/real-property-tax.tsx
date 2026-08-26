// src/components/real-property-tax.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import logoSystem from "/src/assets/logo-system.png";
import { API_BASE_URL } from '../config/api';

type ApplicantType = "Property Owner" | "Authorized Representative" | "Corporation / Company";

type RPTApplicationStatus =
  | "Submitted"
  | "For Review"
  | "Under Evaluation"
  | "For Compliance"
  | "Processing"
  | "Approved"
  | "Ready for Release"
  | "Completed"
  | "Rejected";

type RPTPaymentStatus = "Unpaid" | "Pending Payment" | "Paid";

interface AttachmentFile {
  name: string;
  url: string;
}

interface RPTApplicationRecord {
  id: string;
  controlNumber: string;
  taxDeclarationNumber: string;
  ownerName: string;
  applicantName: string;
  applicantType: ApplicantType;
  email: string;
  mobileNumber: string;
  service: string;
  propertyLocation: string;
  barangay: string;
  propertyType: string;
  status: RPTApplicationStatus;
  filedDate: string;
  documents: AttachmentFile[] | string[] | Record<string, any>;
  rptRecordId?: string;
  amountDue?: number;
  paymentStatus?: RPTPaymentStatus;
  paymentMethod?: string;
  paymentReference?: string;
  officialReceiptNumber?: string;
  paymentDate?: string;
}

interface CitizenRPTRecord {
  id: string;
  taxDeclarationNumber: string;
  pin?: string;
  ownerName?: string;
  propertyLocation?: string;
  barangay?: string;
  propertyType?: string;
  billingYear?: number | string;
  quarter?: string;
  basicTax?: number | string;
  sefTax?: number | string;
  specialLevy?: number | string;
  penalty?: number | string;
  discount?: number | string;
  totalAssessment?: number | string;
  amountPaid?: number | string;
  balance?: number | string;
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  officialReceiptNumber?: string;
  paymentReference?: string;
  paymentDate?: string;
  amountDue?: number | string;
}

interface RPTFormData {
  service: string;
  applicantType: ApplicantType;
  ownerName: string;
  applicantName: string;
  email: string;
  mobileNumber: string;
  taxDeclarationNumber: string;
  tin: string;
  propertyLocation: string;
  barangay: string;
  propertyType: string;
  notes: string;
}

export interface RealPropertyApplicationProps {
  isCollapsed?: boolean;
}

const services = [
  "Transfer of Ownership",
  "Consolidation / Segregation",
  "New Assessment / Reassessment / Reclassification",
  "Correction / Updating / Revision",
  "Declaration of New / Undeclared Land",
  "Cancellation of Assessment Records",
];

const paymentMethods = ["GCash", "Maya", "Online Banking"];

function toAmount(value: unknown): number {
  const amount = Number(String(value ?? 0).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(value);
}

function getRPTAmountDue(record: CitizenRPTRecord): number {
  if (record.balance !== undefined) return toAmount(record.balance);
  if (record.amountDue !== undefined) return toAmount(record.amountDue);

  const total = toAmount(record.totalAssessment);
  const paid = toAmount(record.amountPaid);
  if (total > 0) return Math.max(0, total - paid);

  return (
    toAmount(record.basicTax) +
    toAmount(record.sefTax) +
    toAmount(record.specialLevy) +
    toAmount(record.penalty) -
    toAmount(record.discount) -
    paid
  );
}

function getStoredCitizenSession() {
  const rawUser = localStorage.getItem("currentUser") || localStorage.getItem("user") || sessionStorage.getItem("currentUser") || sessionStorage.getItem("user");
  if (!rawUser) return null;

  try {
    const parsed = JSON.parse(rawUser);
    const target = parsed.user && typeof parsed.user === "object" ? parsed.user : parsed;
    const fullName = target.fullname || target.name || target.fullName || target.firstName || target.email;
    if (!fullName) return null;

    const email = target.email || "";
    const nameParts = String(fullName).trim().split(" ");
    const firstName = nameParts[0];
    const initials = nameParts.length > 1
      ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
      : (nameParts[0].slice(0, 2) || "U").toUpperCase();

    return { fullname: String(fullName), email, firstName, initials };
  } catch {
    return null;
  }
}

function createEmptyForm(): RPTFormData {
  const session = getStoredCitizenSession();
  return {
    service: services[0],
    applicantType: "Property Owner",
    ownerName: session?.fullname || "",
    applicantName: session?.fullname || "",
    email: session?.email || "",
    mobileNumber: "",
    taxDeclarationNumber: "",
    tin: "",
    propertyLocation: "",
    barangay: "",
    propertyType: "Residential",
    notes: "",
  };
}

function makeControlNumber() {
  const date = new Date();
  const period = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
  const random = Math.floor(100000 + Math.random() * 900000);
  return `RPT-${period}-${random}`;
}

function formatDate(date: string) {
  if (!date) return "—";
  try {
    const cleanDate = date.includes('T') ? date : `${date}T00:00:00`;
    return new Intl.DateTimeFormat("en-PH", { year: "numeric", month: "short", day: "numeric" }).format(new Date(cleanDate));
  } catch (e) {
    return "Invalid Date";
  }
}

const getStatusColor = (status?: string) => {
  const s = (status || "Submitted").toUpperCase();
  if (s === 'APPROVED' || s === 'COMPLETED' || s === 'READY FOR RELEASE') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400';
  if (s === 'REJECTED') return 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-400';
  return 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400';
};

export default function RealPropertyApplication({ isCollapsed = false }: RealPropertyApplicationProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState<{ fullname: string; email: string; initials: string; firstName: string } | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [applications, setApplications] = useState<RPTApplicationRecord[]>([]);
  const [formData, setFormData] = useState<RPTFormData>(createEmptyForm);
  const [documents, setDocuments] = useState<{ [key: string]: { name: string; url: string } }>({
    ownershipProof: { name: "", url: "" },
    validId: { name: "", url: "" },
    taxRecord: { name: "", url: "" },
    propertySketch: { name: "", url: "" },
    authorization: { name: "", url: "" }
  });

  const initialView = new URLSearchParams(location.search).get("view");
  const [currentView, setCurrentView] = useState<"hub" | "status" | "form">(
    initialView === "status" ? "status" : initialView === "form" ? "form" : "hub"
  );
  const [isFormOpen, setIsFormOpen] = useState(initialView === "form");

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [selectedApplication, setSelectedApplication] = useState<RPTApplicationRecord | null>(null);
  const [rptRecords, setRptRecords] = useState<CitizenRPTRecord[]>([]);
  const [selectedRPTId, setSelectedRPTId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("GCash");
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);

  const [previewFile, setPreviewFile] = useState<{ name: string; url: string } | null>(null);

  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchType, setSearchType] = useState("Tax Declaration");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    setUser(getStoredCitizenSession());

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const activeUser = getStoredCitizenSession();

        if (activeUser?.email) {
          const appsRes = await fetch(`${API_BASE_URL}/citizen-rpt-applications`);
          if (appsRes.ok) {
            const data = await appsRes.json();
            const userApps = Array.isArray(data)
              ? data.map((app: any) => ({
                ...app,
                controlNumber: app.control_number || app.controlNumber || "",
                taxDeclarationNumber: app.tax_declaration_number || app.taxDeclarationNumber || "",
                ownerName: app.owner_name || app.ownerName || "",
                applicantName: app.applicant_name || app.applicantName || "",
                applicantType: app.applicant_type || app.applicantType || "",
                mobileNumber: app.mobile_number || app.mobileNumber || "",
                propertyLocation: app.property_location || app.propertyLocation || "",
                propertyType: app.property_type || app.propertyType || "",
                filedDate: app.filed_date || app.filedDate || app.created_at || "",
                status: app.status || "Submitted",
              })).filter((app: RPTApplicationRecord) => app.email === activeUser.email)
              : [];
            setApplications(userApps);
          }
        }

        const rptRes = await fetch(`${API_BASE_URL}/lgu-rpt-records`);
        if (rptRes.ok) {
          const data = await rptRes.json();
          setRptRecords(data);
        }
      } catch (error) {
        console.error("Failed to fetch database records:", error);
        setNotice("Could not connect to the database server.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    const viewParam = new URLSearchParams(location.search).get("view");
    const nextView: "hub" | "status" | "form" =
      viewParam === "status" ? "status" : viewParam === "form" ? "form" : "hub";

    setCurrentView(nextView);
    setIsFormOpen(nextView === "form");

    if (location.pathname !== "/citizen-rpt") {
      const query = nextView === "hub" ? "" : `?view=${nextView}`;
      navigate(`/citizen-rpt${query}`, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('user');
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('user');
    setUser(null);
    setIsDropdownOpen(false);
    window.location.href = '/';
  };

  const filteredApplications = useMemo(() => {
    let result = applications;

    if (statusFilter !== "ALL") {
      result = result.filter(app => (app.status || "Submitted").toUpperCase() === statusFilter.toUpperCase());
    }

    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter(app => {
        if (searchType === "Tax Declaration") return String(app.taxDeclarationNumber || "").toLowerCase().includes(query);
        if (searchType === "Owner Name") return String(app.ownerName || "").toLowerCase().includes(query);
        if (searchType === "Control No.") return String(app.controlNumber || "").toLowerCase().includes(query);
        return true;
      });
    }

    return result.sort((a, b) => new Date(b.filedDate || 0).getTime() - new Date(a.filedDate || 0).getTime());
  }, [applications, statusFilter, searchType, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredApplications.length / pageSize));
  const paginatedApplications = filteredApplications.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function updateForm(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;
    if (name === "mobileNumber") {
      setFormData((current) => ({ ...current, mobileNumber: value.replace(/\D/g, "").slice(0, 11) }));
      return;
    }
    setFormData((current) => ({ ...current, [name]: value }));
  }

  // Exact Business Tax File-to-Base64 Conversion Reader
  function updateDocument(event: ChangeEvent<HTMLInputElement>) {
    const { name, files } = event.target;
    const file = files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64Url = uploadEvent.target?.result as string || "";
      setDocuments((current) => ({
        ...current,
        [name]: { name: file.name, url: base64Url }
      }));
    };
    reader.readAsDataURL(file);
  }

  function selectedRPT() {
    return rptRecords.find((record) => String(record.id) === selectedRPTId);
  }

  function startPaymentForRecord(record: CitizenRPTRecord) {
    const amountDue = getRPTAmountDue(record);
    if (amountDue <= 0) {
      setNotice("This RPT record has no outstanding balance.");
      return;
    }

    setSelectedRPTId(String(record.id));
    setPaymentMethod("GCash");
    setNotice("");
    setIsPaymentOpen(true);
  }

  async function confirmPayment() {
    const record = selectedRPT();
    if (!record) {
      setNotice("Select an RPT assessment first.");
      return;
    }

    const amountDue = getRPTAmountDue(record);
    if (amountDue <= 0) {
      setNotice("This RPT record has no outstanding balance.");
      setIsPaymentOpen(false);
      return;
    }

    const paymentReference = `RPT-PAY-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}-${Math.floor(100000 + Math.random() * 900000)}`;
    const officialReceiptNumber = `OR-RPT-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    try {
      const response = await fetch(`${API_BASE_URL}/citizen-rpt-payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rptRecordId: record.id,
          taxDeclarationNumber: record.taxDeclarationNumber,
          ownerName: record.ownerName || user?.fullname || "",
          amount: amountDue,
          paymentMethod,
          paymentReference,
          officialReceiptNumber,
        }),
      });

      if (!response.ok) throw new Error("Payment processing failed");

      const rptRes = await fetch(`${API_BASE_URL}/lgu-rpt-records`);
      if (rptRes.ok) {
        setRptRecords(await rptRes.json());
      }

      setIsPaymentOpen(false);
      setNotice(`Payment successful. OR No. ${officialReceiptNumber}. Payment reference: ${paymentReference}.`);
      setSelectedRPTId("");
    } catch (error) {
      console.error(error);
      setNotice("Error processing payment. Please try again.");
    }
  }

  function openApplicationStatus() {
    setCurrentView("status");
    setIsFormOpen(false);
    setIsPreviewOpen(false);
    setNotice("");
    navigate("/citizen-rpt?view=status");
  }

  function startApplication() {
    setCurrentView("form");
    setFormData(createEmptyForm());
    setDocuments({
      ownershipProof: { name: "", url: "" },
      validId: { name: "", url: "" },
      taxRecord: { name: "", url: "" },
      propertySketch: { name: "", url: "" },
      authorization: { name: "", url: "" }
    });
    setNotice("");
    setIsPreviewOpen(false);
    setIsFormOpen(true);
    navigate("/citizen-rpt?view=form");
  }

  function openReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!documents.ownershipProof.name || !documents.validId.name) {
      setNotice("Attach proof of ownership and a valid government-issued ID before continuing.");
      return;
    }
    if (formData.applicantType === "Authorized Representative" && !documents.authorization.name) {
      setNotice("Attach the authorization or Special Power of Attorney before continuing as a representative.");
      return;
    }
    setNotice("");
    setIsPreviewOpen(true);
  }

  async function submitApplication() {
    const generatedControlNo = makeControlNumber();
    const currentDate = new Date().toISOString().slice(0, 10);

    const attachedDocsList = Object.values(documents)
      .filter((doc) => doc.name)
      .map((doc) => ({ name: doc.name, url: doc.url }));

    const formDataPayload = {
      control_number: generatedControlNo,
      tax_declaration_number: formData.taxDeclarationNumber || "For issuance",
      owner_name: formData.ownerName,
      applicant_name: formData.applicantName,
      applicant_type: formData.applicantType,
      email: formData.email,
      mobile_number: formData.mobileNumber,
      service: formData.service,
      property_location: formData.propertyLocation,
      barangay: formData.barangay,
      property_type: formData.propertyType,
      status: "Submitted",
      filed_date: currentDate,
      notes: formData.notes,
      documents: JSON.stringify(attachedDocsList)
    };

    try {
      const response = await fetch(`${API_BASE_URL}/citizen-rpt-applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formDataPayload),
      });

      if (!response.ok) throw new Error("Failed to submit application");

      const savedAppResult = await response.json();
      const rawApp = savedAppResult.record || savedAppResult;

      let parsedDocs = rawApp.documents;
      if (typeof parsedDocs === "string") {
        try { parsedDocs = JSON.parse(parsedDocs); } catch { parsedDocs = attachedDocsList; }
      }

      const savedApp = {
        ...rawApp,
        controlNumber: rawApp.control_number || rawApp.controlNumber || generatedControlNo,
        taxDeclarationNumber: rawApp.tax_declaration_number || rawApp.taxDeclarationNumber || formData.taxDeclarationNumber,
        ownerName: rawApp.owner_name || rawApp.ownerName || formData.ownerName,
        applicantName: rawApp.applicant_name || rawApp.applicantName || formData.applicantName,
        applicantType: rawApp.applicant_type || rawApp.applicantType || formData.applicantType,
        mobileNumber: rawApp.mobile_number || rawApp.mobileNumber || formData.mobileNumber,
        propertyLocation: rawApp.property_location || rawApp.propertyLocation || formData.propertyLocation,
        propertyType: rawApp.property_type || rawApp.propertyType || formData.propertyType,
        filedDate: rawApp.filed_date || rawApp.filedDate || currentDate,
        status: rawApp.status || "Submitted",
        documents: parsedDocs || attachedDocsList,
      };

      setApplications([savedApp, ...applications]);
      setIsPreviewOpen(false);
      setCurrentView("status");
      setIsFormOpen(false);

      setNotice(`Application submitted. Your control number is ${savedApp.controlNumber}.`);
      navigate("/citizen-rpt?view=status");
    } catch (error) {
      console.error(error);
      setNotice("Error submitting application to the database.");
    }
  }

  function cancelApplication() {
    setIsPreviewOpen(false);
    setCurrentView("status");
    setIsFormOpen(false);
    setNotice("");
    navigate("/citizen-rpt?view=status");
  }

  function goHome() {
    setIsPreviewOpen(false);
    setIsFormOpen(false);
    setCurrentView("hub");
    setNotice("");
    navigate("/citizen-rpt");
  }

  const documentItems = [
    { label: "Proof of ownership", value: documents.ownershipProof.name || "Not attached" },
    { label: "Valid government-issued ID", value: documents.validId.name || "Not attached" },
    { label: "Latest tax receipt or Tax Declaration", value: documents.taxRecord.name || "Not attached" },
    { label: "Property sketch / plan, if applicable", value: documents.propertySketch.name || "Not attached" },
    ...(formData.applicantType === "Authorized Representative" ? [{ label: "Authorization / SPA", value: documents.authorization.name || "Not attached" }] : []),
  ];

  return (
    <div
      style={{
        marginLeft: isCollapsed ? "80px" : "0px",
        width: isCollapsed ? "calc(100% - 80px)" : "100%",
      }}
      className="min-h-screen flex flex-col justify-between bg-slate-100 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100 transition-all duration-300 box-border"
    >
      <div>
        <div className="w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.location.href = '/citizen-portal'}>
                <div className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xs flex items-center justify-center">
                  <img src={logoSystem} alt="System Logo" className="h-8 w-8 object-contain" />
                </div>
                <div className="flex flex-col">
                  <span className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-white leading-tight">Gov Serv</span>
                  <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 tracking-wider uppercase">Unified Portal</span>
                </div>
              </div>
            </div>

            <div className="hidden md:flex items-center space-x-6 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span className="hover:text-blue-700 cursor-pointer" onClick={() => window.location.href = '/citizen-portal'}>HOME</span>

              <div className="relative group py-2">
                <span className="hover:text-blue-700 cursor-pointer flex items-center gap-1 select-none">SERVICES ▾</span>
                <div className="absolute left-0 top-full h-2 w-full"></div>
                <div className="absolute left-0 top-[calc(100%+8px)] w-60 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-1 group-hover:translate-y-0">
                  <button onClick={() => window.location.href = '/citizen-portal'} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-700 transition-colors cursor-pointer">Home</button>
                  <button onClick={() => window.location.href = '/market-vendors-hub'} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-700 transition-colors cursor-pointer">Market &amp; Vendors Hub</button>
                  <button onClick={() => window.location.href = '/citizen-rpt'} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-700 transition-colors cursor-pointer">Real Property Tax Hub</button>
                  <button onClick={() => window.location.href = '/business-tax-assessment'} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-700 transition-colors cursor-pointer">Business Tax Assessment Hub</button>
                </div>
              </div>

              <span className="hover:text-blue-700 cursor-pointer">CONTACT US</span>
            </div>

            <div className="flex items-center space-x-3">
              {user ? (
                <div className="relative" ref={dropdownRef}>
                  <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="flex items-center space-x-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs group">
                    <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 tracking-tight">Hi, {user.firstName}</span>
                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-[10px] shadow-sm tracking-wider">{user.initials}</div>
                  </button>

                  {isDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 z-50">
                      <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user.fullname}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                      </div>
                      <button onClick={() => { setIsDropdownOpen(false); window.location.href = '/edit-profile'; }} className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-800 hover:text-blue-700 transition-colors cursor-pointer">Edit Profile</button>
                      <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer border-t border-slate-100 dark:border-slate-800 mt-1 pt-2">Log Out</button>
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={() => window.location.href = '/login'} className="bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs px-4 py-2 rounded-xl shadow transition-all cursor-pointer">Login / Register</button>
              )}
            </div>
          </div>
        </div>

        <div className="relative w-full bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 h-36 sm:h-48 overflow-hidden flex items-center justify-center border-b-4 border-blue-600">
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]"></div>
          <div className="relative z-10 text-center px-4">
            <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-wide uppercase">
              {currentView === 'hub' ? 'WELCOME TO REAL PROPERTY TAX' : currentView === 'status' ? 'APPLICATION STATUS' : 'REAL PROPERTY TAX APPLICATION'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-1 max-w-xl mx-auto">
              Manage your real property tax services and submissions directly through the secure database portal.
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8 w-full">
          <section className={currentView === "hub" ? "" : "overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"}>
            {currentView !== "hub" && currentView !== "status" && (
              <div className="border-b border-slate-200 dark:border-slate-800 px-6 py-6 sm:px-8">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">Office of the City Assessor</p>
                <div className="mt-2">
                  <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">Real Property Tax Portal</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">Submit a single tax declaration request, attach requirements, and track records stored securely.</p>
                </div>
              </div>
            )}

            {notice && <div role="status" className="mx-6 mt-6 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900 sm:mx-8">{notice}</div>}

            {currentView === "hub" ? (
              <div className="py-2 sm:py-4">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <button type="button" onClick={openApplicationStatus} className="group min-h-[205px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg cursor-pointer flex flex-col justify-between">
                    <div>
                      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50 text-2xl text-blue-600">✓</div>
                      <h3 className="text-base font-extrabold uppercase tracking-wide text-blue-900 dark:text-blue-300">CHECK APPLICATION STATUS</h3>
                      <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-400">Find your control number, review updates, or settle tax assessment balances.</p>
                    </div>
                    <span className="mt-6 inline-flex rounded-xl bg-blue-800 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition group-hover:bg-blue-900 self-start">CHECK STATUS</span>
                  </button>

                  <button type="button" onClick={startApplication} className="group min-h-[205px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg cursor-pointer flex flex-col justify-between">
                    <div>
                      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50 text-2xl text-blue-600">▤</div>
                      <h3 className="text-base font-extrabold uppercase tracking-wide text-blue-900 dark:text-blue-300">REAL PROPERTY TAX APPLICATION</h3>
                      <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-400">Submit a new tax declaration request or property record update.</p>
                    </div>
                    <span className="mt-6 inline-flex rounded-xl bg-blue-800 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition group-hover:bg-blue-900 self-start">PROCEED WITH RPT APPLICATION</span>
                  </button>
                </div>
              </div>
            ) : isFormOpen ? (
              <div className="p-6 sm:p-8">
                <div className="mb-5 flex justify-start">
                  <button type="button" onClick={goHome} className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-sm transition-colors hover:bg-slate-50 cursor-pointer">
                    ← Back Home
                  </button>
                </div>

                {!isPreviewOpen ? (
                  <form onSubmit={openReview} className="space-y-7">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Transaction details</h3>
                      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                        <Field label="Requested service" required><select name="service" value={formData.service} onChange={updateForm} className={inputClass}>{services.map((service) => <option key={service}>{service}</option>)}</select></Field>
                        <Field label="Applying as" required><select name="applicantType" value={formData.applicantType} onChange={updateForm} className={inputClass}><option>Property Owner</option><option>Authorized Representative</option><option>Corporation / Company</option></select></Field>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-800 pt-7">
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Applicant information</h3>
                      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <Field label="Property owner / company name" required><input name="ownerName" value={formData.ownerName} onChange={updateForm} required className={inputClass} /></Field>
                        <Field label="Applicant name" required><input name="applicantName" value={formData.applicantName} onChange={updateForm} required className={inputClass} /></Field>
                        <Field label="Email address" required><input type="email" name="email" value={formData.email} onChange={updateForm} required className={inputClass} /></Field>
                        <Field label="Mobile number" required><input name="mobileNumber" value={formData.mobileNumber} onChange={updateForm} inputMode="numeric" placeholder="09XXXXXXXXX" required className={inputClass} /></Field>
                        <Field label="TIN"><input name="tin" value={formData.tin} onChange={updateForm} className={inputClass} /></Field>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-800 pt-7">
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Property information</h3>
                      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <Field label="Tax Declaration number"><input name="taxDeclarationNumber" value={formData.taxDeclarationNumber} onChange={updateForm} placeholder="e.g. 12345-67890" className={inputClass} /></Field>
                        <Field label="Property type" required><select name="propertyType" value={formData.propertyType} onChange={updateForm} className={inputClass}><option>Residential</option><option>Commercial</option><option>Industrial</option><option>Agricultural</option><option>Mixed Use</option></select></Field>
                        <Field label="Barangay" required><input name="barangay" value={formData.barangay} onChange={updateForm} required className={inputClass} /></Field>
                        <div className="md:col-span-2 lg:col-span-3"><Field label="Property location" required><input name="propertyLocation" value={formData.propertyLocation} onChange={updateForm} placeholder="House / lot number, street, subdivision" required className={inputClass} /></Field></div>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-800 pt-7">
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Documentary requirements</h3>
                      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <UploadField label="Proof of ownership" name="ownershipProof" onChange={updateDocument} required help="Deed of Sale, title, or applicable proof" />
                        <UploadField label="Valid government-issued ID" name="validId" onChange={updateDocument} required help="Owner or authorized applicant" />
                        <UploadField label="Latest tax receipt or Tax Declaration" name="taxRecord" onChange={updateDocument} help="Attach if available" />
                        <UploadField label="Property sketch / plan" name="propertySketch" onChange={updateDocument} help="Attach if applicable" />
                        {formData.applicantType === "Authorized Representative" && <UploadField label="Authorization / Special Power of Attorney" name="authorization" onChange={updateDocument} required help="Required for representatives" />}
                      </div>
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-800 pt-7"><Field label="Additional notes"><textarea name="notes" value={formData.notes} onChange={updateForm} rows={3} className={inputClass} placeholder="Add details that may help the assessor review this request." /></Field></div>

                    <div className="flex flex-col-reverse gap-3 border-t border-slate-100 dark:border-slate-800 pt-6 sm:flex-row sm:justify-end">
                      <button type="button" onClick={cancelApplication} className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer">Cancel</button>
                      <button type="submit" className="rounded-xl bg-blue-800 px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-900 cursor-pointer">Review Application</button>
                    </div>
                  </form>
                ) : (
                  <section className="space-y-6">
                    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5"><h3 className="text-lg font-extrabold text-blue-950">Review your application</h3></div>
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                      <Summary title="Transaction details" items={[["Service", formData.service], ["Applicant type", formData.applicantType], ["Tax Declaration", formData.taxDeclarationNumber || "For issuance"], ["Property type", formData.propertyType]]} />
                      <Summary title="Applicant and property" items={[["Property owner", formData.ownerName], ["Applicant", formData.applicantName], ["Email", formData.email], ["Mobile", formData.mobileNumber], ["Property location", `${formData.propertyLocation}, ${formData.barangay}`]]} />
                    </div>
                    <Summary title="Attached documents" items={documentItems.map((item) => [item.label, item.value])} />
                    <div className="flex flex-col-reverse gap-3 border-t border-slate-100 dark:border-slate-800 pt-6 sm:flex-row sm:justify-end">
                      <button type="button" onClick={() => setIsPreviewOpen(false)} className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer">Back to Edit</button>
                      <button type="button" onClick={submitApplication} className="rounded-xl bg-blue-800 px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-900 cursor-pointer">Confirm and Submit</button>
                    </div>
                  </section>
                )}
              </div>
            ) : (
              <div className="p-6 sm:p-8 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={goHome} className="text-xs text-blue-700 hover:underline font-semibold flex items-center gap-1 cursor-pointer">
                    ← Back to Home
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button onClick={startApplication} className="px-4 py-2 bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold rounded-md shadow-xs cursor-pointer">
                      + NEW RPT APPLICATION
                    </button>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <div className="w-full md:w-64">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Application Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                      className="w-full p-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-950 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="ALL">ALL</option>
                      <option value="Submitted">Submitted / Pending</option>
                      <option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                      <option value="For Compliance">For Compliance</option>
                      <option value="Processing">Processing</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                    <div className="w-full sm:w-48">
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Search By:</label>
                      <select
                        value={searchType}
                        onChange={(e) => { setSearchType(e.target.value); setCurrentPage(1); }}
                        className="w-full p-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-950 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="Tax Declaration">Tax Declaration No.</option>
                        <option value="Control No.">Control No.</option>
                        <option value="Owner Name">Owner Name</option>
                      </select>
                    </div>
                    <div className="w-full sm:w-64 pt-5">
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                          placeholder="Search records..."
                          className="w-full p-2 text-xs border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-950 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                        <button className="px-3 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded cursor-pointer">
                          Search
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                  <table className="w-full border-collapse text-left text-xs table-fixed min-w-[1000px]">
                    <thead className="bg-blue-900 text-white font-semibold">
                      <tr>
                        {["#", "Tax Declaration", "Owner Name", "Control No.", "Status", "Services", "Filed Date", "Amount Due", "Payment Status", "Action"].map((heading, i) =>
                          <th key={heading} className={`p-3 ${i === 0 ? 'w-10' : ''}`}>{heading}</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {loading ? (
                        <tr><td colSpan={10} className="p-8 text-center text-slate-500 bg-slate-50 dark:bg-slate-950/50">Loading applications from server...</td></tr>
                      ) : paginatedApplications.length ? paginatedApplications.map((application, index) => {
                        const rptRecord = rptRecords.find((record) => String(record.taxDeclarationNumber || "").trim().toLowerCase() === String(application.taxDeclarationNumber || "").trim().toLowerCase());
                        const balance = rptRecord ? getRPTAmountDue(rptRecord) : null;
                        const isPaid = rptRecord ? (balance !== null && balance <= 0) || String(rptRecord.status || "").toLowerCase() === "paid" : false;
                        const paymentStatus = rptRecord ? (isPaid ? "Paid" : (rptRecord.paymentStatus || "Unpaid")) : "Not available";

                        return (
                          <tr key={application.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="p-3 font-semibold text-slate-500">{(currentPage - 1) * pageSize + index + 1}</td>
                            <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{application.taxDeclarationNumber}</td>
                            <td className="p-3 text-slate-700 dark:text-slate-300 truncate" title={application.ownerName}>{application.ownerName}</td>
                            <td className="p-3 font-mono font-semibold text-blue-700 dark:text-blue-400">{application.controlNumber}</td>
                            <td className="p-3">
                              <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${getStatusColor(application.status)}`}>
                                {application.status || "Submitted"}
                              </span>
                            </td>
                            <td className="p-3 text-slate-600 dark:text-slate-400 truncate" title={application.service}>{application.service}</td>
                            <td className="p-3 text-slate-600 dark:text-slate-400">{formatDate(application.filedDate)}</td>
                            <td className="p-3 font-bold text-slate-900 dark:text-white">{balance === null ? "—" : formatCurrency(balance)}</td>
                            <td className="p-3"><span className="text-slate-700 dark:text-slate-300 font-semibold">{paymentStatus}</span></td>
                            <td className="p-3">
                              <div className="flex flex-col gap-2">
                                <button type="button" onClick={() => setSelectedApplication(application)} className="text-left font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">View Details</button>
                                {rptRecord && balance !== null && balance > 0 && (
                                  <button type="button" onClick={() => startPaymentForRecord(rptRecord)} className="text-left font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer">Pay RPT</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      }) : <tr><td colSpan={10} className="p-8 text-center text-sm font-medium text-slate-500 bg-slate-50 dark:bg-slate-950/50">No applications match your search criteria.</td></tr>}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center text-xs text-slate-500 pt-2">
                  <span>Page {currentPage} of {totalPages}</span>
                  <div className="flex gap-1">
                    <button
                      disabled={currentPage <= 1 || loading}
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      className="px-3 py-1 border border-slate-300 dark:border-slate-700 rounded disabled:opacity-40 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Previous
                    </button>
                    <button
                      disabled={currentPage >= totalPages || loading}
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      className="px-3 py-1 border border-slate-300 dark:border-slate-700 rounded disabled:opacity-40 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <footer className="w-full bg-blue-950 text-slate-300 text-xs py-4 px-6 border-t border-blue-900 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-4">
            <span className="font-bold">FOLLOW US</span>
            <div className="w-6 h-6 rounded-full bg-blue-900 flex items-center justify-center text-[10px] font-bold cursor-pointer">f</div>
            <div className="w-6 h-6 rounded-full bg-blue-900 flex items-center justify-center text-[10px] font-bold cursor-pointer">x</div>
          </div>
          <div className="flex items-center gap-6 text-[11px]">
            <span>Phone: 122</span>
            <span>Email: helpdesk@domain.gov.ph</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="hover:underline cursor-pointer">TERMS OF SERVICE</span>
            <span className="hover:underline cursor-pointer">FAQS</span>
            <span className="hover:underline cursor-pointer">PRIVACY POLICY</span>
          </div>
        </div>
        <div className="max-w-7xl mx-auto text-center text-[10px] text-slate-400 mt-3 pt-3 border-t border-blue-900/50">
          (c) 2026 Local Government. All rights reserved.
        </div>
      </footer>

      {selectedApplication && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4 flex justify-between items-center">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Application Details</p>
                <h3 className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white">{selectedApplication.controlNumber || "—"}</h3>
              </div>
              <button type="button" onClick={() => setSelectedApplication(null)} className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer">✕</button>
            </div>

            <div className="mt-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Detail label="Tax Declaration Number" value={selectedApplication.taxDeclarationNumber || "—"} />
                <Detail label="Status" value={selectedApplication.status || "—"} />
                <Detail label="Owner Name" value={selectedApplication.ownerName || "—"} />
                <Detail label="Applicant Name" value={selectedApplication.applicantName || "—"} />
                <Detail label="Applicant Type" value={selectedApplication.applicantType || "—"} />
                <Detail label="Service Requested" value={selectedApplication.service || "—"} />
                <Detail label="Email Address" value={selectedApplication.email || "—"} />
                <Detail label="Mobile Number" value={selectedApplication.mobileNumber || "—"} />
                <Detail label="Property Type" value={selectedApplication.propertyType || "—"} />
                <Detail label="Barangay" value={selectedApplication.barangay || "—"} />
              </div>
              <Detail label="Property Location" value={selectedApplication.propertyLocation || "—"} />

              {/* Uploaded Files Section matching Business Tax view structure */}
              <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="font-semibold text-slate-700 dark:text-slate-300">Submitted Documentary Requirements:</div>
                {(() => {
                  let docs = selectedApplication.documents;
                  if (typeof docs === "string") {
                    try { docs = JSON.parse(docs); } catch { }
                  }
                  if (docs && !Array.isArray(docs) && typeof docs === "object") {
                    docs = Object.values(docs).filter((v) => v);
                  }

                  const docArray = Array.isArray(docs) ? docs : [];

                  if (docArray.length === 0) {
                    return <p className="text-slate-400 italic text-xs">No files attached.</p>;
                  }

                  return docArray.map((fileObj, idx) => {
                    let fileName = "Document";
                    let fileUrl = "";

                    if (typeof fileObj === "object" && fileObj !== null) {
                      fileName = (fileObj as any).name || "Document";
                      fileUrl = (fileObj as any).url || "";
                    } else {
                      const docStr = String(fileObj);
                      fileName = docStr.includes(': ') ? docStr.split(': ')[1].trim() : docStr;
                      fileUrl = "";
                    }

                    return (
                      <div key={idx} className="flex justify-between items-center bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800">
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[260px] flex items-center gap-1.5 text-xs">
                          <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                          {fileName}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPreviewFile({ name: fileName, url: fileUrl })}
                          className="text-blue-600 font-bold hover:underline flex items-center gap-1 text-xs cursor-pointer"
                        >
                          Preview Document
                        </button>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            <div className="mt-6 flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
              <button type="button" onClick={() => setSelectedApplication(null)} className="rounded-xl bg-blue-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-900 cursor-pointer">Done</button>
            </div>
          </div>
        </div>
      )}

      {isPaymentOpen && selectedRPT() && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Real Property Tax Payment</p>
              <h3 className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white">Pay Outstanding RPT</h3>
            </div>
            <div className="mt-5 space-y-4">
              <Detail label="Tax Declaration" value={selectedRPT()?.taxDeclarationNumber || "—"} />
              <Detail label="Owner" value={selectedRPT()?.ownerName || "—"} />
              <div className="rounded-2xl bg-blue-50 dark:bg-blue-950/40 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-blue-700">Amount Due</p>
                <p className="mt-1 text-2xl font-black text-blue-900 dark:text-blue-300">{formatCurrency(getRPTAmountDue(selectedRPT() as CitizenRPTRecord))}</p>
              </div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Payment Method
                <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className={`${inputClass} mt-2`}>
                  {paymentMethods.map((method) => <option key={method}>{method}</option>)}
                </select>
              </label>
            </div>
            <div className="mt-6 flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button type="button" onClick={() => setIsPaymentOpen(false)} className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer">Cancel</button>
              <button type="button" onClick={confirmPayment} className="flex-1 rounded-xl bg-blue-800 px-4 py-3 text-sm font-bold text-white hover:bg-blue-900 cursor-pointer">Confirm Payment</button>
            </div>
          </div>
        </div>
      )}

      {/* EXACT BUSINESS TAX-STYLE DOCUMENT PREVIEW MODAL */}
      {previewFile && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate max-w-[320px]">{previewFile.name}</h4>
              </div>
              <button type="button" onClick={() => setPreviewFile(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer font-bold text-lg">✕</button>
            </div>

            <div className="h-[60vh] bg-slate-100 dark:bg-slate-950 rounded-2xl flex items-center justify-center border border-slate-200 dark:border-slate-800 overflow-hidden relative">
              {previewFile.url.startsWith('data:image/') || previewFile.url.match(/\.(jpeg|jpg|gif|png)$/i) ? (
                <img src={previewFile.url} alt="Document Preview" className="max-h-full max-w-full object-contain" />
              ) : (
                <iframe src={previewFile.url} title="Document Preview" className="w-full h-full border-0 bg-white" />
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setPreviewFile(null)}
                className="px-5 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 font-bold rounded-xl text-xs cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputClass = "w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-3 text-sm font-medium text-slate-800 dark:text-slate-200 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

function Field({ label, children, required = false }: { label: string; children: ReactNode; required?: boolean }) {
  return <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">{label} {required && <span className="text-rose-600">*</span>}<span className="mt-2 block">{children}</span></label>;
}

function UploadField({ label, name, onChange, required = false, help }: { label: string; name: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void; required?: boolean; help: string }) {
  return <label className="block rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4 text-xs font-bold text-slate-800 dark:text-slate-200">{label} {required && <span className="text-rose-600">*</span>}<span className="mt-1 block text-[11px] font-medium leading-4 text-slate-500 dark:text-slate-400">{help}</span><input type="file" name={name} onChange={onChange} required={required} className="mt-3 block w-full text-[11px] font-medium text-slate-500 dark:text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-100 file:px-3 file:py-2 file:text-xs file:font-bold file:text-blue-800 hover:file:bg-blue-200 cursor-pointer" /></label>;
}

function Summary({ title, items }: { title: string; items: string[][] }) {
  return <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-5"><h4 className="font-extrabold text-slate-900 dark:text-white">{title}</h4><dl className="mt-4 space-y-3">{items.map(([label, value]) => <div key={label} className="border-b border-slate-200 dark:border-slate-700 pb-3 last:border-b-0 last:pb-0"><dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 text-sm font-medium leading-5 text-slate-800 dark:text-slate-200 break-words">{value}</dd></div>)}</dl></section>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 font-medium leading-5 text-slate-800 dark:text-slate-200">{value}</p></div>;
}