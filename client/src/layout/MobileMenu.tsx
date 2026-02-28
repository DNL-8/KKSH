import { useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useSfx } from "../hooks/useSfx";
import { NAV_ITEMS } from "./Sidebar";
import { Icon } from "../components/common/Icon";

/* ------------------------------------------------------------------ */
/*  All nav items including config for mobile                         */
/* ------------------------------------------------------------------ */

const ALL_NAV_ITEMS = [
    ...NAV_ITEMS,
    { id: "config", label: "Ajustes de Nucleo", path: "/config", icon: "settings" },
];

interface MobileMenuProps {
    isOpen: boolean;
    onClose: () => void;
}

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
    const { globalStats, authUser } = useAuth();
    const { themeId, isLightTheme } = useTheme();
    const sfx = useSfx();
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);
    const drawerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const focusableSelector = [
            "button:not([disabled])",
            "[href]",
            "input:not([disabled])",
            "select:not([disabled])",
            "textarea:not([disabled])",
            "[tabindex]:not([tabindex='-1'])",
        ].join(",");

        const getFocusableElements = () => {
            if (!drawerRef.current) {
                return [];
            }
            return Array.from(drawerRef.current.querySelectorAll<HTMLElement>(focusableSelector)).filter(
                (element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true",
            );
        };

        const handleKeydown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
                return;
            }

            if (event.key !== "Tab") {
                return;
            }

            const focusable = getFocusableElements();
            if (focusable.length === 0) {
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const activeElement = document.activeElement;

            if (event.shiftKey) {
                if (activeElement === first || !drawerRef.current?.contains(activeElement)) {
                    event.preventDefault();
                    last.focus();
                }
                return;
            }

            if (activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        window.addEventListener("keydown", handleKeydown);
        closeButtonRef.current?.focus();

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleKeydown);
        };
    }, [isOpen, onClose]);

    if (!isOpen) {
        return null;
    }

    return (
        <div
            className="animate-in fade-in fixed inset-0 z-[100] duration-300 lg:hidden"
            data-testid="mobile-menu-root"
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navegacao"
        >
            <button
                className="absolute inset-0 liquid-glass/60 backdrop-blur-md transition-all duration-300"
                data-testid="mobile-menu-overlay"
                onClick={() => { sfx("toggle"); onClose(); }}
                type="button"
                aria-label="Fechar menu"
            />
            <div
                ref={drawerRef}
                className={`animate-in slide-in-from-left absolute bottom-0 left-0 top-0 flex w-[min(88vw,320px)] flex-col overflow-y-auto border-r border-slate-800/20 px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] backdrop-blur-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] duration-500 ${isLightTheme ? "bg-white/60" : "bg-[#060a12]/90"
                    }`}
                data-testid="mobile-menu-drawer"
            >
                {/* Subtle accent glow */}
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-[hsl(var(--accent)/0.15)] to-transparent pointer-events-none" />

                <div className="relative mb-8 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Icon name="hexagon" className="text-[hsl(var(--accent))] drop-shadow-[0_0_15px_rgba(var(--glow),0.8)] text-3xl transition-transform animate-pulse-slow" />
                        <span className={`text-xl font-black uppercase italic tracking-tighter ${isLightTheme ? "text-slate-900" : "text-slate-100"}`}>
                            {themeId === "sololeveling" ? (
                                <>System <span className="text-[hsl(var(--accent))] drop-shadow-[0_0_8px_rgba(var(--glow),0.5)]">Leveling</span></>
                            ) : (
                                <>Solo <span className="text-[hsl(var(--accent))] drop-shadow-[0_0_8px_rgba(var(--glow),0.5)]">Dev</span></>
                            )}
                        </span>
                    </div>
                    <button
                        ref={closeButtonRef}
                        onClick={() => { sfx("toggle"); onClose(); }}
                        className={`rounded-2xl border border-slate-800/20 liquid-glass/50 p-2 transition-all hover:liquid-glass-inner hover:border-[hsl(var(--accent)/0.3)] active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${isLightTheme ? "text-slate-600 hover:text-slate-900" : "text-slate-300 hover:text-slate-100"
                            }`}
                        data-testid="mobile-menu-close"
                        aria-label="Fechar menu de navegacao"
                        type="button"
                    >
                        <Icon name="cross" className="text-xl" />
                    </button>
                </div>

                <nav className="relative space-y-2" aria-label="Navegacao principal">
                    {ALL_NAV_ITEMS.map((item, index) => (
                        <NavLink
                            key={item.id}
                            to={item.path}
                            onClick={() => { sfx("navigate"); onClose(); }}
                            className={({ isActive }) =>
                                `group relative flex w-full items-center gap-5 rounded-[20px] p-4 text-xs font-black uppercase tracking-widest transition-all duration-300 animate-in fade-in slide-in-from-left-4 ${isActive
                                    ? "bg-[hsl(var(--accent)/0.15)] border border-[hsl(var(--accent)/0.3)] text-[hsl(var(--accent-light))] shadow-[0_0_20px_rgba(var(--glow),0.15)]"
                                    : isLightTheme
                                        ? "border border-transparent text-slate-500 hover:liquid-glass/40 hover:text-slate-900"
                                        : "border border-transparent text-slate-300 hover:liquid-glass/40 hover:text-slate-100"
                                }`
                            }
                            style={{ animationDelay: `${index * 40}ms`, animationFillMode: "both" }}
                        >
                            {({ isActive }) => (
                                <>
                                    {isActive && (
                                        <div className="absolute left-0 top-1/4 h-1/2 w-1.5 rounded-r-full bg-[hsl(var(--accent))] shadow-[0_0_12px_rgba(var(--glow),1)]" />
                                    )}
                                    <Icon
                                        name={item.icon}
                                        className={`text-[20px] transition-transform duration-300 ${isActive ? "scale-110 drop-shadow-[0_0_6px_rgba(var(--glow),0.6)]" : "group-hover:scale-105"}`}
                                    />
                                    {item.label}
                                    {isActive && (
                                        <div className="pointer-events-none absolute inset-0 rounded-[20px] bg-gradient-to-r from-[hsl(var(--accent)/0.05)] to-transparent" />
                                    )}
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                <div className="relative mt-6 border-t border-slate-800/20 pt-6">
                    <div className={`group flex items-center gap-4 rounded-[24px] border p-4 transition-all ${isLightTheme
                        ? "border-slate-800/20 liquid-glass/30 hover:liquid-glass/60 hover:border-slate-800/20"
                        : "border-white/15 bg-white/5 hover:bg-white/10"
                        }`}>
                        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[hsl(var(--accent))] to-violet-600 text-sm font-black shadow-[0_0_15px_rgba(var(--glow),0.3)] group-hover:shadow-[0_0_25px_rgba(var(--glow),0.5)] transition-all ${isLightTheme ? "text-slate-900" : "text-black"
                            }`}>
                            SH
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className={`truncate text-[13px] font-black leading-none ${isLightTheme ? "text-slate-900" : "text-slate-100"}`}>{authUser?.email || "Shadow Hunter"}</p>
                            <p className={`mt-2 text-[10px] font-black uppercase tracking-widest ${isLightTheme ? "text-slate-600" : "text-slate-300"}`}>
                                Lv. <span className="text-[hsl(var(--accent-light))]">{globalStats.level}</span> | Rank <span className="text-[hsl(var(--accent-light))]">{globalStats.rank}</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
