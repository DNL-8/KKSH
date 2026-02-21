import { useCallback, useState } from "react";
import { Link, NavLink } from "react-router-dom";

import { useTheme } from "../contexts/ThemeContext";
import { useSfx } from "../hooks/useSfx";
import { Icon } from "../components/common/Icon";

/* ------------------------------------------------------------------ */
/*  Nav data                                                          */
/* ------------------------------------------------------------------ */

interface NavItem {
    id: string;
    label: string;
    path: string;
    icon: string;
}

const NAV_ITEMS: NavItem[] = [
    { id: "hub", label: "Centro de Comando", path: "/hub", icon: "apps" },
    { id: "combate", label: "Arena de Exterminio", path: "/combate", icon: "sword" },
    { id: "revisoes", label: "Masmorra de Memoria", path: "/revisoes", icon: "target" },
    { id: "arquivos", label: "Arquivos de Sincronia", path: "/arquivos", icon: "play" },
    { id: "evolucao", label: "Status de Evolucao", path: "/evolucao", icon: "stats" },
    { id: "ia", label: "Nucleo do Sistema", path: "/ia", icon: "microchip" },
];

export { NAV_ITEMS };
export type { NavItem };

const DESKTOP_NAV_ITEMS = NAV_ITEMS;

/* ------------------------------------------------------------------ */
/*  Floating tooltip for compact mode                                 */
/* ------------------------------------------------------------------ */

