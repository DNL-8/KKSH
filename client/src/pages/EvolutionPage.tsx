import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Clock3,
  Flame,
  Loader2,
  RefreshCw,
  Shield,
  Sparkles,
  Swords,
  Target,
  Trophy,
  TrendingUp,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";

import { Badge } from "../components/common";
import {
  ApiRequestError,
  getMeState,
  getMonthlyReport,
  getWeeklyReport,
  listAchievements,
  listSessions,
  type AchievementOut,
  type MonthlyReportOut,
  type SessionOut,
  type WeeklyReportOut,
} from "../lib/api";
import type { AppShellContextValue } from "../layout/types";

const HEATMAP_DAYS = 119;
const MAX_SESSION_PAGES = 8;
const SESSION_PAGE_LIMIT = 200;
const REPORT_MONTHS = 12;

const ACHIEVEMENT_ICON_MAP: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  "trending-up": TrendingUp,
  clock: Clock3,
  flame: Flame,
  check: CheckCircle2,
  brain: Brain,
};

interface EvolutionData {
  weekly: WeeklyReportOut;
  monthly: MonthlyReportOut;
  achievements: AchievementOut[];
  sessions: SessionOut[];
  dailyTargetMinutes: number;
}

interface AttributeCard {
  label: string;
  value: number;
  desc: string;
  color: string;
}

interface HeatmapCell {
  key: string;
  date: string;
  minutes: number;
  level: 0 | 1 | 2 | 3;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function formatMonthLabel(monthKey: string): string {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return monthKey;
  }
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(
    new Date(year, month - 1, 1),
  );
}

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) {
      return "Sessao expirada. Faca login novamente.";
    }
    return error.message || "Falha ao carregar dados de evolucao.";
  }
  return "Falha ao carregar dados de evolucao.";
}

function toHeatLevel(minutes: number, dailyTargetMinutes: number): 0 | 1 | 2 | 3 {
  if (minutes <= 0) {
    return 0;
  }
  const safeTarget = Math.max(1, dailyTargetMinutes);
  if (minutes < safeTarget * 0.5) {
    return 1;
  }
  if (minutes < safeTarget) {
    return 2;
  }
  return 3;
}

async function loadRecentSessions(dateFrom: string, dateTo: string): Promise<SessionOut[]> {
  const out: SessionOut[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_SESSION_PAGES; page += 1) {
    const response = await listSessions({
      limit: SESSION_PAGE_LIMIT,
      cursor,
      dateFrom,
      dateTo,
    });
    out.push(...response.sessions);
    cursor = response.nextCursor ?? undefined;
    if (!cursor) {
      break;
    }
  }
  return out;
}

function achievementIcon(iconName?: string | null): LucideIcon {
  if (!iconName) {
    return Trophy;
  }
  return ACHIEVEMENT_ICON_MAP[iconName] ?? Trophy;
}

