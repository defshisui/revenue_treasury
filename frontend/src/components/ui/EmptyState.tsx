import type { ReactNode } from "react";
import { Panel } from "./Panel";

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <Panel className="p-10 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-lg text-slate-500">○</div>
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </Panel>
  );
}
