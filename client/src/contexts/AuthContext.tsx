import { type FormEvent, createContext, useCallback, useContext, useEffect, useState } from "react";

import { ApiRequestError, getMe, getProgress, login, logout } from "../lib/api";
import type { AuthUser, GlobalStats } from "../layout/types";

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const INITIAL_STATS: GlobalStats = {
    hp: 100,
    mana: 100,
    xp: 0,
    maxXp: 1000,
    level: 1,
    rank: "F",
    gold: 0,
    streak: 0,
};

/* ------------------------------------------------------------------ */
/*  Context value                                                     */
/* ------------------------------------------------------------------ */

export interface AuthContextValue {
    authUser: AuthUser | null;
    globalStats: GlobalStats;
    /** Refresh user + progression from API */
    syncProgressionFromApi: () => Promise<void>;
    /** Login form helpers */
    isAuthPanelOpen: boolean;
    openAuthPanel: () => void;
    closeAuthPanel: () => void;
    authEmail: string;
    setAuthEmail: (v: string) => void;
    authPassword: string;
    setAuthPassword: (v: string) => void;
    authSubmitting: boolean;
    authFeedback: string | null;
    handleAuthSubmit: (e: FormEvent<HTMLFormElement>) => void;
    handleLogout: () => void;
    /** Actions */
    handleGlobalAction: (type: "attack") => void;
    setGlobalStats: React.Dispatch<React.SetStateAction<GlobalStats>>;
    authMode: "login" | "signup";
    setAuthMode: React.Dispatch<React.SetStateAction<"login" | "signup">>;
    setAuthFeedback: React.Dispatch<React.SetStateAction<string | null>>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/* ------------------------------------------------------------------ */
/*  Provider                                                          */
/* ------------------------------------------------------------------ */

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [globalStats, setGlobalStats] = useState<GlobalStats>(INITIAL_STATS);
    const [authUser, setAuthUser] = useState<AuthUser | null>(null);
    const [isAuthPanelOpen, setIsAuthPanelOpen] = useState(false);
    const [authEmail, setAuthEmail] = useState("");
    const [authPassword, setAuthPassword] = useState("");
    const [authSubmitting, setAuthSubmitting] = useState(false);
    const [authFeedback, setAuthFeedback] = useState<string | null>(null);
    const [authMode, setAuthMode] = useState<"login" | "signup">("login");

    const syncProgressionFromApi = useCallback(async () => {
        try {
            const me = await getMe();
            if (!me.user) {
                setAuthUser(null);
                setGlobalStats(INITIAL_STATS);
                return;
            }

            setAuthUser(me.user);
            const progression = await getProgress();
            setGlobalStats((current) => ({
                ...current,
                hp: progression.vitals?.hp ?? current.hp,
                mana: progression.vitals?.mana ?? current.mana,
                xp: Math.max(0, Number(progression.xp) || 0),
                maxXp: Math.max(1, Number(progression.maxXp) || current.maxXp || 1),
                level: Math.max(1, Number(progression.level) || 1),
                rank: String(progression.rank || current.rank || "F"),
                gold: Math.max(0, Number(progression.gold) || 0),
                streak: typeof progression.streakDays === "number" ? progression.streakDays : current.streak,
            }));
        } catch {
            // Keep current UI state on transient API errors.
        }
    }, []);

    /* Auto-sync on mount */
    useEffect(() => {
        const timer = window.setTimeout(() => {
            void syncProgressionFromApi();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [syncProgressionFromApi]);

    const openAuthPanel = useCallback(() => {
        setAuthFeedback(null);
        if (authUser?.email) {
            setAuthEmail(authUser.email);
        }
        setIsAuthPanelOpen(true);
    }, [authUser?.email]);

    const closeAuthPanel = useCallback(() => setIsAuthPanelOpen(false), []);

    const handleAuthSubmit = useCallback(
        (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (authSubmitting) {
                return;
            }

            const email = authEmail.trim();
            const password = authPassword.trim();
            if (!email || !password) {
                setAuthFeedback("Informe email e senha.");
                return;
            }

            setAuthSubmitting(true);
            setAuthFeedback(null);
            void (async () => {
                try {
                    if (authMode === "signup") {
                        const { signup } = await import("../lib/api");
                        await signup(email, password);
                        setAuthFeedback("Conta criada com sucesso!");
                    } else {
                        await login(email, password);
                        setAuthFeedback("Login realizado com sucesso.");
                    }

                    setAuthPassword("");
                    await syncProgressionFromApi();

                    // Close panel slightly delayed to show success message?
                    // Or just close immediately if login.
                    // If signup, maybe show success and switch to login? 
                    // Actually signup usually logs you in directly in this backend.
                    // Yes, backend sets cookies on signup.
                    setIsAuthPanelOpen(false);
                } catch (authError) {
                    if (authError instanceof ApiRequestError) {
                        if (authError.status === 409) {
                            setAuthFeedback("Email ja registrado.");
                        } else if (authError.status === 401) {
                            setAuthFeedback("Credenciais invalidas.");
                        } else {
                            setAuthFeedback(authError.message || "Erro na autenticação.");
                        }
                    } else {
                        setAuthFeedback("Nao foi possivel conectar.");
                    }
                } finally {
                    setAuthSubmitting(false);
                }
            })();
        },
        [authEmail, authPassword, authSubmitting, authMode, syncProgressionFromApi],
    );

    const handleLogout = useCallback(() => {
        if (authSubmitting) {
            return;
        }

        setAuthSubmitting(true);
        setAuthFeedback(null);
        void (async () => {
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
        })();
    }, [authSubmitting, syncProgressionFromApi]);

    const handleGlobalAction = useCallback(
        (type: "attack") => {
            if (type === "attack") {
                void syncProgressionFromApi();
            }
        },
        [syncProgressionFromApi],
    );

    const value: AuthContextValue = {
        authUser,
        globalStats,
        syncProgressionFromApi,
        isAuthPanelOpen,
        openAuthPanel,
        closeAuthPanel,
        authEmail,
        setAuthEmail,
        authPassword,
        setAuthPassword,
        authSubmitting,
        authFeedback,
        handleAuthSubmit,
        handleLogout,
        handleGlobalAction,
        setGlobalStats,
        authMode,
        setAuthMode,
        setAuthFeedback,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error("useAuth must be used within <AuthProvider>");
    }
    return ctx;
}
