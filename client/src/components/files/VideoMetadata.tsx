import { StoredVideo } from "../../lib/localVideosStore";
import { formatBytes, formatDate, formatStorageKind, TabMode } from "./utils";

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
        <div className="rounded-[24px] border border-slate-800 bg-[#0b0d12] p-4">
            <div className="mb-4 flex items-center gap-2 border-b border-slate-800 pb-3">
                <button
                    className={`rounded-lg px-3 py-2 text-[11px] font-black uppercase tracking-wider transition-all ${activeTab === "overview"
                        ? "bg-[hsl(var(--accent)/0.2)] text-[hsl(var(--accent-light))]"
                        : "bg-slate-900 text-slate-400 hover:text-slate-200"
                        }`}
                    data-testid="tab-overview"
                    onClick={() => onTabChange("overview")}
                    type="button"
                >
                    Visao geral
                </button>
                <button
                    className={`rounded-lg px-3 py-2 text-[11px] font-black uppercase tracking-wider transition-all ${activeTab === "metadata"
                        ? "bg-[hsl(var(--accent)/0.2)] text-[hsl(var(--accent-light))]"
                        : "bg-slate-900 text-slate-400 hover:text-slate-200"
                        }`}
                    data-testid="tab-metadata"
                    onClick={() => onTabChange("metadata")}
                    type="button"
                >
                    Metadados
                </button>
            </div>

            {activeTab === "overview" ? (
                <div className="space-y-4 text-sm text-slate-300">
                    <p className="text-base font-semibold text-white">
                        {selectedVideo
                            ? `Aula atual: ${selectedVideo.name}`
                            : "Selecione uma aula na trilha lateral para iniciar."}
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Total de videos</p>
                            <p className="mt-1 text-lg font-black text-[hsl(var(--accent-light))]">{videoCount}</p>
                        </div>
                        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Total de pastas</p>
                            <p className="mt-1 text-lg font-black text-[hsl(var(--accent-light))]">{folderCount}</p>
                        </div>
                        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Pasta atual</p>
                            <p className="mt-1 truncate text-lg font-black text-[hsl(var(--accent-light))]">{selectedVideo?.relativePath ?? "-"}</p>
                        </div>
                        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Status RPG</p>
                            <p className="mt-1 text-lg font-black text-[hsl(var(--accent-light))]">
                                {completed ? "Concluida" : "Pendente"}
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-3 text-sm text-slate-300">
                    {selectedVideo ? (
                        <>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Nome do arquivo</p>
                                    <p className="mt-1 font-semibold text-white">{selectedVideo.name}</p>
                                </div>
                                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Pasta</p>
                                    <p className="mt-1 font-semibold text-white">{selectedVideo.relativePath}</p>
                                </div>
                                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Tipo</p>
                                    <p className="mt-1 font-semibold text-white">{selectedVideo.type || "video/*"}</p>
                                </div>
                                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Tamanho</p>
                                    <p className="mt-1 font-semibold text-white">{formatBytes(selectedVideo.size)}</p>
                                </div>
                                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Adicionado em</p>
                                    <p className="mt-1 font-semibold text-white">{formatDate(selectedVideo.createdAt)}</p>
                                </div>
                                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Origem</p>
                                    <p className="mt-1 font-semibold uppercase text-white">
                                        {formatStorageKind(selectedVideo)} | {selectedVideo.sourceKind}
                                    </p>
                                </div>
                                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 sm:col-span-2">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Video ref (dedupe)</p>
                                    <p className="mt-1 break-all font-mono text-xs text-white">{selectedVideoRef ?? "-"}</p>
                                </div>
                            </div>
                        </>
                    ) : (
                        <p className="text-sm text-slate-500">Nenhuma aula selecionada para exibir metadados.</p>
                    )}
                </div>
            )}
        </div>
    );
}
