export function statusClass(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "paid" || normalized === "approved" || normalized === "completed" || normalized === "ready for release") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (normalized === "rejected" || normalized === "failed" || normalized === "overdue") {
    return "bg-rose-50 text-rose-700 border-rose-200";
  }
  if (normalized === "for compliance" || normalized === "unpaid" || normalized === "partially paid") {
    return "bg-amber-50 text-amber-800 border-amber-200";
  }
  return "bg-blue-50 text-blue-700 border-blue-200";
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-sm text-slate-500">Not available</span>;
  return <span className={"inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold " + statusClass(status)}>{status}</span>;
}
