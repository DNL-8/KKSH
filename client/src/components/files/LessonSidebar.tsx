import { useMemo, useState } from "react";
import { Icon } from "../common/Icon";

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
  onCollapseAllFolders?: () => void;
  onExpandAllFolders?: () => void;
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
  onCollapseAllFolders,
  onExpandAllFolders,
  onClose,
}: LessonSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const wrapperClasses = mobile
    ? "h-full w-[340px] max-w-[92vw] overflow-y-auto border-l border-cyan-900/40 bg-[#041022] p-3 shadow-2xl"
    : "h-full overflow-hidden rounded-[22px] border border-cyan-900/40 bg-[#041022]/95 shadow-[0_0_35px_rgba(0,180,255,0.08)]";

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) {
      return folderSections;
    }

    const query = searchQuery.toLowerCase();
    return folderSections
      .map((section) => ({
        ...section,
        lessons: section.lessons.filter((lesson) => lesson.name.toLowerCase().includes(query)),
      }))
      .filter((section) => section.lessons.length > 0);
  }, [folderSections, searchQuery]);

  const totalLessons = useMemo(
    () => filteredSections.reduce((acc, section) => acc + section.lessons.length, 0),
    [filteredSections],
  );

  const totalCompleted = useMemo(
    () =>
      filteredSections.reduce(
        (acc, section) =>
          acc + section.lessons.filter((lesson) => completedVideoRefs.has(buildVideoRef(lesson))).length,
        0,
      ),
    [completedVideoRefs, filteredSections],
  );

  const collapsedCount = useMemo(
    () => folderSections.filter((section) => collapsedFolders[section.path] ?? false).length,
    [collapsedFolders, folderSections],
  );
  const hasFolders = folderSections.length > 0;
  const allCollapsed = hasFolders && collapsedCount === folderSections.length;
  const canToggleAll = Boolean(onCollapseAllFolders && onExpandAllFolders) && hasFolders;
  const toggleAllLabel = allCollapsed ? "Abrir todos" : "Esconder todos";
  const handleToggleAll = () => {
    if (!canToggleAll) {
      return;
    }
    if (allCollapsed) {
      onExpandAllFolders?.();
      return;
    }
    onCollapseAllFolders?.();
  };

  return (
    <div className={wrapperClasses} data-testid={mobile ? "course-sidebar-mobile" : "course-sidebar"}>
      <div className="border-b border-cyan-950/50 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-2xl font-black uppercase tracking-tight text-slate-100">
              {mobile ? "Conteudo" : "Arquivos avulsos"}
            </h3>
          </div>
          <span className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-xs font-mono font-bold text-cyan-300">
            {totalCompleted}/{Math.max(totalLessons, 1)}
          </span>
        </div>

        {canToggleAll && (
          <div className="mt-2">
            <button
              className="rounded-md border border-cyan-900/40 bg-[#071327] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-cyan-300 transition-colors hover:bg-[#0a1a33] disabled:opacity-40"
              data-testid="toggle-all-folders"
              disabled={Boolean(searchQuery)}
              onClick={handleToggleAll}
              type="button"
            >
              {toggleAllLabel}
            </button>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-[14px]" />
            <input
              className="w-full rounded-lg border border-cyan-900/40 bg-[#071327] py-2 pl-9 pr-8 text-xs font-medium text-slate-200 placeholder-slate-600 focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Buscar arquivo..."
              type="text"
              value={searchQuery}
            />
            {searchQuery && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-200"
                onClick={() => setSearchQuery("")}
                type="button"
              >
                <Icon name="cross" className="text-[12px]" />
              </button>
            )}
          </div>

          {mobile && onClose && (
            <button
              className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-[10px] font-black uppercase tracking-wider text-slate-300"
              onClick={onClose}
              type="button"
            >
              Fechar
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3 p-3">
        {filteredSections.map((section) => {
          const isSearching = Boolean(searchQuery);
          const collapsed = isSearching ? false : (collapsedFolders[section.path] ?? false);
          const visibleCount = visibleCountByFolder[section.path] ?? LESSONS_VISIBLE_DEFAULT;
          const visibleLessons = isSearching ? section.lessons : section.lessons.slice(0, visibleCount);
          const hiddenLessons = isSearching ? 0 : Math.max(0, section.lessons.length - visibleLessons.length);
          const completedInSection = section.lessons.filter((lesson) => completedVideoRefs.has(buildVideoRef(lesson))).length;

          return (
            <section
              key={section.path}
              className="overflow-hidden rounded-xl border border-cyan-900/40 bg-[#030d1d]"
              data-testid={`folder-section-${section.pathId}`}
            >
              <div className="flex items-center justify-between gap-2 border-b border-cyan-950/50 bg-[#071327] px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-bold uppercase tracking-wider text-slate-300" title={section.path}>
                    {section.path}
                  </p>
                  <p className="text-[10px] font-mono text-slate-500">
                    {completedInSection}/{section.lessons.length}
                  </p>
                </div>
                <button
                  aria-label={collapsed ? `Expandir pasta ${section.path}` : `Recolher pasta ${section.path}`}
                  className="rounded-md border border-cyan-900/40 bg-[#0a1a33] p-1.5 text-slate-400 transition-colors hover:text-cyan-300 disabled:opacity-40"
                  data-testid={`folder-toggle-${section.pathId}`}
                  disabled={isSearching}
                  onClick={() => onToggleFolder(section.path)}
                  type="button"
                >
                  {collapsed ? <Icon name="angle-right" className="text-[14px]" /> : <Icon name="angle-down" className="text-[14px]" />}
                </button>
              </div>

              {!collapsed && (
                <div className="divide-y divide-cyan-950/40">
                  {visibleLessons.map((lesson: StoredVideo, index: number) => {
                    const active = selectedLessonId === lesson.id;
                    const lessonCompleted = completedVideoRefs.has(buildVideoRef(lesson));
                    const itemNumber = String(index + 1).padStart(2, "0");
                    const storageLabel = formatStorageKind(lesson).toUpperCase();

                    return (
                      <button
                        key={lesson.id}
                        className={`group flex w-full items-start gap-3 px-3 py-3 text-left transition-all ${active
                            ? "bg-gradient-to-r from-cyan-500/10 to-transparent"
                            : "hover:bg-slate-900/60"
                          }`}
                        data-active={active ? "true" : "false"}
                        data-testid={`lesson-item-${section.pathId}-${index}`}
                        onClick={() => onSelectLesson(lesson.id)}
                        type="button"
                      >
                        <div
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-mono ${lessonCompleted
                              ? "border-emerald-500/70 bg-emerald-500/15 text-emerald-400"
                              : active
                                ? "border-cyan-400 bg-cyan-500/15 text-cyan-300"
                                : "border-slate-700 bg-slate-900 text-slate-500"
                            }`}
                        >
                          {lessonCompleted ? (
                            <Icon name="check-circle" className="text-[12px]" />
                          ) : active ? (
                            <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
                          ) : (
                            <span>{itemNumber}</span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p
                            className={`truncate text-sm font-medium leading-tight transition-colors ${active ? "text-cyan-300" : "text-slate-300 group-hover:text-cyan-300"
                              }`}
                          >
                            {itemNumber}. {lesson.name}
                          </p>
                          {lessonCompleted ? (
                            <div className="mt-1 flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-emerald-400">
                              <span className="rounded border border-emerald-500/50 bg-emerald-500/10 px-1.5 py-0.5">
                                Concluida (+XP)
                              </span>
                            </div>
                          ) : (
                            <div className="mt-1 flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                              <span className="rounded border border-slate-700/70 bg-slate-900/80 px-1.5 py-0.5">
                                {formatBytes(lesson.size)}
                              </span>
                              <span>{storageLabel} [BLOB]</span>
                            </div>
                          )}
                        </div>

                        {active && (
                          <div className="mt-1 flex h-5 items-end gap-0.5 self-center">
                            <span className="h-2 w-0.5 animate-pulse rounded bg-cyan-400" />
                            <span className="h-4 w-0.5 animate-pulse rounded bg-cyan-300 [animation-delay:120ms]" />
                            <span className="h-3 w-0.5 animate-pulse rounded bg-cyan-400 [animation-delay:240ms]" />
                          </div>
                        )}
                      </button>
                    );
                  })}

                  {hiddenLessons > 0 && (
                    <button
                      className="w-full border-t border-cyan-950/40 bg-[#071327] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-cyan-300 transition-colors hover:text-cyan-200"
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
            Nenhum arquivo encontrado para "{searchQuery}".
          </div>
        )}
      </div>
    </div>
  );
}
