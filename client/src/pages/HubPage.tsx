
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";

import {
  ApiRequestError,
  getMeState,
  getWeeklyReport,
  type AppStateOut,
  type DailyQuestOut,
  type WeeklyReportOut,
} from "../lib/api";
import type { AppShellContextValue } from "../layout/types";

import {
  BASELINE,
  clampPercent,
  computeAttributes,
  persistAttributes,
  readStoredAttributes,
  type AttributeKey,
  type TechnicalAttributes,
} from "../lib/hub/attributes";
import { widthPercentClass } from "../lib/percentClasses";
import { HubAttributesModal } from "../components/hub/HubAttributesModal";
import { StatBar } from "../components/hub/StatBar";
import { SystemCard } from "../components/hub/SystemCard";
import { Icon } from "../components/common/Icon";

interface HubQueryData {
  state: AppStateOut;
  weekly: WeeklyReportOut;
}

const EMPTY_DAILY_QUESTS: DailyQuestOut[] = [];

function toHubErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      return "Sessao expirada. Faca login novamente.";
    }
    return error.message || "Falha ao carregar dados do centro de comando.";
  }
  return "Falha ao carregar dados do centro de comando.";
}

function bestDailyQuest(quests: DailyQuestOut[]): DailyQuestOut | null {
  if (!quests.length) {
    return null;
  }
  return [...quests].sort((a, b) => {
    if (a.claimed !== b.claimed) {
      return a.claimed ? 1 : -1;
    }
    const ar = Number(a.progressMinutes || 0) / Math.max(1, Number(a.targetMinutes || 1));
    const br = Number(b.progressMinutes || 0) / Math.max(1, Number(b.targetMinutes || 1));
    return br - ar;
  })[0] ?? null;
}

