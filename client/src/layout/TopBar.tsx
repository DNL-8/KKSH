import {
    Bell,
    ChevronRight,
    Droplets,
    Heart,
    LayoutDashboard,
    Menu,
    Star,
    User,
} from "lucide-react";
import { useMemo } from "react";
import { useLocation } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import { useAnimatedNumber } from "../hooks/useAnimatedNumber";
import { NAV_ITEMS } from "./Sidebar";

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

interface TopBarProps {
    onMobileMenuOpen: () => void;
}

export function TopBar({ onMobileMenuOpen }: TopBarProps) {
    const { globalStats, authUser, openAuthPanel } = useAuth();
    const location = useLocation();

    const activeNavItem = useMemo(
        () => NAV_ITEMS.find((item) => location.pathname === item.path) ?? NAV_ITEMS[0],
        [location.pathname],
    );

    const hpPercent = Math.max(0, Math.min(100, Math.round(globalStats.hp)));
    const manaPercent = Math.max(0, Math.min(100, Math.round(globalStats.mana)));
    const xpPercent = Math.max(0, Math.min(100, Math.round((globalStats.xp / globalStats.maxXp) * 100)));

    const animHp = useAnimatedNumber(hpPercent, 600);
    const animMana = useAnimatedNumber(manaPercent, 600);
    const animXp = useAnimatedNumber(xpPercent, 600);

    return (
        <header className="z-40 shrink-0 px-4 pb-0 pt-4 md:px-8">
            <div
                className="w-full rounded-[24px] border border-[hsl(var(--accent)/0.15)] bg-[linear-gradient(180deg,#040b24_0%,#030a1b_100%)] px-3 py-3 shadow-[0_20px_50px_rgba(2,12,40,0.45)] md:px-4"
                data-testid="top-command-panel"
            >
                <div className="flex flex-wrap items-center gap-3 lg:flex-nowrap">
                    <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[hsl(var(--accent)/0.2)] bg-[hsl(var(--accent)/0.1)] shadow-[0_0_20px_rgba(var(--glow),0.15)]">
                            <LayoutDashboard size={20} className="text-[hsl(var(--accent))]" />
                        </div>

                        <div className="min-w-0">
                            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-[hsl(var(--accent)/0.6)]">
                                <span>Sistema</span>
                                <ChevronRight size={11} className="text-[hsl(var(--accent)/0.3)]" />
                                <span>Uplink_on</span>
                            </div>
                            <h1
                                className="truncate text-[22px] font-black uppercase italic leading-tight tracking-[0.03em] text-white md:text-[32px]"
                                title={activeNavItem.label}
                            >
                                {activeNavItem.label}
                            </h1>
                        </div>
                    </div>

                    <div className="hidden h-14 w-px shrink-0 bg-[hsl(var(--accent)/0.15)] lg:block" />

                    <div className="flex min-w-[180px] flex-1 items-center gap-2 sm:min-w-[280px] sm:gap-3">
                        <div
                            className="flex h-[64px] w-[64px] shrink-0 flex-col items-center justify-center rounded-xl border border-[hsl(var(--accent)/0.2)] bg-slate-900/60 shadow-[inset_0_0_20px_rgba(148,163,184,0.15)]"
                            data-testid="top-level-card"
                        >
                            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400">Lvl</span>
                            <span className="text-3xl font-black leading-none text-white">{globalStats.level}</span>
                        </div>

                        <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                                <Heart size={12} className="shrink-0 text-red-500" />
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#020718]">
                                    <div className="h-full rounded-full bg-gradient-to-r from-red-700 via-red-500 to-red-400" style={{ width: `${hpPercent}%` }} />
                                </div>
                                <span className="w-8 text-right text-[10px] font-black text-red-300">{animHp}%</span>
                            </div>

                            <div className="flex items-center gap-2">
                                <Droplets size={12} className="shrink-0 text-blue-400" />
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#020718]">
                                    <div className="h-full rounded-full bg-gradient-to-r from-blue-700 via-blue-500 to-cyan-400" style={{ width: `${manaPercent}%` }} />
                                </div>
                                <span className="w-8 text-right text-[10px] font-black text-blue-300">{animMana}%</span>
                            </div>

                            <div className="flex items-center gap-2">
                                <Star size={12} className="shrink-0 text-yellow-400" />
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#020718]">
                                    <div className="h-full rounded-full bg-gradient-to-r from-yellow-700 via-yellow-500 to-amber-300" style={{ width: `${xpPercent}%` }} />
                                </div>
                                <span className="w-8 text-right text-[10px] font-black text-yellow-300">{animXp}%</span>
                            </div>
                        </div>
                    </div>

                    <div className="hidden h-14 w-px shrink-0 bg-[hsl(var(--accent)/0.15)] lg:block" />

                    <div className="ml-auto flex items-center gap-2">
                        <button
                            aria-label="Abrir menu de navegacao"
                            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[hsl(var(--accent)/0.2)] bg-[#09152b]/70 p-1 transition-all hover:border-[hsl(var(--accent)/0.5)] lg:hidden"
                            data-testid="mobile-menu-open"
                            onClick={onMobileMenuOpen}
                            type="button"
                        >
                            <Menu size={18} className="text-[hsl(var(--accent-light))]" />
                        </button>

                        <div
                            className="flex min-w-0 items-center gap-3 rounded-[16px] border border-[hsl(var(--accent)/0.2)] bg-[#09152b]/70 px-3 py-1.5"
                            data-testid="top-status-rank"
                        >
                            <div className="flex items-center gap-2 border-r border-[hsl(var(--accent)/0.2)] pr-3">
                                <span className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]" />
                                <span className="text-sm font-black uppercase tracking-[0.15em] text-white">Online</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Rank</span>
                                <span className="text-base font-black text-[hsl(var(--accent))]">{globalStats.rank}</span>
                            </div>
                        </div>

                        <button className="group relative p-2 text-slate-500 transition-all hover:rotate-12 hover:text-white" type="button" aria-label="Alertas">
                            <Bell size={20} />
                            <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-[2px] border-[#020203] bg-red-600 shadow-[0_0_12px_#dc2626]" />
                        </button>

                        <button
                            aria-label={authUser ? "Conta conectada" : "Abrir login"}
                            className="group relative flex h-11 w-11 items-center justify-center rounded-2xl border border-[hsl(var(--accent)/0.2)] bg-[#09152b]/70 p-1 transition-all hover:border-[hsl(var(--accent)/0.5)]"
                            data-testid="header-auth-button"
                            onClick={openAuthPanel}
                            type="button"
                        >
                            <User size={18} className="text-slate-400 transition-colors group-hover:text-[hsl(var(--accent))]" />
                            {authUser && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />}
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
}
