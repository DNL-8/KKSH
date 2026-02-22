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
    const { themeId } = useTheme();
    const sfx = useSfx();

    if (!isOpen) {
        return null;
    }

    return (
        <div className="animate-in fade-in fixed inset-0 z-[100] duration-300 lg:hidden" data-testid="mobile-menu-root">
            <button
                className="absolute inset-0 liquid-glass/60 backdrop-blur-md transition-all duration-300"
                data-testid="mobile-menu-overlay"
                onClick={() => { sfx("toggle"); onClose(); }}
                type="button"
                aria-label="Fechar menu"
            />
            <div
                className="animate-in slide-in-from-left absolute bottom-0 left-0 top-0 flex w-[300px] flex-col border-r border-slate-800/20 bg-[#060a12]/80 backdrop-blur-3xl p-8 shadow-[0_0_50px_rgba(0,0,0,0.8)] duration-500"
                data-testid="mobile-menu-drawer"
            >
                {/* Subtle accent glow */}
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-[hsl(var(--accent)/0.15)] to-transparent pointer-events-none" />

                <div className="relative mb-14 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Icon name="hexagon" className="text-[hsl(var(--accent))] drop-shadow-[0_0_15px_rgba(var(--glow),0.8)] text-3xl transition-transform animate-pulse-slow" />
                        <span className="text-xl font-black uppercase italic tracking-tighter text-slate-900">
                            {themeId === "sololeveling" ? (
                                <>System <span className="text-[hsl(var(--accent))] drop-shadow-[0_0_8px_rgba(var(--glow),0.5)]">Leveling</span></>
                            ) : (
                                <>Solo <span className="text-[hsl(var(--accent))] drop-shadow-[0_0_8px_rgba(var(--glow),0.5)]">Dev</span></>
                            )}
                        </span>
                    </div>
                    <button
                        onClick={() => { sfx("toggle"); onClose(); }}
                        className="rounded-2xl border border-slate-800/20 liquid-glass/50 p-2 text-slate-600 transition-all hover:liquid-glass-inner hover:text-slate-900 hover:border-[hsl(var(--accent)/0.3)] active:scale-90"
                        data-testid="mobile-menu-close"
                        aria-label="Fechar menu de navegacao"
                        type="button"
                    >
                        <Icon name="cross" className="text-xl" />
                    </button>
                </div>

                <nav className="relative flex-1 space-y-3" aria-label="Navegacao principal">
                    {ALL_NAV_ITEMS.map((item, index) => (
                        <NavLink
                            key={item.id}
                            to={item.path}
                            onClick={() => { sfx("navigate"); onClose(); }}
                            className={({ isActive }) =>
                                `group relative flex w-full items-center gap-5 rounded-[20px] p-4 text-xs font-black uppercase tracking-widest transition-all duration-300 animate-in fade-in slide-in-from-left-4 ${isActive
                                    ? "bg-[hsl(var(--accent)/0.15)] border border-[hsl(var(--accent)/0.3)] text-[hsl(var(--accent-light))] shadow-[0_0_20px_rgba(var(--glow),0.15)]"
                                    : "border border-transparent text-slate-500 hover:liquid-glass/40 hover:text-slate-200"
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

                <div className="relative mt-auto border-t border-slate-800/20 pt-8">
                    <div className="group flex items-center gap-4 rounded-[24px] border border-slate-800/20 liquid-glass/30 p-4 transition-all hover:liquid-glass/60 hover:border-slate-800/20">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[hsl(var(--accent))] to-violet-600 text-sm font-black text-slate-900 shadow-[0_0_15px_rgba(var(--glow),0.3)] group-hover:shadow-[0_0_25px_rgba(var(--glow),0.5)] transition-all">
                            SH
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="truncate text-[13px] font-black leading-none text-slate-900">{authUser?.email || "Shadow Hunter"}</p>
                            <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
                                Lv. <span className="text-[hsl(var(--accent-light))]">{globalStats.level}</span> | Rank <span className="text-[hsl(var(--accent-light))]">{globalStats.rank}</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