export function HubPage() {
  const { globalStats, authUser, openAuthPanel, navigateTo } = useOutletContext<AppShellContextValue>();
  const [isLoaded, setIsLoaded] = useState(false);
  const [glitchActive, setGlitchActive] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [attributes, setAttributes] = useState<TechnicalAttributes>(BASELINE);
  const [draftAttributes, setDraftAttributes] = useState<TechnicalAttributes>(BASELINE);
  const hydratedRef = useRef<string | null>(null);

  const hubQuery = useQuery<HubQueryData>({
    queryKey: ["hub-state", authUser?.id ?? "guest"],
    enabled: Boolean(authUser),
    queryFn: async () => {
      const [state, weekly] = await Promise.all([getMeState(), getWeeklyReport()]);
      return { state, weekly };
    },
  });

  const hubState = authUser ? (hubQuery.data?.state ?? null) : null;
  const weekly = authUser ? (hubQuery.data?.weekly ?? null) : null;
  const loading = authUser ? hubQuery.isFetching : false;
  const error = authUser && hubQuery.error ? toHubErrorMessage(hubQuery.error) : null;

  const computedAttributes = useMemo(() => computeAttributes(hubState, weekly), [hubState, weekly]);
  const dailyQuests = hubState?.dailyQuests ?? EMPTY_DAILY_QUESTS;
  const activeQuest = useMemo(() => bestDailyQuest(dailyQuests), [dailyQuests]);

  const dailyTarget = Math.max(1, Number(hubState?.settings?.dailyTargetMinutes ?? 60));
  const todayMinutes = Math.max(0, Number(hubState?.todayMinutes ?? 0));
  const weekMinutes = Math.max(0, Number(hubState?.weekMinutes ?? weekly?.totalMinutes ?? 0));
  const weeklyTarget = dailyTarget * 7;
  const todayPercent = clampPercent((todayMinutes / dailyTarget) * 100);
  const weekPercent = clampPercent((weekMinutes / weeklyTarget) * 100);

  const dueReviews = Math.max(0, Number(hubState?.dueReviews ?? 0));
  const streakDays = Math.max(0, Number(hubState?.streakDays ?? globalStats.streak));
  const progression = hubState?.progression ?? null;
  const rank = String(progression?.rank ?? globalStats.rank ?? "F");
  const level = Math.max(1, Number(progression?.level ?? globalStats.level ?? 1));

  const missionTitle = activeQuest?.title?.trim() || "Sem Incursao Ativa";
  const missionProgress = activeQuest ? `${activeQuest.progressMinutes}/${activeQuest.targetMinutes} min` : "00/00 min";
  const missionPercent = activeQuest
    ? clampPercent((Number(activeQuest.progressMinutes || 0) / Math.max(1, Number(activeQuest.targetMinutes || 1))) * 100)
    : 0;
  const threatLabel = activeQuest ? "Ameaca Alta" : "Ameaca Controlada";
  const missionSource = (dailyQuests[0]?.source ?? "fallback").toUpperCase();
  const openDailyQuests = dailyQuests.filter((quest) => !quest.claimed).length;

  useEffect(() => setIsLoaded(true), []);
  useEffect(() => {
    const interval = window.setInterval(() => {
      setGlitchActive(true);
      window.setTimeout(() => setGlitchActive(false), 180);
    }, 3200);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!authUser?.id) {
      hydratedRef.current = null;
      setAttributes(BASELINE);
      setDraftAttributes(BASELINE);
      return;
    }
    if (!hubState || !weekly || hydratedRef.current === authUser.id) {
      return;
    }
    const stored = readStoredAttributes(authUser.id);
    const next = stored ?? computedAttributes;
    setAttributes(next);
    setDraftAttributes(next);
    if (!stored) {
      persistAttributes(authUser.id, next);
    }
    hydratedRef.current = authUser.id;
  }, [authUser?.id, computedAttributes, hubState, weekly]);

  const refreshHub = async () => {
    if (authUser) {
      await hubQuery.refetch();
    }
  };

  const openEditModal = () => {
    setDraftAttributes(attributes);
    setShowEditModal(true);
  };

  const saveEditedAttributes = () => {
    setAttributes(draftAttributes);
    if (authUser?.id) {
      persistAttributes(authUser.id, draftAttributes);
    }
    setShowEditModal(false);
  };

  const onDraftChange = (key: AttributeKey, raw: string) => {
    setDraftAttributes((current) => ({ ...current, [key]: clampPercent(Number(raw)) }));
  };

  return (
    <div className={`space-y-6 pb-20 ${isLoaded ? "animate-in fade-in duration-500" : "opacity-0"}`}>
      {showEditModal && (
        <HubAttributesModal
          draftAttributes={draftAttributes}
          onDraftChange={onDraftChange}
          onSave={saveEditedAttributes}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-300">
          <span className="flex items-center gap-2"><Icon name="exclamation" />{error}</span>
          {authUser && <button type="button" onClick={() => void refreshHub()} className="rounded border border-red-500/30 px-3 py-1">Tentar de novo</button>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="lg:col-span-4 rounded-3xl border border-slate-300/50 bg-gradient-to-b from-[#0a0f1d]/90 to-[#050813]/95 backdrop-blur-xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.5)] relative overflow-hidden group">
          <div className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-blue-500/10 blur-[60px]" />
          <div className="mb-6 flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500"><Icon name="pulse" className="text-blue-400" />Biometria Hunter</div>
            <div className="flex items-center gap-2">
              <button type="button" data-testid="hub-attributes-edit-open" onClick={openEditModal} className="rounded-full border border-slate-700/50 p-1.5 text-slate-600 hover:text-slate-900 hover:liquid-glass-inner transition-colors"><Icon name="settings" /></button>
              {authUser && <button type="button" data-testid="hub-refresh-button" aria-label="Atualizar dados do hub" onClick={() => void refreshHub()} className="rounded-full border border-slate-700/50 p-1.5 text-slate-600 hover:text-cyan-300 hover:bg-cyan-500/10 transition-colors">{loading ? <Icon name="spinner" className="animate-spin" /> : <Icon name="refresh" />}</button>}
            </div>
          </div>
          <div className="mb-6 flex items-center gap-5 relative z-10">
            <div className="group-avatar flex h-24 w-24 shrink-0 items-center justify-center rounded-[20px] border border-blue-500/40 bg-gradient-to-b from-blue-900/40 to-black/60 shadow-[inset_0_0_20px_rgba(59,130,246,0.2),0_0_20px_rgba(59,130,246,0.15)] backdrop-blur-md relative">
              <div className="absolute inset-0 rounded-[20px] bg-blue-400/10 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <Icon name="user" className="text-blue-300/80 text-4xl drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase italic text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200 drop-shadow-sm">{authUser ? "Shadow Hunter" : "Operador"}</h2>
              <div className="mt-1 inline-flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-blue-300">
                <Icon name="shield-check" className="text-xs" /> Nivel {level} • Rank {rank}
              </div>
              <div className="mt-3 flex gap-3 text-slate-600">
                <div className="flex items-center gap-1.5 rounded liquid-glass-inner px-2 py-1"><Icon name="bolt" className="text-xs text-yellow-400" /><span className="text-[9px] font-bold">120K</span></div>
                <div className="flex items-center gap-1.5 rounded liquid-glass-inner px-2 py-1"><Icon name="brain" className="text-xs text-purple-400" /><span className="text-[9px] font-bold">INT</span></div>
              </div>
            </div>
          </div>
          <div className="space-y-5 rounded-2xl border border-slate-300/50 liquid-glass-inner p-5 shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] relative z-10">
            <StatBar label="PYTHON" percent={attributes.python} gradientClass="from-blue-600 via-blue-500 to-cyan-400" sub="Automacao & Scripting" valueTestId="hub-attr-python-stat" />
            <StatBar label="SQL" percent={attributes.sql} gradientClass="from-cyan-600 via-cyan-500 to-blue-400" sub="Querying & Database" />
            <StatBar label="EXCEL" percent={attributes.excel} gradientClass="from-emerald-600 via-emerald-500 to-teal-400" sub="Analise & Dashboards" />
            <StatBar label="ETL / ELT" percent={attributes.etl} gradientClass="from-orange-600 via-orange-500 to-amber-400" sub="Data Pipelines" />
          </div>
          <button type="button" data-testid="hub-connect-button" onClick={() => (authUser ? void refreshHub() : openAuthPanel())} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-blue-500/40 bg-gradient-to-r from-blue-600/10 to-blue-400/10 py-3.5 text-xs font-black uppercase tracking-[0.2em] text-blue-300 transition-all hover:bg-blue-500/20 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:border-blue-400 relative z-10">
            {authUser ? "Sincronizar Sistema" : "Conectar Sistema"} <Icon name="angle-right" className="text-sm" />
          </button>
        </section>

        <section className={`lg:col-span-8 rounded-3xl border border-slate-300/50 bg-gradient-to-br from-[#02050a]/95 to-[#050101]/95 backdrop-blur-2xl p-8 relative overflow-hidden transition-all duration-700 ${activeQuest ? "shadow-[0_0_50px_rgba(220,38,38,0.1)]" : "shadow-[0_0_50px_rgba(34,211,238,0.05)]"}`}>
          <div className="files-grid-overlay pointer-events-none absolute inset-0 opacity-20 mix-blend-overlay" />
          {activeQuest && (
            <>
              <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-red-600/10 blur-[80px]" />
              <div className="pointer-events-none absolute bottom-0 left-1/4 h-32 w-1/2 rounded-full bg-orange-500/5 blur-[60px]" />
            </>
          )}

          <div className="relative z-10">
            <div className="mb-6 flex items-center gap-3">
              <div className={`rounded-lg border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider backdrop-blur-md ${activeQuest ? "border-red-500/40 bg-red-950/40 text-red-400 shadow-[0_0_15px_rgba(220,38,38,0.2)]" : "border-cyan-500/30 bg-cyan-950/30 text-cyan-400"}`}>
                <span className="flex items-center gap-2">
                  {activeQuest && <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />}
                  {activeQuest ? "Incursao Ativa" : "Sem Incursao"}
                </span>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-slate-500/80 font-mono">Protocolo: {activeQuest ? `QST_${activeQuest.id.slice(0, 8).toUpperCase()}` : "QST_IDLE"}</span>
            </div>
            <div className="mb-4 flex items-center gap-3 text-[11px] font-bold uppercase tracking-widest text-slate-600">
              <span className="text-slate-900">Rank {(activeQuest?.rank ?? "F").toUpperCase()}</span>
              <span className="text-slate-600">•</span>
              <span className={activeQuest ? "text-red-400" : "text-cyan-400"}>{threatLabel}</span>
            </div>

            <h1 data-testid="hub-mission-title" className={`text-4xl font-black uppercase italic text-transparent bg-clip-text bg-gradient-to-r ${activeQuest ? "from-white to-red-300" : "from-white to-slate-400"} md:text-5xl lg:text-6xl drop-shadow-sm ${glitchActive ? "tracking-[0.02em] skew-x-[-2deg]" : "transition-all duration-300"}`}>
              {missionTitle}
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-slate-600/90 font-medium">
              {activeQuest?.objective ?? activeQuest?.description ?? "Aguardando sincronizacao de dados diários. Conclua sessoes de foco ou revise conteudos para liberar a incursao."}
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <div className="flex items-center gap-3 rounded-xl border border-slate-300/50 bg-white/[0.02] px-4 py-3 text-sm text-blue-300 backdrop-blur-sm shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                <div className="rounded bg-blue-500/20 p-1.5"><Icon name="brain" className="text-blue-400" /></div>
                <div className="flex flex-col"><span className="text-[9px] uppercase tracking-wider text-slate-500">Materia</span><span className="font-bold">{activeQuest?.subject ?? "Geral"}</span></div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-slate-300/50 bg-white/[0.02] px-4 py-3 text-sm text-red-300 backdrop-blur-sm shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                <div className="rounded bg-red-500/20 p-1.5"><Icon name="shield" className="text-red-400" /></div>
                <div className="flex flex-col"><span className="text-[9px] uppercase tracking-wider text-slate-500">Dificuldade</span><span className="font-bold">{(activeQuest?.difficulty ?? "medio").toUpperCase()}</span></div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-slate-300/50 bg-white/[0.02] px-4 py-3 text-sm text-purple-300 backdrop-blur-sm shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                <div className="rounded bg-purple-500/20 p-1.5"><Icon name="sparkles" className="text-purple-400" /></div>
                <div className="flex flex-col"><span className="text-[9px] uppercase tracking-wider text-slate-500">Loot (XP)</span><span className="font-bold">+{activeQuest?.rewardXp ?? 0} XP</span></div>
              </div>
            </div>

            <div className="mt-10">
              <div className="mb-3 flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-slate-600">
                <span>Sincronizacao Concluida</span>
                <span data-testid="hub-mission-progress" className={`${activeQuest ? "text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.8)]" : "text-slate-500"} font-mono`}>{missionProgress}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full border border-slate-300/50 liquid-glass/60 shadow-[inset_0_2px_5px_rgba(0,0,0,0.8)] relative">
                <div className={`absolute left-0 top-0 h-full rounded-full transition-all duration-1000 ease-out ${widthPercentClass(missionPercent)} ${activeQuest ? "bg-gradient-to-r from-red-900 via-red-500 to-red-400 shadow-[0_0_15px_rgba(239,68,68,0.6)]" : "bg-slate-700"}`} />
              </div>
            </div>

            <button type="button" data-testid="hub-start-reviews" onClick={() => navigateTo("/revisoes")} className={`mt-10 flex w-full md:w-auto items-center justify-center gap-3 rounded-2xl border px-8 py-4 text-[12px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 ${activeQuest ? "border-red-500/50 bg-red-600/20 text-red-100 hover:bg-red-500/40 hover:border-red-400 hover:shadow-[0_0_30px_rgba(220,38,38,0.3)] backdrop-blur-md" : "border-slate-700 liquid-glass-inner/50 text-slate-600 hover:bg-slate-700 hover:text-slate-900"}`}>
              <Icon name="sword" className="text-lg" /> Iniciar Incursao
            </button>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <SystemCard icon="layers" tone="orange" title="Masmorra Ativa" value={`${dueReviews} Revisoes`} sub={`${openDailyQuests} Missoes em Aberto`} valueTestId="hub-system-masmorra-value" />
        <SystemCard icon="terminal" tone="blue" title="Protocolo Treino" value={`${todayMinutes}/${dailyTarget} min`} sub={`${todayPercent}% da Meta Diaria`} showBar progress={todayPercent} valueTestId="hub-system-training-value" />
        <SystemCard icon="cpu" tone="cyan" title="Nucleo Central" value={missionSource} sub={`Semana ${weekMinutes}/${weeklyTarget} min`} valueTestId="hub-system-core-value" action={<button type="button" onClick={() => navigateTo("/ia")} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 py-2 text-[10px] font-black uppercase tracking-wider text-cyan-300"><Icon name="grid" className="text-xs mr-2" />Sincronizado</button>} />
        <SystemCard icon="chart-histogram" tone="purple" title="Status Evolucao" value={`Streak: ${streakDays}`} sub={`Nivel ${level} • ${weekPercent}% Semana`} valueTestId="hub-system-evolution-value" footer={<div className="mt-3 border-t border-slate-300/50 pt-3 text-[10px] font-black uppercase tracking-wider text-purple-400">Maestria I</div>} />
      </div>
    </div>
  );
}
