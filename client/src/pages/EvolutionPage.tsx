import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";

import { Icon } from "../components/common/Icon";

import {
  ApiRequestError,
  getMeState,
  getMonthlyReport,
  getWeeklyReport,
  listAchievements,
  listSessions,
  type AchievementOut,
  type AppStateOut,
  type DailyQuestOut,
  type MonthlyReportOut,
  type SessionOut,
  type WeeklyQuestOut,
  type WeeklyReportOut,
} from "../lib/api";
import type { AppShellContextValue } from "../layout/types";

interface EvolutionQueryData {
  state: AppStateOut;
  weekly: WeeklyReportOut;
  monthly: MonthlyReportOut;
  achievements: AchievementOut[];
  sessions: SessionOut[];
}

interface QuestCardVM {
  id: string;
  title: string;
  subject: string;
  objective: string;
  rewardXp: number;
  rewardGold: number;
  rewardLabel: string;
  completed: boolean;
  typeKey: "daily" | "weekly";
  typeLabel: string;
  progressMinutes: number;
  targetMinutes: number;
  progressRatio: number;
  progressLabel: string;
  rank: string;
  difficulty: string;
}

interface RaidCellVM {
  date: string;
  minutes: number;
  intensity: 0 | 1 | 2 | 3;
  active: boolean;
  tooltip: string;
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

const HEATMAP_DAYS = 28;
const SESSION_PAGE_LIMIT = 200;
const MAX_SESSION_PAGES = 6;

const HEATMAP_INTENSITY_CLASS: Record<RaidCellVM["intensity"], string> = {
  0: "bg-[#10131d] border-white/10",
  1: "bg-cyan-900/35 border-cyan-500/25",
  2: "bg-cyan-700/65 border-cyan-400/50",
  3: "bg-cyan-400 border-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.45)]",
};

const QUEST_TYPE_CLASS: Record<QuestCardVM["typeKey"], string> = {
  daily: "bg-blue-500/10 border-blue-500/25 text-blue-400",
  weekly: "bg-purple-500/10 border-purple-500/25 text-purple-300",
};

const BADGE_TONE_CLASS: Record<StatBadgeTone, string> = {
  cyan: "bg-cyan-500/10 border-cyan-500/30 text-cyan-300",
  red: "bg-red-500/10 border-red-500/30 text-red-300",
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function roundPositive(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.round(value);
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function makeRecentDateRange(days: number): { from: string; to: string; keys: string[] } {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const keys: string[] = [];
  for (let cursor = days - 1; cursor >= 0; cursor -= 1) {
    const target = new Date(now);
    target.setDate(now.getDate() - cursor);
    keys.push(toIsoDate(target));
  }
  return {
    from: keys[0] ?? toIsoDate(now),
    to: keys[keys.length - 1] ?? toIsoDate(now),
    keys,
  };
}

function toEvolutionErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      return "Sessao expirada. Conecte a conta novamente.";
    }
    return error.message || "Falha ao carregar dados de evolucao.";
  }
  return "Falha ao carregar dados de evolucao.";
}

function questProgressRatio(progressMinutes: number, targetMinutes: number): number {
  return Math.max(0, progressMinutes) / Math.max(1, targetMinutes);
}

