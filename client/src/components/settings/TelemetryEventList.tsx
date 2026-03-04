import type { FilesTelemetryEvent } from "../../lib/filesTelemetry";
import { useTheme } from "../../contexts/ThemeContext";

interface TelemetryEventListProps {
    events: FilesTelemetryEvent[];
}

export function TelemetryEventList({ events }: TelemetryEventListProps) {
    const { isIosTheme } = useTheme();

    if (events.length === 0) {
        return null;
    }

    return (
        <div className="custom-scrollbar mt-4 max-h-[320px] space-y-2 overflow-y-auto pr-1" data-testid="settings-files-telemetry-list">
            {events.map((event, index) => (
                <div key={`${event.at}-${event.name}-${index}`} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <code className="text-[10px] font-black uppercase tracking-wider text-cyan-300">{event.name}</code>
                        <span className={`text-[10px] font-mono ${isIosTheme ? "text-slate-500" : "text-slate-400"}`}>{new Date(event.at).toLocaleString("pt-BR")}</span>
                    </div>
                    <div className={`mt-2 flex flex-wrap items-center gap-2 text-[10px] ${isIosTheme ? "text-slate-600" : "text-slate-300"}`}>
                        <span className="rounded border border-slate-700 liquid-glass px-2 py-0.5">source: {String(event.payload.source ?? "-")}</span>
                        {typeof event.payload.durationMs === "number" && (
                            <span className="rounded border border-slate-700 liquid-glass px-2 py-0.5">duracao: {Math.max(0, Math.round(event.payload.durationMs))} ms</span>
                        )}
                        {event.payload.error && (
                            <span className="rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-red-300">erro: {String(event.payload.error)}</span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
