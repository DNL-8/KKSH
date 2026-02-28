import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/* ------------------------------------------------------------------ */
/*  Theme definitions                                                 */
/* ------------------------------------------------------------------ */

export type ThemeId = "matrix" | "naruto" | "dragonball" | "sololeveling" | "hxh" | "lotr" | "ios26";

interface ThemeColors {
    /** Primary accent HSL values (without `hsl()` wrapper) for CSS vars */
    accent: string;
    accentLight: string;
    glow: string;
    /** URL path to background image */
    bgImage: string;
    /** Fallback CSS gradient if image fails */
    bgGradient: string;
    /** CSS overlay color/opacity, e.g. "rgba(0,0,0,0.7)" */
    overlayColor: string;
    /** Whether this is a light-mode theme (e.g. iOS 26 Liquid Glass) */
    isLight?: boolean;
}

const THEMES: Record<ThemeId, ThemeColors> = {
    matrix: {
        accent: "120 100% 50%",
        accentLight: "120 100% 70%",
        glow: "0, 255, 65",
        bgImage: "https://images6.alphacoders.com/550/550739.jpg",
        bgGradient: "radial-gradient(circle at center, #001f00 0%, #000000 100%)",
        overlayColor: "rgba(0, 20, 0, 0.85)",
    },
    naruto: {
        accent: "25 95% 50%",
        accentLight: "25 95% 70%",
        glow: "255, 100, 0",
        bgImage: "/assets/themes/naruto.gif",
        bgGradient: "linear-gradient(135deg, #2a1000 0%, #000000 100%)",
        overlayColor: "rgba(20, 10, 0, 0.85)",
    },
    dragonball: {
        accent: "45 100% 50%",
        accentLight: "45 100% 70%",
        glow: "255, 215, 0",
        bgImage: "/assets/themes/dragonball.gif",
        bgGradient: "radial-gradient(circle at bottom, #2a2000 0%, #000000 100%)",
        overlayColor: "rgba(20, 15, 0, 0.85)",
    },
    sololeveling: {
        accent: "212 80% 50%",
        accentLight: "212 80% 70%",
        glow: "26, 115, 232",
        bgImage: "/assets/themes/sololeveling.gif",
        bgGradient: "linear-gradient(to bottom, #020510 0%, #050a14 100%)",
        overlayColor: "rgba(0, 10, 30, 0.9)",
    },
    hxh: {
        accent: "348 83% 47%",
        accentLight: "348 83% 67%",
        glow: "220, 20, 60",
        bgImage: "/assets/themes/hxh.gif",
        bgGradient: "radial-gradient(circle at top right, #2a0005 0%, #000000 100%)",
        overlayColor: "rgba(30, 0, 10, 0.85)",
    },
    lotr: {
        accent: "210 20% 70%",
        accentLight: "210 20% 85%",
        glow: "192, 192, 192",
        bgImage: "/assets/themes/lotr.gif",
        bgGradient: "linear-gradient(to top, #0a1f1d 0%, #000000 100%)",
        overlayColor: "rgba(10, 15, 20, 0.85)",
    },
    ios26: {
        accent: "211 100% 56%",
        accentLight: "211 100% 72%",
        glow: "0, 122, 255",
        bgImage: "https://www.iclarified.com/images/news/95356/455974/455974.jpg",
        bgGradient: "radial-gradient(circle at 18% -8%, #c9e2ff 0%, #eef5ff 36%, #e3eeff 66%, #d6e5fb 100%)",
        overlayColor: "rgba(255, 255, 255, 0.28)",
        isLight: true,
    },

};

const STORAGE_KEY = "cmd8_hud_theme";

/* ------------------------------------------------------------------ */
/*  Context                                                           */
/* ------------------------------------------------------------------ */

interface ThemeContextValue {
    themeId: ThemeId;
    setTheme: (id: ThemeId) => void;
    theme: ThemeColors;
    isLightTheme: boolean;
    isIosTheme: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        throw new Error("useTheme must be used within ThemeProvider");
    }
    return ctx;
}

/* ------------------------------------------------------------------ */
/*  Provider                                                          */
/* ------------------------------------------------------------------ */

function readStoredTheme(): ThemeId {
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored) as string;
            if (parsed in THEMES) return parsed as ThemeId;
        }
    } catch { /* ignore */ }
    return "matrix";
}

function applyThemeVars(id: ThemeId) {
    const theme = THEMES[id];
    const root = document.documentElement;
    root.setAttribute("data-theme-id", id);
    root.style.setProperty("--accent", theme.accent);
    root.style.setProperty("--accent-light", theme.accentLight);
    root.style.setProperty("--glow", theme.glow);
    if (theme.isLight) {
        root.classList.add("theme-light");
        root.style.colorScheme = "light";
    } else {
        root.classList.remove("theme-light");
        root.style.colorScheme = "dark";
    }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [themeId, setThemeId] = useState<ThemeId>(readStoredTheme);

    useEffect(() => {
        applyThemeVars(themeId);
    }, [themeId]);

    const setTheme = useCallback((id: ThemeId) => {
        setThemeId(id);
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(id));
        } catch { /* ignore */ }
    }, []);

    const isLightTheme = THEMES[themeId].isLight === true;
    const isIosTheme = themeId === "ios26";
    const value = useMemo(
        () => ({ themeId, setTheme, theme: THEMES[themeId], isLightTheme, isIosTheme }),
        [themeId, setTheme, isLightTheme, isIosTheme],
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
