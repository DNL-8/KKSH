import { Icon } from "../common/Icon";
import { HIGH_VOLUME_FOLDER_THRESHOLD } from "../../lib/localVideosStore";
import type { OrderMode } from "./types";
import { ORDER_LABELS } from "./constants";

interface FilesToolbarProps {
    saving: boolean;
    importProgress?: { processed: number; total: number; startTime?: number; speed?: number; eta?: number } | null;
    loading: boolean;
    exporting: boolean;
    visibleVideosCount: number;
    directoryHandleSupported: boolean;
    orderMode: OrderMode;
    onOrderModeChange: (mode: OrderMode) => void;
    searchTerm: string;
    onSearchChange: (term: string) => void;
    completedLessonCount: number;
    filteredLessonCount: number;
    completionRate: number;
    loadingCompletions: boolean;
    onOpenPicker: () => void;
    onOpenFolderPicker: () => void;
    onOpenDirectoryPicker: () => void;
    onExportMetadata: () => void;
    onImportMetadataClick: () => void;
    onClearLibrary: () => void;
    onOpenVisualSettings: () => void;
    onToggleMobileSidebar: () => void;
}

function formatDuration(seconds: number): string {
    if (!seconds || !isFinite(seconds) || seconds < 0) return "";
    if (seconds < 60) return `${Math.ceil(seconds)}s`;
    return `${Math.ceil(seconds / 60)}m`;
}

