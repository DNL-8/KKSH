import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Droplets,
  Heart,
  Hexagon,
  LayoutDashboard,
  MonitorPlay,
  Settings,
  Star,
  Swords,
  Target,
  TrendingUp,
  User,
  X,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { ApiRequestError, getMe, getMeState, login, logout } from "../lib/api";
import { rankFromLevel } from "../lib/rank";
import type { AppShellContextValue, AuthUser, GlobalActionType, GlobalStats } from "./types";

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: "hub", label: "Centro de Comando", path: "/hub", icon: LayoutDashboard },
  { id: "combate", label: "Arena de Exterminio", path: "/combate", icon: Swords },
  { id: "revisoes", label: "Masmorra de Memoria", path: "/revisoes", icon: Target },
  { id: "arquivos", label: "Arquivos de Sincronia", path: "/arquivos", icon: MonitorPlay },
  { id: "evolucao", label: "Status de Evolucao", path: "/evolucao", icon: TrendingUp },
  { id: "ia", label: "Nucleo do Sistema", path: "/ia", icon: Cpu },
  { id: "config", label: "Ajustes de Nucleo", path: "/config", icon: Settings },
];

const DESKTOP_NAV_ITEMS: NavItem[] = NAV_ITEMS.filter((item) => item.id !== "config");

function compactIconLinkClass(isActive: boolean): string {
  return `h-11 w-11 justify-center rounded-xl ${
    isActive
      ? "bg-cyan-500/10 text-cyan-300 shadow-[0_0_18px_rgba(6,182,212,0.35)]"
      : "text-slate-600 hover:bg-slate-900/70 hover:text-slate-300"
  }`;
}

const INITIAL_STATS: GlobalStats = {
  hp: 85,
  mana: 92,
  xp: 2450,
  maxXp: 5000,
  level: 42,
  rank: "B",
  gold: 854,
  streak: 12,
};

const SIDEBAR_MODE_STORAGE_KEY = "cmd8_sidebar_mode_v1";
const BOOT_SPLASH_MIN_MS = 250;

function readInitialSidebarState(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const storedValue = window.localStorage.getItem(SIDEBAR_MODE_STORAGE_KEY);
  if (storedValue === "expanded") {
    return true;
  }
  if (storedValue === "icon") {
    return false;
  }
  return false;
}