export function EvolutionPage() {
  const { authUser, globalStats, openAuthPanel } = useOutletContext<AppShellContextValue>();

  const [data, setData] = useState<EvolutionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvolution = useCallback(async () => {
    if (!authUser) {
      setData(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const today = new Date();
      const from = new Date(today);
      from.setDate(today.getDate() - HEATMAP_DAYS + 1);
      const dateFrom = dateKey(from);
      const dateTo = dateKey(today);

      const [appState, weekly, monthly, achievements, sessions] = await Promise.all([
        getMeState(),
        getWeeklyReport(),
        getMonthlyReport(REPORT_MONTHS),
        listAchievements(),
        loadRecentSessions(dateFrom, dateTo),
      ]);

      setData({
        weekly,
        monthly,
        achievements,
        sessions,
        dailyTargetMinutes: Math.max(10, Number(appState.settings?.dailyTargetMinutes ?? 60)),
      });
    } catch (loadError) {
      setError(toErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [authUser]);

  useEffect(() => {
    void loadEvolution();
  }, [loadEvolution]);

  const weeklyTargetMinutes = useMemo(() => {
    return Math.max(1, (data?.dailyTargetMinutes ?? 60) * 7);
  }, [data?.dailyTargetMinutes]);

  const attributes = useMemo<AttributeCard[]>(() => {
    const weekMinutes = data?.weekly.totalMinutes ?? 0;
    const streakDays = data?.weekly.streakDays ?? globalStats.streak;
    const xpPercent = (globalStats.xp / Math.max(1, globalStats.maxXp)) * 100;
    const unlockedCount = data?.achievements.filter((achievement) => achievement.unlocked).length ?? 0;

    return [
      {
        label: "INT",
        value: clampPercent(globalStats.level * 8 + xpPercent * 0.4),
        desc: `Nivel ${globalStats.level} e XP ${globalStats.xp}/${globalStats.maxXp}`,
        color: "text-blue-400",
      },
      {
        label: "AGI",
        value: clampPercent((data?.sessions.length ?? 0) * 3.5),
        desc: `${data?.sessions.length ?? 0} sessoes nos ultimos ${HEATMAP_DAYS} dias`,
        color: "text-yellow-400",
      },
      {
        label: "STR",
        value: clampPercent((weekMinutes / weeklyTargetMinutes) * 100),
        desc: `${weekMinutes} min nesta semana`,
        color: "text-red-400",
      },
      {
        label: "VIT",
        value: clampPercent(streakDays * 14 + unlockedCount * 2),
        desc: `${streakDays} dias de sequencia`,
        color: "text-green-400",
      },
    ];
  }, [data, globalStats.level, globalStats.maxXp, globalStats.streak, globalStats.xp, weeklyTargetMinutes]);

  const heatmap = useMemo<HeatmapCell[]>(() => {
    const byDay = new Map<string, number>();
    for (const session of data?.sessions ?? []) {
      byDay.set(session.date, (byDay.get(session.date) ?? 0) + Math.max(0, Number(session.minutes) || 0));
    }

    const dailyTargetMinutes = data?.dailyTargetMinutes ?? 60;
    const cells: HeatmapCell[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let offset = HEATMAP_DAYS - 1; offset >= 0; offset -= 1) {
      const day = new Date(today);
      day.setDate(today.getDate() - offset);
      const key = dateKey(day);
      const minutes = byDay.get(key) ?? 0;
      cells.push({
        key,
        date: key,
        minutes,
        level: toHeatLevel(minutes, dailyTargetMinutes),
      });
    }

    return cells;
  }, [data?.dailyTargetMinutes, data?.sessions]);

  const monthlySeries = useMemo(() => {
    const rows = [...(data?.monthly.months ?? [])].slice(0, 6).reverse();
    const maxMinutes = Math.max(1, ...rows.map((row) => Math.max(0, row.minutes)));
    return rows.map((row) => ({
      ...row,
      ratio: clampPercent((row.minutes / maxMinutes) * 100),
      label: formatMonthLabel(row.month),
    }));
  }, [data?.monthly.months]);

  const unlockedAchievements = data?.achievements.filter((achievement) => achievement.unlocked).length ?? 0;
  const totalAchievements = data?.achievements.length ?? 0;
  const weeklyPercent = clampPercent(((data?.weekly.totalMinutes ?? 0) / weeklyTargetMinutes) * 100);

  if (!authUser) {
    return (
      <div className="animate-in fade-in space-y-6 duration-500">
        <div className="rounded-[36px] border border-slate-800 bg-[#0a0a0b]/80 p-10 shadow-2xl">
          <h2 className="text-3xl font-black uppercase italic tracking-tight text-white">Status de Evolucao</h2>
          <p className="mt-3 max-w-2xl text-sm text-slate-400">
            Faca login para carregar evolucao real: sequencia, minutos estudados, conquistas e historico de consistencia.
          </p>
          <button
            onClick={openAuthPanel}
            type="button"
            className="mt-8 rounded-2xl bg-[hsl(var(--accent))] px-6 py-3 text-xs font-black uppercase tracking-[0.2em] text-black transition-all hover:brightness-110"
            data-testid="evolution-login-button"
          >
            Conectar Conta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in zoom-in grid grid-cols-1 gap-10 duration-700 lg:grid-cols-12 lg:items-start">
      <div className="relative flex flex-col overflow-hidden rounded-[48px] border border-slate-800 bg-[#0a0a0b]/80 p-10 shadow-2xl lg:col-span-6 lg:self-start">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.05),transparent)]" />
        <div className="relative z-10 mb-8 flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-[0.35em] text-slate-500">Atributos Operacionais</h3>
          <button
            type="button"
            onClick={() => void loadEvolution()}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all hover:border-[hsl(var(--accent)/0.5)] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            data-testid="evolution-refresh"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Atualizar
          </button>
        </div>

        <div className="relative z-10 mb-8 rounded-3xl border border-slate-800/80 bg-slate-950/70 p-6">
          <div className="mb-4 flex items-center gap-2">
            <Badge color="border-cyan-500/20 bg-cyan-500/10 text-cyan-500">Rank {globalStats.rank}</Badge>
            <Badge color="border-yellow-500/20 bg-yellow-500/10 text-yellow-500">Nivel {globalStats.level}</Badge>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">XP</div>
              <div className="text-xl font-black text-white">{globalStats.xp}</div>
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Gold</div>
              <div className="text-xl font-black text-white">{globalStats.gold}</div>
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Streak</div>
              <div className="text-xl font-black text-white">{data?.weekly.streakDays ?? globalStats.streak}</div>
            </div>
          </div>
        </div>

        {error && (
          <div className="relative z-10 mb-6 flex items-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-300">
            <AlertTriangle size={15} />
            {error}
          </div>
        )}

        <div className="relative z-10 grid w-full grid-cols-2 gap-4" data-testid="evolution-attributes">
          {attributes.map((attribute) => (
            <div
              key={attribute.label}
              className="group rounded-[24px] border border-slate-800 bg-slate-950 p-5 transition-all duration-300 hover:border-[hsl(var(--accent)/0.5)]"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className={`text-xs font-black uppercase tracking-widest ${attribute.color}`}>
                  {attribute.label}
                </span>
                <span className="text-lg font-black text-white">{attribute.value}</span>
              </div>
              <div className="text-[10px] font-bold uppercase text-slate-400">{attribute.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-10 lg:col-span-6 lg:self-start">
        <div className="group relative h-fit overflow-hidden rounded-[48px] border border-slate-800 bg-[#0a0a0b]/80 p-10 shadow-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.05),transparent)]" />
          <div className="relative z-10 mb-8 flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Consistencia Recente</h3>
            <Badge color="border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
              Semana {weeklyPercent}% ({data?.weekly.totalMinutes ?? 0}/{weeklyTargetMinutes} min)
            </Badge>
          </div>

          <div
            className="relative z-10 grid gap-2"
            data-testid="evolution-heatmap"
            style={{ gridTemplateColumns: "repeat(17, minmax(0, 1fr))" }}
          >
            {heatmap.map((cell) => {
              const levelClass =
                cell.level === 3
                  ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.75)]"
                  : cell.level === 2
                    ? "border border-emerald-700/30 bg-emerald-700/60"
                    : cell.level === 1
                      ? "border border-emerald-800/40 bg-emerald-900/50"
                      : "border border-slate-800 bg-slate-900";
              return (
                <div
                  key={cell.key}
                  className={`h-4 w-4 rounded-[4px] transition-transform hover:scale-125 ${levelClass}`}
                  title={`${cell.date}: ${cell.minutes} min`}
                />
              );
            })}
          </div>

          <div className="relative z-10 mt-10 grid grid-cols-1 gap-3 border-t border-slate-800/50 pt-6 md:grid-cols-2">
            {monthlySeries.map((row) => (
              <div key={row.month}>
                <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <span>{row.label}</span>
                  <span>{row.minutes} min</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full border border-slate-800 bg-slate-900">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 shadow-[0_0_10px_rgba(34,211,238,0.4)]"
                    style={{ width: `${row.ratio}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-[48px] border border-slate-800 bg-[#0a0a0b]/80 p-10 shadow-2xl">
          <div className="absolute right-0 top-0 p-8 opacity-5 transition-transform duration-1000 group-hover:scale-110">
            <Trophy size={150} />
          </div>
          <div className="mb-8 flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Conquistas de Classe</h3>
            <Badge color="border-yellow-500/20 bg-yellow-500/10 text-yellow-500">
              {unlockedAchievements}/{totalAchievements || 0} desbloqueadas
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3" data-testid="evolution-achievements">
            {(data?.achievements ?? []).map((achievement) => {
              const Icon = achievementIcon(achievement.icon);
              return (
                <div
                  key={achievement.key}
                  className={`rounded-2xl border p-4 transition-all ${achievement.unlocked
                    ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-500 shadow-lg"
                    : "border-slate-800 bg-slate-900 text-slate-700"
                    }`}
                  title={achievement.description}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <Icon size={18} />
                    {achievement.unlocked ? <Shield size={14} /> : <Target size={14} />}
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-wider">{achievement.name}</div>
                </div>
              );
            })}
          </div>

          {(data?.achievements.length ?? 0) === 0 && !loading && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-xs text-slate-400">
              Nenhuma conquista encontrada ainda.
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="lg:col-span-12">
          <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/40 py-4 text-sm text-slate-400">
            <Loader2 size={16} className="animate-spin" />
            Atualizando dados de evolucao...
          </div>
        </div>
      )}

      {!loading && data && (
        <div className="lg:col-span-12">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <div className="mb-2 flex items-center gap-2 text-cyan-400">
                <Zap size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">Semana</span>
              </div>
              <div className="text-2xl font-black text-white">{data.weekly.totalMinutes} min</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <div className="mb-2 flex items-center gap-2 text-orange-400">
                <Swords size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">Sessoes</span>
              </div>
              <div className="text-2xl font-black text-white">{data.sessions.length}</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <div className="mb-2 flex items-center gap-2 text-emerald-400">
                <Flame size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">Sequencia</span>
              </div>
              <div className="text-2xl font-black text-white">{data.weekly.streakDays} dias</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <div className="mb-2 flex items-center gap-2 text-yellow-400">
                <Trophy size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">Conquistas</span>
              </div>
              <div className="text-2xl font-black text-white">{unlockedAchievements}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