export function FilesToolbar({
    saving,
    importProgress,
    loading,
    exporting,
    visibleVideosCount,
    directoryHandleSupported,
    orderMode,
    onOrderModeChange,
    searchTerm,
    onSearchChange,
    completedLessonCount,
    filteredLessonCount,
    completionRate,
    loadingCompletions,
    onOpenPicker,
    onOpenFolderPicker,
    onOpenDirectoryPicker,
    onExportMetadata,
    onImportMetadataClick,
    onClearLibrary,
    onOpenVisualSettings,
    onToggleMobileSidebar,
}: FilesToolbarProps) {
    let progressText = " Carregando...";
    if (importProgress) {
        const { processed, total, speed, eta } = importProgress;
        progressText = ` ${processed}/${total}`;
        if (speed && speed > 0) {
            progressText += ` (${Math.round(speed)}/s`;
            if (eta && eta > 0) {
                progressText += `, ~${formatDuration(eta)}`;
            }
            progressText += ")";
        }
    }

    return (
        <div className="space-y-4 border-t border-cyan-950/70 pt-4" data-testid="files-toolbar">
            <div className="grid gap-3 xl:grid-cols-[1.4fr_1fr_0.9fr]">
                <div className="files-panel rounded-2xl p-3">
                    <p className="files-display mb-2 text-[10px] uppercase text-cyan-200/80">Importacao</p>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            className="flex items-center gap-2 rounded-xl border border-cyan-400/50 bg-cyan-600 px-3 py-2 text-[10px] font-black uppercase text-white transition-all hover:bg-cyan-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                            data-testid="files-upload-button"
                            disabled={saving}
                            onClick={onOpenPicker}
                            type="button"
                        >
                            {saving ? <Icon name="spinner" className="animate-spin text-[14px]" /> : <Icon name="upload" className="text-[14px]" />}
                            {saving ? progressText : "Upload"}
                        </button>
                        <button
                            className="flex items-center gap-2 rounded-xl border border-cyan-400/35 bg-[#0b1730] px-3 py-2 text-[10px] font-black uppercase text-cyan-100 transition-all hover:border-cyan-300/60 hover:bg-[#112448] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                            data-testid="files-folder-button"
                            disabled={saving}
                            onClick={onOpenFolderPicker}
                            type="button"
                        >
                            <Icon name="folder-open" className="text-[14px]" />
                            {saving ? progressText : `Carregar pasta (ate ${HIGH_VOLUME_FOLDER_THRESHOLD} recomendado)`}
                        </button>
                        {directoryHandleSupported && (
                            <button
                                className="flex items-center gap-2 rounded-xl border border-emerald-400/35 bg-emerald-700/35 px-3 py-2 text-[10px] font-black uppercase text-emerald-100 transition-all hover:bg-emerald-600/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                                data-testid="connect-directory-handle"
                                disabled={saving}
                                onClick={() => void onOpenDirectoryPicker()}
                                title="Conecta uma pasta sem copiar todos os blobs para o IndexedDB."
                                type="button"
                            >
                                <Icon name="folder-open" className="text-[14px]" />
                                Conectar pasta (alto volume)
                            </button>
                        )}
                    </div>
                </div>

                <div className="files-panel rounded-2xl p-3">
                    <p className="files-display mb-2 text-[10px] uppercase text-cyan-200/80">Biblioteca</p>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            className="flex items-center gap-2 rounded-xl border border-slate-600 bg-[#09101f] px-3 py-2 text-[10px] font-black uppercase text-slate-200 transition-all hover:border-cyan-400/50 hover:text-cyan-200 disabled:opacity-50"
                            disabled={loading || saving || visibleVideosCount === 0}
                            onClick={onExportMetadata}
                            title="Exportar lista de videos (backup leve)"
                            type="button"
                        >
                            {exporting ? <Icon name="spinner" className="animate-spin text-[12px]" /> : <Icon name="download" className="text-[12px]" />}
                            Backup
                        </button>
                        <button
                            className="flex items-center gap-2 rounded-xl border border-slate-600 bg-[#09101f] px-3 py-2 text-[10px] font-black uppercase text-slate-200 transition-all hover:border-cyan-400/50 hover:text-cyan-200 disabled:opacity-50"
                            disabled={loading || saving}
                            onClick={onImportMetadataClick}
                            title="Restaurar lista de videos"
                            type="button"
                        >
                            <Icon name="upload" className="text-[12px]" />
                            Restaurar
                        </button>
                        <button
                            className="flex items-center gap-2 rounded-xl border border-red-500/35 bg-red-700/30 px-3 py-2 text-[10px] font-black uppercase text-red-100 transition-all hover:bg-red-700/45 disabled:cursor-not-allowed disabled:opacity-50"
                            data-testid="clear-library"
                            disabled={visibleVideosCount === 0 || loading || saving}
                            onClick={() => void onClearLibrary()}
                            type="button"
                        >
                            <Icon name="trash" className="text-[14px]" />
                            Limpar
                        </button>
                    </div>
                </div>

                <div className="files-panel rounded-2xl p-3">
                    <p className="files-display mb-2 text-[10px] uppercase text-cyan-200/80">Visualizacao</p>
                    <div className="flex items-center gap-2">
                        <div
                            className="hidden min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-600 bg-[#09101f] px-3 py-2 text-[10px] font-black uppercase text-slate-200 transition-all hover:border-cyan-400/50 hover:text-cyan-200 md:flex"
                            data-testid="files-sort-select"
                        >
                            <Icon name="sort-alt" className="text-[14px]" />
                            <select
                                className="min-w-0 flex-1 appearance-none bg-transparent pr-1 text-[10px] font-black uppercase tracking-wide text-slate-200 outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                data-testid="toggle-order"
                                disabled={visibleVideosCount === 0 || loading}
                                onChange={(event) => onOrderModeChange(event.target.value as OrderMode)}
                                value={orderMode}
                            >
                                <option value="source">{ORDER_LABELS.source}</option>
                                <option value="newest">{ORDER_LABELS.newest}</option>
                                <option value="oldest">{ORDER_LABELS.oldest}</option>
                                <option value="name_asc">{ORDER_LABELS.name_asc}</option>
                                <option value="name_desc">{ORDER_LABELS.name_desc}</option>
                                <option value="size_desc">{ORDER_LABELS.size_desc}</option>
                                <option value="size_asc">{ORDER_LABELS.size_asc}</option>
                            </select>
                        </div>
                        <button
                            aria-label="Abrir conteudo"
                            className="flex items-center gap-2 rounded-xl border border-slate-600 bg-[#09101f] px-3 py-2 text-[10px] font-black uppercase text-slate-200 transition-all hover:border-cyan-400/50 hover:text-cyan-200 lg:hidden"
                            data-testid="sidebar-mobile-toggle"
                            disabled={visibleVideosCount === 0}
                            onClick={onToggleMobileSidebar}
                            type="button"
                        >
                            <Icon name="list" className="text-[14px]" />
                            Conteudo
                        </button>
                        <button
                            className="ml-auto hidden rounded-xl border border-slate-600 bg-[#09101f] p-2 text-slate-300 transition-all hover:border-cyan-400/50 hover:text-cyan-200 md:inline-flex"
                            title="Configuracoes visuais"
                            data-testid="files-open-visual-settings"
                            onClick={onOpenVisualSettings}
                            type="button"
                        >
                            <Icon name="settings" className="text-[14px]" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="files-panel flex flex-col gap-2 rounded-2xl p-3 md:flex-row md:items-center md:justify-between">
                <div className="relative w-full md:max-w-xl">
                    <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-[14px]" />
                    <input
                        className="w-full rounded-xl border border-slate-600 bg-[#060d1a] py-2.5 pl-9 pr-3 text-xs font-medium text-slate-200 placeholder-slate-500 outline-none transition-colors focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-500/30"
                        data-testid="files-search-input"
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder="Pesquisar por nome ou pasta..."
                        type="text"
                        value={searchTerm}
                    />
                </div>
                <div className="rounded-xl border border-cyan-950/70 bg-[#050d1d] px-3 py-2 text-xs font-semibold text-slate-300">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1">
                            <Icon name="apps" className="text-[13px] text-cyan-300" />
                            {completedLessonCount}/{visibleVideosCount} aula(s) concluidas ({filteredLessonCount} visiveis, {completionRate}%)
                        </span>
                        {loadingCompletions && (
                            <span className="flex items-center gap-1 text-cyan-300">
                                <Icon name="spinner" className="animate-spin text-[12px]" />
                                sincronizando
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
