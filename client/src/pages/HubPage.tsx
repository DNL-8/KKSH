
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
import { HubAttributesModal } from "../components/hub/HubAttributesModal";
import { StatBar } from "../components/hub/StatBar";
import { SystemCard } from "../components/hub/SystemCard";
import { Icon } from "../components/common/Icon";

interface HubQueryData {
  state: AppStateOut;
  weekly: WeeklyReportOut;
}

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
  const dailyQuests = hubState?.dailyQuests ?? [];
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
        <section className="lg:col-span-4 rounded-3xl border border-white/10 bg-[#0a0b10]/90 p-6">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500"><Icon name="pulse" />Biometria Hunter</div>
            <div className="flex items-center gap-2">
              <button type="button" data-testid="hub-attributes-edit-open" onClick={openEditModal} className="rounded-full border border-slate-700 p-1.5 text-slate-400 hover:text-white"><Icon name="settings" /></button>
              {authUser && <button type="button" data-testid="hub-refresh-button" aria-label="Atualizar dados do hub" onClick={() => void refreshHub()} className="rounded-full border border-slate-700 p-1.5 text-slate-400 hover:text-cyan-300">{loading ? <Icon name="spinner" className="animate-spin" /> : <Icon name="refresh" />}</button>}
            </div>
          </div>
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-blue-500/30 bg-slate-900"><Icon name="user" className="text-slate-300 text-3xl" /></div>
            <div>
              <h2 className="text-2xl font-black uppercase italic text-white">{authUser ? "Shadow Hunter" : "Operador Visitante"}</h2>
              <p className="text-[10px] uppercase tracking-wider text-blue-400">Nivel {level} Operacional • Rank {rank}</p>
              <div className="mt-2 flex gap-2 text-slate-400"><Icon name="bolt" className="text-sm" /><Icon name="brain" className="text-sm" /><Icon name="sparkles" className="text-sm" /></div>
            </div>
          </div>
          <div className="space-y-4 rounded-xl border border-white/10 bg-black/30 p-4">
            <StatBar label="PYTHON" percent={attributes.python} gradientClass="from-blue-600 to-blue-400" sub="Automacao & Scripting" valueTestId="hub-attr-python-stat" />
            <StatBar label="SQL" percent={attributes.sql} gradientClass="from-cyan-600 to-cyan-400" sub="Querying & Database" />
            <StatBar label="EXCEL" percent={attributes.excel} gradientClass="from-emerald-600 to-emerald-400" sub="Analise & Dashboards" />
            <StatBar label="ETL / ELT" percent={attributes.etl} gradientClass="from-amber-500 to-orange-400" sub="Data Pipelines" />
          </div>
          <button type="button" data-testid="hub-connect-button" onClick={() => (authUser ? void refreshHub() : openAuthPanel())} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 py-3 text-xs font-black uppercase tracking-[0.2em] text-blue-300 hover:bg-blue-500/20">
            {authUser ? "Sincronizar Sistema" : "Conectar Sistema"} <Icon name="angle-right" className="text-sm" />
          </button>
        </section>

        <section className="lg:col-span-8 rounded-3xl border border-white/10 bg-[#050202] p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded border border-red-500/20 bg-red-950/20 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-red-400">{activeQuest ? "Incursao Ativa" : "Sem Incursao"}</div>
            <span className="text-[10px] uppercase tracking-widest text-slate-500">Protocolo: {activeQuest ? `QST_${activeQuest.id.slice(0, 8).toUpperCase()}` : "QST_IDLE"}</span>
          </div>
          <div className="mb-3 flex items-center gap-3 text-[10px] uppercase tracking-wider text-slate-500">
            <span>Rank {(activeQuest?.rank ?? "F").toUpperCase()}</span>
            <span>•</span>
            <span>{threatLabel}</span>
          </div>
          <h1 data-testid="hub-mission-title" className={`text-4xl font-black uppercase italic text-white md:text-6xl ${glitchActive ? "tracking-[0.02em]" : ""}`}>{missionTitle}</h1>
          <p className="mt-4 max-w-2xl text-sm text-slate-400">{activeQuest?.objective ?? activeQuest?.description ?? "Conclua revisoes e sessoes para abrir uma incursao."}</p>
          <div className="mt-6 flex flex-wrap gap-4">
            <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-blue-400"><Icon name="brain" className="mb-1" />Materia: {activeQuest?.subject ?? "Geral"}</div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-red-400"><Icon name="shield" className="mb-1" />Dificuldade: {(activeQuest?.difficulty ?? "medio").toUpperCase()}</div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-purple-400"><Icon name="sparkles" className="mb-1" />Loot: +{activeQuest?.rewardXp ?? 0} XP</div>
          </div>
          <div className="mt-8">
            <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
              <span>Progresso da Missao</span>
              <span data-testid="hub-mission-progress" className="text-red-400">{missionProgress}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full border border-white/10 bg-black/40">
              <div className="h-full rounded-full bg-gradient-to-r from-red-900 via-red-600 to-red-400 transition-all" style={{ width: `${missionPercent}%` }} />
            </div>
          </div>
          <button type="button" data-testid="hub-start-reviews" onClick={() => navigateTo("/revisoes")} className="mt-8 flex items-center gap-2 rounded-xl bg-red-600 px-8 py-3 text-xs font-black uppercase tracking-[0.2em] text-white hover:bg-red-500">
            <Icon name="sword" className="text-sm" /> Iniciar Revisoes
          </button>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <SystemCard icon="layers" tone="orange" title="Masmorra Ativa" value={`${dueReviews} Revisoes`} sub={`${openDailyQuests} Missoes em Aberto`} valueTestId="hub-system-masmorra-value" />
        <SystemCard icon="terminal" tone="blue" title="Protocolo Treino" value={`${todayMinutes}/${dailyTarget} min`} sub={`${todayPercent}% da Meta Diaria`} showBar progress={todayPercent} valueTestId="hub-system-training-value" />
        <SystemCard icon="cpu" tone="cyan" title="Nucleo Central" value={missionSource} sub={`Semana ${weekMinutes}/${weeklyTarget} min`} valueTestId="hub-system-core-value" action={<button type="button" onClick={() => navigateTo("/ia")} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 py-2 text-[10px] font-black uppercase tracking-wider text-cyan-300"><Icon name="grid" className="text-xs mr-2" />Sincronizado</button>} />
        <SystemCard icon="chart-histogram" tone="purple" title="Status Evolucao" value={`Streak: ${streakDays}`} sub={`Nivel ${level} • ${weekPercent}% Semana`} valueTestId="hub-system-evolution-value" footer={<div className="mt-3 border-t border-white/10 pt-3 text-[10px] font-black uppercase tracking-wider text-purple-400">Maestria I</div>} />
      </div>
    </div>
  );
}
