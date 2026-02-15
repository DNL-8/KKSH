import { Link, NavLink } from "react-router-dom";

import { useTheme } from "../contexts/ThemeContext";
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
    { id: "combate", label: "Arena de Exterminio", path: "/combate", icon: "crossed-swords" },
    { id: "revisoes", label: "Masmorra de Memoria", path: "/revisoes", icon: "target" },
    { id: "arquivos", label: "Arquivos de Sincronia", path: "/arquivos", icon: "play-alt" },
    { id: "evolucao", label: "Status de Evolucao", path: "/evolucao", icon: "chart-histogram" },
    { id: "ia", label: "Nucleo do Sistema", path: "/ia", icon: "cpu" },
];

export { NAV_ITEMS };
export type { NavItem };

const DESKTOP_NAV_ITEMS = NAV_ITEMS;

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function compactIconLinkClass(isActive: boolean): string {
    return `h-11 w-11 justify-center rounded-xl ${isActive
        ? "bg-[hsl(var(--accent)/0.1)] text-[hsl(var(--accent-light))] shadow-[0_0_18px_rgba(var(--glow),0.35)]"
        : "text-slate-600 hover:bg-slate-900/70 hover:text-slate-300"
        }`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

interface SidebarProps {
    isSidebarOpen: boolean;
    onToggle: () => void;
}

export function Sidebar({ isSidebarOpen, onToggle }: SidebarProps) {
    const { themeId } = useTheme();

    return (
        <aside
            data-testid="shell-sidebar"
            className={`hidden flex-col border-r border-slate-900 bg-[#02050a]/95 backdrop-blur-2xl transition-all duration-500 lg:flex ${isSidebarOpen ? "w-80" : "w-[88px]"
                }`}
        >
            <div
                className={`border-b border-slate-800/60 ${isSidebarOpen ? "flex h-24 items-center justify-between px-5" : "flex h-[170px] flex-col items-center justify-start gap-4 py-5"
                    }`}
            >
                <div className={`flex min-w-0 items-center ${isSidebarOpen ? "gap-3" : "justify-center"}`}>
                    <Link
                        to="/hub"
                        className="group relative flex h-12 w-12 items-center justify-center rounded-2xl border border-[hsl(var(--accent)/0.2)] bg-[hsl(var(--accent)/0.05)]"
                    >
                        <div className="absolute inset-0 rounded-2xl bg-[hsl(var(--accent)/0.2)] opacity-0 blur-xl transition-opacity group-hover:opacity-100" />
                        <Icon name="hexagon" className="relative z-10 text-[hsl(var(--accent))] text-2xl" />
                    </Link>
                    {isSidebarOpen && (
                        <div className="animate-in fade-in slide-in-from-left-6 min-w-0 overflow-hidden">
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
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-[#0a111d] text-slate-400 transition-all hover:border-[hsl(var(--accent)/0.4)] hover:text-[hsl(var(--accent-light))]"
                    data-testid="sidebar-mode-toggle"
                    onClick={onToggle}
                    type="button"
                >
                    {isSidebarOpen ? (
                        <Icon name="angle-left" className="transition-transform" />
                    ) : (
                        <Icon name="angle-right" className="transition-transform" />
                    )}
                </button>
            </div>

            {!isSidebarOpen && <div className="mx-auto mt-4 h-px w-10 bg-slate-800/70" />}

            <nav className={`custom-scrollbar flex-1 overflow-y-auto ${isSidebarOpen ? "px-4 py-8" : "px-0 py-6"}`}>
                <div className={`${isSidebarOpen ? "space-y-1.5" : "flex flex-col items-center gap-4"}`}>
                    {DESKTOP_NAV_ITEMS.map((item) => (
                        <NavLink
                            key={item.id}
                            to={item.path}
                            className={({ isActive }) =>
                                `group relative flex items-center overflow-hidden transition-all duration-300 ${isSidebarOpen
                                    ? `w-full rounded-xl py-3.5 ${isActive
                                        ? "bg-gradient-to-r from-[hsl(var(--accent)/0.15)] to-transparent text-[hsl(var(--accent-light))] border-r-2 border-[hsl(var(--accent))]"
                                        : "text-slate-500 hover:bg-slate-900/40 hover:text-slate-200"
                                    } gap-4 px-4`
                                    : compactIconLinkClass(isActive)
                                }`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    {isActive && isSidebarOpen && (
                                        <div className="absolute left-0 top-1/4 h-1/2 w-1.5 rounded-r-full bg-[hsl(var(--accent))] shadow-[0_0_20px_rgba(var(--glow),1)]" />
                                    )}
                                    {isActive && !isSidebarOpen && (
                                        <div className="absolute -left-2 h-7 w-0.5 rounded-full bg-[hsl(var(--accent))] shadow-[0_0_14px_rgba(var(--glow),1)]" />
                                    )}
                                    <Icon
                                        name={item.icon}
                                        className={`shrink-0 transition-transform duration-300 ${isSidebarOpen ? "text-[22px]" : "text-[20px]"} ${isActive ? "scale-105" : "group-hover:scale-105"}`}
                                    />
                                    {isSidebarOpen && <span className="whitespace-nowrap text-sm font-bold uppercase tracking-wider">{item.label}</span>}
                                    {isActive && isSidebarOpen && (
                                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[hsl(var(--accent)/0.05)] to-transparent" />
                                    )}
                                </>
                            )}
                        </NavLink>
                    ))}
                </div>
            </nav>

            {!isSidebarOpen && <div className="mx-auto mb-4 h-px w-10 bg-slate-800/70" />}

            <div className={`border-t border-slate-800/50 ${isSidebarOpen ? "p-6" : "px-0 py-5"}`}>
                <NavLink
                    aria-label="Abrir Ajustes de Nucleo"
                    data-testid="sidebar-config-link"
                    className={({ isActive }) =>
                        `group relative flex items-center transition-all ${isSidebarOpen
                            ? `w-full rounded-2xl bg-[#0a111d]/50 border border-slate-800/50 gap-4 p-3 hover:border-slate-700 hover:bg-[#0a111d] ${isActive
                                ? "border-[hsl(var(--accent)/0.4)] bg-[hsl(var(--accent)/0.05)] shadow-[0_0_20px_rgba(var(--glow),0.1)]"
                                : "text-slate-400 hover:text-[hsl(var(--accent-light))]"
                            }`
                            : `mx-auto ${compactIconLinkClass(isActive)}`
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
                                className={`flex shrink-0 items-center justify-center text-white transition-transform group-hover:scale-105 ${isSidebarOpen
                                    ? "h-11 w-11 rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500 to-violet-500 shadow-2xl"
                                    : ""
                                    }`}
                            >
                                <Icon name="settings" className={isSidebarOpen ? "text-[20px]" : "text-[18px]"} />
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
