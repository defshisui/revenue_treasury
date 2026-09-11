import { useState, useEffect } from 'react';

// 3 capability cards
// Layout: row 1 = 3 cards
const features = [
    { iconClass: 'fa-solid fa-file-invoice', title: 'Real Property Tax', description: 'Manage property tax payments', tint: 'violet' },
    { iconClass: 'fa-solid fa-building', title: 'Business Tax', description: 'Manage business tax payments', tint: 'emerald' },
    { iconClass: 'fa-solid fa-house', title: 'Market Stall Rental', description: 'Managing rental for market stall and hawker associations', tint: 'rose' },
] as const;

const TINT: Record<string, string> = {
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
};

const stats = [
    { value: '100%', label: 'Digital Process' },
    { value: '24/7', label: 'System Access' },
    { value: '5', label: 'Programs' },
    { value: 'Real-time', label: 'Updates' },
];

const TYPEWRITER_WORDS = ['Real Property Tax', 'Business Tax', 'Market Stall Rental', 'Livelihood', 'Financial Aid'];

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

// Scattered decorative icons — purely atmospheric, low-opacity.
const FLOATING = [
    { iconClass: 'fa-solid fa-house', top: '10%', left: '5%', color: 'text-emerald-500/20', size: 'text-[26px]', delay: '0s' },
    { iconClass: 'fa-solid fa-file-invoice', top: '78%', left: '92%', color: 'text-sky-500/20', size: 'text-[20px]', delay: '-2s' },
    { iconClass: 'fa-solid fa-building', top: '58%', left: '4%', color: 'text-primary/10', size: 'text-[18px]', delay: '-3s' },
];

export function LandingPage() {
    const typewriterText = useTypewriter(TYPEWRITER_WORDS);

    return (
        <div className="relative min-h-screen overflow-x-hidden bg-background">
            {/* Grid pattern overlay */}
            <div
                className="pointer-events-none absolute inset-0 -z-20 opacity-[0.035]"
                style={{
                    backgroundImage:
                        'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
                    backgroundSize: '48px 48px',
                    maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)',
                    WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)',
                }}
            />

            {/* Animated gradient background */}
            <div className="absolute inset-0 -z-10">
                <div className="absolute top-0 left-1/4 h-80 w-80 rounded-full bg-primary/10 blur-3xl animate-float" />
                <div className="absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl animate-float" style={{ animationDelay: '-3s' }} />
            </div>

            {/* Floating decorative icons */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
                {FLOATING.map(({ iconClass, top, left, color, size, delay }, i) => (
                    <div key={i} className={`absolute ${color} animate-float`} style={{ top, left, animationDelay: delay }}>
                        <i className={`${iconClass} ${size}`} />
                    </div>
                ))}
            </div>

            {/* Top navigation */}
            <header className="max-w-6xl mx-auto px-4 py-4">
                <nav className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <img
                            src="/samples/Government Service Integrity Seal.png"
                            alt="Government Seal"
                            className="h-8 w-8 md:h-9 md:w-9 object-contain shrink-0"
                        />
                        <span className="font-heading text-xs md:text-base font-bold whitespace-nowrap">
                            Revenue Collection & <br className="md:hidden" /> Treasury Services
                        </span>
                    </div>
                </nav>
            </header>

            {/* Hero */}
            <section className="max-w-6xl mx-auto px-4 pt-10 pb-16 text-center">
                <div className="mx-auto max-w-2xl">
                    <h1 className="font-heading text-3xl font-bold leading-tight sm:text-4xl md:text-5xl lg:text-6xl">
                        <span className="block">Revenue Collection &</span>
                        <span
                            className="mt-1 flex flex-wrap items-center justify-center gap-x-1 bg-linear-to-r from-primary to-primary/60 bg-clip-text text-transparent min-h-[1.15em] sm:min-h-0"
                        >
                            <span>{typewriterText}</span>
                            <span className="inline-block h-[0.85em] w-0.75 bg-primary/70 animate-pulse" aria-hidden="true" />
                        </span>
                        <span className="block">Treasury Services</span>
                    </h1>

                    <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
                        A comprehensive digital platform for managing real property tax assessments, business tax payments, and market stall rentals.
                    </p>

                    <button
                        onClick={() => window.location.href = '/login'}
                        className="mt-8 inline-flex items-center justify-center gap-2 h-13 px-7 rounded-2xl cursor-pointer bg-primary text-primary-foreground text-sm font-medium shadow-lg shadow-primary/30 hover:opacity-90 transition-opacity"
                    >
                        Access the Portal
                        <i className="fa-solid fa-arrow-right text-[18px]"></i>
                    </button>
                </div>

                {/* Feature grid */}
                <div className="mt-14 flex flex-wrap justify-center gap-4 max-w-4xl mx-auto text-left">
                    {features.map((f) => (
                        <div
                            key={f.title}
                            className="group relative w-full overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-5 transition-all hover:-translate-y-1 hover:shadow-medium sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.6667rem)]"
                        >
                            <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className={`relative mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${TINT[f.tint]}`}>
                                <i className={`${f.iconClass} text-[20px]`}></i>
                            </div>
                            <h3 className="relative text-sm font-semibold sm:text-base">{f.title}</h3>
                            <p className="relative mt-1 text-xs text-muted-foreground sm:text-sm">{f.description}</p>
                        </div>
                    ))}
                </div>

                {/* Stats */}
                <div className="mt-14 max-w-3xl mx-auto rounded-2xl border border-border/60 bg-card/60 shadow-soft">
                    <div className="grid grid-cols-2 gap-x-2 gap-y-6 p-6 md:grid-cols-4 md:gap-x-6 md:py-8">
                        {stats.map((stat) => (
                            <div key={stat.label} className="flex flex-col items-center justify-center gap-1">
                                <p className="whitespace-nowrap text-2xl font-bold leading-none bg-linear-to-br from-primary to-primary/60 bg-clip-text text-transparent sm:text-3xl md:text-4xl">
                                    {stat.value}
                                </p>
                                <p className="text-xs text-muted-foreground sm:text-sm">{stat.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-border">
                <div className="max-w-6xl mx-auto px-4 py-6 text-center">
                    <p className="text-xs text-muted-foreground">
                        © 2026 Revenue Collection & Treasury Services. Secure Government Platform.
                    </p>
                </div>
            </footer>
        </div>
    );
}

export default LandingPage;