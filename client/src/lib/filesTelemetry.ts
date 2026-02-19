export type FilesTelemetryEventName =
  | "files.import.start"
  | "files.import.success"
  | "files.import.error"
  | "files.metadata.export.success"
  | "files.metadata.export.error"
  | "files.metadata.import.success"
  | "files.metadata.import.error"
  | "files.bridge.play.success"
  | "files.bridge.play.error";

export type FilesTelemetrySource = "local" | "bridge" | "runtime";

export interface FilesTelemetryPayload {
  source: FilesTelemetrySource;
  durationMs?: number;
  error?: string;
  [key: string]: unknown;
}

export interface FilesTelemetryEvent {
  name: FilesTelemetryEventName;
  at: string;
  payload: FilesTelemetryPayload;
}

const FILES_TELEMETRY_KEY = "cmd8_files_telemetry_v1";
const MAX_STORED_EVENTS = 200;

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readStoredEvents(): FilesTelemetryEvent[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(FILES_TELEMETRY_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (item): item is FilesTelemetryEvent =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as { name?: unknown }).name === "string" &&
        typeof (item as { at?: unknown }).at === "string" &&
        typeof (item as { payload?: unknown }).payload === "object" &&
        (item as { payload?: unknown }).payload !== null,
    );
  } catch {
    return [];
  }
}

function writeStoredEvents(events: FilesTelemetryEvent[]): void {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(FILES_TELEMETRY_KEY, JSON.stringify(events));
  } catch {
    // Best-effort telemetry only.
  }
}

export function trackFilesTelemetry(name: FilesTelemetryEventName, payload: FilesTelemetryPayload): void {
  const event: FilesTelemetryEvent = {
    name,
    at: new Date().toISOString(),
    payload,
  };

  const current = readStoredEvents();
  const next = [...current, event];
  if (next.length > MAX_STORED_EVENTS) {
    next.splice(0, next.length - MAX_STORED_EVENTS);
  }
  writeStoredEvents(next);
}

export function readFilesTelemetry(): FilesTelemetryEvent[] {
  return readStoredEvents();
}

export function clearFilesTelemetry(): void {
  if (!canUseStorage()) {
    return;
  }
  try {
    window.localStorage.removeItem(FILES_TELEMETRY_KEY);
  } catch {
    // Best-effort telemetry only.
  }
}