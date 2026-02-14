const CSRF_ENDPOINT = "/api/v1/auth/csrf";
const CSRF_HEADER_NAME = "X-CSRF-Token";
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

let csrfTokenCache: string | null = null;

export interface HunterSystemResponse {
  resposta_texto: string;
  xp_ganho: number;
  missao_concluida: boolean;
  status_mensagem: string;
}

export interface UserOut {
  id: string;
  email: string;
  isAdmin: boolean;
}

export interface AuthOut {
  user: UserOut;
}

export interface MeOut {
  user: UserOut | null;
}

export interface ProgressionOut {
  level: number;
  xp: number;
  maxXp: number;
  gold: number;
}

export interface VitalsOut {
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  fatigue: number;
  maxFatigue: number;
}

export interface AppStateOut {
  user: UserOut;
  streakDays: number;
  progression?: ProgressionOut | null;
  vitals?: VitalsOut | null;
  settings?: UserSettingsOut | null;
}

export interface CreateSessionIn {
  subject: string;
  minutes: number;
  mode: string;
  notes?: string;
}

export interface CreateSessionOut {
  ok: boolean;
  xpEarned: number;
  goldEarned: number;
}

export interface SessionOut {
  id: string;
  subject: string;
  minutes: number;
  mode: string;
  notes?: string | null;
  date: string;
  createdAt: string;
  xpEarned: number;
  goldEarned: number;
}

export interface SessionListOut {
  sessions: SessionOut[];
  nextCursor?: string | null;
}

export type ResetScope = "missions" | "progression" | "sessions" | "inventory" | "reviews" | "all";

export interface ResetStateOut {
  applied: ResetScope[];
  summary: Record<string, number>;
}

interface ApiErrorEnvelope {
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
}

export class ApiRequestError extends Error {
  status: number;
  code: string;
  details: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function isUnsafeMethod(method: string): boolean {
  return UNSAFE_METHODS.has(method.toUpperCase());
}

function buildHeaders(initHeaders: HeadersInit | undefined, hasJsonBody: boolean): Headers {
  const headers = new Headers(initHeaders ?? {});
  if (hasJsonBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
}

async function parseApiError(response: Response): Promise<ApiErrorEnvelope | undefined> {
  try {
    return (await response.json()) as ApiErrorEnvelope;
  } catch {
    return undefined;
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

async function fetchCsrfToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && csrfTokenCache) {
    return csrfTokenCache;
  }

  const response = await fetch(CSRF_ENDPOINT, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new ApiRequestError(response.status, "csrf_fetch_failed", "Falha ao obter token CSRF.");
  }

  const payload = (await response.json()) as { csrfToken?: string };
  const token = String(payload?.csrfToken ?? "").trim();
  if (!token) {
    throw new ApiRequestError(500, "csrf_missing", "Token CSRF ausente na resposta.");
  }

  csrfTokenCache = token;
  return token;
}

async function requestJson<T>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const hasJsonBody = typeof init.body === "string";
  const headers = buildHeaders(init.headers, hasJsonBody);

  const execute = async (): Promise<Response> => {
    if (isUnsafeMethod(method)) {
      headers.set(CSRF_HEADER_NAME, await fetchCsrfToken());
    }

    return fetch(input, {
      ...init,
      method,
      headers,
      credentials: "include",
    });
  };

  let response = await execute();

  if (!response.ok && isUnsafeMethod(method)) {
    const payload = await parseApiError(response);
    if (payload?.code === "csrf_invalid") {
      headers.set(CSRF_HEADER_NAME, await fetchCsrfToken(true));
      response = await fetch(input, {
        ...init,
        method,
        headers,
        credentials: "include",
      });
    } else if (payload) {
      throw new ApiRequestError(
        response.status,
        payload.code ?? "http_error",
        payload.message ?? "Falha na comunicacao com a API.",
        payload.details ?? {},
      );
    }
  }

  if (!response.ok) {
    const payload = await parseApiError(response);
    throw new ApiRequestError(
      response.status,
      payload?.code ?? "http_error",
      payload?.message ?? "Falha na comunicacao com a API.",
      payload?.details ?? {},
    );
  }

  return parseJsonResponse<T>(response);
}

export interface UserSettingsOut {
  dailyTargetMinutes: number;
  pomodoroWorkMin: number;
  pomodoroBreakMin: number;
  timezone: string;
  language: string;
  reminderEnabled: boolean;
  reminderTime: string;
  reminderEveryMin: number;
  xpPerMinute: number;
  goldPerMinute: number;
  geminiApiKey?: string | null;
  agentPersonality: string;
}

export interface UpdateSettingsIn {
  dailyTargetMinutes?: number;
  pomodoroWorkMin?: number;
  pomodoroBreakMin?: number;
  timezone?: string;
  language?: string;
  reminderEnabled?: boolean;
  reminderTime?: string;
  reminderEveryMin?: number;
  xpPerMinute?: number;
  goldPerMinute?: number;
  geminiApiKey?: string;
  agentPersonality?: string;
}

export async function updateSettings(payload: UpdateSettingsIn): Promise<UserSettingsOut> {
  return requestJson<UserSettingsOut>("/api/v1/me/settings", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function postHunterMessage(mensagem: string): Promise<HunterSystemResponse> {
  return requestJson<HunterSystemResponse>("/api/v1/ai/hunter", {
    method: "POST",
    body: JSON.stringify({ mensagem }),
  });
}

export async function login(email: string, password: string): Promise<AuthOut> {
  return requestJson<AuthOut>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function signup(email: string, password: string): Promise<AuthOut> {
  return requestJson<AuthOut>("/api/v1/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function logout(): Promise<{ ok: boolean }> {
  const output = await requestJson<{ ok: boolean } | undefined>("/api/v1/auth/logout", {
    method: "POST",
  });
  csrfTokenCache = null;
  return output ?? { ok: true };
}

export async function getMe(): Promise<MeOut> {
  return requestJson<MeOut>("/api/v1/me", {
    method: "GET",
  });
}

export async function getMeState(): Promise<AppStateOut> {
  return requestJson<AppStateOut>("/api/v1/me/state", {
    method: "GET",
  });
}

export async function resetMeState(scopes: ResetScope[]): Promise<ResetStateOut> {
  return requestJson<ResetStateOut>("/api/v1/me/reset", {
    method: "POST",
    body: JSON.stringify({ scopes }),
  });
}

export async function createSession(payload: CreateSessionIn): Promise<CreateSessionOut> {
  return requestJson<CreateSessionOut>("/api/v1/sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listVideoSessions(cursor?: string, limit = 200): Promise<SessionListOut> {
  const params = new URLSearchParams();
  params.set("mode", "video_lesson");
  params.set("limit", String(limit));
  if (cursor) {
    params.set("cursor", cursor);
  }

  return requestJson<SessionListOut>(`/api/v1/sessions?${params.toString()}`, {
    method: "GET",
  });
}
