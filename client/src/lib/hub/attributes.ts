
import type { AppStateOut, WeeklyReportOut } from "../api";

export type AttributeKey = "python" | "sql" | "excel" | "etl";
export type TechnicalAttributes = Record<AttributeKey, number>;

export const BASELINE: TechnicalAttributes = { python: 100, sql: 100, excel: 85, etl: 15 };

export const KEYWORDS: Record<AttributeKey, string[]> = {
    python: ["python"],
    sql: ["sql", "postgres", "postgresql", "mysql", "sqlite"],
    excel: ["excel", "planilha", "spreadsheet"],
    etl: ["etl", "elt", "pipeline", "data engineering", "dbt", "airflow"],
};

export function clampPercent(value: number): number {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, Math.min(100, Math.round(value)));
}

export function normalizeText(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
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

export function computeAttributes(state: AppStateOut | null, weekly: WeeklyReportOut | null): TechnicalAttributes {
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

const STORAGE_PREFIX = "cmd8_hub_attributes_v1:";

export function readStoredAttributes(userId: string): TechnicalAttributes | null {
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

export function persistAttributes(userId: string, attrs: TechnicalAttributes): void {
    if (typeof window === "undefined") {
        return;
    }
    try {
        window.localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(attrs));
    } catch {
        // Ignore.
    }
}
