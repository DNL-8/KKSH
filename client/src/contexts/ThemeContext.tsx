import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/* ------------------------------------------------------------------ */
/*  Theme definitions                                                 */
/* ------------------------------------------------------------------ */

export type ThemeId = "cyan" | "red" | "purple" | "emerald" | "orange" | "matrix" | "sololeveling";

interface ThemeColors {
    /** Primary accent HSL values (without `hsl()` wrapper) for CSS vars */
    accent: string;
    accentLight: string;
    glow: string;
}

const THEMES: Record<ThemeId, ThemeColors> = {
    cyan: {
        accent: "188 95% 43%",
        accentLight: "188 95% 68%",
        glow: "6, 182, 212",
    },
    red: {
        accent: "0 84% 60%",
        accentLight: "0 84% 74%",
        glow: "239, 68, 68",
    },
    purple: {
        accent: "271 76% 53%",
        accentLight: "271 76% 72%",
        glow: "147, 51, 234",
    },
    emerald: {
        accent: "160 84% 39%",
        accentLight: "160 84% 60%",
        glow: "16, 185, 129",
    },
    orange: {
        accent: "25 95% 53%",
        accentLight: "25 95% 70%",
        glow: "249, 115, 22",
    },
    matrix: {
        accent: "120 100% 50%",
        accentLight: "120 100% 70%",
        glow: "0, 255, 65",
    },
    sololeveling: {
        accent: "212 80% 50%", // #1a73e8
        accentLight: "212 80% 70%",
        glow: "26, 115, 232",
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
    return "cyan";
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
