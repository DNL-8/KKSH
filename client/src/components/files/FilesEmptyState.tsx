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
            <div className="flex min-h-[280px] items-center justify-center rounded-[30px] border border-white/5 bg-slate-900/40 backdrop-blur-md">
                <div className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.2em] text-slate-400">
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
        <div className="flex min-h-[460px] flex-col items-center justify-center rounded-[40px] border border-dashed border-cyan-800/40 bg-gradient-to-b from-[#020b17]/50 to-[#030914]/80 px-8 text-center transition-all hover:border-cyan-400/60 hover:shadow-[0_0_60px_rgba(34,211,238,0.05)_inset]">
            <div className="mb-8 rounded-full border border-cyan-400/20 bg-cyan-950/30 p-6 shadow-[0_0_60px_rgba(34,211,238,0.15)] relative group">
                <div className="absolute inset-0 rounded-full bg-cyan-400/20 blur-xl group-hover:bg-cyan-400/30 transition-colors animate-pulse" />
                <Icon name="cloud-upload" className="text-[hsl(var(--accent))] text-[48px] relative z-10 drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]" />
            </div>
            <h3 className="text-3xl font-black uppercase tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-white to-cyan-300">Terminal Inativo</h3>
            <p className="mt-3 max-w-lg text-[13px] text-cyan-200/60 uppercase tracking-widest font-semibold leading-relaxed">
                Arraste e solte vídeos na zona, ou utilize os comandos de importação abaixo para iniciar o Uplink.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 items-center">
                <button
                    className="flex items-center justify-center gap-3 w-full sm:w-auto rounded-2xl border border-cyan-400/50 bg-cyan-500/10 px-8 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.2)] backdrop-blur-md transition-all hover:bg-cyan-500/30 hover:text-white hover:border-cyan-400 active:scale-95"
                    onClick={onOpenPicker}
                    type="button"
                >
                    <Icon name="upload" className="text-[16px]" />
                    Selecionar vídeos
                </button>
                <button
                    className="flex items-center justify-center gap-3 w-full sm:w-auto rounded-2xl border border-indigo-400/50 bg-indigo-500/10 px-8 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-indigo-200 shadow-[0_0_20px_rgba(99,102,241,0.15)] backdrop-blur-md transition-all hover:bg-indigo-500/30 hover:text-white hover:border-indigo-400 active:scale-95"
                    onClick={onOpenFolderPicker}
                    type="button"
                >
                    <Icon name="folder-open" className="text-[16px]" />
                    {`Pasta (${highVolumeThreshold})`}
                </button>
            </div>
            {directoryHandleSupported && (
                <button
                    className="mt-4 flex items-center justify-center gap-3 w-full sm:w-auto rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-8 py-3.5 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.15)] backdrop-blur-md transition-all hover:bg-emerald-500/30 hover:text-white hover:border-emerald-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={saving}
                    onClick={onOpenDirectoryPicker}
                    type="button"
                >
                    <Icon name="server" className="text-[16px]" />
                    Conexão Contínua (Volumes Grandes)
                </button>
            )}
        </div>
    );
}
