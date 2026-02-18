import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { Icon } from "../common/Icon";

import type { StoredVideo } from "../../lib/localVideosStore";
import type { FolderSection } from "./types";
import {
  buildVideoRef,
  formatBytes,
  formatStorageKind,
} from "./utils";

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

// Removed legacy constants as virtualization handles large lists efficiently

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

interface LessonSidebarProps {
  folderSections: FolderSection[];
  selectedLessonId: string | null;
  completedVideoRefs: Set<string>;
  resolvedVideoRefsById?: Record<string, string>;
  collapsedFolders: Record<string, boolean>;
  mobile?: boolean;
  onToggleFolder: (path: string) => void;
  onSelectLesson: (id: string) => void;
  onCollapseAllFolders?: () => void;
  onExpandAllFolders?: () => void;
  onClose?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type FlatItem =
  | { type: "header"; section: FolderSection; collapsed: boolean; pathId: string; completedCount: number }
  | { type: "lesson"; lesson: StoredVideo; sectionPathId: string; index: number };

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function LessonSidebar({
  folderSections,
  selectedLessonId,
  completedVideoRefs,
  resolvedVideoRefsById = {},
  collapsedFolders,
  // visibleCountByFolder, // Not needed with virtualization
  mobile = false,
  onToggleFolder,
  onSelectLesson,
  // onShowMore, // Not needed with virtualization
  onCollapseAllFolders,
  onExpandAllFolders,
  onClose,
}: LessonSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const isLessonCompleted = useCallback(
    (lesson: StoredVideo): boolean => {
      const legacyRef = buildVideoRef(lesson);
      if (completedVideoRefs.has(legacyRef)) {
        return true;
      }
      const resolvedRef = resolvedVideoRefsById[lesson.id];
      return Boolean(resolvedRef && completedVideoRefs.has(resolvedRef));
    },
    [completedVideoRefs, resolvedVideoRefsById],
  );

  const wrapperClasses = mobile
    ? "h-full w-[340px] max-w-[92vw] border-l border-cyan-900/40 bg-[#041022] shadow-2xl flex flex-col"
    : "h-full flex flex-col overflow-hidden rounded-[22px] border border-cyan-900/40 bg-[#041022]/95 shadow-[0_0_35px_rgba(0,180,255,0.08)]";

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

  const flatItems = useMemo<FlatItem[]>(() => {
    const items: FlatItem[] = [];
    for (const section of filteredSections) {
      const isSearching = Boolean(searchQuery);
      const collapsed = isSearching ? false : (collapsedFolders[section.path] ?? false);
      const completedInSection = section.lessons.filter((lesson) => isLessonCompleted(lesson)).length;

      items.push({
        type: "header",
        section,
        collapsed,
        pathId: section.pathId, // Assuming pathId is available on FolderSection from parent mapping
        completedCount: completedInSection,
      });

      if (!collapsed) {
        // Render all lessons if not collapsed (virtualization handles performance)
        for (let i = 0; i < section.lessons.length; i++) {
          items.push({
            type: "lesson",
            lesson: section.lessons[i],
            sectionPathId: section.pathId,
            index: i,
          });
        }
      }
    }
    return items;
  }, [filteredSections, collapsedFolders, searchQuery, isLessonCompleted]);

  // Scroll to selected lesson on initial load or selection change
  useEffect(() => {
    if (!selectedLessonId || !virtuosoRef.current) return;

    // Find index of selected lesson
    const index = flatItems.findIndex(
      (item) => item.type === "lesson" && item.lesson.id === selectedLessonId
    );

    if (index !== -1) {
      virtuosoRef.current.scrollIntoView({
        index,
        behavior: "auto",
        align: "center",
      });
    }
  }, [selectedLessonId, flatItems]); // Be careful with flatItems dependency, might scroll too often if list changes

  const totalLessons = useMemo(
    () => filteredSections.reduce((acc, section) => acc + section.lessons.length, 0),
    [filteredSections],
  );

  const totalCompleted = useMemo(
    () =>
      filteredSections.reduce(
        (acc, section) =>
          acc + section.lessons.filter((lesson) => isLessonCompleted(lesson)).length,
        0,
      ),
    [filteredSections, isLessonCompleted],
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

  const ItemContent = useCallback((_index: number, item: FlatItem) => {
    if (item.type === "header") {
      const { section, collapsed, completedCount } = item;
      return (
        <div className="mt-2 first:mt-0 px-3 pb-1 pt-1">
          <div className="flex items-center justify-between gap-2 rounded-t-lg border border-cyan-900/40 border-b-cyan-950/50 bg-[#071327] px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-[11px] font-bold uppercase tracking-wider text-slate-300" title={section.path} role="heading" aria-level={3}>
                {section.path}
              </p>
              <p className="text-[10px] font-mono text-slate-500">
                {completedCount}/{section.lessons.length}
              </p>
            </div>
            <button
              aria-expanded={!collapsed}
              className="rounded-md border border-cyan-900/40 bg-[#0a1a33] p-1.5 text-slate-400 transition-colors hover:text-cyan-300 disabled:opacity-40"
              disabled={Boolean(searchQuery)}
              onClick={() => onToggleFolder(section.path)}
              type="button"
            >
              {collapsed ? <Icon name="angle-right" className="text-[14px]" /> : <Icon name="angle-down" className="text-[14px]" />}
            </button>
          </div>
          {/* Visual border closer if collapsed */}
          {collapsed && <div className="h-1 rounded-b-lg border-x border-b border-cyan-900/40 bg-[#030d1d]" />}
        </div>
      );
    }

    const { lesson, index: lessonIndex } = item;
    const active = selectedLessonId === lesson.id;
    const lessonCompleted = isLessonCompleted(lesson);
    const itemNumber = String(lessonIndex + 1).padStart(2, "0");
    const storageLabel = formatStorageKind(lesson).toUpperCase();

    // Check if this is the last item in the section to round corners
    // (In a flat list, we'd need to peek ahead, but for simplicity we can just style the item container)
    // Actually, simple list style is fine.

    return (
      <div className="px-3">
        <button
          className={`group flex w-full items-start gap-3 border-x border-cyan-900/40 bg-[#030d1d] px-3 py-3 text-left transition-all hover:bg-slate-900/60 ${active
            ? "bg-gradient-to-r from-cyan-500/10 to-transparent"
            : ""
            } last:border-b last:rounded-b-lg`}
          data-active={active ? "true" : "false"}
          aria-current={active ? "true" : undefined}
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
      </div>
    );
  }, [selectedLessonId, isLessonCompleted, onToggleFolder, onSelectLesson, searchQuery]);

  return (
    <div className={wrapperClasses} data-testid={mobile ? "course-sidebar-mobile" : "course-sidebar"}>
      <div className="border-b border-cyan-950/50 px-4 py-4 shrink-0 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-2xl font-black uppercase tracking-tight text-white drop-shadow-md">
            {mobile ? "Conteudo" : "Arquivos avulsos"}
          </h3>
          <span className="rounded-md border border-cyan-500/40 bg-cyan-950/40 px-2 py-1 text-xs font-mono font-bold text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.1)]">
            {totalCompleted}/{Math.max(totalLessons, 1)}
          </span>
        </div>

        {canToggleAll && (
          <div>
            <button
              className="rounded-md border border-cyan-500/30 bg-cyan-950/30 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-cyan-300 transition-all hover:bg-cyan-900/40 hover:border-cyan-400/50 hover:shadow-[0_0_15px_rgba(6,182,212,0.2)] disabled:opacity-40"
              data-testid="toggle-all-folders"
              disabled={Boolean(searchQuery)}
              onClick={handleToggleAll}
              type="button"
            >
              {toggleAllLabel}
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-[14px]" />
            <input
              className="w-full rounded-lg border border-cyan-900/40 bg-[#061221] py-2.5 pl-9 pr-8 text-xs font-medium text-slate-200 placeholder-slate-600 shadow-inner focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all"
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
                aria-label="Limpar busca"
              >
                <Icon name="cross" className="text-[12px]" />
              </button>
            )}
          </div>

          {mobile && onClose && (
            <button
              className="flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-slate-300 active:scale-95 transition-all"
              onClick={onClose}
              type="button"
              aria-label="Fechar menu"
            >
              Fechar
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-[#041022]">
        {flatItems.length === 0 && searchQuery ? (
          <div className="py-8 text-center text-xs font-medium text-slate-500">
            Nenhum arquivo encontrado para "{searchQuery}".
          </div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            data={flatItems}
            itemContent={ItemContent}
            className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700"
            // Increase overscan to prevent blank spaces during fast scroll
            overscan={200}
          />
        )}
      </div>
    </div>
  );
}
