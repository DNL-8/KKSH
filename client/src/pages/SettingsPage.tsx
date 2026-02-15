import {
  AlertTriangle,
  EyeOff,
  Palette,
  RefreshCw,
  Skull,
  Zap,
  Bot,
  Key,
  Save,
  CheckCircle2,
  XCircle,
  Cpu,
  Activity,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";

import { DetailedToggle, ThemeOption } from "../components/common";
import { useToast } from "../components/common/Toast";
import { useTheme, type ThemeId } from "../contexts/ThemeContext";
import { ApiRequestError, getMeState, logout, resetMeState, updateSettings } from "../lib/api";
import type { AppShellContextValue } from "../layout/types";

/* ------------------------------------------------------------------ */
/*  Hook: persist simple values in localStorage                       */
/* ------------------------------------------------------------------ */

function usePersistedState<T>(key: string, fallback: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored !== null ? (JSON.parse(stored) as T) : fallback;
    } catch {
      return fallback;
    }
  });

  const setPersisted: React.Dispatch<React.SetStateAction<T>> = (action) => {
    setValue((prev) => {
      const next = typeof action === "function" ? (action as (p: T) => T)(prev) : action;
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* ignore full storage */
      }
      return next;
    });
  };

  return [value, setPersisted];
}

/* ------------------------------------------------------------------ */
/*  Component: Hold-to-Confirm Button                                 */
/* ------------------------------------------------------------------ */

interface HoldButtonProps {
  onComplete: () => void;
  label: string;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

function HoldButton({ onComplete, label, loading, disabled, className }: HoldButtonProps) {
  const [holding, setHolding] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | number | null>(null);

  const HOLD_DURATION = 2000; // 2 seconds

  const startHold = () => {
    if (disabled || loading) return;
    setHolding(true);
    timeoutRef.current = setTimeout(() => {
      onComplete();
      setHolding(false);
    }, HOLD_DURATION);
  };

  const endHold = () => {
    setHolding(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current as NodeJS.Timeout);
      timeoutRef.current = null;
    }
  };

  return (
    <button
      onMouseDown={startHold}
      onMouseUp={endHold}
      onMouseLeave={endHold}
      onTouchStart={startHold}
      onTouchEnd={endHold}
      disabled={disabled || loading}
      type="button"
      className={`relative overflow-hidden ${className} select-none`}
    >
      <div
        className={`absolute inset-0 bg-red-600 transition-transform duration-[2000ms] ease-linear origin-left ${holding ? 'scale-x-100' : 'scale-x-0'}`}
        style={{ transitionProperty: 'transform' }}
      />
      <span className="relative z-10 flex items-center justify-center gap-2">
        {loading ? (
          <>
            <RefreshCw size={16} className="animate-spin" />
            <span>PROCESSANDO...</span>
          </>
        ) : (
          <>
            {holding ? "SEGURE PARA CONFIRMAR..." : label}
          </>
        )}
      </span>
    </button>
  );
}


/* ------------------------------------------------------------------ */
/*  Page: Settings                                                    */
/* ------------------------------------------------------------------ */

