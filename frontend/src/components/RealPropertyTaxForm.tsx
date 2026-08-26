import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

type PaymentMethod = "gcash" | "card" | "cash";

interface RealPropertyFormData {
  ownerName: string;
  propertyId: string;
  parcelNumber: string;
  propertyAddress: string;
  landArea: string;
  propertyClass: string;
  assessedValue: string;
  taxRate: string;
  penalty: string;
  paymentMethod: PaymentMethod | "";
  paymentDate: string;
}

interface RealPropertyRecord extends RealPropertyFormData {
  id: number;
  dueAmount: string;
}

export default function RealPropertyTaxForm() {
  const [formData, setFormData] = useState<RealPropertyFormData>({
    ownerName: "",
    propertyId: "",
    parcelNumber: "",
    propertyAddress: "",
    landArea: "",
    propertyClass: "",
    assessedValue: "",
    taxRate: "1.0",
    penalty: "0",
    paymentMethod: "",
    paymentDate: "",
  });

  const [records, setRecords] = useState<RealPropertyRecord[]>([]);

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function calculateDueAmount() {
    const assessedValue = Number(formData.assessedValue || 0);
    const taxRate = Number(formData.taxRate || 0);
    const penalty = Number(formData.penalty || 0);
    const due = assessedValue * (taxRate / 100) + penalty;
    return due;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const dueAmount = calculateDueAmount();
    const newRecord: RealPropertyRecord = {
      ...formData,
      id: Date.now(),
      dueAmount: dueAmount.toFixed(2),
    };

    setRecords((current) => [newRecord, ...current]);

    setFormData({
      ownerName: "",
      propertyId: "",
      parcelNumber: "",
      propertyAddress: "",
      landArea: "",
      propertyClass: "",
      assessedValue: "",
      taxRate: "1.0",
      penalty: "0",
      paymentMethod: "",
      paymentDate: "",
    });
  }

  function handleGenerateAssessment() {
    const due = calculateDueAmount();
    window.alert(`Tax Due: ₱${due.toFixed(2)}`);
  }

  return (
    <main className="payment-form-main">
      <section className="rounded-3xl border-l-8 border-blue-900 bg-white p-6 shadow-lg md:p-10">
        <h2 className="mb-6 text-xl font-extrabold uppercase tracking-wide text-blue-900">
          Real Property Tax Assessment
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 blac">
            <input
              type="text"
              name="ownerName"
              value={formData.ownerName}
              onChange={handleChange}
              placeholder="Owner / Taxpayer Name"
              required
              className="payment-form-item"
            />

            <input
              type="text"
              name="propertyId"
              value={formData.propertyId}
              onChange={handleChange}
              placeholder="Property ID"
              required
              className="payment-form-item"
            />

            <input
              type="text"
              name="parcelNumber"
              value={formData.parcelNumber}
              onChange={handleChange}
              placeholder="Parcel Number"
              className="payment-form-item"
            />

            <input
              type="text"
              name="propertyAddress"
              value={formData.propertyAddress}
              onChange={handleChange}
              placeholder="Property Address"
              required
              className="payment-form-item"
            />

            <input
              type="text"
              name="landArea"
              value={formData.landArea}
              onChange={handleChange}
              placeholder="Land Area (sq.m.)"
              className="payment-form-item"
            />

            <input
              type="text"
              name="propertyClass"
              value={formData.propertyClass}
              onChange={handleChange}
              placeholder="Property Classification"
              className="payment-form-item"
            />

            <input
              type="number"
              name="assessedValue"
              value={formData.assessedValue}
              onChange={handleChange}
              placeholder="Assessed Value"
              min="0"
              step="0.01"
              required
              className="payment-form-item"
            />

            <input
              type="number"
              name="taxRate"
              value={formData.taxRate}
              onChange={handleChange}
              placeholder="Tax Rate (%)"
              min="0"
              step="0.01"
              required
              className="payment-form-item"
            />

            <input
              type="number"
              name="penalty"
              value={formData.penalty}
              onChange={handleChange}
              placeholder="Penalty (if applicable)"
              min="0"
              step="0.01"
              className="payment-form-item"
            />

            <select
              name="paymentMethod"
              value={formData.paymentMethod}
              onChange={handleChange}
              required
              className="payment-form-item"
            >
              <option value="" disabled>
                Select Payment Method
              </option>
              <option value="gcash">GCash</option>
              <option value="card">Credit/Debit Card</option>
              <option value="cash">Cash</option>
            </select>

            <input
              type="date"
              name="paymentDate"
              value={formData.paymentDate}
              onChange={handleChange}
              required
              className="payment-form-item"
            />
          </div>

          <div className="mt-6 flex flex-wrap gap-4">
            <button
              type="submit"
              className="rounded-xl bg-blue-800 px-6 py-4 font-bold text-white transition hover:bg-blue-900"
            >
              Submit Assessment
            </button>

            <button
              type="button"
              onClick={handleGenerateAssessment}
              className="rounded-xl bg-blue-50 px-6 py-4 font-bold text-blue-900 transition hover:bg-blue-100"
            >
              Generate Tax Due
            </button>
          </div>
        </form>
      </section>

      <section className="mt-8 rounded-3xl bg-white p-6 shadow-lg md:p-8">
        <h2 className="mb-5 text-xl font-extrabold text-blue-900">
          Assessment Records
        </h2>

        {records.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-blue-200 bg-slate-50 p-10 text-center text-lg text-slate-500">
            No property tax records yet. Submit a new assessment to view it here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-225 text-left">
              <thead>
                <tr className="border-b border-blue-100 text-blue-900">
                  <th className="p-3">Property ID</th>
                  <th className="p-3">Owner</th>
                  <th className="p-3">Address</th>
                  <th className="p-3">Assessed</th>
                  <th className="p-3">Tax Due</th>
                  <th className="p-3">Payment Method</th>
                  <th className="p-3">Payment Date</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} className="border-b border-slate-100">
                    <td className="p-3">{record.propertyId}</td>
                    <td className="p-3">{record.ownerName}</td>
                    <td className="p-3">{record.propertyAddress}</td>
                    <td className="p-3">₱{Number(record.assessedValue).toFixed(2)}</td>
                    <td className="p-3">₱{record.dueAmount}</td>
                    <td className="p-3 uppercase">{record.paymentMethod}</td>
                    <td className="p-3">{record.paymentDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
