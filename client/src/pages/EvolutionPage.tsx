import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";

import { Icon } from "../components/common/Icon";

import {
  getMeState,
  getMonthlyReport,
  getWeeklyReport,
  listAchievements,
  type AchievementOut,
  type AppStateOut,
  type MonthlyReportOut,
  type SessionOut,
  type WeeklyReportOut,
} from "../lib/api";
import type { AppShellContextValue } from "../layout/types";
import {
  HEATMAP_DAYS,
  HEATMAP_INTENSITY_CLASS,
  QUEST_TYPE_CLASS,
  clampPercent,
  roundPositive,
  makeRecentDateRange,
  toEvolutionErrorMessage,
  toQuestVm,
  pickActiveQuest,
  buildRaidHistory,
  resolveArenaPrompt,
  loadRecentSessions,
} from "../lib/evolutionUtils";

interface EvolutionQueryData {
  state: AppStateOut;
  weekly: WeeklyReportOut;
  monthly: MonthlyReportOut;
  achievements: AchievementOut[];
  sessions: SessionOut[];
}

type StatBadgeTone = "cyan" | "red";

interface StatBadgeProps {
  icon: string;
  value: string;
  label: string;
  tone?: StatBadgeTone;
}

interface StatBoxProps {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}

const BADGE_TONE_CLASS: Record<StatBadgeTone, string> = {
  cyan: "bg-cyan-500/10 border-cyan-500/30 text-cyan-300 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]",
  red: "bg-red-500/10 border-red-500/30 text-red-300 drop-shadow-[0_0_5px_rgba(248,113,113,0.8)]",
};

function StatBadge({ icon, value, label, tone = "cyan" }: StatBadgeProps) {
  return (
    <div className="flex min-w-[170px] items-center gap-3 rounded-xl border border-slate-300/50 bg-gradient-to-br from-white/[0.05] to-transparent p-3 shadow-[0_4px_20px_rgba(0,0,0,0.5)] backdrop-blur-md">
      <div className={`rounded-lg border px-2.5 py-1.5 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] ${BADGE_TONE_CLASS[tone]}`}>
        <Icon name={icon} className="text-[16px] drop-shadow-md" />
      </div>
      <div className="leading-none">
        <div className="text-[15px] font-black tracking-wide text-slate-900 drop-shadow-sm">{value}</div>
        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      </div>
    </div>
  );
}

function StatBox({ label, value, sub, highlight = false }: StatBoxProps) {
  return (
    <article
      className={`rounded-2xl border p-5 transition-all duration-300 backdrop-blur-md ${highlight
        ? "border-cyan-500/40 bg-cyan-950/20 shadow-[0_0_20px_rgba(34,211,238,0.15),inset_0_0_15px_rgba(34,211,238,0.05)] translate-y-[-2px]"
        : "border-slate-300/50 bg-white/[0.02] hover:bg-white/[0.04] hover:border-slate-300/50"
        }`}
    >
      <div className={`text-[10px] font-bold uppercase tracking-wider ${highlight ? "text-cyan-400" : "text-slate-500"}`}>{label}</div>
      <div className={`mt-2 text-2xl font-black ${highlight ? "text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-cyan-500 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]" : "text-slate-900"}`}>{value}</div>
      <div className="mt-1.5 text-[11px] font-mono text-slate-500/80">{sub}</div>
    </article>
  );
}

