import { Icon } from "../common/Icon";
import type { StoredVideo } from "../../lib/localVideosStore";
import { formatBytes, formatDate, formatStorageKind } from "./utils";
import type { TabMode } from "./types";
import { useTheme } from "../../contexts/ThemeContext";

interface VideoMetadataProps {
    selectedVideo: StoredVideo | null;
    selectedVideoRef: string | null;
    videoCount: number;
    folderCount: number;
    completed: boolean;
    activeTab: TabMode;
    onTabChange: (tab: TabMode) => void;
}

export function VideoMetadata({
    selectedVideo,
    selectedVideoRef,
    videoCount,
    folderCount,
    completed,
    activeTab,
    onTabChange,
}: VideoMetadataProps) {
    const { isIosTheme } = useTheme();
    const overviewTabId = "files-tab-overview";
    const metadataTabId = "files-tab-metadata";
    const overviewPanelId = "files-panel-overview";
    const metadataPanelId = "files-panel-metadata";
    const orderedTabs: TabMode[] = ["overview", "metadata"];
    const handleTabListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        let nextTab: TabMode | null = null;
        const currentIndex = orderedTabs.indexOf(activeTab);
        switch (event.key) {
            case "ArrowRight":
                nextTab = orderedTabs[(currentIndex + 1) % orderedTabs.length];
                break;
            case "ArrowLeft":
                nextTab = orderedTabs[(currentIndex - 1 + orderedTabs.length) % orderedTabs.length];
                break;
            case "Home":
                nextTab = orderedTabs[0];
                break;
            case "End":
                nextTab = orderedTabs[orderedTabs.length - 1];
                break;
        }
        if (!nextTab) {
            return;
        }
        event.preventDefault();
        onTabChange(nextTab);
        const targetId = nextTab === "overview" ? overviewTabId : metadataTabId;
        window.requestAnimationFrame(() => {
            document.getElementById(targetId)?.focus();
        });
    };

    return (
        <div className={`rounded-3xl p-4 md:p-6 mt-4 ${isIosTheme ? "ios26-section" : "border border-cyan-500/20 liquid-glass"}`}>
            <div
                className={`mb-6 flex flex-wrap items-center gap-2 border-b pb-4 ${isIosTheme ? "ios26-divider" : "border-cyan-500/20"}`}
                role="tablist"
                aria-label="Abas de detalhes do video"
                aria-orientation="horizontal"
                onKeyDown={handleTabListKeyDown}
            >
                <button
                    className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "overview"
                        ? isIosTheme ? "ios26-chip-active" : "bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent-light))] shadow-[0_0_15px_rgba(var(--glow),0.1)]"
                        : isIosTheme ? "ios26-chip ios26-focusable" : "bg-transparent text-slate-300 hover:text-slate-100 hover:bg-white/[0.08]"
                        }`}
                    data-testid="tab-overview"
                    id={overviewTabId}
                    role="tab"
                    aria-selected={activeTab === "overview"}
                    aria-controls={overviewPanelId}
                    tabIndex={activeTab === "overview" ? 0 : -1}
                    onClick={() => onTabChange("overview")}
                    type="button"
                >
                    Visao Geral
                </button>
                <button
                    className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "metadata"
                        ? isIosTheme ? "ios26-chip-active" : "bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent-light))] shadow-[0_0_15px_rgba(var(--glow),0.1)]"
                        : isIosTheme ? "ios26-chip ios26-focusable" : "bg-transparent text-slate-300 hover:text-slate-100 hover:bg-white/[0.08]"
                        }`}
                    data-testid="tab-metadata"
                    id={metadataTabId}
                    role="tab"
                    aria-selected={activeTab === "metadata"}
                    aria-controls={metadataPanelId}
                    tabIndex={activeTab === "metadata" ? 0 : -1}
                    onClick={() => onTabChange("metadata")}
                    type="button"
                >
                    Metadados
                </button>
            </div>

            {activeTab === "overview" ? (
                <div className="space-y-4 animate-in fade-in duration-500" id={overviewPanelId} role="tabpanel" aria-labelledby={overviewTabId}>
                    <div className="flex items-center gap-3 px-1 mb-2">
                        {selectedVideo ? (
                            <>
                                <Icon name="play" className="text-[14px] text-[hsl(var(--accent))]" />
                                <span className={`text-sm font-bold tracking-wide truncate ${isIosTheme ? "text-slate-900" : "text-slate-100"}`}>{selectedVideo.name}</span>
                            </>
                        ) : (
                            <span className={`text-xs font-semibold uppercase tracking-widest ${isIosTheme ? "text-slate-500" : "text-slate-400"}`}>Selecione uma aula na biblioteca para iniciar.</span>
                        )}
                    </div>

                    {/* Unified Stats Bar */}
                    <div className={`flex flex-col sm:flex-row items-stretch rounded-2xl overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-white/5 ${isIosTheme ? "ios26-section" : "border border-cyan-500/25 liquid-glass"}`}>
                        <div className="flex-1 p-5 relative overflow-hidden group">
                            <div className="absolute -right-4 -top-4 text-slate-800 transition-transform group-hover:scale-110 group-hover:text-[hsl(var(--accent)/0.05)]"><svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h16v12H4z" /></svg></div>
                            <p className={`text-[9px] uppercase font-black tracking-widest relative z-10 ${isIosTheme ? "text-slate-500" : "text-slate-400"}`}>Total de videos</p>
                            <p className={`mt-2 text-3xl font-black relative z-10 ${isIosTheme ? "text-slate-900" : "text-slate-100"}`}>{videoCount}</p>
                        </div>
                        <div className="flex-1 p-5 relative overflow-hidden group">
                            <div className="absolute -right-4 -top-4 text-slate-800 transition-transform group-hover:scale-110 group-hover:text-[hsl(var(--accent)/0.05)]"><svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" /></svg></div>
                            <p className={`text-[9px] uppercase font-black tracking-widest relative z-10 ${isIosTheme ? "text-slate-500" : "text-slate-400"}`}>Pastas</p>
                            <p className={`mt-2 text-3xl font-black relative z-10 ${isIosTheme ? "text-slate-900" : "text-slate-100"}`}>{folderCount}</p>
                        </div>
                        <div className="flex-[1.5] p-5 relative overflow-hidden group">
                            <div className="absolute -right-4 -top-4 text-slate-800 transition-transform group-hover:scale-110 group-hover:text-[hsl(var(--accent)/0.05)]"><svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2zm0-4H7V7h10v2z" /></svg></div>
                            <p className={`text-[9px] uppercase font-black tracking-widest relative z-10 ${isIosTheme ? "text-slate-500" : "text-slate-400"}`}>Pasta Atual</p>
                            <p className={`mt-2 text-base font-bold truncate relative z-10 ${isIosTheme ? "text-slate-800" : "text-slate-100"}`} title={selectedVideo?.relativePath}>{selectedVideo?.relativePath ?? "-"}</p>
                        </div>
                        <div className={`flex-1 p-5 relative overflow-hidden group transition-colors ${completed ? "bg-emerald-500/5 text-emerald-400" : ""}`}>
                            <div className={`absolute -right-4 -top-4 transition-transform group-hover:scale-110 ${completed ? 'text-emerald-500/5' : 'text-slate-800 group-hover:text-[hsl(var(--accent)/0.05)]'}`}><svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg></div>
                            <p className={`text-[9px] uppercase font-black tracking-widest relative z-10 ${isIosTheme ? "text-slate-500" : "text-slate-400"}`}>Status do Sistema</p>
                            <div className="mt-2 flex items-center gap-2 relative z-10">
                                <span className={`h-2 w-2 rounded-full ${completed ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-slate-700"}`} />
                                <p className={`text-sm font-black uppercase tracking-wider ${completed ? 'text-emerald-300' : isIosTheme ? "text-slate-600" : "text-slate-300"}`}>
                                    {completed ? "Concluida" : "Pendente"}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500" id={metadataPanelId} role="tabpanel" aria-labelledby={metadataTabId}>
                    {selectedVideo ? (
                        <div className={`rounded-2xl overflow-hidden ${isIosTheme ? "ios26-section" : "border border-cyan-500/25 liquid-glass"}`}>
                            {/* Nome do arquivo - Header do Card */}
                            <div className={`p-5 border-b bg-white/[0.02] relative overflow-hidden ${isIosTheme ? "border-slate-300/50" : "border-cyan-500/20"}`}>
                                <div className="absolute right-0 top-0 w-32 h-32 bg-[hsl(var(--accent)/0.05)] rounded-full blur-[40px]" />
                                <p className={`text-[9px] uppercase font-black tracking-widest mb-1 relative z-10 ${isIosTheme ? "text-slate-500" : "text-slate-400"}`}>Nome do arquivo</p>
                                <p className="text-[9px] uppercase font-black tracking-widest text-[hsl(var(--accent))] mb-1 relative z-10">Arquivo Ativo</p>
                                <p className={`text-xl font-black leading-tight break-words relative z-10 ${isIosTheme ? "text-slate-900" : "text-slate-100"}`}>{selectedVideo.name}</p>
                            </div>

                            {/* Informacoes Numericas Inferiores */}
                            <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-white/5">
                                <div className="p-5 group hover:bg-white/[0.02] transition-colors">
                                    <p className={`text-[9px] uppercase font-black tracking-widest mb-1 ${isIosTheme ? "text-slate-500" : "text-slate-400"}`}>Tamanho</p>
                                    <p className={`font-bold transition-colors ${isIosTheme ? "text-slate-800 group-hover:text-slate-900" : "text-slate-200 group-hover:text-slate-50"}`}>{formatBytes(selectedVideo.size)}</p>
                                </div>
                                <div className="p-5 group hover:bg-white/[0.02] transition-colors">
                                    <p className={`text-[9px] uppercase font-black tracking-widest mb-1 ${isIosTheme ? "text-slate-500" : "text-slate-400"}`}>Data</p>
                                    <p className={`font-bold transition-colors ${isIosTheme ? "text-slate-800 group-hover:text-slate-900" : "text-slate-200 group-hover:text-slate-50"}`}>{formatDate(selectedVideo.createdAt)}</p>
                                </div>
                                <div className="p-5 group hover:bg-white/[0.02] transition-colors">
                                    <p className={`text-[9px] uppercase font-black tracking-widest mb-1 ${isIosTheme ? "text-slate-500" : "text-slate-400"}`}>Codex</p>
                                    <p className={`font-mono text-[11px] font-bold liquid-glass-inner px-2 py-0.5 inline-block rounded ${isIosTheme ? "text-slate-600" : "text-slate-300"}`}>{selectedVideo.type || "video/*"}</p>
                                </div>
                                <div className="p-5 group hover:bg-white/[0.02] transition-colors">
                                    <p className={`text-[9px] uppercase font-black tracking-widest mb-1 ${isIosTheme ? "text-slate-500" : "text-slate-400"}`}>Armazenamento</p>
                                    <p className="font-bold uppercase text-xs text-indigo-400 group-hover:text-indigo-300 transition-colors flex items-center gap-1.5">
                                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                                        {formatStorageKind(selectedVideo)}
                                    </p>
                                </div>
                            </div>

                            {/* Detalhes Tecnicos Footer */}
                            <div className={`p-5 border-t bg-slate-950/40 flex flex-col sm:flex-row gap-6 ${isIosTheme ? "border-slate-300/50" : "border-cyan-500/20"}`}>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-[9px] uppercase font-black tracking-widest mb-1 ${isIosTheme ? "text-slate-500" : "text-slate-400"}`}>Caminho do Diretorio</p>
                                    <p className={`font-semibold text-sm truncate ${isIosTheme ? "text-slate-800" : "text-slate-100"}`}>{selectedVideo.relativePath}</p>
                                </div>
                                <div className="hidden sm:block w-px liquid-glass-inner"></div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-[9px] uppercase font-black tracking-widest mb-1 flex items-center gap-1.5 ${isIosTheme ? "text-slate-500" : "text-slate-400"}`}>Hash Id<Icon name="lock" className="text-[10px]" /></p>
                                    <p className={`font-mono text-[10px] truncate ${isIosTheme ? "text-slate-500" : "text-slate-300"}`} title={selectedVideoRef ?? "-"}>{selectedVideoRef ?? "-"}</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className={`flex items-center justify-center p-8 rounded-2xl border border-dashed ${isIosTheme ? "ios26-section" : "border-cyan-500/25 bg-white/[0.01]"}`}>
                            <p className={`text-xs font-bold tracking-widest uppercase ${isIosTheme ? "text-slate-500" : "text-slate-300"}`}>Nenhum arquivo ativo</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

