import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import systemLogo from '../assets/logo-system.png';

const features = [
    { iconClass: 'fa-solid fa-file-invoice', title: 'Real Property Tax', description: 'Manage property tax payments', tint: 'violet' },
    { iconClass: 'fa-solid fa-building', title: 'Business Tax', description: 'Manage business tax payments', tint: 'emerald' },
    { iconClass: 'fa-solid fa-house', title: 'Market Stall Rental', description: 'Managing rental for market stall and hawker associations', tint: 'rose' },
] as const;

const TINT: Record<string, string> = {
    violet: 'bg-violet-50 text-violet-500',
    emerald: 'bg-emerald-50 text-emerald-500',
    rose: 'bg-rose-50 text-rose-500',
};

const stats = [
    { value: '100%', label: 'Digital Process' },
    { value: '24/7', label: 'System Access' },
    { value: '3', label: 'Services' },
    { value: 'Real-time', label: 'Updates' },
];

const TYPEWRITER_WORDS = ['Real Property Tax', 'Business Tax', 'Market Stall Rental'];

function useTypewriter(words: string[], typingMs = 90, pauseMs = 1400, deletingMs = 45) {
    const [wordIndex, setWordIndex] = useState(0);
    const [text, setText] = useState('');
    const [phase, setPhase] = useState<'typing' | 'pausing' | 'deleting'>('typing');

    useEffect(() => {
        const current = words[wordIndex];
        if (phase === 'typing') {
            if (text.length < current.length) {
                const t = setTimeout(() => setText(current.slice(0, text.length + 1)), typingMs);
                return () => clearTimeout(t);
            }
            const t = setTimeout(() => setPhase('pausing'), pauseMs);
            return () => clearTimeout(t);
        }
        if (phase === 'pausing') {
            const t = setTimeout(() => setPhase('deleting'), pauseMs);
            return () => clearTimeout(t);
        }
        if (text.length > 0) {
            const t = setTimeout(() => setText(current.slice(0, text.length - 1)), deletingMs);
            return () => clearTimeout(t);
        }
        setWordIndex((i) => (i + 1) % words.length);
        setPhase('typing');
    }, [text, phase, wordIndex, words, typingMs, pauseMs, deletingMs]);

    return text;
}

export function LandingPage() {
    const typewriterText = useTypewriter(TYPEWRITER_WORDS);
    const navigate = useNavigate();

    return (
        <div className="relative min-h-screen overflow-x-hidden bg-white font-sans">
            <div
                className="pointer-events-none absolute inset-0 -z-20 opacity-[0.03]"
                style={{
                    backgroundImage:
                        'linear-gradient(to right, #0f172a 1px, transparent 1px), linear-gradient(to bottom, #0f172a 1px, transparent 1px)',
                    backgroundSize: '48px 48px',
                    maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)',
                    WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)',
                }}
            />

            <header className="max-w-6xl mx-auto px-4 py-6">
                <nav className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <img
                            src={systemLogo}
                            alt="System Logo"
                            className="h-10 w-10 md:h-12 md:w-12 object-contain shrink-0"
                        />
                        <span className="text-sm md:text-base font-extrabold whitespace-nowrap text-slate-900 tracking-tight">
                            Revenue Collection & <br className="md:hidden" /> Treasury Services
                        </span>
                    </div>
                </nav>
            </header>

            <section className="max-w-6xl mx-auto px-4 pt-16 pb-20 text-center">
                <div className="mx-auto max-w-3xl">
                    <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl md:text-6xl tracking-tight text-slate-900">
                        <span className="block mb-1">Revenue Collection &</span>
                        <span className="mt-2 flex flex-wrap items-center justify-center gap-x-2 text-blue-600 min-h-[1.2em] sm:min-h-0">
                            <span>{typewriterText}</span>
                            <span className="inline-block h-[0.85em] w-1 bg-blue-600/80 animate-pulse ml-0.5" aria-hidden="true" />
                        </span>
                        <span className="block mt-1">Treasury Services</span>
                    </h1>

                    <p className="mx-auto mt-6 max-w-xl text-base text-slate-500 sm:text-sm font-medium">
                        A comprehensive digital platform for managing real property tax assessments, business tax payments, and market stall rentals.
                    </p>

                    <button
                        onClick={() => navigate('/dashboard')}
                        className="mt-10 inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full cursor-pointer bg-blue-600 text-white text-sm font-semibold shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-all"
                    >
                        Access the Portal
                        <i className="fa-solid fa-arrow-right text-[14px]"></i>
                    </button>
                </div>

                <div className="mt-20 flex flex-wrap justify-center gap-6 max-w-[900px] mx-auto text-left">
                    {features.map((f) => (
                        <div
                            key={f.title}
                            className="w-full sm:w-[calc(50%-0.75rem)] md:w-[calc(33.333%-1rem)] rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
                        >
                            <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${TINT[f.tint]}`}>
                                <i className={`${f.iconClass} text-[18px]`}></i>
                            </div>
                            <h3 className="text-sm font-bold text-slate-900">{f.title}</h3>
                            <p className="mt-1.5 text-xs text-slate-500 font-medium leading-relaxed">{f.description}</p>
                        </div>
                    ))}
                </div>

                <div className="mt-12 max-w-[900px] mx-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
                    <div className="grid grid-cols-2 gap-y-8 p-8 md:grid-cols-4 md:py-10">
                        {stats.map((stat) => (
                            <div key={stat.label} className="flex flex-col items-center justify-center gap-1.5">
                                <p className="text-4xl md:text-[42px] font-black text-blue-500 tracking-tight">
                                    {stat.value}
                                </p>
                                <p className="text-xs font-medium text-slate-500 capitalize">{stat.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <footer className="border-t border-slate-100 bg-white">
                <div className="max-w-6xl mx-auto px-4 py-8 text-center">
                    <p className="text-xs font-medium text-slate-400">
                        © 2026 Revenue Collection & Treasury Services. Secure Government Platform.
                    </p>
                </div>
            </footer>
        </div>
    );
}

export default LandingPage;