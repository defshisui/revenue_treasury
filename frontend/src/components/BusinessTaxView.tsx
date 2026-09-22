import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../config/api';

export interface BusinessTaxAssessmentAdminViewProps { isCollapsed?: boolean; }

type AssessmentStatus = 'PENDING' | 'SUBMITTED' | 'FOR_COMPLIANCE' | 'FOR_FINAL_REVIEW' | 'FOR_FINAL_APPROVAL' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
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
  taxYear?: number; assessmentPeriod?: string; quarter?: string; dueDate?: string | null;
  status: AssessmentStatus; applicationDate: string; psicCode?: string; grossSales?: number; tin?: string; email?: string;
  attachments?: AttachmentFile[]; documentChecklist?: Record<string, boolean>; missingDocuments?: MissingDocument[];
  remarks?: string; complianceRemarks?: string; reviewedBy?: string; reviewedAt?: string | null; approvedBy?: string; approvedAt?: string | null;
  paymentStatus?: 'PAID' | 'UNPAID'; paymentAmount?: number; paidAmount?: number; paymentMethod?: string; paymentReference?: string; paymentDate?: string | null; officialReceiptNumber?: string;
  computedFees?: FeeBreakdown;
}
interface AppointmentRecord { id: string; department: string; appointmentType: string; businessName?: string; tin?: string; address?: string; description?: string; fullName: string; email: string; phone: string; date: string; timeSlot?: string; remarks?: string; status: string; createdAt: string; }

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
  switch (status) { case 'APPROVED': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'; case 'REJECTED': return 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'; case 'FOR_COMPLIANCE': return 'bg-orange-100 text-orange-800 dark:bg-orange-950/70 dark:text-orange-300'; case 'FOR_FINAL_REVIEW': return 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300'; case 'FOR_FINAL_APPROVAL': return 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950/70 dark:text-fuchsia-300'; case 'ARCHIVED': return 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'; default: return 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'; }
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

  useEffect(() => { setAdmin(currentUser()); }, []);

  useEffect(() => { if (!admin) return; if (activeTab === 'assessments') void fetchAssessments(); else void fetchAppointments(); }, [admin, activeTab, archiveView, statusFilter, page]);

  useEffect(() => {
    if (!selectedAssessment) return;
    const stored = selectedAssessment.documentChecklist || {};
    setChecklist(stored);
    const existing = selectedAssessment.computedFees || {};
    setFees({ lbt: Number(existing.lbt || 0), mayorsPermit: Number(existing.mayorsPermit || 0), sanitaryFee: Number(existing.sanitaryFee || 0), garbageFee: Number(existing.garbageFee || 0), fireSafetyFee: Number(existing.fireSafetyFee || 0), otherFees: Number(existing.otherFees || 0), total: Number(existing.total || 0) });
    setActionRemarks(selectedAssessment.remarks || '');
    setShowOrderModal(false);
  }, [selectedAssessment?.id]);

  useEffect(() => {
    const total = Number(fees.lbt || 0) + Number(fees.mayorsPermit || 0) + Number(fees.sanitaryFee || 0) + Number(fees.garbageFee || 0) + Number(fees.fireSafetyFee || 0) + Number(fees.otherFees || 0);
    setFees((prev) => (Math.abs(prev.total - total) > 0.005 ? { ...prev, total: Number(total.toFixed(2)) } : prev));
  }, [fees.lbt, fees.mayorsPermit, fees.sanitaryFee, fees.garbageFee, fees.fireSafetyFee, fees.otherFees]);

  const filteredStatuses = useMemo(() => archiveView ? ['ARCHIVED'] : ['SUBMITTED', 'FOR_COMPLIANCE', 'FOR_FINAL_REVIEW', 'FOR_FINAL_APPROVAL', 'APPROVED', 'REJECTED'], [archiveView]);

  async function fetchAssessments() {
    if (!admin) return;
    setLoading(true); setFetchError(null);
    try {
      const qs = new URLSearchParams();
      const effectiveStatus = archiveView ? 'ARCHIVED' : (statusFilter === 'ALL' ? '' : statusFilter);
      if (effectiveStatus) qs.set('status', effectiveStatus);
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
    if (newStatus === 'APPROVED') {
      if (!allRequiredDocumentsVerified(selectedAssessment)) { alert('Approval is blocked until every applicable required document is verified.'); return; }
      if (fees.total <= 0) { alert('Enter the final approved amount before approval.'); return; }
    }
    setSubmitting(true);
    try {
      const payload = { status: newStatus, remarks: actionRemarks, computedFees: fees, documentChecklist: checklist };
      const response = await fetch(`${API_BASE_URL}/admin/business-assessments/${selectedAssessment.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Failed to update assessment status.');
      if (newStatus === 'APPROVED') setSelectedAssessment(data.record);
      else setSelectedAssessment(null);
      if (newStatus === 'APPROVED') { alert('Assessment approved. Tax Bill and Order of Payment have been issued.'); setShowOrderModal(true); }
      else if (newStatus === 'FOR_COMPLIANCE') alert('Assessment returned to citizen for additional documents/clarification.');
      else if (newStatus === 'FOR_FINAL_REVIEW') alert('Assessment moved to final review.');
      else if (newStatus === 'FOR_FINAL_APPROVAL') alert('Assessment submitted for City Treasurer final approval.');
      else if (newStatus === 'REJECTED') alert('Assessment rejected.');
      void fetchAssessments();
    } catch (error: any) { alert(error.message || 'Failed to update assessment.'); } finally { setSubmitting(false); }
  };

  async function archiveOrRestore(record: AssessmentRecord) {
    if (!admin) return;
    const target = record.status === 'ARCHIVED' ? 'SUBMITTED' : 'ARCHIVED';
    if (!window.confirm(target === 'ARCHIVED' ? `Archive ${record.trackingNumber}?` : `Restore ${record.trackingNumber}?`)) return;
    try {
      const response = await fetch(`${API_BASE_URL}/admin/business-assessments/${record.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` }, body: JSON.stringify({ status: target, remarks: target === 'ARCHIVED' ? 'Moved to archiver' : 'Restored from archiver', documentChecklist: record.documentChecklist || {}, computedFees: record.computedFees || {} }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Archive action failed.');
      void fetchAssessments();
    } catch (error: any) { alert(error.message || 'Archive action failed.'); }
  }

  async function deleteAssessment(record: AssessmentRecord) {
    if (!admin || !window.confirm(`Permanently delete ${record.trackingNumber}?`)) return;
    const response = await fetch(`${API_BASE_URL}/admin/business-assessments/${record.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${admin.token}` } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return alert(data.message || 'Failed to delete record.');
    setSelectedAssessment(null); void fetchAssessments();
  }

  const setFee = (key: keyof Required<FeeBreakdown>, value: string) => setFees((prev) => ({ ...prev, [key]: Number(value) || 0 }));

  const renderDocChecklist = () => {
    if (!selectedAssessment) return null;
    const required = requiredKeysFor(selectedAssessment);
    return <div className="space-y-2">{required.map((key) => <label key={key} className="flex items-start gap-3 p-3 rounded-xl border bg-slate-50 dark:bg-slate-950 cursor-pointer"><input type="checkbox" checked={Boolean(checklist[key])} onChange={(e) => setChecklist((prev) => ({ ...prev, [key]: e.target.checked }))} className="mt-1" /><span><span className="font-semibold">{LABELS[key] || key}</span><span className="block text-[9px] text-slate-400 mt-0.5">{(selectedAssessment.attachments || []).filter((a) => a.type === key).map((a) => a.name).join(', ') || 'No uploaded document mapped to this requirement.'}</span></span></label>)}</div>;
  };

  return <div className="w-full space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3"><div><h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Business Tax Assessment Management</h2><p className="text-[11px] text-slate-500">Initial assessment → compliance → final review → approval → Tax Bill → payment → O.R.</p></div><div className="flex gap-2"><button type="button" onClick={() => setActiveTab('assessments')} className={`px-3 py-2 rounded-lg text-xs font-bold ${activeTab === 'assessments' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>Assessments</button><button type="button" onClick={() => setActiveTab('appointments')} className={`px-3 py-2 rounded-lg text-xs font-bold ${activeTab === 'appointments' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>Appointments</button></div></div>

    {activeTab === 'assessments' && <>
      <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => { setArchiveView(false); setStatusFilter('ALL'); setPage(1); }} className={`px-3 py-2 rounded-lg text-xs font-bold ${!archiveView ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>Active Queue</button><button type="button" onClick={() => { setArchiveView(true); setPage(1); }} className={`px-3 py-2 rounded-lg text-xs font-bold ${archiveView ? 'bg-slate-700 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>Archiver</button><select disabled={archiveView} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="px-3 py-2 rounded-lg border text-xs"><option value="ALL">All Active Statuses</option>{filteredStatuses.filter((x) => x !== 'ARCHIVED').map((x) => <option key={x}>{x}</option>)}</select><select value={searchType} onChange={(e) => setSearchType(e.target.value)} className="px-3 py-2 rounded-lg border text-xs"><option>Tracking/MP No.</option><option>Business Name</option><option>Business Owner</option><option>Mayor's Permit No.</option><option>Tax Bill Number</option></select><input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void fetchAssessments()} placeholder="Search assessment queue..." className="flex-1 min-w-[220px] px-3 py-2 rounded-lg border text-xs" /><button type="button" onClick={() => { setPage(1); void fetchAssessments(); }} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold">Search</button></div>
      {fetchError && <div className="p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs">{fetchError}</div>}
      <div className="overflow-x-auto bg-white dark:bg-slate-900 border rounded-2xl"><table className="w-full min-w-[1100px] text-xs"><thead className="bg-slate-50 dark:bg-slate-950 text-[10px] uppercase text-slate-500"><tr><th className="p-3 text-left">Tracking</th><th className="p-3 text-left">Business / Owner</th><th className="p-3 text-left">Permit</th><th className="p-3 text-left">Gross Sales</th><th className="p-3 text-left">Status</th><th className="p-3 text-left">Payment</th><th className="p-3 text-right">Action</th></tr></thead><tbody className="divide-y">{loading ? <tr><td colSpan={7} className="p-12 text-center text-slate-400">Loading...</td></tr> : assessments.length ? assessments.map((record) => <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-950/50"><td className="p-3 font-mono font-bold text-blue-600">{record.trackingNumber}</td><td className="p-3"><div className="font-bold">{record.businessName}</div><div className="text-[10px] text-slate-400">{record.businessOwner}</div></td><td className="p-3 font-mono">{record.mayorPermitNumber || '—'}</td><td className="p-3 font-mono">{money(record.grossSales)}</td><td className="p-3"><span className={`px-2 py-1 rounded-full text-[9px] font-bold ${statusClass(record.status)}`}>{record.status}</span></td><td className="p-3"><span className={`px-2 py-1 rounded-full text-[9px] font-bold ${record.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{record.paymentStatus || 'UNPAID'}</span></td><td className="p-3 text-right"><button type="button" onClick={() => setSelectedAssessment(record)} className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-bold mr-1">Review</button><button type="button" onClick={() => void archiveOrRestore(record)} className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold">{record.status === 'ARCHIVED' ? 'Restore' : 'Archive'}</button></td></tr>) : <tr><td colSpan={7} className="p-12 text-center text-slate-400">No records found.</td></tr>}</tbody></table></div>
      <div className="flex justify-between items-center text-xs text-slate-500"><span>Page {page} of {totalPages}</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1.5 border rounded-lg disabled:opacity-40">Previous</button><button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="px-3 py-1.5 border rounded-lg disabled:opacity-40">Next</button></div></div>
    </>}

    {activeTab === 'appointments' && <div className="overflow-x-auto bg-white dark:bg-slate-900 border rounded-2xl"><table className="w-full min-w-[850px] text-xs"><thead className="bg-slate-50 dark:bg-slate-950"><tr><th className="p-3 text-left">Purpose</th><th className="p-3 text-left">Business</th><th className="p-3 text-left">Date</th><th className="p-3 text-left">Status</th><th className="p-3 text-right">Action</th></tr></thead><tbody className="divide-y">{appointments.map((a) => <tr key={a.id}><td className="p-3">{a.appointmentType}</td><td className="p-3">{a.businessName || a.fullName}</td><td className="p-3">{a.date} {a.timeSlot || ''}</td><td className="p-3"><span className="px-2 py-1 rounded-full bg-slate-100 font-bold">{a.status}</span></td><td className="p-3 text-right"><button type="button" onClick={() => setSelectedAppointment(a)} className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-bold">View</button></td></tr>)}</tbody></table></div>}

    {selectedAppointment && <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"><div className="bg-white dark:bg-slate-900 rounded-2xl p-5 w-full max-w-lg"><div className="flex justify-between mb-4"><h3 className="font-bold">Appointment Details</h3><button onClick={() => setSelectedAppointment(null)} className="font-bold">×</button></div><div className="space-y-2 text-xs"><div><b>Purpose:</b> {selectedAppointment.appointmentType}</div><div><b>Business:</b> {selectedAppointment.businessName || '—'}</div><div><b>Applicant:</b> {selectedAppointment.fullName}</div><div><b>Date:</b> {selectedAppointment.date}</div><div><b>Time:</b> {selectedAppointment.timeSlot || 'All Day'}</div><div><b>Description:</b> {selectedAppointment.description || '—'}</div><div><b>Status:</b> {selectedAppointment.status}</div></div><button type="button" onClick={() => setSelectedAppointment(null)} className="mt-5 w-full px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold">Close</button></div></div>}

    {selectedAssessment && <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-2 sm:p-4 overflow-y-auto"><div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-5xl max-h-[95vh] overflow-y-auto shadow-2xl border"><div className="sticky top-0 z-10 flex justify-between items-center px-5 py-4 border-b bg-slate-50 dark:bg-slate-950"><div><h3 className="font-bold text-sm uppercase">{selectedAssessment.status === 'SUBMITTED' || selectedAssessment.status === 'FOR_COMPLIANCE' ? 'Initial Assessment (Assessment Officer)' : selectedAssessment.status === 'FOR_FINAL_REVIEW' ? 'Final Review (Operations Officer)' : selectedAssessment.status === 'FOR_FINAL_APPROVAL' ? 'Final Approval (City Treasurer)' : 'Business Tax Assessment Review'}</h3><p className="font-mono text-[10px] text-blue-600">{selectedAssessment.trackingNumber}</p></div><button onClick={() => setSelectedAssessment(null)} className="text-xl font-bold">×</button></div><div className="p-5 space-y-5 text-xs">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><div className="box"><span>Business</span><b>{selectedAssessment.businessName}</b></div><div className="box"><span>Owner</span><b>{selectedAssessment.businessOwner}</b></div><div className="box"><span>Mayor’s Permit</span><b>{selectedAssessment.mayorPermitNumber || '—'}</b></div><div className="box"><span>Status</span><span className={`self-start px-2 py-1 rounded-full text-[9px] font-bold ${statusClass(selectedAssessment.status)}`}>{selectedAssessment.status}</span></div></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><div className="box"><span>Gross Sales</span><b>{money(selectedAssessment.grossSales)}</b></div><div className="box"><span>Business Type</span><b>{selectedAssessment.businessType || '—'}</b></div><div className="box"><span>Line of Business</span><b>{selectedAssessment.lineOfBusiness || '—'}</b></div><div className="box"><span>Area</span><b>{Number(selectedAssessment.businessAreaSqm || 0).toLocaleString()} sqm</b></div></div>
      <div className="box"><span>Address</span><b>{selectedAssessment.businessAddress || '—'}, {selectedAssessment.barangay || '—'}</b><span>Registration: {selectedAssessment.registrationType || '—'} {selectedAssessment.registrationNumber || ''} • TIN: {selectedAssessment.tin || '—'}</span><span>BIR Registered: {selectedAssessment.birRegistered ? 'Yes' : 'No'} • Other Branches: {selectedAssessment.hasOtherBranches ? 'Yes' : 'No'} • Multiple Lines: {selectedAssessment.hasMultipleLines ? 'Yes' : 'No'}</span></div>
      <div><div className="font-bold mb-2">Document Verification Checklist</div>{renderDocChecklist()}</div>
      <div><div className="font-bold mb-2">Uploaded Documents</div><div className="space-y-2">{(selectedAssessment.attachments || []).map((file, index) => <div key={`${file.name}-${index}`} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border"><div><div className="font-semibold">{file.name}</div><div className="text-[9px] text-slate-400">{LABELS[file.type || ''] || file.type || 'supporting_document'}</div></div><button type="button" onClick={() => setPreviewFile(file)} className="text-blue-600 font-bold">Preview</button></div>)}</div></div>
      <div><div className="flex items-center justify-between mb-2"><div className="font-bold">Final Assessed Amount</div><div className="text-[10px] text-slate-500">Use the applicable current QC schedule / Revenue Code. Do not use an arbitrary percentage.</div></div><div className="grid grid-cols-2 md:grid-cols-3 gap-3">{([['lbt','Local Business Tax'],['mayorsPermit','Mayor’s Permit Fee'],['sanitaryFee','Sanitary Inspection Fee'],['garbageFee','Garbage Fee'],['fireSafetyFee','Fire Safety / BFP Fee'],['otherFees','Other Regulatory Fees']] as Array<[keyof Required<FeeBreakdown>, string]>).map(([key, label]) => <label key={key} className="p-3 rounded-xl border"><span className="block text-[10px] font-bold text-slate-500 mb-1">{label}</span><input type="number" min="0" step="0.01" value={fees[key]} onChange={(e) => setFee(key, e.target.value)} className="w-full p-2 rounded-lg border bg-transparent" /></label>)}</div><div className="mt-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 flex justify-between font-extrabold"><span>Total Assessment</span><span>{money(fees.total)}</span></div></div>
      <div><label className="block font-bold mb-2">Treasurer’s Office Remarks</label><textarea value={actionRemarks} onChange={(e) => setActionRemarks(e.target.value)} rows={4} className="w-full p-3 rounded-xl border bg-transparent" placeholder="Explain returned documents, assessment findings, approval notes, etc." /></div>
      <div className="box"><span>Current Payment</span><b>{selectedAssessment.paymentStatus || 'UNPAID'} • {money(selectedAssessment.paidAmount || selectedAssessment.paymentAmount || selectedAssessment.computedFees?.total)}</b>{selectedAssessment.officialReceiptNumber && <span>O.R.: {selectedAssessment.officialReceiptNumber}</span>}</div>
    </div><div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-t bg-slate-50 dark:bg-slate-950"><div className="flex gap-2">
      {(selectedAssessment.status === 'SUBMITTED' || selectedAssessment.status === 'FOR_FINAL_REVIEW' || selectedAssessment.status === 'FOR_FINAL_APPROVAL' || selectedAssessment.status === 'FOR_COMPLIANCE') && <button type="button" disabled={submitting} onClick={() => void updateStatus('FOR_COMPLIANCE')} className="px-3 py-2 rounded-xl bg-orange-600 text-white text-xs font-bold">Return for Compliance</button>}
      {(selectedAssessment.status === 'SUBMITTED' || selectedAssessment.status === 'FOR_COMPLIANCE') && <button type="button" disabled={submitting} onClick={() => void updateStatus('FOR_FINAL_REVIEW')} className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold">Proceed to Final Review</button>}
      {selectedAssessment.status === 'FOR_FINAL_REVIEW' && <button type="button" disabled={submitting} onClick={() => void updateStatus('FOR_FINAL_APPROVAL')} className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold">Approve for Final Approval</button>}
      <button type="button" disabled={submitting} onClick={() => void updateStatus('REJECTED')} className="px-3 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold">Reject</button>
    </div><div className="flex gap-2">
      <button type="button" onClick={() => void deleteAssessment(selectedAssessment)} className="px-3 py-2 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold">Delete</button>
      <button type="button" onClick={() => void archiveOrRestore(selectedAssessment)} className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold">{selectedAssessment.status === 'ARCHIVED' ? 'Restore' : 'Archive'}</button>
      {(selectedAssessment.status === 'FOR_FINAL_APPROVAL' || selectedAssessment.status === 'APPROVED') && <button type="button" disabled={submitting || selectedAssessment.status === 'APPROVED'} onClick={() => void updateStatus('APPROVED')} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold">Final Approval & Issue Tax Bill</button>}
    </div></div></div></div>}

    {showOrderModal && selectedAssessment && selectedAssessment.status === 'APPROVED' && <div className="fixed inset-0 z-[60] bg-slate-950/70 flex items-center justify-center p-4"><div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg p-6 border shadow-2xl"><h3 className="font-bold text-sm uppercase">Approved Business Tax Bill / Order of Payment</h3><div className="mt-4 space-y-2 text-xs"><div className="flex justify-between"><span>Tracking Number</span><b className="font-mono">{selectedAssessment.trackingNumber}</b></div><div className="flex justify-between"><span>Tax Bill Number</span><b className="font-mono text-blue-600">{selectedAssessment.taxBillNumber || '—'}</b></div><div className="flex justify-between"><span>Order of Payment</span><b className="font-mono">{selectedAssessment.orderOfPaymentNumber || '—'}</b></div><div className="flex justify-between"><span>Amount Due</span><b>{money(selectedAssessment.paymentAmount || selectedAssessment.computedFees?.total)}</b></div><div className="flex justify-between"><span>Due Date</span><b>{selectedAssessment.dueDate ? new Date(selectedAssessment.dueDate).toLocaleDateString() : '—'}</b></div></div><div className="mt-5 flex gap-2"><button type="button" onClick={() => setShowOrderModal(false)} className="flex-1 px-4 py-2 rounded-xl border text-xs font-bold">Close</button><button type="button" onClick={() => window.print()} className="flex-1 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold">Print</button></div></div></div>}

    {previewFile && <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4" onClick={() => setPreviewFile(null)}><div className="w-full max-w-5xl h-[90vh]" onClick={(e) => e.stopPropagation()}><div className="flex justify-end mb-2"><button type="button" onClick={() => setPreviewFile(null)} className="text-white text-2xl font-bold">×</button></div>{previewFile.mimeType === 'application/pdf' || previewFile.url.startsWith('data:application/pdf') ? <iframe src={previewFile.url} title="Document Preview" className="w-full h-[calc(100%-40px)] bg-white rounded-xl" /> : <div className="w-full h-[calc(100%-40px)] flex items-center justify-center"><img src={previewFile.url} alt="Document Preview" className="max-w-full max-h-full object-contain rounded-xl" /></div>}</div></div>}

    <style>{`.box{display:flex;flex-direction:column;gap:.25rem;padding:1rem;border:1px solid rgb(226 232 240);border-radius:1rem;background:rgb(248 250 252)}.dark .box{border-color:rgb(51 65 85);background:rgba(2,6,23,.35)}.box>span:first-child{font-size:9px;font-weight:700;text-transform:uppercase;color:rgb(148 163 184)}.box>b{font-weight:700}`}</style>
  </div>;
};

export default BusinessTaxAssessmentAdminView;
