import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../components/ThemeContext";
import "./CitizenRPT.css";
import {
  createRPTPaymentRequest,
  getCitizenSession,
  getRPTApplications,
  getRPTNotifications,
  getRPTOverview,
  getRPTPayments,
  getRPTProperties,
  getRPTTaxDetail,
  isCitizenSession,
  isUsingMockRPTData,
  markRPTNotificationsRead,
  resubmitRPTCompliance,
  submitRPTRequest,
} from "../services/rptService";
import type {
  CitizenSession,
  PaymentRequestPayload,
  RPTApplication,
  RPTApplicationStatus,
  RPTNotification,
  RPTOverview,
  RPTPayment,
  RPTPaymentMethod,
  RPTProperty,
  RPTTaxDetail,
} from "../services/rptService";

type RPTSection =
  | "dashboard"
  | "properties"
  | "tax-details"
  | "pay"
  | "payments"
  | "services"
  | "applications";

interface RequestDraft {
  serviceType: string;
  propertyId: string;
  applicantType: "Property Owner" | "Authorized Representative" | "Corporation/Company";
  applicantName: string;
  email: string;
  mobileNumber: string;
  notes: string;
}

const sections: Array<{ id: RPTSection; label: string; icon: string }> = [
  { id: "dashboard", label: "RPT Dashboard", icon: "▦" },
  { id: "properties", label: "My Properties", icon: "⌂" },
  { id: "tax-details", label: "Tax Details", icon: "₱" },
  { id: "pay", label: "Pay RPT", icon: "↗" },
  { id: "payments", label: "Payment History", icon: "◷" },
  { id: "services", label: "Tax Services / Requests", icon: "□" },
  { id: "applications", label: "Application Status", icon: "✓" },
];

const serviceTypes = [
  "New Tax Declaration",
  "Transfer of Ownership",
  "Segregation",
  "Consolidation",
  "New Assessment",
  "Reassessment",
  "Reclassification",
  "Correction / Updating / Revision",
  "Declaration of New / Undeclared Land",
  "Cancellation of Tax Declaration",
  "Certified True Copy of Tax Declaration",
  "Tax Map / Property-related Certification",
];

const applicationStatuses: RPTApplicationStatus[] = [
  "Submitted",
  "For Review",
  "Under Evaluation",
  "For Compliance",
  "Processing",
  "Approved",
  "Ready for Release",
  "Completed",
  "Rejected",
];

const paymentMethods: RPTPaymentMethod[] = ["GCash", "Maya", "Online Banking"];

function hasSharedAdminRPTRecords(): boolean {
  try {
    const raw = localStorage.getItem("lgu_rpt");
    const records = raw ? JSON.parse(raw) : [];
    return Array.isArray(records) && records.length > 0;
  } catch {
    return false;
  }
}

function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return "Not available";
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not available";
  const date = new Date(value + (value.length === 10 ? "T00:00:00" : ""));
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-PH", { year: "numeric", month: "short", day: "numeric" }).format(date);
}

function statusClass(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "paid" || normalized === "approved" || normalized === "completed" || normalized === "ready for release") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (normalized === "rejected" || normalized === "failed" || normalized === "overdue") {
    return "bg-rose-50 text-rose-700 border-rose-200";
  }
  if (normalized === "for compliance" || normalized === "unpaid" || normalized === "partially paid") {
    return "bg-amber-50 text-amber-800 border-amber-200";
  }
  return "bg-blue-50 text-blue-700 border-blue-200";
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-sm text-slate-500">Not available</span>;
  return <span className={"inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold " + statusClass(status)}>{status}</span>;
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={"rounded-2xl border border-slate-200 bg-white shadow-sm " + className}>{children}</section>;
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-b border-slate-100 py-3 last:border-b-0">
      <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <Panel className="p-10 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-lg text-slate-500">○</div>
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </Panel>
  );
}

function AccessScreen({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6 font-sans">
      <Panel className="w-full max-w-lg p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-blue-700">▣</div>
        <h1 className="text-xl font-extrabold text-slate-900">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
        <a href="/" className="mt-6 inline-flex rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800">Back to sign in</a>
      </Panel>
    </main>
  );
}

