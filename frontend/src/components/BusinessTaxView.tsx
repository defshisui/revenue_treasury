import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../config/api';

export interface BusinessTaxAssessmentAdminViewProps { isCollapsed?: boolean; }

type AssessmentStatus =
  | 'PENDING'
  | 'SUBMITTED'
  | 'FOR_INITIAL_ASSESSMENT'
  | 'FOR_FINAL_REVIEW'
  | 'RETURNED_FOR_COMPLIANCE'
  | 'RESUBMITTED'
  | 'FOR_FINAL_APPROVAL'
  | 'TAX_BILL_ISSUED'
  | 'FOR_OWNER_PAYMENT'
  | 'PAID'
  | 'FOR_PAYMENT_VALIDATION'
  | 'OR_ISSUED'
  | 'ARCHIVED'
  // Legacy / back-compat
  | 'FOR_COMPLIANCE'
  | 'APPROVED'
  | 'REJECTED';
type DocumentRequirementKey =
  | 'sales_declaration' | 'mayors_permit' | 'latest_tax_bill' | 'latest_official_receipt'
  | 'bir_tax_return' | 'previous_itr' | 'audited_financial_statements' | 'notarized_gross_sales'
  | 'branch_permits_and_ors' | 'branch_sales_breakdown' | 'line_of_business_sales_breakdown'
  | 'cedula' | 'summary_list_of_sales' | 'incentive_exemption';

interface AttachmentFile { name: string; url: string; type?: string; mimeType?: string; }
interface FeeBreakdown { lbt?: number; mayorsPermit?: number; sanitaryFee?: number; garbageFee?: number; fireSafetyFee?: number; otherFees?: number; total?: number; }
interface MissingDocument { key: string; label: string; }
interface AssessmentRecord {
  id: string; trackingNumber: string; taxBillNumber?: string | null; orderOfPaymentNumber?: string | null;
  businessName: string; businessOwner: string; businessAddress?: string; barangay?: string;
  businessType?: string; lineOfBusiness?: string; businessAreaSqm?: number;
  registrationType?: string; registrationNumber?: string; mayorPermitNumber?: string;
  birRegistered?: boolean; hasOtherBranches?: boolean; hasMultipleLines?: boolean;
  taxYear?: number; paymentTerm?: string; assessmentPeriod?: string; quarter?: string; dueDate?: string | null;
  status: AssessmentStatus; recordStatus?: string; applicationDate: string; psicCode?: string; grossSales?: number; tin?: string; email?: string;
  attachments?: AttachmentFile[]; documentChecklist?: Record<string, boolean>; missingDocuments?: MissingDocument[];
  remarks?: string; complianceRemarks?: string; reviewedBy?: string; reviewedAt?: string | null; approvedBy?: string; approvedAt?: string | null;
  paymentStatus?: 'PAID' | 'UNPAID'; paymentAmount?: number; paidAmount?: number; paymentMethod?: string; paymentReference?: string; paymentDate?: string | null; officialReceiptNumber?: string;
  computedFees?: FeeBreakdown;
}
interface AppointmentRecord { id: string; department: string; appointmentType: string; branch?: string; mayorsPermitNo?: string; businessName?: string; businessAddress?: string; tin?: string; address?: string; description?: string; fullName: string; email: string; phone: string; date: string; timeSlot?: string; remarks?: string; status: string; createdAt: string; }

const BASE_DOCS: Array<{ key: DocumentRequirementKey; label: string }> = [
  { key: 'sales_declaration', label: 'Gross Receipts / Sales Declaration Form' },
  { key: 'mayors_permit', label: 'Latest Mayor’s / Business Permit' },
  { key: 'latest_tax_bill', label: 'Latest Business Tax Bill' },
  { key: 'latest_official_receipt', label: 'Latest Business Tax Official Receipt' },
];
const LABELS: Record<string, string> = {
  sales_declaration: 'Gross Receipts / Sales Declaration Form', mayors_permit: 'Latest Mayor’s / Business Permit', latest_tax_bill: 'Latest Business Tax Bill', latest_official_receipt: 'Latest Business Tax Official Receipt',
  bir_tax_return: 'Preceding Year VAT Return / Percentage Tax Return / ITR', previous_itr: 'Previous-Preceding Year Income Tax Return', audited_financial_statements: 'Previous-Preceding Year Audited Financial Statements',
  notarized_gross_sales: 'Notarized Certification of Gross Sales', branch_permits_and_ors: 'Other Branch Mayor’s Permits and Official Receipts', branch_sales_breakdown: 'Certified Breakdown of Sales for Other Branches',
  line_of_business_sales_breakdown: 'Certified Breakdown of Sales by Line of Business', cedula: 'Current-Year Community Tax Certificate / Cedula', summary_list_of_sales: 'Previous-Year Summary List of Sales Received by BIR', incentive_exemption: 'Certificate of Incentives / Exemption',
};