export function EvolutionPage() {
  const { authUser, openAuthPanel } = useOutletContext<AppShellContextValue>();
  const [showArenaAnswer, setShowArenaAnswer] = useState(false);
  const [arenaStatus, setArenaStatus] = useState<"idle" | "revealed" | "skipped">("idle");
  const [isHeatmapExpanded, setIsHeatmapExpanded] = useState(false);

  const evolutionQuery = useQuery<EvolutionQueryData>({
    queryKey: ["evolution-state", authUser?.id ?? "guest"],
    enabled: Boolean(authUser),
    queryFn: async () => {
      const range = makeRecentDateRange(HEATMAP_DAYS);
      const [state, weekly, monthly, achievements, sessions] = await Promise.all([
        getMeState(),
        getWeeklyReport(),
        getMonthlyReport(12),
        listAchievements(),
        loadRecentSessions(range.from, range.to),
      ]);
      return {
        state,
        weekly,
        monthly,
        achievements,
        sessions,
      };
    },
  });

  const errorMessage = authUser && evolutionQuery.error ? toEvolutionErrorMessage(evolutionQuery.error) : null;

  const state = evolutionQuery.data?.state ?? null;
  const weekly = evolutionQuery.data?.weekly ?? null;
  const monthly = evolutionQuery.data?.monthly ?? null;
  const achievements = evolutionQuery.data?.achievements ?? [];
  const sessions = evolutionQuery.data?.sessions ?? [];

  const dailyTargetMinutes = Math.max(1, Number(state?.settings?.dailyTargetMinutes ?? 60));
  const weeklyTotalMinutes = roundPositive(Number(weekly?.totalMinutes ?? 0));
  const weeklyTargetMinutes = Math.max(1, dailyTargetMinutes * 7);
  const weeklyPercent = clampPercent((weeklyTotalMinutes / weeklyTargetMinutes) * 100);
  const weeklyLine = `Semana ${weeklyPercent}% (${weeklyTotalMinutes}/${weeklyTargetMinutes} min)`;

  const quests = useMemo(() => {
    const daily = (state?.dailyQuests ?? []).map((quest) => toQuestVm(quest, "daily"));
    const weeklyQuests = (state?.weeklyQuests ?? []).map((quest) => toQuestVm(quest, "weekly"));
    return [...daily, ...weeklyQuests].sort((left, right) => {
      if (left.completed !== right.completed) {
        return left.completed ? 1 : -1;
      }
      return right.progressRatio - left.progressRatio;
    });
  }, [state?.dailyQuests, state?.weeklyQuests]);

  const activeQuest = useMemo(() => pickActiveQuest(quests), [quests]);
  const dungeonProgressPercent = clampPercent((activeQuest?.progressRatio ?? 0) * 100);

  const raidHistory = useMemo(() => {
    const range = makeRecentDateRange(HEATMAP_DAYS);
    return buildRaidHistory(range.keys, sessions, dailyTargetMinutes);
  }, [sessions, dailyTargetMinutes]);

  const activeRaidDays = raidHistory.filter((cell) => cell.active).length;
  const raidConsistency = clampPercent((activeRaidDays / Math.max(1, raidHistory.length)) * 100);

  const unlockedAchievements = achievements.filter((item) => item.unlocked).length;
  const achievementsLabel = `${unlockedAchievements}/${Math.max(achievements.length, 0)} desbloqueadas`;

  const arenaPrompt = resolveArenaPrompt(activeQuest);

  useEffect(() => {
    setShowArenaAnswer(false);
    setArenaStatus("idle");
  }, [activeQuest?.id]);

  const refreshEvolution = async () => {
    await evolutionQuery.refetch();
  };

  const monthlyRows = monthly?.months ?? [];
  const recentMonths = monthlyRows.slice(0, 3);
  const monthlySessions = recentMonths.reduce((sum, row) => sum + Math.max(0, Number(row.sessions ?? 0)), 0);
  const monthlyMinutes = recentMonths.reduce((sum, row) => sum + Math.max(0, Number(row.minutes ?? 0)), 0);
  const monthlyXp = recentMonths.reduce((sum, row) => sum + Math.max(0, Number(row.xp ?? 0)), 0);
  const xpPerHour = monthlyMinutes > 0 ? Math.round(monthlyXp / (monthlyMinutes / 60)) : 0;
  const comboBase = Math.max(0, Number(state?.streakDays ?? 0));

  if (!authUser) {
    return (
      <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">
        <section className="rounded-2xl border border-slate-800 bg-[#0b0e12]/90 p-8">
          <h2 className="text-3xl font-black uppercase italic tracking-tight text-slate-900">Status de Evolucao</h2>
          <p className="mt-3 text-sm text-slate-600">
            Faca login para carregar evolucao real, sequencia, minutos estudados e conquistas.
          </p>
          <button
            type="button"
            onClick={openAuthPanel}
            data-testid="evolution-login-button"
            className="mt-6 rounded-xl bg-cyan-500 px-6 py-3 text-xs font-black uppercase tracking-[0.2em] text-black transition-colors hover:bg-cyan-400"
          >
            Conectar conta
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 md:p-6 lg:p-8">
      {errorMessage && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-300">
          <span className="flex items-center gap-2">
            <Icon name="exclamation" className="text-[15px]" />
            {errorMessage}
          </span>
          <button
            type="button"
            onClick={() => void refreshEvolution()}
            className="rounded-lg border border-red-500/40 px-3 py-1 text-[10px] uppercase tracking-wider hover:bg-red-500/20"
          >
            Tentar de novo
          </button>
        </div>
      )}

      <header className="group relative evo-slide-up overflow-hidden rounded-[32px] border border-slate-300/50 bg-gradient-to-b from-[#0a0f1d]/90 to-[#050813]/90 backdrop-blur-2xl p-8 md:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
        <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(ellipse_at_top_right,rgba(34,211,238,0.15),transparent_60%)] opacity-80" />
        <div className="pointer-events-none absolute right-4 top-4 opacity-10 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]">
          <Icon name="apps" className="text-cyan-400 text-[120px]" />
        </div>
        <div className="absolute left-0 top-0 flex items-center gap-2 border-b border-cyan-500/30 bg-gradient-to-r from-cyan-900/60 to-transparent px-5 py-2 text-[10px] font-mono uppercase tracking-[0.2em] text-cyan-300 backdrop-blur-md shadow-[0_2px_10px_rgba(34,211,238,0.1)]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
          System online v3.0
        </div>

        <div className="mt-8 flex flex-col justify-between gap-8 lg:flex-row lg:items-end relative z-10">
          <div>
            <h1 className="text-5xl font-black italic tracking-tighter text-slate-900 drop-shadow-md md:text-7xl">
              REVI<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 drop-shadow-[0_0_15px_rgba(34,211,238,0.6)]">SOES</span>
            </h1>
            <p className="mt-3 flex items-center gap-3 text-xs font-mono uppercase tracking-[0.3em] text-cyan-400/80">
              <span className="h-px w-10 bg-gradient-to-r from-cyan-500 to-transparent" />
              Sincronizacao mental necessaria
            </p>
            <p className="mt-4 text-[13px] font-bold uppercase tracking-wider text-slate-600 liquid-glass-inner px-3 py-1.5 rounded-lg border border-slate-300/50 w-fit backdrop-blur-sm">{weeklyLine}</p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <StatBadge icon="clock" value={`${weeklyTotalMinutes} min`} label="Tempo em combate" tone="cyan" />
            <StatBadge icon="skull" value={`${sessions.length}`} label="Inimigos abatidos" tone="red" />
            <button
              type="button"
              data-testid="evolution-refresh"
              onClick={() => void refreshEvolution()}
              disabled={evolutionQuery.isFetching}
              className="inline-flex h-[60px] items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-900/30 to-blue-900/30 px-6 text-[12px] font-black uppercase tracking-widest text-cyan-100 shadow-[0_0_15px_rgba(34,211,238,0.15)] transition-all hover:border-cyan-400 hover:shadow-[0_0_25px_rgba(34,211,238,0.3)] hover:-translate-y-1 active:scale-95 disabled:cursor-wait disabled:opacity-70 backdrop-blur-md"
            >
              {evolutionQuery.isFetching ? <Icon name="spinner" className="animate-spin text-[16px]" /> : <Icon name="refresh" className="text-[16px]" />}
              Atualizar
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <section className="evo-slide-up relative h-[320px] overflow-hidden rounded-[32px] border border-slate-300/50 bg-gradient-to-b from-[#0a0f1d]/90 to-[#050813]/90 backdrop-blur-xl p-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent mix-blend-overlay" />
            <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.12),transparent_70%)]" />
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div className="flex items-start justify-between gap-6">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-950/60 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.2)] backdrop-blur-sm">
                    <Icon name="sword" className="text-[13px]" /> Rank {activeQuest?.rank ?? "F"} - Dungeon
                  </div>
                  <h2 className="text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-300 drop-shadow-sm md:text-5xl">CATEDRAL {activeQuest?.subject.toUpperCase() ?? "Geral"}</h2>
                  <p className="max-w-xl text-[13px] leading-relaxed text-slate-600 font-medium">
                    {activeQuest?.objective ??
                      "Uma dungeon focada em evolucao geral."}
                  </p>
                </div>
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-300/50 bg-gradient-to-br from-black to-slate-900 shadow-[inset_0_5px_15px_rgba(255,255,255,0.05),0_10px_20px_rgba(0,0,0,0.5)]">
                  <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-500">{activeQuest?.rank ?? "F"}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-8 text-[13px] font-bold text-slate-800">
                  <span className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-1.5 border border-slate-300/50">
                    <Icon name="clock" className="text-cyan-400 text-[18px] drop-shadow-[0_0_5px_rgba(34,211,238,0.6)]" />
                    {Math.max(5, activeQuest?.targetMinutes ?? 15)} min est.
                  </span>
                  <span className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-1.5 border border-slate-300/50">
                    <Icon name="brain" className="text-purple-400 text-[18px] drop-shadow-[0_0_5px_rgba(168,85,247,0.6)]" />
                    {Math.max(4, quests.length)} missoes
                  </span>
                  <span className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-1.5 border border-slate-300/50">
                    <Icon name="sparkles" className="text-yellow-400 text-[18px] drop-shadow-[0_0_5px_rgba(250,204,21,0.6)]" />
                    {activeQuest?.rewardLabel ?? "+0 XP / +0 G"}
                  </span>
                </div>
                <div className="h-4 overflow-hidden rounded-full border border-cyan-500/30 liquid-glass/60 shadow-[inset_0_2px_5px_rgba(0,0,0,0.8)] p-0.5">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r from-blue-900 via-cyan-500 to-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.6),inset_0_0_5px_rgba(255,255,255,0.5)] transition-all duration-700 ease-out`}
                    style={{ width: `${dungeonProgressPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-slate-600">
                  <span className="drop-shadow-sm">{activeQuest ? activeQuest.progressLabel : "0/0 min"}</span>
                  <span className="text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]">{dungeonProgressPercent}%</span>
                </div>
              </div>
            </div>
          </section>

          <section className="evo-slide-up rounded-[32px] border border-slate-300/50 bg-gradient-to-b from-[#0a0f1d]/90 to-[#050813]/90 backdrop-blur-xl p-8 xl:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/40 p-3 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                  <Icon name="bolt" className="text-cyan-400 text-[22px] drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                </div>
                <div>
                  <h3 className="text-[15px] font-black uppercase tracking-widest text-slate-900 drop-shadow-sm">Frequencia de Raids</h3>
                  <p className="text-[11px] font-mono uppercase text-slate-500/80">Sincronizacao dos ultimos 28 dias</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-l from-white to-cyan-200 drop-shadow-[0_0_10px_rgba(34,211,238,0.3)]">{raidConsistency}%</div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400 drop-shadow-sm">Consistencia</div>
              </div>
            </div>
            <div className="mb-6 flex justify-end">
              <button
                type="button"
                onClick={() => setIsHeatmapExpanded((current) => !current)}
                className="rounded-xl border border-slate-300/50 bg-white/[0.03] px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-800 transition-all hover:bg-white/[0.08] hover:text-slate-900"
              >
                {isHeatmapExpanded ? "Ocultar grade" : "Expandir celulas"}
              </button>
            </div>
            <div
              data-testid="evolution-heatmap"
              className={`grid w-fit rounded-2xl liquid-glass-inner p-5 border border-slate-300/50 shadow-[inset_0_5px_20px_rgba(0,0,0,0.5)] ${isHeatmapExpanded
                ? "grid-cols-[repeat(14,1.2rem)] gap-2 sm:grid-cols-[repeat(14,1.4rem)]"
                : "grid-cols-[repeat(7,1rem)] gap-1.5 sm:grid-cols-[repeat(7,1.2rem)]"
                }`}
            >
              {raidHistory.map((cell) => (
                <div
                  key={cell.date}
                  className={`rounded-[4px] transition-all hover:scale-125 z-0 hover:z-10 relative cursor-help ${isHeatmapExpanded ? "h-5 w-5 sm:h-[1.4rem] sm:w-[1.4rem]" : "h-4 w-4 sm:h-[1.2rem] sm:w-[1.2rem]"
                    } ${HEATMAP_INTENSITY_CLASS[cell.intensity]}`}
                  title={cell.tooltip}
                  aria-label={cell.tooltip}
                />
              ))}
            </div>
          </section>

          <section className="evo-slide-up relative min-h-[310px] rounded-[32px] border border-slate-300/50 bg-[#08080a] p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
            <div className="absolute -top-4 left-8 rounded-lg border border-cyan-500/40 bg-[#02050a] px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.2)] backdrop-blur-md z-20">
              <span className="flex items-center gap-2">
                <Icon name="crosshairs" className="text-[14px]" />
                Arena de Combate
              </span>
            </div>
            <div className="relative h-full overflow-hidden rounded-[26px] bg-[#050813]">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] opacity-50 mix-blend-overlay" />
              <div className="relative z-10 flex h-full min-h-[310px] flex-col items-center justify-center p-8 text-center ring-1 ring-inset ring-white/5">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-950/40 shadow-[0_0_30px_rgba(34,211,238,0.15)]">
                  <Icon name="brain" className="text-cyan-400 text-[36px] drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
                </div>
                <div className="mb-8 max-w-xl space-y-4">
                  <div className="text-xs font-mono uppercase tracking-widest text-cyan-600/80 drop-shadow-sm">[SYSTEM_INTERCEPT] Pergunta Gerada:</div>
                  <h4 className="text-2xl font-bold leading-relaxed text-slate-200 drop-shadow-md">
                    {showArenaAnswer ? arenaPrompt.answer : arenaPrompt.question}
                  </h4>
                  <p className="inline-block rounded-md liquid-glass-inner px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 border border-slate-300/50">
                    STATUS: <span className={arenaStatus === "revealed" ? "text-cyan-400" : arenaStatus === "skipped" ? "text-red-400" : "text-yellow-400 animate-pulse"}>{arenaStatus === "revealed" ? "RESPOSTA EXIBIDA" : arenaStatus === "skipped" ? "PULADA" : "ATIVO"}</span>
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowArenaAnswer(true);
                      setArenaStatus("revealed");
                    }}
                    className="rounded-xl border border-cyan-400 bg-cyan-500/10 px-8 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.2)] transition-all hover:bg-cyan-400 hover:text-black hover:shadow-[0_0_25px_rgba(34,211,238,0.6)] active:scale-95"
                  >
                    Mostrar Resposta
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowArenaAnswer(false);
                      setArenaStatus("skipped");
                    }}
                    className="rounded-xl border border-slate-300/50 bg-white/[0.02] px-8 py-3.5 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-600 transition-all hover:bg-white/[0.1] hover:text-slate-900 active:scale-95"
                  >
                    Pular
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-6 lg:col-span-4">
          <section className="evo-slide-up overflow-hidden rounded-[32px] border border-slate-300/50 bg-gradient-to-b from-[#0a0f1d]/90 to-[#050813]/90 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="border-b border-slate-300/50 bg-gradient-to-r from-orange-500/10 to-transparent p-6">
              <h3 className="flex items-center gap-3 text-[13px] font-black uppercase tracking-widest text-slate-900 drop-shadow-sm">
                <Icon name="exclamation" className="text-orange-400 text-[18px] drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                Missoes Ativas
              </h3>
            </div>
            <div className="space-y-4 p-6">
              {quests.length ? (
                quests.slice(0, 6).map((quest) => (
                  <article
                    key={quest.id}
                    className={`relative rounded-2xl border p-5 transition-all duration-300 ${quest.completed
                      ? "border-slate-800/60 liquid-glass/30 opacity-60"
                      : "border-slate-300/50 bg-white/[0.02] hover:border-orange-500/40 hover:bg-orange-950/20 hover:shadow-[0_0_15px_rgba(249,115,22,0.15)] hover:-translate-y-1"
                      }`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <span className={`rounded-lg border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em] ${QUEST_TYPE_CLASS[quest.typeKey]}`}>
                        {quest.typeLabel}
                      </span>
                      {quest.completed ? <Icon name="check-circle" className="text-green-500 text-[18px] drop-shadow-sm" /> : <Icon name="angle-right" className="text-slate-500 text-[18px]" />}
                    </div>
                    <h4 className={`text-[13px] font-bold leading-snug ${quest.completed ? "text-slate-500" : "text-slate-900"}`}>{quest.title}</h4>
                    <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Progresso: <span className="text-slate-800">{quest.progressLabel}</span> • Nv. <span className="text-orange-300">{quest.difficulty}</span>
                    </p>
                    <div className="mt-4 rounded-xl border border-slate-300/50 liquid-glass-inner p-3 text-[10px] font-mono text-slate-600 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
                      Recompensa: <span className="font-bold text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.5)]">{quest.rewardLabel}</span>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300/50 liquid-glass-inner p-6 text-center text-xs font-medium text-slate-500">
                  Nenhuma missao ativa no momento.
                </div>
              )}
            </div>
          </section>

          <section className="evo-slide-up rounded-[32px] border border-slate-300/50 bg-gradient-to-b from-[#0a0f1d]/90 to-[#050813]/90 backdrop-blur-xl p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <h3 className="mb-8 flex items-center gap-3 text-[13px] font-black uppercase tracking-widest text-slate-900 drop-shadow-sm">
              <Icon name="trophy" className="text-yellow-400 text-[18px] drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
              Performance Global
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <StatBox label="Total Cartas" value={`${monthlySessions || sessions.length}`} sub={`+${sessions.length} janela 28d`} />
              <StatBox label="Taxa Acerto" value={`${raidConsistency}%`} sub={`${activeRaidDays}/${HEATMAP_DAYS} dias ativos`} highlight />
              <StatBox label="Combo Atual" value={`x${Math.max(0, comboBase)}`} sub={`Streak ${Math.max(0, comboBase)} dias`} />
              <StatBox label="XP / Hora" value={`${xpPerHour}`} sub={`${monthlyXp} XP em ${monthlyMinutes} min`} />
            </div>
          </section>

          <section data-testid="evolution-achievements" className="evo-slide-up rounded-[32px] border border-slate-300/50 bg-gradient-to-b from-[#0a0f1d]/90 to-[#050813]/90 backdrop-blur-xl p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-[13px] font-black uppercase tracking-widest text-slate-900 drop-shadow-sm">Conquistas</h3>
              <span className="rounded-lg border border-yellow-500/40 bg-yellow-950/40 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.15)]">
                {achievementsLabel}
              </span>
            </div>
            <div className="space-y-3">
              {achievements.length ? (
                achievements.map((achievement) => (
                  <article
                    key={achievement.key}
                    className={`rounded-2xl border p-4 transition-all duration-300 ${achievement.unlocked
                      ? "border-cyan-500/40 bg-cyan-950/20 text-cyan-100 shadow-[0_0_15px_rgba(34,211,238,0.1)] hover:shadow-[0_0_20px_rgba(34,211,238,0.2)]"
                      : "border-slate-300/50 bg-white/[0.02] text-slate-500 hover:bg-white/[0.04]"
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full border ${achievement.unlocked ? "border-cyan-400/50 bg-cyan-900/50 text-cyan-300" : "border-slate-800 liquid-glass text-slate-700"}`}>
                        <Icon name={achievement.unlocked ? "star" : "lock"} className="text-[16px]" />
                      </div>
                      <div>
                        <div className={`text-[11px] font-black uppercase tracking-widest ${achievement.unlocked ? "text-cyan-300 drop-shadow-sm" : "text-slate-600"}`}>{achievement.name}</div>
                        <div className="mt-1 text-[10px] text-slate-500/80">{achievement.description}</div>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300/50 liquid-glass-inner p-6 text-center text-xs font-medium text-slate-500">
                  Nenhuma conquista registrada.
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
