import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

type PaymentMethod = "gcash" | "card";

type FeeCategory = "environmental" | "sanitation" | "building" | "other";

interface RegulatoryFeesData {
  businessName: string;
  ownerName: string;
  feeCategory: FeeCategory | "";
  permitNumber: string;
  feeDescription: string;
  assessedAmount: string;
  penalty: string;
  paymentMethod: PaymentMethod | "";
  dueDate: string;
}

interface RegulatoryFeesRecord extends RegulatoryFeesData {
  id: number;
  totalDue: string;
}

export default function RegulatoryFeesForm() {
  const [formData, setFormData] = useState<RegulatoryFeesData>({
    businessName: "",
    ownerName: "",
    feeCategory: "",
    permitNumber: "",
    feeDescription: "",
    assessedAmount: "",
    penalty: "0",
    paymentMethod: "",
    dueDate: "",
  });

  const [records, setRecords] = useState<RegulatoryFeesRecord[]>([]);

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function calculateTotalDue() {
    const assessedAmount = Number(formData.assessedAmount || 0);
    const penalty = Number(formData.penalty || 0);
    return assessedAmount + penalty;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const totalDue = calculateTotalDue();

    const newRecord: RegulatoryFeesRecord = {
      ...formData,
      id: Date.now(),
      totalDue: totalDue.toFixed(2),
    };

    setRecords((current) => [newRecord, ...current]);
    setFormData({
      businessName: "",
      ownerName: "",
      feeCategory: "",
      permitNumber: "",
      feeDescription: "",
      assessedAmount: "",
      penalty: "0",
      paymentMethod: "",
      dueDate: "",
    });
  }

  function handleGenerateTotal() {
    const totalDue = calculateTotalDue();
    window.alert(`Total Regulatory Fee Due: ₱${totalDue.toFixed(2)}`);
  }

  return (
    <main className="payment-form-main">
      <section className="rounded-3xl border-l-8 border-blue-900 bg-white p-6 shadow-lg md:p-10">
        <h2 className="mb-6 text-xl font-extrabold uppercase tracking-wide text-blue-900">
          Regulatory Fees Payment Portal
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <input
              type="text"
              name="businessName"
              value={formData.businessName}
              onChange={handleChange}
              placeholder="Business Name"
              required
              className="payment-form-item"
            />

            <input
              type="text"
              name="ownerName"
              value={formData.ownerName}
              onChange={handleChange}
              placeholder="Owner Name"
              required
              className="payment-form-item"
            />

            <select
              name="feeCategory"
              value={formData.feeCategory}
              onChange={handleChange}
              required
              className="payment-form-item"
            >
              <option value="" disabled>
                Select Fee Category
              </option>
              <option value="environmental">Environmental Fee</option>
              <option value="sanitation">Sanitation Fee</option>
              <option value="building">Building Permit Fee</option>
              <option value="other">Other Regulatory Fee</option>
            </select>

            <input
              type="text"
              name="permitNumber"
              value={formData.permitNumber}
              onChange={handleChange}
              placeholder="Permit / License No."
              required
              className="payment-form-item"
            />

            <input
              type="text"
              name="feeDescription"
              value={formData.feeDescription}
              onChange={handleChange}
              placeholder="Fee Description"
              className="payment-form-item"
            />

            <input
              type="number"
              name="assessedAmount"
              value={formData.assessedAmount}
              onChange={handleChange}
              placeholder="Assessed Fee Amount"
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
              placeholder="Penalty (if any)"
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
            </select>

            <input
              type="date"
              name="dueDate"
              value={formData.dueDate}
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
              Record Fee Payment
            </button>

            <button
              type="button"
              onClick={handleGenerateTotal}
              className="rounded-xl bg-blue-50 px-6 py-4 font-bold text-blue-900 transition hover:bg-blue-100"
            >
              Calculate Total Due
            </button>
          </div>
        </form>
      </section>

      <section className="mt-8 rounded-3xl bg-white p-6 shadow-lg md:p-8">
        <h2 className="mb-5 text-xl font-extrabold text-blue-900">
          Regulatory Fee Records
        </h2>

        {records.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-blue-200 bg-slate-50 p-10 text-center text-lg text-slate-500">
            No regulatory fee records yet. Submit a payment to display entries here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-225 text-left">
              <thead>
                <tr className="border-b border-blue-100 text-blue-900">
                  <th className="p-3">Business</th>
                  <th className="p-3">Owner</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Permit No.</th>
                  <th className="p-3">Amount Due</th>
                  <th className="p-3">Payment Method</th>
                  <th className="p-3">Due Date</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} className="border-b border-slate-100">
                    <td className="p-3">{record.businessName}</td>
                    <td className="p-3">{record.ownerName}</td>
                    <td className="p-3">{record.feeCategory}</td>
                    <td className="p-3">{record.permitNumber}</td>
                    <td className="p-3">₱{record.totalDue}</td>
                    <td className="p-3 uppercase">{record.paymentMethod}</td>
                    <td className="p-3">{record.dueDate}</td>
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