function money(value: number | undefined): string { return `₱${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function statusClass(status: string): string {
  switch (status) {
    case 'SUBMITTED':                return 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300';
    case 'FOR_INITIAL_ASSESSMENT':   return 'bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300';
    case 'FOR_FINAL_REVIEW':         return 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300';
    case 'RETURNED_FOR_COMPLIANCE':  return 'bg-orange-100 text-orange-800 dark:bg-orange-950/70 dark:text-orange-300';
    case 'FOR_COMPLIANCE':           return 'bg-orange-100 text-orange-800 dark:bg-orange-950/70 dark:text-orange-300';
    case 'RESUBMITTED':              return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/70 dark:text-yellow-300';
    case 'FOR_FINAL_APPROVAL':       return 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950/70 dark:text-fuchsia-300';
    case 'TAX_BILL_ISSUED':          return 'bg-teal-100 text-teal-800 dark:bg-teal-950/70 dark:text-teal-300';
    case 'APPROVED':                 return 'bg-teal-100 text-teal-800 dark:bg-teal-950/70 dark:text-teal-300';
    case 'FOR_OWNER_PAYMENT':        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300';
    case 'PAID':                     return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300';
    case 'FOR_PAYMENT_VALIDATION':   return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/70 dark:text-cyan-300';
    case 'OR_ISSUED':                return 'bg-green-100 text-green-800 dark:bg-green-950/70 dark:text-green-300';
    case 'REJECTED':                 return 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300';
    case 'ARCHIVED':                 return 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    default:                         return 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300';
  }
}

function currentUser() {
  const raw = localStorage.getItem('currentUser') || localStorage.getItem('user') || sessionStorage.getItem('currentUser') || sessionStorage.getItem('user');
  if (!raw) return null;
  try { const parsed = JSON.parse(raw); const target = parsed.user && typeof parsed.user === 'object' ? parsed.user : parsed; return { fullname: String(target.fullname || target.name || target.fullName || target.firstName || target.email || ''), email: String(target.email || ''), token: String(parsed.token || target.token || '') }; } catch { return null; }
}

export const BusinessTaxAssessmentAdminView: React.FC<BusinessTaxAssessmentAdminViewProps> = ({ isCollapsed: _isCollapsed = false }) => {
  const [admin, setAdmin] = useState<{ fullname: string; email: string; token: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'assessments' | 'appointments'>('assessments');
  const [archiveView, setArchiveView] = useState(false);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchType, setSearchType] = useState('Tracking/MP No.');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedAssessment, setSelectedAssessment] = useState<AssessmentRecord | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentRecord | null>(null);
  const [actionRemarks, setActionRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [previewFile, setPreviewFile] = useState<AttachmentFile | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [fees, setFees] = useState<Required<FeeBreakdown>>({ lbt: 0, mayorsPermit: 0, sanitaryFee: 0, garbageFee: 0, fireSafetyFee: 0, otherFees: 0, total: 0 });
  const [alertState, setAlertState] = useState<{ title?: string; message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [confirmState, setConfirmState] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  useEffect(() => { setAdmin(currentUser()); }, []);

  useEffect(() => { 
    if (!admin) return; 
    
    if (activeTab === 'assessments') {
      void fetchAssessments(); 
    } else {
      void fetchAppointments(); 
    }
  }, [admin, activeTab, archiveView, statusFilter, page]);

  useEffect(() => {
    if (!selectedAssessment) return;
    const stored = selectedAssessment.documentChecklist || {};
    setChecklist(stored);
    
    const existing = selectedAssessment.computedFees || {};
    let lbt = Number(existing.lbt || 0);
    let mayorsPermit = Number(existing.mayorsPermit || 0);
    let sanitaryFee = Number(existing.sanitaryFee || 0);
    let garbageFee = Number(existing.garbageFee || 0);
    let fireSafetyFee = Number(existing.fireSafetyFee || 0);
    let otherFees = Number(existing.otherFees || 0);
    let total = Number(existing.total || 0);

    if (total === 0 && selectedAssessment.grossSales) {
      const gross = selectedAssessment.grossSales;
      lbt = Number((gross * 0.01).toFixed(2));
      mayorsPermit = Number((gross * 0.001).toFixed(2));
      sanitaryFee = Number((gross * 0.001).toFixed(2));
      garbageFee = Number((gross * 0.0005).toFixed(2));
      fireSafetyFee = Number((mayorsPermit * 0.10).toFixed(2));
      otherFees = 0;
      total = Number((lbt + mayorsPermit + sanitaryFee + garbageFee + fireSafetyFee).toFixed(2));
    }

    setFees({ lbt, mayorsPermit, sanitaryFee, garbageFee, fireSafetyFee, otherFees, total });
    
    setActionRemarks(selectedAssessment.remarks || '');
    setShowOrderModal(false);
  }, [selectedAssessment?.id]);

  useEffect(() => {
    const total = Number(fees.lbt || 0) + Number(fees.mayorsPermit || 0) + Number(fees.sanitaryFee || 0) + Number(fees.garbageFee || 0) + Number(fees.fireSafetyFee || 0) + Number(fees.otherFees || 0);
    setFees((prev) => (Math.abs(prev.total - total) > 0.005 ? { ...prev, total: Number(total.toFixed(2)) } : prev));
  }, [fees.lbt, fees.mayorsPermit, fees.sanitaryFee, fees.garbageFee, fees.fireSafetyFee, fees.otherFees]);

  const filteredStatuses = useMemo(() => archiveView ? ['ARCHIVED'] : [
    'SUBMITTED', 'FOR_INITIAL_ASSESSMENT', 'FOR_FINAL_REVIEW', 'RETURNED_FOR_COMPLIANCE',
    'RESUBMITTED', 'FOR_FINAL_APPROVAL', 'TAX_BILL_ISSUED', 'FOR_OWNER_PAYMENT',
    'FOR_PAYMENT_VALIDATION', 'OR_ISSUED', 'REJECTED',
  ], [archiveView]);

  async function fetchAssessments() {
    if (!admin) return;
    setLoading(true); setFetchError(null);
    try {
      const qs = new URLSearchParams();
      const effectiveStatus = archiveView ? '' : (statusFilter === 'ALL' ? '' : statusFilter);
      const effectiveRecordStatus = archiveView ? 'ARCHIVED' : 'ACTIVE';
      if (effectiveStatus) qs.set('status', effectiveStatus);
      qs.set('recordStatus', effectiveRecordStatus);
      qs.set('page', String(page)); qs.set('limit', '10');
      if (searchQuery.trim()) qs.set('search', searchQuery.trim());
      qs.set('searchType', searchType);
      const response = await fetch(`${API_BASE_URL}/admin/business-assessments?${qs.toString()}`, { headers: { Authorization: `Bearer ${admin.token}` } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || `Failed to fetch assessments (${response.status}).`);
      setAssessments(Array.isArray(data) ? data : (data.assessments || [])); setTotalPages(Number(data.totalPages || 1));
    } catch (error: any) { setFetchError(error.message || 'Failed to load assessment queue.'); setAssessments([]); } finally { setLoading(false); }
  }

  async function fetchAppointments() {
    if (!admin) return;
    setLoading(true);
    try { const response = await fetch(`${API_BASE_URL}/admin/appointments`, { headers: { Authorization: `Bearer ${admin.token}` } }); const data = await response.json().catch(() => []); setAppointments(Array.isArray(data) ? data : (data.appointments || [])); } catch (error) { console.error(error); setAppointments([]); } finally { setLoading(false); }
  }

  async function handleUpdateAppointmentStatus(id: string, newStatus: string) {
    if (!admin) return;
    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/appointments/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` },
        body: JSON.stringify({ status: newStatus })
      });
      if (!response.ok) throw new Error('Failed to update status');
      
      setSelectedAppointment(null);
      void fetchAppointments();
    } catch (err: any) {
      setAlertState({ message: err.message || 'Failed to update appointment status.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  const requiredKeysFor = (record: AssessmentRecord): string[] => {
    const keys = BASE_DOCS.map((item) => item.key as string);
    if (record.birRegistered) keys.push('bir_tax_return', 'previous_itr', 'audited_financial_statements'); else keys.push('notarized_gross_sales');
    if (record.hasOtherBranches) keys.push('branch_permits_and_ors', 'branch_sales_breakdown');
    if (record.hasMultipleLines) keys.push('line_of_business_sales_breakdown');
    return keys;
  };

  const allRequiredDocumentsVerified = (record: AssessmentRecord) => requiredKeysFor(record).every((key) => checklist[key] === true);

  const updateStatus = async (newStatus: AssessmentStatus) => {
    if (!selectedAssessment || !admin) return;
    if (newStatus === 'TAX_BILL_ISSUED') {
      if (!allRequiredDocumentsVerified(selectedAssessment)) { setAlertState({ message: 'Approval is blocked until every applicable required document is verified.', type: 'error' }); return; }
      if (fees.total <= 0) { setAlertState({ message: 'Enter the final approved amount before approval.', type: 'error' }); return; }
    }
    setSubmitting(true);
    try {
      const payload = { status: newStatus, remarks: actionRemarks, computedFees: fees, documentChecklist: checklist };
      const response = await fetch(`${API_BASE_URL}/admin/business-assessments/${selectedAssessment.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Failed to update assessment status.');
      if (newStatus === 'TAX_BILL_ISSUED') setSelectedAssessment(data.record);
      else setSelectedAssessment(null);
      if (newStatus === 'TAX_BILL_ISSUED') { setAlertState({ title: 'Success', message: 'Assessment approved. Tax Bill and Order of Payment have been issued.', type: 'success' }); setShowOrderModal(true); }
      else if (newStatus === 'RETURNED_FOR_COMPLIANCE') setAlertState({ title: 'Success', message: 'Assessment returned to citizen for additional documents/clarification.', type: 'success' });
      else if (newStatus === 'FOR_INITIAL_ASSESSMENT') setAlertState({ title: 'Success', message: 'Assessment moved to initial assessment queue.', type: 'success' });
      else if (newStatus === 'FOR_FINAL_REVIEW') setAlertState({ title: 'Success', message: 'Assessment moved to final review.', type: 'success' });
      else if (newStatus === 'FOR_FINAL_APPROVAL') setAlertState({ title: 'Success', message: 'Assessment submitted for City Treasurer final approval.', type: 'success' });
      else if (newStatus === 'FOR_OWNER_PAYMENT') setAlertState({ title: 'Success', message: 'Assessment marked as ready for owner payment.', type: 'success' });
      else if (newStatus === 'REJECTED') setAlertState({ title: 'Success', message: 'Assessment rejected.', type: 'success' });
      void fetchAssessments();
    } catch (error: any) { setAlertState({ message: error.message || 'Failed to update assessment.', type: 'error' }); } finally { setSubmitting(false); }
  };

  async function archiveOrRestore(record: AssessmentRecord) {
    if (!admin) return;
    const target = record.recordStatus === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED';
    setConfirmState({
      title: target === 'ARCHIVED' ? 'Archive Record' : 'Restore Record',
      message: target === 'ARCHIVED' ? `Are you sure you want to archive ${record.trackingNumber}?` : `Are you sure you want to restore ${record.trackingNumber}?`,
      onConfirm: async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/admin/business-assessments/${record.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` }, body: JSON.stringify({ recordStatus: target, remarks: target === 'ARCHIVED' ? 'Moved to archiver' : 'Restored from archiver', documentChecklist: record.documentChecklist || {}, computedFees: record.computedFees || {} }) });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.message || 'Archive action failed.');
          setAlertState({ message: target === 'ARCHIVED' ? 'Record archived successfully.' : 'Record restored successfully.', type: 'success' });
          void fetchAssessments();
        } catch (error: any) { setAlertState({ message: error.message || 'Archive action failed.', type: 'error' }); }
      }
    });
  }

  async function deleteAssessment(record: AssessmentRecord) {
    if (!admin) return;
    setConfirmState({
      title: 'Delete Record',
      message: `Are you sure you want to PERMANENTLY delete ${record.trackingNumber}? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/admin/business-assessments/${record.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${admin.token}` } });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.message || 'Delete action failed.');
          setAlertState({ message: 'Record deleted permanently.', type: 'success' });
          void fetchAssessments();
        } catch (error: any) { setAlertState({ message: error.message || 'Delete action failed.', type: 'error' }); }
      }
    });
  }







  return (
    <div
      style={{
        marginLeft: _isCollapsed ? '80px' : '256px',
        width: _isCollapsed ? 'calc(100% - 80px)' : 'calc(100% - 256px)',
      }}
      className="min-h-screen bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 p-6 pt-24 transition-all duration-300 box-border flex flex-col font-sans"
    >
      <div className="w-full font-sans animate-in fade-in duration-300">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 bg-white dark:bg-slate-900/80 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs backdrop-blur-md">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold tracking-wider text-blue-600 dark:text-blue-400 uppercase">
              Municipal Treasury Operations
            </span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Business Tax &amp; Regulatory Hub
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Application Processing, Assessment Review &amp; Compliance Verification
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => void fetchAssessments()}
            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center gap-2 shadow-xs"
          >
            <i className="fa-solid fa-arrows-rotate text-[11px]"></i> Refresh List
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-900/80 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Pending Applications</p>
          <h4 className="text-2xl font-bold text-slate-900 dark:text-white mt-3">{assessments.filter(a => a.status === 'SUBMITTED' || a.status === 'FOR_INITIAL_ASSESSMENT').length}</h4>
        </div>

        <div className="bg-white dark:bg-slate-900/80 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">For Final Approval</p>
          <h4 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-3">{assessments.filter(a => a.status === 'FOR_FINAL_APPROVAL').length}</h4>
        </div>

        <div className="bg-white dark:bg-slate-900/80 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Paid Revenue</p>
          <h4 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-3">
            {money(assessments.filter(a => a.paymentStatus === 'PAID').reduce((acc, a) => acc + Number(a.paidAmount || a.paymentAmount || a.computedFees?.total || 0), 0))}
          </h4>
          <p className="mt-2 text-[11px] text-slate-400">
            {assessments.filter(a => a.paymentStatus === 'PAID').length} verified e-Receipts settled
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900/80 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Unpaid Receivables</p>
          <h4 className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-3">
            {money(assessments.filter(a => a.paymentStatus !== 'PAID' && a.status !== 'ARCHIVED' && (a.paymentAmount || a.computedFees?.total || 0) > 0).reduce((acc, a) => acc + Number(a.paymentAmount || a.computedFees?.total || 0), 0))}
          </h4>
          <p className="mt-2 text-[11px] text-slate-400">
            {assessments.filter(a => a.paymentStatus !== 'PAID' && a.status !== 'ARCHIVED' && (a.paymentAmount || a.computedFees?.total || 0) > 0).length} unpaid bills
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-4 mb-6">
        <button
          onClick={() => setActiveTab('assessments')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'assessments'
            ? 'bg-blue-600 text-white shadow-md'
            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
        >
          <i className="fa-solid fa-file-invoice-dollar text-xs"></i>
          <span>Business Assessments</span>
        </button>

        <button
          onClick={() => setActiveTab('appointments')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'appointments'
            ? 'bg-blue-600 text-white shadow-md'
            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
        >
          <i className="fa-solid fa-calendar-check text-xs"></i>
          <span>Appointments</span>
        </button>
      </div>

    {activeTab === 'assessments' && <section className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex space-x-1 bg-slate-200/60 dark:bg-slate-800/60 p-1.5 rounded-xl w-fit">
              <button
                onClick={() => { setArchiveView(false); setStatusFilter('ALL'); setPage(1); }}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${!archiveView
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
              >
                <i className="fa-solid fa-list-check text-xs"></i>
                <span>Active Queue</span>
              </button>

              <button
                onClick={() => { setArchiveView(true); setPage(1); }}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-2 ${archiveView
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
              >
                <i className="fa-solid fa-box-archive text-xs"></i>
                <span>Archiver</span>
              </button>
            </div>
            
            <div className="flex items-center gap-2 text-xs text-slate-500">
               {/* Optional pagination controls */}
            </div>
          </div>

          <div className="p-4 bg-slate-50/70 dark:bg-slate-950/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-4">
            
            <div className="flex flex-col gap-1.5 text-xs">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Filter Status</label>
              <select disabled={archiveView} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-all text-xs font-semibold">
                <option value="ALL">All Active Statuses</option>
                {filteredStatuses.filter((x) => x !== 'ARCHIVED').map((x) => <option key={x}>{x}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1.5 text-xs">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Search Field</label>
              <select value={searchType} onChange={(e) => setSearchType(e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-all text-xs font-semibold">
                <option>Tracking/MP No.</option><option>Business Name</option><option>Business Owner</option><option>Mayor's Permit No.</option><option>Tax Bill Number</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5 text-xs">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Search Query</label>
              <div className="relative">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void fetchAssessments()} placeholder="Enter keywords..." className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-all text-xs" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 text-xs justify-end">
              <button type="button" onClick={() => { setPage(1); void fetchAssessments(); }} className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-sm hover:bg-blue-700 transition flex items-center justify-center">
                <i className="fa-solid fa-magnifying-glass mr-2"></i>Search
              </button>
            </div>
            
          </div>
      {fetchError && <div className="p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs">{fetchError}</div>}
      <div className="overflow-x-auto bg-white dark:bg-slate-900 border rounded-2xl"><table className="w-full min-w-[1100px] text-xs"><thead className="bg-slate-50 dark:bg-slate-950 text-[10px] uppercase text-slate-500"><tr><th className="p-3 text-left">Tracking</th><th className="p-3 text-left">Business / Owner</th><th className="p-3 text-left">Permit</th><th className="p-3 text-left">Gross Sales</th><th className="p-3 text-left">Status</th><th className="p-3 text-left">Payment</th><th className="p-3 text-right">Action</th></tr></thead><tbody className="divide-y">{loading ? <tr><td colSpan={7} className="p-12 text-center text-slate-400">Loading...</td></tr> : assessments.length ? assessments.map((record) => <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-950/50"><td className="p-3 font-mono font-bold text-blue-600">{record.trackingNumber}</td><td className="p-3"><div className="font-bold">{record.businessName}</div><div className="text-[10px] text-slate-400">{record.businessOwner}</div></td><td className="p-3 font-mono">{record.mayorPermitNumber || '-'}</td><td className="p-3 font-mono">{money(record.grossSales)}</td><td className="p-3"><span className={`px-2 py-1 rounded-full text-[9px] font-bold ${statusClass(record.status)}`}>{record.status}</span></td><td className="p-3"><span className={`px-2 py-1 rounded-full text-[9px] font-bold ${record.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{record.paymentStatus || 'UNPAID'}</span></td><td className="p-3 text-right"><button type="button" onClick={() => setSelectedAssessment(record)} className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-bold mr-1">Review</button><button type="button" onClick={() => void archiveOrRestore(record)} className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold">{record.recordStatus === 'ARCHIVED' ? 'Restore' : 'Archive'}</button>{record.recordStatus === 'ARCHIVED' && <button type="button" onClick={() => void deleteAssessment(record)} className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 font-bold ml-1">Delete</button>}</td></tr>) : <tr><td colSpan={7} className="p-12 text-center text-slate-400">No records found.</td></tr>}</tbody></table></div>
      <div className="flex justify-between items-center text-xs text-slate-500"><span>Page {page} of {totalPages}</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1.5 border rounded-lg disabled:opacity-40">Previous</button><button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="px-3 py-1.5 border rounded-lg disabled:opacity-40">Next</button></div></div>
    </section>}

    {activeTab === 'appointments' && (
      <section className="bg-white dark:bg-slate-900/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs">
        <div className="overflow-x-auto border rounded-2xl">
          <table className="w-full min-w-[850px] text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950">
              <tr>
                <th className="p-3 text-left">Date / Time</th>
                <th className="p-3 text-left">Citizen Name</th>
                <th className="p-3 text-left">Office / Branch</th>
                <th className="p-3 text-left">Transaction Type</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {appointments.map((a) => (
                <tr key={a.id}>
                  <td className="p-3">
                    <div className="font-semibold">{new Date(a.date).toLocaleDateString()}</div>
                    <div className="text-slate-500">{a.timeSlot}</div>
                  </td>
                  <td className="p-3 font-medium">{a.fullName}</td>
                  <td className="p-3 text-slate-600">
                    <div>{a.department}</div>
                    <div className="text-[10px] text-slate-500 font-bold">{a.branch || 'Main Office'}</div>
                  </td>
                  <td className="p-3">{a.appointmentType}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-full font-bold text-[9px] ${a.status === 'PENDING' ? 'bg-amber-100 text-amber-800' : a.status === 'APPROVED' ? 'bg-blue-100 text-blue-800' : a.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : a.status === 'CANCELLED' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-800'}`}>{a.status}</span>
                  </td>
                  <td className="p-3 text-right">
                    <button type="button" onClick={() => setSelectedAppointment(a)} className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold transition-colors">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {appointments.length === 0 && <div className="p-8 text-center text-slate-500 text-sm italic">No appointments found.</div>}
        </div>
      </section>
    )}

    {selectedAppointment && (
      <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800">
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <h3 className="font-bold text-lg">Appointment Details</h3>
            <button onClick={() => setSelectedAppointment(null)} className="font-bold text-slate-400 hover:text-slate-600 text-xl">×</button>
          </div>
          
          <div className="space-y-4 text-sm bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="flex justify-between border-b pb-2"><span className="text-slate-500 font-semibold">Status</span><span className={`px-2 py-0.5 rounded font-bold text-[10px] ${selectedAppointment.status === 'PENDING' ? 'bg-amber-100 text-amber-800' : selectedAppointment.status === 'APPROVED' ? 'bg-blue-100 text-blue-800' : selectedAppointment.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : selectedAppointment.status === 'CANCELLED' ? 'bg-rose-100 text-rose-800' : 'bg-slate-200'}`}>{selectedAppointment.status}</span></div>
            <div className="flex justify-between border-b pb-2"><span className="text-slate-500 font-semibold">Date & Time</span><span className="font-semibold text-right">{selectedAppointment.date} {selectedAppointment.timeSlot ? `at ${selectedAppointment.timeSlot}` : ''}</span></div>
            <div className="flex justify-between border-b pb-2"><span className="text-slate-500 font-semibold">Citizen Name</span><span className="font-semibold text-right">{selectedAppointment.fullName}</span></div>
            <div className="flex justify-between border-b pb-2"><span className="text-slate-500 font-semibold">Email / Phone</span><span className="text-right">{selectedAppointment.email}<br/><span className="text-xs text-slate-500">{selectedAppointment.phone}</span></span></div>
            <div className="flex justify-between border-b pb-2"><span className="text-slate-500 font-semibold">Office / Branch</span><span className="text-right">{selectedAppointment.department}<br/><span className="text-xs text-slate-500 font-bold">{selectedAppointment.branch || 'Main Office'}</span></span></div>
            <div className="flex justify-between border-b pb-2"><span className="text-slate-500 font-semibold">Transaction Type</span><span className="text-right font-medium text-blue-700 dark:text-blue-400">{selectedAppointment.appointmentType}</span></div>
            {selectedAppointment.mayorsPermitNo && <div className="flex justify-between border-b pb-2"><span className="text-slate-500 font-semibold">Mayor's Permit No</span><span className="text-right">{selectedAppointment.mayorsPermitNo}</span></div>}
            {selectedAppointment.businessName && <div className="flex justify-between border-b pb-2"><span className="text-slate-500 font-semibold">Business Name</span><span className="text-right">{selectedAppointment.businessName}</span></div>}
            {selectedAppointment.businessAddress && <div className="flex justify-between border-b pb-2"><span className="text-slate-500 font-semibold">Business Address</span><span className="text-right text-xs max-w-[200px]">{selectedAppointment.businessAddress}</span></div>}
          </div>

          <div className="mt-6 flex flex-col gap-2">
            {selectedAppointment.status === 'PENDING' && (
              <div className="flex gap-2">
                <button type="button" disabled={submitting} onClick={() => handleUpdateAppointmentStatus(selectedAppointment.id, 'APPROVED')} className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors">Approve Appointment</button>
                <button type="button" disabled={submitting} onClick={() => handleUpdateAppointmentStatus(selectedAppointment.id, 'CANCELLED')} className="flex-1 py-3 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-bold transition-colors">Decline / Cancel</button>
              </div>
            )}
            {selectedAppointment.status === 'APPROVED' && (
              <div className="flex gap-2">
                <button type="button" disabled={submitting} onClick={() => handleUpdateAppointmentStatus(selectedAppointment.id, 'COMPLETED')} className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors">Mark Completed</button>
                <button type="button" disabled={submitting} onClick={() => handleUpdateAppointmentStatus(selectedAppointment.id, 'NO_SHOW')} className="flex-1 py-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors">Mark No-Show</button>
                <button type="button" disabled={submitting} onClick={() => handleUpdateAppointmentStatus(selectedAppointment.id, 'CANCELLED')} className="flex-1 py-3 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-bold transition-colors">Cancel</button>
              </div>
            )}
            <button type="button" onClick={() => setSelectedAppointment(null)} className="w-full py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors">Close Window</button>
          </div>
        </div>
      </div>
    )}

    {selectedAssessment && (() => {
      const isArchived = selectedAssessment.recordStatus === 'ARCHIVED';
      const s = selectedAssessment.status;
      const isSubmittedOrResubmitted = s === 'SUBMITTED' || s === 'RESUBMITTED';
      const isForInitial = s === 'FOR_INITIAL_ASSESSMENT';
      const isForReview = s === 'FOR_FINAL_REVIEW';
      const isReturned = s === 'RETURNED_FOR_COMPLIANCE';
      const isForApproval = s === 'FOR_FINAL_APPROVAL';
      const isTaxBill = s === 'TAX_BILL_ISSUED';
      const isForPayment = s === 'FOR_OWNER_PAYMENT';
      const isForValidation = s === 'FOR_PAYMENT_VALIDATION';
      const isPaid = s === 'PAID' || s === 'OR_ISSUED';

      const showBusinessInfo = true;
      const showAssessmentPanel = !isArchived && (isForInitial || isForReview || isForApproval || isTaxBill);
      const editableAssessmentPanel = isForInitial || isForReview;
      const showUploadedDocs = !isArchived && (isSubmittedOrResubmitted || isForInitial || isForReview || isForApproval || isReturned);
      const showRemarks = !isArchived && !isForPayment && !isPaid && !isForValidation && !isTaxBill;
      const editableRemarks = isSubmittedOrResubmitted || isForInitial || isForReview || isForApproval;
      const showPaymentMonitoring = isForPayment || isForValidation || isPaid || isArchived;

      return (
        <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-5xl max-h-[95vh] overflow-y-auto shadow-2xl border">
            
            <div className="sticky top-0 z-10 flex justify-between items-center px-5 py-4 border-b bg-slate-50 dark:bg-slate-950">
              <div>
                <h3 className="font-bold text-sm uppercase">
                  {isForInitial ? 'Initial Assessment (ADMIN)'
                   : isSubmittedOrResubmitted ? (s === 'RESUBMITTED' ? 'Resubmitted Application (ADMIN)' : 'Submitted Application (ADMIN)')
                   : isReturned ? 'Returned for Compliance (ADMIN)' 
                   : isForReview ? 'Final Review (ADMIN)' 
                   : isForApproval ? 'Final Approval (ADMIN)' 
                   : isTaxBill ? 'Tax Bill Issued (ADMIN)'
                   : isForPayment ? 'Owner Payment (ADMIN)'
                   : isForValidation ? 'Payment Validation (ADMIN)'
                   : isPaid ? 'Official Receipt (ADMIN)'
                   : 'Business Tax Assessment Review'}
                </h3>
                <p className="font-mono text-[10px] text-blue-600">{selectedAssessment.trackingNumber}</p>
              </div>
              <button onClick={() => setSelectedAssessment(null)} className="text-xl font-bold">×</button>
            </div>
            
            <div className="p-5 space-y-5 text-xs">
              {showBusinessInfo && (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="box"><span>Business</span><b>{selectedAssessment.businessName}</b></div>
                    <div className="box"><span>Owner</span><b>{selectedAssessment.businessOwner}</b></div>
                    <div className="box"><span>Mayor’s Permit</span><b>{selectedAssessment.mayorPermitNumber || '—'}</b></div>
                    <div className="box"><span>Status</span><span className={`self-start px-2 py-1 rounded-full text-[9px] font-bold ${statusClass(selectedAssessment.status)}`}>{selectedAssessment.status}</span></div>
                  </div>
                  
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <div className="box"><span>Payment Term</span><b className="text-blue-600">{selectedAssessment.paymentTerm === 'ANNUAL' ? 'Annual' : selectedAssessment.paymentTerm === 'SEMI_ANNUAL' ? 'Semi-Annual' : selectedAssessment.paymentTerm === 'QUARTERLY' ? 'Quarterly' : (selectedAssessment.paymentTerm || 'Annual')}</b></div>
                    <div className="box"><span>Gross Sales</span><b>{money(selectedAssessment.grossSales)}</b></div>
                    <div className="box"><span>Business Type</span><b>{selectedAssessment.businessType || '—'}</b></div>
                    <div className="box"><span>Line of Business</span><b>{selectedAssessment.lineOfBusiness || '—'}</b></div>
                    <div className="box"><span>Area</span><b>{Number(selectedAssessment.businessAreaSqm || 0).toLocaleString()} sqm</b></div>
                  </div>
                  <div className="box">
                    <span>Address</span><b>{selectedAssessment.businessAddress || '—'}, {selectedAssessment.barangay || '—'}</b>
                    <span>Registration: {selectedAssessment.registrationType || '—'} {selectedAssessment.registrationNumber || ''} • TIN: {selectedAssessment.tin || '—'}</span>
                    <span>BIR Registered: {selectedAssessment.birRegistered ? 'Yes' : 'No'} • Other Branches: {selectedAssessment.hasOtherBranches ? 'Yes' : 'No'} • Multiple Lines: {selectedAssessment.hasMultipleLines ? 'Yes' : 'No'}</span>
                  </div>
                </>
              )}

              {showUploadedDocs && (
                <div>
                  <div className="font-bold mb-2">Documents & Verification</div>
                  <div className="space-y-2">
                    {(() => {
                      const required = requiredKeysFor(selectedAssessment);
                      const allAttachments = selectedAssessment.attachments || [];
                      
                      const requiredNodes = required.map((key) => {
                        const matchedFiles = allAttachments.filter((a) => a.type === key);
                        const filenames = matchedFiles.map((a) => a.name).join(', ') || 'No uploaded document mapped to this requirement.';
                        return (
                          <div key={`req-${key}`} className="flex items-center justify-between p-3 rounded-xl border bg-white dark:bg-slate-950">
                            <label className={`flex items-start gap-3 flex-1 ${isForInitial ? 'cursor-pointer' : 'cursor-default'}`}>
                              <input 
                                type="checkbox" 
                                checked={Boolean(checklist[key])} 
                                onChange={(e) => isForInitial && setChecklist((prev) => ({ ...prev, [key]: e.target.checked }))} 
                                disabled={!isForInitial}
                                className="mt-1" 
                              />
                              <div className="flex-1">
                                <span className="font-semibold block leading-tight">{LABELS[key] || key}</span>
                                <span className="block text-[10px] text-slate-400 mt-0.5">{filenames}</span>
                              </div>
                            </label>
                            {matchedFiles.length > 0 && (
                              <button type="button" onClick={() => setPreviewFile(matchedFiles[0])} className="text-blue-600 font-bold text-xs ml-4">Preview</button>
                            )}
                          </div>
                        );
                      });

                      const extraFiles = allAttachments.filter(a => !required.includes(a.type as string));
                      const extraNodes = extraFiles.map((file, index) => (
                        <div key={`extra-${file.name}-${index}`} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border">
                          <div className="flex items-start gap-3 flex-1 ml-[28px] opacity-75">
                            <div>
                              <div className="font-semibold leading-tight">{file.name}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">Additional Document: {LABELS[file.type || ''] || file.type || 'supporting_document'}</div>
                            </div>
                          </div>
                          <button type="button" onClick={() => setPreviewFile(file)} className="text-blue-600 font-bold text-xs ml-4">Preview</button>
                        </div>
                      ));

                      return (
                        <>
                          {requiredNodes}
                          {extraNodes.length > 0 && (
                            <>
                              <div className="text-xs font-bold text-slate-500 mt-4 mb-2 uppercase tracking-wider">Other Uploaded Files</div>
                              {extraNodes}
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {showAssessmentPanel && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-bold">Assessment Amount</div>
                    {editableAssessmentPanel && (
                      <div className="text-[10px] text-slate-500">Auto-computed based on Declared Gross Sales.</div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {([['lbt','Local Business Tax'],['mayorsPermit','Mayor’s Permit Fee'],['sanitaryFee','Sanitary Inspection Fee'],['garbageFee','Garbage Fee'],['fireSafetyFee','Fire Safety / BFP Fee'],['otherFees','Other Regulatory Fees']] as Array<[keyof Required<FeeBreakdown>, string]>).map(([key, label]) => (
                      <label key={key} className="p-3 rounded-xl border">
                        <span className="block text-[10px] font-bold text-slate-500 mb-1">{label}</span>
                        <input type="number" min="0" step="0.01" value={fees[key]} disabled={true} className="w-full p-2 rounded-lg border bg-transparent disabled:opacity-100 font-bold" />
                      </label>
                    ))}
                  </div>
                  
                  <div className="mt-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 flex justify-between font-extrabold">
                    <span>Total Assessment</span><span>{money(fees.total)}</span>
                  </div>
                </div>
              )}

              {showRemarks && (
                <div>
                  <label className="block font-bold mb-2">Treasurer’s Office Remarks</label>
                  <textarea value={actionRemarks} onChange={(e) => setActionRemarks(e.target.value)} rows={4} disabled={!editableRemarks} className="w-full p-3 rounded-xl border bg-transparent disabled:opacity-50" placeholder="Explain returned documents, assessment findings, approval notes, etc." />
                </div>
              )}

              {showPaymentMonitoring && (
                <div className="box">
                  <span>Current Payment</span>
                  <b>{selectedAssessment.paymentStatus || 'UNPAID'} • {money(selectedAssessment.paidAmount || selectedAssessment.paymentAmount || selectedAssessment.computedFees?.total)}</b>
                  {selectedAssessment.officialReceiptNumber && <span>O.R.: {selectedAssessment.officialReceiptNumber}</span>}
                </div>
              )}

            </div>
            
            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-t bg-slate-50 dark:bg-slate-950">
              <div className="flex gap-2">
                
                {s === 'SUBMITTED' && (
                  <button type="button" disabled={submitting} onClick={() => void updateStatus('FOR_INITIAL_ASSESSMENT')} className="px-3 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold">Proceed to Initial Assessment</button>
                )}

                {s === 'RESUBMITTED' && (
                  <>
                    <button type="button" disabled={submitting} onClick={() => void updateStatus('RETURNED_FOR_COMPLIANCE')} className="px-3 py-2 rounded-xl bg-orange-600 text-white text-xs font-bold">Return for Compliance</button>
                    <button type="button" disabled={submitting} onClick={() => void updateStatus('FOR_INITIAL_ASSESSMENT')} className="px-3 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold">Proceed to Initial Assessment</button>
                  </>
                )}

                {isForInitial && (
                  <button type="button" disabled={submitting} onClick={() => void updateStatus('RETURNED_FOR_COMPLIANCE')} className="px-3 py-2 rounded-xl bg-orange-600 text-white text-xs font-bold">Return for Compliance</button>
                )}

                {isForReview && (
                  <button type="button" disabled={submitting} onClick={() => void updateStatus('RETURNED_FOR_COMPLIANCE')} className="px-3 py-2 rounded-xl bg-orange-600 text-white text-xs font-bold">Return for Compliance</button>
                )}

              </div>
              
              <div className="flex gap-2">
                {isForInitial && (
                  <button type="button" disabled={submitting} onClick={() => void updateStatus('FOR_FINAL_REVIEW')} className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold">Complete Initial Assessment</button>
                )}
                
                {isForReview && (
                  <button type="button" disabled={submitting} onClick={() => void updateStatus('FOR_FINAL_APPROVAL')} className="px-3 py-2 rounded-xl bg-fuchsia-600 text-white text-xs font-bold">Submit for Final Approval</button>
                )}

                {isForApproval && (
                  <button type="button" disabled={submitting} onClick={() => void updateStatus('TAX_BILL_ISSUED')} className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold">Approve & Issue Tax Bill</button>
                )}

                {isTaxBill && (
                  <button type="button" disabled={submitting} onClick={() => void updateStatus('FOR_OWNER_PAYMENT')} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold">Issue for Payment</button>
                )}

                {isForValidation && (
                  <button type="button" disabled={submitting} onClick={() => void updateStatus('OR_ISSUED')} className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold">Verify Payment & Issue O.R.</button>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    })()}

    {showOrderModal && selectedAssessment && selectedAssessment.status === 'TAX_BILL_ISSUED' && <div className="fixed inset-0 z-[60] bg-slate-950/70 flex items-center justify-center p-4"><div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg p-6 border shadow-2xl"><h3 className="font-bold text-sm uppercase">Approved Business Tax Bill / Order of Payment</h3><div className="mt-4 space-y-2 text-xs"><div className="flex justify-between"><span>Tracking Number</span><b className="font-mono">{selectedAssessment.trackingNumber}</b></div><div className="flex justify-between"><span>Tax Bill Number</span><b className="font-mono text-blue-600">{selectedAssessment.taxBillNumber || '—'}</b></div><div className="flex justify-between"><span>Order of Payment</span><b className="font-mono">{selectedAssessment.orderOfPaymentNumber || '—'}</b></div><div className="flex justify-between"><span>Amount Due</span><b>{money(selectedAssessment.paymentAmount || selectedAssessment.computedFees?.total)}</b></div><div className="flex justify-between"><span>Due Date</span><b>{selectedAssessment.dueDate ? new Date(selectedAssessment.dueDate).toLocaleDateString() : '—'}</b></div></div><div className="mt-5 flex gap-2"><button type="button" onClick={() => setShowOrderModal(false)} className="flex-1 px-4 py-2 rounded-xl border text-xs font-bold">Close</button><button type="button" onClick={() => window.print()} className="flex-1 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold">Print</button></div></div></div>}

    {previewFile && <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4" onClick={() => setPreviewFile(null)}><div className="w-full max-w-5xl h-[90vh]" onClick={(e) => e.stopPropagation()}><div className="flex justify-end mb-2"><button type="button" onClick={() => setPreviewFile(null)} className="text-white text-2xl font-bold">×</button></div>{previewFile.mimeType === 'application/pdf' || previewFile.url.startsWith('data:application/pdf') ? <iframe src={previewFile.url} title="Document Preview" className="w-full h-[calc(100%-40px)] bg-white rounded-xl" /> : <div className="w-full h-[calc(100%-40px)] flex items-center justify-center"><img src={previewFile.url} alt="Document Preview" className="max-w-full max-h-full object-contain rounded-xl" /></div>}</div></div>}

    {alertState && (
      <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center relative overflow-hidden transform scale-100 transition-all">
          <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-sm ${alertState.type === 'error' ? 'bg-rose-50 dark:bg-rose-950/50 border border-rose-100 dark:border-rose-900 text-rose-600' : alertState.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900 text-emerald-600' : 'bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900 text-blue-600'}`}>
            {alertState.type === 'error' ? (
              <i className="fa-solid fa-triangle-exclamation text-2xl"></i>
            ) : alertState.type === 'success' ? (
              <i className="fa-solid fa-circle-check text-2xl"></i>
            ) : (
              <i className="fa-solid fa-circle-info text-2xl"></i>
            )}
          </div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
            {alertState.title || (alertState.type === 'error' ? 'Error' : alertState.type === 'success' ? 'Success' : 'Notice')}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
            {alertState.message}
          </p>
          <button
            onClick={() => setAlertState(null)}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            Okay
          </button>
        </div>
      </div>
    )}

    {confirmState && (
      <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center relative overflow-hidden transform scale-100 transition-all">
          <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-sm bg-amber-50 dark:bg-amber-950/50 border border-amber-100 dark:border-amber-900 text-amber-600">
            <i className="fa-solid fa-circle-question text-2xl"></i>
          </div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
            {confirmState.title}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
            {confirmState.message}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setConfirmState(null)}
              className="w-full py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                confirmState.onConfirm();
                setConfirmState(null);
              }}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    )}

    <style>{`.box{display:flex;flex-direction:column;gap:.25rem;padding:1rem;border:1px solid rgb(226 232 240);border-radius:1rem;background:rgb(248 250 252)}.dark .box{border-color:rgb(51 65 85);background:rgba(2,6,23,.35)}.box>span:first-child{font-size:9px;font-weight:700;text-transform:uppercase;color:rgb(148 163 184)}.box>b{font-weight:700}`}</style>
  </div>
  </div>
  );
};

export default BusinessTaxAssessmentAdminView;