export function SettingsPage() {
  const { authUser, openAuthPanel, navigateTo } = useOutletContext<AppShellContextValue>();
  const { themeId, setTheme } = useTheme();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [difficulty, setDifficulty] = usePersistedState("cmd8_difficulty", "cacador");
  const [stealthMode, setStealthMode] = usePersistedState("cmd8_stealth", false);
  const [glitchEffects, setGlitchEffects] = usePersistedState("cmd8_glitch", true);

  const [dangerBusy, setDangerBusy] = useState<"reset" | "logout" | null>(null);
  const [resetModalOpen, setResetModalOpen] = useState(false);

  // AI Settings State
  const [aiSettings, setAiSettings] = useState({
    apiKey: "",
    personality: "standard",
    loading: true,
    saving: false,
  });

  const invalidateProgressCaches = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] }),
      queryClient.invalidateQueries({ queryKey: ["auth", "progress"] }),
      queryClient.invalidateQueries({ queryKey: ["hub-state"] }),
      queryClient.invalidateQueries({ queryKey: ["evolution-state"] }),
    ]);
  };

  // Load user settings on mount
  useEffect(() => {
    if (!authUser) return;
    getMeState()
      .then((state) => {
        if (state.settings) {
          setAiSettings((prev) => ({
            ...prev,
            apiKey: state.settings?.geminiApiKey || "",
            personality: state.settings?.agentPersonality || "standard",
            loading: false,
          }));
        }
      })
      .catch(() => {
        setAiSettings((prev) => ({ ...prev, loading: false }));
      });
  }, [authUser]);

  async function saveAiSettings() {
    if (aiSettings.saving) return;
    setAiSettings((prev) => ({ ...prev, saving: true }));
    try {
      await updateSettings({
        geminiApiKey: aiSettings.apiKey,
        agentPersonality: aiSettings.personality,
      });
      showToast("Protocolos de IA atualizados com sucesso.", "success");
    } catch {
      showToast("Falha na sincronizacao dos protocolos de IA.", "error");
    } finally {
      setAiSettings((prev) => ({ ...prev, saving: false }));
    }
  }

  async function executeHardReset() {
    if (dangerBusy) return;

    if (!authUser) {
      showToast("Autenticacao requerida para operacoes de nivel critico.", "error");
      openAuthPanel();
      return;
    }

    setDangerBusy("reset");
    try {
      // Force all scopes for a 'Hard Reset'
      const output = await resetMeState(["all"]);
      await invalidateProgressCaches();

      try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith("cmd8_") || key === "theme-preference")) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
      } catch (e) {
        console.warn("Failed to clear local storage", e);
      }

      const totalOps = Object.values(output.summary ?? {}).reduce((acc, value) => acc + Number(value || 0), 0);
      showToast(`HARD RESET CONCLUIDO. ${totalOps} registros purgados. Sistema reiniciado.`, "success");
      setResetModalOpen(false);
    } catch (error) {
      let msg = "FALHA CRITICA NO RESET: Erro desconhecido.";

      if (error instanceof ApiRequestError) {
        if (error.status === 401) {
          msg = "Sessao expirada via terminal neural.";
          openAuthPanel();
        } else if (error.status === 429) {
          msg = "RATE LIMIT: Muitas tentativas. Aguarde 1 minuto.";
        } else {
          msg = `ERRO DE SERVIDOR (${error.status}): ${error.message || error.code}`;
        }
      } else if (error instanceof Error) {
        msg = `ERRO INTERNO: ${error.message}`;
      }

      showToast(msg, "error");
    } finally {
      setDangerBusy(null);
    }
  }

  async function handleSystemLogout() {
    if (dangerBusy) return;

    if (!authUser) {
      showToast("Nenhuma conexao neural ativa.", "info");
      return;
    }

    setDangerBusy("logout");
    try {
      await logout();
      await invalidateProgressCaches();
      showToast("Desconexao neural completa. Ate logo, Cacador.", "success");
    } catch {
      showToast("Erro ao encerrar link neural. Forcando desconexao local...", "error");
      await invalidateProgressCaches();
    } finally {
      setDangerBusy(null);
      navigateTo("/hub");
    }
  }

  return (
    <div className="mx-auto max-w-6xl animate-in fade-in space-y-12 pb-32 pt-8 duration-700">

      {/* Header Visual */}
      <div className="relative mb-12 overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-r from-[#0a0a0b] to-[#111] p-8 md:p-12">
        <div className="absolute -right-20 -top-20 opacity-10 blur-3xl">
          <div className="h-96 w-96 rounded-full bg-[hsl(var(--accent))]" />
        </div>
        <div className="relative z-10">
          <h1 className="text-4xl font-black uppercase tracking-[0.2em] text-white md:text-6xl italic">
            Config<span className="text-[hsl(var(--accent))]">.Sys</span>
          </h1>
          <p className="mt-4 max-w-xl text-xs font-bold uppercase tracking-[0.3em] text-slate-500">
            Painel de Controle Neural v4.2 // Acesso Root
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">

        {/* Left Column: Visual & System Settings */}
        <div className="space-y-12 lg:col-span-8">

          {/* Visual Interface */}
          <section className="group relative overflow-hidden rounded-[32px] border border-slate-800 bg-[#0a0a0b]/60 p-8 backdrop-blur-xl transition-all hover:border-[hsl(var(--accent)/0.3)]">
            <div className="mb-8 flex items-center gap-4 border-b border-slate-800/50 pb-6">
              <div className="rounded-xl bg-[hsl(var(--accent)/0.1)] p-3 text-[hsl(var(--accent))]">
                <Palette size={24} />
              </div>
              <h2 className="text-xl font-bold uppercase tracking-widest text-white">Interface Neural</h2>
            </div>

            <div className="space-y-8">
              <div>
                <label className="mb-4 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Sincronia Cromatica
                  navigate("/");
    } catch {
                    setDangerBusy(null);
    }
  }, [logout, navigate]);

                  return (
                  <div className="animate-in fade-in slide-in-from-bottom-8 duration-700" data-testid="settings-page">
                    <div className="mx-auto max-w-4xl space-y-8 pb-20">
                      {/* Header */}
                      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-2">
                          <h1 className="glitch-text text-4xl font-black uppercase italic tracking-tighter text-white md:text-6xl" data-text="SISTEMA">
                            SISTEMA
                          </h1>
                          <p className="flex items-center gap-2 font-mono text-sm text-slate-400">
                            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                            CONFIGURACAO DO TERMINAL DO USUARIO
                          </p>
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={handleSave}
                            className="flex items-center gap-3 rounded-2xl bg-slate-800 px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-slate-700 active:scale-95"
                            type="button"
                          >
                            <Icon name="disk" className="text-[16px]" />
                            Salvar Alteracoes
                          </button>
                        </div>
                      </div>

                      {/* Profile Section */}
                      <div className="overflow-hidden rounded-[40px] border border-slate-800 bg-[#0a0a0b]/60 p-1 shadow-2xl backdrop-blur-xl">
                        <div className="relative overflow-hidden rounded-[36px] bg-slate-900/50 p-8 md:p-12">
                          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-transparent opacity-50" />

                          <div className="relative z-10 flex flex-col gap-8 md:flex-row md:items-start">
                            <div className="relative group">
                              <div className="absolute inset-0 -inset-1 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 blur opacity-25 group-hover:opacity-75 transition duration-500" />
                              <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-slate-700 bg-slate-800 p-1 md:h-32 md:w-32">
                                {user?.avatar_url ? (
                                  <img src={user.avatar_url} alt="Profile" className="h-full w-full rounded-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-900 text-slate-600">
                                    <Icon name="robot" className="h-10 w-10 md:h-12 md:w-12 text-[48px]" />
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                className="absolute bottom-0 right-0 rounded-full bg-slate-800 p-2 text-white shadow-lg transition-transform hover:scale-110 hover:bg-cyan-600"
                              >
                                <Icon name="pencil" className="text-[14px]" />
                              </button>
                            </div>

                            <div className="flex-1 space-y-4">
                              <div className="flex flex-wrap items-center gap-3">
                                <h2 className="text-2xl font-black uppercase tracking-tight text-white md:text-3xl">
                                  {profile?.username ?? "Anonimo"}
                                </h2>
                                <Badge color="bg-cyan-500/10 text-cyan-400 border-cyan-500/20" icon="check-circle">
                                  Verificado
                                </Badge>
                                <Badge color="bg-purple-500/10 text-purple-400 border-purple-500/20" icon="crown">
                                  Premium
                                </Badge>
                              </div>

                              <div className="grid gap-4 md:grid-cols-2">
                                <div className="rounded-2xl bg-slate-950/50 p-4">
                                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">ID do Usuario</span>
                                  <code className="font-mono text-xs text-slate-300">{user?.id}</code>
                                </div>
                                <div className="rounded-2xl bg-slate-950/50 p-4">
                                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Email</span>
                                  <div className="flex items-center justify-between">
                                    <code className="font-mono text-xs text-slate-300">{user?.email}</code>
                                    <Icon name="key" className="text-slate-600 text-[14px]" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-8 lg:grid-cols-12">
                        {/* Main Settings */}
                        <div className="space-y-8 lg:col-span-8">
                          {/* Visual Preferences */}
                          <section>
                            <div className="mb-6 flex items-center gap-4">
                              <div className="rounded-xl bg-cyan-500/10 p-3 text-cyan-500"><Icon name="palette" className="text-[24px]" /></div>
                              <h2 className="text-lg font-bold uppercase tracking-widest text-white">Interface Visual</h2>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                              <DetailedToggle
                                label="Efeitos Glitch"
                                desc="Artefatos visuais de instabilidade do sistema."
                                active={glitchEffects}
                                onClick={() => setGlitchEffects(v => !v)}
                                icon="activity"
                              />
                              <DetailedToggle label="Modo Furtivo" desc="Oculta status online de outros caçadores." active={stealthMode} onClick={() => setStealthMode(v => !v)} icon="eye-crossed" />
                            </div>
                          </section>

                          {/* System Preferences */}
                          <section>
                            <div className="mb-6 flex items-center gap-4">
                              <div className="rounded-xl bg-purple-500/10 p-3 text-purple-500"><Icon name="cpu" className="text-[24px]" /></div>
                              <h2 className="text-lg font-bold uppercase tracking-widest text-white">Sistema</h2>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                              <DetailedToggle
                                label="Notificacoes"
                                desc="Alertas de missoes e atualizacoes do sistema."
                                active={notifications}
                                onClick={() => setNotifications(!notifications)}
                              />
                              <DetailedToggle
                                label="Efeitos Sonoros"
                                desc="Feedback auditivo de interacoes e combate."
                                active={soundEffects}
                                onClick={() => setSoundEffects(!soundEffects)}
                              />
                            </div>
                          </section>

                          {/* Danger Zone */}
                          <section className="relative overflow-hidden rounded-[32px] border border-red-900/30 bg-red-950/5 p-8">
                            <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(220,38,38,0.05)_10px,rgba(220,38,38,0.05)_20px)]" />

                            <div className="relative z-10">
                              <div className="mb-6 flex items-center gap-4 text-red-500">
                                <Icon name="exclamation" className="animate-pulse text-[24px]" />
                                <h2 className="text-lg font-black uppercase tracking-widest">Zona de Perigo</h2>
                              </div>

                              <div className="space-y-4">
                                <div className="flex flex-col gap-4 rounded-2xl bg-red-500/5 p-6 md:flex-row md:items-center md:justify-between">
                                  <div>
                                    <h3 className="font-bold text-white">Resetar Progresso Local</h3>
                                    <p className="text-sm text-red-200/60">Limpa cache e dados temporarios. Nao apaga conta.</p>
                                  </div>
                                  <HoldButton
                                    label="SEGURE PARA DELETAR TUDO"
                                    onComplete={() => void executeHardReset()}
                                    loading={dangerBusy === "reset"}
                                    className="w-full rounded-xl bg-red-600 py-4 text-xs font-black uppercase tracking-[0.2em] text-white shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:grayscale md:w-auto md:px-8"
                                  />
                                </div>

                                <div className="flex flex-col gap-4 rounded-2xl bg-red-500/5 p-6 md:flex-row md:items-center md:justify-between">
                                  <div>
                                    <h3 className="font-bold text-white">Encerrar Sessao</h3>
                                    <p className="text-sm text-red-200/60">Desconecta do terminal com segurança.</p>
                                  </div>
                                  <button
                                    onClick={() => void handleLogout()}
                                    disabled={dangerBusy === "logout"}
                                    className="flex items-center justify-center gap-2 w-full rounded-xl border border-red-500/30 bg-transparent py-4 text-xs font-black uppercase tracking-[0.2em] text-red-400 transition-all hover:bg-red-500/10 active:scale-95 md:w-auto md:px-8"
                                    type="button"
                                  >
                                    <Icon name="trash" className="text-[16px]" />
                                    Desconectar
                                  </button>
                                </div>
                              </div>
                            </div>
                          </section>
                        </div>

                        {/* Sidebar Settings (Theme) */}
                        <div className="lg:col-span-4">
                          <div className="sticky top-24 space-y-6">
                            <div className="rounded-[32px] border border-slate-800 bg-[#0a0a0b]/80 p-6 backdrop-blur-xl">
                              <div className="mb-6 flex items-center gap-4">
                                <div className="rounded-xl bg-orange-500/10 p-3 text-orange-500"><Icon name="bolt" className="text-[24px]" /></div>
                                <h2 className="text-lg font-bold uppercase tracking-widest text-white">Dificuldade</h2>
                              </div>

                              <div className="flex flex-col gap-2">
                                <div className="rounded-2xl bg-slate-900 p-4 border border-slate-800 opacity-50 grayscale cursor-not-allowed">
                                  <div className="flex justify-between items-center mb-2">
                                    <span className="font-black text-white uppercase tracking-wider">Casual</span>
                                    <Icon name="cross-circle" className="text-slate-600 text-[18px]" />
                                  </div>
                                  <p className="text-xs text-slate-500">Modo historia sem desafios.</p>
                                </div>
                                <div className="rounded-2xl bg-red-900/20 p-4 border border-red-500/20 relative overflow-hidden">
                                  <div className="absolute top-0 right-0 p-2 text-red-500"><Icon name="skull" className="text-[14px]" /></div>
                                  <div className="flex justify-between items-center mb-2">
                                    <span className="font-black text-white uppercase tracking-wider">Hardcore</span>
                                    <Icon name="check-circle" className="text-red-500 text-[18px]" />
                                  </div>
                                  <p className="text-xs text-red-200/60">Dano permanente. Boot loops reais.</p>
                                </div>
                              </div>
                            </div>

                            <div className="rounded-[32px] border border-slate-800 bg-[#0a0a0b]/80 p-6 backdrop-blur-xl">
                              <div className="mb-6 flex items-center justify-between">
                                <h2 className="text-lg font-bold uppercase tracking-widest text-white">Tema</h2>
                                <Icon name="refresh" className="text-slate-600 animate-spin-slow text-[16px]" />
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                {THEME_PRESETS.map(preset => (
                                  <ThemeOption
                                    key={preset.id}
                                    label={preset.name}
                                    color={preset.color}
                                    active={theme === preset.id}
                                    onClick={() => setTheme(preset.id)}
                                  />
                                ))}
                              </div>
                            </div>

                            <div className="rounded-[32px] bg-gradient-to-br from-[#0a0a0b] to-slate-950 p-8 text-center border border-slate-800 shadow-xl">
                              <div className="mb-6 rounded-full bg-red-500/10 p-6 text-red-500 shadow-[0_0_50px_rgba(220,38,38,0.2)] inline-block">
                                <Icon name="skull" className="text-[48px]" />
                              </div>
                              <h3 className="text-xl font-black text-white uppercase italic tracking-tighter mb-2">Build v0.9.4</h3>
                              <p className="text-xs font-mono text-slate-500">COMPILADO: 2024-05-20</p>
                              <div className="mt-6 flex justify-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-700" />
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-700" />
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-700" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  );
}
