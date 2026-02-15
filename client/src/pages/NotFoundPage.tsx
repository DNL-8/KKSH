import { Link } from "react-router-dom";
import { Icon } from "../components/common/Icon";

export function NotFoundPage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#020203] px-6 text-center">
            {/* Glitch effect container */}
            <div className="relative mb-8">
                <Icon
                    name="ghost"
                    className="text-[hsl(var(--accent))] opacity-80 animate-pulse text-[96px]"
                    aria-hidden="true"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-4xl font-black text-white/10">404</span>
                </div>
            </div>

            {/* Title */}
            <h1 className="mb-3 text-3xl font-black uppercase tracking-[0.25em] text-[hsl(var(--accent))]">
                Portal Corrompido
            </h1>

            {/* Description */}
            <p className="mb-2 max-w-md text-sm font-medium uppercase tracking-wider text-slate-400">
                As coordenadas desta dimensão não foram encontradas no sistema.
            </p>
            <p className="mb-10 text-xs font-medium uppercase tracking-widest text-slate-600">
                Código de Erro: 404 — Rota Inexistente
            </p>

            {/* Action buttons */}
            <div className="flex flex-col items-center gap-4 sm:flex-row">
                <Link
                    to="/hub"
                    className="group flex items-center gap-3 rounded-2xl border border-[hsl(var(--accent))]/30 bg-[hsl(var(--accent))]/10 px-6 py-3 text-sm font-bold uppercase tracking-widest text-[hsl(var(--accent))] shadow-lg shadow-[hsl(var(--accent))]/5 transition-all hover:border-[hsl(var(--accent))]/60 hover:bg-[hsl(var(--accent))]/20 hover:shadow-[hsl(var(--accent))]/20"
                >
                    <Icon name="home" className="transition-transform group-hover:scale-110 text-[16px]" />
                    Voltar ao Hub
                </Link>
                <Link
                    to="/combate"
                    className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 px-6 py-3 text-sm font-bold uppercase tracking-widest text-slate-400 transition-all hover:border-slate-700 hover:text-slate-200"
                >
                    <Icon name="compass" className="text-[16px]" />
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
