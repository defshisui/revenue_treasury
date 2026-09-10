export type RPTTaxStatus =
  | "Paid"
  | "Unpaid"
  | "Partially Paid"
  | "Overdue"
  | "Pending Payment"
  | "Processing"
  | "Failed"
  | "Cancelled";

export type RPTApplicationStatus =
  | "Submitted"
  | "For Review"
  | "Under Evaluation"
  | "For Compliance"
  | "Processing"
  | "Approved"
  | "Ready for Release"
  | "Completed"
  | "Rejected";

export type RPTPaymentMethod = "GCash" | "Maya" | "Online Banking" | "Other digital channel";

export interface CitizenSession {
  id?: string;
  fullname: string;
  email?: string;
  role?: string;
}

export interface RPTProperty {
  id: string;
  taxDeclarationNumber: string;
  referenceNumber?: string;
  ownerName: string;
  location: string;
  barangay: string;
  propertyType: string;
  landArea?: number;
  marketValue?: number | null;
  assessedValue?: number | null;
  taxStatus: RPTTaxStatus;
  currentAmountDue?: number | null;
  outstandingBalance?: number | null;
  lastPaymentDate?: string | null;
}

export interface RPTTaxDetail {
  propertyId: string;
  billingYear?: string;
  assessmentLevel?: string | null;
  assessedValue?: number | null;
  applicableTaxInfo?: string | null;
  currentAmountDue?: number | null;
  previousBalance?: number | null;
  penaltiesInterest?: number | null;
  totalAmountPayable?: number | null;
  paymentStatus: RPTTaxStatus;
  dueDate?: string | null;
}

export interface RPTPayment {
  id: string;
  paymentReference: string;
  propertyId: string;
  taxDeclarationNumber: string;
  propertyLabel: string;
  paymentDate?: string | null;
  amount: number | null;
  paymentMethod: string;
  status: RPTTaxStatus;
  officialReceiptNumber?: string | null;
}

export interface RPTStatusHistoryItem {
  status: RPTApplicationStatus;
  date: string;
  remarks?: string;
}

export interface RPTApplication {
  id: string;
  controlNumber: string;
  transactionType: string;
  propertyId?: string;
  taxDeclarationNumber?: string;
  dateSubmitted: string;
  status: RPTApplicationStatus;
  lastUpdated: string;
  remarks?: string;
  requiredAction?: string;
  missingRequirements?: string[];
  statusHistory: RPTStatusHistoryItem[];
}

export interface RPTNotification {
  id: string;
  type: "application" | "payment" | "reminder";
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  targetPath?: string;
}

export interface RPTOverview {
  propertyCount: number;
  currentAmountDue: number | null;
  outstandingBalance: number | null;
  nextDueDate: string | null;
  paymentStatus: RPTTaxStatus | null;
  recentPayments: RPTPayment[];
  recentApplications: RPTApplication[];
}

export interface RPTRequestPayload {
  serviceType: string;
  propertyId?: string;
  taxDeclarationNumber?: string;
  applicantType: "Property Owner" | "Authorized Representative" | "Corporation/Company";
  applicantName: string;
  email: string;
  mobileNumber: string;
  notes?: string;
  documents: File[];
}

export interface PaymentRequestPayload {
  propertyId: string;
  amount: number;
  paymentMethod: RPTPaymentMethod;
}

import { API_BASE_URL } from '../config/api';

const USE_MOCK_DATA = import.meta.env.VITE_RPT_USE_MOCK === "true";

const demoProperties: RPTProperty[] = [];

const demoTaxDetails: Record<string, RPTTaxDetail> = {};

let demoPayments: RPTPayment[] = [];

let demoApplications: RPTApplication[] = [];

let demoNotifications: RPTNotification[] = [];

function waitForDemo<T>(value: T): Promise<T> {
  return new Promise((resolve) => window.setTimeout(() => resolve(value), 180));
}

function cloneProperty(property: RPTProperty): RPTProperty {
  return { ...property };
}