export function AppShell() {
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => readInitialSidebarState());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [booting, setBooting] = useState(true);
  const [globalStats, setGlobalStats] = useState<GlobalStats>(INITIAL_STATS);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthPanelOpen, setIsAuthPanelOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authFeedback, setAuthFeedback] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setBooting(false);
      return;
    }

    const timer = window.setTimeout(() => setBooting(false), BOOT_SPLASH_MIN_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const activeNavItem = useMemo(
    () => NAV_ITEMS.find((item) => location.pathname === item.path) ?? NAV_ITEMS[0],
    [location.pathname],
  );

  const syncProgressionFromApi = useCallback(async () => {
    try {
      const me = await getMe();
      if (!me.user) {
        setAuthUser(null);
        setGlobalStats(INITIAL_STATS);
        return;
      }

      setAuthUser(me.user);
      const appState = await getMeState();
      const progression = appState.progression;
      if (!progression) {
        return;
      }

      const nextLevel = Math.max(1, Number(progression.level) || 1);
      setGlobalStats((current) => ({
        ...current,
        hp: appState.vitals?.hp ?? current.hp,
        mana: appState.vitals?.mana ?? current.mana,
        xp: Math.max(0, Number(progression.xp) || 0),
        maxXp: Math.max(1, Number(progression.maxXp) || current.maxXp || 1),
        level: nextLevel,
        rank: rankFromLevel(nextLevel),
        gold: Math.max(0, Number(progression.gold) || 0),
        streak: typeof appState.streakDays === "number" ? appState.streakDays : current.streak,
      }));
    } catch {
      // Keep current UI state on transient API errors.
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void syncProgressionFromApi();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [syncProgressionFromApi]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(SIDEBAR_MODE_STORAGE_KEY, isSidebarOpen ? "expanded" : "icon");
  }, [isSidebarOpen]);

  const openAuthPanel = useCallback(() => {
    setAuthFeedback(null);
    if (authUser?.email) {
      setAuthEmail(authUser.email);
    }
    setIsAuthPanelOpen(true);
  }, [authUser?.email]);

  const handleAuthSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (authSubmitting) {
        return;
      }

      const email = authEmail.trim();
      const password = authPassword.trim();
      if (!email || !password) {
        setAuthFeedback("Informe email e senha para entrar.");
        return;
      }

      setAuthSubmitting(true);
      setAuthFeedback(null);
      try {
        await login(email, password);
        setAuthPassword("");
        await syncProgressionFromApi();
        setAuthFeedback("Login realizado com sucesso.");
        setIsAuthPanelOpen(false);
      } catch (authError) {
        if (authError instanceof ApiRequestError && authError.status === 401) {
          setAuthFeedback("Credenciais invalidas.");
        } else {
          setAuthFeedback("Nao foi possivel realizar login.");
        }
      } finally {
        setAuthSubmitting(false);
      }
    },
    [authEmail, authPassword, authSubmitting, syncProgressionFromApi],
  );

  const handleLogout = useCallback(async () => {
    if (authSubmitting) {
      return;
    }

    setAuthSubmitting(true);
    setAuthFeedback(null);
    try {
      await logout();
      await syncProgressionFromApi();
      setAuthPassword("");
      setAuthFeedback("Sessao encerrada.");
      setIsAuthPanelOpen(false);
    } catch {
      setAuthFeedback("Nao foi possivel encerrar a sessao.");
    } finally {
      setAuthSubmitting(false);
    }
  }, [authSubmitting, syncProgressionFromApi]);

  const handleGlobalAction = (type: GlobalActionType) => {
    if (type === "attack") {
      setGlobalStats((value) => ({
        ...value,
        mana: Math.max(0, value.mana - 1),
        xp: Math.min(value.maxXp, value.xp + 10),
      }));
    }
  };

  const outletContext: AppShellContextValue = {
    globalStats,
    authUser,
    handleGlobalAction,
    syncProgressionFromApi,
    openAuthPanel,
    navigateTo: (path: string) => navigate(path),
  };
  const hpPercent = Math.max(0, Math.min(100, Math.round(globalStats.hp)));
  const manaPercent = Math.max(0, Math.min(100, Math.round(globalStats.mana)));
  const xpPercent = Math.max(0, Math.min(100, Math.round((globalStats.xp / globalStats.maxXp) * 100)));

  if (booting) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#020204] p-4 font-mono text-cyan-500">
        <div className="relative mb-16">
          <div className="h-32 w-32 animate-ping rounded-full border-[8px] border-cyan-500/5" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-20 w-20 animate-spin items-center justify-center rounded-[40px] border-2 border-cyan-500/30 bg-cyan-500/10">
              <Cpu size={40} className="text-cyan-500" />
            </div>
          </div>
        </div>
        <div className="max-w-xs space-y-6 text-center">
          <div className="animate-pulse text-3xl font-black uppercase italic tracking-[0.5em]">Iniciando Link</div>
          <div className="space-y-1.5">
            <div className="h-1 w-full overflow-hidden rounded-full border border-cyan-900/30 bg-slate-900">
              <div className="animate-shimmer h-full w-[70%] bg-cyan-500" />
            </div>
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-cyan-900">
              <span>Neural Sinc</span>
              <span>70%</span>
            </div>
          </div>
          <div className="mt-8 text-[9px] font-black uppercase leading-relaxed tracking-[0.3em] text-cyan-900">
            Estabelecendo conexÃ£o tÃ¡tica com hospedeiro #9284-AX...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[#020203] font-sans text-slate-300 selection:bg-cyan-500/30">
      <div className="pointer-events-none fixed inset-0 z-[100] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.01),rgba(0,255,0,0.01),rgba(0,0,255,0.01))] bg-[length:100%_2px,3px_100%] opacity-20" />

      <aside
        data-testid="shell-sidebar"
        className={`hidden flex-col border-r border-slate-900 bg-[#02050a]/95 backdrop-blur-2xl transition-all duration-500 lg:flex ${
          isSidebarOpen ? "w-72" : "w-[88px]"
        }`}
      >
        <div
          className={`border-b border-slate-800/60 ${
            isSidebarOpen ? "flex h-24 items-center justify-between px-5" : "flex h-[170px] flex-col items-center justify-start gap-4 py-5"
          }`}
        >
          <div className={`flex min-w-0 items-center ${isSidebarOpen ? "gap-3" : "justify-center"}`}>
            <Link
              to="/hub"
              className="group relative flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/5"
            >
              <div className="absolute inset-0 rounded-2xl bg-cyan-500/20 opacity-0 blur-xl transition-opacity group-hover:opacity-100" />
              <Hexagon className="relative z-10 text-cyan-400" size={26} />
            </Link>
            {isSidebarOpen && (
              <div className="animate-in fade-in slide-in-from-left-6 min-w-0 overflow-hidden">
                <h1 className="truncate text-xl font-black uppercase italic leading-none tracking-tight text-white">
                  Solo <span className="text-cyan-500">Dev</span>
                </h1>
                <p className="mt-1 text-[9px] font-mono font-black uppercase tracking-[0.3em] text-slate-500">
                  System Core
                </p>
              </div>
            )}
          </div>

          <button
            aria-label={isSidebarOpen ? "Ativar modo so icones" : "Ativar modo com texto"}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-[#0a111d] text-slate-400 transition-all hover:border-cyan-500/40 hover:text-cyan-300"
            data-testid="sidebar-mode-toggle"
            onClick={() => setIsSidebarOpen((current) => !current)}
            type="button"
          >
            {isSidebarOpen ? (
              <ChevronLeft size={16} className="transition-transform" />
            ) : (
              <ChevronRight size={16} className="transition-transform" />
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
                `group relative flex items-center overflow-hidden transition-all duration-300 ${
                  isSidebarOpen
                    ? `w-full rounded-[20px] py-4 ${
                        isActive
                          ? "bg-cyan-500/10 text-cyan-300"
                          : "text-slate-600 hover:bg-slate-900/50 hover:text-slate-300"
                      } gap-5 px-5`
                    : compactIconLinkClass(isActive)
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && isSidebarOpen && (
                    <div className="absolute left-0 top-1/4 h-1/2 w-1.5 rounded-r-full bg-cyan-500 shadow-[0_0_20px_#06b6d4]" />
                  )}
                  {isActive && !isSidebarOpen && (
                    <div className="absolute -left-2 h-7 w-0.5 rounded-full bg-cyan-400 shadow-[0_0_14px_#06b6d4]" />
                  )}
                  <item.icon
                    size={isSidebarOpen ? 22 : 20}
                    className={`shrink-0 transition-transform duration-300 ${isActive ? "scale-105" : "group-hover:scale-105"}`}
                  />
                  {isSidebarOpen && <span className="whitespace-nowrap text-sm font-black uppercase tracking-widest">{item.label}</span>}
                  {isActive && isSidebarOpen && (
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-transparent" />
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
              `group relative flex items-center transition-all ${
                isSidebarOpen
                  ? `w-full rounded-2xl border bg-[#0a111d] gap-4 p-4 ${
                      isActive
                        ? "border-cyan-500/40 text-cyan-300 shadow-[0_0_18px_rgba(6,182,212,0.2)]"
                        : "border-slate-800 text-slate-400 hover:border-cyan-500/30 hover:text-cyan-300"
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
                    className="absolute -left-2 h-7 w-0.5 rounded-full bg-cyan-400 shadow-[0_0_14px_#06b6d4]"
                    data-testid="sidebar-config-active-indicator"
                  />
                )}
                <div
                  className={`flex shrink-0 items-center justify-center text-white transition-transform group-hover:scale-105 ${
                    isSidebarOpen
                      ? "h-11 w-11 rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500 to-violet-500 shadow-2xl"
                      : ""
                  }`}
                >
                  <Settings size={isSidebarOpen ? 20 : 18} />
                </div>
                {isSidebarOpen && (
                  <div className="animate-in fade-in overflow-hidden text-left" data-testid="sidebar-config-card">
                    <p className={`mb-1 truncate text-sm font-black leading-none ${isActive ? "text-cyan-300" : "text-white"}`}>
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

      <div className="relative flex h-screen flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:60px_60px] opacity-[0.04]" />

        <header className="z-40 shrink-0 px-4 pb-0 pt-4 md:px-8">
  <div
    className="w-full rounded-[24px] border border-cyan-900/35 bg-[linear-gradient(180deg,#040b24_0%,#030a1b_100%)] px-3 py-3 shadow-[0_20px_50px_rgba(2,12,40,0.45)] md:px-4"
    data-testid="top-command-panel"
  >
    <div className="flex flex-wrap items-center gap-3 lg:flex-nowrap">
      <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
          <LayoutDashboard size={20} className="text-cyan-400" />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-cyan-600">
            <span>Sistema</span>
            <ChevronRight size={11} className="text-cyan-900" />
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

      <div className="hidden h-14 w-px shrink-0 bg-cyan-900/35 lg:block" />

      <div className="flex min-w-[280px] flex-1 items-center gap-3 md:min-w-[340px]">
        <div
          className="flex h-[64px] w-[64px] shrink-0 flex-col items-center justify-center rounded-xl border border-cyan-500/20 bg-slate-900/60 shadow-[inset_0_0_20px_rgba(148,163,184,0.15)]"
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
            <span className="w-8 text-right text-[10px] font-black text-red-300">{hpPercent}%</span>
          </div>

          <div className="flex items-center gap-2">
            <Droplets size={12} className="shrink-0 text-blue-400" />
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#020718]">
              <div className="h-full rounded-full bg-gradient-to-r from-blue-700 via-blue-500 to-cyan-400" style={{ width: `${manaPercent}%` }} />
            </div>
            <span className="w-8 text-right text-[10px] font-black text-blue-300">{manaPercent}%</span>
          </div>

          <div className="flex items-center gap-2">
            <Star size={12} className="shrink-0 text-yellow-400" />
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#020718]">
              <div className="h-full rounded-full bg-gradient-to-r from-yellow-700 via-yellow-500 to-amber-300" style={{ width: `${xpPercent}%` }} />
            </div>
            <span className="w-8 text-right text-[10px] font-black text-yellow-300">XP</span>
          </div>
        </div>
      </div>

      <div className="hidden h-14 w-px shrink-0 bg-cyan-900/35 lg:block" />

      <div className="ml-auto flex items-center gap-2">
        <div
          className="flex min-w-0 items-center gap-3 rounded-[16px] border border-cyan-900/40 bg-[#09152b]/70 px-3 py-1.5"
          data-testid="top-status-rank"
        >
          <div className="flex items-center gap-2 border-r border-cyan-900/40 pr-3">
            <span className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]" />
            <span className="text-sm font-black uppercase tracking-[0.15em] text-white">Online</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Rank</span>
            <span className="text-base font-black text-cyan-400">{globalStats.rank}</span>
          </div>
        </div>

        <button className="group relative p-2 text-slate-500 transition-all hover:rotate-12 hover:text-white" type="button" aria-label="Alertas">
          <Bell size={20} />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-[2px] border-[#020203] bg-red-600 shadow-[0_0_12px_#dc2626]" />
        </button>

        <button
          aria-label={authUser ? "Conta conectada" : "Abrir login"}
          className="group relative flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-900/40 bg-[#09152b]/70 p-1 transition-all hover:border-cyan-500/50"
          data-testid="header-auth-button"
          onClick={openAuthPanel}
          type="button"
        >
          <User size={18} className="text-slate-400 transition-colors group-hover:text-cyan-400" />
          {authUser && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />}
        </button>
      </div>
    </div>
  </div>
</header>

        <main className="custom-scrollbar relative z-10 flex-1 overflow-y-auto p-6 scroll-smooth md:p-14">
          <div className="mx-auto max-w-[1400px] pb-40">
            <Outlet context={outletContext} />
          </div>
        </main>

      </div>

      {isAuthPanelOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4" role="dialog" aria-modal="true">
          <button
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setIsAuthPanelOpen(false)}
            type="button"
          />
          <section className="relative z-10 w-full max-w-md rounded-[24px] border border-slate-800 bg-[#0a0c12] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-black uppercase tracking-[0.25em] text-white">Conexao API</h2>
              <button
                className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-black uppercase text-slate-300"
                onClick={() => setIsAuthPanelOpen(false)}
                type="button"
              >
                Fechar
              </button>
            </div>

            {authUser ? (
              <div className="space-y-4" data-testid="shell-auth-panel">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-200">
                  Conectado como {authUser.email}
                </div>
                <button
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] font-black uppercase text-slate-200 transition-all hover:border-red-500/30 hover:text-red-300 disabled:opacity-60"
                  data-testid="shell-auth-logout"
                  disabled={authSubmitting}
                  onClick={() => void handleLogout()}
                  type="button"
                >
                  {authSubmitting ? "Saindo..." : "Sair"}
                </button>
              </div>
            ) : (
              <form className="space-y-3" data-testid="shell-auth-panel" onSubmit={(event) => void handleAuthSubmit(event)}>
                <input
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-cyan-500/40 focus:outline-none"
                  data-testid="shell-auth-email"
                  onChange={(event) => setAuthEmail(event.target.value)}
                  placeholder="email"
                  type="email"
                  value={authEmail}
                />
                <input
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-cyan-500/40 focus:outline-none"
                  data-testid="shell-auth-password"
                  onChange={(event) => setAuthPassword(event.target.value)}
                  placeholder="senha"
                  type="password"
                  value={authPassword}
                />
                <button
                  className="w-full rounded-lg border border-cyan-500/30 bg-cyan-600 px-3 py-2 text-[10px] font-black uppercase text-white transition-all hover:bg-cyan-500 disabled:opacity-60"
                  data-testid="shell-auth-submit"
                  disabled={authSubmitting}
                  type="submit"
                >
                  {authSubmitting ? "Entrando..." : "Entrar"}
                </button>
              </form>
            )}

            <button
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-violet-500/30 bg-violet-600 px-3 py-2 text-[10px] font-black uppercase text-white transition-all hover:bg-violet-500"
              data-testid="shell-open-core-settings"
              onClick={() => {
                setIsAuthPanelOpen(false);
                navigate("/config");
              }}
              type="button"
            >
              Ajustes de Nucleo
            </button>

            {authFeedback && (
              <div className="mt-3 rounded-xl border border-slate-700 bg-slate-900/70 p-2 text-xs font-semibold text-slate-300">
                {authFeedback}
              </div>
            )}
          </section>
        </div>
      )}

      {isMobileMenuOpen && (
        <div className="animate-in fade-in fixed inset-0 z-[100] duration-500 lg:hidden">
          <button
            className="absolute inset-0 bg-black/95 backdrop-blur-xl"
            onClick={() => setIsMobileMenuOpen(false)}
            type="button"
          />
          <div className="animate-in slide-in-from-left absolute bottom-0 left-0 top-0 flex w-[300px] flex-col border-r border-slate-800 bg-[#0a0a0b] p-8 shadow-2xl duration-500">
            <div className="mb-14 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Hexagon size={32} className="text-cyan-500 shadow-[0_0_15px_#06b6d4]" />
                <span className="text-xl font-black uppercase italic tracking-tighter text-white">Solo Dev</span>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="rounded-2xl bg-slate-900 p-3 text-slate-600"
                type="button"
              >
                <X size={24} />
              </button>
            </div>
            <nav className="flex-1 space-y-3">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.id}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex w-full items-center gap-5 rounded-[24px] p-5 text-xs font-black uppercase tracking-widest transition-all ${
                      isActive
                        ? "bg-cyan-600 text-white shadow-[0_15px_30px_rgba(8,145,178,0.4)]"
                        : "text-slate-500 hover:bg-slate-900/50 hover:text-slate-300"
                    }`
                  }
                >
                  <item.icon size={20} /> {item.label}
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
      )}
    </div>
  );
}




