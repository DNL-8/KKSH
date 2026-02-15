import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/* ------------------------------------------------------------------ */
/*  Theme definitions                                                 */
/* ------------------------------------------------------------------ */

export type ThemeId = "matrix" | "naruto" | "dragonball" | "sololeveling" | "hxh" | "lotr";

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
        bgImage: "https://i.imgur.com/N6d0h3a.gif",
        bgGradient: "linear-gradient(135deg, #2a1000 0%, #000000 100%)",
        overlayColor: "rgba(20, 10, 0, 0.85)",
    },
    dragonball: {
        accent: "45 100% 50%",
        accentLight: "45 100% 70%",
        glow: "255, 215, 0",
        bgImage: "https://i.imgur.com/2D5s3fM.gif",
        bgGradient: "radial-gradient(circle at bottom, #2a2000 0%, #000000 100%)",
        overlayColor: "rgba(20, 15, 0, 0.85)",
    },
    sololeveling: {
        accent: "212 80% 50%",
        accentLight: "212 80% 70%",
        glow: "26, 115, 232",
        bgImage: "https://i.imgur.com/GOVT9pl.gif",
        bgGradient: "linear-gradient(to bottom, #020510 0%, #050a14 100%)",
        overlayColor: "rgba(0, 10, 30, 0.9)",
    },
    hxh: {
        accent: "348 83% 47%",
        accentLight: "348 83% 67%",
        glow: "220, 20, 60",
        bgImage: "https://media.giphy.com/media/u4dQ8BMugUYp2/giphy.gif",
        bgGradient: "radial-gradient(circle at top right, #2a0005 0%, #000000 100%)",
        overlayColor: "rgba(30, 0, 10, 0.85)",
    },
    lotr: {
        accent: "210 20% 70%",
        accentLight: "210 20% 85%",
        glow: "192, 192, 192",
        bgImage: "https://media.giphy.com/media/SMEDDr3CIB7s4/giphy.gif",
        bgGradient: "linear-gradient(to top, #0a1f1d 0%, #000000 100%)",
        overlayColor: "rgba(10, 15, 20, 0.85)",
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
    root.style.setProperty("--accent", theme.accent);
    root.style.setProperty("--accent-light", theme.accentLight);
    root.style.setProperty("--glow", theme.glow);
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

    const value = useMemo(() => ({ themeId, setTheme, theme: THEMES[themeId] }), [themeId, setTheme]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
