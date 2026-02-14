import { CheckCircle2, ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import type { StoredVideo } from "../../lib/localVideosStore";
import {
    buildVideoRef,
    formatBytes,
    formatStorageKind,
    type FolderSection,
} from "./utils";

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

export const LESSONS_VISIBLE_DEFAULT = 120;
export const LESSONS_VISIBLE_INCREMENT = 200;

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

interface LessonSidebarProps {
    folderSections: FolderSection[];
    selectedLessonId: string | null;
    completedVideoRefs: Set<string>;
    collapsedFolders: Record<string, boolean>;
    visibleCountByFolder: Record<string, number>;
    mobile?: boolean;
    onToggleFolder: (path: string) => void;
    onSelectLesson: (id: string) => void;
    onShowMore: (path: string) => void;
    onClose?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function LessonSidebar({
    folderSections,
    selectedLessonId,
    completedVideoRefs,
    collapsedFolders,
    visibleCountByFolder,
    mobile = false,
    onToggleFolder,
    onSelectLesson,
    onShowMore,
    onClose,
}: LessonSidebarProps) {
    const [searchQuery, setSearchQuery] = useState("");

    const wrapperClasses = mobile
        ? "h-full w-[320px] max-w-[88vw] bg-[#0b0d12] border-l border-slate-800 shadow-2xl p-4 overflow-y-auto"
        : "h-full rounded-[28px] border border-slate-800 bg-[#0b0d12]/90 p-4";

    const filteredSections = useMemo(() => {
        if (!searchQuery.trim()) {
            return folderSections;
        }
        const query = searchQuery.toLowerCase();
        return folderSections
            .map((section) => ({
                ...section,
                lessons: section.lessons.filter((lesson) =>
                    lesson.name.toLowerCase().includes(query)
                ),
            }))
            .filter((section) => section.lessons.length > 0);
    }, [folderSections, searchQuery]);

    return (
        <div className={wrapperClasses} data-testid={mobile ? "course-sidebar-mobile" : "course-sidebar"}>
            <div className="mb-4 flex flex-col gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Conteudo</h3>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            {filteredSections.length} pastas {searchQuery && "(filtrado)"}
                        </p>
                    </div>
                    {mobile && onClose && (
                        <button
                            className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-300"
                            onClick={onClose}
                            type="button"
                        >
                            Fechar
                        </button>
                    )}
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                    <input
                        className="w-full rounded-xl border border-slate-800 bg-slate-950/50 py-2 pl-9 pr-8 text-xs font-medium text-slate-200 placeholder-slate-600 focus:border-[hsl(var(--accent))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--accent))]"
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar aula..."
                        type="text"
                        value={searchQuery}
                    />
                    {searchQuery && (
                        <button
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                            onClick={() => setSearchQuery("")}
                            type="button"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-3">
                {filteredSections.map((section) => {
                    // Force expand if searching
                    const isSearching = !!searchQuery;
                    const collapsed = isSearching ? false : (collapsedFolders[section.path] ?? false);

                    const visibleCount = visibleCountByFolder[section.path] ?? LESSONS_VISIBLE_DEFAULT;
                    // Show all if searching, otherwise use pagination
                    const visibleLessons = isSearching ? section.lessons : section.lessons.slice(0, visibleCount);
                    const hiddenLessons = isSearching ? 0 : Math.max(0, section.lessons.length - visibleLessons.length);

                    return (
                        <section
                            key={section.path}
                            className="overflow-hidden rounded-2xl border border-slate-800 bg-[#06070a]"
                            data-testid={`folder-section-${section.pathId}`}
                        >
                            <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                                <div className="min-w-0">
                                    <p className="truncate text-[11px] font-black uppercase tracking-wider text-slate-200" title={section.path}>
                                        {section.path}
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-500">{section.lessons.length} aula(s)</p>
                                </div>
                                <button
                                    aria-label={collapsed ? `Expandir pasta ${section.path}` : `Recolher pasta ${section.path}`}
                                    className="rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-400 transition-colors hover:text-cyan-300"
                                    data-testid={`folder-toggle-${section.pathId}`}
                                    disabled={isSearching}
                                    onClick={() => onToggleFolder(section.path)}
                                    type="button"
                                >
                                    {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                </button>
                            </div>

                            {!collapsed && (
                                <div className="space-y-1 border-t border-slate-800 p-2">
                                    {visibleLessons.map((lesson: StoredVideo, index: number) => {
                                        const active = selectedLessonId === lesson.id;
                                        const lessonCompleted = completedVideoRefs.has(buildVideoRef(lesson));

                                        return (
                                            <button
                                                key={lesson.id}
                                                className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-all ${active
                                                    ? "border border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                                                    : "border border-transparent bg-slate-950/50 text-slate-300 hover:border-slate-700 hover:bg-slate-900"
                                                    }`}
                                                data-active={active ? "true" : "false"}
                                                data-testid={`lesson-item-${section.pathId}-${index}`}
                                                onClick={() => onSelectLesson(lesson.id)}
                                                type="button"
                                            >
                                                <span className="min-w-0">
                                                    <span className="block truncate text-[11px] font-semibold">{lesson.name}</span>
                                                    <span
                                                        className={`text-[9px] font-bold uppercase tracking-wider ${lessonCompleted ? "text-emerald-400" : "text-slate-500"
                                                            }`}
                                                    >
                                                        {lessonCompleted ? "Concluida (+XP)" : formatBytes(lesson.size)} | {formatStorageKind(lesson)}
                                                    </span>
                                                </span>

                                                {lessonCompleted ? (
                                                    <CheckCircle2 className="shrink-0 text-emerald-400" size={15} />
                                                ) : active ? (
                                                    <span className="h-2 w-2 shrink-0 rounded-full bg-cyan-400" />
                                                ) : null}
                                            </button>
                                        );
                                    })}
                                    {hiddenLessons > 0 && (
                                        <button
                                            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-300 transition-all hover:border-cyan-500/30 hover:text-cyan-300"
                                            data-testid={`folder-show-more-${section.pathId}`}
                                            onClick={() => onShowMore(section.path)}
                                            type="button"
                                        >
                                            Mostrar mais ({hiddenLessons} restante)
                                        </button>
                                    )}
                                </div>
                            )}
                        </section>
                    );
                })}
                {filteredSections.length === 0 && searchQuery && (
                    <div className="py-8 text-center text-xs font-medium text-slate-500">
                        Nenhuma aula encontrada para "{searchQuery}".
                    </div>
                )}
            </div>
        </div>
    );
}
