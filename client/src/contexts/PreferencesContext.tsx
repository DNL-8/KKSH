import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type DifficultyMode = "casual" | "hardcore";

export interface ClientPreferences {
  notifications: boolean;
  soundEffects: boolean;
  glitchEffects: boolean;
  stealthMode: boolean;
  difficulty: DifficultyMode;
}

const STORAGE_KEY = "cmd8_preferences";

const DEFAULT_PREFERENCES: ClientPreferences = {
  notifications: true,
  soundEffects: true,
  glitchEffects: true,
  stealthMode: false,
  difficulty: "casual",
};

interface PreferencesContextValue {
  preferences: ClientPreferences;
  setPreference: <K extends keyof ClientPreferences>(key: K, value: ClientPreferences[K]) => void;
  resetPreferences: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  return fallback;
}

function toDifficulty(value: unknown, fallback: DifficultyMode): DifficultyMode {
  if (value === "casual" || value === "hardcore") {
    return value;
  }
  return fallback;
}

function readStoredPreferences(): ClientPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_PREFERENCES;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_PREFERENCES;
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      notifications: toBoolean(parsed.notifications, DEFAULT_PREFERENCES.notifications),
      soundEffects: toBoolean(parsed.soundEffects, DEFAULT_PREFERENCES.soundEffects),
      glitchEffects: toBoolean(parsed.glitchEffects, DEFAULT_PREFERENCES.glitchEffects),
      stealthMode: toBoolean(parsed.stealthMode, DEFAULT_PREFERENCES.stealthMode),
      difficulty: toDifficulty(parsed.difficulty, DEFAULT_PREFERENCES.difficulty),
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<ClientPreferences>(readStoredPreferences);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
      } catch {
        // Ignore storage write failures.
      }
    }

    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.setAttribute("data-glitch-effects", preferences.glitchEffects ? "on" : "off");
      root.setAttribute("data-stealth-mode", preferences.stealthMode ? "on" : "off");
      root.setAttribute("data-sound-effects", preferences.soundEffects ? "on" : "off");
      root.setAttribute("data-difficulty-mode", preferences.difficulty);
    }
  }, [preferences]);

  const setPreference = useCallback(
    <K extends keyof ClientPreferences>(key: K, value: ClientPreferences[K]) => {
      setPreferences((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
  }, []);

  const value = useMemo(
    () => ({ preferences, setPreference, resetPreferences }),
    [preferences, resetPreferences, setPreference],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error("usePreferences must be used within PreferencesProvider");
  }
  return ctx;
}

