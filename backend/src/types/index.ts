export interface User {
  id: number;
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'treasury-staff' | 'citizen';
  created_at: Date;
}

export interface Citizen {
  id: number;
  user_id: number;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  birth_date: Date;
  house_no_street: string;
  barangay: string;
  city: string;
  occupation: string | null;
  sex: string | null;
  mobile_number: string;
  created_at: Date;
}

export interface AuditLog {
  id: number;
  audit_id: string;
  user_email: string;
  user_role: string;
  module: string;
  action: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  ip_address: string;
  user_agent: string;
  previous_data: string | null;
  new_data: string | null;
  timestamp: Date;
}

export interface MarketLease {
  id: number;
  lease_id: string;
  first_name: string;
  last_name: string;
  market_name: string;
  section: string;
  stall_number: string;
  lease_status: 'Active' | 'Termination Requested' | 'For Termination' | 'Terminated' | 'Inactive';
  amount_due: number;
  helper_approval_status: string;
  advance_payment_status: string;
  payment_status: 'Pending Payment' | 'For Payment Verification' | 'Payment Information Requested' | 'Paid';
  payment_method: string;
  created_at: Date;
}

export interface RptApplication {
  id: string;
  control_number: string | null;
  reference_number: string | null;
  email: string | null;
  mobile_number: string | null;
  service: string | null;
  filed_date: string | null;
  status: string;
  penalty: number;
  applicant_name: string;
  pin: string | null;
  tax_declaration_number: string | null;
  property_location: string | null;
  assigned_officer: string | null;
  payment_status: string;
  documents: string[];
  created_at: Date;
}

export interface LguRptRecord {
  id: number;
  taxdeclarationnumber: string;
  pin: string | null;
  ownername: string | null;
  propertylocation: string | null;
  barangay: string | null;
  propertytype: string | null;
  billingyear: number | null;
  quarter: string | null;
  basictax: number;
  seftax: number;
  speciallevy: number;
  penalty: number;
  discount: number;
  totalassessment: number;
  amountpaid: number;
  balance: number;
  status: string;
  paymentstatus: string;
  paymentmethod: string | null;
  officialreceiptnumber: string | null;
  paymentreference: string | null;
  paymentdate: Date | null;
  amountdue: number;
}

export interface HawkerAssociation {
  id: string;
  association_number: string;
  association_name: string;
  sec_registration_no: string | null;
  date_issued: string | null;
  contact_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  email: string;
  submitted_by: string;
  submitter_email: string;
  submission_date: string;
  status: string;
  remarks: string | null;
  member_count: number;
  created_at: Date;
}

// Request body interfaces
export interface LoginBody {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface CreateUserBody {
  fullname: string;
  username: string;
  password: string;
  role?: string;
}

export interface SaveCitizenBody {
  userId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  birthDate: string;
  houseNoStreet: string;
  barangay: string;
  city: string;
  occupation?: string;
  sex?: string;
  mobileNumber: string;
}

export interface SaveLeaseBody {
  leaseId?: string;
  firstName: string;
  lastName: string;
  marketName: string;
  section: string;
  stallNumber: string;
  leaseStatus?: string;
  amountDue?: number;
  helperApprovalStatus?: string;
  advancePaymentStatus?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  payment_method?: string;
  officialReceiptNumber?: string;
  official_receipt_number?: string;
  paymentReference?: string;
  payment_reference?: string;
  paymentDate?: string;
  payment_date?: string;
  paymentProof?: string;
  payment_proof?: string;
  mismatchNotes?: string;
  mismatch_notes?: string;
  email?: string;
}

export interface UpdateLeaseBody extends SaveLeaseBody { }

export interface RptPaymentBody {
  rptRecordId: number;
  taxDeclarationNumber: string;
  ownerName: string;
  amount: number;
  paymentMethod: string;
  paymentReference: string;
  officialReceiptNumber: string;
}

export interface HawkerBody {
  id?: string;
  associationNumber: string;
  associationName: string;
  secRegistrationNo?: string;
  dateIssued?: string;
  contactNumber: string;
  chairperson?: {
    firstName?: string;
    middleName?: string;
    lastName?: string;
    email?: string;
  };
  submittedBy?: string;
  submitterEmail?: string;
  submissionDate?: string;
  status?: string;
  remarks?: string;
  memberCount?: number;
}

export interface AuditBeaconBody {
  auditId?: string;
  user?: string;
  role?: string;
  module?: string;
  action?: string;
  severity?: string;
  previousData?: string | null;
  newData?: string | null;
}

export interface FraudScanBody {
  leaseId?: string;
  id?: string;
  lease_id?: string;
}
