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
  const { authUser, openAuthPanel, syncProgressionFromApi, navigateTo } = useOutletContext<AppShellContextValue>();
  const { themeId, setTheme } = useTheme();
  const { showToast } = useToast();

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
      await syncProgressionFromApi();

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
      await syncProgressionFromApi();
      showToast("Desconexao neural completa. Ate logo, Cacador.", "success");
    } catch {
      showToast("Erro ao encerrar link neural. Forcando desconexao local...", "error");
      await syncProgressionFromApi();
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
                </label>
                <div className="flex flex-wrap gap-4">
                  {/* Theme options customized */}
                  <ThemeOption color="bg-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.4)]" active={themeId === "cyan"} onClick={() => setTheme("cyan" as ThemeId)} label="Neon Cyan" />
                  <ThemeOption color="bg-red-600 shadow-[0_0_20px_rgba(220,38,38,0.4)]" active={themeId === "red"} onClick={() => setTheme("red" as ThemeId)} label="Red Alert" />
                  <ThemeOption color="bg-purple-600 shadow-[0_0_20px_rgba(147,51,234,0.4)]" active={themeId === "purple"} onClick={() => setTheme("purple" as ThemeId)} label="Synthwave" />
                  <ThemeOption color="bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)]" active={themeId === "emerald"} onClick={() => setTheme("emerald" as ThemeId)} label="Matrix" />
                  <ThemeOption color="bg-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.4)]" active={themeId === "orange"} onClick={() => setTheme("orange" as ThemeId)} label="Amber" />
                  <ThemeOption color="bg-[#00af00] border border-green-400 shadow-[0_0_20px_rgba(0,175,0,0.6)]" active={themeId === "matrix"} onClick={() => setTheme("matrix" as ThemeId)} label="Code" />
                  <ThemeOption color="bg-[#0b1c35] border border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.6)]" active={themeId === "sololeveling"} onClick={() => setTheme("sololeveling" as ThemeId)} label="Monarch" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <DetailedToggle
                  label="Glitch FX"
                  desc="Artefatos visuais de instabilidade do sistema."
                  active={glitchEffects}
                  onClick={() => setGlitchEffects((v) => !v)}
                  icon={Activity}
                />
                <DetailedToggle label="Modo Furtivo" desc="Oculta status online de outros caçadores." active={stealthMode} onClick={() => setStealthMode(v => !v)} icon={EyeOff} />
              </div>
            </div>
          </section>

          {/* AI Settings */}
          <section className="group relative overflow-hidden rounded-[32px] border border-slate-800 bg-[#0a0a0b]/60 p-8 backdrop-blur-xl transition-all hover:border-blue-500/30">
            <div className="mb-8 flex items-center gap-4 border-b border-slate-800/50 pb-6">
              <div className="rounded-xl bg-blue-500/10 p-3 text-blue-500">
                <Bot size={24} />
              </div>
              <h2 className="text-xl font-bold uppercase tracking-widest text-white">I.A. Assistente</h2>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
              <div className="space-y-4">
                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  <Key size={12} /> Chave API (Gemini)
                </label>
                <input
                  type="password"
                  value={aiSettings.apiKey}
                  onChange={(e) => setAiSettings((prev) => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="Cole sua chave aqui..."
                  className="w-full rounded-xl border border-slate-800 bg-[#050506] px-4 py-3 text-xs font-mono text-white placeholder-slate-700 outline-none transition-all focus:border-blue-500/50 focus:bg-blue-500/5 focus:shadow-[0_0_20px_rgba(59,130,246,0.2)]"
                />
              </div>

              <div className="space-y-4">
                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  <Cpu size={12} /> Personalidade
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {["standard", "hardcore", "zen", "gamer"].map((p) => (
                    <button
                      key={p}
                      onClick={() => setAiSettings((prev) => ({ ...prev, personality: p }))}
                      className={`rounded-lg border px-3 py-2 text-[10px] font-bold uppercase transition-all ${aiSettings.personality === p
                        ? "border-blue-500 bg-blue-500/20 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                        : "border-slate-800 bg-[#050506] text-slate-600 hover:border-slate-600"
                        }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button
                onClick={() => void saveAiSettings()}
                disabled={aiSettings.saving || aiSettings.loading}
                className="flex items-center gap-2 rounded-xl bg-blue-600/10 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-blue-500 border border-blue-500/20 hover:bg-blue-600 hover:text-white transition-all hover:shadow-[0_0_30px_rgba(37,99,235,0.4)] active:scale-95 disabled:opacity-50"
                type="button"
              >
                {aiSettings.saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                {aiSettings.saving ? "Sincronizando..." : "Salvar Configuração"}
              </button>
            </div>
          </section>

        </div>

        {/* Right Column: Difficulty & Danger Zone */}
        <div className="space-y-12 lg:col-span-4">

          {/* Difficulty Selection */}
          <section className="rounded-[32px] border border-slate-800 bg-[#0a0a0b]/60 p-8">
            <div className="mb-6 flex items-center gap-4">
              <div className="rounded-xl bg-orange-500/10 p-3 text-orange-500"><Zap size={24} /></div>
              <h2 className="text-lg font-bold uppercase tracking-widest text-white">Dificuldade</h2>
            </div>

            <div className="space-y-4">
              {["Iniciado", "Cacador", "Monarca"].map((level) => {
                const id = level.toLowerCase();
                const isActive = difficulty === id;
                return (
                  <button
                    key={id}
                    onClick={() => setDifficulty(id)}
                    className={`group relative w-full overflow-hidden rounded-2xl border p-4 text-left transition-all ${isActive
                      ? "border-orange-500 bg-orange-500/10 shadow-[0_0_20px_rgba(249,115,22,0.15)]"
                      : "border-slate-800 bg-[#050506] hover:border-slate-700"
                      }`}
                    type="button"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-black uppercase tracking-widest ${isActive ? "text-orange-500" : "text-slate-500 group-hover:text-slate-300"}`}>{level}</span>
                      {isActive && <CheckCircle2 size={16} className="text-orange-500" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* DANGER ZONE */}
          <section className="relative overflow-hidden rounded-[32px] border border-red-900/40 bg-[#0f0505] p-8 before:absolute before:inset-0 before:bg-[url('/noise.png')] before:opacity-5">
            <div className="relative z-10">
              <div className="mb-6 flex items-center gap-4 text-red-500">
                <AlertTriangle size={24} className="animate-pulse" />
                <h2 className="text-lg font-black uppercase tracking-widest">Zona de Perigo</h2>
              </div>

              <p className="mb-8 text-[10px] font-medium leading-relaxed text-red-500/60">
                Ações nesta zona são irreversíveis. O protocolo de 'Hard Reset' resultará na perda total de XP, Itens e Conquistas.
              </p>

              <div className="space-y-4">
                <button
                  onClick={() => setResetModalOpen(true)}
                  className="group flex w-full items-center justify-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-red-500 transition-all hover:bg-red-500 hover:text-black hover:shadow-[0_0_30px_rgba(239,68,68,0.4)]"
                  type="button"
                >
                  <Trash2 size={14} className="transition-transform group-hover:rotate-12" />
                  Hard Reset
                </button>

                <button
                  onClick={() => void handleSystemLogout()}
                  disabled={dangerBusy !== null}
                  className="w-full rounded-xl border border-slate-800 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 transition-all hover:bg-slate-800 hover:text-white"
                  type="button"
                >
                  {dangerBusy === "logout" ? "Desconectando..." : "Logout"}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* HARD RESET CONFIRMATION MODAL */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-lg rounded-3xl border border-red-500 bg-[#0a0505] p-10 shadow-[0_0_100px_rgba(220,38,38,0.3)]">
            <div className="mb-8 flex flex-col items-center text-center">
              <div className="mb-6 rounded-full bg-red-500/10 p-6 text-red-500 shadow-[0_0_50px_rgba(220,38,38,0.2)]">
                <Skull size={48} />
              </div>
              <h3 className="text-2xl font-black uppercase tracking-[0.2em] text-white">Confirmação Final</h3>
              <p className="mt-2 text-xs font-bold uppercase tracking-widest text-red-500">Exterminar todo o progresso?</p>
            </div>

            <div className="mb-8 space-y-4 rounded-xl border border-red-900/30 bg-red-950/10 p-6">
              <div className="flex items-center gap-3 text-red-400">
                <XCircle size={16} />
                <span className="text-[10px] font-bold uppercase tracking-wide">Nível do Jogador → 1</span>
              </div>
              <div className="flex items-center gap-3 text-red-400">
                <XCircle size={16} />
                <span className="text-[10px] font-bold uppercase tracking-wide">Inventário → Vazio</span>
              </div>
              <div className="flex items-center gap-3 text-red-400">
                <XCircle size={16} />
                <span className="text-[10px] font-bold uppercase tracking-wide">Rank → Iniciado</span>
              </div>
            </div>

            <div className="space-y-4">
              <HoldButton
                label="SEGURE PARA DELETAR TUDO"
                onComplete={() => void executeHardReset()}
                loading={dangerBusy === "reset"}
                className="w-full rounded-xl bg-red-600 py-4 text-xs font-black uppercase tracking-[0.2em] text-white shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
              />

              <button
                onClick={() => setResetModalOpen(false)}
                className="w-full rounded-xl border border-slate-800 py-4 text-xs font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-800 hover:text-white"
                type="button"
              >
                Cancelar Operação
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
