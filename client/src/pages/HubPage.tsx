import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Brain,
  Cpu,
  Hexagon,
  Layers,
  Loader2,
  RefreshCw,
  Swords,
  Target,
  Terminal,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";

import { Badge, BentoMini, ProgressBar, StatPill, Tooltip } from "../components/common";
import { ApiRequestError, getMeState, type AppStateOut, type DailyQuestOut } from "../lib/api";
import { assetPaths } from "../lib/assets";
import type { AppShellContextValue } from "../layout/types";

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
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

function threatLabelByRank(rank?: string | null): string {
  switch ((rank ?? "").toUpperCase()) {
    case "S":
      return "Ameaca Critica";
    case "A":
    case "B":
      return "Ameaca Alta";
    case "C":
    case "D":
      return "Ameaca Moderada";
    default:
      return "Ameaca Controlada";
  }
}

function bestDailyQuest(quests: DailyQuestOut[]): DailyQuestOut | null {
  if (!quests.length) {
    return null;
  }
  const ordered = [...quests].sort((left, right) => {
    if (left.claimed !== right.claimed) {
      return left.claimed ? 1 : -1;
    }
    const leftRatio = Number(left.progressMinutes || 0) / Math.max(1, Number(left.targetMinutes || 1));
    const rightRatio = Number(right.progressMinutes || 0) / Math.max(1, Number(right.targetMinutes || 1));
    return rightRatio - leftRatio;
  });
  return ordered[0] ?? null;
}

