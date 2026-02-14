import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { ParticleBackground } from "../components/common/ParticleBackground";
import { MatrixRain } from "../components/common/MatrixRain";
import { RouteProgressBar } from "../components/common/RouteProgressBar";
import { ScrollToTop } from "../components/common/ScrollToTop";
import type { AppShellContextValue } from "./types";
import { AuthPanel } from "./AuthPanel";
import { BootSplash } from "./BootSplash";
import { MobileMenu } from "./MobileMenu";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

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
  return false;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function AppShell() {
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => readInitialSidebarState());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [booting, setBooting] = useState(true);

  const navigate = useNavigate();
  const location = useLocation();
  const { globalStats, authUser, handleGlobalAction, syncProgressionFromApi, openAuthPanel } = useAuth();
  const { themeId } = useTheme(); // Added useTheme hook

  /* Boot splash */
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

  /* Close mobile menu on route change */
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  /* Persist sidebar state */
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(SIDEBAR_MODE_STORAGE_KEY, isSidebarOpen ? "expanded" : "icon");
  }, [isSidebarOpen]);

  const toggleSidebar = useCallback(() => setIsSidebarOpen((c) => !c), []);

  /* Outlet context for child pages */
  const outletContext: AppShellContextValue = {
    globalStats,
    authUser,
    handleGlobalAction,
    syncProgressionFromApi,
    openAuthPanel,
    navigateTo: (path: string) => navigate(path),
  };

  if (booting) {
    return <BootSplash />;
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[#020203] font-sans text-slate-300 selection:bg-cyan-500/30">
      {/* Skip to content — visible only on keyboard focus */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[999] focus:rounded-xl focus:bg-[hsl(var(--accent))] focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-black focus:shadow-lg"
      >
        Pular para o conteúdo
      </a>
      <ScrollToTop />
      <RouteProgressBar />
      <ParticleBackground />
      <MatrixRain />
      {/* Solo Leveling Wallpaper - CSS System Interface */}
      {themeId === "sololeveling" && (
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
          {/* Deep blue tech gradient base */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(26,115,232,0.15),rgba(2,5,10,0)_70%)]" />

          {/* Hex/Grid overlay with drift animation */}
          <div className="animate-grid-drift absolute inset-0 bg-[linear-gradient(to_right,#1a73e810_1px,transparent_1px),linear-gradient(to_bottom,#1a73e810_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)]" />

          {/* Vignette */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#02050a_100%)] opacity-80" />

          {/* Large SYSTEM watermark */}
          <div className="animate-pulse-slow absolute bottom-10 right-10 select-none text-[15rem] font-black leading-none text-[rgba(26,115,232,0.03)] blur-sm">
            SYSTEM
          </div>
        </div>
      )}
      {/* CRT scanline overlay */}
      <div className="pointer-events-none fixed inset-0 z-[100] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.01),rgba(0,255,0,0.01),rgba(0,0,255,0.01))] bg-[length:100%_2px,3px_100%] opacity-20" />

      <Sidebar isSidebarOpen={isSidebarOpen} onToggle={toggleSidebar} />

      <div className="relative flex h-screen flex-1 flex-col overflow-hidden">
        {/* Grid background */}
        <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:60px_60px] opacity-[0.04]" />

        <TopBar onMobileMenuOpen={() => setIsMobileMenuOpen(true)} />

        <main id="main-content" className="custom-scrollbar relative z-10 flex-1 overflow-y-auto p-6 scroll-smooth md:p-14">
          <div className="mx-auto max-w-[1400px] pb-40">
            <Outlet context={outletContext} />
          </div>
        </main>
      </div>

      <AuthPanel />
      <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
    </div>
  );
}
