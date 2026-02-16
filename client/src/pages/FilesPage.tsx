import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useOutletContext } from "react-router-dom";

import { Icon } from "../components/common/Icon";

import {
  ApiRequestError,
  createSession,
  listVideoSessions,
} from "../lib/api";
import {
  DEFAULT_RELATIVE_PATH,
  HIGH_VOLUME_FOLDER_THRESHOLD,
  MAX_LIBRARY_VIDEOS,
  clearVideos,
  listVideos,
  type StoredVideo,
} from "../lib/localVideosStore";
import type { AppShellContextValue } from "../layout/types";
import { VideoPlayer } from "../components/files/VideoPlayer";
import { VideoMetadata } from "../components/files/VideoMetadata";
import { LessonSidebar, LESSONS_VISIBLE_DEFAULT, LESSONS_VISIBLE_INCREMENT } from "../components/files/LessonSidebar";
import { heightPercentClass, widthPercentClass } from "../lib/percentClasses";
import {
  type FolderSection,
  type OrderMode,
  type TabMode,
  VIDEO_COMPLETION_PREFIX,
  buildVideoRef,
  extractVideoRefFromNotes,
  formatStorageKind,
  normalizePathForTestId,
  resolvePlayableFile,
  resolveVideoCompletionRef,
  sortGroupPaths,
  subjectFromRelativePath,
  summarizeNames,
  toErrorMessage,
} from "../components/files/utils";
import { useFileImporter } from "../hooks/useFileImporter";

const MAX_SESSION_PAGES = 300;
const FILES_VIEW_STATE_STORAGE_PREFIX = "cmd8_files_view_state_v1";

type HudTone = "red" | "blue" | "yellow" | "green" | "purple";

interface HudProgressBarProps {
  value: number;
  max: number;
  tone: HudTone;
  label: string;
  textValue: string;
}

interface FilesStatCardProps {
  label: string;
  value: string;
  subtext: string;
  icon: string;
}

const ORDER_LABELS: Record<OrderMode, string> = {
  newest: "Ordem: recentes",
  oldest: "Ordem: antigas",
  name_asc: "Ordem: nome A-Z",
  name_desc: "Ordem: nome Z-A",
  size_desc: "Ordem: maior arquivo",
  size_asc: "Ordem: menor arquivo",
};

const PLAYER_WAVEFORM_PATTERN = Array.from({ length: 60 }, (_, index) => 30 + ((index * 37) % 65));

interface FilesViewStateSnapshot {
  selectedLessonId: string | null;
  collapsedFolders: Record<string, boolean>;
  visibleCountByFolder: Record<string, number>;
  orderMode: OrderMode;
  activeTab: TabMode;
}

const ORDER_MODES: OrderMode[] = ["newest", "oldest", "name_asc", "name_desc", "size_desc", "size_asc"];
const TAB_MODES: TabMode[] = ["overview", "metadata"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOrderMode(value: string): value is OrderMode {
  return ORDER_MODES.includes(value as OrderMode);
}

function isTabMode(value: string): value is TabMode {
  return TAB_MODES.includes(value as TabMode);
}

function viewStateStorageKey(scope: string): string {
  return `${FILES_VIEW_STATE_STORAGE_PREFIX}:${scope}`;
}

function sanitizeBooleanMap(value: unknown): Record<string, boolean> {
  if (!isRecord(value)) {
    return {};
  }
  const next: Record<string, boolean> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "boolean") {
      next[key] = item;
    }
  }
  return next;
}

function sanitizeNumberMap(value: unknown): Record<string, number> {
  if (!isRecord(value)) {
    return {};
  }
  const next: Record<string, number> = {};
  for (const [key, item] of Object.entries(value)) {
    const parsed = Number(item);
    if (Number.isFinite(parsed) && parsed > 0) {
      next[key] = Math.round(parsed);
    }
  }
  return next;
}

function readFilesViewState(scope: string): FilesViewStateSnapshot | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(viewStateStorageKey(scope));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      return null;
    }

    const selectedLessonId =
      typeof parsed.selectedLessonId === "string"
        ? parsed.selectedLessonId
        : parsed.selectedLessonId === null
          ? null
          : null;

    const orderMode =
      typeof parsed.orderMode === "string" && isOrderMode(parsed.orderMode)
        ? parsed.orderMode
        : "newest";

    const activeTab =
      typeof parsed.activeTab === "string" && isTabMode(parsed.activeTab)
        ? parsed.activeTab
        : "overview";

    return {
      selectedLessonId,
      collapsedFolders: sanitizeBooleanMap(parsed.collapsedFolders),
      visibleCountByFolder: sanitizeNumberMap(parsed.visibleCountByFolder),
      orderMode,
      activeTab,
    };
  } catch {
    return null;
  }
}

const HUD_BAR_TONE_CLASS: Record<HudTone, string> = {
  red: "bg-gradient-to-r from-red-600 to-rose-400 shadow-[0_0_10px_rgba(225,29,72,0.5)]",
  blue: "bg-gradient-to-r from-blue-600 to-cyan-400 shadow-[0_0_10px_rgba(37,99,235,0.5)]",
  yellow: "bg-gradient-to-r from-yellow-500 to-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.5)]",
  green: "bg-gradient-to-r from-emerald-600 to-green-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]",
  purple: "bg-gradient-to-r from-violet-600 to-fuchsia-400 shadow-[0_0_10px_rgba(139,92,246,0.5)]",
};

