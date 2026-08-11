import type { Dispatch, FormEvent, SetStateAction } from "react";
import type { RPTRecord } from "../types/treasury";

interface RPTForm {
  ownerName: string;
  ownerAddress: string;
  contact: string;
  pin: string;
  tdNo: string;
  barangay: string;
  type: "" | "Residential" | "Commercial" | "Industrial" | "Agricultural";
  landArea: number;
  buildingArea: number;
  marketValue: number;
  assessLvl: number | "";
  transactionType: string;
  paymentMethod: string;
  receiptNo: string;
}

interface RealPropertyTaxViewProps {
  records: RPTRecord[];
  form: RPTForm;
  setForm: Dispatch<SetStateAction<RPTForm>>;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  onSubmit: (event: FormEvent) => void;
  onAdvance: (id: string) => void;
  onEdit: (record: RPTRecord) => void;
  onDelete: (id: string) => void;
  editingId?: string | null;
  onCancelEdit?: () => void;
  previewTotalAssessment: number;
  notify: (message: string) => void;
  isCollapsed: boolean;
}

export default function RealPropertyTaxView({ 
  records, 
  form, 
  setForm, 
  searchQuery, 
  setSearchQuery, 
  onSubmit, 
  onAdvance,
  onEdit,
  onDelete,
  editingId,
  onCancelEdit,
  previewTotalAssessment,
  notify,
  isCollapsed
}: RealPropertyTaxViewProps) {
  const filteredRecords = records.filter(record => 
    record.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    record.propertyIndexNumber.includes(searchQuery)
  );
  
  const update = (field: keyof RPTForm, value: string | number) => {
    if (field === "contact") {
      const numericValue = String(value).replace(/\D/g, "").slice(0, 11);
      setForm(current => ({ ...current, [field]: numericValue }));
      return;
    }

    if (field === "pin") {
      const raw = String(value).replace(/\D/g, "").slice(0, 15);
      let formatted = "";
      if (raw.length > 0) formatted += raw.slice(0, 2);
      if (raw.length >= 2) formatted += "-" + raw.slice(2, 4);
      if (raw.length >= 4) formatted += "-" + raw.slice(4, 7);
      if (raw.length >= 7) formatted += "-" + raw.slice(7, 10);
      if (raw.length >= 10) formatted += "-" + raw.slice(10, 14);

      setForm(current => ({ ...current, [field]: formatted }));
      return;
    }

    if (field === "tdNo") {
      const raw = String(value).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 9);
      let formatted = "";
      if (raw.length > 0) formatted += raw.slice(0, 1);
      if (raw.length > 1) formatted += "-" + raw.slice(1, 4);
      if (raw.length > 4) formatted += "-" + raw.slice(4, 9);

      setForm(current => ({ ...current, [field]: formatted }));
      return;
    }

    setForm(current => ({ ...current, [field]: value }));
  };

  const handleEditClick = (record: RPTRecord) => {
    const anyRecord = record as any;
    setForm({
      ownerName: record.ownerName || "",
      ownerAddress: record.ownerAddress || "",
      contact: record.contactInfo || anyRecord.contact || "",
      pin: record.propertyIndexNumber || "",
      tdNo: record.taxDeclarationNumber || "",
      barangay: record.barangay || "",
      type: (record.propertyType as any) || "",
      landArea: record.landArea || 0,
      buildingArea: record.buildingArea || 0,
      marketValue: record.marketValue || 0,
      assessLvl: record.assessmentLevel || "",
      transactionType: anyRecord.transactionType || "",
      paymentMethod: anyRecord.paymentMethod || "",
      receiptNo: record.receiptNo || "",
    });
    onEdit(record);
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!form.assessLvl || !form.transactionType || !form.paymentMethod || !form.type) {
    notify("Please fill in all required fields before computing.");
    return;
  }
    
    // If payment method is Cash, auto-generate receipt number if empty
    if (form.paymentMethod === "Cash" && !form.receiptNo) {
      const generatedReceipt = `OR-${Math.floor(100000 + Math.random() * 900000)}`;
      setForm(current => {
        const updated = { ...current, receiptNo: generatedReceipt };
        setTimeout(() => onSubmit(e), 0);
        return updated;
      });
    } else {
      onSubmit(e);
    }
  };

  return (
    <div 
      className={`
        min-h-screen
        bg-slate-50 dark:bg-slate-900
        text-slate-800 dark:text-white
        p-6 pt-24
        transition-all duration-300
        ${isCollapsed ? "ml-20" : "ml-64"}
      `}
    >
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Real Property Tax Management</h2>
      </div>
      
      {/* FORM SECTION (Create Mode Only) */}
      <div className="dark:bg-slate-800 border-slate-200 rounded-2xl p-6 shadow-sm dark:text-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold dark:text-white">
            Create New Property Tax Assessment
          </h3>
        </div>
        <form onSubmit={handleFormSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input type="text" placeholder="Owner Full Name" required value={form.ownerName} onChange={event => update("ownerName", event.target.value)} className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" />
          <input type="text" placeholder="Owner Address" required value={form.ownerAddress} onChange={event => update("ownerAddress", event.target.value)} className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" />
          
          <input 
            type="text" 
            placeholder="Contact Number (09XXXXXXXXX)" 
            required 
            maxLength={11} 
            value={form.contact} 
            onChange={event => update("contact", event.target.value)} 
            className="dark:bg-slate-800 border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" 
          />

          <input 
            type="text" 
            placeholder="PIN (TT-SS-BBB-PPP-UUUU)" 
            required 
            maxLength={19}
            value={form.pin} 
            onChange={event => update("pin", event.target.value)} 
            className="dark:bg-slate-800 border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 outline-none focus:border-blue-500" 
          />

          <input 
            type="text" 
            placeholder="Tax Dec No. (X-XXX-XXXXX)" 
            required 
            maxLength={11}
            value={form.tdNo} 
            onChange={event => update("tdNo", event.target.value)} 
            className="dark:bg-slate-800 border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 outline-none focus:border-blue-500" 
          />
          
          <input type="text" placeholder="Barangay" required value={form.barangay} onChange={event => update("barangay", event.target.value)} className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" />

          <select required value={form.type} onChange={event => update("type", event.target.value)} className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500">
            <option value="" disabled>Select Property Classification</option>
            <option value="Residential">Residential</option>
            <option value="Commercial">Commercial</option>
            <option value="Industrial">Industrial</option>
            <option value="Agricultural">Agricultural</option>
          </select>

          <select required value={form.transactionType} onChange={event => update("transactionType", event.target.value)} className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500">
            <option value="" disabled>Select Type of Transaction</option>
            <option value="Annual Payment">Annual Payment</option>
            <option value="Quarterly Payment">Quarterly Payment</option>
            <option value="Advanced Payment">Advanced Payment</option>
            <option value="Arrears Payment">Back Taxes / Arrears</option>
          </select>

          <select required value={form.paymentMethod} onChange={event => update("paymentMethod", event.target.value)} className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500">
            <option value="" disabled>Select Payment Method</option>
            <option value="Cash">Cash</option>
            <option value="Check">Check</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="GCash / E-Wallet">GCash / E-Wallet</option>
          </select>

          <input 
            type="text" 
            placeholder={form.paymentMethod === "Cash" ? "Receipt No. (Auto-generated)" : "Enter Reference / Receipt No."} 
            required={form.paymentMethod !== "Cash"}
            disabled={form.paymentMethod === "Cash"}
            value={form.receiptNo} 
            onChange={event => update("receiptNo", event.target.value)} 
            className={`dark:bg-slate-800 border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-mono outline-none focus:border-blue-500 ${form.paymentMethod === "Cash" ? "bg-slate-100 opacity-60 cursor-not-allowed" : ""}`} 
          />

          <input type="number" placeholder="Market Value" required value={form.marketValue || ""} onChange={event => update("marketValue", Number(event.target.value))} className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" />
          
          <select required value={form.assessLvl} onChange={event => update("assessLvl", Number(event.target.value))} className="dark:bg-slate-800 border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500">
            <option value="" disabled>Select Assessment Level</option>
            <option value={20}>20%</option>
            <option value={40}>40%</option>
            <option value={50}>50%</option>
          </select>

          <input
            type="text"
            placeholder="Total Assessment" value={previewTotalAssessment ? previewTotalAssessment.toLocaleString() : ""} readOnly className="bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-500 cursor-not-allowed font-semibold" />

          <div className="md:col-span-4 flex justify-end gap-2">
            <button type="submit" disabled={!form.assessLvl || !form.transactionType || !form.paymentMethod || !form.type} className="bg-blue-600 hover:bg-blue-700 font-bold px-6 py-2 rounded-lg text-sm transition-colors text-white shadow-sm cursor-pointer disabled:opacity-50">
              Compute
            </button>
          </div>
        </form>
      </div>

      {/* EDIT MODAL POPUP */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-4xl shadow-xl relative">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                Edit Property Tax Assessment
              </h3>
              {onCancelEdit && (
                <button 
                  type="button" 
                  onClick={onCancelEdit}
                  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1 rounded-lg border border-slate-300 transition-colors cursor-pointer"
                >
                  ✕ Close
                </button>
              )}
            </div>

            <form onSubmit={handleFormSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input type="text" placeholder="Owner Full Name" required value={form.ownerName} onChange={event => update("ownerName", event.target.value)} className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"/>
              <input type="text" placeholder="Owner Address" required value={form.ownerAddress} onChange={event => update("ownerAddress", event.target.value)} className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" />
              
              <input 
                type="text" 
                placeholder="Contact Number (09XXXXXXXXX)" 
                required 
                maxLength={11} 
                value={form.contact} 
                onChange={event => update("contact", event.target.value)} 
                className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" 
              />

              <input 
                type="text" 
                placeholder="PIN (TT-SS-BBB-PPP-UUUU)" 
                required 
                maxLength={19}
                value={form.pin} 
                onChange={event => update("pin", event.target.value)} 
                className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 outline-none focus:border-blue-500" 
              />

              <input 
                type="text" 
                placeholder="Tax Dec No. (X-XXX-XXXXX)" 
                required 
                maxLength={11}
                value={form.tdNo} 
                onChange={event => update("tdNo", event.target.value)} 
                className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 outline-none focus:border-blue-500" 
              />
              
              <input type="text" placeholder="Barangay" required value={form.barangay} onChange={event => update("barangay", event.target.value)} className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" />

              <select required value={form.type} onChange={event => update("type", event.target.value)} className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500">
                <option value="" disabled>Select Property Classification</option>
                <option value="Residential">Residential</option>
                <option value="Commercial">Commercial</option>
                <option value="Industrial">Industrial</option>
                <option value="Agricultural">Agricultural</option>
              </select>

              <select required value={form.transactionType} onChange={event => update("transactionType", event.target.value)} className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500">
                <option value="" disabled>Select Type of Transaction</option>
                <option value="Annual Payment">Annual Payment</option>
                <option value="Quarterly Payment">Quarterly Payment</option>
                <option value="Advanced Payment">Advanced Payment</option>
                <option value="Arrears Payment">Back Taxes / Arrears</option>
              </select>

              <select required value={form.paymentMethod} onChange={event => update("paymentMethod", event.target.value)} className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500">
                <option value="" disabled>Select Payment Method</option>
                <option value="Cash">Cash</option>
                <option value="Check">Check</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="GCash / E-Wallet">GCash / E-Wallet</option>
              </select>

              <input 
                type="text" 
                placeholder={form.paymentMethod === "Cash" ? "Receipt No. (Auto-generated)" : "Enter Reference / Receipt No."} 
                required={form.paymentMethod !== "Cash"}
                disabled={form.paymentMethod === "Cash"}
                value={form.receiptNo} 
                onChange={event => update("receiptNo", event.target.value)} 
                className={`bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-mono outline-none focus:border-blue-500 ${form.paymentMethod === "Cash" ? "bg-slate-100 opacity-60 cursor-not-allowed" : ""}`} 
              />

              <input type="number" placeholder="Market Value" required value={form.marketValue || ""} onChange={event => update("marketValue", Number(event.target.value))} className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" />
              
              <select required value={form.assessLvl} onChange={event => update("assessLvl", Number(event.target.value))} className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500">
                <option value="" disabled>Select Assessment Level</option>
                <option value={20}>20%</option>
                <option value={40}>40%</option>
                <option value={50}>50%</option>
              </select>

              <div className="md:col-span-4 flex justify-end gap-2 mt-4">
                {onCancelEdit && (
                  <button 
                    type="button" 
                    onClick={onCancelEdit} 
                    className="bg-slate-100 hover:bg-slate-200 font-bold px-6 py-2 rounded-lg text-sm transition-colors text-slate-700 border border-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 font-bold px-6 py-2 rounded-lg text-sm transition-colors text-white shadow-sm cursor-pointer">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TABLE SECTION */}
      <div className="dark:bg-slate-800 border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Property Tax Records</h3>
          <input 
            type="text" 
            placeholder="Search owner or PIN..." 
            value={searchQuery} 
            onChange={event => setSearchQuery(event.target.value)} 
            className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-64 dark:text-white outline-none focus:border-blue-500" 
          />
        </div>

        {records.length === 0 ? (
          <p className="text-slate-400 text-sm italic">No records available. Add a record above to get started.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg dark:border dark:border-blue-950">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="dark:bg-slate-950 text-slate-700 font-semibold dark:border-b dark:border-blue-950 dark:text-white">
                <tr>
                  <th className="p-3">Tax Declaration No.</th>
                  <th className="p-3">PIN</th>
                  <th className="p-3">Owner Name</th>
                  <th className="p-3">Owner Address & Barangay</th>
                  <th className="p-3">Classification</th>
                  <th className="p-3">Type of Transaction</th>
                  <th className="p-3">Payment Method</th>
                  <th className="p-3">Receipt No.</th>
                  <th className="p-3">Market Value</th>
                  <th className="p-3">Assessment Level</th>
                  <th className="p-3">Assessed Value</th>
                  <th className="p-3">Total Assessment</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-center">Workflow</th>
                  <th className="p-3 text-center">Edit</th>
                  <th className="p-3 text-center">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredRecords.map(record => (
                  <tr key={record.id} className={`hover:bg-white-50/50 transition-colors ${editingId === record.id ? "bg-amber-50" : ""}`}>
                    <td className="p-3 font-mono text-sm dark:text-blue-600 font-semibold">{record.taxDeclarationNumber}</td>
                    <td className="p-3 font-mono text-sm dark:text-white tracking-wider">{record.propertyIndexNumber}</td>
                    <td className="p-3 font-semibold dark:text-white capitalize">{record.ownerName}</td>
                    <td className="p-3 text-sm dark:text-white capitalize">{record.ownerAddress}{record.barangay ? `, ${record.barangay}` : ""}</td>
                    <td className="p-3 dark:text-white">{record.propertyType}</td>
                    <td className="p-3 dark:text-white">{record.transactionType}</td>
                    <td className="p-3 dark:text-white">{record.paymentMethod}</td>
                    <td className="p-3 font-mono text-xs dark:text-white">{record.receiptNo}</td>
                    <td className="p-3 dark:text-white">{record.marketValue.toLocaleString()}</td>
                    <td className="p-3 dark:text-white">{record.assessmentLevel}%</td>
                    <td className="p-3 dark:text-white">{record.assessedValue.toLocaleString()}</td>
                    <td className="p-3 font-bold dark:text-emerald-700">₱{record.totalAssessment.toLocaleString()}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-xs dark:bg-black-100 dark:text-white border border-slate-200 font-semibold inline-block text-center">
                        {record.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {record.status !== "Completed" && (
                        <button type="button" onClick={() => onAdvance(record.id)} className="dark:bg-black-100 hover:bg-slate-50 text-amber-600 border border-slate-300 px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer shadow-xs">
                          Advance
                        </button>
                      )}
                    </td>
                    <td className="p-3 text-center ">
                      <button 
                        type="button"
                        onClick={() => handleEditClick(record)} 
                        className={`border px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer shadow-xs ${
                          editingId === record.id 
                            ? "bg-amber-600 text-white border-amber-600" 
                            : "dark:bg-black-100 hover:bg-slate-50 text-blue-600 border-slate-300"
                        }`}
                      >
                        {editingId === record.id ? "Editing..." : "Edit"}
                      </button>
                    </td>
                    <td className="p-3 text-center">
                      <button 
                        type="button"
                        onClick={() => onDelete(record.id)} 
                        className="dark:bg-black-100 hover:bg-slate-50 text-rose-600 border border-slate-300 px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer shadow-xs"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  ); 
}

export type { RPTForm };