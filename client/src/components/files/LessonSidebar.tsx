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
import { useTheme } from "../../contexts/ThemeContext";

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
  const { isIosTheme } = useTheme();
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
    ? `h-full w-[340px] max-w-[92vw] flex flex-col ${isIosTheme ? "ios26-section-hero" : "border-l border-slate-300/50 bg-[#040914]/95 backdrop-blur-3xl shadow-2xl"}`
    : `h-[clamp(360px,68vh,760px)] flex flex-col overflow-hidden rounded-[24px] ${isIosTheme ? "ios26-section" : "border border-slate-300/50 bg-slate-950/40 backdrop-blur-xl shadow-2xl"}`;

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
        <div className="mt-1 px-2 first:mt-0">
          <div className="group flex items-center justify-between gap-2 rounded-xl border border-slate-300/50 liquid-glass-inner/20 px-3 py-2 transition-colors hover:liquid-glass-inner/40">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-black uppercase tracking-widest text-slate-800 group-hover:text-slate-900 transition-colors" title={section.path} role="heading" aria-level={3}>
                {section.path}
              </p>
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-500 group-hover:text-slate-600">
                {completedCount} / {section.lessons.length} aulas
              </p>
            </div>
            <button
              aria-expanded={!collapsed}
              aria-label={collapsed ? `Expandir pasta ${section.path}` : `Recolher pasta ${section.path}`}
              className={`rounded-lg p-1.5 transition-colors disabled:opacity-40 ${isIosTheme ? "ios26-control ios26-focusable text-slate-700 hover:text-slate-900" : "text-slate-500 hover:liquid-glass-inner hover:text-slate-900"}`}
              disabled={Boolean(searchQuery)}
              onClick={() => onToggleFolder(section.path)}
              type="button"
            >
              {collapsed ? <Icon name="angle-right" className="text-[14px]" /> : <Icon name="angle-down" className="text-[14px]" />}
            </button>
          </div>
        </div>
      );
    }

    const { lesson, index: lessonIndex } = item;
    const active = selectedLessonId === lesson.id;
    const lessonCompleted = isLessonCompleted(lesson);
    const itemNumber = String(lessonIndex + 1).padStart(2, "0");
    const storageLabel = formatStorageKind(lesson).toUpperCase();

    return (
      <div className="px-2">
        <button
          className={`group relative flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-all hover:bg-white/[0.03] ${active
            ? isIosTheme ? "ios26-nav-item ios26-nav-item-active ios26-focusable" : "bg-[hsl(var(--accent)/0.08)] border border-[hsl(var(--accent)/0.2)]"
            : isIosTheme ? "ios26-nav-item ios26-focusable" : "border border-transparent"
            }`}
          data-active={active ? "true" : "false"}
          aria-current={active ? "true" : undefined}
          aria-label={`Selecionar aula ${lesson.name}`}
          onClick={() => onSelectLesson(lesson.id)}
          type="button"
        >
          {active && (
            <div className="absolute left-0 top-1/2 -mt-3 h-6 w-1 rounded-r-full bg-[hsl(var(--accent))] shadow-[0_0_10px_rgba(var(--glow),0.8)]" />
          )}

          <div
            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-black transition-colors ${lessonCompleted
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
              : active
                ? "border-[hsl(var(--accent)/0.5)] bg-[hsl(var(--accent)/0.2)] text-[hsl(var(--accent-light))]"
                : "border-slate-700/50 liquid-glass-inner/30 text-slate-500 group-hover:border-slate-600 group-hover:text-slate-600"
              }`}
          >
            {lessonCompleted ? (
              <Icon name="check-circle" className="text-[12px]" />
            ) : active ? (
              <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--accent-light))] shadow-[0_0_8px_rgba(var(--glow),0.6)]" />
            ) : (
              <span>{itemNumber}</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p
              className={`truncate text-[13px] font-bold leading-tight transition-colors ${active ? "text-[hsl(var(--accent-light))]" : "text-slate-800 group-hover:text-slate-900"
                }`}
            >
              {lesson.name}
            </p>
            {lessonCompleted ? (
              <div className="mt-1.5 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-emerald-400/80">
                <span className="rounded bg-emerald-500/10 px-1.5 py-0.5">
                  Concluída (+XP)
                </span>
              </div>
            ) : (
              <div className="mt-1.5 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-500">
                <span className="rounded liquid-glass-inner/50 px-1.5 py-0.5 group-hover:bg-slate-700/50 transition-colors">
                  {formatBytes(lesson.size)}
                </span>
                <span>{storageLabel}</span>
              </div>
            )}
          </div>

          {active && (
            <div className="mt-1 flex h-4 items-end gap-0.5 self-center">
              <span className="h-2 w-0.5 animate-pulse rounded bg-[hsl(var(--accent-light))] opacity-80" />
              <span className="h-3.5 w-0.5 animate-pulse rounded bg-[hsl(var(--accent-light))] opacity-90 [animation-delay:120ms]" />
              <span className="h-2.5 w-0.5 animate-pulse rounded bg-[hsl(var(--accent-light))] opacity-80 [animation-delay:240ms]" />
            </div>
          )}
        </button>
      </div>
    );
  }, [selectedLessonId, isLessonCompleted, onToggleFolder, onSelectLesson, searchQuery, isIosTheme]);

  return (
    <div className={wrapperClasses} data-testid={mobile ? "course-sidebar-mobile" : "course-sidebar"}>
      <div className="shrink-0 space-y-3 border-b border-cyan-950/60 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="files-display text-xl font-extrabold uppercase tracking-[0.12em] text-slate-900 md:text-2xl">
            {mobile ? "Conteudo" : "Arquivos avulsos"}
          </h3>
          <span className="files-chip px-2 py-1 text-[10px]">
            {totalCompleted}/{Math.max(totalLessons, 1)}
          </span>
        </div>

        {canToggleAll && (
          <div>
            <button
              className={`rounded-md px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition-all disabled:opacity-40 ${isIosTheme ? "ios26-control ios26-focusable text-slate-800" : "border border-cyan-500/35 bg-cyan-900/35 text-cyan-200 hover:border-cyan-300/55 hover:bg-cyan-900/55"}`}
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
              className={`w-full rounded-lg py-2.5 pl-9 pr-8 text-xs font-medium transition-all ${isIosTheme ? "ios26-field ios26-focusable text-slate-800" : "border border-cyan-900/50 bg-[#06162b] text-slate-200 placeholder-slate-500 shadow-inner focus:border-cyan-400/55 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"}`}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Buscar arquivo..."
              type="text"
              value={searchQuery}
            />
            {searchQuery && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 transition-colors hover:text-slate-200"
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
              className={`flex items-center justify-center rounded-lg px-4 py-2 text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 ${isIosTheme ? "ios26-control ios26-focusable text-slate-800" : "border border-slate-700 liquid-glass text-slate-800"}`}
              onClick={onClose}
              type="button"
              aria-label="Fechar menu"
            >
              Fechar
            </button>
          )}
        </div>
      </div>

      <div className={`flex-1 min-h-0 ${isIosTheme ? "ios26-section" : "bg-[#041022]"}`}>
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