function cloneApplication(application: RPTApplication): RPTApplication {
  return {
    ...application,
    missingRequirements: application.missingRequirements ? [...application.missingRequirements] : undefined,
    statusHistory: application.statusHistory.map((item) => ({ ...item })),
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(API_BASE_URL + path, {
    credentials: "include",
    ...init,
  });

  if (!response.ok) {
    const fallback = "The RPT service could not complete this request.";
    const responseBody = await response.json().catch(() => ({ message: fallback })) as { message?: string };
    throw new Error(responseBody.message || fallback);
  }

  return response.json() as Promise<T>;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function makeReference(prefix: string): string {
  return prefix + "-" + Date.now().toString().slice(-8);
}

export function isUsingMockRPTData(): boolean {
  return USE_MOCK_DATA;
}

export function getCitizenSession(): CitizenSession | null {
  const values = [
    localStorage.getItem("currentUser"),
    localStorage.getItem("user"),
    sessionStorage.getItem("currentUser"),
    sessionStorage.getItem("user"),
  ];

  for (const value of values) {
    if (!value) continue;

    try {
      const parsed: unknown = JSON.parse(value);
      const container = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
      const source = container.user && typeof container.user === "object"
        ? container.user as Record<string, unknown>
        : container;
      const fullname = source.fullname || source.fullName || source.name || source.firstName || source.email;

      if (typeof fullname === "string" && fullname.trim()) {
        return {
          id: typeof source.id === "string" || typeof source.id === "number" ? String(source.id) : undefined,
          fullname,
          email: typeof source.email === "string" ? source.email : undefined,
          role: typeof source.role === "string" ? source.role : undefined,
        };
      }
    } catch {

    }
  }

  return null;
}

export function isCitizenSession(session: CitizenSession | null): boolean {
  return Boolean(session && session.role?.toLowerCase().includes("citizen"));
}

const ADMIN_RPT_STORAGE_KEY = "lgu_rpt";

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function firstValue<T = unknown>(record: Record<string, unknown>, keys: string[]): T | undefined {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== "") return record[key] as T;
  }
  return undefined;
}

function normalizeTaxStatus(value: unknown, balance: number | null): RPTTaxStatus {
  const status = String(value ?? "").trim().toLowerCase();
  if (["paid", "settled", "fully paid"].includes(status)) return "Paid";
  if (["overdue", "delinquent"].includes(status)) return "Overdue";
  if (["processing"].includes(status)) return "Processing";
  if (["pending payment", "pending"].includes(status)) return "Pending Payment";
  if (["failed"].includes(status)) return "Failed";
  if (["cancelled", "canceled"].includes(status)) return "Cancelled";
  if (balance !== null && balance <= 0) return "Paid";
  return "Unpaid";
}

function readAdminRPTRecords(): Record<string, unknown>[] {
  try {
    const raw = localStorage.getItem(ADMIN_RPT_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) : [];
  } catch {
    return [];
  }
}

function mapAdminRPTProperty(record: Record<string, unknown>): RPTProperty {
  const id = String(firstValue(record, ["id", "rptId", "propertyId", "taxDeclarationNumber"]) ?? "");
  const taxDeclarationNumber = String(firstValue(record, ["taxDeclarationNumber", "taxDeclarationNo", "tdNumber", "tdNo"]) ?? "Not available");
  const totalAssessment = toNumber(firstValue(record, ["totalAssessment", "totalAmountPayable", "amountDue", "totalDue"]));
  const amountPaid = toNumber(firstValue(record, ["amountPaid", "paidAmount", "totalPaid"])) ?? 0;
  const explicitBalance = toNumber(firstValue(record, ["balance", "outstandingBalance"]));
  const balance = explicitBalance ?? (totalAssessment !== null ? Math.max(0, totalAssessment - amountPaid) : null);
  return {
    id, taxDeclarationNumber,
    referenceNumber: String(firstValue(record, ["referenceNumber", "pin", "propertyIndexNumber"]) ?? ""),
    ownerName: String(firstValue(record, ["ownerName", "propertyOwner", "taxpayerName"]) ?? "Not available"),
    location: String(firstValue(record, ["location", "propertyLocation", "address"]) ?? "Not available"),
    barangay: String(firstValue(record, ["barangay", "barangayName"]) ?? "Not available"),
    propertyType: String(firstValue(record, ["propertyType", "classification"]) ?? "Not available"),
    landArea: toNumber(firstValue(record, ["landArea", "area"])) ?? undefined,
    marketValue: toNumber(firstValue(record, ["marketValue"])),
    assessedValue: toNumber(firstValue(record, ["assessedValue"])),
    taxStatus: normalizeTaxStatus(firstValue(record, ["taxStatus", "paymentStatus", "status"]), balance),
    currentAmountDue: totalAssessment,
    outstandingBalance: balance,
    lastPaymentDate: String(firstValue(record, ["lastPaymentDate", "paymentDate"]) ?? "") || null,
  };
}

