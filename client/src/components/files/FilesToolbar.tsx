
import { Icon } from "../common/Icon";
import { HIGH_VOLUME_FOLDER_THRESHOLD } from "../../lib/localVideosStore";
import { OrderMode } from "./types";
import { ORDER_LABELS } from "./constants";

interface FilesToolbarProps {
    saving: boolean;
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

export function FilesToolbar({
    saving,
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
    return (
        <div className="space-y-3 border-t border-slate-800 pt-4" data-testid="files-toolbar">
            <div className="flex flex-wrap items-center gap-2">
                <button
                    className="flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-600 px-3 py-2 text-[10px] font-black uppercase text-white shadow-lg shadow-cyan-900/20 transition-all hover:bg-cyan-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                    data-testid="files-upload-button"
                    disabled={saving}
                    onClick={onOpenPicker}
                    type="button"
                >
                    {saving ? <Icon name="spinner" className="animate-spin text-[14px]" /> : <Icon name="upload" className="text-[14px]" />}
                    Upload
                </button>
                <button
                    className="flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-600 px-3 py-2 text-[10px] font-black uppercase text-white shadow-lg shadow-indigo-900/20 transition-all hover:bg-indigo-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                    data-testid="files-folder-button"
                    disabled={saving}
                    onClick={onOpenFolderPicker}
                    type="button"
                >
                    <Icon name="folder-open" className="text-[14px]" />
                    {`Carregar pasta (ate ${HIGH_VOLUME_FOLDER_THRESHOLD} recomendado)`}
                </button>
                {directoryHandleSupported && (
                    <button
                        className="flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-600 px-3 py-2 text-[10px] font-black uppercase text-white shadow-lg shadow-violet-900/20 transition-all hover:bg-violet-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
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

                <div className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-900 p-0.5">
                    <button
                        className="rounded-lg px-3 py-1.5 text-[10px] font-black uppercase text-slate-400 hover:bg-slate-800 hover:text-cyan-300 disabled:opacity-50"
                        disabled={loading || saving || visibleVideosCount === 0}
                        onClick={onExportMetadata}
                        title="Exportar lista de videos (backup leve)"
                        type="button"
                    >
                        {exporting ? <Icon name="spinner" className="animate-spin text-[12px]" /> : <Icon name="download" className="text-[12px]" />}
                        <span className="ml-1 hidden sm:inline">Backup</span>
                    </button>
                    <div className="h-4 w-px bg-slate-800" />
                    <button
                        className="rounded-lg px-3 py-1.5 text-[10px] font-black uppercase text-slate-400 hover:bg-slate-800 hover:text-cyan-300 disabled:opacity-50"
                        disabled={loading || saving}
                        onClick={onImportMetadataClick}
                        title="Restaurar lista de videos"
                        type="button"
                    >
                        <Icon name="upload" className="text-[12px]" />
                        <span className="ml-1 hidden sm:inline">Restaurar</span>
                    </button>
                </div>
                <div
                    className="hidden items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] font-black uppercase text-slate-300 transition-all hover:border-cyan-500/30 hover:text-cyan-300 md:flex"
                    data-testid="files-sort-select"
                >
                    <Icon name="sort-alt" className="text-[14px]" />
                    <select
                        className="max-w-[210px] appearance-none bg-transparent pr-1 text-[10px] font-black uppercase tracking-wide text-slate-300 outline-none disabled:cursor-not-allowed disabled:opacity-50"
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
                    className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] font-black uppercase text-slate-300 transition-all hover:border-red-500/30 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                    data-testid="clear-library"
                    disabled={visibleVideosCount === 0 || loading || saving}
                    onClick={() => void onClearLibrary()}
                    type="button"
                >
                    <Icon name="trash" className="text-[14px]" />
                    Limpar biblioteca
                </button>
                <button
                    aria-label="Abrir conteudo"
                    className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] font-black uppercase text-slate-300 transition-all hover:border-cyan-500/30 hover:text-cyan-300 lg:hidden"
                    data-testid="sidebar-mobile-toggle"
                    disabled={visibleVideosCount === 0}
                    onClick={onToggleMobileSidebar}
                    type="button"
                >
                    <Icon name="list" className="text-[14px]" />
                    Conteudo
                </button>
                <button
                    className="ml-auto hidden rounded-xl border border-slate-700 bg-slate-900 p-2 text-slate-300 transition-colors hover:text-cyan-300 md:inline-flex"
                    title="Configuracoes visuais"
                    data-testid="files-open-visual-settings"
                    onClick={onOpenVisualSettings}
                    type="button"
                >
                    <Icon name="settings" className="text-[14px]" />
                </button>
            </div>

            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="relative w-full md:max-w-xl">
                    <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-[14px]" />
                    <input
                        className="w-full rounded-xl border border-slate-700 bg-[#06080f] py-2.5 pl-9 pr-3 text-xs font-medium text-slate-200 placeholder-slate-500 outline-none transition-colors focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/30"
                        data-testid="files-search-input"
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder="Pesquisar por nome ou pasta..."
                        type="text"
                        value={searchTerm}
                    />
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#0b0d12] px-3 py-2 text-xs font-semibold text-slate-400">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1">
                            <Icon name="apps" className="text-[13px]" />
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