function SidebarTooltip({ label, visible }: { label: string; visible: boolean }) {
    return (
        <div
            className={`absolute left-full top-1/2 -translate-y-1/2 ml-3 z-[60] pointer-events-none
                transition-all duration-200 ${visible
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 -translate-x-2"
                }`}
        >
            <div className="relative whitespace-nowrap rounded-lg border border-[hsl(var(--accent)/0.3)]
                bg-[#0a0f1d]/95 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em]
                text-[hsl(var(--accent-light))] shadow-[0_0_20px_rgba(var(--glow),0.2)] backdrop-blur-xl">
                {label}
                {/* Arrow */}
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 h-2 w-2 rotate-45
                    border-l border-b border-[hsl(var(--accent)/0.3)] bg-[#0a0f1d]/95" />
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Compact icon nav item with tooltip                                */
/* ------------------------------------------------------------------ */

function CompactNavItem({ item, sfx }: { item: NavItem; sfx: ReturnType<typeof useSfx> }) {
    const [hovered, setHovered] = useState(false);

    return (
        <NavLink
            to={item.path}
            onMouseEnter={() => { setHovered(true); sfx("tick"); }}
            onMouseLeave={() => setHovered(false)}
            onClick={() => sfx("navigate")}
            className={({ isActive }) =>
                `group relative flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-300 ${isActive
                    ? "bg-[hsl(var(--accent)/0.1)] text-[hsl(var(--accent-light))] shadow-[0_0_18px_rgba(var(--glow),0.35)]"
                    : "text-slate-600 hover:bg-slate-900/70 hover:text-slate-300 hover:shadow-[0_0_12px_rgba(var(--glow),0.1)]"
                }`
            }
        >
            {({ isActive }) => (
                <>
                    {isActive && (
                        <div className="absolute -left-2 h-7 w-0.5 rounded-full bg-[hsl(var(--accent))] shadow-[0_0_14px_rgba(var(--glow),1)]" />
                    )}
                    <Icon
                        name={item.icon}
                        className={`shrink-0 text-[20px] transition-all duration-300 ${isActive
                            ? "scale-105 drop-shadow-[0_0_6px_rgba(var(--glow),0.6)]"
                            : "group-hover:scale-110 group-hover:drop-shadow-[0_0_4px_rgba(var(--glow),0.3)]"
                            }`}
                    />
                    <SidebarTooltip label={item.label} visible={hovered && !isActive} />
                    {/* Hover glow ring */}
                    <div className={`absolute inset-0 rounded-xl transition-opacity duration-300 pointer-events-none ${hovered && !isActive ? "opacity-100" : "opacity-0"
                        }`}
                        style={{ boxShadow: "inset 0 0 20px rgba(var(--glow), 0.08)" }}
                    />
                </>
            )}
        </NavLink>
    );
}

/* ------------------------------------------------------------------ */
/*  Expanded nav item                                                 */
/* ------------------------------------------------------------------ */

function ExpandedNavItem({ item, index, sfx }: { item: NavItem; index: number; sfx: ReturnType<typeof useSfx> }) {
    return (
        <NavLink
            to={item.path}
            onClick={() => sfx("navigate")}
            className={({ isActive }) =>
                `group relative flex items-center overflow-hidden transition-all duration-300
                w-full rounded-xl py-3.5 gap-4 px-4
                animate-in fade-in slide-in-from-left-4
                ${isActive
                    ? "bg-gradient-to-r from-[hsl(var(--accent)/0.15)] to-transparent text-[hsl(var(--accent-light))] border-r-2 border-[hsl(var(--accent))]"
                    : "text-slate-500 hover:bg-slate-900/40 hover:text-slate-200"
                }`
            }
            style={{ animationDelay: `${index * 40}ms`, animationFillMode: "both" }}
        >
            {({ isActive }) => (
                <>
                    {isActive && (
                        <div className="absolute left-0 top-1/4 h-1/2 w-1.5 rounded-r-full bg-[hsl(var(--accent))] shadow-[0_0_20px_rgba(var(--glow),1)]" />
                    )}
                    <Icon
                        name={item.icon}
                        className={`shrink-0 text-[22px] transition-all duration-300 ${isActive
                            ? "scale-105 drop-shadow-[0_0_6px_rgba(var(--glow),0.5)]"
                            : "group-hover:scale-105 group-hover:drop-shadow-[0_0_4px_rgba(var(--glow),0.2)]"
                            }`}
                    />
                    <span className="whitespace-nowrap text-sm font-bold uppercase tracking-wider">{item.label}</span>
                    {isActive && (
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[hsl(var(--accent)/0.05)] to-transparent" />
                    )}
                </>
            )}
        </NavLink>
    );
}

/* ------------------------------------------------------------------ */
/*  Main sidebar component                                            */
/* ------------------------------------------------------------------ */

interface SidebarProps {
    isSidebarOpen: boolean;
    onToggle: () => void;
}

export function Sidebar({ isSidebarOpen, onToggle }: SidebarProps) {
    const { themeId } = useTheme();
    const sfx = useSfx();

    const handleToggle = useCallback(() => {
        sfx("toggle");
        onToggle();
    }, [sfx, onToggle]);

    return (
        <aside
            data-testid="shell-sidebar"
            className={`hidden flex-col border-r border-slate-900 bg-[#02050a]/95 backdrop-blur-2xl transition-all duration-500 lg:flex ${isSidebarOpen ? "w-80" : "w-[88px]"
                }`}
        >
            {/* Subtle accent glow at top */}
            <div className="absolute top-0 left-0 right-0 h-32 pointer-events-none bg-gradient-to-b from-[hsl(var(--accent)/0.03)] to-transparent" />

            <div
                className={`relative border-b border-slate-800/60 ${isSidebarOpen ? "flex h-24 items-center justify-between px-5" : "flex h-[170px] flex-col items-center justify-start gap-4 py-5"
                    }`}
            >
                <div className={`flex min-w-0 items-center ${isSidebarOpen ? "gap-3" : "justify-center"}`}>
                    <Link
                        to="/hub"
                        className="group relative flex h-12 w-12 items-center justify-center rounded-2xl border border-[hsl(var(--accent)/0.2)] bg-[hsl(var(--accent)/0.05)] transition-all duration-300 hover:border-[hsl(var(--accent)/0.5)] hover:shadow-[0_0_25px_rgba(var(--glow),0.2)]"
                    >
                        <div className="absolute inset-0 rounded-2xl bg-[hsl(var(--accent)/0.2)] opacity-0 blur-xl transition-opacity group-hover:opacity-100" />
                        <Icon name="hexagon" className="relative z-10 text-[hsl(var(--accent))] text-2xl transition-transform duration-300 group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(var(--glow),0.8)]" />
                    </Link>
                    {isSidebarOpen && (
                        <div className="animate-in fade-in slide-in-from-left-6 min-w-0 overflow-hidden duration-300">
                            <h1 className="truncate text-xl font-black uppercase italic leading-none tracking-tight text-white">
                                {themeId === "sololeveling" ? (
                                    <>System <span className="text-[hsl(var(--accent))]">Leveling</span></>
                                ) : (
                                    <>Solo <span className="text-[hsl(var(--accent))]">Dev</span></>
                                )}
                            </h1>
                            <p className="mt-1 text-[9px] font-mono font-black uppercase tracking-[0.3em] text-slate-500">
                                System Core
                            </p>
                        </div>
                    )}
                </div>

                <button
                    aria-label={isSidebarOpen ? "Ativar modo so icones" : "Ativar modo com texto"}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-[#0a111d] text-slate-400 transition-all duration-300 hover:border-[hsl(var(--accent)/0.4)] hover:text-[hsl(var(--accent-light))] hover:bg-[hsl(var(--accent)/0.05)] hover:shadow-[0_0_15px_rgba(var(--glow),0.1)] active:scale-90"
                    data-testid="sidebar-mode-toggle"
                    onClick={handleToggle}
                    type="button"
                >
                    <Icon
                        name={isSidebarOpen ? "angle-left" : "angle-right"}
                        className="transition-transform duration-300"
                    />
                </button>
            </div>

            {!isSidebarOpen && <div className="mx-auto mt-4 h-px w-10 bg-gradient-to-r from-transparent via-slate-800/70 to-transparent" />}

            <nav className={`custom-scrollbar flex-1 overflow-y-auto ${isSidebarOpen ? "px-4 py-8" : "px-0 py-6"}`}>
                <div className={`${isSidebarOpen ? "space-y-1.5" : "flex flex-col items-center gap-4"}`}>
                    {DESKTOP_NAV_ITEMS.map((item, index) =>
                        isSidebarOpen ? (
                            <ExpandedNavItem key={item.id} item={item} index={index} sfx={sfx} />
                        ) : (
                            <CompactNavItem key={item.id} item={item} sfx={sfx} />
                        )
                    )}
                </div>
            </nav>

            {!isSidebarOpen && <div className="mx-auto mb-4 h-px w-10 bg-gradient-to-r from-transparent via-slate-800/70 to-transparent" />}

            <div className={`border-t border-slate-800/50 ${isSidebarOpen ? "p-6" : "px-0 py-5"}`}>
                <NavLink
                    aria-label="Abrir Ajustes de Nucleo"
                    data-testid="sidebar-config-link"
                    onClick={() => sfx("navigate")}
                    className={({ isActive }) =>
                        `group relative flex items-center transition-all duration-300 ${isSidebarOpen
                            ? `w-full rounded-2xl bg-[#0a111d]/50 border border-slate-800/50 gap-4 p-3 hover:border-slate-700 hover:bg-[#0a111d] ${isActive
                                ? "border-[hsl(var(--accent)/0.4)] bg-[hsl(var(--accent)/0.05)] shadow-[0_0_20px_rgba(var(--glow),0.1)]"
                                : "text-slate-400 hover:text-[hsl(var(--accent-light))]"
                            }`
                            : `mx-auto flex h-11 w-11 justify-center rounded-xl ${isActive
                                ? "bg-[hsl(var(--accent)/0.1)] text-[hsl(var(--accent-light))] shadow-[0_0_18px_rgba(var(--glow),0.35)]"
                                : "text-slate-600 hover:bg-slate-900/70 hover:text-slate-300 hover:shadow-[0_0_12px_rgba(var(--glow),0.1)]"
                            }`
                        }`
                    }
                    to="/config"
                >
                    {({ isActive }) => (
                        <>
                            {!isSidebarOpen && isActive && (
                                <div
                                    className="absolute -left-2 h-7 w-0.5 rounded-full bg-[hsl(var(--accent))] shadow-[0_0_14px_rgba(var(--glow),1)]"
                                    data-testid="sidebar-config-active-indicator"
                                />
                            )}
                            <div
                                className={`flex shrink-0 items-center justify-center text-white transition-all duration-300 group-hover:scale-105 ${isSidebarOpen
                                    ? "h-11 w-11 rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500 to-violet-500 shadow-2xl group-hover:shadow-[0_0_20px_rgba(139,92,246,0.4)]"
                                    : ""
                                    }`}
                            >
                                <Icon name="settings" className={`${isSidebarOpen ? "text-[20px]" : "text-[18px]"} ${!isSidebarOpen && isActive ? "drop-shadow-[0_0_6px_rgba(var(--glow),0.6)]" : ""}`} />
                            </div>
                            {isSidebarOpen && (
                                <div className="animate-in fade-in overflow-hidden text-left" data-testid="sidebar-config-card">
                                    <p className={`mb-1 truncate text-sm font-black leading-none ${isActive ? "text-[hsl(var(--accent-light))]" : "text-white"}`}>
                                        Ajustes de Nucleo
                                    </p>
                                    <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-500">
                                        Configuracoes do sistema
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </NavLink>
            </div>
        </aside>
    );
}
