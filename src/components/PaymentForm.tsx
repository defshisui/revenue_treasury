import React from "react";
import type { Dispatch, SetStateAction, FormEvent } from "react";
import type { TransactionRecord } from "../types/treasury";

export interface PaymentForm {
  payer: string;
  type: "Real Property Tax" | "Business Tax" | "Market Rental" | "Other Fees";
  amount: number;
  method: "Cash" | "Bank Transfer" | "Check" | "Digital Wallet";
  refNo: string;
  remarks: string;
}

export interface PaymentsViewProps {
  transactions: TransactionRecord[];
  form: PaymentForm;
  setForm: Dispatch<SetStateAction<PaymentForm>>;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  notify: (msg: string) => void;
  isCollapsed?: boolean;
}

const PaymentsView: React.FC<PaymentsViewProps> = ({
  transactions,
  form,
  setForm,
  onSubmit,
  searchQuery,
  setSearchQuery,
  notify,
  isCollapsed,
}) => {
  const filteredTransactions = transactions.filter((tx) => {
    const query = searchQuery.toLowerCase();
    return (
      tx.taxpayer?.toLowerCase().includes(query) ||
      tx.referenceNumber?.toLowerCase().includes(query) ||
      tx.paymentType?.toLowerCase().includes(query)
    );
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
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold dark:text-white">Payment Collection</h1>
            <p className="text-sm text-slate-500 dark:text-white">Record and manage treasury transactions and official receipts.</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search payments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-4 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 dark:text-slate-100 placeholder-slate-400"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Post New Payment</h2>
          <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Payer Name</label>
              <input
                type="text"
                required
                value={form.payer}
                onChange={(e) => setForm({ ...form, payer: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Full name or business"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Payment Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as PaymentForm["type"] })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Real Property Tax">Real Property Tax</option>
                <option value="Business Tax">Business Tax</option>
                <option value="Market Rental">Market Rental</option>
                <option value="Other Fees">Other Fees</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Amount (₱)</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Payment Method</label>
              <select
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value as PaymentForm["method"] })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Check">Check</option>
                <option value="Digital Wallet">Digital Wallet</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Reference Number / OR No.</label>
              <input
                type="text"
                value={form.refNo}
                onChange={(e) => setForm({ ...form, refNo: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Optional reference"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Remarks</label>
              <input
                type="text"
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Additional notes"
              />
            </div>

            <div className="md:col-span-2 lg:col-span-3 flex justify-end mt-2">
              <button
                type="submit"
                onClick={() => notify("Payment posted successfully.")}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm cursor-pointer"
              >
                Post Payment
              </button>
            </div>
          </form>
        </div>

        {/* RECENT TRANSACTIONS TABLE SECTION */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white m-0">Recorded Payment History</h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">Total: {filteredTransactions.length} items</span>
          </div>

          {filteredTransactions.length === 0 ? (
            <p className="text-slate-400 dark:text-slate-500 text-[13px] italic text-center p-8 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl m-0">
              No matching transactions found.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-left text-[13px] border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-4">Reference</th>
                    <th className="py-3 px-4">Payer Name</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4">Collector</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((transaction) => (
                    <tr key={transaction.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                      <td className="py-3 px-4 font-mono font-semibold text-blue-600 dark:text-blue-400">{transaction.referenceNumber}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{transaction.taxpayer}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{transaction.paymentType}</td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-700 dark:text-emerald-400">
                        ₱{transaction.amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{transaction.paymentMethod}</td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">{transaction.collector}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="py-0.5 px-2 rounded-md text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          {transaction.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentsView;