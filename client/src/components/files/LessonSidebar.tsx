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

type FlatItem =
  | { type: "header"; section: FolderSection; collapsed: boolean; pathId: string; completedCount: number }
  | { type: "lesson"; lesson: StoredVideo; sectionPathId: string; index: number };

export function LessonSidebar({
  folderSections,
  selectedLessonId,
  completedVideoRefs,
  resolvedVideoRefsById = {},
  collapsedFolders,
  mobile = false,
  onToggleFolder,
  onSelectLesson,
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
    ? "h-full w-[340px] max-w-[92vw] border-l border-cyan-500/30 bg-[#061127] shadow-2xl flex flex-col"
    : "files-panel h-[clamp(360px,68vh,760px)] flex flex-col overflow-hidden rounded-[24px]";

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
        pathId: section.pathId,
        completedCount: completedInSection,
      });

      if (!collapsed) {
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

  useEffect(() => {
    if (!selectedLessonId || !virtuosoRef.current) return;

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
  }, [selectedLessonId, flatItems]);

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
        <div className="mt-2 px-3 pb-1 first:mt-0 pt-1">
          <div className="files-panel-elevated flex items-center justify-between gap-2 rounded-t-xl px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate files-display text-[10px] uppercase text-slate-300" title={section.path} role="heading" aria-level={3}>
                {section.path}
              </p>
              <p className="text-[10px] font-mono text-cyan-200/70">
                {completedCount}/{section.lessons.length}
              </p>
            </div>
            <button
              aria-expanded={!collapsed}
              aria-label={collapsed ? `Expandir pasta ${section.path}` : `Recolher pasta ${section.path}`}
              className="rounded-md border border-cyan-500/30 bg-[#0b1e39] p-1.5 text-slate-300 transition-colors hover:text-cyan-200 disabled:opacity-40"
              disabled={Boolean(searchQuery)}
              onClick={() => onToggleFolder(section.path)}
              type="button"
            >
              {collapsed ? <Icon name="angle-right" className="text-[14px]" /> : <Icon name="angle-down" className="text-[14px]" />}
            </button>
          </div>
          {collapsed && <div className="h-1 rounded-b-xl border-x border-b border-cyan-900/40 bg-[#041022]" />}
        </div>
      );
    }

    const { lesson, index: lessonIndex } = item;
    const active = selectedLessonId === lesson.id;
    const lessonCompleted = isLessonCompleted(lesson);
    const itemNumber = String(lessonIndex + 1).padStart(2, "0");
    const storageLabel = formatStorageKind(lesson).toUpperCase();
    const storageHint = lesson.storageKind === "bridge"
      ? "STREAM"
      : lesson.storageKind === "handle"
        ? "HANDLE"
        : lesson.storageKind === "chunks"
          ? "CHUNKS"
          : "BLOB";

    return (
      <div className="px-3">
        <button
          className={`group flex w-full items-start gap-3 border-x border-cyan-900/50 bg-[#030d1d] px-3 py-3 text-left transition-all hover:bg-[#0a1b33] ${active
            ? "bg-gradient-to-r from-cyan-500/18 to-transparent"
            : ""
            } last:rounded-b-xl last:border-b`}
          data-active={active ? "true" : "false"}
          aria-current={active ? "true" : undefined}
          aria-label={`Selecionar aula ${lesson.name}`}
          onClick={() => onSelectLesson(lesson.id)}
          type="button"
        >
          <div
            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-mono ${lessonCompleted
              ? "border-emerald-500/70 bg-emerald-500/15 text-emerald-300"
              : active
                ? "border-cyan-400 bg-cyan-500/20 text-cyan-200"
                : "border-slate-700 bg-slate-900 text-slate-500"
              }`}
          >
            {lessonCompleted ? (
              <Icon name="check-circle" className="text-[12px]" />
            ) : active ? (
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-300" />
            ) : (
              <span>{itemNumber}</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p
              className={`truncate text-sm font-medium leading-tight transition-colors ${active ? "text-cyan-200" : "text-slate-200 group-hover:text-cyan-200"
                }`}
            >
              {itemNumber}. {lesson.name}
            </p>
            {lessonCompleted ? (
              <div className="mt-1 flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-emerald-300">
                <span className="rounded border border-emerald-500/45 bg-emerald-500/10 px-1.5 py-0.5">
                  Concluida (+XP)
                </span>
              </div>
            ) : (
              <div className="mt-1 flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                <span className="rounded border border-slate-700/70 bg-slate-900/85 px-1.5 py-0.5">
                  {formatBytes(lesson.size)}
                </span>
                <span>{storageLabel} [{storageHint}]</span>
              </div>
            )}
          </div>

          {active && (
            <div className="mt-1 flex h-5 items-end gap-0.5 self-center">
              <span className="h-2 w-0.5 animate-pulse rounded bg-cyan-300" />
              <span className="h-4 w-0.5 animate-pulse rounded bg-cyan-200 [animation-delay:120ms]" />
              <span className="h-3 w-0.5 animate-pulse rounded bg-cyan-300 [animation-delay:240ms]" />
            </div>
          )}
        </button>
      </div>
    );
  }, [selectedLessonId, isLessonCompleted, onToggleFolder, onSelectLesson, searchQuery]);

  return (
    <div className={wrapperClasses} data-testid={mobile ? "course-sidebar-mobile" : "course-sidebar"}>
      <div className="shrink-0 space-y-3 border-b border-cyan-950/60 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="files-display text-xl font-extrabold uppercase tracking-[0.12em] text-white md:text-2xl">
            {mobile ? "Conteudo" : "Arquivos avulsos"}
          </h3>
          <span className="files-chip px-2 py-1 text-[10px]">
            {totalCompleted}/{Math.max(totalLessons, 1)}
          </span>
        </div>

        {canToggleAll && (
          <div>
            <button
              className="rounded-md border border-cyan-500/35 bg-cyan-900/35 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-cyan-200 transition-all hover:border-cyan-300/55 hover:bg-cyan-900/55 disabled:opacity-40"
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
              className="w-full rounded-lg border border-cyan-900/50 bg-[#06162b] py-2.5 pl-9 pr-8 text-xs font-medium text-slate-200 placeholder-slate-500 shadow-inner transition-all focus:border-cyan-400/55 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Buscar arquivo..."
              type="text"
              value={searchQuery}
            />
            {searchQuery && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-200"
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
              className="flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-slate-300 transition-all active:scale-95"
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
        {flatItems.length === 0 ? (
          <div className="py-8 text-center text-xs font-medium text-slate-500">
            {searchQuery
              ? `Nenhum arquivo encontrado para "${searchQuery}".`
              : "Nenhum video disponivel nesta lista."}
          </div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            data={flatItems}
            itemContent={ItemContent}
            className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700"
            style={{ height: "100%" }}
            overscan={200}
          />
        )}
      </div>
    </div>
  );
}
