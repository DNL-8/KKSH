import { Link } from "react-router-dom";
import { Icon } from "../components/common/Icon";

export function NotFoundPage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#020204] px-6 text-center overflow-hidden">
            {/* Background elements */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(var(--glow),0.15),transparent_70%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] opacity-30 mix-blend-overlay" />
            {/* Glitch effect container */}
            <div className="relative mb-10 z-10">
                <Icon
                    name="ghost"
                    className="text-[hsl(var(--accent))] opacity-10 animate-pulse text-[140px] drop-shadow-[0_0_20px_rgba(var(--glow),0.8)] filter blur-[2px]"
                    aria-hidden="true"
                />
                <div className="absolute inset-0 flex items-center justify-center mix-blend-screen mix-blend-overlay">
                    <span className="text-[120px] font-black text-slate-900/5 drop-shadow-[0_20px_50px_rgba(var(--glow),0.3)] tracking-tighter mix-blend-overlay">404</span>
                </div>
            </div>

            {/* Title */}
            <h1 className="mb-4 text-4xl font-black uppercase tracking-[0.3em] text-[hsl(var(--accent))] drop-shadow-[0_0_10px_rgba(var(--glow),0.6)] z-10">
                Portal Corrompido
            </h1>

            {/* Description */}
            <p className="mb-3 max-w-md text-[13px] font-medium uppercase tracking-wider text-slate-600 z-10">
                As coordenadas desta dimensão não foram encontradas no sistema.
            </p>
            <p className="mb-12 text-[10px] font-bold uppercase tracking-[0.2em] text-[hsl(var(--accent)/0.6)] bg-[hsl(var(--accent)/0.05)] border border-[hsl(var(--accent)/0.1)] px-4 py-2 rounded-lg backdrop-blur-sm z-10 shadow-[0_0_15px_rgba(var(--glow),0.1)]">
                Código de Erro: 404 — Rota Inexistente
            </p>

            {/* Action buttons */}
            <div className="flex flex-col items-center gap-5 sm:flex-row z-10">
                <Link
                    to="/hub"
                    className="group flex items-center gap-3 rounded-2xl border border-[hsl(var(--accent))]/40 bg-[hsl(var(--accent))]/10 px-8 py-4 text-xs font-black uppercase tracking-widest text-[hsl(var(--accent))] shadow-[0_0_20px_rgba(var(--glow),0.2)] transition-all hover:border-[hsl(var(--accent))]/80 hover:bg-[hsl(var(--accent))]/20 hover:shadow-[0_0_30px_rgba(var(--glow),0.4)] hover:-translate-y-1 active:scale-95 backdrop-blur-md"
                >
                    <Icon name="home" className="transition-transform group-hover:scale-110 text-[18px]" />
                    Voltar ao Hub
                </Link>
                <Link
                    to="/combate"
                    className="flex items-center gap-3 rounded-2xl border border-slate-300/50 bg-white/[0.03] px-8 py-4 text-xs font-bold uppercase tracking-widest text-slate-800 shadow-xl transition-all hover:border-slate-300/50 hover:bg-white/[0.08] hover:text-slate-900 hover:-translate-y-1 active:scale-95 backdrop-blur-md"
                >
                    <Icon name="compass" className="text-[18px]" />
                    Zona de Combate
                </Link>
            </div>

            {/* Background decoration */}
            <div
                className="not-found-grid-bg pointer-events-none fixed inset-0 -z-10 opacity-[0.03]"
                aria-hidden="true"
            />
        </div>
    );
}
