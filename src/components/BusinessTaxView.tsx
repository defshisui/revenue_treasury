import type { Dispatch, FormEvent, SetStateAction } from "react";
import type { BusinessRecord } from "../types/treasury";

export interface BusinessForm { 
  owner: string; 
  businessName: string; 
  address: string; 
  type: string; 
  nature: string; 
  grossSales: number; 
  capital: number;
  contact: string;
  barangay: string;
  paymentMethod: string;
  receiptNo: string;
}

interface BusinessTaxViewProps {
  records: BusinessRecord[];
  form: BusinessForm;
  setForm: Dispatch<SetStateAction<BusinessForm>>;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  onSubmit: (event: FormEvent) => void;
  onAdvance: (id: string) => void;
  onEdit: (record: BusinessRecord) => void;
  onDelete: (id: string) => void;
  editingId?: string | null;
  onCancelEdit?: () => void;
  previewTotalDue: number;
  notify: (message: string) => void;
  isCollapsed: boolean;
}

export default function BusinessTaxView({ 
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
  previewTotalDue,
  notify,
  isCollapsed
}: BusinessTaxViewProps) {
  const filteredRecords = records.filter(record => {
    const anyRec = record as any;
    return (
      record.businessName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      record.owner.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.businessId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (anyRec.businessType && String(anyRec.businessType).toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });
  
  const update = (field: keyof BusinessForm, value: string | number) => {
    if (field === "contact") {
      const numericValue = String(value).replace(/\D/g, "").slice(0, 11);
      setForm(current => ({ ...current, [field]: numericValue }));
      return;
    }

    setForm(current => ({ ...current, [field]: value }));
  };

  const handleEditClick = (record: BusinessRecord) => {
    const anyRecord = record as any;
    setForm({
      owner: record.owner || "",
      businessName: record.businessName || "",
      address: record.address || "",
      type: anyRecord.businessType || anyRecord.type || "",
      nature: record.natureOfBusiness || "",
      grossSales: record.grossSales || 0,
      capital: anyRecord.capitalInvestment || anyRecord.capital || 0,
      contact: anyRecord.contact || "",
      barangay: anyRecord.barangay || "",
      paymentMethod: anyRecord.paymentMethod || "",
      receiptNo: anyRecord.receiptNo || "",
    });
    onEdit(record);
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!form.type || !form.paymentMethod) {
      notify("Please fill in all required fields before submitting.");
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
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight dark:text-white">Business Tax & Permit Management</h2>
        <span className="text-xs bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-medium">
          {records.length} {records.length === 1 ? "record loaded" : "records loaded"}
        </span>
      </div>
      
      {/* FORM SECTION (Create Mode Only) */}
      <div className="dark:bg-slate-800 border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold dark:text-white">
            New Business Tax Assessment Application
          </h3>
        </div>
        <form onSubmit={handleFormSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input 
            type="text" 
            placeholder="Owner Name" 
            required 
            value={form.owner} 
            onChange={event => update("owner", event.target.value)} 
            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" 
          />
          <input 
            type="text" 
            placeholder="Business Name" 
            required 
            value={form.businessName} 
            onChange={event => update("businessName", event.target.value)} 
            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" 
          />
          <input 
            type="text" 
            placeholder="Business Address" 
            required 
            value={form.address} 
            onChange={event => update("address", event.target.value)} 
            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" 
          />
          <input 
            type="text" 
            placeholder="Barangay" 
            required 
            value={form.barangay} 
            onChange={event => update("barangay", event.target.value)} 
            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" 
          />

          <input 
            type="text" 
            placeholder="Contact Number (09XXXXXXXXX)" 
            required 
            maxLength={11} 
            value={form.contact} 
            onChange={event => update("contact", event.target.value)} 
            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" 
          />

          <select 
            required 
            value={form.type} 
            onChange={event => update("type", event.target.value)} 
            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
          >
            <option value="" disabled>Select Business Type</option>
            <option value="Single Proprietorship">Single Proprietorship</option>
            <option value="Partnership">Partnership</option>
            <option value="Corporation">Corporation</option>
            <option value="Cooperative">Cooperative</option>
          </select>

          <input 
            type="text" 
            placeholder="Nature of Business" 
            required 
            value={form.nature} 
            onChange={event => update("nature", event.target.value)} 
            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" 
          />

          <select 
            required 
            value={form.paymentMethod} 
            onChange={event => update("paymentMethod", event.target.value)} 
            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
          >
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

          <input 
            type="number" 
            placeholder="Declared Gross Sales" 
            required 
            value={form.grossSales || ""} 
            onChange={event => update("grossSales", Number(event.target.value))} 
            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" 
          />

          <input 
            type="number" 
            placeholder="Capital Investment" 
            required 
            value={form.capital || ""} 
            onChange={event => update("capital", Number(event.target.value))} 
            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" 
          />

          <input
            type="text"
            placeholder="Total Tax Due Preview" 
            value={previewTotalDue ? previewTotalDue.toLocaleString() : ""} 
            readOnly 
            className="bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-500 cursor-not-allowed font-semibold" 
          />

          <div className="md:col-span-4 flex justify-end gap-2">
            <button 
              type="submit" 
              className="bg-amber-500 hover:bg-amber-400 font-bold px-6 py-2 rounded-lg text-sm transition-colors text-white shadow-sm cursor-pointer"
            >
              Submit Business Application
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
                Edit Business Tax Assessment
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
              <input 
                type="text" 
                placeholder="Owner Name" 
                required 
                value={form.owner} 
                onChange={event => update("owner", event.target.value)} 
                className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" 
              />
              <input 
                type="text" 
                placeholder="Business Name" 
                required 
                value={form.businessName} 
                onChange={event => update("businessName", event.target.value)} 
                className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" 
              />
              <input 
                type="text" 
                placeholder="Business Address" 
                required 
                value={form.address} 
                onChange={event => update("address", event.target.value)} 
                className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" 
              />
              <input 
                type="text" 
                placeholder="Barangay" 
                required 
                value={form.barangay} 
                onChange={event => update("barangay", event.target.value)} 
                className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" 
              />

              <input 
                type="text" 
                placeholder="Contact Number (09XXXXXXXXX)" 
                required 
                maxLength={11} 
                value={form.contact} 
                onChange={event => update("contact", event.target.value)} 
                className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" 
              />

              <select 
                required 
                value={form.type} 
                onChange={event => update("type", event.target.value)} 
                className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
              >
                <option value="" disabled>Select Business Type</option>
                <option value="Single Proprietorship">Single Proprietorship</option>
                <option value="Partnership">Partnership</option>
                <option value="Corporation">Corporation</option>
                <option value="Cooperative">Cooperative</option>
              </select>

              <input 
                type="text" 
                placeholder="Nature of Business" 
                required 
                value={form.nature} 
                onChange={event => update("nature", event.target.value)} 
                className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" 
              />

              <select 
                required 
                value={form.paymentMethod} 
                onChange={event => update("paymentMethod", event.target.value)} 
                className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
              >
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

              <input 
                type="number" 
                placeholder="Declared Gross Sales" 
                required 
                value={form.grossSales || ""} 
                onChange={event => update("grossSales", Number(event.target.value))} 
                className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" 
              />

              <input 
                type="number" 
                placeholder="Capital Investment" 
                required 
                value={form.capital || ""} 
                onChange={event => update("capital", Number(event.target.value))} 
                className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500" 
              />

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
                <button 
                  type="submit" 
                  className="bg-amber-500 hover:bg-amber-400 font-bold px-6 py-2 rounded-lg text-sm transition-colors text-white shadow-sm cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TABLE SECTION */}
      <div className="dark:bg-dark-950 dark:border dark:border-gray-950 rounded-2xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
          <h3 className="text-lg font-bold dark:text-white">Registered Business Enterprises</h3>
          <input 
            type="text" 
            placeholder="Search business, owner, or ID..." 
            value={searchQuery} 
            onChange={event => setSearchQuery(event.target.value)} 
            className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-64 text-slate-900 outline-none focus:border-blue-500" 
          />
        </div>

        {records.length === 0 ? (
          <p className="text-slate-400 text-sm italic">No records available. Add a business application above to get started.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Reference ID</th>
                  <th className="p-3">Business Name & Owner</th>
                  <th className="p-3">Address & Barangay</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Nature</th>
                  <th className="p-3">Gross Sales</th>
                  <th className="p-3">Capital</th>
                  <th className="p-3">Payment Method</th>
                  <th className="p-3">Receipt No.</th>
                  <th className="p-3">Total Tax Due</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-center">Workflow</th>
                  <th className="p-3 text-center">Edit</th>
                  <th className="p-3 text-center">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredRecords.map(record => {
                  const anyRec = record as any;
                  return (
                    <tr key={record.id} className={`hover:bg-slate-50/50 transition-colors ${editingId === record.id ? "bg-amber-50" : ""}`}>
                      <td className="p-3 font-mono text-sm text-blue-600 font-semibold">{record.businessId}</td>
                      <td className="p-3">
                        <span className="font-semibold text-slate-950 block">{record.businessName}</span>
                        <span className="text-xs text-slate-500 block">{record.owner}</span>
                      </td>
                      <td className="p-3 text-sm text-slate-600">{record.address}{anyRec.barangay ? `, ${anyRec.barangay}` : ""}</td>
                      <td className="p-3 text-slate-600">{anyRec.businessType || anyRec.type || "N/A"}</td>
                      <td className="p-3 text-slate-600">{record.natureOfBusiness}</td>
                      <td className="p-3 text-slate-600">{record.grossSales.toLocaleString()}</td>
                      <td className="p-3 text-slate-600">{(anyRec.capitalInvestment || anyRec.capital || 0).toLocaleString()}</td>
                      <td className="p-3 text-slate-600">{anyRec.paymentMethod || "Cash"}</td>
                      <td className="p-3 font-mono text-xs text-slate-600">{anyRec.receiptNo || "N/A"}</td>
                      <td className="p-3 font-bold text-emerald-700">₱{record.totalDue.toLocaleString()}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700 border border-slate-200 font-semibold inline-block text-center">
                          {record.status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {record.status !== "Completed" && (
                          <button 
                            type="button" 
                            onClick={() => onAdvance(record.id)} 
                            className="bg-white hover:bg-slate-50 text-amber-600 border border-slate-300 px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer shadow-xs"
                          >
                            Advance
                          </button>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <button 
                          type="button"
                          onClick={() => handleEditClick(record)} 
                          className={`border px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer shadow-xs ${
                            editingId === record.id 
                              ? "bg-amber-600 text-white border-amber-600" 
                              : "bg-white hover:bg-slate-50 text-blue-600 border-slate-300"
                          }`}
                        >
                          {editingId === record.id ? "Editing..." : "Edit"}
                        </button>
                      </td>
                      <td className="p-3 text-center">
                        <button 
                          type="button"
                          onClick={() => onDelete(record.id)} 
                          className="bg-white hover:bg-slate-50 text-rose-600 border border-slate-300 px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer shadow-xs"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