function mapAdminRPTTaxDetail(record: Record<string, unknown>): RPTTaxDetail {
  const property = mapAdminRPTProperty(record);
  const total =
    toNumber(firstValue(record, ["totalAssessment", "totalAmountPayable", "totalDue"])) ??
    property.outstandingBalance ??
    null;
  return {
    propertyId: property.id,
    billingYear: String(firstValue(record, ["billingYear", "taxYear", "year"]) ?? new Date().getFullYear()),
    assessmentLevel: String(firstValue(record, ["assessmentLevel"]) ?? "") || null,
    assessedValue: property.assessedValue ?? null,
    applicableTaxInfo: String(firstValue(record, ["applicableTaxInfo", "taxRate", "taxInfo"]) ?? "") || null,
    currentAmountDue: property.currentAmountDue ?? null,
    previousBalance: toNumber(firstValue(record, ["previousBalance", "priorBalance"])) ?? 0,
    penaltiesInterest: toNumber(firstValue(record, ["penaltiesInterest", "penalty", "interest"])) ?? 0,
    totalAmountPayable: total !== null ? Math.max(0, total) : null,
    paymentStatus: property.taxStatus,
    dueDate: String(firstValue(record, ["dueDate", "paymentDueDate"]) ?? "") || null,
  };
}

function getSharedAdminProperties(): RPTProperty[] {
  return readAdminRPTRecords().map(mapAdminRPTProperty).filter((property) => property.id);
}

export async function getRPTOverview(): Promise<RPTOverview> {
  if (!USE_MOCK_DATA) return request<RPTOverview>("/api/citizen/rpt/overview");

  const sharedProperties = getSharedAdminProperties();
  if (sharedProperties.length) {
    const totalDue = sharedProperties.reduce((sum, p) => sum + (p.currentAmountDue ?? 0), 0);
    const outstanding = sharedProperties.reduce((sum, p) => sum + (p.outstandingBalance ?? 0), 0);
    return waitForDemo({
      propertyCount: sharedProperties.length,
      currentAmountDue: totalDue,
      outstandingBalance: outstanding,
      nextDueDate: null,
      paymentStatus: sharedProperties.every((p) => p.taxStatus === "Paid") ? "Paid" : "Unpaid",
      recentPayments: demoPayments.slice(0, 4).map((payment) => ({ ...payment })),
      recentApplications: demoApplications.slice(0, 4).map(cloneApplication),
    });
  }
  return waitForDemo({
    propertyCount: demoProperties.length,
    currentAmountDue: 2500,
    outstandingBalance: 2500,
    nextDueDate: "2026-12-31",
    paymentStatus: "Unpaid",
    recentPayments: demoPayments.slice(0, 4).map((payment) => ({ ...payment })),
    recentApplications: demoApplications.slice(0, 4).map(cloneApplication),
  });
}

export async function getRPTProperties(): Promise<RPTProperty[]> {
  if (!USE_MOCK_DATA) return request<RPTProperty[]>("/api/citizen/rpt/properties");
  const shared = getSharedAdminProperties();
  return waitForDemo((shared.length ? shared : demoProperties).map(cloneProperty));
}

export async function getRPTTaxDetail(propertyId: string): Promise<RPTTaxDetail> {
  if (!USE_MOCK_DATA) return request<RPTTaxDetail>("/api/citizen/rpt/properties/" + encodeURIComponent(propertyId) + "/tax-details");

  const sharedRecord = readAdminRPTRecords().find((record) =>
    String(firstValue(record, ["id", "rptId", "propertyId", "taxDeclarationNumber"]) ?? "") === propertyId
  );
  if (sharedRecord) return waitForDemo(mapAdminRPTTaxDetail(sharedRecord));
  const detail = demoTaxDetails[propertyId];
  if (!detail) throw new Error("The selected property is not available in the RPT demo data.");
  return waitForDemo({ ...detail });
}

export async function getRPTPayments(): Promise<RPTPayment[]> {
  if (!USE_MOCK_DATA) return request<RPTPayment[]>("/api/citizen/rpt/payments");
  return waitForDemo(demoPayments.map((payment) => ({ ...payment })));
}

