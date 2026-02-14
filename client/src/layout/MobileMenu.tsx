import { Hexagon, Settings, X } from "lucide-react";
import { NavLink } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { NAV_ITEMS } from "./Sidebar";

/* ------------------------------------------------------------------ */
/*  All nav items including config for mobile                         */
/* ------------------------------------------------------------------ */

const ALL_NAV_ITEMS = [
    ...NAV_ITEMS,
    { id: "config", label: "Ajustes de Nucleo", path: "/config", icon: Settings },
];

interface MobileMenuProps {
    isOpen: boolean;
    onClose: () => void;
}

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
    const { globalStats, authUser } = useAuth();
    const { themeId } = useTheme();

    if (!isOpen) {
        return null;
    }

    return (
        <div className="animate-in fade-in fixed inset-0 z-[100] duration-500 lg:hidden" data-testid="mobile-menu-root">
            <button
                className="absolute inset-0 bg-black/95 backdrop-blur-xl"
                data-testid="mobile-menu-overlay"
                onClick={onClose}
                type="button"
                aria-label="Fechar menu"
            />
            <div
                className="animate-in slide-in-from-left absolute bottom-0 left-0 top-0 flex w-[300px] flex-col border-r border-slate-800 bg-[#0a0a0b] p-8 shadow-2xl duration-500"
                data-testid="mobile-menu-drawer"
            >
                <div className="mb-14 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Hexagon size={32} className="text-[hsl(var(--accent))] drop-shadow-[0_0_15px_rgba(var(--glow),1)]" />
                        <span className="text-xl font-black uppercase italic tracking-tighter text-white">
                            {themeId === "sololeveling" ? (
                                <>System <span className="text-[hsl(var(--accent))]">Leveling</span></>
                            ) : (
                                "Solo Dev"
                            )}
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-2xl bg-slate-900 p-3 text-slate-600"
                        data-testid="mobile-menu-close"
                        aria-label="Fechar menu de navegacao"
                        type="button"
                    >
                        <X size={24} />
                    </button>
                </div>
                <nav className="flex-1 space-y-3" aria-label="Navegacao principal">
                    {ALL_NAV_ITEMS.map((item) => (
                        <NavLink
                            key={item.id}
                            to={item.path}
                            onClick={onClose}
                            className={({ isActive }) =>
                                `relative flex w-full items-center gap-5 rounded-[24px] p-5 text-xs font-black uppercase tracking-widest transition-all ${isActive
                                    ? "bg-[hsl(var(--accent))] text-white shadow-[0_15px_30px_rgba(var(--glow),0.4)]"
                                    : "text-slate-500 hover:bg-slate-900/50 hover:text-slate-300"
                                }`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    {isActive && (
                                        <div className="absolute left-0 top-1/4 h-1/2 w-1.5 rounded-r-full bg-white shadow-[0_0_12px_#fff]" />
                                    )}
                                    <item.icon size={20} /> {item.label}
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>
                <div className="border-t border-slate-800 pt-8">
                    <div className="flex items-center gap-4 rounded-3xl bg-slate-900/40 p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-600 text-xs font-black text-black">SH</div>
                        <div className="flex-1">
                            <p className="text-xs font-black leading-none text-white">{authUser?.email || "Shadow Hunter"}</p>
                            <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                                Lv. {globalStats.level} | Rank {globalStats.rank}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