export function HubPage() {
  const { globalStats, authUser, handleGlobalAction, openAuthPanel, navigateTo } = useOutletContext<AppShellContextValue>();

  const [hubState, setHubState] = useState<AppStateOut | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshHub = useCallback(async () => {
    if (!authUser) {
      setHubState(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const state = await getMeState();
      setHubState(state);
    } catch (loadError) {
      setError(toHubErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [authUser]);

  useEffect(() => {
    void refreshHub();
  }, [refreshHub]);

  const dailyQuests = hubState?.dailyQuests ?? [];
  const activeQuest = useMemo(() => bestDailyQuest(dailyQuests), [dailyQuests]);

  const dailyTarget = Math.max(1, Number(hubState?.settings?.dailyTargetMinutes ?? 60));
  const todayMinutes = Math.max(0, Number(hubState?.todayMinutes ?? 0));
  const todayPercent = clampPercent((todayMinutes / dailyTarget) * 100);

  const weeklyTarget = Math.max(1, dailyTarget * 7);
  const weekMinutes = Math.max(0, Number(hubState?.weekMinutes ?? 0));
  const weekPercent = clampPercent((weekMinutes / weeklyTarget) * 100);

  const dueReviews = Math.max(0, Number(hubState?.dueReviews ?? 0));
  const streakDays = Math.max(0, Number(hubState?.streakDays ?? globalStats.streak));
  const openDailyQuests = dailyQuests.filter((quest) => !quest.claimed).length;

  const bossEnergyPercent = activeQuest
    ? clampPercent((Number(activeQuest.progressMinutes || 0) / Math.max(1, Number(activeQuest.targetMinutes || 1))) * 100)
    : 0;

  const goalBars = useMemo(() => {
    const entries = Object.entries(hubState?.goals ?? {}).filter(([, minutes]) => Number(minutes) > 0);
    if (!entries.length) {
      return [];
    }
    const top = entries.sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 10);
    const maxMinutes = Math.max(1, ...top.map(([, minutes]) => Number(minutes)));
    return top.map(([subject, minutes]) => ({
      subject,
      minutes: Number(minutes),
      height: Math.max(10, clampPercent((Number(minutes) / maxMinutes) * 100)),
    }));
  }, [hubState?.goals]);

  const dynamicProtocol = activeQuest ? `QST_${activeQuest.id.slice(0, 8).toUpperCase()}` : "QST_IDLE";
  const threatLabel = threatLabelByRank(activeQuest?.rank);
  const missionTitle = activeQuest?.title?.trim() || "Sem Incursao Ativa";
  const missionObjective = activeQuest?.objective?.trim() || activeQuest?.description?.trim() || "Conclua revisoes e sessoes para destravar novas missoes.";

  const missionSource = (dailyQuests[0]?.source ?? "fallback").toUpperCase();

  return (
    <div className="animate-in fade-in zoom-in space-y-6 pb-20 duration-500">
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-300">
          <span className="flex items-center gap-2">
            <AlertTriangle size={15} />
            {error}
          </span>
          {authUser && (
            <button
              type="button"
              onClick={() => void refreshHub()}
              className="rounded-lg border border-red-400/40 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-red-200 transition-colors hover:bg-red-500/20"
            >
              Tentar de novo
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-12">
        <section className="group relative overflow-hidden rounded-[32px] border border-slate-800 bg-[#0a0a0b]/80 p-6 shadow-2xl backdrop-blur-xl transition-all duration-500 hover:border-[hsl(var(--accent)/0.3)] lg:col-span-4">
          <div className="absolute -right-10 -top-10 rotate-12 opacity-5 transition-opacity group-hover:opacity-10">
            <Hexagon size={220} className="text-[hsl(var(--accent))]" />
          </div>
          <div className="mb-6 flex items-start justify-between">
            <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
              <Activity size={14} className="text-[hsl(var(--accent))]" /> Biometria Hunter
            </h3>
            <div className="flex items-center gap-2">
              <Badge icon={Activity} color="border-green-500/20 bg-green-500/10 text-green-500">
                {authUser ? "Estavel" : "Offline"}
              </Badge>
              {authUser && (
                <button
                  type="button"
                  onClick={() => void refreshHub()}
                  disabled={loading}
                  className="rounded-lg border border-slate-700 bg-slate-900/70 p-2 text-slate-300 transition-colors hover:text-white disabled:opacity-60"
                  aria-label="Atualizar dados do hub"
                >
                  {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                </button>
              )}
            </div>
          </div>

          <div className="mb-8 flex items-center gap-5">
            <div className="relative shrink-0">
              <div className="w-24 rotate-2 rounded-[28px] bg-gradient-to-br from-[hsl(var(--accent))] via-blue-600 to-cyan-500 p-0.5 shadow-2xl transition-transform duration-700 group-hover:rotate-0">
                <div className="relative flex h-24 w-full items-center justify-center overflow-hidden rounded-[26px] border border-black/40 bg-[#050506]">
                  <img
                    src={assetPaths.hunterAvatar}
                    alt="Avatar"
                    className="z-10 h-16 w-16 object-contain"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-[hsl(var(--accent)/0.1)] mix-blend-overlay" />
                </div>
              </div>
              <div className="absolute -bottom-2 -right-2 rounded-xl border-2 border-[#0a0a0b] bg-[hsl(var(--accent))] px-3 py-1 text-[11px] font-black text-black shadow-lg">
                RANK {globalStats.rank}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-2xl font-black uppercase italic leading-none tracking-tighter text-white">
                {authUser ? "Shadow Hunter" : "Operador Visitante"}
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-widest text-[hsl(var(--accent))]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[hsl(var(--accent))] shadow-[0_0_8px_rgba(var(--glow),1)]" />
                Nivel {globalStats.level} Operacional
              </div>
              <div className="flex gap-1.5 pt-1">
                <Tooltip content={`Buff: Disciplina (${todayPercent}% da meta diaria)`}>
                  <div className="flex h-6 w-6 items-center justify-center rounded border border-slate-700 bg-slate-900 text-yellow-500">
                    <Zap size={12} fill="currentColor" />
                  </div>
                </Tooltip>
                <Tooltip content={`Buff: Sequencia (${streakDays} dias)`}>
                  <div className="flex h-6 w-6 items-center justify-center rounded border border-slate-700 bg-slate-900 text-blue-500">
                    <Brain size={12} />
                  </div>
                </Tooltip>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <ProgressBar
              label="Integridade (HP)"
              value={globalStats.hp}
              color="bg-red-600"
              glow="shadow-[0_0_20px_rgba(220,38,38,0.4)]"
              subLabel={`Meta diaria: ${todayMinutes}/${dailyTarget} min`}
            />
            <ProgressBar
              label="Foco Mental (MP)"
              value={globalStats.mana}
              color="bg-blue-600"
              glow="shadow-[0_0_20px_rgba(37,99,235,0.4)]"
              subLabel={`Revisoes pendentes: ${dueReviews}`}
            />
            <ProgressBar
              label="Sincronia (XP)"
              value={Math.floor((globalStats.xp / globalStats.maxXp) * 100)}
              color="bg-yellow-500"
              glow="shadow-[0_0_20px_rgba(234,179,8,0.4)]"
              subLabel={`${globalStats.xp}/${globalStats.maxXp}`}
            />
          </div>

          {!authUser && (
            <button
              type="button"
              onClick={openAuthPanel}
              className="mt-6 w-full rounded-xl border border-[hsl(var(--accent)/0.4)] bg-[hsl(var(--accent)/0.2)] px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-[hsl(var(--accent-light))] transition-colors hover:bg-[hsl(var(--accent)/0.35)]"
            >
              Conectar para sincronizar
            </button>
          )}
        </section>

        <section className="group relative overflow-hidden rounded-[32px] border border-red-900/20 bg-gradient-to-br from-[#150a0a] to-[#0a0a0b] p-8 shadow-xl transition-all hover:border-red-500/40 lg:col-span-8">
          <div className="absolute right-0 top-0 p-8 opacity-5 transition-all duration-1000 group-hover:opacity-15">
            <Swords size={200} className="translate-x-12 -translate-y-12 -rotate-12 text-red-600" />
          </div>
          <div className="relative z-10 flex h-full flex-col">
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge color="border-red-500/20 bg-red-500/10 text-red-500" icon={Swords}>
                  {activeQuest ? "Incursao Ativa" : "Sem Incursao"}
                </Badge>
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                  Protocolo: {dynamicProtocol}
                </span>
              </div>
              <button
                onClick={() => navigateTo("/revisoes")}
                className="rounded-full bg-white/5 p-2 text-slate-500 transition-colors hover:text-red-500"
                type="button"
              >
                <ArrowUpRight size={20} />
              </button>
            </div>

            <div className="mb-8">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
                  Rank {(activeQuest?.rank ?? "F").toUpperCase()}
                </span>
                <span className="h-1 w-1 rounded-full bg-slate-700" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-900">{threatLabel}</span>
              </div>
              <h2 className="text-4xl font-black uppercase italic leading-tight tracking-tighter text-white drop-shadow-2xl md:text-6xl">
                {missionTitle}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">{missionObjective}</p>
              <div className="mt-4 flex flex-wrap gap-4">
                <StatPill label="Materia" value={activeQuest?.subject ?? "Geral"} color="text-blue-400" />
                <StatPill label="Dificuldade" value={(activeQuest?.difficulty ?? "medio").toUpperCase()} color="text-red-400" />
                <StatPill
                  label="Loot"
                  value={`+${activeQuest?.rewardXp ?? 0} XP / +${activeQuest?.rewardGold ?? 0} G`}
                  color="text-purple-400"
                />
              </div>
            </div>

            <div className="mt-auto grid grid-cols-1 items-end gap-6 md:grid-cols-3">
              <div className="col-span-2 space-y-2">
                <div className="mb-1 flex items-end justify-between text-[11px] font-black uppercase text-red-500/80">
                  <span className="flex items-center gap-2">
                    <Target size={14} /> Progresso da Missao
                  </span>
                  <span className="font-mono text-xl tracking-tighter">
                    {activeQuest ? `${activeQuest.progressMinutes}/${activeQuest.targetMinutes} min` : "0/0"}
                  </span>
                </div>
                <div className="h-4 w-full overflow-hidden rounded-full border border-red-900/30 bg-black/50 p-1">
                  <div
                    className="relative h-full rounded-full bg-gradient-to-r from-red-800 via-red-500 to-orange-500 shadow-[0_0_15px_rgba(220,38,38,0.5)]"
                    style={{ width: `${bossEnergyPercent}%` }}
                  >
                    <div className="absolute inset-0 animate-shimmer bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)]" />
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  handleGlobalAction("attack");
                  navigateTo("/revisoes");
                }}
                className="group flex w-full items-center justify-center gap-4 rounded-2xl bg-red-600 px-12 py-5 text-xs font-black uppercase tracking-[0.3em] text-white shadow-[0_0_40px_rgba(220,38,38,0.3)] transition-all active:scale-95 hover:bg-red-500 md:w-auto"
                type="button"
              >
                <Swords size={20} className="transition-transform group-hover:rotate-45" />
                {activeQuest ? "Executar" : "Revisoes"}
              </button>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:col-span-12 lg:grid-cols-4">
          <BentoMini
            icon={Layers}
            title="Masmorra Ativa"
            val={`${dueReviews} Revisoes`}
            sub={`${openDailyQuests} missoes em aberto`}
            color="text-orange-500"
            onClick={() => navigateTo("/revisoes")}
          >
            <div className="mt-4 flex h-4 items-end gap-1">
              {(goalBars.length ? goalBars : Array.from({ length: 10 }, (_, index) => ({ subject: `slot-${index}`, minutes: 0, height: 10 }))).map((goal, index) => (
                <div
                  key={`${goal.subject}-${index}`}
                  className={`flex-1 rounded-sm ${goalBars.length ? "bg-orange-500 shadow-[0_0_5px_#f97316]" : "bg-slate-800"}`}
                  style={{ height: `${goal.height}%` }}
                  title={goalBars.length ? `${goal.subject}: ${goal.minutes} min` : "Sem metas configuradas"}
                />
              ))}
            </div>
          </BentoMini>

          <BentoMini
            icon={Terminal}
            title="Protocolo Treino"
            val={`${todayMinutes}/${dailyTarget} min`}
            sub={`${todayPercent}% da meta diaria`}
            color="text-[hsl(var(--accent))]"
            onClick={() => navigateTo("/arquivos")}
          >
            <div className="mt-4 space-y-1">
              <div className="flex justify-between text-[8px] font-bold uppercase text-slate-500">
                <span>Progresso</span>
                <span>{todayPercent}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full border border-slate-800 bg-slate-900">
                <div className="h-full bg-[hsl(var(--accent))] shadow-[0_0_10px_rgba(var(--glow),1)]" style={{ width: `${todayPercent}%` }} />
              </div>
            </div>
          </BentoMini>

          <BentoMini
            icon={Cpu}
            title="Nucleo Central"
            val={`Fonte: ${missionSource}`}
            sub={`Semana ${weekMinutes}/${weeklyTarget} min`}
            color="text-blue-500"
            onClick={() => navigateTo("/ia")}
          >
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-blue-500/20 bg-blue-500/10 p-2">
              <div className="flex gap-0.5">
                {[0, 1, 2].map((value) => (
                  <div
                    key={value}
                    className="h-2 w-0.5 animate-pulse rounded-full bg-blue-500"
                    style={{ animationDelay: `${value * 0.2}s` }}
                  />
                ))}
              </div>
              <span className="text-[9px] font-mono uppercase text-blue-400">{loading ? "Sincronizando..." : "Sincronizado"}</span>
            </div>
          </BentoMini>

          <BentoMini
            icon={TrendingUp}
            title="Status Evolucao"
            val={`Streak: ${streakDays} dias`}
            sub={`Nivel ${globalStats.level} • ${weekPercent}% semana`}
            color="text-purple-500"
            onClick={() => navigateTo("/evolucao")}
          >
            <div className="mt-4 flex items-center gap-2">
              <div className="flex -space-x-2">
                <div className={`flex h-5 w-5 items-center justify-center rounded-full border border-slate-700 bg-slate-800 ${todayPercent >= 100 ? "text-yellow-500" : "text-slate-500"}`}>1</div>
                <div className={`flex h-5 w-5 items-center justify-center rounded-full border border-slate-700 bg-slate-800 ${weekPercent >= 100 ? "text-yellow-500" : "text-slate-500"}`}>2</div>
                <div className={`flex h-5 w-5 items-center justify-center rounded-full border border-slate-700 bg-slate-800 ${dueReviews === 0 ? "text-yellow-500" : "text-slate-500"}`}>3</div>
              </div>
              <span className="ml-auto text-[9px] font-black uppercase text-purple-400">
                {streakDays >= 7 ? "Maestria II" : "Maestria I"}
              </span>
            </div>
          </BentoMini>
        </div>
      </div>
    </div>
  );
}
