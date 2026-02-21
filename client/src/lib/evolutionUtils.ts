import type { DailyQuestOut, SessionOut, WeeklyQuestOut } from "../lib/api";

// ---------- ViewModels ----------

export interface QuestCardVM {
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

export interface RaidCellVM {
    date: string;
    minutes: number;
    intensity: 0 | 1 | 2 | 3;
    active: boolean;
    tooltip: string;
}

// ---------- Constants ----------

export const HEATMAP_DAYS = 28;
const SESSION_PAGE_LIMIT = 200;
const MAX_SESSION_PAGES = 6;

export const HEATMAP_INTENSITY_CLASS: Record<RaidCellVM["intensity"], string> = {
    0: "bg-white/[0.02] border border-white/5",
    1: "bg-cyan-900/60 border border-cyan-900/40",
    2: "bg-cyan-600/80 border border-cyan-500/50 hover:shadow-[0_0_15px_rgba(6,182,212,0.6)]",
    3: "bg-cyan-400 border border-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.6)] hover:shadow-[0_0_15px_rgba(34,211,238,0.8)]",
};

export const QUEST_TYPE_CLASS: Record<QuestCardVM["typeKey"], string> = {
    daily: "bg-blue-500/10 border-blue-500/25 text-blue-400 drop-shadow-[0_0_5px_rgba(59,130,246,0.5)]",
    weekly: "bg-purple-500/10 border-purple-500/25 text-purple-300 drop-shadow-[0_0_5px_rgba(168,85,247,0.5)]",
};

// ---------- Helpers ----------

export function clampPercent(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, Math.round(value)));
}

export function roundPositive(value: number): number {
    if (!Number.isFinite(value) || value < 0) return 0;
    return Math.round(value);
}

function toIsoDate(value: Date): string {
    return value.toISOString().slice(0, 10);
}

export function makeRecentDateRange(days: number): { from: string; to: string; keys: string[] } {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const keys: string[] = [];
    for (let cursor = days - 1; cursor >= 0; cursor -= 1) {
        const target = new Date(now);
        target.setDate(now.getDate() - cursor);
        keys.push(toIsoDate(target));
    }
    return { from: keys[0] ?? toIsoDate(now), to: keys[keys.length - 1] ?? toIsoDate(now), keys };
}

export function questProgressRatio(progressMinutes: number, targetMinutes: number): number {
    return Math.max(0, progressMinutes) / Math.max(1, targetMinutes);
}

export function toQuestVm(quest: DailyQuestOut | WeeklyQuestOut, typeKey: "daily" | "weekly"): QuestCardVM {
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

export function pickActiveQuest(quests: QuestCardVM[]): QuestCardVM | null {
    if (!quests.length) return null;
    const ordered = [...quests].sort((left, right) => {
        if (left.completed !== right.completed) return left.completed ? 1 : -1;
        if (left.progressRatio !== right.progressRatio) return right.progressRatio - left.progressRatio;
        return right.rewardXp - left.rewardXp;
    });
    return ordered[0] ?? null;
}

function raidIntensity(minutes: number, targetMinutes: number): RaidCellVM["intensity"] {
    if (minutes <= 0) return 0;
    const ratio = minutes / Math.max(1, targetMinutes);
    if (ratio >= 1) return 3;
    if (ratio >= 0.5) return 2;
    return 1;
}

export function buildRaidHistory(dayKeys: string[], sessions: SessionOut[], dailyTargetMinutes: number): RaidCellVM[] {
    const minutesByDate = new Map<string, number>();
    for (const session of sessions) {
        const dateKey = String(session.date ?? "").slice(0, 10);
        if (!dateKey) continue;
        minutesByDate.set(dateKey, (minutesByDate.get(dateKey) ?? 0) + Math.max(0, Number(session.minutes ?? 0)));
    }

    return dayKeys.map((date) => {
        const minutes = roundPositive(minutesByDate.get(date) ?? 0);
        const intensity = raidIntensity(minutes, dailyTargetMinutes);
        return { date, minutes, intensity, active: minutes > 0, tooltip: `${date} - ${minutes} min` };
    });
}

export function resolveArenaPrompt(activeQuest: QuestCardVM | null): { question: string; answer: string } {
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

import { listSessions } from "../lib/api";

export async function loadRecentSessions(dateFrom: string, dateTo: string): Promise<SessionOut[]> {
    const sessions: SessionOut[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < MAX_SESSION_PAGES; page += 1) {
        const response = await listSessions({ dateFrom, dateTo, limit: SESSION_PAGE_LIMIT, cursor });
        sessions.push(...(response.sessions ?? []));
        cursor = response.nextCursor ?? undefined;
        if (!cursor) break;
    }
    return sessions;
}

import { ApiRequestError } from "../lib/api";

export function toEvolutionErrorMessage(error: unknown): string {
    if (error instanceof ApiRequestError) {
        if (error.status === 401) return "Sessao expirada. Conecte a conta novamente.";
        return error.message || "Falha ao carregar dados de evolucao.";
    }
    return "Falha ao carregar dados de evolucao.";
}
