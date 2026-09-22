import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
import CitizenLayout from './CitizenLayout';
import {
  createPayMongoQrPaymentIntent,
  createQrPhPaymentMethod,
  attachQrPhPaymentMethod,
} from '../services/paymongoService';

export interface BusinessTaxAssessmentViewProps {
  isCollapsed?: boolean;
}

type ActiveScreen = 'assessment-list' | 'appointments-list' | 'verification';
type AssessmentStatus = 'PENDING' | 'SUBMITTED' | 'FOR_COMPLIANCE' | 'FOR_FINAL_REVIEW' | 'FOR_FINAL_APPROVAL' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
type DocumentRequirementKey =
  | 'sales_declaration'
  | 'mayors_permit'
  | 'latest_tax_bill'
  | 'latest_official_receipt'
  | 'bir_tax_return'
  | 'previous_itr'
  | 'audited_financial_statements'
  | 'notarized_gross_sales'
  | 'branch_permits_and_ors'
  | 'branch_sales_breakdown'
  | 'line_of_business_sales_breakdown'
  | 'cedula'
  | 'summary_list_of_sales'
  | 'incentive_exemption';

interface AttachmentFile {
  name: string;
  url: string;
  type?: string;
  mimeType?: string;
  size?: number;
  uploadedAt?: string;
}

interface FeeBreakdown {
  lbt?: number;
  mayorsPermit?: number;
  sanitaryFee?: number;
  garbageFee?: number;
  fireSafetyFee?: number;
  otherFees?: number;
  total?: number;
}

interface MissingDocument {
  key: DocumentRequirementKey | string;
  label: string;
}

interface AssessmentRecord {
  id: string;
  trackingNumber: string;
  taxBillNumber?: string | null;
  orderOfPaymentNumber?: string | null;
  businessName: string;
  businessOwner: string;
  businessAddress?: string;
  barangay?: string;
  businessType?: string;
  lineOfBusiness?: string;
  businessAreaSqm?: number;
  registrationType?: string;
  registrationNumber?: string;
  mayorPermitNumber?: string;
  birRegistered?: boolean;
  hasOtherBranches?: boolean;
  hasMultipleLines?: boolean;
  taxYear?: number;
  assessmentPeriod?: string;
  quarter?: string;
  dueDate?: string | null;
  status: AssessmentStatus;
  applicationDate: string;
  psicCode?: string;
  grossSales?: number;
  tin?: string;
  email?: string;
  attachments?: AttachmentFile[];
  documentChecklist?: Record<string, boolean>;
  missingDocuments?: MissingDocument[];
  remarks?: string;
  complianceRemarks?: string;
  reviewedBy?: string;
  reviewedAt?: string | null;
  approvedBy?: string;
  approvedAt?: string | null;
  paymentStatus: 'PAID' | 'UNPAID';
  paymentAmount?: number;
  paidAmount?: number;
  paymentMethod?: string;
  paymentReference?: string;
  paymentDate?: string | null;
  officialReceiptNumber?: string;
  paymongoPaymentId?: string;
  computedFees?: FeeBreakdown;
}

interface AppointmentRecord {
  id: string;
  department: string;
  appointmentType: string;
  businessName?: string;
  tin?: string;
  address?: string;
  description?: string;
  fullName: string;
  email: string;
  phone: string;
  date: string;
  timeSlot?: string;
  remarks?: string;
  status: string;
  createdAt: string;
}

const REQUIRED_BASE: Array<{ key: DocumentRequirementKey; label: string; help: string; multiple?: boolean }> = [
  { key: 'sales_declaration', label: 'Gross Receipts / Sales Declaration Form', help: 'Completed and signed Sales Declaration form.' },
  { key: 'mayors_permit', label: 'Latest Mayor’s / Business Permit', help: 'Current/latest permit issued to the business.' },
  { key: 'latest_tax_bill', label: 'Latest Business Tax Bill', help: 'Previous/latest Business Tax bill used for renewal assessment.' },
  { key: 'latest_official_receipt', label: 'Latest Business Tax Official Receipt', help: 'Latest OR for the Business Tax payment.' },
];

const BIR_DOCS: Array<{ key: DocumentRequirementKey; label: string; help: string; multiple?: boolean }> = [
  { key: 'bir_tax_return', label: 'Preceding Year VAT Return / Percentage Tax Return / ITR', help: 'Upload the applicable preceding-year BIR return.' },
  { key: 'previous_itr', label: 'Previous-Preceding Year Income Tax Return', help: 'Upload the previous-preceding year ITR.' },
  { key: 'audited_financial_statements', label: 'Previous-Preceding Year Audited Financial Statements', help: 'Upload the applicable audited financial statements.' },
];

const OPTIONAL_DOCS: Array<{ key: DocumentRequirementKey; label: string; help: string; multiple?: boolean }> = [
  { key: 'cedula', label: 'Current-Year Community Tax Certificate / Cedula', help: 'Upload when available.' },
  { key: 'summary_list_of_sales', label: 'Previous-Year Summary List of Sales Received by BIR', help: 'Upload when applicable to the business.' },
  { key: 'incentive_exemption', label: 'Certificate of Incentives / Exemption', help: 'Upload when applicable.' },
];