export async function createRPTPaymentRequest(payload: PaymentRequestPayload): Promise<RPTPayment> {
  if (!USE_MOCK_DATA) {
    return request<RPTPayment>("/api/citizen/rpt/payment-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  const sharedRecord = readAdminRPTRecords().find((record) =>
    String(firstValue(record, ["id", "rptId", "propertyId", "taxDeclarationNumber"]) ?? "") === payload.propertyId
  );
  const property = sharedRecord ? mapAdminRPTProperty(sharedRecord) : demoProperties.find((item) => item.id === payload.propertyId);
  if (!property) throw new Error("The selected RPT assessment could not be found.");
  const currentBalance = property.outstandingBalance ?? property.currentAmountDue ?? 0;
  if (currentBalance <= 0) throw new Error("This RPT assessment has no outstanding balance.");
  if (payload.amount <= 0 || payload.amount > currentBalance) throw new Error("The payment amount is not valid for the selected RPT assessment.");

  const payment: RPTPayment = {
    id: "payment-" + Date.now(),
    paymentReference: makeReference("RPT-PAY"),
    propertyId: property.id,
    taxDeclarationNumber: property.taxDeclarationNumber,
    propertyLabel: property.taxDeclarationNumber + " · " + property.location,
    paymentDate: null,
    amount: payload.amount,
    paymentMethod: payload.paymentMethod,
    status: "Pending Payment",
    officialReceiptNumber: null,
  };

  demoPayments = [payment, ...demoPayments];
  demoNotifications = [{
    id: "demo-notification-" + Date.now(),
    type: "payment",
    title: "Demo payment request created",
    message: "Payment " + payment.paymentReference + " is pending. This UI did not mark it as paid.",
    createdAt: today(),
    isRead: false,
    targetPath: "/citizen-rpt/payments",
  }, ...demoNotifications];

  return waitForDemo({ ...payment });
}

export async function getRPTApplications(): Promise<RPTApplication[]> {
  if (!USE_MOCK_DATA) return request<RPTApplication[]>("/api/citizen/rpt/applications");
  return waitForDemo(demoApplications.map(cloneApplication));
}

export async function submitRPTRequest(payload: RPTRequestPayload): Promise<RPTApplication> {
  if (!USE_MOCK_DATA) {
    const form = new FormData();
    form.append("request", JSON.stringify({
      serviceType: payload.serviceType,
      propertyId: payload.propertyId,
      taxDeclarationNumber: payload.taxDeclarationNumber,
      applicantType: payload.applicantType,
      applicantName: payload.applicantName,
      email: payload.email,
      mobileNumber: payload.mobileNumber,
      notes: payload.notes,
    }));
    payload.documents.forEach((document) => form.append("documents", document));
    return request<RPTApplication>("/api/citizen/rpt/applications", { method: "POST", body: form });
  }

  const application: RPTApplication = {
    id: "demo-application-" + Date.now(),
    controlNumber: makeReference("RPT-DEMO-APP"),
    transactionType: payload.serviceType,
    propertyId: payload.propertyId,
    taxDeclarationNumber: payload.taxDeclarationNumber,
    dateSubmitted: today(),
    status: "Submitted",
    lastUpdated: today(),
    remarks: "Demo request only. It has not been sent to a government office.",
    statusHistory: [{ status: "Submitted", date: today(), remarks: "Demo request submitted through the interface." }],
  };

  demoApplications = [application, ...demoApplications];
  demoNotifications = [{
    id: "demo-notification-" + Date.now(),
    type: "application",
    title: "Demo application submitted",
    message: "Your sample control number is " + application.controlNumber + ".",
    createdAt: today(),
    isRead: false,
    targetPath: "/citizen-rpt/applications",
  }, ...demoNotifications];

  return waitForDemo(cloneApplication(application));
}

export async function resubmitRPTCompliance(applicationId: string, documents: File[]): Promise<RPTApplication> {
  if (!documents.length) throw new Error("Attach at least one document before resubmitting.");

  if (!USE_MOCK_DATA) {
    const form = new FormData();
    documents.forEach((document) => form.append("documents", document));
    return request<RPTApplication>(
      "/api/citizen/rpt/applications/" + encodeURIComponent(applicationId) + "/compliance",
      { method: "POST", body: form },
    );
  }

  const application = demoApplications.find((item) => item.id === applicationId);
  if (!application) throw new Error("The selected application could not be found.");


  application.lastUpdated = today();
  application.statusHistory = [
    ...application.statusHistory,
    { status: application.status, date: today(), remarks: "Demo compliance documents resubmitted; officer review is still required." },
  ];

  return waitForDemo(cloneApplication(application));
}

export async function getRPTNotifications(): Promise<RPTNotification[]> {
  if (!USE_MOCK_DATA) return request<RPTNotification[]>("/api/citizen/rpt/notifications");
  return waitForDemo(demoNotifications.map((notification) => ({ ...notification })));
}

export async function markRPTNotificationsRead(notificationIds?: string[]): Promise<void> {
  if (!USE_MOCK_DATA) {
    await request<void>("/api/citizen/rpt/notifications/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationIds }),
    });
    return;
  }

  demoNotifications = demoNotifications.map((notification) => (
    !notificationIds || notificationIds.includes(notification.id)
      ? { ...notification, isRead: true }
      : notification
  ));
  await waitForDemo(undefined);
}