import { useNavigate } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import { Icon } from "../components/common/Icon";

export function AuthPanel() {
    const {
        authUser,
        isAuthPanelOpen,
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
    } = useAuth();

    const navigate = useNavigate();

    if (!isAuthPanelOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-label="Painel de login">
            <button
                className="absolute inset-0 bg-black/60 backdrop-blur-md transition-all duration-500 animate-in fade-in"
                onClick={closeAuthPanel}
                type="button"
                aria-label="Fechar painel de login"
            />
            <section className="relative z-10 w-full max-w-sm overflow-hidden rounded-[32px] border border-white/10 bg-[#0a0c12]/80 p-0 shadow-2xl backdrop-blur-xl transition-all duration-500 animate-in zoom-in-95 slide-in-from-bottom-4">
                {/* Header Gradient */}
                <div className="absolute top-0 h-32 w-full bg-gradient-to-b from-[hsl(var(--accent)/0.15)] to-transparent" />

                <div className="relative p-6 px-8 pt-8">
                    <div className="mb-8 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-black uppercase italic tracking-tighter text-white">
                                {authMode === "login" ? "System " : "New "}
                                <span className="text-[hsl(var(--accent))]">{authMode === "login" ? "Access" : "Operator"}</span>
                            </h2>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                {authMode === "login" ? "Credenciais de Operador" : "Registrar novo acesso"}
                            </p>
                        </div>
                        <button
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                            onClick={closeAuthPanel}
                            type="button"
                        >
                            <Icon name="cross" className="text-[18px]" />
                        </button>
                    </div>

                    {authUser ? (
                        <div className="space-y-6" data-testid="shell-auth-panel">
                            <div className="flex flex-col items-center gap-3 py-4">
                                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(var(--accent)/0.1)] text-[hsl(var(--accent))] shadow-[0_0_30px_hsl(var(--accent)/0.2)]">
                                    <Icon name="user" className="text-[48px]" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-bold text-white">{authUser.username || authUser.email}</p>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Online</p>
                                </div>
                            </div>

                            <button
                                className="group flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3.5 text-xs font-black uppercase tracking-wider text-red-400 transition-all hover:border-red-500/40 hover:bg-red-500/20 active:scale-95 disabled:opacity-60"
                                data-testid="shell-auth-logout"
                                disabled={authSubmitting}
                                onClick={handleLogout}
                                type="button"
                            >
                                <Icon name="sign-out-alt" className="transition-transform group-hover:-translate-x-1 text-base" />
                                {authSubmitting ? "Desconectando..." : "Desconectar"}
                            </button>
                        </div>
                    ) : (
                        <form className="space-y-4" data-testid="shell-auth-panel" onSubmit={handleAuthSubmit}>
                            <div className="space-y-1">
                                <label className="ml-1 text-[10px] font-black uppercase tracking-wider text-slate-400" htmlFor="auth-email">
                                    Email
                                </label>
                                <div className="relative group">
                                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-[hsl(var(--accent))]">
                                        <Icon name="envelope" className="text-base" />
                                    </div>
                                    <input
                                        id="auth-email"
                                        autoComplete="email"
                                        className="w-full rounded-xl border border-white/5 bg-black/40 py-3 pl-10 pr-4 text-sm font-medium text-white placeholder:text-slate-600 focus:border-[hsl(var(--accent)/0.5)] focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-[hsl(var(--accent)/0.5)] transition-all"
                                        data-testid="shell-auth-email"
                                        onChange={(event) => setAuthEmail(event.target.value)}
                                        placeholder="nome@exemplo.com"
                                        type="email"
                                        value={authEmail}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="ml-1 text-[10px] font-black uppercase tracking-wider text-slate-400" htmlFor="auth-password">
                                    Password
                                </label>
                                <div className="relative group">
                                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-[hsl(var(--accent))]">
                                        <Icon name="lock" className="text-base" />
                                    </div>
                                    <input
                                        id="auth-password"
                                        autoComplete="current-password"
                                        className="w-full rounded-xl border border-white/5 bg-black/40 py-3 pl-10 pr-4 text-sm font-medium text-white placeholder:text-slate-600 focus:border-[hsl(var(--accent)/0.5)] focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-[hsl(var(--accent)/0.5)] transition-all"
                                        data-testid="shell-auth-password"
                                        onChange={(event) => setAuthPassword(event.target.value)}
                                        placeholder="••••••••"
                                        type="password"
                                        value={authPassword}
                                    />
                                </div>
                            </div>

                            <button
                                className="group mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--accent))] px-4 py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-[0_0_20px_hsla(var(--accent),0.3)] transition-all hover:bg-[hsl(var(--accent-light))] hover:shadow-[0_0_30px_hsla(var(--accent),0.5)] active:scale-95 disabled:opacity-60"
                                data-testid="shell-auth-submit"
                                disabled={authSubmitting}
                                type="submit"
                            >
                                {authSubmitting ? (
                                    authMode === "login" ? "Autenticando..." : "Registrando..."
                                ) : (
                                    <>
                                        <Icon name="key" className="transition-transform group-hover:rotate-12 text-base" />
                                        {authMode === "login" ? "Acessar Sistema" : "Criar Credencial"}
                                    </>
                                )}
                            </button>

                            <div className="text-center">
                                <button
                                    className="text-[10px] font-bold uppercase tracking-wider text-slate-500 transition-colors hover:text-[hsl(var(--accent))]"
                                    disabled={authSubmitting}
                                    onClick={() => {
                                        setAuthMode(authMode === "login" ? "signup" : "login");
                                        setAuthFeedback(null);
                                    }}
                                    type="button"
                                >
                                    {authMode === "login" ? "Não possui acesso? Crie agora" : "Já possui conta? Acessar"}
                                </button>
                            </div>
                        </form>
                    )}

                    <div className="my-6 flex items-center gap-3">
                        <div className="h-px flex-1 bg-white/5" />
                        <span className="text-[10px] font-bold uppercase text-slate-600">Opções</span>
                        <div className="h-px flex-1 bg-white/5" />
                    </div>

                    <button
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-300 transition-all hover:border-white/10 hover:bg-white/10 hover:text-white active:scale-95"
                        data-testid="shell-open-core-settings"
                        onClick={() => {
                            closeAuthPanel();
                            navigate("/config");
                        }}
                        type="button"
                    >
                        <Icon name="settings" className="text-[14px]" />
                        Configurações do App
                    </button>

                    {authFeedback && (
                        <div className="mt-4 animate-in slide-in-from-bottom-2 fade-in rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-center text-xs font-bold text-red-200 shadow-lg">
                            {authFeedback}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
