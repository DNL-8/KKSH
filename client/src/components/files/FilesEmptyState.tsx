import { Icon } from "../common/Icon";

interface FilesEmptyStateProps {
    loading: boolean;
    visibleCount: number;
    saving: boolean;
    directoryHandleSupported: boolean;
    highVolumeThreshold: number;
    onOpenPicker: () => void;
    onOpenFolderPicker: () => void;
    onOpenDirectoryPicker: () => void;
}

export function FilesEmptyState({
    loading,
    visibleCount,
    saving,
    directoryHandleSupported,
    highVolumeThreshold,
    onOpenPicker,
    onOpenFolderPicker,
    onOpenDirectoryPicker,
}: FilesEmptyStateProps) {
    if (loading) {
        return (
            <div className="flex min-h-[280px] items-center justify-center rounded-[30px] border border-cyan-500/25 liquid-glass backdrop-blur-md">
                <div className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.2em] text-slate-300">
                    <Icon name="spinner" className="animate-spin text-[hsl(var(--accent))] text-[20px]" />
                    Carregando biblioteca local...
                </div>
            </div>
        );
    }

    if (visibleCount > 0) {
        return null;
    }

    return (
        <div className="flex min-h-[460px] flex-col items-center justify-center rounded-[40px] border border-dashed border-cyan-800/40 files-panel-elevated px-8 text-center transition-all hover:border-cyan-400/50 hover:shadow-[0_0_80px_rgba(34,211,238,0.04)_inset] files-scanlines relative overflow-hidden">
            {/* Ambient glow blobs */}
            <div className="pointer-events-none absolute -top-20 -left-20 h-60 w-60 rounded-full bg-cyan-500/5 blur-[100px]" />
            <div className="pointer-events-none absolute -bottom-20 -right-20 h-60 w-60 rounded-full bg-indigo-500/5 blur-[100px]" />

            <div className="relative z-10 mb-8 rounded-full border border-cyan-400/20 bg-cyan-950/30 p-7 shadow-[0_0_60px_rgba(34,211,238,0.15)] group">
                <div className="absolute inset-0 rounded-full bg-cyan-400/20 blur-xl group-hover:bg-cyan-400/30 transition-colors animate-pulse" />
                <Icon name="cloud-upload" className="text-[hsl(var(--accent))] text-[52px] relative z-10 drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]" />
            </div>
            <p className="relative z-10 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300/70">Biblioteca vazia</p>
            <h3 className="relative z-10 text-3xl font-black uppercase tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-white to-cyan-300">Terminal Inativo</h3>
            <p className="relative z-10 mt-3 max-w-lg text-[13px] text-cyan-200/60 uppercase tracking-widest font-semibold leading-relaxed">
                Arraste e solte videos na zona, ou use os comandos de importacao abaixo para iniciar o uplink.
            </p>
            <div className="relative z-10 mt-10 flex flex-col sm:flex-row gap-4 items-center">
                <button
                    className="flex items-center justify-center gap-3 w-full sm:w-auto rounded-2xl border border-cyan-400/50 bg-gradient-to-r from-cyan-600 to-cyan-500 px-8 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-slate-900 shadow-[0_4px_24px_rgba(34,211,238,0.3)] backdrop-blur-md transition-all hover:brightness-110 hover:shadow-[0_6px_30px_rgba(34,211,238,0.4)] active:scale-95"
                    onClick={onOpenPicker}
                    type="button"
                >
                    <Icon name="upload" className="text-[16px]" />
                    Selecionar videos
                </button>
                <button
                    className="flex items-center justify-center gap-3 w-full sm:w-auto rounded-2xl border border-indigo-400/40 bg-indigo-500/10 px-8 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-indigo-200 shadow-[0_4px_20px_rgba(99,102,241,0.12)] backdrop-blur-md transition-all hover:bg-indigo-500/25 hover:text-slate-50 hover:border-indigo-400/60 active:scale-95"
                    onClick={onOpenFolderPicker}
                    type="button"
                >
                    <Icon name="folder-open" className="text-[16px]" />
                    {`Pasta (${highVolumeThreshold})`}
                </button>
            </div>
            {directoryHandleSupported && (
                <button
                    className="relative z-10 mt-4 flex items-center justify-center gap-3 w-full sm:w-auto rounded-2xl border border-emerald-400/35 bg-emerald-500/8 px-8 py-3.5 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-emerald-200 shadow-[0_4px_20px_rgba(16,185,129,0.1)] backdrop-blur-md transition-all hover:bg-emerald-500/20 hover:text-slate-50 hover:border-emerald-400/50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={saving}
                    onClick={onOpenDirectoryPicker}
                    type="button"
                >
                    <Icon name="server" className="text-[16px]" />
                    Conexao Continua (Volumes Grandes)
                </button>
            )}
        </div>
    );
}

