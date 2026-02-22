import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import { HistoryPopover } from "../components/topbar/HistoryPopover";
import { useAuth } from "../contexts/AuthContext";
import { usePreferences } from "../contexts/PreferencesContext";
import { useTheme } from "../contexts/ThemeContext";
import { useAnimatedNumber } from "../hooks/useAnimatedNumber";
import { useSfx } from "../hooks/useSfx";
import { CHANGELOG_FINGERPRINT } from "../lib/changelog";
import { widthPercentClass } from "../lib/percentClasses";
import { NAV_ITEMS } from "./Sidebar";
import { Icon } from "../components/common/Icon";
import { useSystemRPG, getRank, getNextRank } from "../lib/systemStore";

const HISTORY_SEEN_STORAGE_KEY = "cmd8_history_seen_fingerprint_v1";

/* ------------------------------------------------------------------ */
/*  Stat bar with shimmer                                             */
/* ------------------------------------------------------------------ */

function StatBar({
    icon,
    iconColor,
    value,
    barClass,
    textClass,
}: {
    icon: string;
    iconColor: string;
    value: number;
    barClass: string;
    textClass: string;
}) {
    return (
        <div className="group flex items-center gap-2">
            <Icon name={icon} className={`shrink-0 text-xs ${iconColor} transition-all duration-300 group-hover:scale-125 group-hover:drop-shadow-[0_0_4px_currentColor]`} />
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#020718] shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]">
                <div className={`relative h-full rounded-full transition-all duration-700 ${barClass} ${widthPercentClass(value)}`}>
                    {/* Shimmer overlay */}
                    <div className="absolute inset-0 overflow-hidden rounded-full">
                        <div className="shimmer-bar absolute inset-0" />
                    </div>
                </div>
            </div>
            <span className={`w-8 text-right text-[10px] font-black tabular-nums ${textClass}`}>{value}%</span>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

interface TopBarProps {
    onMobileMenuOpen: () => void;
}

export function TopBar({ onMobileMenuOpen }: TopBarProps) {
    const { globalStats, authUser, openAuthPanel } = useAuth();
    const { preferences } = usePreferences();
    const { isLightTheme } = useTheme();
    const location = useLocation();
    const sfx = useSfx();
    const historyPopoverRef = useRef<HTMLDivElement | null>(null);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [hasUnreadChanges, setHasUnreadChanges] = useState(true);

    const activeNavItem = useMemo(
        () => NAV_ITEMS.find((item) => location.pathname === item.path) ?? NAV_ITEMS[0],
        [location.pathname],
    );

    const [systemRPG] = useSystemRPG();
    const isSystemPage = location.pathname === "/sistema";

    const hpPercent = isSystemPage
        ? Math.max(0, Math.min(100, Math.round(systemRPG.hp)))
        : Math.max(0, Math.min(100, Math.round(globalStats.hp)));

    const manaPercent = isSystemPage
        ? Math.max(0, Math.min(100, Math.round(systemRPG.mana)))
        : Math.max(0, Math.min(100, Math.round(globalStats.mana)));

    const activeXpPercent = isSystemPage
        ? (systemRPG.xp - getRank(systemRPG.xp).minXp) / (getNextRank(systemRPG.xp).minXp - getRank(systemRPG.xp).minXp) * 100
        : (globalStats.xp / globalStats.maxXp) * 100;

    const xpPercent = Math.max(0, Math.min(100, Math.round(activeXpPercent || 0)));
    const displayLevel = isSystemPage ? systemRPG.level : globalStats.level;

    const animHp = useAnimatedNumber(hpPercent, 600);
    const animMana = useAnimatedNumber(manaPercent, 600);
    const animXp = useAnimatedNumber(xpPercent, 600);
    const presenceLabel = preferences.stealthMode ? "Stealth" : "Online";

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        try {
            const seenFingerprint = window.localStorage.getItem(HISTORY_SEEN_STORAGE_KEY);
            setHasUnreadChanges(seenFingerprint !== CHANGELOG_FINGERPRINT);
        } catch {
            setHasUnreadChanges(true);
        }
    }, []);

    useEffect(() => {
        if (!isHistoryOpen) {
            return;
        }

        const handlePointerDown = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node | null;
            if (!target) {
                return;
            }
            if (!historyPopoverRef.current?.contains(target)) {
                setIsHistoryOpen(false);
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsHistoryOpen(false);
            }
        };

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("touchstart", handlePointerDown);
        document.addEventListener("keydown", handleEscape);

        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("touchstart", handlePointerDown);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [isHistoryOpen]);

    const handleToggleHistory = useCallback(() => {
        sfx("tick");
        setIsHistoryOpen((current) => !current);
    }, [sfx]);

    const handleCloseHistory = useCallback(() => {
        setIsHistoryOpen(false);
    }, []);

    const handleMarkHistorySeen = useCallback(() => {
        if (typeof window === "undefined") {
            setHasUnreadChanges(false);
            return;
        }
        try {
            window.localStorage.setItem(HISTORY_SEEN_STORAGE_KEY, CHANGELOG_FINGERPRINT);
        } catch {
            // Ignore localStorage failures.
        }
        setHasUnreadChanges(false);
    }, []);

    return (
        <header className="z-40 shrink-0 px-4 pb-0 pt-4 md:px-8">
            <div
                className="w-full rounded-[24px] border px-3 py-3 md:px-4 backdrop-blur-xl"
                data-testid="top-command-panel"
                style={isLightTheme ? {
                    background: "rgba(255,255,255,0.48)",
                    backdropFilter: "blur(60px) saturate(3) brightness(1.12)",
                    WebkitBackdropFilter: "blur(60px) saturate(3) brightness(1.12)",
                    borderColor: "rgba(255,255,255,0.75)",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.10), inset 0 1.5px 0 rgba(255,255,255,0.95), inset 0 -1px 0 rgba(0,0,0,0.04)",
                } : {
                    background: "linear-gradient(180deg,#040b24 0%,#030a1b 100%)",
                    borderColor: "hsl(var(--accent)/0.15)",
                    boxShadow: "0 20px 50px rgba(2,12,40,0.45)",
                }}
            >
                <div className="flex flex-wrap items-center gap-3 lg:flex-nowrap">
                    <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[hsl(var(--accent)/0.2)] bg-[hsl(var(--accent)/0.1)] shadow-[0_0_20px_rgba(var(--glow),0.15)] transition-all duration-300 hover:shadow-[0_0_30px_rgba(var(--glow),0.3)]">
                            <Icon name="apps" className="text-[hsl(var(--accent))] text-xl" />
                        </div>

                        <div className="min-w-0">
                            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-[hsl(var(--accent)/0.6)]">
                                <span>Sistema</span>
                                <Icon name="angle-right" className="text-[hsl(var(--accent)/0.3)] text-[11px]" />
                                <span>Uplink_on</span>
                            </div>
                            <h1
                                className="truncate text-[22px] font-black uppercase italic leading-tight tracking-[0.03em] text-slate-900 md:text-[32px]"
                                title={activeNavItem.label}
                            >
                                {activeNavItem.label}
                            </h1>
                        </div>
                    </div>

                    <div className="hidden h-14 w-px shrink-0 bg-[hsl(var(--accent)/0.15)] lg:block" />

                    <div className="flex min-w-[180px] flex-1 items-center gap-2 sm:min-w-[280px] sm:gap-3">
                        {/* Level badge with glow */}
                        <div
                            className="group flex h-[64px] w-[64px] shrink-0 flex-col items-center justify-center rounded-xl border border-[hsl(var(--accent)/0.2)] liquid-glass/60 shadow-[inset_0_0_20px_rgba(148,163,184,0.15)] transition-all duration-500 hover:border-[hsl(var(--accent)/0.4)] hover:shadow-[inset_0_0_20px_rgba(var(--glow),0.15),0_0_20px_rgba(var(--glow),0.1)]"
                            data-testid="top-level-card"
                        >
                            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-600">Lvl</span>
                            <span className="text-3xl font-black leading-none text-slate-900 transition-all duration-300 group-hover:text-[hsl(var(--accent-light))] group-hover:drop-shadow-[0_0_8px_rgba(var(--glow),0.6)]">{displayLevel}</span>
                        </div>

                        <div className="min-w-0 flex-1 space-y-2">
                            <StatBar
                                icon="heart"
                                iconColor="text-red-500"
                                value={animHp}
                                barClass="bg-gradient-to-r from-red-700 via-red-500 to-red-400"
                                textClass="text-red-300"
                            />
                            <StatBar
                                icon="raindrops"
                                iconColor="text-blue-400"
                                value={animMana}
                                barClass="bg-gradient-to-r from-blue-700 via-blue-500 to-cyan-400"
                                textClass="text-blue-300"
                            />
                            <StatBar
                                icon="star"
                                iconColor="text-yellow-400"
                                value={animXp}
                                barClass="bg-gradient-to-r from-yellow-700 via-yellow-500 to-amber-300"
                                textClass="text-yellow-300"
                            />
                        </div>
                    </div>

                    <div className="hidden h-14 w-px shrink-0 bg-[hsl(var(--accent)/0.15)] lg:block" />

                    <div className="ml-auto flex items-center gap-2">
                        <button
                            aria-label="Abrir menu de navegacao"
                            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[hsl(var(--accent)/0.2)] bg-[#09152b]/70 p-1 transition-all hover:border-[hsl(var(--accent)/0.5)] active:scale-90 lg:hidden"
                            data-testid="mobile-menu-open"
                            onClick={() => { sfx("tick"); onMobileMenuOpen(); }}
                            type="button"
                        >
                            <Icon name="menu-burger" className="text-[hsl(var(--accent-light))] text-lg" />
                        </button>

                        <div
                            className="flex min-w-0 items-center gap-3 rounded-[16px] border border-[hsl(var(--accent)/0.2)] bg-[#09152b]/70 px-3 py-1.5 transition-all duration-300 hover:border-[hsl(var(--accent)/0.4)]"
                            data-testid="top-status-rank"
                        >
                            <div className="flex items-center gap-2 border-r border-[hsl(var(--accent)/0.2)] pr-3">
                                <span
                                    className={`h-2 w-2 rounded-full transition-all duration-500 ${preferences.stealthMode
                                        ? "bg-slate-500 shadow-[0_0_8px_#64748b]"
                                        : "bg-green-500 shadow-[0_0_8px_#22c55e] animate-pulse"
                                        }`}
                                />
                                <span className="text-sm font-black uppercase tracking-[0.15em] text-slate-900">{presenceLabel}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Rank</span>
                                <span className="text-base font-black text-[hsl(var(--accent))] drop-shadow-[0_0_6px_rgba(var(--glow),0.4)]">{isSystemPage ? getRank(systemRPG.xp).name : globalStats.rank}</span>
                            </div>
                        </div>

                        <div className="relative" ref={historyPopoverRef}>
                            <button
                                aria-controls="history-popover"
                                aria-expanded={isHistoryOpen}
                                aria-label="Historico"
                                className="group relative p-2 text-slate-500 transition-all duration-300 hover:rotate-12 hover:text-slate-900 hover:drop-shadow-[0_0_6px_rgba(255,255,255,0.3)]"
                                data-testid="top-history-button"
                                onClick={handleToggleHistory}
                                title="Abrir historico"
                                type="button"
                            >
                                <Icon name="bell" className="text-xl" />
                                {hasUnreadChanges && (
                                    <span
                                        className="absolute right-2 top-2 h-2 w-2 rounded-full border-[2px] border-[#020203] bg-red-600 shadow-[0_0_12px_#dc2626] animate-pulse"
                                        data-testid="top-history-badge"
                                    />
                                )}
                            </button>

                            <HistoryPopover
                                authUser={authUser}
                                onClose={handleCloseHistory}
                                onMarkSeen={handleMarkHistorySeen}
                                onOpenAuth={openAuthPanel}
                                open={isHistoryOpen}
                            />
                        </div>

                        <button
                            aria-label={authUser ? "Conta conectada" : "Abrir login"}
                            className="group relative flex h-11 w-11 items-center justify-center rounded-2xl border border-[hsl(var(--accent)/0.2)] bg-[#09152b]/70 p-1 transition-all duration-300 hover:border-[hsl(var(--accent)/0.5)] hover:shadow-[0_0_15px_rgba(var(--glow),0.15)] active:scale-90"
                            data-testid="header-auth-button"
                            onClick={() => { sfx("tick"); openAuthPanel(); }}
                            type="button"
                        >
                            <Icon name="user" className="text-slate-600 transition-colors group-hover:text-[hsl(var(--accent))] text-lg" />
                            {authUser && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399] animate-pulse" />}
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
}
