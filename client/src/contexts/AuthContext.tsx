import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, createContext, useCallback, useContext, useMemo, useState } from "react";

import { ApiRequestError, getMe, getProgress, login, logout, signup } from "../lib/api";
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
    /** Refresh canonical server-state (/me + /progress) */
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
    authMode: "login" | "signup";
    setAuthMode: React.Dispatch<React.SetStateAction<"login" | "signup">>;
    setAuthFeedback: React.Dispatch<React.SetStateAction<string | null>>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/* ------------------------------------------------------------------ */
/*  Provider                                                          */
/* ------------------------------------------------------------------ */

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const queryClient = useQueryClient();
    const [isAuthPanelOpen, setIsAuthPanelOpen] = useState(false);
    const [authEmail, setAuthEmail] = useState("");
    const [authPassword, setAuthPassword] = useState("");
    const [authSubmitting, setAuthSubmitting] = useState(false);
    const [authFeedback, setAuthFeedback] = useState<string | null>(null);
    const [authMode, setAuthMode] = useState<"login" | "signup">("login");

    const meQuery = useQuery({
        queryKey: ["auth", "me"],
        queryFn: getMe,
        staleTime: 15_000,
        retry: 1,
    });

    const authUser = (meQuery.data?.user ?? null) as AuthUser | null;

    const progressQuery = useQuery({
        queryKey: ["auth", "progress", authUser?.id ?? "guest"],
        queryFn: getProgress,
        enabled: Boolean(authUser),
        staleTime: 15_000,
        retry: 1,
    });

    const globalStats = useMemo<GlobalStats>(() => {
        const progress = progressQuery.data;
        if (!authUser || !progress) {
            return INITIAL_STATS;
        }
        return {
            hp: Math.max(0, Number(progress.vitals?.hp ?? INITIAL_STATS.hp)),
            mana: Math.max(0, Number(progress.vitals?.mana ?? INITIAL_STATS.mana)),
            xp: Math.max(0, Number(progress.xp ?? INITIAL_STATS.xp)),
            maxXp: Math.max(1, Number(progress.maxXp ?? INITIAL_STATS.maxXp)),
            level: Math.max(1, Number(progress.level ?? INITIAL_STATS.level)),
            rank: String(progress.rank ?? INITIAL_STATS.rank),
            gold: Math.max(0, Number(progress.gold ?? INITIAL_STATS.gold)),
            streak: Math.max(0, Number(progress.streakDays ?? INITIAL_STATS.streak)),
        };
    }, [authUser, progressQuery.data]);

    const syncProgressionFromApi = useCallback(async () => {
        try {
            const me = await queryClient.fetchQuery({
                queryKey: ["auth", "me"],
                queryFn: getMe,
                staleTime: 0,
            });
            if (!me.user) {
                queryClient.removeQueries({ queryKey: ["auth", "progress"] });
                return;
            }
            await queryClient.fetchQuery({
                queryKey: ["auth", "progress", me.user.id],
                queryFn: getProgress,
                staleTime: 0,
            });
        } catch {
            // Keep current UI state on transient API errors.
        }
    }, [queryClient]);

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
                        await signup(email, password);
                        setAuthFeedback("Conta criada com sucesso!");
                    } else {
                        await login(email, password);
                        setAuthFeedback("Login realizado com sucesso.");
                    }

                    setAuthPassword("");
                    await syncProgressionFromApi();
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
