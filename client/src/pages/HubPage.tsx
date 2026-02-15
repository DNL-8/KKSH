import {
  Activity,
  AlertTriangle,
  Brain,
  ChevronRight,
  Cpu,
  Layers,
  LayoutGrid,
  Loader2,
  RefreshCw,
  Save,
  Settings,
  Shield,
  Sparkles,
  Sword,
  Terminal,
  TrendingUp,
  User,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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

type AttributeKey = "python" | "sql" | "excel" | "etl";
type TechnicalAttributes = Record<AttributeKey, number>;

interface HubQueryData {
  state: AppStateOut;
  weekly: WeeklyReportOut;
}

interface StatBarProps {
  label: string;
  percent: number;
  gradientClass: string;
  sub: string;
  valueTestId?: string;
}

interface SystemCardProps {
  icon: LucideIcon;
  title: string;
  value: string;
  sub: string;
  tone: "orange" | "blue" | "cyan" | "purple";
  showBar?: boolean;
  progress?: number;
  valueTestId?: string;
  action?: React.ReactNode;
  footer?: React.ReactNode;
}

const STORAGE_PREFIX = "cmd8_hub_attributes_v1:";
const BASELINE: TechnicalAttributes = { python: 100, sql: 100, excel: 85, etl: 15 };

const KEYWORDS: Record<AttributeKey, string[]> = {
  python: ["python"],
  sql: ["sql", "postgres", "postgresql", "mysql", "sqlite"],
  excel: ["excel", "planilha", "spreadsheet"],
  etl: ["etl", "elt", "pipeline", "data engineering", "dbt", "airflow"],
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
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

function containsKeyword(subject: string, keywords: string[]): boolean {
  return keywords.some((keyword) => subject.includes(keyword));
}

function resolveDomain(subject: string): AttributeKey | null {
  const normalized = normalizeText(subject);
  const order: AttributeKey[] = ["python", "sql", "excel", "etl"];
  for (const domain of order) {
    if (containsKeyword(normalized, KEYWORDS[domain])) {
      return domain;
    }
  }
  return null;
}

function readStoredAttributes(userId: string): TechnicalAttributes | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<TechnicalAttributes>;
    return {
      python: clampPercent(Number(parsed.python)),
      sql: clampPercent(Number(parsed.sql)),
      excel: clampPercent(Number(parsed.excel)),
      etl: clampPercent(Number(parsed.etl)),
    };
  } catch {
    return null;
  }
}

function persistAttributes(userId: string, attrs: TechnicalAttributes): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(attrs));
  } catch {
    // Ignore.
  }
}

function computeAttributes(state: AppStateOut | null, weekly: WeeklyReportOut | null): TechnicalAttributes {
  if (!state || !weekly) {
    return BASELINE;
  }
  const hasSubjects = (weekly.bySubject ?? []).length > 0;
  const hasGoals = Object.keys(state.goals ?? {}).length > 0;
  if (!hasSubjects && !hasGoals) {
    return BASELINE;
  }

  const mins: TechnicalAttributes = { python: 0, sql: 0, excel: 0, etl: 0 };
  for (const row of weekly.bySubject ?? []) {
    const domain = resolveDomain(String(row.subject ?? ""));
    if (domain) {
      mins[domain] += Math.max(0, Number(row.minutes ?? 0));
    }
  }

  const dailyTarget = Math.max(1, Number(state.settings?.dailyTargetMinutes ?? 60));
  const weeklyTarget = dailyTarget * 7;
  const goals = state.goals ?? {};

  const out: TechnicalAttributes = { ...BASELINE };
  const domains: AttributeKey[] = ["python", "sql", "excel", "etl"];
  for (const domain of domains) {
    const minutes = mins[domain];
    const weeklyScore = clampPercent((minutes / weeklyTarget) * 220);

    let goal = 0;
    for (const [goalKey, rawValue] of Object.entries(goals)) {
      if (containsKeyword(normalizeText(goalKey), KEYWORDS[domain])) {
        goal += Math.max(0, Number(rawValue ?? 0));
      }
    }

    const goalScore = goal > 0 ? clampPercent((minutes / goal) * 100) : weeklyScore;
    out[domain] = clampPercent(goalScore * 0.6 + weeklyScore * 0.4);
  }
  return out;
}

