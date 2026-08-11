import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import type { StallRecord } from "../types/treasury";

interface Props {
  records: StallRecord[];
  isCollapsed?: boolean;
}

export default function MarketStallsView({ records: initialRecords = [], isCollapsed = false }: Props) {
  // --- Local State for Records (Initialized from Props) ---
  const [recordsList, setRecordsList] = useState<StallRecord[]>(initialRecords);

  // --- Form State ---
  const [formData, setFormData] = useState({
    vendorName: "",
    vendorAddress: "",
    contactNumber: "",
    tinOrId: "",
    stallNumber: "",
    marketBranch: "",
    marketSection: "",
    billingCycle: "",
    paymentMode: "",
    receiptNo: "",
    rentalRate: "",
    penaltyRate: "",
    currentBalance: 0,
  });

  // --- Search & Filter State ---
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  // --- Input Change Handler ---
  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    
    if (name === "contactNumber") {
      const numericValue = value.replace(/\D/g, "").slice(0, 11);
      setFormData((prev) => ({ ...prev, [name]: numericValue }));
      return;
    }

    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      
      // Auto-calculate balance preview
      const rent = parseFloat(name === "rentalRate" ? value : updated.rentalRate) || 0;
      const penaltyStr = name === "penaltyRate" ? value : updated.penaltyRate;
      const penaltyPercent = parseInt(penaltyStr.replace("%", "")) || 0;
      const penaltyAmount = rent * (penaltyPercent / 100);
      const total = rent + penaltyAmount;

      return {
        ...updated,
        currentBalance: total,
      };
    });
  };

  // --- Assessment Computation & Record Creation ---
  const handleCompute = (e: FormEvent) => {
    e.preventDefault();

    const rent = parseFloat(formData.rentalRate) || 0;
    const penaltyPercent = parseInt(formData.penaltyRate.replace("%", "")) || 0;
    const penaltyAmount = rent * (penaltyPercent / 100);
    const total = rent + penaltyAmount;

    // Handle Receipt Number: Auto-generate if Cash, otherwise use provided input
    const finalReceiptNo =
      formData.paymentMode === "Cash" && !formData.receiptNo
        ? `OR-2026-${Math.floor(100000 + Math.random() * 900000)}`
        : formData.receiptNo;

    const isOverdue = penaltyAmount > 0;
    const newRecord = {
      id: Date.now().toString(),
      stallNumber: formData.stallNumber || `STL-${Math.floor(100 + Math.random() * 900)}`,
      location: formData.vendorAddress || "Main Market",
      marketSection: `${formData.marketSection} (${formData.marketBranch})`,
      rentalRate: rent,
      assignedVendorId: `vendor-${Date.now()}`,
      vendorName: formData.vendorName || "N/A",
      billingMonth: new Date().toISOString().slice(0, 7),
      rentalAmount: rent,
      previousBalance: 0,
      penalty: penaltyAmount,
      currentBalance: total,
      paymentHistory: [],
      overdueStatus: isOverdue,
      status: isOverdue ? "Overdue" : "Unpaid",
      receiptNo: finalReceiptNo,
      paymentMode: formData.paymentMode,
      contactNumber: formData.contactNumber,
      tinOrId: formData.tinOrId,
      billingCycle: formData.billingCycle,
    } as unknown as StallRecord;

    setRecordsList([newRecord, ...recordsList]);

    setFormData({
      vendorName: "",
      vendorAddress: "",
      contactNumber: "",
      tinOrId: "",
      stallNumber: "",
      marketBranch: "",
      marketSection: "",
      billingCycle: "",
      paymentMode: "",
      receiptNo: "",
      rentalRate: "",
      penaltyRate: "",
      currentBalance: 0,
    });
  };

  // --- Filtered Data ---
  const filteredRecords = recordsList.filter((rec) => {
    const anyRec = rec as any;
    const matchesSearch =
      rec.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.stallNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.marketSection.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (anyRec.receiptNo && String(anyRec.receiptNo).toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus =
      statusFilter === "All" ||
      (rec.status as string).toLowerCase() === statusFilter.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });

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
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Market Stall Management
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Revenue Collection & Treasury Stallholder Billing Ledger
          </p>
        </div>
        <span className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 shadow-xs">
          {recordsList.length === 0
            ? "No records loaded"
            : `${recordsList.length} Active Records`}
        </span>
      </div>

      {/* SECTION 1: Assessment / Billing Form */}
      <section className="dark:bg-slate-800 rounded-2xl border-slate-200 p-6 shadow-sm">
        <h3 className="text-base font-bold text-slate-900 mb-5 dark:text-white">
          Create New Property / Market Stall Assessment
        </h3>

        <form onSubmit={handleCompute}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Row 1 */}
            <div>
              <input
                type="text"
                name="vendorName"
                placeholder="Vendor Full Name"
                required
                value={formData.vendorName}
                onChange={handleInputChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <input
                type="text"
                name="vendorAddress"
                placeholder="Vendor Address / Barangay"
                required
                value={formData.vendorAddress}
                onChange={handleInputChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <input
                type="text"
                name="contactNumber"
                placeholder="Contact Number (09XXXXXXXXX)"
                required
                maxLength={11}
                value={formData.contactNumber}
                onChange={handleInputChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <input
                type="text"
                name="stallNumber"
                placeholder="Stall No. (e.g. MT-0102)"
                required
                value={formData.stallNumber}
                onChange={handleInputChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            {/* Row 2 */}
            <div>
              <input
                type="text"
                name="tinOrId"
                placeholder="TIN / Valid Govt ID"
                required
                value={formData.tinOrId}
                onChange={handleInputChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <select
                name="marketBranch"
                required
                value={formData.marketBranch}
                onChange={handleInputChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="" disabled>
                  Select Market Branch
                </option>
                <option value="Central Public Market">Central Public Market</option>
                <option value="North Plaza Talipapa">North Plaza Talipapa</option>
                <option value="Southside Night Market">Southside Night Market</option>
              </select>
            </div>

            <div>
              <select
                name="marketSection"
                required
                value={formData.marketSection}
                onChange={handleInputChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="" disabled>
                  Select Market Section
                </option>
                <option value="Meat & Poultry Section">Meat & Poultry</option>
                <option value="Fish & Seafood Section">Fish & Seafood</option>
                <option value="Vegetables & Fruits">Vegetables & Fruits</option>
                <option value="Dry Goods Section">Dry Goods</option>
                <option value="Eatery / Food Stalls">Eatery / Food Stalls</option>
              </select>
            </div>

            <div>
              <select
                name="billingCycle"
                required
                value={formData.billingCycle}
                onChange={handleInputChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="" disabled>
                  Select Billing Cycle
                </option>
                <option value="Monthly Rent">Monthly Rent</option>
                <option value="Annual Payment">Annual Payment</option>
              </select>
            </div>

            {/* Row 3 */}
            <div>
              <select
                name="paymentMode"
                required
                value={formData.paymentMode}
                onChange={handleInputChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="" disabled>
                  Select Payment Method
                </option>
                <option value="Cash">Cash</option>
                <option value="GCash">GCash / e-Wallet</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Over-the-Counter">Over-the-Counter</option>
              </select>
            </div>

            <div>
              <input
                type="text"
                name="receiptNo"
                placeholder={
                  formData.paymentMode === "Cash"
                    ? "Receipt No. (Auto-generated)"
                    : "Enter Reference / Receipt No."
                }
                required={formData.paymentMode !== "Cash"}
                disabled={formData.paymentMode === "Cash"}
                value={formData.receiptNo}
                onChange={handleInputChange}
                className={`w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-mono outline-none focus:border-blue-500 ${
                  formData.paymentMode === "Cash" ? "bg-slate-100 opacity-60 cursor-not-allowed" : ""
                }`}
              />
            </div>

            <div>
              <input
                type="number"
                name="rentalRate"
                placeholder="Base Rental Rate (₱)"
                required
                value={formData.rentalRate}
                onChange={handleInputChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <select
                name="penaltyRate"
                required
                value={formData.penaltyRate}
                onChange={handleInputChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="" disabled>
                  Select Penalty / Surcharge Rate
                </option>
                <option value="0%">0% Surcharge</option>
                <option value="10%">10% Surcharge</option>
                <option value="20%">20% Penalty (Overdue)</option>
              </select>
            </div>

            {/* Row 4 */}
            <div className="sm:col-span-2 lg:col-span-1">
              <input
                type="text"
                readOnly
                placeholder="Total Assessment Balance"
                value={
                  formData.currentBalance > 0
                    ? `₱ ${formData.currentBalance.toLocaleString("en-PH", {
                        minimumFractionDigits: 2,
                      })}`
                    : ""
                }
                className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 cursor-not-allowed font-semibold placeholder:font-normal placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Action Button */}
          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              className="bg-amber-500 hover:bg-amber-400 text-white font-bold px-8 py-2.5 rounded-lg text-sm transition-colors shadow-sm cursor-pointer"
            >
              Compute & Save
            </button>
          </div>
        </form>
      </section>

      {/* SECTION 2: Stall Tenant Billing Ledger Table */}
      <section className="dark:bg-slate-800 border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-lg font-bold dark-text-white">
            Stall Tenant Billing Ledger
          </h3>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <input
                type="text"
                placeholder="Search vendor, stall, or receipt..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="All">All Status</option>
              <option value="Paid">Paid</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Overdue">Overdue</option>
            </select>
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <p className="text-slate-400 text-sm italic py-6 text-center border border-dashed border-slate-200 rounded-xl">
            No records available. Connect your LGU data source or submit an assessment above.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Stall No. & Section</th>
                  <th className="p-3.5">Vendor Name</th>
                  <th className="p-3.5">Receipt No.</th>
                  <th className="p-3.5 text-right">Monthly Rental</th>
                  <th className="p-3.5 text-right">Penalty</th>
                  <th className="p-3.5 text-right">Current Balance</th>
                  <th className="p-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredRecords.map((record) => {
                  const anyRec = record as any;
                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="p-3.5 font-mono font-semibold text-slate-900">
                        {record.stallNumber}
                        <br />
                        <span className="text-xs text-slate-500 font-normal">
                          {record.marketSection}
                        </span>
                      </td>
                      <td className="p-3.5 font-semibold text-slate-900">
                        {record.vendorName}
                      </td>
                      <td className="p-3.5 font-mono text-xs text-slate-600">
                        {anyRec.receiptNo || "—"}
                      </td>
                      <td className="p-3.5 text-right font-medium text-slate-700">
                        ₱{record.rentalRate.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3.5 text-right font-medium text-rose-600">
                        {record.penalty > 0
                          ? `₱${record.penalty.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
                          : "—"}
                      </td>
                      <td className="p-3.5 text-right font-bold text-emerald-700">
                        ₱{record.currentBalance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${
                            record.overdueStatus || (record.status as string) === "Overdue"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : (record.status as string) === "Paid" || (record.status as string) === "Current"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}