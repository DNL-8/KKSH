import { useNavigate } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";

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
    } = useAuth();

    const navigate = useNavigate();

    if (!isAuthPanelOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-label="Painel de login">
            <button
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={closeAuthPanel}
                type="button"
                aria-label="Fechar painel de login"
            />
            <section className="relative z-10 w-full max-w-md rounded-[24px] border border-slate-800 bg-[#0a0c12] p-6 shadow-2xl">
                <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
                    <h2 className="text-sm font-black uppercase tracking-[0.25em] text-white">Conexao API</h2>
                    <button
                        className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-black uppercase text-slate-300"
                        onClick={closeAuthPanel}
                        type="button"
                    >
                        Fechar
                    </button>
                </div>

                {authUser ? (
                    <div className="space-y-4" data-testid="shell-auth-panel">
                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-200">
                            Conectado como {authUser.email}
                        </div>
                        <button
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] font-black uppercase text-slate-200 transition-all hover:border-red-500/30 hover:text-red-300 disabled:opacity-60"
                            data-testid="shell-auth-logout"
                            disabled={authSubmitting}
                            onClick={handleLogout}
                            type="button"
                        >
                            {authSubmitting ? "Saindo..." : "Sair"}
                        </button>
                    </div>
                ) : (
                    <form className="space-y-3" data-testid="shell-auth-panel" onSubmit={handleAuthSubmit}>
                        <label className="sr-only" htmlFor="auth-email">Email</label>
                        <input
                            id="auth-email"
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-cyan-500/40 focus:outline-none"
                            data-testid="shell-auth-email"
                            onChange={(event) => setAuthEmail(event.target.value)}
                            placeholder="email"
                            type="email"
                            value={authEmail}
                        />
                        <label className="sr-only" htmlFor="auth-password">Senha</label>
                        <input
                            id="auth-password"
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-cyan-500/40 focus:outline-none"
                            data-testid="shell-auth-password"
                            onChange={(event) => setAuthPassword(event.target.value)}
                            placeholder="senha"
                            type="password"
                            value={authPassword}
                        />
                        <button
                            className="w-full rounded-lg border border-cyan-500/30 bg-cyan-600 px-3 py-2 text-[10px] font-black uppercase text-white transition-all hover:bg-cyan-500 disabled:opacity-60"
                            data-testid="shell-auth-submit"
                            disabled={authSubmitting}
                            type="submit"
                        >
                            {authSubmitting ? "Entrando..." : "Entrar"}
                        </button>
                    </form>
                )}

                <button
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-violet-500/30 bg-violet-600 px-3 py-2 text-[10px] font-black uppercase text-white transition-all hover:bg-violet-500"
                    data-testid="shell-open-core-settings"
                    onClick={() => {
                        closeAuthPanel();
                        navigate("/config");
                    }}
                    type="button"
                >
                    Ajustes de Nucleo
                </button>

                {authFeedback && (
                    <div className="mt-3 rounded-xl border border-slate-700 bg-slate-900/70 p-2 text-xs font-semibold text-slate-300" role="status">
                        {authFeedback}
                    </div>
                )}
            </section>
        </div>
    );
}