const HUD_TEXT_TONE_CLASS: Record<HudTone, string> = {
  red: "text-red-400",
  blue: "text-blue-400",
  yellow: "text-yellow-400",
  green: "text-emerald-400",
  purple: "text-violet-400",
};

function HudProgressBar({ value, max, tone, label, textValue }: HudProgressBarProps) {
  const safeMax = Math.max(1, max);
  const percentage = Math.min(100, Math.max(0, (value / safeMax) * 100));

  return (
    <div className="w-36">
      <div className="mb-1 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
        <span>{label}</span>
        <span className={HUD_TEXT_TONE_CLASS[tone]}>{textValue}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full border border-slate-700/40 bg-slate-800/50">
        <div className={`h-full rounded-full transition-all duration-700 ${HUD_BAR_TONE_CLASS[tone]} ${widthPercentClass(percentage)}`} />
      </div>
    </div>
  );
}

function FilesStatCard({ label, value, subtext, icon }: FilesStatCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/60 p-4 backdrop-blur-md transition-all duration-300 hover:border-cyan-500/40">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-violet-500/5 opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="relative flex items-center gap-4">
        <div className="rounded-lg border border-slate-700 bg-slate-800/80 p-3 shadow-inner transition-transform duration-300 group-hover:scale-105">
          <Icon name={icon} className="text-cyan-400 text-[22px]" />
        </div>
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</h4>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="text-2xl font-black tracking-tight text-white transition-colors group-hover:text-cyan-300">{value}</span>
            <span className="text-[10px] font-mono text-slate-500">{subtext}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function compareVideos(left: StoredVideo, right: StoredVideo, mode: OrderMode): number {
  switch (mode) {
    case "newest":
      return right.createdAt - left.createdAt || left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" });
    case "oldest":
      return left.createdAt - right.createdAt || left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" });
    case "name_asc":
      return left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" }) || right.createdAt - left.createdAt;
    case "name_desc":
      return right.name.localeCompare(left.name, "pt-BR", { sensitivity: "base" }) || right.createdAt - left.createdAt;
    case "size_desc":
      return right.size - left.size || right.createdAt - left.createdAt;
    case "size_asc":
      return left.size - right.size || right.createdAt - left.createdAt;
    default:
      return right.createdAt - left.createdAt;
  }
}


export function FilesPage() {
  const { globalStats, authUser, openAuthPanel } =
    useOutletContext<AppShellContextValue>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const invalidateProgressCaches = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] }),
      queryClient.invalidateQueries({ queryKey: ["auth", "progress"] }),
      queryClient.invalidateQueries({ queryKey: ["hub-state"] }),
      queryClient.invalidateQueries({ queryKey: ["evolution-state"] }),
      queryClient.invalidateQueries({ queryKey: ["top-history-activity"] }),
    ]);
  }, [queryClient]);

  const [videos, setVideos] = useState<StoredVideo[]>([]);
  const [runtimeVideos, setRuntimeVideos] = useState<StoredVideo[]>([]);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [storageUnavailable, setStorageUnavailable] = useState(false);

  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [visibleCountByFolder, setVisibleCountByFolder] = useState<Record<string, number>>({});
  const [orderMode, setOrderMode] = useState<OrderMode>("newest");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<TabMode>("overview");
  const [isSidebarMobileOpen, setIsSidebarMobileOpen] = useState(false);
  const [selectedDurationSec, setSelectedDurationSec] = useState<number | null>(null);

  const [completedVideoRefs, setCompletedVideoRefs] = useState<Set<string>>(new Set());
  const [resolvedVideoRefsById, setResolvedVideoRefsById] = useState<Record<string, string>>({});
  const [selectedVideoRef, setSelectedVideoRef] = useState<string | null>(null);
  const [resolvingSelectedVideoRef, setResolvingSelectedVideoRef] = useState(false);
  const [loadingCompletions, setLoadingCompletions] = useState(false);
  const [completingLesson, setCompletingLesson] = useState(false);
  const [viewStateReadyKey, setViewStateReadyKey] = useState<string | null>(null);

  const authUserId = authUser?.id ?? null;
  const viewStateScope = authUserId ?? "guest";
  const currentViewStateKey = viewStateStorageKey(viewStateScope);
  const visibleVideos = storageUnavailable ? runtimeVideos : videos;

  const loadVideos = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const rows = await listVideos();
      setVideos(rows);
      setStorageUnavailable(false);
    } catch (loadError) {
      setVideos([]);
      setStorageUnavailable(true);
      setError(toErrorMessage(loadError, "Nao foi possivel carregar a biblioteca local."));
    } finally {
      setLoading(false);
    }
  }, []);

  const mergeRuntimeVideos = useCallback((incoming: StoredVideo[]) => {
    let addedCount = 0;
    let ignoredCount = 0;
    let skippedByLimitCount = 0;

    setRuntimeVideos((current) => {
      const ids = new Set(current.map((video) => video.id));
      const added: StoredVideo[] = [];
      for (const video of incoming) {
        if (ids.has(video.id)) {
          ignoredCount += 1;
          continue;
        }
        if (ids.size >= MAX_LIBRARY_VIDEOS) {
          skippedByLimitCount += 1;
          continue;
        }
        ids.add(video.id);
        added.push(video);
      }
      addedCount = added.length;
      return [...added, ...current].sort((a, b) => b.createdAt - a.createdAt);
    });

    return { addedCount, ignoredCount, skippedByLimitCount };
  }, []);

  const {
    fileInputRef,
    folderInputRef,
    saving,
    rejectedFiles,
    directoryHandleSupported,
    highVolumeHint,
    clearHighVolumeHint,
    triggerDirectoryConnect,
    handleOpenPicker,
    handleOpenFolderPicker,
    handleOpenDirectoryPicker,
    handleFilesSelected,
    handleFolderSelected,
  } = useFileImporter({
    onReload: loadVideos,
    mergeRuntimeVideos,
    setError,
    setStatusMessage,
    setStorageUnavailable,
    storageUnavailable,
  });

  const folderSections = useMemo<FolderSection[]>(() => {
    const groups = new Map<string, StoredVideo[]>();

    for (const video of visibleVideos) {
      const path = video.relativePath || DEFAULT_RELATIVE_PATH;
      const current = groups.get(path) ?? [];
      current.push(video);
      groups.set(path, current);
    }

    return Array.from(groups.keys())
      .sort(sortGroupPaths)
      .map((path) => {
        const sortedLessons = [...(groups.get(path) ?? [])].sort((a, b) => compareVideos(a, b, orderMode));
        return {
          path,
          pathId: normalizePathForTestId(path),
          lessons: sortedLessons,
        };
      });
  }, [orderMode, visibleVideos]);

  const filteredFolderSections = useMemo<FolderSection[]>(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return folderSections;
    }

    return folderSections
      .map((section) => ({
        ...section,
        lessons: section.lessons.filter((lesson) => {
          const relativePath = lesson.relativePath || DEFAULT_RELATIVE_PATH;
          return (
            lesson.name.toLowerCase().includes(query) ||
            relativePath.toLowerCase().includes(query)
          );
        }),
      }))
      .filter((section) => section.lessons.length > 0);
  }, [folderSections, searchTerm]);

  const filteredLessonCount = useMemo(
    () => filteredFolderSections.reduce((acc, section) => acc + section.lessons.length, 0),
    [filteredFolderSections],
  );

  const selectedVideo = useMemo<StoredVideo | null>(() => {
    if (!selectedLessonId) {
      return null;
    }
    return visibleVideos.find((video) => video.id === selectedLessonId) ?? null;
  }, [selectedLessonId, visibleVideos]);

  const isVideoCompleted = useCallback(
    (video: StoredVideo | null): boolean => {
      if (!video) {
        return false;
      }
      const legacyRef = buildVideoRef(video);
      if (completedVideoRefs.has(legacyRef)) {
        return true;
      }
      const resolvedRef = resolvedVideoRefsById[video.id];
      return Boolean(resolvedRef && completedVideoRefs.has(resolvedRef));
    },
    [completedVideoRefs, resolvedVideoRefsById],
  );

  const selectedVideoCompleted = isVideoCompleted(selectedVideo);
  const estimatedMinutes =
    selectedDurationSec && Number.isFinite(selectedDurationSec)
      ? Math.max(1, Math.ceil(selectedDurationSec / 60))
      : null;

  useEffect(() => {
    if (!selectedVideo) {
      setSelectedVideoRef(null);
      setResolvingSelectedVideoRef(false);
      return;
    }

    const legacyRef = buildVideoRef(selectedVideo);
    const selectedId = selectedVideo.id;
    let cancelled = false;

    setSelectedVideoRef(legacyRef);
    setResolvedVideoRefsById((current) =>
      current[selectedId] === legacyRef ? current : { ...current, [selectedId]: legacyRef },
    );
    setResolvingSelectedVideoRef(true);

    const resolveRef = async () => {
      try {
        const stableRef = await resolveVideoCompletionRef(selectedVideo);
        if (cancelled) {
          return;
        }
        setSelectedVideoRef(stableRef);
        setResolvedVideoRefsById((current) =>
          current[selectedId] === stableRef ? current : { ...current, [selectedId]: stableRef },
        );
      } catch {
        if (cancelled) {
          return;
        }
        setSelectedVideoRef(legacyRef);
      } finally {
        if (!cancelled) {
          setResolvingSelectedVideoRef(false);
        }
      }
    };

    void resolveRef();

    return () => {
      cancelled = true;
    };
  }, [selectedVideo]);

  const loadCompletedVideoRefs = useCallback(async () => {
    if (!authUserId) {
      setCompletedVideoRefs(new Set());
      setLoadingCompletions(false);
      return;
    }

    setLoadingCompletions(true);
    try {
      const refs = new Set<string>();
      let cursor: string | undefined;
      let pageIndex = 0;
      while (pageIndex < MAX_SESSION_PAGES) {
        const payload = await listVideoSessions(cursor);

        for (const row of payload.sessions) {
          const ref = extractVideoRefFromNotes(row.notes);
          if (ref) {
            refs.add(ref);
          }
        }

        pageIndex += 1;
        if (!payload.nextCursor) {
          cursor = undefined;
          break;
        }
        cursor = payload.nextCursor;
      }

      setCompletedVideoRefs(refs);
      if (cursor) {
        setStatusMessage(
          `Sincronizacao parcial de aulas concluidas: limite de ${MAX_SESSION_PAGES} paginas atingido.`,
        );
      }
    } catch (loadError) {
      setError(toErrorMessage(loadError, "Nao foi possivel sincronizar o progresso das aulas."));
    } finally {
      setLoadingCompletions(false);
    }
  }, [authUserId]);

  useEffect(() => {
    void loadVideos();
  }, [loadVideos]);

  useEffect(() => {
    void loadCompletedVideoRefs();
  }, [loadCompletedVideoRefs]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setViewStateReadyKey(null);
    const snapshot = readFilesViewState(viewStateScope);
    if (snapshot) {
      setSelectedLessonId(snapshot.selectedLessonId);
      setCollapsedFolders(snapshot.collapsedFolders);
      setVisibleCountByFolder(snapshot.visibleCountByFolder);
      setOrderMode(snapshot.orderMode);
      setActiveTab(snapshot.activeTab);
    }
    setViewStateReadyKey(currentViewStateKey);
  }, [currentViewStateKey, viewStateScope]);

  useEffect(() => {
    if (typeof window === "undefined" || viewStateReadyKey !== currentViewStateKey) {
      return;
    }

    const snapshot: FilesViewStateSnapshot = {
      selectedLessonId,
      collapsedFolders,
      visibleCountByFolder,
      orderMode,
      activeTab,
    };
    try {
      window.localStorage.setItem(currentViewStateKey, JSON.stringify(snapshot));
    } catch {
      // Ignore storage write failures.
    }
  }, [
    activeTab,
    collapsedFolders,
    currentViewStateKey,
    orderMode,
    selectedLessonId,
    viewStateReadyKey,
    visibleCountByFolder,
  ]);

  useEffect(() => {
    const folderInput = folderInputRef.current;
    if (!folderInput) {
      return;
    }
    folderInput.setAttribute("webkitdirectory", "");
    folderInput.setAttribute("directory", "");
  }, [folderInputRef]);

  useEffect(() => {
    setSelectedVideoUrl("");
    if (!selectedVideo) {
      return;
    }

    let closed = false;
    let objectUrl: string | null = null;

    const loadPlayableSource = async () => {
      try {
        const playableFile = await resolvePlayableFile(selectedVideo);
        if (closed) {
          return;
        }
        objectUrl = URL.createObjectURL(playableFile);
        setSelectedVideoUrl(objectUrl);
      } catch (loadError) {
        if (closed) {
          return;
        }
        setSelectedVideoUrl("");
        setError(toErrorMessage(loadError, "Nao foi possivel abrir o video selecionado."));
      }
    };

    void loadPlayableSource();

    return () => {
      closed = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [selectedVideo]);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (visibleVideos.length === 0) {
      setSelectedLessonId(null);
      return;
    }

    if (selectedLessonId && visibleVideos.some((video) => video.id === selectedLessonId)) {
      return;
    }

    const firstLessonId = folderSections[0]?.lessons[0]?.id ?? visibleVideos[0]?.id ?? null;
    setSelectedLessonId(firstLessonId);
  }, [folderSections, loading, selectedLessonId, visibleVideos]);

  useEffect(() => {
    if (loading) {
      return;
    }
    const validPaths = new Set(folderSections.map((section) => section.path));
    setCollapsedFolders((current) => {
      const entries = Object.entries(current);
      if (entries.length === 0) {
        return current;
      }

      let changed = false;
      const next: Record<string, boolean> = {};
      for (const [path, collapsed] of entries) {
        if (validPaths.has(path)) {
          next[path] = collapsed;
        } else {
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [folderSections, loading]);

  useEffect(() => {
    if (loading) {
      return;
    }
    const validPaths = new Set(folderSections.map((section) => section.path));
    setVisibleCountByFolder((current) => {
      const entries = Object.entries(current);
      if (entries.length === 0) {
        return current;
      }

      let changed = false;
      const next: Record<string, number> = {};
      for (const [path, visibleCount] of entries) {
        if (validPaths.has(path)) {
          next[path] = visibleCount;
        } else {
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [folderSections]);

  useEffect(() => {
    setSelectedDurationSec(null);
  }, [selectedVideo?.id]);

  const handleToggleFolder = (path: string) => {
    setCollapsedFolders((current) => ({
      ...current,
      [path]: !current[path],
    }));
  };

  const handleCollapseAllFolders = useCallback(() => {
    setCollapsedFolders(() => {
      const next: Record<string, boolean> = {};
      for (const section of folderSections) {
        next[section.path] = true;
      }
      return next;
    });
  }, [folderSections, loading]);

  const handleExpandAllFolders = useCallback(() => {
    setCollapsedFolders(() => {
      const next: Record<string, boolean> = {};
      for (const section of folderSections) {
        next[section.path] = false;
      }
      return next;
    });
  }, [folderSections]);

  const handleSelectLesson = (lessonId: string) => {
    setSelectedLessonId(lessonId);
    setIsSidebarMobileOpen(false);
  };

  const handleShowMoreLessons = (path: string) => {
    setVisibleCountByFolder((current) => ({
      ...current,
      [path]: (current[path] ?? LESSONS_VISIBLE_DEFAULT) + LESSONS_VISIBLE_INCREMENT,
    }));
  };

  const handleOpenVisualSettings = useCallback(() => {
    navigate("/config");
  }, [navigate]);

  const handleToggleMetadataPanel = useCallback(() => {
    setActiveTab((current) => (current === "overview" ? "metadata" : "overview"));
  }, []);

  const handleClearAll = async () => {
    setError(null);
    setStatusMessage(null);

    if (storageUnavailable) {
      setRuntimeVideos([]);
      setStatusMessage("Biblioteca temporaria limpa.");
      return;
    }

    try {
      await clearVideos();
      await loadVideos();
      setStatusMessage("Biblioteca local limpa.");
    } catch (clearError) {
      setError(toErrorMessage(clearError, "Falha ao limpar biblioteca local."));
    }
  };

  const handleCompleteLesson = useCallback(async () => {
    if (!selectedVideo) {
      return;
    }

    if (resolvingSelectedVideoRef || !selectedVideoRef) {
      setStatusMessage("Preparando identificador estavel da aula para dedupe.");
      return;
    }

    if (!authUser) {
      setStatusMessage("Faca login no topo para contabilizar XP e nivel.");
      openAuthPanel();
      return;
    }

    if (loadingCompletions) {
      setStatusMessage("Sincronizando progresso de aulas concluidas. Tente novamente em instantes.");
      return;
    }

    if (selectedVideoCompleted) {
      setStatusMessage("Essa aula ja foi concluida e ja gerou XP nesta conta.");
      return;
    }

    // Duration is now tracked via onDurationChange in VideoPlayer
    let durationSec = selectedDurationSec;
    let usedFallbackDuration = false;

    // Fallback if no duration detected (e.g. error or very short video)
    if (typeof durationSec !== "number" || !Number.isFinite(durationSec) || durationSec <= 0) {
      durationSec = 60;
      usedFallbackDuration = true;
    }

    const minutes = Math.max(1, Math.ceil(durationSec / 60));
    const subject = subjectFromRelativePath(selectedVideo.relativePath || DEFAULT_RELATIVE_PATH);

    setCompletingLesson(true);
    setError(null);
    setStatusMessage(null);
    try {
      const output = await createSession({
        subject,
        minutes,
        mode: "video_lesson",
        notes: `${VIDEO_COMPLETION_PREFIX}${selectedVideoRef}`,
      });

      setCompletedVideoRefs((current) => {
        const next = new Set(current);
        next.add(selectedVideoRef);
        next.add(buildVideoRef(selectedVideo));
        return next;
      });

      setStatusMessage(
        output.xpEarned <= 0 && output.goldEarned <= 0
          ? "Essa aula ja havia sido concluida nesta conta. Nenhum novo XP ou historico foi gerado."
          : usedFallbackDuration
            ? `Aula concluida: +${output.xpEarned} XP | ${minutes} min contabilizados (duracao minima aplicada).`
            : `Aula concluida: +${output.xpEarned} XP | ${minutes} min contabilizados.`,
      );
      await invalidateProgressCaches();
    } catch (completeError) {
      if (completeError instanceof ApiRequestError && completeError.status === 401) {
        setError("Sessao expirada. Faca login novamente.");
        await invalidateProgressCaches();
      }
      setError(toErrorMessage(completeError, "Falha ao registrar conclusao da aula."));
    } finally {
      setCompletingLesson(false);
    }
  }, [
    authUser,
    invalidateProgressCaches,
    loadingCompletions,
    openAuthPanel,
    resolvingSelectedVideoRef,
    selectedDurationSec,
    selectedVideo,
    selectedVideoCompleted,
    selectedVideoRef,
  ]);

  const handleVideoEnded = useCallback(() => {
    if (!selectedLessonId) return;

    // Find current video in sections to determine next
    for (const section of folderSections) {
      const idx = section.lessons.findIndex((l) => l.id === selectedLessonId);
      if (idx !== -1) {
        // Check if there is a next video in this section
        if (idx < section.lessons.length - 1) {
          const nextLesson = section.lessons[idx + 1];
          handleSelectLesson(nextLesson.id);
        }
        break;
      }
    }
  }, [selectedLessonId, folderSections]);

  const completedLessonCount = useMemo(
    () => visibleVideos.reduce((acc, video) => (isVideoCompleted(video) ? acc + 1 : acc), 0),
    [isVideoCompleted, visibleVideos],
  );
  const completionRate = visibleVideos.length > 0
    ? Math.round((completedLessonCount / visibleVideos.length) * 100)
    : 0;
  const currentFolderCount = filteredFolderSections.length;

  return (
    <div className="animate-in slide-in-from-right-10 space-y-6 pb-20 duration-700">
      <input
        ref={fileInputRef}
        accept="video/*"
        className="hidden"
        data-testid="video-file-input"
        multiple
        onChange={handleFilesSelected}
        type="file"
      />
      <input
        ref={folderInputRef}
        accept="video/*"
        className="hidden"
        data-testid="video-folder-input"
        multiple
        onChange={handleFolderSelected}
        type="file"
      />

      <div className="relative overflow-hidden rounded-[30px] border border-slate-800 bg-[#090b10]/90 p-4 md:p-6" data-testid="files-header">
        <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-cyan-900/10 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-violet-900/10 blur-[120px]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.04)_1px,transparent_1px)] bg-[size:36px_36px]" />

        <div className="relative z-10 space-y-4">
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4 backdrop-blur-md">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center gap-2 rounded-md border border-cyan-500/30 bg-cyan-950/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
                  <Icon name="activity" className="animate-pulse text-[12px]" />
                  System Ready
                </div>
                <div className="mb-1 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">
                  <span>UPLINK_ON</span>
                  <Icon name="angle-right" className="text-[12px]" />
                  <span>Arquivos de Sincronia</span>
                </div>
                <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white">
                  Biblioteca de <span className="text-cyan-400">Aulas</span>
                </h2>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  Player local com progresso RPG, playlist por pasta e conclusao com XP.
                </p>
              </div>

              <div className="ml-auto flex flex-wrap items-center gap-5 rounded-2xl border border-slate-800 bg-black/40 px-4 py-3 shadow-lg">
                <HudProgressBar value={globalStats.hp} max={100} tone="red" label="HP" textValue={`${Math.round(globalStats.hp)}%`} />
                <HudProgressBar value={globalStats.mana} max={100} tone="blue" label="MP" textValue={`${Math.round(globalStats.mana)}%`} />
                <HudProgressBar
                  value={globalStats.xp}
                  max={globalStats.maxXp}
                  tone="yellow"
                  label="EXP"
                  textValue={`LVL ${globalStats.level}`}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <FilesStatCard label="Nivel Atual" value={String(globalStats.level)} subtext="Iniciado" icon="shield-check" />
            <FilesStatCard label="Rank" value={globalStats.rank} subtext="Sistema" icon="trophy" />
            <FilesStatCard label="Experiencia" value={`${globalStats.xp}/${globalStats.maxXp}`} subtext="XP total" icon="bolt" />
            <FilesStatCard label="Gold" value={String(globalStats.gold)} subtext="Creditos" icon="coins" />
          </div>

          <div className="space-y-3 border-t border-slate-800 pt-4" data-testid="files-toolbar">
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-600 px-3 py-2 text-[10px] font-black uppercase text-white shadow-lg shadow-cyan-900/20 transition-all hover:bg-cyan-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                data-testid="files-upload-button"
                disabled={saving}
                onClick={handleOpenPicker}
                type="button"
              >
                {saving ? <Icon name="spinner" className="animate-spin text-[14px]" /> : <Icon name="upload" className="text-[14px]" />}
                Upload
              </button>
              <button
                className="flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-600 px-3 py-2 text-[10px] font-black uppercase text-white shadow-lg shadow-indigo-900/20 transition-all hover:bg-indigo-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                data-testid="files-folder-button"
                disabled={saving}
                onClick={handleOpenFolderPicker}
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
                  onClick={() => void handleOpenDirectoryPicker()}
                  title="Conecta uma pasta sem copiar todos os blobs para o IndexedDB."
                  type="button"
                >
                  <Icon name="folder-open" className="text-[14px]" />
                  Conectar pasta (alto volume)
                </button>
              )}
              <div
                className="hidden items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] font-black uppercase text-slate-300 transition-all hover:border-cyan-500/30 hover:text-cyan-300 md:flex"
                data-testid="files-sort-select"
              >
                <Icon name="sort-alt" className="text-[14px]" />
                <select
                  className="max-w-[210px] appearance-none bg-transparent pr-1 text-[10px] font-black uppercase tracking-wide text-slate-300 outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="toggle-order"
                  disabled={visibleVideos.length === 0 || loading}
                  onChange={(event) => setOrderMode(event.target.value as OrderMode)}
                  value={orderMode}
                >
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
                disabled={visibleVideos.length === 0 || loading || saving}
                onClick={() => void handleClearAll()}
                type="button"
              >
                <Icon name="trash" className="text-[14px]" />
                Limpar biblioteca
              </button>
              <button
                aria-label="Abrir conteudo"
                className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] font-black uppercase text-slate-300 transition-all hover:border-cyan-500/30 hover:text-cyan-300 lg:hidden"
                data-testid="sidebar-mobile-toggle"
                disabled={visibleVideos.length === 0}
                onClick={() => setIsSidebarMobileOpen(true)}
                type="button"
              >
                <Icon name="list" className="text-[14px]" />
                Conteudo
              </button>
              <button
                className="ml-auto hidden rounded-xl border border-slate-700 bg-slate-900 p-2 text-slate-300 transition-colors hover:text-cyan-300 md:inline-flex"
                title="Configuracoes visuais"
                data-testid="files-open-visual-settings"
                onClick={handleOpenVisualSettings}
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
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Pesquisar por nome ou pasta..."
                  type="text"
                  value={searchTerm}
                />
              </div>
              <div className="rounded-xl border border-slate-800 bg-[#0b0d12] px-3 py-2 text-xs font-semibold text-slate-400">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1">
                    <Icon name="apps" className="text-[13px]" />
                    {completedLessonCount}/{visibleVideos.length} aula(s) concluidas ({filteredLessonCount} visiveis, {completionRate}%)
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
        </div>

        {storageUnavailable && (
          <div className="mt-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs font-semibold text-yellow-300">
            Persistencia local indisponivel neste navegador. Os videos ficam somente nesta sessao.
          </div>
        )}

        {highVolumeHint && directoryHandleSupported && (
          <div
            className="mt-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs font-semibold text-cyan-200"
            data-testid="high-volume-banner"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{highVolumeHint}</span>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-lg border border-cyan-400/40 bg-cyan-500/20 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-cyan-100 transition-colors hover:bg-cyan-500/30"
                  data-testid="switch-to-directory-handle"
                  onClick={() => void triggerDirectoryConnect()}
                  type="button"
                >
                  Conectar pasta agora
                </button>
                <button
                  className="rounded-lg border border-slate-600/60 bg-slate-900/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-300 transition-colors hover:bg-slate-800"
                  onClick={clearHighVolumeHint}
                  type="button"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {visibleVideos.length >= MAX_LIBRARY_VIDEOS && (
          <div className="mt-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3 text-xs font-semibold text-indigo-200">
            Limite operacional atingido: {MAX_LIBRARY_VIDEOS} videos. Remova itens para importar novos.
          </div>
        )}

        {statusMessage && (
          <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-300">
            {statusMessage}
          </div>
        )}

        {rejectedFiles.length > 0 && (
          <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-semibold text-amber-200">
            Arquivos ignorados (nao sao video): {summarizeNames(rejectedFiles)}
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-semibold text-red-300">
            <Icon name="exclamation" className="text-[14px]" />
            {error}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-[30px] border border-slate-800 bg-[#0a0a0b]/60">
          <div className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.2em] text-slate-400">
            <Icon name="spinner" className="animate-spin text-[hsl(var(--accent))] text-[20px]" />
            Carregando biblioteca local...
          </div>
        </div>
      ) : visibleVideos.length === 0 ? (
        <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[30px] border border-dashed border-slate-700 bg-[#0a0a0b]/40 px-8 text-center">
          <div className="mb-6 rounded-2xl border border-[hsl(var(--accent)/0.3)] bg-[hsl(var(--accent)/0.1)] p-4">
            <Icon name="film" className="text-[hsl(var(--accent))] text-[36px]" />
          </div>
          <h3 className="text-xl font-black uppercase tracking-[0.2em] text-white">Biblioteca vazia</h3>
          <p className="mt-2 max-w-xl text-sm text-slate-500">
            Selecione videos ou pasta para montar sua trilha de estudos em /arquivos.
          </p>
          <button
            className="mt-8 flex items-center gap-2 rounded-2xl border border-[hsl(var(--accent)/0.3)] bg-[hsl(var(--accent))] px-6 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-white transition-all hover:brightness-110 active:scale-95"
            onClick={handleOpenPicker}
            type="button"
          >
            <Icon name="upload" className="text-[16px]" />
            Selecionar videos
          </button>
          <button
            className="mt-3 flex items-center gap-2 rounded-2xl border border-indigo-500/30 bg-indigo-600 px-6 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-indigo-500 active:scale-95"
            onClick={handleOpenFolderPicker}
            type="button"
          >
            <Icon name="folder-open" className="text-[16px]" />
            {`Carregar pasta (ate ${HIGH_VOLUME_FOLDER_THRESHOLD})`}
          </button>
          {directoryHandleSupported && (
            <button
              className="mt-3 flex items-center gap-2 rounded-2xl border border-violet-500/30 bg-violet-600 px-6 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-violet-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving}
              onClick={() => void handleOpenDirectoryPicker()}
              type="button"
            >
              <Icon name="folder-open" className="text-[16px]" />
              Conectar pasta (alto volume)
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="space-y-5" data-testid="files-player">
            <div className="group relative overflow-hidden rounded-[30px] border border-slate-800 bg-black/80 shadow-[0_0_40px_rgba(0,0,0,0.5)]" data-testid="course-player">
              <div className="pointer-events-none absolute left-0 top-0 h-8 w-8 rounded-tl-lg border-l-2 border-t-2 border-cyan-500/70" />
              <div className="pointer-events-none absolute right-0 top-0 h-8 w-8 rounded-tr-lg border-r-2 border-t-2 border-cyan-500/70" />
              <div className="pointer-events-none absolute bottom-0 left-0 h-8 w-8 rounded-bl-lg border-b-2 border-l-2 border-cyan-500/70" />
              <div className="pointer-events-none absolute bottom-0 right-0 h-8 w-8 rounded-br-lg border-b-2 border-r-2 border-cyan-500/70" />
              <VideoPlayer
                onDurationChange={setSelectedDurationSec}
                onEnded={handleVideoEnded}
                video={selectedVideo}
                videoUrl={selectedVideoUrl}
              />
              <div className="pointer-events-none absolute bottom-24 left-4 right-4 z-20 hidden items-end gap-1 md:flex">
                {PLAYER_WAVEFORM_PATTERN.map((value, index) => (
                  <span
                    key={`wf-${index}`}
                    className={`flex-1 rounded-full ${index <= 18 ? "bg-cyan-500/80" : "bg-slate-700/70"} ${heightPercentClass(value)}`}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-800 bg-[#0b0d12] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <h3 className="text-lg font-black tracking-tight text-white">{selectedVideo?.name ?? "Sem aula selecionada"}</h3>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Pasta: {selectedVideo?.relativePath ?? "-"}
                  </p>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Armazenamento: {selectedVideo ? formatStorageKind(selectedVideo) : "-"}
                  </p>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Duracao detectada: {estimatedMinutes ? `${estimatedMinutes} min` : "aguardando metadados"}
                  </p>
                </div>

                <div className="flex items-center gap-2" data-testid="files-complete-button">
                  <button
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-black uppercase transition-all ${selectedVideoCompleted
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : "border-cyan-500/40 bg-cyan-600 text-white hover:bg-cyan-500"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    data-testid="complete-lesson-button"
                    disabled={
                      !selectedVideo ||
                      selectedVideoCompleted ||
                      completingLesson ||
                      resolvingSelectedVideoRef
                    }
                    onClick={() => void handleCompleteLesson()}
                    type="button"
                  >
                    {completingLesson ? <Icon name="spinner" className="animate-spin text-[14px]" /> : <Icon name="check-circle" className="text-[14px]" />}
                    {!authUser
                      ? "Faca login para concluir"
                      : loadingCompletions
                        ? "Sincronizando..."
                        : resolvingSelectedVideoRef
                          ? "Preparando dedupe..."
                        : selectedVideoCompleted
                          ? "Ja concluida"
                          : completingLesson
                            ? "Concluindo..."
                            : "Concluir aula (+XP)"}
                  </button>
                  <button
                    className="rounded-xl border border-slate-700 bg-slate-900 p-2 text-slate-400 transition-colors hover:text-slate-200"
                    title={activeTab === "overview" ? "Abrir metadados" : "Voltar para visao geral"}
                    data-testid="files-toggle-metadata-panel"
                    onClick={handleToggleMetadataPanel}
                    type="button"
                  >
                    <Icon name="menu-dots-vertical" className="text-[14px]" />
                  </button>
                </div>
              </div>
            </div>

            <VideoMetadata
              selectedVideo={selectedVideo}
              selectedVideoRef={selectedVideoRef}
              videoCount={visibleVideos.length}
              folderCount={folderSections.length}
              completed={selectedVideoCompleted}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          </section>

          <aside className="hidden lg:block" data-testid="files-playlist">
            <div className="space-y-4">
              <LessonSidebar
                folderSections={filteredFolderSections}
                selectedLessonId={selectedLessonId}
                completedVideoRefs={completedVideoRefs}
                resolvedVideoRefsById={resolvedVideoRefsById}
                collapsedFolders={collapsedFolders}
                visibleCountByFolder={visibleCountByFolder}
                onToggleFolder={handleToggleFolder}
                onSelectLesson={handleSelectLesson}
                onShowMore={handleShowMoreLessons}
                onCollapseAllFolders={handleCollapseAllFolders}
                onExpandAllFolders={handleExpandAllFolders}
                onClose={() => setIsSidebarMobileOpen(false)}
              />
              <button
                className="w-full rounded-xl border border-dashed border-slate-700 bg-slate-900/30 p-4 text-left transition-all hover:border-cyan-500/30 hover:bg-slate-800/50"
                data-testid="files-support-material-upload"
                onClick={handleOpenFolderPicker}
                type="button"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-slate-800 p-2 text-slate-300">
                    <Icon name="file-video" className="text-[20px]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-300">Material de Apoio</h4>
                    <p className="text-xs text-slate-500">Pastas visiveis: {currentFolderCount}. Use arquivos locais para reforcar a aula atual.</p>
                  </div>
                </div>
              </button>
            </div>
          </aside>
        </div>
      )}

      {isSidebarMobileOpen && visibleVideos.length > 0 && (
        <div className="fixed inset-0 z-[120] lg:hidden" role="dialog" aria-modal="true">
          <button
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsSidebarMobileOpen(false)}
            type="button"
          />
          <div className="absolute bottom-0 right-0 top-0">
            <LessonSidebar
              folderSections={filteredFolderSections}
              selectedLessonId={selectedLessonId}
              completedVideoRefs={completedVideoRefs}
              resolvedVideoRefsById={resolvedVideoRefsById}
              collapsedFolders={collapsedFolders}
              visibleCountByFolder={visibleCountByFolder}
              mobile={true}
              onToggleFolder={handleToggleFolder}
              onSelectLesson={handleSelectLesson}
              onShowMore={handleShowMoreLessons}
              onCollapseAllFolders={handleCollapseAllFolders}
              onExpandAllFolders={handleExpandAllFolders}
              onClose={() => setIsSidebarMobileOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