function money(value: number | undefined): string {
  return `₱${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusClass(status: string): string {
  switch (status) {
    case 'APPROVED': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300';
    case 'REJECTED': return 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300';
    case 'FOR_COMPLIANCE': return 'bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300';
    case 'FOR_FINAL_REVIEW': return 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300';
    case 'FOR_FINAL_APPROVAL': return 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950/80 dark:text-fuchsia-300';
    case 'ARCHIVED': return 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    default: return 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300';
  }
}

export const BusinessTaxAssessmentView: React.FC<BusinessTaxAssessmentViewProps> = ({ isCollapsed: _isCollapsed = false }) => {
  const location = useLocation();
  const [currentScreen, setCurrentScreen] = useState<ActiveScreen>('assessment-list');
  const [verificationType, setVerificationType] = useState<'tax-bill' | 'or-number'>('tax-bill');
  const [isModalOpen, setIsModalOpen] = useState<false | 'appointment' | 'sales-declaration' | 'link-application'>(false);
  const [linkAppForm, setLinkAppForm] = useState({ trackingNumber: '' });
  const [selectedAssessmentView, setSelectedAssessmentView] = useState<AssessmentRecord | null>(null);
  const [complianceFiles, setComplianceFiles] = useState<Partial<Record<DocumentRequirementKey, File[]>>>({});
  const [isComplianceSubmitting, setIsComplianceSubmitting] = useState(false);
  const [user, setUser] = useState<{ fullname: string; email: string; initials: string; firstName: string; token: string } | null>(null);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [userAppointments, setUserAppointments] = useState<AppointmentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchType, setSearchType] = useState('Tracking/MP No.');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 10;

  const [isPaymentStep, setIsPaymentStep] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [qrReferenceNumber, setQrReferenceNumber] = useState('');
  const [qrPaymentIntentId, setQrPaymentIntentId] = useState('');
  const [qrError, setQrError] = useState('');
  const [paymentAssessment, setPaymentAssessment] = useState<AssessmentRecord | null>(null);
  const [qrSecondsRemaining, setQrSecondsRemaining] = useState(300);
  const [qrPaymentPaid, setQrPaymentPaid] = useState(false);
  const [paymentConfirmedAt, setPaymentConfirmedAt] = useState<Date | null>(null);
  const [paymentReceiptNumber, setPaymentReceiptNumber] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [isPaymentSuccess, setIsPaymentSuccess] = useState(false);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMime, setPreviewMime] = useState('');

  const [taxBillForm, setTaxBillForm] = useState({ taxBillNo: '', tin: '' });
  const [orForm, setOrForm] = useState({ permitNo: '', orNo: '', tin: '' });
  const [salesForm, setSalesForm] = useState({
    businessName: '',
    businessOwner: '',
    businessAddress: '',
    barangay: '',
    businessType: 'Retailer',
    lineOfBusiness: '',
    businessAreaSqm: '',
    registrationType: 'DTI',
    registrationNumber: '',
    mayorsPermitNumber: '',
    birRegistered: 'yes',
    hasOtherBranches: 'no',
    hasMultipleLines: 'no',
    grossSales: '',
    year: String(new Date().getFullYear()),
    assessmentPeriod: 'ANNUAL_RENEWAL',
    quarter: 'ANNUAL',
    psicCode: '',
    tin: '',
  });
  const [salesFiles, setSalesFiles] = useState<Partial<Record<DocumentRequirementKey, File[]>>>({});
  const [currentStep, setCurrentStep] = useState(1);
  const [certificationChecked, setCertificationChecked] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<{trackingNumber: string; date: string; name: string} | null>(null);

  const [captchaNum1, setCaptchaNum1] = useState(0);
  const [captchaNum2, setCaptchaNum2] = useState(0);
  const [captchaInput, setCaptchaInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [aptForm, setAptForm] = useState({
    department: 'City Treasurer\'s Office',
    appointmentType: '',
    businessName: '',
    tin: '',
    address: '',
    description: '',
    fullName: '',
    email: '',
    phone: '',
    date: '',
    timeSlot: '09:00 AM - 10:00 AM',
    remarks: '',
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'appointments' || tab === 'appointment') setCurrentScreen('appointments-list');
    else if (tab === 'verify' || tab === 'verification') setCurrentScreen('verification');
    else if (tab === 'sales-declaration') { setIsModalOpen('sales-declaration'); setCurrentScreen('assessment-list'); }
    else setCurrentScreen('assessment-list');
  }, [location.search]);

  useEffect(() => {
    const rawData = localStorage.getItem('currentUser') || localStorage.getItem('user') || sessionStorage.getItem('currentUser') || sessionStorage.getItem('user');
    if (!rawData) return;
    try {
      const parsed = JSON.parse(rawData);
      const target = parsed.user && typeof parsed.user === 'object' ? parsed.user : parsed;
      const fullname = String(target.fullname || target.name || target.fullName || target.firstName || target.email || '');
      const email = String(target.email || '');
      const token = String(parsed.token || target.token || '');
      const parts = fullname.trim().split(/\s+/).filter(Boolean);
      const initials = parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase() : (parts[0] || 'U').slice(0, 2).toUpperCase();
      const activeUser = { fullname, email, token, firstName: parts[0] || fullname, initials };
      setUser(activeUser);
      setSalesForm((prev) => ({ ...prev, businessOwner: fullname }));
      setAptForm((prev) => ({ ...prev, fullName: fullname, email }));
    } catch (error) {
      console.error('Failed to parse citizen session:', error);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    if (currentScreen === 'assessment-list') void fetchAssessments();
    if (currentScreen === 'appointments-list') void fetchUserAppointments();
  }, [currentScreen, user, statusFilter, currentPage]);

  useEffect(() => {
    if (!isPaymentStep || !qrCodeUrl || qrPaymentPaid) return;
    const timer = window.setInterval(() => {
      setQrSecondsRemaining((seconds) => {
        if (seconds <= 1) {
          window.clearInterval(timer);
          setQrCodeUrl('');
          if (paymentAssessment) void handlePayMongoBusinessTaxQrPayment(paymentAssessment);
          return 300;
        }
        return seconds - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isPaymentStep, qrCodeUrl, qrPaymentPaid, paymentAssessment]);

  const qrStatusCheckInProgressRef = useRef(false);

  useEffect(() => {
    if (!isPaymentStep || !qrPaymentIntentId || qrPaymentPaid) return;
    let cancelled = false;
    const checkPaymentStatus = async () => {
      if (cancelled || qrStatusCheckInProgressRef.current) return;
      qrStatusCheckInProgressRef.current = true;
      try {
        const response = await fetch(`${API_BASE_URL}/api/payments/qr-status/${encodeURIComponent(qrPaymentIntentId)}`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok || cancelled || !data.paid) return;

        setQrPaymentPaid(true);
        setPaymentConfirmedAt(data.paymentDate ? new Date(data.paymentDate) : new Date());
        setPaymentReceiptNumber(String(data.officialReceiptNumber || ''));
        setPaymentReference(String(data.paymentReference || qrReferenceNumber || ''));
        setPaymentAmount(Number(data.amount || paymentAssessment?.paymentAmount || 0));
        setQrSecondsRemaining(0);
        setQrCodeUrl('');
        setQrError('');
        setQrPaymentIntentId('');
        setIsPaymentStep(false);
        setIsPaymentSuccess(true);
        void fetchAssessments();
      } catch (error) {
        if (!cancelled) console.error('QR payment status check failed:', error);
      } finally {
        qrStatusCheckInProgressRef.current = false;
      }
    };
    void checkPaymentStatus();
    const timer = window.setInterval(() => void checkPaymentStatus(), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      qrStatusCheckInProgressRef.current = false;
    };
  }, [isPaymentStep, qrPaymentIntentId, qrPaymentPaid]);

  async function fetchAssessments() {
    if (!user) return;
    setLoading(true);
    setFetchError(null);
    try {
      const queryParams = new URLSearchParams();
      if (statusFilter !== 'ALL') queryParams.append('status', statusFilter);
      queryParams.append('page', String(currentPage));
      queryParams.append('limit', String(pageSize));
      if (searchQuery.trim()) queryParams.append('search', searchQuery.trim());
      queryParams.append('searchType', searchType);
      const response = await fetch(`${API_BASE_URL}/business-assessments?${queryParams.toString()}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || `Failed to load assessments (${response.status}).`);
      setAssessments(Array.isArray(data) ? data : (data.assessments || []));
      setTotalPages(Number(data.totalPages || 1));
    } catch (error: any) {
      setFetchError(error.message || 'Failed to load your Business Tax records.');
    } finally {
      setLoading(false);
    }
  }

  async function fetchUserAppointments() {
    if (!user) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/appointments?email=${encodeURIComponent(user.email)}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await response.json().catch(() => ([]));
      if (!response.ok) throw new Error(data.message || 'Failed to load appointments.');
      setUserAppointments(Array.isArray(data) ? data : (data.appointments || []));
    } catch (error) {
      console.error(error);
      setUserAppointments([]);
    } finally {
      setLoading(false);
    }
  }

  const applicableDocumentDefinitions = (): Array<{ key: DocumentRequirementKey; label: string; help: string; multiple?: boolean; required: boolean }> => {
    const docs: Array<{ key: DocumentRequirementKey; label: string; help: string; multiple?: boolean; required: boolean }> = REQUIRED_BASE.map((item) => ({ ...item, required: true }));
    if (salesForm.birRegistered === 'yes') docs.push(...BIR_DOCS.map((item) => ({ ...item, required: true })));
    else docs.push({ key: 'notarized_gross_sales', label: 'Notarized Certification of Gross Sales', help: 'Required for a business that is not BIR-registered.', required: true });
    if (salesForm.hasOtherBranches === 'yes') {
      docs.push({ key: 'branch_permits_and_ors', label: 'Other Branch Mayor’s Permits and Official Receipts', help: 'Include all applicable branches inside or outside QC.', multiple: true, required: true });
      docs.push({ key: 'branch_sales_breakdown', label: 'Certified Breakdown of Sales for Other Branches', help: 'Certified breakdown showing branch sales and total.', required: true });
    }
    if (salesForm.hasMultipleLines === 'yes') docs.push({ key: 'line_of_business_sales_breakdown', label: 'Certified Breakdown of Sales by Line of Business', help: 'Certified breakdown per line of business, including grand total.', multiple: true, required: true });
    return [...docs, ...OPTIONAL_DOCS.map((item) => ({ ...item, required: false }))];
  };

  const formatFileAccept = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png';

  const validateSalesSubmission = (): string | null => {
    if (!salesForm.businessName.trim() || !salesForm.businessOwner.trim() || !salesForm.businessAddress.trim() || !salesForm.barangay.trim()) return 'Business name, owner, address, and barangay are required.';
    if (!salesForm.lineOfBusiness.trim() || !salesForm.mayorsPermitNumber.trim() || !salesForm.tin.trim()) return 'Line of business, Mayor’s Permit number, and TIN are required.';
    const gross = Number(salesForm.grossSales);
    const area = Number(salesForm.businessAreaSqm);
    if (!Number.isFinite(gross) || gross < 0) return 'Enter a valid non-negative gross sales/receipts amount.';
    if (!Number.isFinite(area) || area < 0) return 'Enter a valid non-negative business area.';
    for (const definition of applicableDocumentDefinitions().filter((item) => item.required)) {
      if (!(salesFiles[definition.key] || []).length) return `Please upload: ${definition.label}.`;
    }
    return null;
  };

  const handleNextStep = (targetStep: number) => {
    if (currentStep === 1) {
      if (!salesForm.mayorsPermitNumber.trim() || !salesForm.businessName.trim() || !salesForm.businessOwner.trim() || !salesForm.businessAddress.trim() || !salesForm.barangay.trim()) {
        return alert('Please fill in all mandatory fields before proceeding.');
      }
    } else if (currentStep === 2) {
      if (!salesForm.businessType || !salesForm.lineOfBusiness.trim() || !salesForm.businessAreaSqm || !salesForm.registrationType || !salesForm.tin.trim() || !salesForm.birRegistered || !salesForm.hasOtherBranches || !salesForm.hasMultipleLines) {
        return alert('Please fill in all mandatory fields before proceeding.');
      }
    } else if (currentStep === 3) {
      if (!salesForm.grossSales || !salesForm.year || !salesForm.assessmentPeriod) {
        return alert('Please fill in all mandatory sales fields before proceeding.');
      }
      const gross = Number(salesForm.grossSales);
      if (!Number.isFinite(gross) || gross < 0) return alert('Enter a valid non-negative gross sales amount.');
    } else if (currentStep === 4) {
      for (const definition of applicableDocumentDefinitions().filter((item) => item.required)) {
        if (!(salesFiles[definition.key] || []).length) return alert(`Please upload: ${definition.label}.`);
      }
    }
    setCurrentStep(targetStep);
  };

  const handleSalesDeclarationSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validateSalesSubmission();
    if (validationError) {
      alert(validationError);
      return;
    }
    if (!user) {
      alert('Please log in before submitting a Business Tax assessment.');
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('businessName', salesForm.businessName.trim());
      formData.append('businessOwner', salesForm.businessOwner.trim());
      formData.append('businessAddress', salesForm.businessAddress.trim());
      formData.append('barangay', salesForm.barangay.trim());
      formData.append('businessType', salesForm.businessType);
      formData.append('lineOfBusiness', salesForm.lineOfBusiness.trim());
      formData.append('businessAreaSqm', salesForm.businessAreaSqm);
      formData.append('registrationType', salesForm.registrationType);
      formData.append('registrationNumber', salesForm.registrationNumber.trim());
      formData.append('mayorsPermitNumber', salesForm.mayorsPermitNumber.trim());
      formData.append('birRegistered', salesForm.birRegistered === 'yes' ? 'true' : 'false');
      formData.append('hasOtherBranches', salesForm.hasOtherBranches === 'yes' ? 'true' : 'false');
      formData.append('hasMultipleLines', salesForm.hasMultipleLines === 'yes' ? 'true' : 'false');
      formData.append('grossSales', salesForm.grossSales);
      formData.append('year', salesForm.year);
      formData.append('assessmentPeriod', salesForm.assessmentPeriod);
      formData.append('quarter', salesForm.quarter);
      formData.append('psicCode', salesForm.psicCode.trim());
      formData.append('tin', salesForm.tin.trim());
      formData.append('email', user.email);

      const documentTypes: string[] = [];
      for (const definition of applicableDocumentDefinitions()) {
        for (const file of salesFiles[definition.key] || []) {
          documentTypes.push(definition.key);
          formData.append('documents', file, file.name);
        }
      }
      formData.append('documentTypes', JSON.stringify(documentTypes));

      const response = await fetch(`${API_BASE_URL}/business-assessments/sales-declaration`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.token}` },
        body: formData,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Failed to submit Business Tax assessment.');
      setSubmissionSuccess({
        trackingNumber: data.trackingNumber,
        date: new Date().toLocaleDateString(),
        name: salesForm.businessName,
      });
      setSalesFiles({});
      void fetchAssessments();
    } catch (error: any) {
      alert(error.message || 'An error occurred while submitting the assessment.');
    } finally {
      setSubmitting(false);
    }
  };

  const openModal = (type: 'appointment' | 'sales-declaration' | 'link-application') => {
    if (type === 'appointment') {
      setCaptchaNum1(Math.floor(Math.random() * 10) + 1);
      setCaptchaNum2(Math.floor(Math.random() * 10) + 1);
      setCaptchaInput('');
    }
    if (type === 'sales-declaration') {
      setCurrentStep(1);
      setCertificationChecked(false);
      setSubmissionSuccess(null);
    }
    if (type === 'link-application') {
      setLinkAppForm({ trackingNumber: '' });
    }
    setIsModalOpen(type);
  };

  const handleAppointmentSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (!/^\d{11}$/.test(aptForm.phone.trim())) return alert('Please enter a valid 11-digit Philippine mobile number.');
    if (Number.parseInt(captchaInput, 10) !== captchaNum1 + captchaNum2) return alert('Incorrect CAPTCHA answer.');
    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
        body: JSON.stringify(aptForm),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Failed to submit appointment.');
      alert('Appointment submitted successfully.');
      setIsModalOpen(false);
      void fetchUserAppointments();
    } catch (error: any) {
      alert(error.message || 'Failed to submit appointment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTaxBillVerification = async (event: React.FormEvent) => {
    event.preventDefault();
    setVerifying(true);
    setVerificationResult(null);
    setVerificationError(null);
    try {
      const response = verificationType === 'tax-bill'
        ? await fetch(`${API_BASE_URL}/verify/tax-bill`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taxBillNo: taxBillForm.taxBillNo.trim(), tin: taxBillForm.tin.trim() }) })
        : await fetch(`${API_BASE_URL}/verify/or-number`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orForm) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Verification failed.');
      setVerificationResult(data);
    } catch (error: any) {
      setVerificationError(error.message || 'Verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  const handlePayMongoBusinessTaxQrPayment = async (record: AssessmentRecord) => {
    if (record.status !== 'APPROVED' || record.paymentStatus === 'PAID') {
      setQrError('This assessment is not available for payment.');
      return;
    }
    const amount = Number(record.paymentAmount || record.computedFees?.total || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      setQrError('The Treasurer’s Office has not yet recorded a valid approved amount for this assessment.');
      return;
    }
    setIsProcessingPayment(true);
    setQrCodeUrl('');
    setQrReferenceNumber('');
    setQrPaymentIntentId('');
    setQrError('');
    setQrPaymentPaid(false);
    setPaymentConfirmedAt(null);
    setPaymentReceiptNumber('');
    setPaymentReference('');
    setPaymentAmount(amount);
    setQrSecondsRemaining(300);
    try {
      const paymentIntent = await createPayMongoQrPaymentIntent({
        amount,
        type: 'BUSINESS_TAX',
        businessTrackingNumber: record.trackingNumber,
        customerName: record.businessOwner || user?.fullname || 'Business Taxpayer',
        customerEmail: user?.email || '',
        description: `Business Tax Assessment Payment (${record.trackingNumber})`,
      });
      setQrPaymentIntentId(paymentIntent.paymentIntentId);
      setQrReferenceNumber(paymentIntent.referenceNumber);
      const paymentMethodId = await createQrPhPaymentMethod(paymentIntent.publicKey, 300);
      const attachedPayment = await attachQrPhPaymentMethod(paymentIntent.paymentIntentId, paymentMethodId, paymentIntent.clientKey, paymentIntent.publicKey);
      const imageUrl = attachedPayment?.attributes?.next_action?.code?.image_url || attachedPayment?.next_action?.code?.image_url || attachedPayment?.attributes?.next_action?.qr_code?.image_url || attachedPayment?.qr_code?.image_url || '';
      if (!imageUrl) throw new Error('PayMongo did not return a QRPh code image. Please try again.');
      setQrCodeUrl(imageUrl);
    } catch (error: any) {
      console.error(error);
      setQrError(error?.message || 'Unable to generate the QRPh payment code.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const openBusinessTaxPayment = (record: AssessmentRecord) => {
    setPaymentAssessment(record);
    setSelectedAssessmentView(null);
    setIsPaymentSuccess(false);
    setIsPaymentStep(true);
    void handlePayMongoBusinessTaxQrPayment(record);
  };

  const closeBusinessTaxPayment = () => {
    if (isProcessingPayment) return;
    setIsPaymentStep(false);
    setIsPaymentSuccess(false);
    setPaymentAssessment(null);
    setQrCodeUrl('');
    setQrReferenceNumber('');
    setQrPaymentIntentId('');
    setQrError('');
    setPaymentConfirmedAt(null);
    setQrPaymentPaid(false);
  };

  const submitComplianceDocuments = async () => {
    if (!selectedAssessmentView || !user) return;
    const files: File[] = [];
    const documentTypes: string[] = [];
    Object.entries(complianceFiles).forEach(([key, values]) => {
      (values || []).forEach((file) => {
        files.push(file);
        documentTypes.push(key);
      });
    });
    if (!files.length) return alert('Please upload at least one requested document.');
    setIsComplianceSubmitting(true);
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('documents', file, file.name));
      formData.append('documentTypes', JSON.stringify(documentTypes));
      const response = await fetch(`${API_BASE_URL}/business-assessments/${selectedAssessmentView.id}/compliance-documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.token}` },
        body: formData,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Failed to submit compliance documents.');
      setSelectedAssessmentView(data.record);
      setComplianceFiles({});
      alert('Additional documents submitted successfully. Your assessment has returned to the review queue.');
      void fetchAssessments();
    } catch (error: any) {
      alert(error.message || 'Failed to submit additional documents.');
    } finally {
      setIsComplianceSubmitting(false);
    }
  };

  const renderDocumentUploader = (definition: { key: DocumentRequirementKey; label: string; help: string; multiple?: boolean; required: boolean }, values: Partial<Record<DocumentRequirementKey, File[]>>, setter: React.Dispatch<React.SetStateAction<Partial<Record<DocumentRequirementKey, File[]>>>>) => (
    <div key={definition.key} className={`rounded-xl border p-3 ${definition.required ? 'border-slate-200 dark:border-slate-700' : 'border-dashed border-slate-300 dark:border-slate-700'}`}>
      <div className="flex justify-between gap-3">
        <div className="min-w-0">
          <div className="font-bold text-slate-800 dark:text-slate-200">{definition.label} {definition.required && <span className="text-rose-500">*</span>}</div>
          <div className="text-[10px] leading-4 text-slate-500 dark:text-slate-400 mt-0.5">{definition.help}</div>
        </div>
        <span className={`shrink-0 text-[9px] font-bold rounded-full px-2 py-1 ${definition.required ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{definition.required ? 'REQUIRED' : 'OPTIONAL'}</span>
      </div>
      <input
        type="file"
        required={definition.required && !(values[definition.key] || []).length}
        multiple={Boolean(definition.multiple)}
        accept={formatFileAccept}
        onChange={(event) => setter((prev) => ({ ...prev, [definition.key]: event.target.files ? Array.from(event.target.files) : [] }))}
        className="mt-2 w-full text-[10px] p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
      />
      {(values[definition.key] || []).length > 0 && <div className="mt-2 text-[10px] text-emerald-700 dark:text-emerald-300">{(values[definition.key] || []).map((file) => file.name).join(', ')}</div>}
    </div>
  );

  return (
    <CitizenLayout activeTitle="Business Tax Assessment" activeNav="btax">
      <div className="w-full">
        <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8 relative bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 min-h-36 sm:min-h-48 overflow-hidden flex items-center justify-center border-b-4 border-blue-600">
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]" />
          <div className="relative z-10 text-center px-4">
            <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-wide">{currentScreen === 'appointments-list' ? 'MY APPOINTMENTS TRACKER' : currentScreen === 'verification' ? 'TAX BILL & O.R. NUMBER VERIFICATION' : 'BUSINESS TAX PAYMENT'}</h1>
            <p className="mt-2 text-[11px] sm:text-xs text-blue-100">Assessment, review, payment, official receipt and treasury recording</p>
          </div>
        </div>

        {currentScreen !== 'assessment-list' && (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 py-3 mt-2">
            {[
              ['assessment-list', 'My Assessments (Dashboard)'],
              ['appointments-list', 'My Appointments'],
              ['verification', 'Verify Tax Bill / O.R.'],
            ].map(([key, label]) => (
              <button key={key} type="button" onClick={() => setCurrentScreen(key as ActiveScreen)} className={`px-3 py-2 rounded-lg text-[11px] font-bold ${currentScreen === key ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>{label}</button>
            ))}
            {currentScreen !== 'verification' && <button type="button" onClick={() => openModal('appointment')} className="ml-auto px-3 py-2 rounded-lg text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white">Book CTO Appointment</button>}
          </div>
        )}

        {currentScreen === 'assessment-list' && (
          <div className="mt-6 space-y-8">
            
            {/* Primary Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-start border-b border-slate-200 dark:border-slate-800 pb-8">
              <button type="button" onClick={() => openModal('sales-declaration')} className="px-6 py-4 rounded-full bg-blue-700 hover:bg-blue-800 text-white font-extrabold text-sm shadow-md transition-transform hover:scale-105 uppercase tracking-wide">
                SUBMIT ONLINE SALES DECLARATION
              </button>
              <button type="button" onClick={() => openModal('link-application')} className="px-6 py-4 rounded-full bg-blue-700 hover:bg-blue-800 text-white font-extrabold text-sm shadow-md transition-transform hover:scale-105 uppercase tracking-wide">
                LINK IN-PERSON APPLICATION TO MY ACCOUNT
              </button>
            </div>

            {/* Filter and Search Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-end">
              <div>
                <label className="block text-slate-500 text-xs mb-1 font-semibold">Application Status</label>
                <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} className="w-full sm:w-64 p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="ALL">ALL</option>
                  <option value="SUBMITTED">SUBMITTED</option>
                  <option value="FOR INITIAL ASSESSMENT">FOR INITIAL ASSESSMENT</option>
                  <option value="FOR FINAL REVIEW">FOR FINAL REVIEW</option>
                  <option value="RETURNED FOR COMPLIANCE">RETURNED FOR COMPLIANCE</option>
                  <option value="RESUBMITTED">RESUBMITTED</option>
                  <option value="FOR FINAL APPROVAL">FOR FINAL APPROVAL</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="TAX BILL ISSUED">TAX BILL ISSUED</option>
                  <option value="FOR PAYMENT">FOR PAYMENT</option>
                  <option value="PAID">PAID</option>
                  <option value="OR ISSUED">OR ISSUED</option>
                </select>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 lg:justify-end">
                <label className="block text-slate-500 text-xs font-semibold sm:mr-2">Search:</label>
                <select value={searchType} onChange={(e) => setSearchType(e.target.value)} className="w-full sm:w-48 p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option>Tracking Number</option>
                  <option>Mayor's Permit Number</option>
                  <option>Business Name</option>
                </select>
                <div className="flex w-full sm:w-auto">
                  <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { setCurrentPage(1); void fetchAssessments(); } }} className="w-full sm:w-48 p-2.5 rounded-l-lg border border-r-0 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:border-blue-500" />
                  <button type="button" onClick={() => { setCurrentPage(1); void fetchAssessments(); }} className="px-4 py-2.5 rounded-r-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm border border-l-0 border-slate-300 dark:border-slate-700">Search</button>
                </div>
              </div>
            </div>

            {fetchError && <div className="p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs">{fetchError}</div>}
            
            {/* Table Section */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-none overflow-x-auto">
              <table className="w-full text-sm min-w-[1000px]">
                <thead className="bg-blue-900 text-white uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="px-4 py-4 text-left border-r border-blue-800">TRACKING/MAYOR'S PERMIT NUMBER</th>
                    <th className="px-4 py-4 text-left border-r border-blue-800">BUSINESS NAME</th>
                    <th className="px-4 py-4 text-left border-r border-blue-800">BUSINESS OWNER</th>
                    <th className="px-4 py-4 text-left border-r border-blue-800">APPLICATION STATUS</th>
                    <th className="px-4 py-4 text-left border-r border-blue-800">APPLICATION DATE</th>
                    <th className="px-4 py-4 text-center">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {loading ? (
                    <tr><td colSpan={6} className="px-4 py-16 text-center text-slate-500 bg-slate-100/50 dark:bg-slate-800/50">Loading records...</td></tr>
                  ) : assessments.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500 bg-slate-100 dark:bg-slate-800/50 font-medium border-b border-slate-200 dark:border-slate-700">No data available in table</td></tr>
                  ) : assessments.map((record) => (
                    <tr key={record.id} className="hover:bg-blue-50 dark:hover:bg-blue-950/20">
                      <td className="px-4 py-4 font-mono font-bold text-blue-700 dark:text-blue-400 border-r border-slate-100 dark:border-slate-800">
                        <div>{record.trackingNumber}</div>
                        {record.mayorPermitNumber && <div className="text-xs font-normal text-slate-500 mt-1">{record.mayorPermitNumber}</div>}
                      </td>
                      <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800"><div className="font-bold text-slate-800 dark:text-slate-200">{record.businessName}</div></td>
                      <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800">{record.businessOwner || '—'}</td>
                      <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800 text-xs font-bold uppercase text-slate-700 dark:text-slate-300">{record.status.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-4 border-r border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">{new Date(record.applicationDate).toLocaleDateString()}</td>
                      <td className="px-4 py-4 text-center">
                        <button type="button" onClick={() => { setSelectedAssessmentView(record); setComplianceFiles({}); }} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-bold underline underline-offset-2">
                          {record.status === 'FOR_COMPLIANCE' ? 'Respond' : (record.paymentStatus === 'PAID' ? 'View OR' : (record.status === 'APPROVED' ? 'Pay' : 'View'))}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Section */}
            <div className="flex flex-col sm:flex-row items-center justify-between text-sm text-slate-600 dark:text-slate-400 pt-2">
              <div className="order-2 sm:order-1 mt-4 sm:mt-0">Showing {assessments.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {assessments.length === 0 ? 0 : Math.min(currentPage * pageSize, (currentPage - 1) * pageSize + assessments.length)} of {totalPages * pageSize || 0} entries</div>
              <div className="flex border border-slate-300 dark:border-slate-700 rounded-md overflow-hidden order-1 sm:order-2 shadow-sm">
                <button type="button" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} className="px-4 py-2 bg-white dark:bg-slate-900 border-r border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-950 font-medium">Previous</button>
                <button type="button" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} className="px-4 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-950 font-medium">Next</button>
              </div>
            </div>
          </div>
        )}

        {currentScreen === 'appointments-list' && (
          <div className="mt-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs"><thead className="bg-slate-50 dark:bg-slate-950"><tr><th className="px-4 py-3 text-left">Purpose</th><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Time</th><th className="px-4 py-3 text-left">Status</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{userAppointments.length ? userAppointments.map((appointment) => <tr key={appointment.id}><td className="px-4 py-3 font-semibold">{appointment.appointmentType}</td><td className="px-4 py-3">{appointment.date}</td><td className="px-4 py-3">{appointment.timeSlot || 'All Day'}</td><td className="px-4 py-3"><span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 font-bold">{appointment.status}</span></td></tr>) : <tr><td colSpan={4} className="px-4 py-12 text-center text-slate-400">No appointment records found.</td></tr>}</tbody></table>
          </div>
        )}

        {currentScreen === 'verification' && (
          <form onSubmit={handleTaxBillVerification} className="mt-5 max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex gap-2"><button type="button" onClick={() => setVerificationType('tax-bill')} className={`px-3 py-2 rounded-lg text-xs font-bold ${verificationType === 'tax-bill' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>Tax Bill Verification</button><button type="button" onClick={() => setVerificationType('or-number')} className={`px-3 py-2 rounded-lg text-xs font-bold ${verificationType === 'or-number' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>O.R. Verification</button></div>
            {verificationType === 'tax-bill' ? <><input value={taxBillForm.taxBillNo} onChange={(e) => setTaxBillForm({ ...taxBillForm, taxBillNo: e.target.value })} placeholder="Tax Bill Number" required className="w-full p-3 border rounded-xl text-xs bg-transparent" /><input value={taxBillForm.tin} onChange={(e) => setTaxBillForm({ ...taxBillForm, tin: e.target.value })} placeholder="TIN" required className="w-full p-3 border rounded-xl text-xs bg-transparent" /></> : <><input value={orForm.permitNo} onChange={(e) => setOrForm({ ...orForm, permitNo: e.target.value })} placeholder="Mayor's Permit No. / Tracking No." required className="w-full p-3 border rounded-xl text-xs bg-transparent" /><input value={orForm.orNo} onChange={(e) => setOrForm({ ...orForm, orNo: e.target.value })} placeholder="Official Receipt Number" required className="w-full p-3 border rounded-xl text-xs bg-transparent" /><input value={orForm.tin} onChange={(e) => setOrForm({ ...orForm, tin: e.target.value })} placeholder="TIN" required className="w-full p-3 border rounded-xl text-xs bg-transparent" /></>}
            <button disabled={verifying} type="submit" className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold">{verifying ? 'Verifying...' : 'Verify Record'}</button>
            {verificationError && <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">{verificationError}</div>}
            {verificationResult && <pre className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl text-[10px] whitespace-pre-wrap break-words">{JSON.stringify(verificationResult, null, 2)}</pre>}
          </form>
        )}
      </div>

      {isModalOpen === 'sales-declaration' && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-y-auto border border-slate-200 dark:border-slate-800">
            {submissionSuccess ? (
              <div className="p-8 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-3xl font-bold mb-4">✓</div>
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white uppercase mb-2">APPLICATION SUBMITTED</h2>
                <div className="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-md">Your application has been submitted for Treasury assessment. You will receive a notification regarding the assessment status.</div>
                
                <div className="w-full max-w-sm rounded-2xl bg-slate-50 dark:bg-slate-950 p-5 text-left space-y-3 text-xs mb-8">
                  <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-2"><span className="text-slate-500">Tracking Number</span><span className="font-mono font-bold text-blue-600">{submissionSuccess.trackingNumber}</span></div>
                  <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-2"><span className="text-slate-500">Submission Date</span><span className="font-semibold">{submissionSuccess.date}</span></div>
                  <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-2"><span className="text-slate-500">Business Name</span><span className="font-semibold text-right">{submissionSuccess.name}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Status</span><span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 font-bold text-[9px]">Submitted</span></div>
                </div>

                <div className="flex justify-center gap-3 w-full max-w-sm">
                  <button type="button" onClick={() => { setIsModalOpen(false); setSalesForm((prev) => ({ ...prev, businessName: '', businessAddress: '', barangay: '', lineOfBusiness: '', businessAreaSqm: '', registrationNumber: '', mayorsPermitNumber: '', grossSales: '', psicCode: '', tin: '' })); }} className="flex-1 px-4 py-3 rounded-xl border font-bold text-sm">Close</button>
                  <button type="button" onClick={() => { setIsModalOpen(false); setSalesForm((prev) => ({ ...prev, businessName: '', businessAddress: '', barangay: '', lineOfBusiness: '', businessAreaSqm: '', registrationNumber: '', mayorsPermitNumber: '', grossSales: '', psicCode: '', tin: '' })); setCurrentScreen('assessment-list'); }} className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700">View Application Status</button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSalesDeclarationSubmit} className="flex flex-col h-full">
                <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b bg-slate-50 dark:bg-slate-950">
                  <div>
                    <h3 className="font-bold text-sm">2026 BUSINESS TAX ASSESSMENT</h3>
                    <p className="text-[10px] text-slate-500 mt-1">Submit the Sales Declaration and applicable supporting documents for Treasurer assessment.</p>
                  </div>
                  <button type="button" onClick={() => setIsModalOpen(false)} className="text-xl font-bold">×</button>
                </div>
                
                <div className="px-5 py-3 border-b bg-white dark:bg-slate-900 flex gap-2">
                  {[1, 2, 3, 4, 5].map((step) => (
                    <div key={step} className={`flex-1 h-2 rounded-full ${currentStep === step ? 'bg-blue-600' : currentStep > step ? 'bg-blue-200 dark:bg-blue-900' : 'bg-slate-200 dark:bg-slate-800'}`} />
                  ))}
                  <div className="text-[10px] font-bold text-slate-500 ml-2 whitespace-nowrap">Step {currentStep} of 5</div>
                </div>

                <div className="p-5 text-xs flex-1">
                  {currentStep === 1 && (
                    <div className="space-y-4">
                      <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 mb-4">
                        <p className="font-bold text-blue-900 dark:text-blue-200">Important</p>
                        <p className="mt-1 text-[10px] text-blue-800 dark:text-blue-300">Submitting this application creates a tracking number only. The Tax Bill and payment amount are issued after assessment, final review and Treasurer approval.</p>
                      </div>
                      <h4 className="font-bold text-sm border-b pb-2 mb-4">Business Identification</h4>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div><label className="label">Mayor’s Permit Number *</label><input required value={salesForm.mayorsPermitNumber} onChange={(e) => setSalesForm({ ...salesForm, mayorsPermitNumber: e.target.value })} className="field" /></div>
                        <div><label className="label">Business Name *</label><input required value={salesForm.businessName} onChange={(e) => setSalesForm({ ...salesForm, businessName: e.target.value })} className="field" /></div>
                        <div><label className="label">Business Owner / Applicant *</label><input required value={salesForm.businessOwner} onChange={(e) => setSalesForm({ ...salesForm, businessOwner: e.target.value })} className="field" /></div>
                        <div className="lg:col-span-2"><label className="label">Business Address *</label><input required value={salesForm.businessAddress} onChange={(e) => setSalesForm({ ...salesForm, businessAddress: e.target.value })} className="field" /></div>
                        <div><label className="label">Barangay *</label><input required value={salesForm.barangay} onChange={(e) => setSalesForm({ ...salesForm, barangay: e.target.value })} className="field" /></div>
                      </div>
                    </div>
                  )}

                  {currentStep === 2 && (
                    <div className="space-y-4">
                      <h4 className="font-bold text-sm border-b pb-2 mb-4">Business Profile & Registration</h4>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div><label className="label">Business Type *</label><select value={salesForm.businessType} onChange={(e) => setSalesForm({ ...salesForm, businessType: e.target.value })} className="field"><option>Manufacturer</option><option>Wholesaler</option><option>Retailer</option><option>Exporter</option><option>Service</option><option>Other</option></select></div>
                        <div><label className="label">Line / Nature of Business *</label><input required value={salesForm.lineOfBusiness} onChange={(e) => setSalesForm({ ...salesForm, lineOfBusiness: e.target.value })} className="field" placeholder="e.g. Retail sale of food products" /></div>
                        <div><label className="label">Business Area (sqm) *</label><input required type="number" min="0" step="0.01" value={salesForm.businessAreaSqm} onChange={(e) => setSalesForm({ ...salesForm, businessAreaSqm: e.target.value })} className="field" /></div>
                        <div><label className="label">Registration Type *</label><select value={salesForm.registrationType} onChange={(e) => setSalesForm({ ...salesForm, registrationType: e.target.value })} className="field"><option>DTI</option><option>SEC</option><option>CDA</option><option>Other</option></select></div>
                        <div><label className="label">Registration Number</label><input value={salesForm.registrationNumber} onChange={(e) => setSalesForm({ ...salesForm, registrationNumber: e.target.value })} className="field" placeholder="DTI / SEC / CDA number" /></div>
                        <div><label className="label">TIN *</label><input required value={salesForm.tin} onChange={(e) => setSalesForm({ ...salesForm, tin: e.target.value })} className="field" /></div>
                        <div><label className="label">BIR Registered? *</label><select value={salesForm.birRegistered} onChange={(e) => setSalesForm({ ...salesForm, birRegistered: e.target.value })} className="field"><option value="yes">Yes — BIR Registered</option><option value="no">No — Not BIR Registered</option></select></div>
                        <div><label className="label">Other Branches? *</label><select value={salesForm.hasOtherBranches} onChange={(e) => setSalesForm({ ...salesForm, hasOtherBranches: e.target.value })} className="field"><option value="no">No</option><option value="yes">Yes</option></select></div>
                        <div><label className="label">Multiple Lines of Business? *</label><select value={salesForm.hasMultipleLines} onChange={(e) => setSalesForm({ ...salesForm, hasMultipleLines: e.target.value })} className="field"><option value="no">No</option><option value="yes">Yes</option></select></div>
                      </div>
                    </div>
                  )}

                  {currentStep === 3 && (
                    <div className="space-y-6">
                      <div>
                        <h4 className="font-bold text-sm border-b pb-2 mb-4">A. Tax Year / Assessment Period</h4>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div><label className="label">Tax Year *</label><input required type="number" min="2000" max="2100" value={salesForm.year} onChange={(e) => setSalesForm({ ...salesForm, year: e.target.value })} className="field" /></div>
                          <div><label className="label">Assessment Period *</label><select value={salesForm.assessmentPeriod} onChange={(e) => setSalesForm({ ...salesForm, assessmentPeriod: e.target.value, quarter: e.target.value === 'ANNUAL_RENEWAL' ? 'ANNUAL' : salesForm.quarter })} className="field"><option value="ANNUAL_RENEWAL">Annual Renewal</option></select></div>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-bold text-sm border-b pb-2 mb-4">B. Gross Sales / Receipts</h4>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div><label className="label">Gross Sales / Receipts (PHP) *</label><input required type="number" min="0" step="0.01" value={salesForm.grossSales} onChange={(e) => setSalesForm({ ...salesForm, grossSales: e.target.value })} className="field font-bold text-blue-700" /></div>
                          <div><label className="label">PSIC Code (optional)</label><input value={salesForm.psicCode} onChange={(e) => setSalesForm({ ...salesForm, psicCode: e.target.value })} className="field" placeholder="e.g. 47110" /></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStep === 4 && (
                    <div className="space-y-4">
                      <h4 className="font-bold text-sm border-b pb-2 mb-4">Supporting Documents</h4>
                      <p className="text-slate-500 text-[10px] mb-4">Please upload the required documents below based on your business profile.</p>
                      <div className="space-y-2">
                        {applicableDocumentDefinitions().map((definition) => renderDocumentUploader(definition, salesFiles, setSalesFiles))}
                      </div>
                    </div>
                  )}

                  {currentStep === 5 && (
                    <div className="space-y-6">
                      <h4 className="font-bold text-sm border-b pb-2 mb-4">Review & Submit</h4>
                      
                      <div className="rounded-xl border p-4 space-y-4 bg-slate-50 dark:bg-slate-950">
                        <div className="flex justify-between items-center border-b pb-2"><div className="font-bold">1. Business Identification</div><button type="button" onClick={() => setCurrentStep(1)} className="text-blue-600 font-bold hover:underline">Edit</button></div>
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div><span className="text-slate-500">Mayor's Permit:</span> <span className="font-mono">{salesForm.mayorsPermitNumber}</span></div>
                          <div><span className="text-slate-500">Business Name:</span> {salesForm.businessName}</div>
                          <div><span className="text-slate-500">Owner:</span> {salesForm.businessOwner}</div>
                          <div className="col-span-2"><span className="text-slate-500">Address:</span> {salesForm.businessAddress}, {salesForm.barangay}</div>
                        </div>
                      </div>

                      <div className="rounded-xl border p-4 space-y-4 bg-slate-50 dark:bg-slate-950">
                        <div className="flex justify-between items-center border-b pb-2"><div className="font-bold">2. Business Profile & Registration</div><button type="button" onClick={() => setCurrentStep(2)} className="text-blue-600 font-bold hover:underline">Edit</button></div>
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div><span className="text-slate-500">Type:</span> {salesForm.businessType}</div>
                          <div><span className="text-slate-500">Line:</span> {salesForm.lineOfBusiness}</div>
                          <div><span className="text-slate-500">Area:</span> {salesForm.businessAreaSqm} sqm</div>
                          <div><span className="text-slate-500">Registration:</span> {salesForm.registrationType} {salesForm.registrationNumber}</div>
                          <div><span className="text-slate-500">TIN:</span> {salesForm.tin}</div>
                          <div><span className="text-slate-500">BIR Registered:</span> {salesForm.birRegistered === 'yes' ? 'Yes' : 'No'}</div>
                          <div><span className="text-slate-500">Other Branches:</span> {salesForm.hasOtherBranches === 'yes' ? 'Yes' : 'No'}</div>
                          <div><span className="text-slate-500">Multiple Lines:</span> {salesForm.hasMultipleLines === 'yes' ? 'Yes' : 'No'}</div>
                        </div>
                      </div>

                      <div className="rounded-xl border p-4 space-y-4 bg-slate-50 dark:bg-slate-950">
                        <div className="flex justify-between items-center border-b pb-2"><div className="font-bold">3. Sales Declaration & Tax Information</div><button type="button" onClick={() => setCurrentStep(3)} className="text-blue-600 font-bold hover:underline">Edit</button></div>
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div><span className="text-slate-500">Tax Year:</span> {salesForm.year}</div>
                          <div><span className="text-slate-500">Period:</span> {salesForm.assessmentPeriod}</div>
                          <div><span className="text-slate-500">PSIC:</span> {salesForm.psicCode || '—'}</div>
                          <div><span className="text-slate-500">Gross Sales:</span> <span className="font-bold font-mono">PHP {Number(salesForm.grossSales).toLocaleString()}</span></div>
                        </div>
                      </div>

                      <div className="rounded-xl border p-4 space-y-4 bg-slate-50 dark:bg-slate-950">
                        <div className="flex justify-between items-center border-b pb-2"><div className="font-bold">4. Supporting Documents</div><button type="button" onClick={() => setCurrentStep(4)} className="text-blue-600 font-bold hover:underline">Edit</button></div>
                        <div className="text-[10px]">
                          {applicableDocumentDefinitions().filter(d => (salesFiles[d.key] || []).length > 0).map(d => (
                            <div key={d.key} className="flex gap-2 items-center mb-1">
                              <span className="text-emerald-600">✓</span>
                              <span className="font-semibold">{d.label}</span>
                              <span className="text-slate-500">({(salesFiles[d.key] || []).length} file(s))</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl border border-blue-200 dark:border-blue-800">
                        <input type="checkbox" required id="certify" checked={certificationChecked} onChange={(e) => setCertificationChecked(e.target.checked)} className="mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" />
                        <label htmlFor="certify" className="text-[10px] text-slate-700 dark:text-slate-300 font-bold cursor-pointer select-none">
                          I certify that the information and documents submitted are true and correct to the best of my knowledge and belief.
                        </label>
                      </div>

                    </div>
                  )}
                </div>
                
                <div className="sticky bottom-0 flex justify-between gap-2 px-5 py-4 border-t bg-slate-50 dark:bg-slate-950 mt-auto">
                  {currentStep === 1 ? (
                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl border text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700">Cancel</button>
                  ) : (
                    <button type="button" onClick={() => setCurrentStep(prev => prev - 1)} className="px-5 py-2.5 rounded-xl border text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700">Back</button>
                  )}
                  
                  {currentStep < 5 ? (
                    <button type="button" onClick={() => handleNextStep(currentStep + 1)} className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-sm">Next Step</button>
                  ) : (
                    <button disabled={submitting || !certificationChecked} type="submit" className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                      {submitting ? 'Submitting...' : 'Submit for Assessment'}
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {isModalOpen === 'appointment' && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleAppointmentSubmit} className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-xl overflow-hidden">
            <div className="flex justify-between px-5 py-4 border-b bg-slate-50 dark:bg-slate-950"><h3 className="font-bold text-sm">BOOK CTO APPOINTMENT</h3><button type="button" onClick={() => setIsModalOpen(false)} className="font-bold text-xl">×</button></div>
            <div className="p-5 space-y-3 text-xs"><input required placeholder="Appointment Type" value={aptForm.appointmentType} onChange={(e) => setAptForm({ ...aptForm, appointmentType: e.target.value })} className="field" /><input required placeholder="Business Name" value={aptForm.businessName} onChange={(e) => setAptForm({ ...aptForm, businessName: e.target.value })} className="field" /><input placeholder="TIN" value={aptForm.tin} onChange={(e) => setAptForm({ ...aptForm, tin: e.target.value })} className="field" /><input required placeholder="Address" value={aptForm.address} onChange={(e) => setAptForm({ ...aptForm, address: e.target.value })} className="field" /><textarea required placeholder="Description / Concern" value={aptForm.description} onChange={(e) => setAptForm({ ...aptForm, description: e.target.value })} className="field" rows={3} /><input required type="tel" placeholder="09123456789" value={aptForm.phone} onChange={(e) => setAptForm({ ...aptForm, phone: e.target.value })} className="field" /><input required type="date" value={aptForm.date} onChange={(e) => setAptForm({ ...aptForm, date: e.target.value })} className="field" /><select value={aptForm.timeSlot} onChange={(e) => setAptForm({ ...aptForm, timeSlot: e.target.value })} className="field"><option>08:00 AM - 09:00 AM</option><option>09:00 AM - 10:00 AM</option><option>10:00 AM - 11:00 AM</option><option>01:00 PM - 02:00 PM</option><option>02:00 PM - 03:00 PM</option><option>03:00 PM - 04:00 PM</option></select><div className="flex items-center justify-between rounded-xl border p-3"><span className="font-mono font-bold">{captchaNum1} + {captchaNum2} = ?</span><input required value={captchaInput} onChange={(e) => setCaptchaInput(e.target.value)} className="w-24 p-2 border rounded-lg text-center" /><button type="button" onClick={() => { setCaptchaNum1(Math.floor(Math.random() * 10) + 1); setCaptchaNum2(Math.floor(Math.random() * 10) + 1); setCaptchaInput(''); }} className="text-blue-600 font-bold">Refresh</button></div></div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t bg-slate-50 dark:bg-slate-950"><button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-xl border text-xs font-bold">Cancel</button><button disabled={submitting} type="submit" className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold">{submitting ? 'Submitting...' : 'Submit Appointment'}</button></div>
          </form>
        </div>
      )}

      {selectedAssessmentView && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[94vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="sticky top-0 z-10 flex justify-between items-center px-5 py-4 bg-slate-50 dark:bg-slate-950 border-b"><div><h3 className="font-bold text-sm uppercase">Business Tax Assessment Details</h3><p className="font-mono text-[10px] text-blue-600 mt-1">{selectedAssessmentView.trackingNumber}</p></div><button type="button" onClick={() => setSelectedAssessmentView(null)} className="text-xl font-bold">×</button></div>
            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50"><div><span className="labelText">Business</span><div className="font-bold">{selectedAssessmentView.businessName}</div></div><div><span className="labelText">Owner</span><div className="font-bold">{selectedAssessmentView.businessOwner}</div></div><div><span className="labelText">Mayor’s Permit</span><div className="font-mono">{selectedAssessmentView.mayorPermitNumber || '—'}</div></div><div><span className="labelText">Status</span><span className={`inline-block px-2 py-1 rounded-full text-[9px] font-bold ${statusClass(selectedAssessmentView.status)}`}>{selectedAssessmentView.status}</span></div></div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><div><span className="labelText">Gross Sales / Receipts</span><div className="font-bold">{money(selectedAssessmentView.grossSales)}</div></div><div><span className="labelText">Tax Bill</span><div className="font-mono font-bold text-blue-700 dark:text-blue-400">{selectedAssessmentView.taxBillNumber || 'Not yet issued'}</div></div><div><span className="labelText">Order of Payment</span><div className="font-mono">{selectedAssessmentView.orderOfPaymentNumber || 'Not yet issued'}</div></div><div><span className="labelText">Due Date</span><div>{selectedAssessmentView.dueDate ? new Date(selectedAssessmentView.dueDate).toLocaleDateString() : '—'}</div></div></div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3"><div className="card"><span className="labelText">Address</span><div>{selectedAssessmentView.businessAddress || '—'}</div><div>{selectedAssessmentView.barangay || '—'}</div></div><div className="card"><span className="labelText">Business Classification</span><div>{selectedAssessmentView.businessType || '—'}</div><div>{selectedAssessmentView.lineOfBusiness || '—'}</div><div>{Number(selectedAssessmentView.businessAreaSqm || 0).toLocaleString()} sqm</div></div><div className="card"><span className="labelText">Registration</span><div>{selectedAssessmentView.registrationType || '—'} {selectedAssessmentView.registrationNumber || ''}</div><div>BIR Registered: {selectedAssessmentView.birRegistered ? 'Yes' : 'No'}</div><div>Branches: {selectedAssessmentView.hasOtherBranches ? 'Yes' : 'No'}</div><div>Multiple Lines: {selectedAssessmentView.hasMultipleLines ? 'Yes' : 'No'}</div></div></div>
              <div className="card"><div className="font-bold mb-2">Submitted Documents</div>{(selectedAssessmentView.attachments || []).length ? <div className="space-y-2">{(selectedAssessmentView.attachments || []).map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-white dark:bg-slate-900 border"><div className="min-w-0"><div className="font-semibold truncate">{file.name}</div><div className="text-[9px] text-slate-400">{file.type || 'supporting_document'}</div></div><button type="button" onClick={() => { setPreviewUrl(file.url); setPreviewMime(file.mimeType || (file.url.startsWith('data:application/pdf') ? 'application/pdf' : 'image')); }} className="text-blue-600 font-bold">Preview</button></div>)}</div> : <div className="text-slate-400 italic">No documents uploaded.</div>}</div>
              {selectedAssessmentView.status === 'FOR_COMPLIANCE' && (
                <div className="card border-orange-300 dark:border-orange-900/70"><div className="font-bold text-orange-800 dark:text-orange-300">Additional documents requested</div><div className="mt-2 space-y-2">{(selectedAssessmentView.missingDocuments || []).map((item) => <div key={item.key} className="rounded-xl bg-orange-50 dark:bg-orange-950/30 p-3"><div className="font-semibold">{item.label}</div><input type="file" multiple={item.key === 'branch_permits_and_ors' || item.key === 'line_of_business_sales_breakdown'} accept={formatFileAccept} onChange={(e) => setComplianceFiles((prev) => ({ ...prev, [item.key as DocumentRequirementKey]: e.target.files ? Array.from(e.target.files) : [] }))} className="mt-2 w-full text-[10px]" />{(complianceFiles[item.key as DocumentRequirementKey] || []).length > 0 && <div className="mt-1 text-[10px] text-emerald-700">Files selected.</div>}</div>)}</div><button type="button" disabled={isComplianceSubmitting} onClick={() => void submitComplianceDocuments()} className="mt-3 px-4 py-2 rounded-xl bg-orange-600 text-white font-bold">{isComplianceSubmitting ? 'Submitting...' : 'Submit Additional Documents'}</button></div>
              )}
              <div className="card"><div className="font-bold mb-2">Assessment / Treasury Status</div><div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><div><span className="labelText">Payment Status</span><span className={`inline-block px-2 py-1 rounded-full text-[9px] font-bold ${selectedAssessmentView.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{selectedAssessmentView.paymentStatus}</span></div><div><span className="labelText">Amount Due</span><div className="font-bold">{money(selectedAssessmentView.paymentAmount || selectedAssessmentView.computedFees?.total)}</div></div><div><span className="labelText">O.R. Number</span><div className="font-mono font-bold">{selectedAssessmentView.officialReceiptNumber || '—'}</div></div><div><span className="labelText">Payment Reference</span><div className="font-mono break-all">{selectedAssessmentView.paymentReference || '—'}</div></div></div></div>
              {(selectedAssessmentView.computedFees && Number(selectedAssessmentView.computedFees.total || 0) > 0) && <div className="card"><div className="font-bold mb-2">Approved Fee Breakdown</div>{['lbt','mayorsPermit','sanitaryFee','garbageFee','fireSafetyFee','otherFees'].map((key) => <div key={key} className="flex justify-between py-1 border-b last:border-b-0"><span>{({ lbt: 'Local Business Tax', mayorsPermit: 'Mayor’s Permit Fee', sanitaryFee: 'Sanitary Inspection Fee', garbageFee: 'Garbage Fee', fireSafetyFee: 'Fire Safety / BFP Fee', otherFees: 'Other Regulatory Fees' } as Record<string, string>)[key]}</span><span className="font-mono">{money((selectedAssessmentView.computedFees as any)?.[key])}</span></div>)}<div className="flex justify-between pt-2 font-bold"><span>Total</span><span>{money(selectedAssessmentView.computedFees.total)}</span></div></div>}
              <div className="card"><span className="labelText">Treasurer’s Office Remarks</span><div className="italic mt-1">{selectedAssessmentView.remarks || 'No remarks yet.'}</div>{selectedAssessmentView.complianceRemarks && <div className="mt-2 text-orange-700 dark:text-orange-300">Compliance: {selectedAssessmentView.complianceRemarks}</div>}</div>
            </div>
            <div className="sticky bottom-0 flex justify-end gap-2 px-5 py-4 border-t bg-slate-50 dark:bg-slate-950">{selectedAssessmentView.status === 'APPROVED' && selectedAssessmentView.paymentStatus !== 'PAID' && <button type="button" disabled={isProcessingPayment} onClick={() => openBusinessTaxPayment(selectedAssessmentView)} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold">{isProcessingPayment ? 'Generating QR...' : 'Proceed to Digital Payment →'}</button>}{selectedAssessmentView.paymentStatus === 'PAID' && <span className="px-3 py-2 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-bold">Payment Verified</span>}<button type="button" onClick={() => setSelectedAssessmentView(null)} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold">Close</button></div>
          </div>
        </div>
      )}

      {isPaymentStep && paymentAssessment && (
        <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-5 border border-slate-200 dark:border-slate-800 shadow-2xl text-center">
            <div className="flex justify-between items-center mb-4"><div><h3 className="font-bold text-sm">BUSINESS TAX DIGITAL PAYMENT</h3><p className="text-[10px] text-slate-500">{paymentAssessment.trackingNumber}</p></div><button type="button" onClick={closeBusinessTaxPayment} className="font-bold text-xl">×</button></div>
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 p-3 mb-4"><div className="text-[10px] text-slate-500">Approved Amount Due</div><div className="text-2xl font-extrabold mt-1">{money(paymentAssessment.paymentAmount || paymentAssessment.computedFees?.total)}</div></div>
            {qrError && <div className="p-3 mb-3 rounded-xl bg-rose-50 text-rose-700 text-xs border border-rose-200">{qrError}</div>}
            {isProcessingPayment ? <div className="py-12 text-xs text-slate-500">Generating your QRPh payment code...</div> : qrCodeUrl ? <><img src={qrCodeUrl} alt="QRPh payment code" className="w-64 h-64 mx-auto object-contain border rounded-2xl p-3 bg-white" /><div className="mt-3 font-mono text-xs font-bold">Reference: {qrReferenceNumber || '—'}</div><div className="mt-2 text-xs text-slate-500">QR expires in {Math.floor(qrSecondsRemaining / 60)}:{String(qrSecondsRemaining % 60).padStart(2, '0')}</div><div className="mt-2 text-[10px] text-slate-500">Keep this window open while waiting. Your payment status is verified from the server before the receipt is issued.</div></> : <div className="py-12 text-xs text-slate-500">Preparing payment...</div>}
          </div>
        </div>
      )}

      {isPaymentSuccess && (
        <div className="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 shadow-2xl text-center border border-emerald-200 dark:border-emerald-900">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-3xl font-bold">✓</div>
            <h3 className="mt-4 text-xl font-extrabold text-slate-900 dark:text-white">Payment Successful</h3>
            <p className="mt-1 text-xs text-slate-500">Your Business Tax payment has been verified and recorded in Treasury.</p>
            <div className="mt-5 text-left space-y-2 rounded-2xl bg-slate-50 dark:bg-slate-950 p-4 text-xs"><div className="flex justify-between"><span>Amount Paid</span><span className="font-bold">{money(paymentAmount)}</span></div><div className="flex justify-between gap-4"><span>Reference</span><span className="font-mono font-bold text-right break-all">{paymentReference || qrReferenceNumber || '—'}</span></div><div className="flex justify-between gap-4"><span>O.R. Number</span><span className="font-mono font-bold text-right">{paymentReceiptNumber || '—'}</span></div><div className="flex justify-between"><span>Date</span><span>{(paymentConfirmedAt || new Date()).toLocaleString()}</span></div></div>
            <button type="button" onClick={() => { setIsPaymentSuccess(false); setPaymentAssessment(null); void fetchAssessments(); }} className="mt-5 w-full px-4 py-3 rounded-xl bg-blue-600 text-white text-xs font-bold">Done</button>
          </div>
        </div>
      )}

      {previewUrl && (
        <div className="fixed inset-0 z-[80] bg-black/90 flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
          <div className="w-full max-w-5xl h-[90vh]" onClick={(e) => e.stopPropagation()}><div className="flex justify-end mb-2"><button type="button" onClick={() => setPreviewUrl(null)} className="text-white font-bold text-2xl">×</button></div>{previewMime === 'application/pdf' ? <iframe src={previewUrl} title="Document Preview" className="w-full h-[calc(100%-40px)] bg-white rounded-xl" /> : <div className="w-full h-[calc(100%-40px)] flex items-center justify-center"><img src={previewUrl} alt="Document Preview" className="max-w-full max-h-full object-contain rounded-xl" /></div>}</div>
        </div>
      )}

      {isModalOpen === 'link-application' && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={(e) => { e.preventDefault(); alert('Link in-person application functionality is mocked. The backend endpoint needs to be connected.'); setIsModalOpen(false); }} className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center p-5 border-b bg-slate-50 dark:bg-slate-950">
              <h3 className="font-bold text-sm">LINK IN-PERSON APPLICATION</h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-xl font-bold hover:text-rose-500">×</button>
            </div>
            <div className="p-6">
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                Enter the In-Person Application Tracking Number sent to your registered email address. The QC e-Services account must correspond to the email address used in the application.
              </p>
              <div>
                <label className="label">In-Person Application Tracking Number *</label>
                <input required value={linkAppForm.trackingNumber} onChange={(e) => setLinkAppForm({ trackingNumber: e.target.value })} className="field" placeholder="e.g. BT-2026-..." />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t bg-slate-50 dark:bg-slate-950">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl border font-bold text-sm">Cancel</button>
              <button type="submit" className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-sm transition-colors">Proceed</button>
            </div>
          </form>
        </div>
      )}

      <style>{`.field{width:100%;padding:.65rem .75rem;border:1px solid rgb(203 213 225);border-radius:.75rem;background:transparent}.dark .field{border-color:rgb(71 85 105)}.label{display:block;font-size:10px;font-weight:700;margin-bottom:.35rem;color:rgb(71 85 105)}.labelText{display:block;font-size:9px;font-weight:700;text-transform:uppercase;color:rgb(148 163 184);margin-bottom:.2rem}.card{padding:1rem;border-radius:1rem;background:rgb(248 250 252);border:1px solid rgb(226 232 240)}.dark .card{background:rgba(2,6,23,.35);border-color:rgb(51 65 85)}`}</style>
    </CitizenLayout>
  );
};

export default BusinessTaxAssessmentView;