function toQuestVm(quest: DailyQuestOut | WeeklyQuestOut, typeKey: "daily" | "weekly"): QuestCardVM {
  const targetMinutes = Math.max(1, Number(quest.targetMinutes ?? 0));
  const progressMinutes = Math.max(0, Number(quest.progressMinutes ?? 0));
  const rewardXp = roundPositive(Number(quest.rewardXp ?? 0));
  const rewardGold = roundPositive(Number(quest.rewardGold ?? 0));
  const titleFromApi = String(quest.title ?? "").trim();
  const subject = String(quest.subject ?? "Geral").trim() || "Geral";
  const objective = String(quest.objective ?? quest.description ?? "").trim();
  const title = titleFromApi || `Revisar ${subject}`;
  const rewardLabel = `+${rewardXp} XP / +${rewardGold} G`;

  return {
    id: String(quest.id),
    title,
    subject,
    objective: objective || "Complete sessoes para atingir a meta da missao.",
    rewardXp,
    rewardGold,
    rewardLabel,
    completed: Boolean(quest.claimed),
    typeKey,
    typeLabel: typeKey === "daily" ? "Diaria" : "Desafio Semanal",
    progressMinutes,
    targetMinutes,
    progressRatio: questProgressRatio(progressMinutes, targetMinutes),
    progressLabel: `${progressMinutes}/${targetMinutes} min`,
    rank: String(quest.rank ?? "F").toUpperCase(),
    difficulty: String(quest.difficulty ?? "medio").toUpperCase(),
  };
}

function pickActiveQuest(quests: QuestCardVM[]): QuestCardVM | null {
  if (!quests.length) {
    return null;
  }
  const ordered = [...quests].sort((left, right) => {
    if (left.completed !== right.completed) {
      return left.completed ? 1 : -1;
    }
    if (left.progressRatio !== right.progressRatio) {
      return right.progressRatio - left.progressRatio;
    }
    return right.rewardXp - left.rewardXp;
  });
  return ordered[0] ?? null;
}

function raidIntensity(minutes: number, targetMinutes: number): RaidCellVM["intensity"] {
  if (minutes <= 0) {
    return 0;
  }
  const ratio = minutes / Math.max(1, targetMinutes);
  if (ratio >= 1) {
    return 3;
  }
  if (ratio >= 0.5) {
    return 2;
  }
  return 1;
}

function buildRaidHistory(dayKeys: string[], sessions: SessionOut[], dailyTargetMinutes: number): RaidCellVM[] {
  const minutesByDate = new Map<string, number>();
  for (const session of sessions) {
    const dateKey = String(session.date ?? "").slice(0, 10);
    if (!dateKey) {
      continue;
    }
    minutesByDate.set(dateKey, (minutesByDate.get(dateKey) ?? 0) + Math.max(0, Number(session.minutes ?? 0)));
  }

  return dayKeys.map((date) => {
    const minutes = roundPositive(minutesByDate.get(date) ?? 0);
    const intensity = raidIntensity(minutes, dailyTargetMinutes);
    return {
      date,
      minutes,
      intensity,
      active: minutes > 0,
      tooltip: `${date} - ${minutes} min`,
    };
  });
}

function resolveArenaPrompt(activeQuest: QuestCardVM | null): { question: string; answer: string } {
  if (!activeQuest) {
    return {
      question: "Nenhuma dungeon ativa. Conecte uma missao para iniciar a arena de revisao.",
      answer: "Abra Revisoes, conclua sessoes e retorne para desbloquear perguntas taticas.",
    };
  }

  return {
    question: activeQuest.objective,
    answer: `Para concluir: alcance ${activeQuest.progressLabel}. Recompensa ${activeQuest.rewardLabel}.`,
  };
}

async function loadRecentSessions(dateFrom: string, dateTo: string): Promise<SessionOut[]> {
  const sessions: SessionOut[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_SESSION_PAGES; page += 1) {
    const response = await listSessions({
      dateFrom,
      dateTo,
      limit: SESSION_PAGE_LIMIT,
      cursor,
    });
    sessions.push(...(response.sessions ?? []));
    cursor = response.nextCursor ?? undefined;
    if (!cursor) {
      break;
    }
  }

  return sessions;
}

function StatBadge({ icon, value, label, tone = "cyan" }: StatBadgeProps) {
  return (
    <div className="flex min-w-[170px] items-center gap-3 rounded-lg border border-white/10 bg-[#0a0a0b] px-4 py-2 shadow-lg">
      <div className={`rounded border px-2 py-1 ${BADGE_TONE_CLASS[tone]}`}>
        <Icon name={icon} className="text-[14px]" />
      </div>
      <div className="leading-none">
        <div className="text-sm font-black tracking-wide text-white">{value}</div>
        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      </div>
    </div>
  );
}

