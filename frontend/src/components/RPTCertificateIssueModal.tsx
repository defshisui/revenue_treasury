import React, { useMemo, useState } from 'react';
import type { RPTApplicationRecord, RPTCertificateData } from '../services/realpropertytaxService';

interface Props {
  application: RPTApplicationRecord | null;
  open: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (data: RPTCertificateData) => Promise<void>;
}

const money = (value: string) => {
  const n = Number(value);
  return Number.isFinite(n) ? `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '₱0.00';
};

const today = () => new Date().toISOString().slice(0, 10);

export default function RPTCertificateIssueModal({ application, open, submitting, onClose, onSubmit }: Props) {
  const initial = useMemo<RPTCertificateData>(() => ({
    certificateNumber: `QC-RPT-CERT-${new Date().getFullYear()}-${String(application?.id || '').replace(/[^0-9A-Za-z]/g, '').slice(0, 8).toUpperCase() || '000001'}`,
    certificateType: 'Official Receipt / Digital RPT Certificate',
    issueDate: today(),
    issuedBy: 'City Treasurer / Authorized Officer',
    position: 'City Treasurer',
    registeredOwner: application?.ownerName || application?.applicantName || '',
    billNumber: application?.referenceNumber || application?.controlNumber || '',
    taxDeclarationNumber: application?.taxDeclarationNumber || application?.propertyDetails?.titleNumber || '',
    pin: application?.pin || application?.propertyDetails?.pin || '',
    propertyAddress: application?.propertyLocation || application?.propertyDetails?.address || '',
    lotArea: application?.propertyDetails?.lotAreaSqM ? String(application.propertyDetails.lotAreaSqM) : '',
    marketValue: application?.propertyDetails?.currentValuation ? String(application.propertyDetails.currentValuation) : '',
    assessedValue: '',
    natureOfCollection: application?.service || 'Real Property Tax / RPT Service',
    fundAccountCode: '1-04-01-010',
    amount: String(application?.paymentAmount || 0),
    subtotal: String(application?.paymentAmount || 0),
    grandTotal: String(application?.paymentAmount || 0),
    amountInWords: '',
    paymentMethod: application?.paymentMethod || 'Online Payment',
    paymentReference: application?.paymentReference || '',
    machineValidationNumber: `MV-${Date.now().toString().slice(-8)}`,
    remarks: 'Issued electronically through the GovServe Treasury Portal.',
  }), [application]);

  const [form, setForm] = useState<RPTCertificateData>(initial);

  React.useEffect(() => {
    setForm(initial);
  }, [initial]);

  if (!open || !application) return null;

  const set = (key: keyof RPTCertificateData, value: string) => setForm(prev => ({ ...prev, [key]: value }));
  const total = form.grandTotal || form.amount || '0';

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm p-4 md:p-6 overflow-y-auto">
      <div className="max-w-[1500px] mx-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="font-black text-slate-900 dark:text-white">Issue Official Receipt / Digital Certificate</h2>
            <p className="text-xs text-slate-500 mt-1">Enter the official information, review the receipt, then send it to the citizen's registered email.</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 cursor-pointer">×</button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[430px_minmax(0,1fr)] gap-0">
          <div className="p-5 border-r border-slate-200 dark:border-slate-800 max-h-[78vh] overflow-y-auto">
            <h3 className="font-black text-sm mb-4">Certificate Information</h3>
            <div className="grid grid-cols-1 gap-3">
              {([
                ['certificateNumber', 'Certificate / O.R. No.'],
                ['machineValidationNumber', 'Machine Validation No.'],
                ['billNumber', 'Bill Number'],
                ['registeredOwner', 'Payor / Registered Owner'],
                ['taxDeclarationNumber', 'Tax Declaration No.'],
                ['pin', 'Property Identification Number (PIN)'],
                ['propertyAddress', 'Property Address'],
                ['lotArea', 'Lot Area (sq.m.)'],
                ['marketValue', 'Market Value'],
                ['assessedValue', 'Assessed Value'],
                ['natureOfCollection', 'Nature of Collection'],
                ['fundAccountCode', 'Fund and Account Code'],
                ['amount', 'Amount'],
                ['subtotal', 'Subtotal'],
                ['grandTotal', 'Grand Total / Total'],
                ['amountInWords', 'Amount in Words'],
                ['paymentMethod', 'Payment Method'],
                ['paymentReference', 'Payment Reference'],
                ['issuedBy', 'Issued / Received By'],
                ['position', 'Position'],
                ['remarks', 'Remarks'],
              ] as [keyof RPTCertificateData, string][]).map(([key, label]) => (
                <label key={key} className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {label}
                  <input value={form[key]} onChange={e => set(key, e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200 font-medium" />
                </label>
              ))}
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Issue Date
                <input type="date" value={form.issueDate} onChange={e => set('issueDate', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2" />
              </label>
            </div>
          </div>

          <div className="p-5 bg-slate-100 dark:bg-slate-950 overflow-auto max-h-[78vh]">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">Live Official Receipt Preview</span>
              <button type="button" onClick={() => window.print()} className="text-xs font-bold px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer">Print Preview</button>
            </div>
            <div id="rpt-official-receipt-preview" className="bg-white text-slate-900 mx-auto w-full max-w-[820px] min-w-[650px] border-2 border-slate-700 shadow-xl font-serif">
              <div className="grid grid-cols-[120px_1fr_120px] items-center border-b-2 border-slate-700 p-3">
                <div className="flex justify-center"><img src="/logo-system.png" alt="Government seal" className="w-20 h-20 object-contain" /></div>
                <div className="text-center">
                  <div className="text-2xl font-black tracking-wide">OFFICIAL RECEIPT</div>
                  <div className="text-sm">Republic of the Philippines</div>
                  <div className="text-sm">Office of the City Treasurer</div>
                  <div className="text-sm">Quezon City</div>
                </div>
                <div className="text-center text-[10px] font-bold border border-slate-400 p-2">ORIGINAL</div>
              </div>
              <div className="grid grid-cols-2 border-b border-slate-700 text-sm">
                <div className="border-r border-slate-700 p-3"><b>Computerized Official Receipt</b><br/><span className="text-xs">Certificate Type: {form.certificateType}</span></div>
                <div className="p-3"><b>No.</b> <span className="font-mono font-bold">{form.certificateNumber}</span><br/><span className="text-xs">Issue Date: {form.issueDate}</span></div>
              </div>
              <div className="grid grid-cols-2 border-b border-slate-700 text-sm">
                <div className="border-r border-slate-700 p-3"><span className="text-xs font-bold">Machine Validation No.</span><div className="font-mono font-bold">{form.machineValidationNumber}</div></div>
                <div className="p-3"><span className="text-xs font-bold">Bill Number</span><div className="font-mono font-bold">{form.billNumber}</div></div>
              </div>
              <div className="border-b border-slate-700 p-3 text-sm"><b>Payor:</b> {form.registeredOwner}</div>
              <div className="grid grid-cols-2 border-b border-slate-700 text-sm">
                <div className="border-r border-slate-700 p-3"><b>Tax Declaration No.</b><br/>{form.taxDeclarationNumber}</div>
                <div className="p-3"><b>PIN</b><br/>{form.pin}</div>
              </div>
              <div className="border-b border-slate-700 p-3 text-sm"><b>Property Address:</b> {form.propertyAddress}</div>
              <table className="w-full border-collapse text-sm">
                <thead><tr className="font-bold text-center"><th className="border-r border-b border-slate-700 p-2">NATURE OF COLLECTION</th><th className="border-r border-b border-slate-700 p-2 w-40">FUND AND ACCOUNT CODE</th><th className="border-b border-slate-700 p-2 w-32">AMOUNT</th></tr></thead>
                <tbody>
                  <tr><td className="border-r border-slate-700 p-3 align-top whitespace-pre-wrap">{form.natureOfCollection}</td><td className="border-r border-slate-700 p-3 align-top text-center">{form.fundAccountCode}</td><td className="p-3 align-top text-right font-bold">{money(form.amount)}</td></tr>
                  <tr><td className="border-r border-slate-700 p-2 h-28"></td><td className="border-r border-slate-700 p-2"></td><td className="p-2"></td></tr>
                </tbody>
              </table>
              <div className="grid grid-cols-[1fr_190px] border-t border-slate-700 text-sm"><div className="p-3 text-right font-bold">Subtotal<br/>Grand Total</div><div className="border-l border-slate-700 p-3 text-right font-mono">{money(form.subtotal)}<br/>{money(form.grandTotal)}</div></div>
              <div className="grid grid-cols-[1fr_190px] border-t-2 border-slate-700 text-lg font-black"><div className="p-3 text-right tracking-[0.4em]">TOTAL</div><div className="border-l border-slate-700 p-3 text-right">{money(total)}</div></div>
              <div className="border-t border-slate-700 p-3 text-sm"><b>Amount in Words:</b> {form.amountInWords}</div>
              <div className="grid grid-cols-2 border-t border-slate-700 text-sm">
                <div className="p-4 border-r border-slate-700"><b>Received</b><div className="mt-3">□ Cash &nbsp;&nbsp; □ Check</div><div>□ Treasury Warrant &nbsp;&nbsp; □ Money Order</div><div className="mt-4"><b>Payment Method:</b> {form.paymentMethod}</div><div><b>Reference:</b> {form.paymentReference}</div></div>
                <div className="p-4 text-center"><div>Received the Amount stated above.</div><div className="mt-12 font-bold">{form.issuedBy}</div><div>{form.position}</div><div className="mt-4 text-[10px] font-mono break-all">{form.machineValidationNumber}</div></div>
              </div>
              <div className="border-t border-slate-700 p-3 text-[10px] flex justify-between gap-4"><span>Remarks: {form.remarks}</span><span>Generated electronically • GovServe Treasury</span></div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-200 dark:border-slate-800">
          <button onClick={onClose} disabled={submitting} className="px-5 py-2.5 rounded-xl border border-slate-300 font-bold cursor-pointer">Cancel</button>
          <button onClick={() => onSubmit(form)} disabled={submitting || !form.certificateNumber || !form.registeredOwner || !form.grandTotal} className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black cursor-pointer disabled:opacity-50">
            {submitting ? 'Issuing & Sending...' : 'Issue & Send to Citizen Gmail'}
          </button>
        </div>
      </div>
    </div>
  );
}
