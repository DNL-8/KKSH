import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "../common/Icon";
import { clearFilesTelemetry, readFilesTelemetry, type FilesTelemetryEvent } from "../../lib/filesTelemetry";
import { useToast } from "../common/Toast";
import { useTheme } from "../../contexts/ThemeContext";
import { TelemetryStatsCards } from "./TelemetryStatsCards";
import { TelemetryEventList } from "./TelemetryEventList";

type FilesTelemetryFilter = "all" | "import" | "bridge" | "metadata" | "error";

const FILES_TELEMETRY_FILTERS: Array<{ id: FilesTelemetryFilter; label: string }> = [
    { id: "all", label: "Todos" },
    { id: "import", label: "Import" },
    { id: "bridge", label: "Bridge" },
    { id: "metadata", label: "Metadata" },
    { id: "error", label: "Erro" },
];

function matchesFilesTelemetryFilter(event: FilesTelemetryEvent, filter: FilesTelemetryFilter): boolean {
    if (filter === "all") return true;
    if (filter === "error") return event.name.endsWith(".error");
    return event.name.startsWith(`files.${filter}`);
}

export function SettingsTelemetry() {
    const { isIosTheme } = useTheme();
    const { showToast } = useToast();
    const [filesTelemetryEvents, setFilesTelemetryEvents] = useState<FilesTelemetryEvent[]>([]);
    const [filesTelemetryFilter, setFilesTelemetryFilter] = useState<FilesTelemetryFilter>("all");

    const refreshFilesTelemetry = useCallback(() => {
        const events = readFilesTelemetry();
        setFilesTelemetryEvents([...events].reverse());
    }, []);

    useEffect(() => {
        refreshFilesTelemetry();
    }, [refreshFilesTelemetry]);

    const filesTelemetryStats = useMemo(() => {
        let errors = 0;
        let importEvents = 0;
        let bridgeEvents = 0;

        for (const event of filesTelemetryEvents) {
            if (event.name.endsWith(".error")) {
                errors += 1;
            }
            if (event.name.startsWith("files.import")) {
                importEvents += 1;
            }
            if (event.name.startsWith("files.bridge.play")) {
                bridgeEvents += 1;
            }
        }

        return {
            total: filesTelemetryEvents.length,
            errors,
            importEvents,
            bridgeEvents,
        };
    }, [filesTelemetryEvents]);

    const filesTelemetryFilterCounts = useMemo(() => {
        const counts: Record<FilesTelemetryFilter, number> = {
            all: filesTelemetryEvents.length,
            import: 0,
            bridge: 0,
            metadata: 0,
            error: 0,
        };

        for (const event of filesTelemetryEvents) {
            if (event.name.startsWith("files.import")) counts.import += 1;
            if (event.name.startsWith("files.bridge.play")) counts.bridge += 1;
            if (event.name.startsWith("files.metadata")) counts.metadata += 1;
            if (event.name.endsWith(".error")) counts.error += 1;
        }

        return counts;
    }, [filesTelemetryEvents]);

    const filteredFilesTelemetryEvents = useMemo(
        () => filesTelemetryEvents.filter((event) => matchesFilesTelemetryFilter(event, filesTelemetryFilter)),
        [filesTelemetryEvents, filesTelemetryFilter],
    );

    const visibleFilesTelemetryEvents = useMemo(
        () => filteredFilesTelemetryEvents.slice(0, 40),
        [filteredFilesTelemetryEvents],
    );

    const handleClearFilesTelemetry = useCallback(() => {
        if (filesTelemetryEvents.length === 0) {
            showToast("Nao ha eventos para limpar.", "info");
            return;
        }

        const confirmed = window.confirm("Limpar todos os eventos de telemetria de arquivos?");
        if (!confirmed) return;

        clearFilesTelemetry();
        refreshFilesTelemetry();
        showToast("Telemetria de arquivos limpa.", "success");
    }, [filesTelemetryEvents.length, refreshFilesTelemetry, showToast]);

    const handleExportFilesTelemetry = useCallback(() => {
        if (filesTelemetryEvents.length === 0) {
            showToast("Nao ha eventos para exportar.", "info");
            return;
        }

        const payload = {
            exportedAt: new Date().toISOString(),
            version: 1,
            eventCount: filesTelemetryEvents.length,
            events: [...filesTelemetryEvents].reverse(),
        };

        const fileName = `cmd8-files-telemetry-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);

        showToast("Telemetria exportada com sucesso.", "success");
    }, [filesTelemetryEvents, showToast]);

    return (
        <section className={isIosTheme ? "ios26-text-secondary" : ""}>
            <div className="mb-6 flex items-center gap-4">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                    <Icon name="database" className="text-[24px]" />
                </div>
                <h2 className={`text-lg font-black uppercase tracking-widest drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] ${isIosTheme ? "text-slate-900" : "text-slate-100"}`}>
                    Telemetria de Arquivos
                </h2>
            </div>

            <div className={`rounded-[40px] p-8 transition-all ${isIosTheme ? "ios26-section" : "border border-slate-700/40 bg-gradient-to-b from-[#0a0f1d]/90 to-[#050813]/90 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl"}`}>
                <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                    <p className={`text-[13px] max-w-lg leading-relaxed font-medium ${isIosTheme ? "text-slate-600" : "text-slate-300"}`}>
                        Eventos locais de importacao, backup e reproducao da bridge para diagnostico rapido.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={refreshFilesTelemetry}
                            className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${isIosTheme ? "ios26-control ios26-focusable text-slate-800" : "border border-slate-700/40 bg-white/[0.03] text-slate-200 hover:bg-white/[0.08] hover:text-slate-50"}`}
                            type="button"
                        >
                            Atualizar
                        </button>
                        <button
                            onClick={handleExportFilesTelemetry}
                            disabled={filesTelemetryEvents.length === 0}
                            className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all disabled:cursor-not-allowed disabled:opacity-50 ${isIosTheme ? "ios26-control ios26-focusable ios26-status-success" : "border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)] hover:bg-emerald-500/20 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]"}`}
                            type="button"
                        >
                            Exportar JSON
                        </button>
                        <button
                            onClick={handleClearFilesTelemetry}
                            disabled={filesTelemetryEvents.length === 0}
                            className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all disabled:cursor-not-allowed disabled:opacity-50 ${isIosTheme ? "ios26-control ios26-focusable ios26-status-danger" : "border border-red-500/40 bg-red-500/10 text-red-400 shadow-[0_0_10px_rgba(220,38,38,0.1)] hover:bg-red-500/20 hover:shadow-[0_0_15px_rgba(220,38,38,0.3)]"}`}
                            type="button"
                        >
                            Limpar
                        </button>
                    </div>
                </div>

                <TelemetryStatsCards
                    total={filesTelemetryStats.total}
                    errors={filesTelemetryStats.errors}
                    importEvents={filesTelemetryStats.importEvents}
                    bridgeEvents={filesTelemetryStats.bridgeEvents}
                />

                <div className="mt-4 flex flex-wrap gap-2" data-testid="settings-files-telemetry-filters">
                    {FILES_TELEMETRY_FILTERS.map((filterOption) => {
                        const isActive = filesTelemetryFilter === filterOption.id;
                        const count = filesTelemetryFilterCounts[filterOption.id];
                        return (
                            <button
                                key={filterOption.id}
                                onClick={() => setFilesTelemetryFilter(filterOption.id)}
                                type="button"
                                aria-pressed={isActive}
                                className={`rounded-lg border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors ${isActive
                                    ? isIosTheme ? "ios26-chip-active" : "border-cyan-400/60 bg-cyan-500/20 text-cyan-200"
                                    : isIosTheme ? "ios26-chip" : "border-slate-700 liquid-glass text-slate-300 hover:bg-white/[0.10] hover:text-slate-100"
                                    }`}
                            >
                                {filterOption.label} ({count})
                            </button>
                        );
                    })}
                </div>

                {filesTelemetryEvents.length === 0 ? (
                    <div className={`mt-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-sm ${isIosTheme ? "text-slate-500" : "text-slate-300"}`}>
                        Sem eventos de telemetria no momento.
                    </div>
                ) : filteredFilesTelemetryEvents.length === 0 ? (
                    <div className={`mt-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-sm ${isIosTheme ? "text-slate-500" : "text-slate-300"}`}>
                        Sem eventos para o filtro selecionado.
                    </div>
                ) : (
                    <TelemetryEventList events={visibleFilesTelemetryEvents} />
                )}
            </div>
        </section>
    );
}