function StatBox({ label, value, sub, highlight = false }: StatBoxProps) {
  return (
    <article
      className={`rounded-xl border p-4 transition-all ${highlight
        ? "border-cyan-500/30 bg-cyan-950/20 shadow-[0_0_15px_rgba(6,182,212,0.12)]"
        : "border-white/10 bg-[#0f1118]"
        }`}
    >
      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-black ${highlight ? "text-cyan-300" : "text-white"}`}>{value}</div>
      <div className="mt-1 text-[10px] font-mono text-slate-500">{sub}</div>
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
          <h2 className="text-3xl font-black uppercase italic tracking-tight text-white">Status de Evolucao</h2>
          <p className="mt-3 text-sm text-slate-400">
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
      <style>{`
        @keyframes evo-slide-up {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .evo-slide-up {
          animation: evo-slide-up 0.45s ease-out both;
        }
      `}</style>

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

      <header className="group relative evo-slide-up overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0b]/80 p-6 md:p-8">
        <div className="pointer-events-none absolute right-4 top-4 opacity-20">
          <Icon name="apps" className="text-cyan-500 text-[96px]" />
        </div>
        <div className="absolute left-0 top-0 flex items-center gap-2 border-b border-cyan-500/20 bg-gradient-to-r from-cyan-950/80 to-transparent px-4 py-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-cyan-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
          System online v3.0
        </div>

        <div className="mt-6 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-5xl font-black italic tracking-tighter text-white md:text-6xl">
              REVI<span className="text-cyan-400">SOES</span>
            </h1>
            <p className="mt-2 flex items-center gap-2 text-xs font-mono uppercase tracking-[0.28em] text-cyan-500/70">
              <span className="h-px w-8 bg-cyan-500/70" />
              Sincronizacao mental necessaria
            </p>
            <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-400">{weeklyLine}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <StatBadge icon="clock" value={`${weeklyTotalMinutes} min`} label="Tempo em combate" tone="cyan" />
            <StatBadge icon="skull" value={`${sessions.length}`} label="Inimigos abatidos" tone="red" />
            <button
              type="button"
              data-testid="evolution-refresh"
              onClick={() => void refreshEvolution()}
              disabled={evolutionQuery.isFetching}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-900/80 px-4 text-[11px] font-black uppercase tracking-wider text-slate-200 transition-colors hover:border-cyan-500/50 hover:text-cyan-300 disabled:cursor-wait disabled:opacity-70"
            >
              {evolutionQuery.isFetching ? <Icon name="spinner" className="animate-spin text-[14px]" /> : <Icon name="refresh" className="text-[14px]" />}
              Atualizar
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <section className="evo-slide-up relative h-[290px] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-[#0a0f1c] to-black p-8">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
            <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.16),transparent_65%)]" />
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div className="flex items-start justify-between gap-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                    <Icon name="sword" className="text-[12px]" /> Rank {activeQuest?.rank ?? "F"} - Dungeon
                  </div>
                  <h2 className="text-4xl font-black italic tracking-tight text-white">CATEDRAL {activeQuest?.subject.toUpperCase() ?? "SQL"}</h2>
                  <p className="max-w-xl text-sm text-slate-400">
                    {activeQuest?.objective ??
                      "Uma dungeon focada em consultas estruturadas. Inimigos do tipo JOIN e INDEX aguardam."}
                  </p>
                </div>
                <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800 to-black">
                  <span className="text-3xl font-black text-white">{activeQuest?.rank ?? "F"}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-6 text-sm text-slate-300">
                  <span className="flex items-center gap-2">
                    <Icon name="clock" className="text-cyan-400 text-[16px]" />
                    {Math.max(5, activeQuest?.targetMinutes ?? 15)} min est.
                  </span>
                  <span className="flex items-center gap-2">
                    <Icon name="brain" className="text-purple-400 text-[16px]" />
                    {Math.max(4, quests.length)} missoes
                  </span>
                  <span className="flex items-center gap-2">
                    <Icon name="sparkles" className="text-yellow-400 text-[16px]" />
                    {activeQuest?.rewardLabel ?? "+0 XP / +0 G"}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full border border-cyan-500/20 bg-black/40">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-700 via-cyan-500 to-blue-400 transition-all duration-500"
                    style={{ width: `${dungeonProgressPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <span>{activeQuest ? activeQuest.progressLabel : "0/0 min"}</span>
                  <span>{dungeonProgressPercent}%</span>
                </div>
              </div>
            </div>
          </section>

          <section className="evo-slide-up rounded-2xl border border-white/10 bg-[#0a0a0b]/80 p-6">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg border border-cyan-500/25 bg-cyan-950/30 p-2">
                  <Icon name="bolt" className="text-cyan-400 text-[18px]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-white">Frequencia de Raids</h3>
                  <p className="text-[10px] font-mono uppercase text-slate-500">Sincronizacao dos ultimos 28 dias</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-white">{raidConsistency}%</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">Consistencia</div>
              </div>
            </div>
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                onClick={() => setIsHeatmapExpanded((current) => !current)}
                className="rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-300 transition-colors hover:border-cyan-500/50 hover:text-cyan-300"
              >
                {isHeatmapExpanded ? "Ocultar detalhes" : "Expandir"}
              </button>
            </div>
            <div
              data-testid="evolution-heatmap"
              className={`grid w-fit ${isHeatmapExpanded
                ? "grid-cols-[repeat(14,1rem)] gap-1.5 sm:grid-cols-[repeat(14,1.1rem)]"
                : "grid-cols-[repeat(7,0.8rem)] gap-1 sm:grid-cols-[repeat(7,0.9rem)]"
                }`}
            >
              {raidHistory.map((cell) => (
                <div
                  key={cell.date}
                  className={`rounded border transition-transform hover:scale-105 ${isHeatmapExpanded ? "h-4 w-4 sm:h-[1.1rem] sm:w-[1.1rem]" : "h-[0.8rem] w-[0.8rem] sm:h-[0.9rem] sm:w-[0.9rem]"
                    } ${HEATMAP_INTENSITY_CLASS[cell.intensity]}`}
                  title={cell.tooltip}
                  aria-label={cell.tooltip}
                />
              ))}
            </div>
          </section>

          <section className="evo-slide-up relative min-h-[310px] rounded-2xl border border-white/10 bg-[#0a0a0b]/80 p-1">
            <div className="absolute -top-3 left-6 rounded border border-cyan-500/30 bg-[#050505] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-cyan-400">
              <span className="flex items-center gap-2">
                <Icon name="crosshairs" className="text-[12px]" />
                Arena de Combate
              </span>
            </div>
            <div className="relative h-full overflow-hidden rounded-xl bg-[#08080a]">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px]" />
              <div className="relative z-10 flex h-full min-h-[308px] flex-col items-center justify-center p-8 text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-cyan-500/25 bg-cyan-950/30">
                  <Icon name="brain" className="text-cyan-400 text-[32px]" />
                </div>
                <div className="mb-8 max-w-xl space-y-3">
                  <div className="text-xs font-mono text-cyan-600">[SISTEMA] Pergunta Gerada:</div>
                  <h4 className="text-xl font-medium leading-relaxed text-white">
                    {showArenaAnswer ? arenaPrompt.answer : arenaPrompt.question}
                  </h4>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    STATUS: {arenaStatus === "revealed" ? "RESPOSTA EXIBIDA" : arenaStatus === "skipped" ? "PULADA" : "ATIVO"}
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowArenaAnswer(true);
                      setArenaStatus("revealed");
                    }}
                    className="rounded bg-white px-8 py-3 text-sm font-bold uppercase tracking-wider text-black transition-colors hover:bg-cyan-50"
                  >
                    Mostrar Resposta
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowArenaAnswer(false);
                      setArenaStatus("skipped");
                    }}
                    className="rounded border border-white/20 px-8 py-3 text-sm font-bold uppercase tracking-wider text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    Pular
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-6 lg:col-span-4">
          <section className="evo-slide-up overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0b]/80">
            <div className="border-b border-white/10 bg-gradient-to-r from-white/5 to-transparent p-6">
              <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-white">
                <Icon name="exclamation" className="text-orange-400 text-[16px]" />
                Missoes Ativas
              </h3>
            </div>
            <div className="space-y-3 p-4">
              {quests.length ? (
                quests.slice(0, 6).map((quest) => (
                  <article
                    key={quest.id}
                    className={`relative rounded-xl border p-4 ${quest.completed
                      ? "border-slate-800/60 bg-slate-900/30 opacity-70"
                      : "border-white/10 bg-[#0f1118] hover:border-orange-500/35"
                      }`}
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <span className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${QUEST_TYPE_CLASS[quest.typeKey]}`}>
                        {quest.typeLabel}
                      </span>
                      {quest.completed ? <Icon name="check-circle" className="text-green-500 text-[16px]" /> : <Icon name="angle-right" className="text-slate-500 text-[16px]" />}
                    </div>
                    <h4 className={`text-xs font-bold ${quest.completed ? "text-slate-500" : "text-white"}`}>{quest.title}</h4>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">
                      {quest.progressLabel} • {quest.difficulty}
                    </p>
                    <div className="mt-3 rounded border border-white/10 bg-black/20 p-2 text-[10px] font-mono text-slate-300">
                      Recompensa: <span className="font-bold text-yellow-400">{quest.rewardLabel}</span>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-slate-700 bg-black/20 p-4 text-xs text-slate-500">
                  Nenhuma missao ativa no momento.
                </div>
              )}
            </div>
          </section>

          <section className="evo-slide-up rounded-2xl border border-white/10 bg-[#0a0a0b]/80 p-6">
            <h3 className="mb-6 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-white">
              <Icon name="trophy" className="text-yellow-500 text-[16px]" />
              Performance do Jogador
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <StatBox label="Total Cartas" value={`${monthlySessions || sessions.length}`} sub={`+${sessions.length} janela 28d`} />
              <StatBox label="Taxa de Acerto" value={`${raidConsistency}%`} sub={`${activeRaidDays}/${HEATMAP_DAYS} dias ativos`} highlight />
              <StatBox label="Combo Atual" value={`x${Math.max(0, comboBase)}`} sub={`Streak ${Math.max(0, comboBase)} dias`} />
              <StatBox label="XP Hora" value={`${xpPerHour}`} sub={`${monthlyXp} XP em ${monthlyMinutes} min`} />
            </div>
          </section>

          <section data-testid="evolution-achievements" className="evo-slide-up rounded-2xl border border-white/10 bg-[#0a0a0b]/80 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-white">Conquistas</h3>
              <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-yellow-300">
                {achievementsLabel}
              </span>
            </div>
            <div className="space-y-2">
              {achievements.length ? (
                achievements.map((achievement) => (
                  <article
                    key={achievement.key}
                    className={`rounded-lg border px-3 py-2 ${achievement.unlocked
                      ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-100"
                      : "border-slate-700 bg-slate-900/50 text-slate-400"
                      }`}
                  >
                    <div className="text-xs font-bold uppercase tracking-wider">{achievement.name}</div>
                    <div className="mt-1 text-[10px] text-slate-400">{achievement.description}</div>
                  </article>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-slate-700 bg-black/20 p-3 text-xs text-slate-500">
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
