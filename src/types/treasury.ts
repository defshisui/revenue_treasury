export type Role =
  | "Municipal Treasurer"
  | "Assistant Treasurer"
  | "Revenue Collector"
  | "Property Assessment Officer"
  | "Business Permit Officer"
  | "Data Encoder"
  | "Auditor"
  | "Administrator";

export type Subsystem =
  | "dashboard"
  | "rpt"
  | "business"
  | "market"
  | "payments"
  | "users"
  | "audit"
  | "reports";

export type RPTWorkflowStatus = "Assessment Created" | "Reviewed" | "Approved" | "Billed" | "Paid" | "Completed";
export type BusinessWorkflowStatus = "Draft" | "Submitted" | "Reviewed" | "Approved" | "Paid" | "Completed";
export type PaymentWorkflowStatus = "Pending" | "Verified" | "Posted" | "Cancelled";

export interface LGUConfig {
  basicRptRate: number;
  sefRate: number;
  specialLevyRate: number;
  penaltyRatePerMonth: number;
  discountRateEarly: number;
}

export interface RPTRecord {
  id: string;
  propertyId: string;
  taxpayerId: string;
  ownerName: string;
  ownerAddress: string;
  contactInfo: string;
  propertyIndexNumber: string;
  taxDeclarationNumber: string;
  barangay: string;
  location: string;
  propertyType: "" | "Residential" | "Commercial" | "Industrial" | "Agricultural";
  landArea: number;
  buildingArea: number;
  marketValue: number;
  assessmentLevel: number;
  assessedValue: number;
  billingYear: number;
  quarter: "Q1" | "Q2" | "Q3" | "Q4" | "Full Year";
  dueDate: string;
  basicTax: number;
  sefTax: number;
  specialLevy: number;
  penalty: number;
  discount: number;
  totalAssessment: number;
  amountPaid: number;
  balance: number;
  delinquentStatus: boolean;
  paymentHistory: string[];
  referenceNumber?: string;
  status: RPTWorkflowStatus;
  createdAt: string;
  receiptNo: string;
  transactionType: string;
  paymentMethod: string;
}

export interface BusinessRecord {
  id: string;
  businessId: string;
  owner: string;
  businessName: string;
  address: string;
  businessType: string;
  natureOfBusiness: string;
  registrationDate: string;
  grossSales: number;
  capitalInvestment: number;
  taxCategory: string;
  taxRate: number;
  computedTax: number;
  mayorPermitFee: number;
  regulatoryFees: number;
  inspectionFee: number;
  sanitaryFee: number;
  garbageFee: number;
  totalDue: number;
  amountPaid: number;
  balance: number;
  status: BusinessWorkflowStatus;
  createdAt: string;
}

// 1. Keep/expand the strict union type for status
export type StallStatus = "Current" | "Overdue" | "Vacant" | "Unpaid" | "Paid";

// 2. The merged StallRecord interface
export interface StallRecord {
  // --- ORIGINAL FIELDS (Kept intact) ---
  id: string;
  stallNumber: string;
  location: string;
  marketSection: string;
  rentalRate: number;
  assignedVendorId: string;
  vendorName: string;
  billingMonth: string;
  rentalAmount: number;
  previousBalance: number;
  penalty: number;
  currentBalance: number;
  paymentHistory: string[]; // Kept original string[] type
  overdueStatus: boolean;
  status: StallStatus;     // Kept original union type (extended with "Paid")

  // --- NEW OPTIONAL FIELDS (Added for MarketStallsView form) ---
  receiptNo?: string;
  paymentMode?: string;
  contactNumber?: string;
  tinOrId?: string;
  billingCycle?: string;
}

export interface TransactionRecord {
  id: string;
  transactionId: string;
  referenceNumber: string;
  taxpayer: string;
  paymentType: "Real Property Tax" | "Business Tax" | "Market Rental" | "Other Fees";
  amount: number;
  paymentMethod: "Cash" | "Bank Transfer" | "Check" | "Digital Wallet";
  externalReference: string;
  collector: string;
  date: string;
  status: PaymentWorkflowStatus;
  remarks?: string;
}

export interface UserRecord {
  id: string;
  fullname: string;
  username: string;
  role: Role;
  status: "Active" | "Inactive";
  assignedModule?: string;
}

export interface AuditRecord {
  id: string;
  auditId: string;
  user: string;
  role: Role;
  module: string;
  action: "Create" | "Update" | "Delete" | "Approval" | "Payment Posting" | "Status Change";
  previousData?: string;
  newData?: string;
  timestamp: string;
}
