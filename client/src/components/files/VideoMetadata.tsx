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
        <div className="files-panel rounded-[24px] p-4 md:p-5">
            <div className="mb-4 flex items-center gap-2 border-b border-cyan-950/70 pb-3">
                <button
                    className={`rounded-lg px-3 py-2 text-[11px] font-black uppercase tracking-wider transition-all ${activeTab === "overview"
                        ? "border border-cyan-400/40 bg-cyan-500/20 text-cyan-100"
                        : "border border-slate-700 bg-[#09101f] text-slate-400 hover:text-slate-200"
                        }`}
                    data-testid="tab-overview"
                    onClick={() => onTabChange("overview")}
                    type="button"
                >
                    Visao geral
                </button>
                <button
                    className={`rounded-lg px-3 py-2 text-[11px] font-black uppercase tracking-wider transition-all ${activeTab === "metadata"
                        ? "border border-cyan-400/40 bg-cyan-500/20 text-cyan-100"
                        : "border border-slate-700 bg-[#09101f] text-slate-400 hover:text-slate-200"
                        }`}
                    data-testid="tab-metadata"
                    onClick={() => onTabChange("metadata")}
                    type="button"
                >
                    Metadados
                </button>
            </div>

            {activeTab === "overview" ? (
                <div className="space-y-4 text-sm text-slate-300 animate-in fade-in duration-500">
                    <p className="text-[13px] font-black uppercase tracking-widest text-cyan-200/80 mb-2 mt-1">
                        {selectedVideo
                            ? <span className="text-white"><span className="text-cyan-500 mr-2">▶</span>{selectedVideo.name}</span>
                            : "Selecione uma aula na trilha lateral para iniciar."}
                    </p>
                    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                        <div className="files-panel border border-cyan-500/10 bg-gradient-to-br from-[#020b17] to-[#040f25] p-5 rounded-[20px] transition-all hover:border-cyan-500/30 hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative overflow-hidden group">
                            <div className="absolute -right-4 -top-4 text-cyan-500/5 transition-transform group-hover:scale-110"><svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h16v12H4z" /></svg></div>
                            <p className="files-display text-[9px] uppercase tracking-widest text-slate-500 relative z-10">Total de videos</p>
                            <p className="mt-2 text-2xl font-black text-cyan-200 relative z-10">{videoCount}</p>
                        </div>
                        <div className="files-panel border border-cyan-500/10 bg-gradient-to-br from-[#020b17] to-[#040f25] p-5 rounded-[20px] transition-all hover:border-cyan-500/30 hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative overflow-hidden group">
                            <div className="absolute -right-4 -top-4 text-cyan-500/5 transition-transform group-hover:scale-110"><svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" /></svg></div>
                            <p className="files-display text-[9px] uppercase tracking-widest text-slate-500 relative z-10">Total de pastas</p>
                            <p className="mt-2 text-2xl font-black text-white relative z-10">{folderCount}</p>
                        </div>
                        <div className="files-panel border border-cyan-500/10 bg-gradient-to-br from-[#020b17] to-[#040f25] p-5 rounded-[20px] transition-all hover:border-cyan-500/30 hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative overflow-hidden group col-span-2 xl:col-span-1">
                            <div className="absolute -right-4 -top-4 text-cyan-500/5 transition-transform group-hover:scale-110"><svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2zm0-4H7V7h10v2z" /></svg></div>
                            <p className="files-display text-[9px] uppercase tracking-widest text-slate-500 relative z-10">Pasta atual</p>
                            <p className="mt-2 truncate text-lg font-black text-cyan-200 relative z-10" title={selectedVideo?.relativePath}>{selectedVideo?.relativePath ?? "-"}</p>
                        </div>
                        <div className={`files-panel border ${completed ? 'border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 to-[#020b17]' : 'border-cyan-500/10 bg-gradient-to-br from-[#020b17] to-[#040f25]'} p-5 rounded-[20px] transition-all hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative overflow-hidden group col-span-2 xl:col-span-1`}>
                            <div className={`absolute -right-4 -top-4 ${completed ? 'text-emerald-500/5' : 'text-cyan-500/5'} transition-transform group-hover:scale-110`}><svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg></div>
                            <p className="files-display text-[9px] uppercase tracking-widest text-slate-500 relative z-10">Status RPG</p>
                            <div className="mt-2 flex items-center gap-2 relative z-10">
                                {completed && <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />}
                                <p className={`text-lg font-black ${completed ? 'text-emerald-300' : 'text-cyan-200/50'}`}>
                                    {completed ? "Concluida" : "Pendente"}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-3 text-sm text-slate-300 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {selectedVideo ? (
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:grid-rows-2">
                            {/* Nome do arquivo - Bento Card Principal */}
                            <div className="files-panel border border-cyan-500/20 bg-gradient-to-br from-[#030d1f] to-[#020612] p-4 rounded-[20px] col-span-2 md:col-span-2 md:row-span-2 shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex flex-col justify-end relative overflow-hidden group">
                                <div className="absolute right-0 top-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-[40px] transition-transform group-hover:scale-150" />
                                <p className="files-display text-[9px] uppercase tracking-widest text-cyan-500 mb-1 relative z-10">Nome do Arquivo</p>
                                <p className="text-xl font-black text-white leading-tight break-words relative z-10">{selectedVideo.name}</p>
                            </div>

                            {/* Tamanho */}
                            <div className="files-panel border border-cyan-500/10 bg-[#020b17] p-4 rounded-[20px] shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] group hover:border-cyan-500/30 transition-colors">
                                <p className="files-display text-[9px] uppercase tracking-widest text-slate-500 mb-1">Tamanho</p>
                                <p className="font-bold text-cyan-100 group-hover:text-white transition-colors">{formatBytes(selectedVideo.size)}</p>
                            </div>

                            {/* Adicionado em */}
                            <div className="files-panel border border-cyan-500/10 bg-[#020b17] p-4 rounded-[20px] shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] group hover:border-cyan-500/30 transition-colors">
                                <p className="files-display text-[9px] uppercase tracking-widest text-slate-500 mb-1">Adicionado em</p>
                                <p className="font-bold text-cyan-100 group-hover:text-white transition-colors">{formatDate(selectedVideo.createdAt)}</p>
                            </div>

                            {/* Tipo */}
                            <div className="files-panel border border-cyan-500/10 bg-[#020b17] p-4 rounded-[20px] shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] group hover:border-cyan-500/30 transition-colors">
                                <p className="files-display text-[9px] uppercase tracking-widest text-slate-500 mb-1">Codex</p>
                                <p className="font-bold font-mono text-[11px] text-cyan-300/80 group-hover:text-cyan-200 transition-colors bg-cyan-950/30 px-2 py-1 inline-block rounded-md">{selectedVideo.type || "video/*"}</p>
                            </div>

                            {/* Origem */}
                            <div className="files-panel border border-cyan-500/10 bg-[#020b17] p-4 rounded-[20px] shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] group hover:border-cyan-500/30 transition-colors">
                                <p className="files-display text-[9px] uppercase tracking-widest text-slate-500 mb-1">Storage</p>
                                <p className="font-bold uppercase text-xs text-indigo-300 group-hover:text-indigo-200 transition-colors flex items-center gap-1.5">
                                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                                    {formatStorageKind(selectedVideo)}
                                </p>
                            </div>

                            {/* Pasta e Dedupe - Linha final com spans customizados para ocupar o grid corretamente se necessário, ou fluir fluidamente */}
                            <div className="files-panel border border-cyan-500/10 bg-[#020b17]/50 p-4 rounded-[20px] col-span-2 md:col-span-4 mt-1 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                                <div className="flex-1 min-w-0">
                                    <p className="files-display text-[9px] uppercase tracking-widest text-slate-500 mb-1">Pasta Raiz</p>
                                    <p className="font-semibold text-white text-sm truncate">{selectedVideo.relativePath}</p>
                                </div>
                                <div className="h-full w-px bg-cyan-900/40 hidden sm:block"></div>
                                <div className="flex-1 min-w-0">
                                    <p className="files-display text-[9px] uppercase tracking-widest text-slate-500 mb-1 flex items-center gap-1.5">Hash / Dedupe REF <Icon name="lock" className="text-[10px]" /></p>
                                    <p className="font-mono text-[10px] text-cyan-500 truncate" title={selectedVideoRef ?? "-"}>{selectedVideoRef ?? "-"}</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center p-8 rounded-[24px] border border-dashed border-cyan-500/20 bg-cyan-950/10">
                            <p className="text-sm font-semibold tracking-wider uppercase text-cyan-600">Nenhuma aula selecionada para exibir metadados.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
