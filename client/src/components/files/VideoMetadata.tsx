import { Icon } from "../common/Icon";
import type { StoredVideo } from "../../lib/localVideosStore";
import { formatBytes, formatDate, formatStorageKind } from "./utils";
import type { TabMode } from "./types";

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
    return (
        <div className="rounded-3xl p-4 md:p-6 mt-4">
            <div className="mb-6 flex items-center gap-2 border-b border-white/5 pb-4">
                <button
                    className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "overview"
                        ? "bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent-light))] shadow-[0_0_15px_rgba(var(--glow),0.1)]"
                        : "bg-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5"
                        }`}
                    data-testid="tab-overview"
                    onClick={() => onTabChange("overview")}
                    type="button"
                >
                    Visão Geral
                </button>
                <button
                    className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "metadata"
                        ? "bg-[hsl(var(--accent)/0.15)] text-[hsl(var(--accent-light))] shadow-[0_0_15px_rgba(var(--glow),0.1)]"
                        : "bg-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5"
                        }`}
                    data-testid="tab-metadata"
                    onClick={() => onTabChange("metadata")}
                    type="button"
                >
                    Metadados
                </button>
            </div>

            {activeTab === "overview" ? (
                <div className="space-y-4 animate-in fade-in duration-500">
                    <div className="flex items-center gap-3 px-1 mb-2">
                        {selectedVideo ? (
                            <>
                                <Icon name="play" className="text-[14px] text-[hsl(var(--accent))]" />
                                <span className="text-sm font-bold text-white tracking-wide truncate">{selectedVideo.name}</span>
                            </>
                        ) : (
                            <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Selecione uma aula na biblioteca para iniciar.</span>
                        )}
                    </div>

                    {/* Unified Stats Bar */}
                    <div className="flex flex-col sm:flex-row items-stretch rounded-2xl border border-white/5 bg-slate-900/30 overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-white/5">
                        <div className="flex-1 p-5 relative overflow-hidden group">
                            <div className="absolute -right-4 -top-4 text-slate-800 transition-transform group-hover:scale-110 group-hover:text-[hsl(var(--accent)/0.05)]"><svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h16v12H4z" /></svg></div>
                            <p className="text-[9px] uppercase font-black tracking-widest text-slate-500 relative z-10">Total Videos</p>
                            <p className="mt-2 text-3xl font-black text-white relative z-10">{videoCount}</p>
                        </div>
                        <div className="flex-1 p-5 relative overflow-hidden group">
                            <div className="absolute -right-4 -top-4 text-slate-800 transition-transform group-hover:scale-110 group-hover:text-[hsl(var(--accent)/0.05)]"><svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" /></svg></div>
                            <p className="text-[9px] uppercase font-black tracking-widest text-slate-500 relative z-10">Pastas</p>
                            <p className="mt-2 text-3xl font-black text-white relative z-10">{folderCount}</p>
                        </div>
                        <div className="flex-[1.5] p-5 relative overflow-hidden group">
                            <div className="absolute -right-4 -top-4 text-slate-800 transition-transform group-hover:scale-110 group-hover:text-[hsl(var(--accent)/0.05)]"><svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2zm0-4H7V7h10v2z" /></svg></div>
                            <p className="text-[9px] uppercase font-black tracking-widest text-slate-500 relative z-10">Pasta Atual</p>
                            <p className="mt-2 text-base font-bold text-slate-300 truncate relative z-10" title={selectedVideo?.relativePath}>{selectedVideo?.relativePath ?? "-"}</p>
                        </div>
                        <div className={`flex-1 p-5 relative overflow-hidden group transition-colors ${completed ? "bg-emerald-500/5 text-emerald-400" : ""}`}>
                            <div className={`absolute -right-4 -top-4 transition-transform group-hover:scale-110 ${completed ? 'text-emerald-500/5' : 'text-slate-800 group-hover:text-[hsl(var(--accent)/0.05)]'}`}><svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg></div>
                            <p className="text-[9px] uppercase font-black tracking-widest text-slate-500 relative z-10">Status do Sistema</p>
                            <div className="mt-2 flex items-center gap-2 relative z-10">
                                <span className={`h-2 w-2 rounded-full ${completed ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-slate-700"}`} />
                                <p className={`text-sm font-black uppercase tracking-wider ${completed ? 'text-emerald-300' : 'text-slate-400'}`}>
                                    {completed ? "Concluída" : "Pendente"}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {selectedVideo ? (
                        <div className="rounded-2xl border border-white/5 bg-slate-900/30 overflow-hidden">
                            {/* Nome do arquivo - Header do Card */}
                            <div className="p-5 border-b border-white/5 bg-white/[0.02] relative overflow-hidden">
                                <div className="absolute right-0 top-0 w-32 h-32 bg-[hsl(var(--accent)/0.05)] rounded-full blur-[40px]" />
                                <p className="text-[9px] uppercase font-black tracking-widest text-[hsl(var(--accent))] mb-1 relative z-10">Arquivo Ativo</p>
                                <p className="text-xl font-black text-white leading-tight break-words relative z-10">{selectedVideo.name}</p>
                            </div>

                            {/* Informações Numéricas Inferiores */}
                            <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-white/5">
                                <div className="p-5 group hover:bg-white/[0.02] transition-colors">
                                    <p className="text-[9px] uppercase font-black tracking-widest text-slate-500 mb-1">Tamanho</p>
                                    <p className="font-bold text-slate-300 group-hover:text-white transition-colors">{formatBytes(selectedVideo.size)}</p>
                                </div>
                                <div className="p-5 group hover:bg-white/[0.02] transition-colors">
                                    <p className="text-[9px] uppercase font-black tracking-widest text-slate-500 mb-1">Data</p>
                                    <p className="font-bold text-slate-300 group-hover:text-white transition-colors">{formatDate(selectedVideo.createdAt)}</p>
                                </div>
                                <div className="p-5 group hover:bg-white/[0.02] transition-colors">
                                    <p className="text-[9px] uppercase font-black tracking-widest text-slate-500 mb-1">Codex</p>
                                    <p className="font-mono text-[11px] font-bold text-slate-400 bg-slate-800/50 px-2 py-0.5 inline-block rounded">{selectedVideo.type || "video/*"}</p>
                                </div>
                                <div className="p-5 group hover:bg-white/[0.02] transition-colors">
                                    <p className="text-[9px] uppercase font-black tracking-widest text-slate-500 mb-1">Storage</p>
                                    <p className="font-bold uppercase text-xs text-indigo-400 group-hover:text-indigo-300 transition-colors flex items-center gap-1.5">
                                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                                        {formatStorageKind(selectedVideo)}
                                    </p>
                                </div>
                            </div>

                            {/* Detalhes Técnicos Footer */}
                            <div className="p-5 border-t border-white/5 bg-slate-950/40 flex flex-col sm:flex-row gap-6">
                                <div className="flex-1 min-w-0">
                                    <p className="text-[9px] uppercase font-black tracking-widest text-slate-500 mb-1">Caminho do Diretório</p>
                                    <p className="font-semibold text-slate-300 text-sm truncate">{selectedVideo.relativePath}</p>
                                </div>
                                <div className="hidden sm:block w-px bg-white/5"></div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[9px] uppercase font-black tracking-widest text-slate-500 mb-1 flex items-center gap-1.5">Hash Id<Icon name="lock" className="text-[10px]" /></p>
                                    <p className="font-mono text-[10px] text-slate-500 truncate" title={selectedVideoRef ?? "-"}>{selectedVideoRef ?? "-"}</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center p-8 rounded-2xl border border-dashed border-white/10 bg-white/[0.01]">
                            <p className="text-xs font-bold tracking-widest uppercase text-slate-500">Nenhum arquivo ativo</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
