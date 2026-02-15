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
}

const THEMES: Record<ThemeId, ThemeColors> = {
    matrix: {
        accent: "120 100% 50%",
        accentLight: "120 100% 70%",
        glow: "0, 255, 65",
    },
    naruto: {
        accent: "25 95% 50%",
        accentLight: "25 95% 70%",
        glow: "255, 100, 0",
    },
    dragonball: {
        accent: "45 100% 50%",
        accentLight: "45 100% 70%",
        glow: "255, 215, 0",
    },
    sololeveling: {
        accent: "212 80% 50%",
        accentLight: "212 80% 70%",
        glow: "26, 115, 232",
    },
    hxh: {
        accent: "348 83% 47%",
        accentLight: "348 83% 67%",
        glow: "220, 20, 60",
    },
    lotr: {
        accent: "210 20% 70%",
        accentLight: "210 20% 85%",
        glow: "192, 192, 192",
    },
};

const STORAGE_KEY = "cmd8_hud_theme";

/* ------------------------------------------------------------------ */
/*  Context                                                           */
/* ------------------------------------------------------------------ */

interface ThemeContextValue {
    themeId: ThemeId;
    setTheme: (id: ThemeId) => void;
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

    const value = useMemo(() => ({ themeId, setTheme }), [themeId, setTheme]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