export default function CitizenRPT() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [session] = useState<CitizenSession | null>(() => getCitizenSession());
  const [properties, setProperties] = useState<RPTProperty[]>([]);
  const [payments, setPayments] = useState<RPTPayment[]>([]);
  const [applications, setApplications] = useState<RPTApplication[]>([]);
  const [notifications, setNotifications] = useState<RPTNotification[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [taxDetail, setTaxDetail] = useState<RPTTaxDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState("");
  const [propertyQuery, setPropertyQuery] = useState("");
  const [activeProperty, setActiveProperty] = useState<RPTProperty | null>(null);
  const [activePayment, setActivePayment] = useState<RPTPayment | null>(null);
  const [activeApplication, setActiveApplication] = useState<RPTApplication | null>(null);
  const [paymentStep, setPaymentStep] = useState(1);
  const [paymentPropertyId, setPaymentPropertyId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<RPTPaymentMethod | "">("");
  const [paymentResult, setPaymentResult] = useState<RPTPayment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentPropertyFilter, setPaymentPropertyFilter] = useState("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [paymentDateFrom, setPaymentDateFrom] = useState("");
  const [paymentDateTo, setPaymentDateTo] = useState("");
  const [applicationSearch, setApplicationSearch] = useState("");
  const [applicationStatusFilter, setApplicationStatusFilter] = useState("all");
  const [requestDocuments, setRequestDocuments] = useState<File[]>([]);
  const [complianceDocuments, setComplianceDocuments] = useState<File[]>([]);
  const [requestSuccess, setRequestSuccess] = useState<RPTApplication | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [requestDraft, setRequestDraft] = useState<RequestDraft>({
    serviceType: "",
    propertyId: "",
    applicantType: "Property Owner",
    applicantName: session?.fullname || "",
    email: session?.email || "",
    mobileNumber: "",
    notes: "",
  });

  const section = getSectionFromPath(location.pathname);
  const selectedProperty = properties.find((property) => property.id === selectedPropertyId) || null;
  const paymentProperty = properties.find((property) => property.id === paymentPropertyId) || null;
  const isDemo = isUsingMockRPTData();
  const hasSharedAdminRPT = hasSharedAdminRPTRecords();

  const displayOverview = useMemo<RPTOverview>(() => {
    const totalDue = properties.reduce((sum, property) => sum + (property.currentAmountDue ?? 0), 0);
    const outstanding = properties.reduce((sum, property) => sum + (property.outstandingBalance ?? 0), 0);
    const firstDueProperty = properties.find((property) => (property.currentAmountDue ?? 0) > 0);

    return {
      propertyCount: properties.length,
      currentAmountDue: totalDue,
      outstandingBalance: outstanding,
      nextDueDate: null,
      paymentStatus:
        properties.length && properties.every((property) => property.taxStatus === "Paid")
          ? "Paid"
          : firstDueProperty?.taxStatus || null,
      recentPayments: payments.slice(0, 5),
      recentApplications: applications.slice(0, 5),
    };
  }, [properties, payments, applications]);

  useEffect(() => {
    if (location.pathname.replace(/\/+$/, "").endsWith("/notifications")) {
      navigate("/citizen-rpt", { replace: true });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    let isMounted = true;

    async function loadCitizenRPT() {
      if (!isDemo && (!session || !isCitizenSession(session))) {
        if (isMounted) setIsLoading(false);
        return;
      }

      try {
        const [, nextProperties, nextPayments, nextApplications, nextNotifications] = await Promise.all([
          getRPTOverview(),
          getRPTProperties(),
          getRPTPayments(),
          getRPTApplications(),
          getRPTNotifications(),
        ]);
        if (!isMounted) return;
        setProperties(nextProperties);
        setPayments(nextPayments);
        setApplications(nextApplications);
        setNotifications(nextNotifications);
        setSelectedPropertyId((current) => current || nextProperties[0]?.id || "");
        setPaymentPropertyId((current) => current || nextProperties[0]?.id || "");
      } catch (error) {
        if (isMounted) setLoadError(error instanceof Error ? error.message : "Unable to load your RPT information.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadCitizenRPT();
    return () => { isMounted = false; };
  }, [isDemo, session]);

  useEffect(() => {
    let isMounted = true;

    async function loadTaxDetail() {
      if (!selectedPropertyId) {
        setTaxDetail(null);
        return;
      }
      try {
        const nextDetail = await getRPTTaxDetail(selectedPropertyId);
        if (isMounted) setTaxDetail(nextDetail);
      } catch (error) {
        if (isMounted) setLoadError(error instanceof Error ? error.message : "Unable to load tax details.");
      }
    }

    void loadTaxDetail();
    return () => { isMounted = false; };
  }, [selectedPropertyId]);

  const filteredProperties = useMemo(() => {
    const query = propertyQuery.trim().toLowerCase();
    if (!query) return properties;
    return properties.filter((property) => (
      [property.taxDeclarationNumber, property.referenceNumber, property.location, property.barangay, property.propertyType]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    ));
  }, [properties, propertyQuery]);

  const filteredPayments = useMemo(() => payments.filter((payment) => {
    const matchesSearch = !paymentSearch.trim() || [
      payment.paymentReference,
      payment.taxDeclarationNumber,
      payment.propertyLabel,
      payment.officialReceiptNumber,
    ].filter(Boolean).join(" ").toLowerCase().includes(paymentSearch.trim().toLowerCase());
    const matchesProperty = paymentPropertyFilter === "all" || payment.propertyId === paymentPropertyFilter;
    const matchesStatus = paymentStatusFilter === "all" || payment.status === paymentStatusFilter;
    const matchesFrom = !paymentDateFrom || Boolean(payment.paymentDate && payment.paymentDate >= paymentDateFrom);
    const matchesTo = !paymentDateTo || Boolean(payment.paymentDate && payment.paymentDate <= paymentDateTo);
    return matchesSearch && matchesProperty && matchesStatus && matchesFrom && matchesTo;
  }), [payments, paymentSearch, paymentPropertyFilter, paymentStatusFilter, paymentDateFrom, paymentDateTo]);

  const filteredApplications = useMemo(() => applications.filter((application) => {
    const matchesSearch = !applicationSearch.trim() || [
      application.controlNumber,
      application.transactionType,
      application.taxDeclarationNumber,
    ].filter(Boolean).join(" ").toLowerCase().includes(applicationSearch.trim().toLowerCase());
    return matchesSearch && (applicationStatusFilter === "all" || application.status === applicationStatusFilter);
  }), [applications, applicationSearch, applicationStatusFilter]);

  function goTo(next: RPTSection) {
    navigate(next === "dashboard" ? "/citizen-rpt" : "/citizen-rpt/" + next);
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast((current) => current === message ? "" : current), 4500);
  }

  async function submitPayment() {
    if (!paymentProperty || !paymentMethod) {
      showToast("Select a property and payment method before continuing.");
      return;
    }

    const amount =
      taxDetail?.propertyId === paymentProperty.id
        ? taxDetail.totalAmountPayable
        : paymentProperty.currentAmountDue;

    if (amount === null || amount === undefined || amount <= 0) {
      showToast("This property has no outstanding RPT balance available for payment.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: PaymentRequestPayload = {
        propertyId: paymentProperty.id,
        amount,
        paymentMethod,
      };

      const result = await createRPTPaymentRequest(payload);

      setPayments((current) => [result, ...current]);
      setPaymentResult(result);
      setPaymentStep(4);

      if (result.status === "Paid") {
        showToast(`Payment successful. Reference: ${result.paymentReference}.`);
      } else {
        showToast(`Payment reference created: ${result.paymentReference}.`);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to process the RPT payment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requestDraft.serviceType || !requestDraft.applicantName || !requestDraft.email || !requestDraft.mobileNumber) {
      showToast("Complete the service, applicant name, email, and mobile number.");
      return;
    }
    if (requestDraft.applicantType === "Authorized Representative" && !requestDocuments.length) {
      showToast("Attach the authorization document before submitting as a representative.");
      return;
    }

    setIsSubmitting(true);
    try {
      const property = properties.find((item) => item.id === requestDraft.propertyId);
      const application = await submitRPTRequest({
        ...requestDraft,
        taxDeclarationNumber: property?.taxDeclarationNumber,
        documents: requestDocuments,
      });
      setApplications((current) => [application, ...current]);
      setRequestSuccess(application);
      setRequestDocuments([]);
      showToast("Request submitted. Your control number is ready for tracking.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to submit the tax service request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resubmitCompliance() {
    if (!activeApplication) return;

    setIsSubmitting(true);
    try {
      const updated = await resubmitRPTCompliance(activeApplication.id, complianceDocuments);
      setApplications((current) => current.map((item) => item.id === updated.id ? updated : item));
      setActiveApplication(updated);
      setComplianceDocuments([]);
      showToast("Compliance documents were resubmitted. Officer review is still required.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to resubmit compliance documents.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function markAllNotificationsRead() {
    try {
      await markRPTNotificationsRead();
      setNotifications((current) => current.map((notification) => ({ ...notification, isRead: true })));
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to update notifications.");
    }
  }

  async function openNotification(notification: RPTNotification) {
    if (!notification.isRead) {
      try {
        await markRPTNotificationsRead([notification.id]);
        setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, isRead: true } : item));
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Unable to update this notification.");
      }
    }
    setIsNotificationsOpen(false);
    if (notification.targetPath) navigate(notification.targetPath);
  }

  if (!isDemo && !session) {
    return <AccessScreen title="Sign in required" body="Sign in with a citizen account before accessing your Real Property Tax records and requests." />;
  }

  if (!isDemo && !isCitizenSession(session)) {
    return <AccessScreen title="Citizen access only" body="The citizen RPT module is not available to this account role." />;
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6 font-sans text-slate-600">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm font-semibold shadow-sm">Loading your RPT workspace…</div>
      </main>
    );
  }

  if (loadError && !properties.length) {
    return <AccessScreen title="RPT information is unavailable" body={loadError + " Please try again later or contact the treasury office."} />;
  }

  const unreadNotifications = notifications.filter((notification) => !notification.isRead).length;
  const paymentAmount = paymentProperty
    ? (taxDetail?.propertyId === paymentProperty.id ? taxDetail.totalAmountPayable : paymentProperty.currentAmountDue)
    : null;

  return (
    <div className="citizen-rpt-shell min-h-screen bg-slate-100 font-sans text-slate-800">
      <aside className={`fixed left-0 top-0 z-50 hidden h-screen shrink-0 flex-col border-r border-[#1c2541] bg-[#0b132b] p-4 shadow-xl transition-[width] duration-300 lg:flex ${isSidebarCollapsed ? "w-20" : "w-64"}`}>
        <div className="flex items-center gap-3 px-1 py-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1d4ed8] text-xs font-black text-white shadow-sm">GS</div>
          {!isSidebarCollapsed && <div className="min-w-0"><h2 className="truncate text-[11px] font-semibold uppercase tracking-wider text-white">Treasury &amp; Revenue</h2><p className="truncate text-sm font-bold tracking-tight text-white">GovServe</p></div>}
        </div>

        <div className="mt-6">
          <button onClick={() => setIsSidebarCollapsed((current) => !current)} className="flex w-full items-center gap-3 rounded-lg border border-[#2d3748] bg-[#1c2541] p-2 text-slate-300 transition-colors hover:bg-[#3a506b]" title="Toggle sidebar" aria-label="Toggle sidebar">
            <span className="flex w-5 shrink-0 justify-center"><svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg></span>
            {!isSidebarCollapsed && <span className="truncate text-xs font-semibold uppercase tracking-wider">Menu</span>}
          </button>
        </div>

        <nav className="mt-6 min-h-0 flex-1 space-y-1 overflow-y-auto">
          {!isSidebarCollapsed && <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Modules</p>}
          {sections.map((item) => (
            <button key={item.id} onClick={() => goTo(item.id)} title={item.label} className={"flex w-full min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all duration-150 " + (section === item.id ? "bg-[#1d4ed8] font-bold text-white shadow-sm" : "text-slate-300 hover:bg-[#1c2541] hover:text-white")}>
              <span className="w-5 shrink-0 text-center text-base" aria-hidden="true">{item.icon}</span>
              {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
            </button>
          ))}
        </nav>

        {!isSidebarCollapsed && <div className="mt-5 rounded-xl border border-[#2d4e80] bg-[#102044] p-3"><p className="text-[11px] font-bold text-white">Secure citizen access</p><p className="mt-1 text-[11px] leading-4 text-slate-300">Only records linked to your authenticated account are shown here.</p></div>}
      </aside>

      <header className={`fixed right-0 top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm transition-[left] duration-300 ${isSidebarCollapsed ? "left-0 lg:left-20" : "left-0 lg:left-64"}`}>
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Citizen RPT Portal</span>
        <div className="flex items-center gap-1.5">
          {isDemo && <span className="hidden rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-800 md:inline">Demo / mock data</span>}
          <button type="button" onClick={toggleTheme} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            {theme === "dark" ? <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364-6.364-1.414 1.414M7.05 16.95l-1.414 1.414m12.728 0-1.414-1.414M7.05 7.05 5.636 5.636M12 8a4 4 0 100 8 4 4 0 000-8z" /></svg> : <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9 9 0 1019.354 14.354c.348.348.348.91 0 1z" /></svg>}
          </button>

          <div className="relative">
            <button type="button" onClick={() => setIsNotificationsOpen((current) => !current)} className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Open notifications" aria-expanded={isNotificationsOpen} aria-controls="rpt-notification-panel">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              {unreadNotifications > 0 && <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white">{unreadNotifications}</span>}
            </button>

            {isNotificationsOpen && <div id="rpt-notification-panel" role="region" aria-label="Notifications" className="absolute right-0 top-11 z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div><p className="text-sm font-bold text-slate-900">Notifications</p><p className="text-[11px] text-slate-500">Payment and application updates</p></div><button onClick={() => void markAllNotificationsRead()} disabled={!unreadNotifications} className="text-[11px] font-bold text-blue-700 disabled:cursor-not-allowed disabled:opacity-50">Mark all read</button></div><div className="max-h-[min(65vh,32rem)] overflow-y-auto">{notifications.length ? notifications.map((notification) => <button key={notification.id} onClick={() => void openNotification(notification)} className={"flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-b-0 " + (notification.isRead ? "bg-white hover:bg-slate-50" : "bg-blue-50 hover:bg-blue-100")}><span className={"mt-1.5 h-2 w-2 shrink-0 rounded-full " + (notification.isRead ? "bg-slate-300" : "bg-blue-600")} /><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-900">{notification.title}</span><span className="mt-1 block text-xs leading-5 text-slate-600">{notification.message}</span><span className="mt-1.5 block text-[11px] text-slate-500">{formatDate(notification.createdAt)}</span></span></button>) : <p className="px-4 py-8 text-center text-sm text-slate-500">You have no RPT notifications.</p>}</div></div>}
          </div>

          <button type="button" onClick={() => navigate("/citizen-portal")} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 transition-colors hover:bg-slate-50" title="Return to citizen portal">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">{(session?.fullname || "G").charAt(0)}</span>
            <span className="hidden max-w-40 text-left md:block"><span className="block truncate text-xs font-semibold text-slate-800">{session?.fullname || "Guest demo"}</span><span className="block truncate text-[10px] text-slate-400">Citizen</span></span>
          </button>
        </div>
      </header>

      <main className={`min-w-0 p-4 pt-20 transition-[margin] duration-300 sm:p-6 sm:pt-20 lg:p-8 lg:pt-[88px] ${isSidebarCollapsed ? "lg:ml-20" : "lg:ml-64"}`}>
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-5 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {sections.map((item) => (
              <button key={item.id} onClick={() => goTo(item.id)} className={"whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold " + (section === item.id ? "border-blue-700 bg-blue-700 text-white" : "border-slate-200 bg-white text-slate-600")}>{item.label}</button>
            ))}
          </div>

          {isDemo && !hasSharedAdminRPT && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <span className="mt-0.5 font-black">!</span>
              <p><strong>Demo / mock data is active.</strong> The shared Admin RPT records are not available, so the portal may show interface-test data. Set <code className="rounded bg-amber-100 px-1">VITE_RPT_USE_MOCK=false</code> when the protected RPT API is ready.</p>
            </div>
          )}

          {loadError && <div role="alert" className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{loadError}</div>}

          {section === "dashboard" && (
            <>
              <PageTitle title="RPT Dashboard" description="View your property tax information, payment activity, and service requests." />
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="My properties" value={String(displayOverview.propertyCount)} hint="Associated with your account" />
                <Metric label="Current amount due" value={formatMoney(displayOverview.currentAmountDue)} hint="Official amount when provided" />
                <Metric label="Outstanding balance" value={formatMoney(displayOverview.outstandingBalance)} hint="Includes official balances only" />
                <Metric label="Next due date" value={formatDate(displayOverview.nextDueDate)} hint={<StatusBadge status={displayOverview.paymentStatus} />} />
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_1fr]">
                <Panel className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><h2 className="font-bold text-slate-900">Quick actions</h2><p className="mt-1 text-sm text-slate-500">Start a citizen-side RPT task.</p></div>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <QuickAction title="View My Properties" body="See property information linked to your account." onClick={() => goTo("properties")} />
                    <QuickAction title="View Tax Details" body="Review backend-supplied assessment and tax due details." onClick={() => goTo("tax-details")} />
                    <QuickAction title="Pay RPT" body="Pay an outstanding RPT balance through a configured digital channel." onClick={() => goTo("pay")} />
                    <QuickAction title="Payment History" body="Search payment references and their official status." onClick={() => goTo("payments")} />
                    <QuickAction title="Request Tax Document" body="Submit a property-related tax service request." onClick={() => goTo("services")} />
                    <QuickAction title="Track Application" body="Check request status or submit missing documents." onClick={() => goTo("applications")} />
                  </div>
                </Panel>

                <Panel className="p-5">
                  <div className="flex items-center justify-between"><h2 className="font-bold text-slate-900">Recent applications</h2><button onClick={() => goTo("applications")} className="text-xs font-bold text-blue-700 hover:text-blue-900">View all</button></div>
                  <div className="mt-3 divide-y divide-slate-100">
                    {applications.slice(0, 3).map((application) => <button key={application.id} onClick={() => { setActiveApplication(application); goTo("applications"); }} className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-slate-50"><span><span className="block text-sm font-bold text-slate-800">{application.controlNumber}</span><span className="block text-xs text-slate-500">{application.transactionType}</span></span><StatusBadge status={application.status} /></button>)}
                    {!applications.length && <p className="py-6 text-center text-sm text-slate-500">No applications yet.</p>}
                  </div>
                </Panel>
              </div>

              <Panel className="mt-6 overflow-hidden">
                <div className="flex items-center justify-between p-5"><div><h2 className="font-bold text-slate-900">Recent RPT transactions</h2><p className="mt-1 text-sm text-slate-500">Payment status is confirmed only by the backend/payment provider.</p></div><button onClick={() => goTo("payments")} className="text-xs font-bold text-blue-700">View history</button></div>
                <PaymentTable payments={payments.slice(0, 5)} onView={setActivePayment} />
              </Panel>
            </>
          )}

          {section === "properties" && (
            <>
              <PageTitle title="My Properties" description="Properties returned by the protected RPT service for your citizen account." />
              <Panel className="mb-5 p-4">
                <label className="sr-only" htmlFor="property-search">Search properties</label>
                <input id="property-search" value={propertyQuery} onChange={(event) => setPropertyQuery(event.target.value)} placeholder="Search tax declaration number, location, barangay, or property type" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
              </Panel>
              {!filteredProperties.length ? <EmptyState title="No matching properties" body="Try another search term. Once the RPT API is connected, only properties associated with your account will appear here." /> : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {filteredProperties.map((property) => (
                    <Panel key={property.id} className="p-5">
                      <div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-700">Tax declaration</p><h2 className="mt-1 text-lg font-extrabold text-slate-900">{property.taxDeclarationNumber}</h2></div><StatusBadge status={property.taxStatus} /></div>
                      <p className="mt-3 text-sm font-semibold text-slate-800">{property.location}</p><p className="mt-1 text-sm text-slate-500">{property.barangay} · {property.propertyType}</p>
                      <div className="mt-4 grid grid-cols-2 gap-3 border-y border-slate-100 py-4 text-sm"><div><p className="text-xs text-slate-500">Outstanding balance</p><p className="mt-1 font-bold text-slate-900">{formatMoney(property.outstandingBalance)}</p></div><div><p className="text-xs text-slate-500">Last payment</p><p className="mt-1 font-bold text-slate-900">{formatDate(property.lastPaymentDate)}</p></div></div>
                      <div className="mt-4 flex flex-wrap gap-2"><button onClick={() => setActiveProperty(property)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">View property details</button><button onClick={() => { setSelectedPropertyId(property.id); goTo("tax-details"); }} className="rounded-xl bg-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-blue-800">View tax details</button></div>
                    </Panel>
                  ))}
                </div>
              )}
            </>
          )}

          {section === "tax-details" && (
            <>
              <PageTitle title="Real Property Tax Details" description="Official assessment and tax figures must be supplied by the RPT backend; this screen does not calculate taxes." />
              {properties.length ? (
                <>
                  <Panel className="p-5"><label htmlFor="tax-property" className="text-sm font-bold text-slate-800">Select property</label><select id="tax-property" value={selectedPropertyId} onChange={(event) => setSelectedPropertyId(event.target.value)} className="mt-2 w-full max-w-xl rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600">{properties.map((property) => {
                        const due = property.outstandingBalance ?? property.currentAmountDue ?? 0;
                        return (
                          <option key={property.id} value={property.id} disabled={due <= 0}>
                            {property.taxDeclarationNumber} · {property.location} · {formatMoney(due)} due
                          </option>
                        );
                      })}</select></Panel>
                  <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1.2fr]">
                    <Panel className="p-5"><h2 className="font-bold text-slate-900">Property information</h2><dl className="mt-3"><Field label="Tax Declaration Number" value={selectedProperty?.taxDeclarationNumber || "Not available"} /><Field label="Property reference number" value={selectedProperty?.referenceNumber || "Not available"} /><Field label="Property location" value={selectedProperty?.location || "Not available"} /><Field label="Barangay" value={selectedProperty?.barangay || "Not available"} /><Field label="Property type" value={selectedProperty?.propertyType || "Not available"} /><Field label="Land area" value={selectedProperty?.landArea ? selectedProperty.landArea + " sq. m." : "Not available"} /></dl></Panel>
                    <Panel className="p-5"><h2 className="font-bold text-slate-900">Assessment and tax due</h2><div className="mt-4 grid gap-x-6 sm:grid-cols-2"><dl><Field label="Billing year" value={taxDetail?.billingYear || "Not available"} /><Field label="Assessment information" value={taxDetail?.assessmentLevel || "Not available"} /><Field label="Assessed value" value={formatMoney(taxDetail?.assessedValue)} /><Field label="Applicable tax information" value={taxDetail?.applicableTaxInfo || "Not available"} /></dl><dl><Field label="Current amount due" value={formatMoney(taxDetail?.currentAmountDue)} /><Field label="Previous balance" value={formatMoney(taxDetail?.previousBalance)} /><Field label="Penalties / interest" value={formatMoney(taxDetail?.penaltiesInterest)} /><Field label="Total amount payable" value={<strong>{formatMoney(taxDetail?.totalAmountPayable)}</strong>} /><Field label="Due date" value={formatDate(taxDetail?.dueDate)} /><Field label="Payment status" value={<StatusBadge status={taxDetail?.paymentStatus} />} /></dl></div></Panel>
                  </div>
                  <Panel className="mt-5 p-5"><h2 className="font-bold text-slate-900">RPT payment flow</h2><div className="mt-5 grid gap-3 sm:grid-cols-5">{["Property", "Assessment", "Tax Due", "Payment", "Payment History"].map((step, index) => <div key={step} className="flex items-center gap-2 text-sm font-bold text-slate-700"><span className={"flex h-7 w-7 items-center justify-center rounded-full " + (index < 3 ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-500")}>{index + 1}</span>{step}</div>)}</div><p className="mt-4 text-xs leading-5 text-slate-500">The portal displays official backend values and payment confirmations; it does not create assessment rules, alter assessed values, or calculate tax liability.</p></Panel>
                </>
              ) : <EmptyState title="No property is available" body="Property tax details will be available when an eligible property is returned by the RPT service." />}
            </>
          )}

          {section === "pay" && (
            <>
              <PageTitle title="Pay Real Property Tax" description="Pay an existing Real Property Tax assessment through the available online payment channels. The final payment status and official receipt come from the configured payment service." />
              <Panel className="p-5">
                <ol className="grid gap-3 sm:grid-cols-4">{["Select property", "Choose channel", "Review", "Payment result"].map((label, index) => <li key={label} className={"flex items-center gap-2 text-sm font-bold " + (paymentStep >= index + 1 ? "text-blue-800" : "text-slate-400")}><span className={"flex h-7 w-7 items-center justify-center rounded-full text-xs " + (paymentStep >= index + 1 ? "bg-blue-700 text-white" : "bg-slate-100")}>{index + 1}</span>{label}</li>)}</ol>
              </Panel>
              <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]">
                <Panel className="p-5">
                  {paymentStep === 1 && <div><h2 className="font-bold text-slate-900">1. Select property</h2><label htmlFor="payment-property" className="mt-4 block text-sm font-semibold text-slate-700">Property</label><select id="payment-property" value={paymentPropertyId} onChange={(event) => setPaymentPropertyId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-600">{properties.map((property) => {
                        const due = property.outstandingBalance ?? property.currentAmountDue ?? 0;
                        return (
                          <option key={property.id} value={property.id} disabled={due <= 0}>
                            {property.taxDeclarationNumber} · {property.location} · {formatMoney(due)} due
                          </option>
                        );
                      })}</select><button onClick={() => setPaymentStep(2)} disabled={!paymentProperty} className="mt-6 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">Continue</button></div>}
                  {paymentStep === 2 && <div><h2 className="font-bold text-slate-900">2. Select payment method</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{paymentMethods.map((method) => <button key={method} onClick={() => setPaymentMethod(method)} className={"rounded-xl border p-4 text-left text-sm font-bold " + (paymentMethod === method ? "border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-100" : "border-slate-200 text-slate-700 hover:bg-slate-50")}><span className="block text-base">◉</span><span className="mt-2 block">{method}</span><span className="mt-1 block text-xs font-normal text-slate-500">Online payment channel for your RPT transaction.</span></button>)}</div><div className="mt-6 flex gap-2"><button onClick={() => setPaymentStep(1)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700">Back</button><button onClick={() => setPaymentStep(3)} disabled={!paymentMethod} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Review request</button></div></div>}
                  {paymentStep === 3 && <div><h2 className="font-bold text-slate-900">3. Review RPT payment</h2><div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm"><p className="font-bold text-slate-900">{paymentProperty?.taxDeclarationNumber}</p><p className="mt-1 text-slate-600">{paymentProperty?.location}</p><dl className="mt-4 space-y-2 border-t border-slate-200 pt-3"><div className="flex justify-between gap-4"><dt className="text-slate-500">Amount due</dt><dd className="font-bold text-slate-900">{formatMoney(paymentAmount)}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Payment method</dt><dd className="font-bold text-slate-900">{paymentMethod}</dd></div></dl></div><p className="mt-4 text-xs leading-5 text-slate-500">Review the official amount due and selected payment channel before continuing. The backend/payment service remains responsible for the final payment status and official receipt.</p><div className="mt-6 flex gap-2"><button onClick={() => setPaymentStep(2)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700">Back</button><button onClick={() => void submitPayment()} disabled={isSubmitting || paymentAmount === null || paymentAmount === undefined || paymentAmount <= 0} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{isSubmitting ? "Processing…" : "Proceed to Payment"}</button></div></div>}
                  {paymentStep === 4 && <div className="text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-xl text-blue-700">✓</div><h2 className="mt-3 font-bold text-slate-900">{paymentResult?.status === "Paid" ? "Payment Successful" : "Payment Reference Created"}</h2><p className="mt-2 text-sm text-slate-500">{paymentResult?.status === "Paid" ? "Your RPT payment has been recorded by the configured payment service." : "Your payment reference has been created and remains subject to backend/payment-channel confirmation."}</p><div className="mx-auto mt-5 max-w-md rounded-xl border border-slate-200 bg-slate-50 p-4 text-left"><Field label="Payment reference" value={paymentResult?.paymentReference || "Not available"} /><Field label="Status" value={<StatusBadge status={paymentResult?.status} />} /><Field label="Official receipt" value={paymentResult?.officialReceiptNumber || "Not available until backend confirmation"} /></div><button onClick={() => { setPaymentStep(1); setPaymentMethod(""); setPaymentResult(null); goTo("payments"); }} className="mt-5 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white">View payment history</button></div>}
                </Panel>
                <Panel className="h-fit p-5"><h2 className="font-bold text-slate-900">Payment summary</h2><dl className="mt-3"><Field label="Tax Declaration Number" value={paymentProperty?.taxDeclarationNumber || "Select a property"} /><Field label="Amount due" value={formatMoney(paymentAmount)} /><Field label="Current payment status" value={<StatusBadge status={paymentProperty?.taxStatus} />} /><Field label="Official receipt" value="Issued by backend only" /></dl></Panel>
              </div>
            </>
          )}

          {section === "payments" && (
            <>
              <PageTitle title="RPT Payment History" description="Search your RPT payment references, payment status, amount, method, and official receipt information returned by the payment service." />
              <Panel className="p-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"><input value={paymentSearch} onChange={(event) => setPaymentSearch(event.target.value)} placeholder="Search reference or property" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-600" /><select value={paymentPropertyFilter} onChange={(event) => setPaymentPropertyFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="all">All properties</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.taxDeclarationNumber}</option>)}</select><select value={paymentStatusFilter} onChange={(event) => setPaymentStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="all">All statuses</option>{["Pending Payment", "Processing", "Paid", "Failed", "Cancelled"].map((status) => <option key={status} value={status}>{status}</option>)}</select><input type="date" value={paymentDateFrom} onChange={(event) => setPaymentDateFrom(event.target.value)} aria-label="Payment date from" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /><input type="date" value={paymentDateTo} onChange={(event) => setPaymentDateTo(event.target.value)} aria-label="Payment date to" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></div></Panel>
              <Panel className="mt-5 overflow-hidden">{filteredPayments.length ? <PaymentTable payments={filteredPayments} onView={setActivePayment} /> : <div className="p-8"><EmptyState title="No matching payments" body="Try adjusting the search or filters. A payment reference will appear here after the backend accepts a request." /></div>}</Panel>
            </>
          )}

          {section === "services" && (
            <>
              <PageTitle title="Tax Services / Property Document Requests" description="Submit a citizen request with its documents. Officer-controlled review, verification, and approval remain outside this module." />
              {requestSuccess ? <Panel className="mb-5 border-emerald-200 bg-emerald-50 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold text-emerald-900">Request submitted</p><p className="mt-1 text-sm text-emerald-800">Control number: <strong>{requestSuccess.controlNumber}</strong>. Track the request for backend-supplied updates.</p></div><button onClick={() => { setRequestSuccess(null); goTo("applications"); }} className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Track application</button></div></Panel> : null}
              <Panel className="p-5"><form onSubmit={submitRequest}><div className="grid gap-5 lg:grid-cols-2"><div><label className="text-sm font-bold text-slate-800" htmlFor="service-type">Service requested *</label><select id="service-type" value={requestDraft.serviceType} onChange={(event) => setRequestDraft((current) => ({ ...current, serviceType: event.target.value }))} required className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="">Select a tax service</option>{serviceTypes.map((service) => <option key={service} value={service}>{service}</option>)}</select></div><div><label className="text-sm font-bold text-slate-800" htmlFor="request-property">Property / Tax Declaration Number</label><select id="request-property" value={requestDraft.propertyId} onChange={(event) => setRequestDraft((current) => ({ ...current, propertyId: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="">No linked property / enter during review</option>{properties.map((property) => {
                        const due = property.outstandingBalance ?? property.currentAmountDue ?? 0;
                        return (
                          <option key={property.id} value={property.id} disabled={due <= 0}>
                            {property.taxDeclarationNumber} · {property.location} · {formatMoney(due)} due
                          </option>
                        );
                      })}</select></div><div><label className="text-sm font-bold text-slate-800" htmlFor="applicant-type">Applicant type *</label><select id="applicant-type" value={requestDraft.applicantType} onChange={(event) => setRequestDraft((current) => ({ ...current, applicantType: event.target.value as RequestDraft["applicantType"] }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option>Property Owner</option><option>Authorized Representative</option><option>Corporation/Company</option></select></div><div><label className="text-sm font-bold text-slate-800" htmlFor="applicant-name">Applicant name *</label><input id="applicant-name" value={requestDraft.applicantName} onChange={(event) => setRequestDraft((current) => ({ ...current, applicantName: event.target.value }))} required className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" /></div><div><label className="text-sm font-bold text-slate-800" htmlFor="request-email">Email *</label><input id="request-email" type="email" value={requestDraft.email} onChange={(event) => setRequestDraft((current) => ({ ...current, email: event.target.value }))} required className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" /></div><div><label className="text-sm font-bold text-slate-800" htmlFor="request-mobile">Mobile number *</label><input id="request-mobile" inputMode="numeric" value={requestDraft.mobileNumber} onChange={(event) => setRequestDraft((current) => ({ ...current, mobileNumber: event.target.value.replace(/\D/g, "").slice(0, 11) }))} placeholder="09XXXXXXXXX" required className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" /></div></div><div className="mt-5"><label className="text-sm font-bold text-slate-800" htmlFor="request-notes">Request details / notes</label><textarea id="request-notes" value={requestDraft.notes} onChange={(event) => setRequestDraft((current) => ({ ...current, notes: event.target.value }))} rows={4} placeholder="Provide information required by the selected service. Do not enter sensitive information not requested by the official process." className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" /></div><div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4"><label className="block text-sm font-bold text-slate-800" htmlFor="request-documents">Supporting documents</label><p className="mt-1 text-xs leading-5 text-slate-500">Upload the files required by the official service. The backend will later validate file type, size, and requirements.</p><input id="request-documents" type="file" multiple onChange={(event) => setRequestDocuments(Array.from(event.target.files || []))} className="mt-3 block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-100 file:px-3 file:py-2 file:text-xs file:font-bold file:text-blue-800" />{requestDocuments.length > 0 && <FileList files={requestDocuments} />}{requestDraft.applicantType === "Authorized Representative" && <p className="mt-3 text-xs font-semibold text-amber-800">An authorization document is required for an authorized representative.</p>}</div><div className="mt-6 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setRequestDraft((current) => ({ ...current, serviceType: "", propertyId: "", notes: "" }))} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700">Clear service selection</button><button type="submit" disabled={isSubmitting} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{isSubmitting ? "Submitting…" : "Review and submit request"}</button></div></form></Panel>
            </>
          )}

          {section === "applications" && (
            <>
              <PageTitle title="RPT Application Status" description="Track citizen-side requests. Status, remarks, and approval are supplied and controlled by the backend." />
              <div className="mb-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => navigate("/real-property-application")}
                  className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-800"
                >
                  + New Single Transaction
                </button>
              </div>
              <Panel className="p-4"><div className="grid gap-3 md:grid-cols-[1fr_220px]"><input value={applicationSearch} onChange={(event) => setApplicationSearch(event.target.value)} placeholder="Search control number, service, or tax declaration" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-600" /><select value={applicationStatusFilter} onChange={(event) => setApplicationStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="all">All statuses</option>{applicationStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></div></Panel>
              <div className="mt-5 space-y-4">{filteredApplications.length ? filteredApplications.map((application) => <Panel key={application.id} className="p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-slate-900">{application.controlNumber}</h2><StatusBadge status={application.status} /></div><p className="mt-2 text-sm font-semibold text-slate-700">{application.transactionType}</p><p className="mt-1 text-xs text-slate-500">Tax Declaration: {application.taxDeclarationNumber || "Not available"} · Submitted {formatDate(application.dateSubmitted)}</p>{application.remarks && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{application.remarks}</p>}</div><button onClick={() => setActiveApplication(application)} className="h-fit rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">View status details</button></div>{application.status === "For Compliance" && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><strong>Action required:</strong> {application.requiredAction || "Submit the missing requirements."}<button onClick={() => setActiveApplication(application)} className="ml-2 text-xs font-bold underline">Open compliance upload</button></div>}</Panel>) : <EmptyState title="No matching applications" body="Submit a tax service request to receive a control/reference number and track its status here." />}</div>
            </>
          )}

          
        </div>
        </main>

      {activeProperty && <Modal title="Property details" onClose={() => setActiveProperty(null)}><dl><Field label="Tax Declaration Number" value={activeProperty.taxDeclarationNumber} /><Field label="Property reference number" value={activeProperty.referenceNumber || "Not available"} /><Field label="Property owner" value={activeProperty.ownerName} /><Field label="Property location" value={activeProperty.location} /><Field label="Barangay" value={activeProperty.barangay} /><Field label="Property type" value={activeProperty.propertyType} /><Field label="Land area" value={activeProperty.landArea ? activeProperty.landArea + " sq. m." : "Not available"} /><Field label="Market / fair market value" value={formatMoney(activeProperty.marketValue)} /><Field label="Assessed value" value={formatMoney(activeProperty.assessedValue)} /><Field label="Current tax status" value={<StatusBadge status={activeProperty.taxStatus} />} /><Field label="Outstanding balance" value={formatMoney(activeProperty.outstandingBalance)} /><Field label="Last payment date" value={formatDate(activeProperty.lastPaymentDate)} /></dl><p className="mt-5 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">Official assessments, tax rates, balances, and property records are read-only for citizens.</p></Modal>}
      {activePayment && <Modal title="Payment details" onClose={() => setActivePayment(null)}><dl><Field label="Payment / reference number" value={activePayment.paymentReference} /><Field label="Tax Declaration Number" value={activePayment.taxDeclarationNumber} /><Field label="Property" value={activePayment.propertyLabel} /><Field label="Payment date" value={formatDate(activePayment.paymentDate)} /><Field label="Amount paid / requested" value={formatMoney(activePayment.amount)} /><Field label="Payment method" value={activePayment.paymentMethod} /><Field label="Payment status" value={<StatusBadge status={activePayment.status} />} /><Field label="Official receipt / reference number" value={activePayment.officialReceiptNumber || "Not available"} /></dl><p className="mt-5 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">The official receipt number shown here must come from the configured backend/payment service. The citizen portal does not invent official government receipt records.</p></Modal>}
      {activeApplication && <Modal title="Application status details" onClose={() => { setActiveApplication(null); setComplianceDocuments([]); }}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-lg font-extrabold text-slate-900">{activeApplication.controlNumber}</p><p className="mt-1 text-sm text-slate-500">{activeApplication.transactionType}</p></div><StatusBadge status={activeApplication.status} /></div><dl className="mt-4"><Field label="Tax Declaration Number" value={activeApplication.taxDeclarationNumber || "Not available"} /><Field label="Date submitted" value={formatDate(activeApplication.dateSubmitted)} /><Field label="Last updated" value={formatDate(activeApplication.lastUpdated)} /><Field label="Remarks" value={activeApplication.remarks || "No remarks provided"} /></dl><h3 className="mt-5 text-sm font-bold text-slate-900">Status history</h3><ol className="mt-3 space-y-3 border-l-2 border-slate-200 pl-4">{activeApplication.statusHistory.map((item, index) => <li key={item.date + item.status + index} className="relative"><span className="absolute -left-[22px] top-1 h-2.5 w-2.5 rounded-full bg-blue-600" /><div className="flex flex-wrap items-center gap-2"><StatusBadge status={item.status} /><span className="text-xs text-slate-500">{formatDate(item.date)}</span></div>{item.remarks && <p className="mt-1 text-sm text-slate-600">{item.remarks}</p>}</li>)}</ol>{activeApplication.status === "For Compliance" && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-bold text-amber-900">For compliance</p><p className="mt-1 text-sm text-amber-800">{activeApplication.requiredAction || "Upload the missing requirements."}</p>{activeApplication.missingRequirements?.length ? <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-900">{activeApplication.missingRequirements.map((item) => <li key={item}>{item}</li>)}</ul> : null}<label className="mt-4 block text-sm font-bold text-amber-900" htmlFor="compliance-documents">Upload missing document(s)</label><input id="compliance-documents" type="file" multiple onChange={(event) => setComplianceDocuments(Array.from(event.target.files || []))} className="mt-2 block w-full text-xs text-amber-900 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-200 file:px-3 file:py-2 file:text-xs file:font-bold file:text-amber-900" />{complianceDocuments.length > 0 && <FileList files={complianceDocuments} />}<button onClick={() => void resubmitCompliance()} disabled={isSubmitting || !complianceDocuments.length} className="mt-4 rounded-xl bg-amber-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{isSubmitting ? "Resubmitting…" : "Resubmit compliance documents"}</button><p className="mt-3 text-xs leading-5 text-amber-800">Resubmission does not change an officer-controlled application status. Backend review is required.</p></div>}</Modal>}

      {toast && <div role="status" className="fixed bottom-5 right-5 z-50 max-w-md rounded-xl border border-slate-200 bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xl">{toast}</div>}
    </div>
  );
}

function getSectionFromPath(pathname: string): RPTSection {
  const lastPart = pathname.replace(/\/+$/, "").split("/").pop();
  return sections.some((item) => item.id === lastPart) ? lastPart as RPTSection : "dashboard";
}

function PageTitle({ title, description, compact = false }: { title: string; description: string; compact?: boolean }) {
  return <div className={compact ? "" : "mb-6"}><h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1><p className="mt-1.5 text-sm leading-6 text-slate-500">{description}</p></div>;
}

function Metric({ label, value, hint }: { label: string; value: string; hint: ReactNode }) {
  return <Panel className="p-5"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-xl font-extrabold tracking-tight text-slate-900">{value}</p><div className="mt-2 text-xs text-slate-500">{hint}</div></Panel>;
}

function QuickAction({ title, body, onClick }: { title: string; body: string; onClick: () => void }) {
  return <button onClick={onClick} className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50"><span className="block text-sm font-bold text-slate-900">{title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{body}</span><span className="mt-3 block text-xs font-bold text-blue-700">Open →</span></button>;
}

function PaymentTable({ payments, onView }: { payments: RPTPayment[]; onView: (payment: RPTPayment) => void }) {
  return <div className="overflow-x-auto"><table className="min-w-[780px] w-full text-left text-sm"><thead className="border-y border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Reference</th><th className="px-5 py-3">Property</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Amount</th><th className="px-5 py-3">Method</th><th className="px-5 py-3">Status</th><th className="px-5 py-3"><span className="sr-only">Action</span></th></tr></thead><tbody className="divide-y divide-slate-100">{payments.map((payment) => <tr key={payment.id} className="hover:bg-slate-50"><td className="px-5 py-3 font-mono text-xs font-bold text-slate-800">{payment.paymentReference}</td><td className="px-5 py-3"><span className="block font-semibold text-slate-800">{payment.taxDeclarationNumber}</span><span className="block text-xs text-slate-500">{payment.propertyLabel}</span></td><td className="px-5 py-3 text-slate-600">{formatDate(payment.paymentDate)}</td><td className="px-5 py-3 font-bold text-slate-800">{formatMoney(payment.amount)}</td><td className="px-5 py-3 text-slate-600">{payment.paymentMethod}</td><td className="px-5 py-3"><StatusBadge status={payment.status} /></td><td className="px-5 py-3 text-right"><button onClick={() => onView(payment)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-white">Details</button></td></tr>)}</tbody></table></div>;
}

function FileList({ files }: { files: File[] }) {
  return <ul className="mt-3 space-y-1 text-xs text-slate-600">{files.map((file) => <li key={file.name + file.size}>• {file.name} ({Math.ceil(file.size / 1024)} KB)</li>)}</ul>;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label={title}><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6"><div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4"><h2 className="text-lg font-extrabold text-slate-900">{title}</h2><button onClick={onClose} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200">Close</button></div><div className="pt-4">{children}</div></div></div>;
}