import { useState, useRef, useEffect } from "react";
import { Icon } from "../common/Icon";
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
    completionRate: number;
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
    completionRate,
    onOpenPicker,
    onOpenFolderPicker,
    onOpenDirectoryPicker,
    onExportMetadata,
    onImportMetadataClick,
    onClearLibrary,
    onOpenVisualSettings,
    onToggleMobileSidebar,
}: FilesToolbarProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

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

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="flex flex-col gap-4 mb-4" data-testid="files-toolbar">

            {/* Top row: Search and Main Actions */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">

                {/* Search Bar - Wider and cleaner */}
                <div className="relative w-full sm:max-w-md group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Icon name="search" className="text-slate-500 group-focus-within:text-[hsl(var(--accent))] transition-colors text-[14px]" />
                    </div>
                    <input
                        className="w-full bg-slate-900/40 border border-white/5 text-slate-200 text-sm rounded-xl focus:ring-1 focus:ring-[hsl(var(--accent)/0.5)] focus:border-[hsl(var(--accent)/0.5)] block pl-10 p-2.5 transition-all outline-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] placeholder-slate-500"
                        data-testid="files-search-input"
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder="Pesquisar por nome ou pasta..."
                        type="search"
                        value={searchTerm}
                    />
                    {/* Badge floating inside search */}
                    <div className="absolute inset-y-0 right-2 flex items-center pt-px">
                        <span className="bg-slate-800/80 border border-white/5 text-slate-400 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md shadow-sm">
                            {completedLessonCount}/{visibleVideosCount} aulas ({completionRate}%)
                        </span>
                    </div>
                </div>

                {/* Primary Actions */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[hsl(var(--accent))] to-cyan-500 px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-[#020617] transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 shadow-[0_0_20px_rgba(var(--glow),0.25)]"
                        data-testid="files-upload-button"
                        disabled={saving}
                        onClick={onOpenPicker}
                        type="button"
                    >
                        {saving ? <Icon name="spinner" className="animate-spin text-[14px]" /> : <Icon name="upload" className="text-[14px]" />}
                        {saving ? progressText : "Upload"}
                    </button>

                    <button
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl border border-[hsl(var(--accent)/0.3)] bg-[hsl(var(--accent)/0.05)] px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-[hsl(var(--accent-light))] transition-all hover:bg-[hsl(var(--accent)/0.1)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                        data-testid="files-folder-button"
                        disabled={saving}
                        onClick={onOpenFolderPicker}
                        type="button"
                    >
                        <Icon name="folder-open" className="text-[14px]" />
                        <span className="hidden sm:inline">Carregar pasta</span>
                        <span className="sm:hidden">Pasta</span>
                    </button>

                    {/* Advanced Menu (Dropdown) */}
                    <div className="relative" ref={menuRef}>
                        <button
                            className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-all active:scale-95 ${isMenuOpen
                                ? "bg-slate-800 border-white/20 text-white shadow-lg"
                                : "bg-slate-900/40 border-white/5 text-slate-400 hover:bg-slate-800 hover:text-white"
                                }`}
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            aria-label="Opcoes avancadas"
                            type="button"
                        >
                            <Icon name="menu-dots-vertical" className="text-[16px]" />
                        </button>

                        {/* Dropdown Content */}
                        {isMenuOpen && (
                            <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-white/10 bg-[#060b14]/95 backdrop-blur-xl p-2 shadow-[0_20px_40px_rgba(0,0,0,0.8)] animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                                <div className="px-2 py-1.5 mb-1 text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-white/5">
                                    Biblioteca
                                </div>
                                <button
                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-300 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
                                    disabled={loading || saving || visibleVideosCount === 0}
                                    onClick={() => { onExportMetadata(); setIsMenuOpen(false); }}
                                    type="button"
                                >
                                    {exporting ? <Icon name="spinner" className="animate-spin text-[14px] text-[hsl(var(--accent))]" /> : <Icon name="download" className="text-[14px] text-[hsl(var(--accent))]" />}
                                    Fazer Backup (Exportar)
                                </button>
                                <button
                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-300 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
                                    disabled={loading || saving}
                                    onClick={() => { onImportMetadataClick(); setIsMenuOpen(false); }}
                                    type="button"
                                >
                                    <Icon name="upload" className="text-[14px] text-[hsl(var(--accent))]" />
                                    Restaurar Biblioteca
                                </button>

                                {directoryHandleSupported && (
                                    <>
                                        <div className="px-2 py-1.5 mt-2 mb-1 text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-white/5">
                                            Avancado
                                        </div>
                                        <button
                                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/10 disabled:opacity-50"
                                            disabled={saving}
                                            onClick={() => { onOpenDirectoryPicker(); setIsMenuOpen(false); }}
                                            type="button"
                                        >
                                            <Icon name="link" className="text-[14px]" />
                                            Conectar Pasta (Alto Volume)
                                        </button>
                                    </>
                                )}

                                <div className="my-1 border-t border-white/5" />
                                <button
                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                                    disabled={visibleVideosCount === 0 || loading || saving}
                                    onClick={() => { onClearLibrary(); setIsMenuOpen(false); }}
                                    type="button"
                                >
                                    <Icon name="trash" className="text-[14px]" />
                                    Limpar Tudo
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Row: Minimal view toggles */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                        <Icon name="sort-alt" className="text-[12px]" /> Ordenacao
                    </span>
                    <div className="relative">
                        <select
                            className="appearance-none bg-transparent text-xs font-bold text-slate-300 outline-none hover:text-white cursor-pointer pr-4 transition-colors disabled:opacity-50"
                            disabled={visibleVideosCount === 0 || loading}
                            onChange={(event) => onOrderModeChange(event.target.value as OrderMode)}
                            value={orderMode}
                        >
                            <option value="source" className="bg-slate-900">{ORDER_LABELS.source}</option>
                            <option value="newest" className="bg-slate-900">{ORDER_LABELS.newest}</option>
                            <option value="oldest" className="bg-slate-900">{ORDER_LABELS.oldest}</option>
                            <option value="name_asc" className="bg-slate-900">{ORDER_LABELS.name_asc}</option>
                            <option value="name_desc" className="bg-slate-900">{ORDER_LABELS.name_desc}</option>
                            <option value="size_desc" className="bg-slate-900">{ORDER_LABELS.size_desc}</option>
                            <option value="size_asc" className="bg-slate-900">{ORDER_LABELS.size_asc}</option>
                        </select>
                        <Icon name="angle-down" className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-[10px]" />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors lg:hidden"
                        onClick={onToggleMobileSidebar}
                        type="button"
                        title="Ver lista de videos"
                    >
                        <Icon name="list" className="text-[14px]" />
                    </button>
                    <button
                        className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/5 text-slate-400 hover:text-[hsl(var(--accent))] transition-colors"
                        onClick={onOpenVisualSettings}
                        type="button"
                        title="Configuracoes Visuais"
                    >
                        <Icon name="settings" className="text-[14px]" />
                    </button>
                </div>
            </div>
            {/* Very subtle divider to separate from content below */}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-white/5 to-transparent mt-2"></div>
        </div>
    );
}
