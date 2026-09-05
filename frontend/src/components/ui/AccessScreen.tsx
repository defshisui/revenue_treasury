import { Panel } from "./Panel";

export function AccessScreen({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6 font-sans">
      <Panel className="w-full max-w-lg p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-blue-700">▣</div>
        <h1 className="text-xl font-extrabold text-slate-900">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
        <a href="/" className="mt-6 inline-flex rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800">Back to sign in</a>
      </Panel>
    </main>
  );
}
