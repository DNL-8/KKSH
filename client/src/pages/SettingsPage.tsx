import {
  AlertTriangle,
  EyeOff,
  Globe,
  Lock,
  Monitor,
  Palette,
  RefreshCw,
  ShieldCheck,
  Skull,
  Target,
  Zap,
  Bot,
  Key,
  Save,
} from "lucide-react";
import { useEffect, useState } from "react";
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

export function SettingsPage() {
  const { authUser, openAuthPanel, syncProgressionFromApi, navigateTo } = useOutletContext<AppShellContextValue>();
  const { themeId, setTheme } = useTheme();
  const { showToast } = useToast();

  const [difficulty, setDifficulty] = usePersistedState("cmd8_difficulty", "cacador");
  const [stealthMode, setStealthMode] = usePersistedState("cmd8_stealth", false);
  const [glitchEffects, setGlitchEffects] = usePersistedState("cmd8_glitch", true);

  const [dangerBusy, setDangerBusy] = useState<"reset" | "logout" | null>(null);
  const [dangerFeedback, setDangerFeedback] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const [aiSettings, setAiSettings] = useState({
    apiKey: "",
    personality: "standard",
    loading: true,
    saving: false,
  });

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
      // success toast or feedback? reusing dangerFeedback for now or add new state?
      // actually let's use a local simple feedback
      showToast("Configurações de IA salvas com sucesso.", "success");
    } catch {
      showToast("Erro ao salvar configurações.", "error");
    } finally {
      setAiSettings((prev) => ({ ...prev, saving: false }));
    }
  }

  const [confirmingReset, setConfirmingReset] = useState(false);

  useEffect(() => {
    if (confirmingReset) {
      const timer = setTimeout(() => setConfirmingReset(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [confirmingReset]);

  async function handleHardReset() {
    if (dangerBusy) return;

    if (!authUser) {
      setDangerFeedback({ type: "info", text: "Faca login para executar o hard reset." });
      openAuthPanel();
      return;
    }

    if (!confirmingReset) {
      setConfirmingReset(true);
      return;
    }

    setDangerBusy("reset");
    setDangerFeedback(null);
    setConfirmingReset(false);

    try {
      const output = await resetMeState(["all"]);
      await syncProgressionFromApi();

      const totalOps = Object.values(output.summary ?? {}).reduce((acc, value) => acc + Number(value || 0), 0);
      setDangerFeedback({
        type: "success",
        text: `Hard reset concluido. Escopos: ${output.applied.join(", ")}. Total de operacoes: ${totalOps}.`,
      });
    } catch (error) {
      if (error instanceof ApiRequestError) {
        if (error.status === 401) {
          setDangerFeedback({ type: "error", text: "Sessao expirada. Faca login novamente." });
          openAuthPanel();
        } else {
          setDangerFeedback({ type: "error", text: error.message || "Falha ao executar hard reset." });
        }
      } else {
        setDangerFeedback({ type: "error", text: "Falha ao executar hard reset." });
      }
    } finally {
      setDangerBusy(null);
    }
  }

  async function handleSystemLogout() {
    if (dangerBusy) return;

    if (!authUser) {
      setDangerFeedback({ type: "info", text: "Voce ja esta desconectado." });
      return;
    }

    setDangerBusy("logout");
    setDangerFeedback(null);

    try {
      await logout();
      await syncProgressionFromApi();
      setDangerFeedback({ type: "success", text: "Ligacao neural encerrada com sucesso." });
    } catch (error) {
      // Even if API fails, we want to clear local state and redirect
      if (error instanceof ApiRequestError) {
        setDangerFeedback({ type: "error", text: error.message || "Falha ao sair do sistema." });
      } else {
        setDangerFeedback({ type: "error", text: "Falha ao sair do sistema." });
      }
      // Force sync to clear authUser if possible (api client handles 401)
      await syncProgressionFromApi();
    } finally {
      setDangerBusy(null);
      navigateTo("/hub");
    }
  }

  return (
    <div className="mx-auto max-w-5xl animate-in fade-in space-y-10 pb-20 duration-500">
      <section className="relative space-y-10 overflow-hidden rounded-[40px] border border-slate-800 bg-[#0a0a0b]/80 p-10 shadow-2xl backdrop-blur-xl">
        <div className="absolute right-0 top-0 p-10 opacity-5">
          <Palette size={150} />
        </div>
        <div className="flex items-center gap-6 border-b border-slate-800 pb-8">
          <div className="rounded-2xl border border-[hsl(var(--accent)/0.2)] bg-[hsl(var(--accent)/0.1)] p-4 shadow-xl">
            <Monitor size={32} className="text-[hsl(var(--accent))]" />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase italic tracking-[0.2em] text-white">Interface Neural (HUD)</h2>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Configuracao estetica do sistema</p>
          </div>
        </div>

        <div className="space-y-10">
          <div>
            <label className="mb-6 block text-[11px] font-black uppercase tracking-[0.3em] text-slate-500">
              Espectro Cromatico do Sistema
            </label>
            <div className="flex flex-wrap gap-8">
              <ThemeOption color="bg-cyan-500" active={themeId === "cyan"} onClick={() => setTheme("cyan" as ThemeId)} label="Ciano" />
              <ThemeOption color="bg-red-600" active={themeId === "red"} onClick={() => setTheme("red" as ThemeId)} label="Carmesim" />
              <ThemeOption color="bg-purple-600" active={themeId === "purple"} onClick={() => setTheme("purple" as ThemeId)} label="Violeta" />
              <ThemeOption color="bg-emerald-500" active={themeId === "emerald"} onClick={() => setTheme("emerald" as ThemeId)} label="Esmeralda" />
              <ThemeOption color="bg-orange-500" active={themeId === "orange"} onClick={() => setTheme("orange" as ThemeId)} label="Ambar" />
              <ThemeOption color="bg-[#00af00]" active={themeId === "matrix"} onClick={() => setTheme("matrix" as ThemeId)} label="Matrix" />
              <ThemeOption color="bg-[#0b1c35] border-blue-500" active={themeId === "sololeveling"} onClick={() => setTheme("sololeveling" as ThemeId)} label="Solo Leveling" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 pt-4 md:grid-cols-2">
            <DetailedToggle
              label="Efeitos de Glitch"
              desc="Simula instabilidade neural ao sofrer dano critico ou falha em missoes."
              active={glitchEffects}
              onClick={() => setGlitchEffects((value) => !value)}
            />
            <DetailedToggle label="Scanlines Dinamicos" desc="Aplica textura retro-tecnologica CRT em tempo real na interface." active />
            <DetailedToggle label="HUD Flutuante" desc="Maximiza imersao ocultando barras estaticas em modo de combate." active />
            <DetailedToggle label="Sincronia de Audio" desc="Efeitos sonoros espaciais de alta fidelidade para acoes de interface." active />
          </div>
        </div>
      </section>

      <section className="relative rounded-[40px] border border-slate-800 bg-[#0a0a0b]/80 p-10 shadow-2xl">
        <div className="mb-10 flex items-center gap-6 border-b border-slate-800 pb-8">
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 shadow-xl">
            <Bot size={32} className="text-blue-500" />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase italic tracking-[0.2em] text-white">Inteligencia Artificial</h2>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Configuracao do Agente Sintetico</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="space-y-4">
            <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
              Chave de Acesso (API Key Gemini)
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-600">
                <Key size={16} />
              </div>
              <input
                type="password"
                value={aiSettings.apiKey}
                onChange={(e) => setAiSettings((prev) => ({ ...prev, apiKey: e.target.value }))}
                placeholder="Insira sua chave Gemini..."
                className="w-full rounded-2xl border border-slate-800 bg-[#050506] py-4 pl-12 pr-4 text-xs font-bold text-white placeholder-slate-700 outline-none transition-all focus:border-blue-500/50 focus:bg-blue-500/5"
              />
            </div>
            <p className="text-[9px] font-medium text-slate-600">
              Sua chave e usada apenas para gerar missoes e nao e compartilhada.
            </p>
          </div>

          <div className="space-y-4">
            <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
              Personalidade do Agente
            </label>
            <div className="grid grid-cols-2 gap-4">
              {[
                { id: "standard", label: "Padrao", desc: "Equilibrado" },
                { id: "hardcore", label: "Militar", desc: "Rigido & Disciplinado" },
                { id: "zen", label: "Zen", desc: "Calmo & Filosofico" },
                { id: "gamer", label: "Gamer", desc: "RPG & Grind" },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setAiSettings((prev) => ({ ...prev, personality: p.id }))}
                  className={`flex flex-col gap-1 rounded-2xl border px-4 py-3 transition-all ${aiSettings.personality === p.id
                    ? "border-blue-500 bg-blue-500/10 text-blue-400"
                    : "border-slate-800 bg-[#050506] text-slate-500 hover:bg-slate-800/50"
                    }`}
                >
                  <span className="text-[10px] font-black uppercase">{p.label}</span>
                  <span className="text-[8px] font-bold opacity-60">{p.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={() => void saveAiSettings()}
            disabled={aiSettings.saving || aiSettings.loading}
            type="button"
            className="flex items-center gap-3 rounded-2xl bg-blue-600 px-8 py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg transition-all hover:bg-blue-500 active:scale-95 disabled:opacity-50"
          >
            <Save size={16} />
            {aiSettings.saving ? "Salvando..." : "Salvar Configuracoes"}
          </button>
        </div>
      </section>

      <section className="relative rounded-[40px] border border-slate-800 bg-[#0a0a0b]/80 p-10 shadow-2xl">
        <div className="mb-10 flex items-center gap-6 border-b border-slate-800 pb-8">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 shadow-xl">
            <ShieldCheck size={32} className="text-emerald-500" />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase italic tracking-[0.2em] text-white">Seguranca & Sigilo</h2>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Protecao do Hospedeiro #9284-AX</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <DetailedToggle
            icon={EyeOff}
            label="Modo Furtivo (Stealth)"
            desc="Oculta o seu status e localizacao global de outros cacadores da rede."
            active={stealthMode}
            onClick={() => setStealthMode((value) => !value)}
          />
          <DetailedToggle icon={Lock} label="Firewall de Foco" desc="Bloqueia notificacoes e pedidos externos durante raids e dungeons." active />

          <div className="group col-span-1 flex flex-col items-center justify-between gap-6 rounded-[32px] border border-slate-800 bg-[#050506] p-8 transition-all hover:border-emerald-500/30 md:col-span-2 md:flex-row">
            <div className="flex items-center gap-5">
              <Globe size={28} className="text-[hsl(var(--accent))]" />
              <div className="space-y-1">
                <div className="text-lg font-black uppercase tracking-widest text-white">Protocolo de Comunicacao</div>
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Saida Atual: Portugues (Portugal) - V4.2</div>
              </div>
            </div>
            <button
              className="rounded-2xl border border-slate-700 px-8 py-3 text-[10px] font-black uppercase text-slate-500 transition-all hover:border-[hsl(var(--accent))] hover:text-[hsl(var(--accent))] active:scale-95"
              type="button"
            >
              Alterar Link Linguistico
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-[40px] border border-slate-800 bg-[#0a0a0b]/80 p-10">
        <div className="mb-10 flex items-center gap-6 border-b border-slate-800 pb-8">
          <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4 shadow-xl">
            <Zap size={32} className="text-orange-500" />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase italic tracking-[0.2em] text-white">Nivel de Sincronia</h2>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Intensidade da progressao de carreira</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {["Iniciado", "Cacador", "Monarca"].map((level) => {
            const id = level.toLowerCase();
            const active = difficulty === id;
            return (
              <button
                key={level}
                onClick={() => setDifficulty(id)}
                className={`relative flex flex-col items-center gap-4 overflow-hidden rounded-[32px] border-2 p-10 transition-all ${active
                  ? "scale-105 border-orange-500 bg-orange-500/5 shadow-[0_20px_50px_rgba(249,115,22,0.2)]"
                  : "border-slate-800 bg-[#050506] opacity-60 hover:opacity-100"
                  }`}
                type="button"
              >
                {active && <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-orange-500 opacity-10 blur-3xl" />}
                <div
                  className={`rounded-full p-4 ${active
                    ? "bg-orange-500 text-black shadow-[0_0_20px_#f97316]"
                    : "bg-slate-800 text-slate-500 group-hover:text-slate-300"
                    }`}
                >
                  {level === "Iniciado" ? <Zap size={20} /> : level === "Cacador" ? <Target size={20} /> : <Skull size={20} />}
                </div>
                <span className={`text-sm font-black uppercase tracking-[0.3em] ${active ? "text-orange-400" : "text-slate-500"}`}>
                  {level}
                </span>
                <p className="mt-2 text-center text-[9px] font-black uppercase leading-tight tracking-tighter text-slate-600">
                  {level === "Monarca" ? "Recompensas x2 | Erro = Penalidade HP" : "Progressao Equilibrada"}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-[40px] border border-red-900/20 bg-red-950/5 p-10">
        <div className="mb-8 flex items-center gap-6">
          <div className="animate-pulse rounded-2xl bg-red-600 p-3 text-black shadow-[0_0_30px_rgba(220,38,38,0.5)]">
            <AlertTriangle size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase italic tracking-[0.2em] text-red-500">ZONA DE PERIGO CRITICO</h2>
            <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-red-500/60">Acesso Restrito ao Operador #9284-AX</p>
          </div>
        </div>

        <p className="mb-10 max-w-2xl text-xs font-medium leading-relaxed tracking-wide text-red-400 opacity-80">
          As acoes abaixo resultam na destruicao irreversivel de todos os logs de sincronia, progresso de atributos e
          conquistas. Confirmacao neural de Rank S requerida antes de prosseguir.
        </p>

        <div className="space-y-4">
          <button
            className="group w-full rounded-[24px] border-2 border-red-900/40 py-6 text-[11px] font-black uppercase tracking-[0.4em] text-red-500 shadow-xl transition-all hover:bg-red-600 hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void handleHardReset()}
            disabled={dangerBusy !== null}
            type="button"
          >
            <span className="flex items-center justify-center gap-3">
              <RefreshCw size={16} className={`transition-transform duration-1000 ${dangerBusy === "reset" ? "animate-spin" : "group-hover:rotate-180"}`} />
              {dangerBusy === "reset" ? "Executando Hard Reset..." : confirmingReset ? "TEM CERTEZA? CLIQUE NOVAMENTE" : "Reinicializar Evolucao Completa (Hard Reset)"}
            </span>
          </button>

          <button
            className="w-full py-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-700 transition-colors hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void handleSystemLogout()}
            disabled={dangerBusy !== null}
            type="button"
          >
            {dangerBusy === "logout" ? "Encerrando ligacao..." : "Terminar Ligacao Neural (Sair do Sistema)"}
          </button>

          {dangerFeedback && (
            <div
              className={`rounded-xl border p-3 text-xs font-semibold ${dangerFeedback.type === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : dangerFeedback.type === "info"
                  ? "border-[hsl(var(--accent)/0.3)] bg-[hsl(var(--accent)/0.1)] text-[hsl(var(--accent-light))]"
                  : "border-red-500/30 bg-red-500/10 text-red-300"
                }`}
            >
              {dangerFeedback.text}
            </div>
          )}
        </div>
      </section>
    </div >
  );
}