function StatBar({ label, percent, gradientClass, sub, valueTestId }: StatBarProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
        <span>{label}</span>
        <span data-testid={valueTestId}>{percent}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full border border-white/10 bg-black/40">
        <div className={`h-full rounded-full bg-gradient-to-r ${gradientClass}`} style={{ width: `${percent}%` }} />
      </div>
      <div className="text-right text-[9px] text-slate-500">{sub}</div>
    </div>
  );
}

function SystemCard({ icon: Icon, title, value, sub, tone, showBar = false, progress = 0, valueTestId, action, footer }: SystemCardProps) {
  const toneMap = {
    orange: "text-orange-400 border-orange-500/30 bg-orange-500/10",
    blue: "text-blue-400 border-blue-500/30 bg-blue-500/10",
    cyan: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
    purple: "text-purple-400 border-purple-500/30 bg-purple-500/10",
  } as const;

  return (
    <article className="group rounded-3xl border border-white/10 bg-[#0a0b10]/90 p-6 transition-all hover:-translate-y-1">
      <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl border ${toneMap[tone]}`}>
        <Icon size={20} />
      </div>
      <div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">{title}</div>
      <div data-testid={valueTestId} className="mt-1 text-2xl font-black text-white">{value}</div>
      <div className="mt-1 text-[10px] text-slate-500">{sub}</div>
      {showBar && (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full border border-white/10 bg-black/40">
          <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${clampPercent(progress)}%` }} />
        </div>
      )}
      {action}
      {footer}
    </article>
  );
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div data-testid="hub-attributes-modal" role="dialog" aria-modal="true" className="w-full max-w-md rounded-3xl border border-blue-500/30 bg-[#0a0b10] p-6">
            <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-lg font-black uppercase italic text-white">Configuracao de Status</h3>
              <button type="button" onClick={() => setShowEditModal(false)} className="rounded-full p-2 hover:bg-white/10">
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            {(["python", "sql", "excel", "etl"] as AttributeKey[]).map((key) => (
              <div key={key} className="mb-4 space-y-1.5">
                <label htmlFor={`hub-attr-${key}`} className="text-[10px] font-black uppercase tracking-wider text-slate-300">{key.toUpperCase()}</label>
                <div className="flex items-center gap-3">
                  <input id={`hub-attr-${key}`} data-testid={`hub-attr-${key}`} type="range" min={0} max={100} value={draftAttributes[key]} onChange={(event) => onDraftChange(key, event.currentTarget.value)} className="h-2 w-full cursor-pointer rounded bg-slate-800" />
                  <div data-testid={`hub-attr-${key}-value`} className="w-12 text-right font-mono text-cyan-400">{draftAttributes[key]}%</div>
                </div>
              </div>
            ))}
            <button type="button" data-testid="hub-attributes-save" onClick={saveEditedAttributes} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-black uppercase tracking-wider text-white hover:bg-blue-500">
              <Save size={15} /> Salvar Alteracoes
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-300">
          <span className="flex items-center gap-2"><AlertTriangle size={15} />{error}</span>
          {authUser && <button type="button" onClick={() => void refreshHub()} className="rounded border border-red-500/30 px-3 py-1">Tentar de novo</button>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="lg:col-span-4 rounded-3xl border border-white/10 bg-[#0a0b10]/90 p-6">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500"><Activity size={12} />Biometria Hunter</div>
            <div className="flex items-center gap-2">
              <button type="button" data-testid="hub-attributes-edit-open" onClick={openEditModal} className="rounded-full border border-slate-700 p-1.5 text-slate-400 hover:text-white"><Settings size={12} /></button>
              {authUser && <button type="button" data-testid="hub-refresh-button" aria-label="Atualizar dados do hub" onClick={() => void refreshHub()} className="rounded-full border border-slate-700 p-1.5 text-slate-400 hover:text-cyan-300">{loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}</button>}
            </div>
          </div>
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-blue-500/30 bg-slate-900"><User className="text-slate-300" size={42} /></div>
            <div>
              <h2 className="text-2xl font-black uppercase italic text-white">{authUser ? "Shadow Hunter" : "Operador Visitante"}</h2>
              <p className="text-[10px] uppercase tracking-wider text-blue-400">Nivel {level} Operacional • Rank {rank}</p>
              <div className="mt-2 flex gap-2 text-slate-400"><Zap size={14} /><Brain size={14} /><Sparkles size={14} /></div>
            </div>
          </div>
          <div className="space-y-4 rounded-xl border border-white/10 bg-black/30 p-4">
            <StatBar label="PYTHON" percent={attributes.python} gradientClass="from-blue-600 to-blue-400" sub="Automacao & Scripting" valueTestId="hub-attr-python-stat" />
            <StatBar label="SQL" percent={attributes.sql} gradientClass="from-cyan-600 to-cyan-400" sub="Querying & Database" />
            <StatBar label="EXCEL" percent={attributes.excel} gradientClass="from-emerald-600 to-emerald-400" sub="Analise & Dashboards" />
            <StatBar label="ETL / ELT" percent={attributes.etl} gradientClass="from-amber-500 to-orange-400" sub="Data Pipelines" />
          </div>
          <button type="button" data-testid="hub-connect-button" onClick={() => (authUser ? void refreshHub() : openAuthPanel())} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 py-3 text-xs font-black uppercase tracking-[0.2em] text-blue-300 hover:bg-blue-500/20">
            {authUser ? "Sincronizar Sistema" : "Conectar Sistema"} <ChevronRight size={14} />
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
            <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-blue-400"><Brain size={14} className="mb-1" />Materia: {activeQuest?.subject ?? "Geral"}</div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-red-400"><Shield size={14} className="mb-1" />Dificuldade: {(activeQuest?.difficulty ?? "medio").toUpperCase()}</div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-purple-400"><Sparkles size={14} className="mb-1" />Loot: +{activeQuest?.rewardXp ?? 0} XP</div>
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
            <Sword size={14} /> Iniciar Revisoes
          </button>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <SystemCard icon={Layers} tone="orange" title="Masmorra Ativa" value={`${dueReviews} Revisoes`} sub={`${openDailyQuests} Missoes em Aberto`} valueTestId="hub-system-masmorra-value" />
        <SystemCard icon={Terminal} tone="blue" title="Protocolo Treino" value={`${todayMinutes}/${dailyTarget} min`} sub={`${todayPercent}% da Meta Diaria`} showBar progress={todayPercent} valueTestId="hub-system-training-value" />
        <SystemCard icon={Cpu} tone="cyan" title="Nucleo Central" value={missionSource} sub={`Semana ${weekMinutes}/${weeklyTarget} min`} valueTestId="hub-system-core-value" action={<button type="button" onClick={() => navigateTo("/ia")} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 py-2 text-[10px] font-black uppercase tracking-wider text-cyan-300"><LayoutGrid size={12} />Sincronizado</button>} />
        <SystemCard icon={TrendingUp} tone="purple" title="Status Evolucao" value={`Streak: ${streakDays}`} sub={`Nivel ${level} • ${weekPercent}% Semana`} valueTestId="hub-system-evolution-value" footer={<div className="mt-3 border-t border-white/10 pt-3 text-[10px] font-black uppercase tracking-wider text-purple-400">Maestria I</div>} />
      </div>
    </div>
  );
}
