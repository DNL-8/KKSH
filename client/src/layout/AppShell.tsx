import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import { usePreferences } from "../contexts/PreferencesContext";
import { useTheme } from "../contexts/ThemeContext";
import { RouteProgressBar } from "../components/common/RouteProgressBar";
import { ThemeBackground } from "../components/common/ThemeBackground";
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
const BOOT_SPLASH_MIN_MS = 2500; // Increased to show the boot animation and sounds

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
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [prevLocation, setPrevLocation] = useState("");

  const navigate = useNavigate();
  const location = useLocation();
  const { globalStats, authUser, openAuthPanel } = useAuth();
  const { preferences } = usePreferences();
  const { isLightTheme, theme } = useTheme();

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

  /* Close mobile menu on route change & handle route transitions */
  useEffect(() => {
    setIsMobileMenuOpen(false);

    if (prevLocation !== "" && prevLocation !== location.pathname) {
      setIsTransitioning(true);
      const timer = setTimeout(() => setIsTransitioning(false), 300);
      return () => clearTimeout(timer);
    }
    setPrevLocation(location.pathname);
  }, [location.pathname, prevLocation]);

  /* Persist sidebar state */
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(SIDEBAR_MODE_STORAGE_KEY, isSidebarOpen ? "expanded" : "icon");
  }, [isSidebarOpen]);

  // Handle global click sounds for generic buttons not covered by specific components
  useEffect(() => {
    if (!preferences.soundEffects) return;

    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Play a tiny tick if clicking a native button or something with role="button"
      // that doesn't have its own custom sound handling
      const isButton = target.tagName === "BUTTON" || target.closest("button") !== null;
      const hasRoleButton = target.getAttribute("role") === "button" || target.closest("[role='button']") !== null;

      // Ignore anchors/links as they are handled by router navigation sounds
      const isLink = target.tagName === "A" || target.closest("a") !== null;

      if ((isButton || hasRoleButton) && !isLink) {
        // Look for custom data-no-sound if a component wants to override
        if (!target.closest("[data-no-sound]")) {
          // Short tick logic here to avoid importing AudioContext again globally
          // Just generic button feedback
          try {
            // Optional: lightweight tick directly if needed, or rely on component hooks
          } catch { /* ignore */ }
        }
      }
    };

    document.addEventListener("click", handleGlobalClick, { capture: true, passive: true });
    return () => document.removeEventListener("click", handleGlobalClick, { capture: true });
  }, [preferences.soundEffects]);

  const toggleSidebar = useCallback(() => setIsSidebarOpen((c) => !c), []);

  /* Outlet context for child pages */
  const outletContext: AppShellContextValue = {
    globalStats,
    authUser,
    openAuthPanel,
    navigateTo: (path: string) => navigate(path),
  };

  if (booting) {
    return <BootSplash />;
  }

  return (
    <div
      className="relative flex min-h-screen overflow-hidden font-sans text-slate-800 selection:bg-[hsl(var(--accent)/0.3)] ios-bg-root"
    >
      {/* Skip to content — visible only on keyboard focus */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[999] focus:rounded-xl focus:bg-[hsl(var(--accent))] focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-black focus:shadow-[0_0_20px_rgba(var(--glow),0.8)]"
      >
        Pular para o conteúdo
      </a>
      {/* Theme background — light themes use a fixed wallpaper div, dark themes use ThemeBackground */}

      <ScrollToTop />
      <RouteProgressBar />

      {/* CRT scanline overlay + flicker — dark themes only */}
      {preferences.glitchEffects && !isLightTheme && (
        <div className="crt-overlay pointer-events-none fixed inset-0 z-[100] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.01),rgba(0,255,0,0.01),rgba(0,0,255,0.01))] bg-[length:100%_2px,3px_100%] opacity-20 mix-blend-overlay" />
      )}

      <Sidebar isSidebarOpen={isSidebarOpen} onToggle={toggleSidebar} />

      <div className="relative flex h-screen flex-1 flex-col overflow-hidden">
        {/* Dynamic Grid background — made subtle for glass theme */}
        <div className="animate-grid-drift pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px] opacity-30" />


        <TopBar onMobileMenuOpen={() => setIsMobileMenuOpen(true)} />

        <main id="main-content" className="custom-scrollbar relative z-10 flex-1 overflow-y-auto p-6 scroll-smooth md:p-14">
          <div className={`mx-auto max-w-[1400px] pb-40 transition-all duration-300
            ${isTransitioning
              ? "opacity-0 scale-[0.98] blur-[2px]"
              : "opacity-100 scale-100 blur-0 animate-in fade-in zoom-in-95"
            }`}
          >
            <Outlet context={outletContext} />
          </div>
        </main>
      </div>

      <AuthPanel />
      <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
    </div>
  );
}
