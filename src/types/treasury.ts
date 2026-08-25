// src/types/treasury.ts

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
  | "hawker"
  | "market-city"
  | "market-private"
  | "market-operator"
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

export type StallStatus = "Occupied" | "Vacant" | "Maintenance" | "Delinquent" | "Closed" | "Paid";
export type LeaseStatus = "Active" | "Pending Approval" | "Terminated" | "Expired";
export type MarketBranch = "Central Public Market" | "North Plaza Talipapa" | "Southside Night Market";
export type MarketSection = 
  | "Meat & Poultry Section" 
  | "Fish & Seafood Section" 
  | "Vegetables & Fruits" 
  | "Dry Goods Section" 
  | "Eatery / Food Stalls";

export interface StallRecord {
  id: string;
  stallNumber: string;
  marketBranch: MarketBranch | string;
  marketSection: MarketSection | string;
  sizeSqMeters: number;
  monthlyBaseRate: number;
  status: StallStatus;
  assignedVendorId?: string;
  vendorName?: string;
  vendorContact?: string;
  leaseStartDate?: string;
  leaseEndDate?: string;
  leaseStatus?: LeaseStatus;
  currentBalance: number;
  accumulatedPenalty: number;
  lastPaymentDate?: string;
  overdueStatus: boolean;
  paymentHistory: string[];
  receiptNo?: string;
  paymentMode?: string;
  contactNumber?: string;
  tinOrId?: string;
  billingCycle?: string;
  rentalRate?: number;
  location?: string;
  billingMonth?: string;
  rentalAmount?: number;
  previousBalance?: number;
  penalty?: number;
}

export interface TransactionRecord {
  id: string;
  transactionId: string;
  referenceNumber: string;
  taxpayer: string;
  paymentType: "Real Property Tax" | "Business Tax" | "Market Rental" | "Other Fees" | string;
  type?: string; 
  amount: number;
  paymentMethod: "Cash" | "Bank Transfer" | "Check" | "Digital Wallet" | string;
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

export type HawkerAssociationStatus = "New" | "Under Review" | "Approved" | "Rejected" | "Suspended";

export interface HawkerOfficer {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
}

export interface HawkerAssociationRecord {
  id: string;
  associationNumber: string;
  associationName: string;
  secRegistrationNo?: string;
  dateIssued?: string;
  contactNumber: string;
  chairperson: HawkerOfficer;
  submittedBy: string;
  submitterEmail: string;
  submissionDate: string;
  status: HawkerAssociationStatus;
  remarks?: string;
  memberCount?: number;
}

/* ============================================================================
   CITY ASSESSOR - REAL PROPERTY TAX (RPT) CITIZEN'S CHARTER EXTENSIONS
   ============================================================================ */

export type CategoryType = 
  | '1.1 Transfer of Ownership'
  | '1.2 Consolidation / Segregation'
  | '1.3 New Assessment / Reassessment / Reclassification'
  | '1.4 Correction of Entry / Updating / Revision'
  | '1.5 Declaration of New / Undeclared Land'
  | '2.1 CTC of Tax Declaration'
  | '2.2 Certified Copy of Tax Map'
  | '2.3-2.5 Certifications (Adjoining, Location, Holdings)'
  | '2.6 Print-Out of Real Property Assessment Record'
  | '3. Cancellation of Assessment Records';

export type StatusType =
  | 'Under Evaluation'
  | 'Technical Plotting (GIS)'
  | 'Field Inspection Scheduled'
  | 'Payment Pending'
  | 'Ready for Approval'
  | 'Approved & Ready for Release'
  | 'Digital Certificate Issued'
  | 'Rejected';

export interface DocumentItem {
  id: string;
  name: string;
  type: string;
  uploadedAt: string;
  fileUrl: string;
  status: 'Pending' | 'Verified' | 'Rejected';
  notes?: string;
}

export interface ApplicationRecord {
  id: string;
  referenceNumber: string;
  category: CategoryType;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  isRepresentative: boolean;
  representativeDetails?: {
    name: string;
    relation: string;
    spaUploaded: boolean;
  };
  propertyDetails: {
    pin: string; // Property Identification Number
    titleNumber: string; // TCT/CCT
    address: string;
    lotAreaSqM: number;
    currentValuation?: number;
  };
  documents: DocumentItem[];
  status: StatusType;
  submissionDate: string;
  titleReleaseDate?: string; // For 60-day late filing penalty calculation
  penaltyFee: number;
  adminFee: number;
  paymentStatus: 'Unpaid' | 'Paid' | 'Exempted';
  assignedOfficer?: string;
  gisPlottingCompleted?: boolean;
  fieldInspectionRequired?: boolean;
  fieldInspectionDate?: string;
  assignedCounter?: 'Counter 1' | 'Counter 2' | 'N/A';
  scheduledReleaseDate?: string;
  remarks?: string;
}

export interface AdminStats {
  totalApplications: number;
  pendingReview: number;
  pendingInspectionOrGIS: number;
  readyForRelease: number;
  totalPenaltiesCollected: number;
}