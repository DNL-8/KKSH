import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  ChevronRight,
  Coins,
  FileVideo,
  Film,
  FolderOpen,
  List,
  Loader2,
  Shield,
  Trophy,
  Trash2,
  Upload,
  Zap,
} from "lucide-react";
import {
  type ComponentType,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";

import {
  ApiRequestError,
  createSession,
  listVideoSessions,
} from "../lib/api";
import {
  DEFAULT_RELATIVE_PATH,
  MAX_LIBRARY_VIDEOS,
  clearVideos,
  listVideos,
  type StoredVideo,
} from "../lib/localVideosStore";
import type { AppShellContextValue } from "../layout/types";
import { VideoPlayer } from "../components/files/VideoPlayer";
import { VideoMetadata } from "../components/files/VideoMetadata";
import { LessonSidebar, LESSONS_VISIBLE_DEFAULT, LESSONS_VISIBLE_INCREMENT } from "../components/files/LessonSidebar";
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
  sortGroupPaths,
  subjectFromRelativePath,
  summarizeNames,
  toErrorMessage,
} from "../components/files/utils";
import { useFileImporter } from "../hooks/useFileImporter";

const MAX_SESSION_PAGES = 300;

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
  icon: ComponentType<{ size?: string | number; className?: string }>;
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
        <div className={`h-full rounded-full transition-all duration-700 ${HUD_BAR_TONE_CLASS[tone]}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function FilesStatCard({ label, value, subtext, icon: Icon }: FilesStatCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/60 p-4 backdrop-blur-md transition-all duration-300 hover:border-cyan-500/40">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-violet-500/5 opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="relative flex items-center gap-4">
        <div className="rounded-lg border border-slate-700 bg-slate-800/80 p-3 shadow-inner transition-transform duration-300 group-hover:scale-105">
          <Icon className="text-cyan-400" size={22} />
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


export function FilesPage() {
  const { globalStats, authUser, openAuthPanel } =
    useOutletContext<AppShellContextValue>();
  const queryClient = useQueryClient();

  const invalidateProgressCaches = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] }),
      queryClient.invalidateQueries({ queryKey: ["auth", "progress"] }),
      queryClient.invalidateQueries({ queryKey: ["hub-state"] }),
      queryClient.invalidateQueries({ queryKey: ["evolution-state"] }),
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
  const [activeTab, setActiveTab] = useState<TabMode>("overview");
  const [isSidebarMobileOpen, setIsSidebarMobileOpen] = useState(false);
  const [selectedDurationSec, setSelectedDurationSec] = useState<number | null>(null);

  const [completedVideoRefs, setCompletedVideoRefs] = useState<Set<string>>(new Set());
  const [loadingCompletions, setLoadingCompletions] = useState(false);
  const [completingLesson, setCompletingLesson] = useState(false);

  const authUserId = authUser?.id ?? null;
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
        const sortedLessons = [...(groups.get(path) ?? [])].sort((a, b) =>
          orderMode === "newest" ? b.createdAt - a.createdAt : a.createdAt - b.createdAt,
        );
        return {
          path,
          pathId: normalizePathForTestId(path),
          lessons: sortedLessons,
        };
      });
  }, [orderMode, visibleVideos]);

  const selectedVideo = useMemo<StoredVideo | null>(() => {
    if (!selectedLessonId) {
      return null;
    }
    return visibleVideos.find((video) => video.id === selectedLessonId) ?? null;
  }, [selectedLessonId, visibleVideos]);

  const selectedVideoRef = selectedVideo ? buildVideoRef(selectedVideo) : null;
  const selectedVideoCompleted = selectedVideoRef ? completedVideoRefs.has(selectedVideoRef) : false;
  const estimatedMinutes =
    selectedDurationSec && Number.isFinite(selectedDurationSec)
      ? Math.max(1, Math.ceil(selectedDurationSec / 60))
      : null;

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
    const folderInput = folderInputRef.current;
    if (!folderInput) {
      return;
    }
    folderInput.setAttribute("webkitdirectory", "");
    folderInput.setAttribute("directory", "");
  }, [folderInputRef]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.removeItem("cmd8_files_group_prefs_v1");
  }, []);

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
    if (visibleVideos.length === 0) {
      setSelectedLessonId(null);
      return;
    }

    if (selectedLessonId && visibleVideos.some((video) => video.id === selectedLessonId)) {
      return;
    }

    const firstLessonId = folderSections[0]?.lessons[0]?.id ?? visibleVideos[0]?.id ?? null;
    setSelectedLessonId(firstLessonId);
  }, [folderSections, selectedLessonId, visibleVideos]);

  useEffect(() => {
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
  }, [folderSections]);

  useEffect(() => {
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
    if (!selectedVideo || !selectedVideoRef) {
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
        return next;
      });

      setStatusMessage(
        usedFallbackDuration
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
  }, [authUser, invalidateProgressCaches, loadingCompletions, openAuthPanel, selectedDurationSec, selectedVideo, selectedVideoCompleted, selectedVideoRef]);

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

  return (
    <div className="animate-in slide-in-from-right-10 space-y-6 duration-700">
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

      <div className="relative overflow-hidden rounded-[30px] border border-slate-800 bg-[#090b10]/90 p-4">
        <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-cyan-900/10 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-violet-900/10 blur-[120px]" />

        <div className="relative z-10 space-y-4">
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4 backdrop-blur-md">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">
                  <span>UPLINK_ON</span>
                  <ChevronRight size={12} />
                  <span>Arquivos de Sincronia</span>
                </div>
                <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white">
                  Biblioteca de <span className="text-[hsl(var(--accent))]">Aulas</span>
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
            <FilesStatCard label="Nivel Atual" value={String(globalStats.level)} subtext="Iniciado" icon={Shield} />
            <FilesStatCard label="Rank" value={globalStats.rank} subtext="Sistema" icon={Trophy} />
            <FilesStatCard label="Experiencia" value={`${globalStats.xp}/${globalStats.maxXp}`} subtext="XP total" icon={Zap} />
            <FilesStatCard label="Gold" value={String(globalStats.gold)} subtext="Creditos" icon={Coins} />
          </div>

          <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
            <button
              className="flex items-center gap-2 rounded-xl border border-[hsl(var(--accent)/0.3)] bg-[hsl(var(--accent))] px-3 py-2 text-[10px] font-black uppercase text-white shadow-lg shadow-[rgba(var(--glow),0.2)] transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving}
              onClick={handleOpenPicker}
              type="button"
            >
              {saving ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
              Selecionar videos
            </button>
            <button
              className="flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-600 px-3 py-2 text-[10px] font-black uppercase text-white shadow-lg shadow-indigo-900/20 transition-all hover:bg-indigo-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving}
              onClick={handleOpenFolderPicker}
              type="button"
            >
              <FolderOpen size={14} />
              Carregar pasta
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
                <FolderOpen size={14} />
                Conectar pasta (alto volume)
              </button>
            )}
            <button
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] font-black uppercase text-slate-300 transition-all hover:border-[hsl(var(--accent)/0.3)] hover:text-[hsl(var(--accent-light))] disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="toggle-order"
              disabled={visibleVideos.length === 0 || loading}
              onClick={() => setOrderMode((value) => (value === "newest" ? "oldest" : "newest"))}
              type="button"
            >
              <ArrowUpDown size={14} />
              {orderMode === "newest" ? "Ordem: recentes" : "Ordem: antigas"}
            </button>
            <button
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] font-black uppercase text-slate-300 transition-all hover:border-red-500/30 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="clear-library"
              disabled={visibleVideos.length === 0 || loading || saving}
              onClick={() => void handleClearAll()}
              type="button"
            >
              <Trash2 size={14} />
              Limpar biblioteca
            </button>
            <button
              aria-label="Abrir conteudo"
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] font-black uppercase text-slate-300 transition-all hover:border-[hsl(var(--accent)/0.3)] hover:text-[hsl(var(--accent-light))] lg:hidden"
              data-testid="sidebar-mobile-toggle"
              disabled={visibleVideos.length === 0}
              onClick={() => setIsSidebarMobileOpen(true)}
              type="button"
            >
              <List size={14} />
              Conteudo
            </button>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0b0d12] p-3 text-xs font-semibold text-slate-400">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{completedVideoRefs.size} aula(s) concluidas nesta conta</span>
              {loadingCompletions && (
                <span className="flex items-center gap-1 text-[hsl(var(--accent-light))]">
                  <Loader2 size={12} className="animate-spin" />
                  sincronizando
                </span>
              )}
            </div>
          </div>
        </div>

        {storageUnavailable && (
          <div className="mt-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs font-semibold text-yellow-300">
            Persistencia local indisponivel neste navegador. Os videos ficam somente nesta sessao.
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
            <AlertTriangle size={14} />
            {error}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-[30px] border border-slate-800 bg-[#0a0a0b]/60">
          <div className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.2em] text-slate-400">
            <Loader2 className="animate-spin text-[hsl(var(--accent))]" size={20} />
            Carregando biblioteca local...
          </div>
        </div>
      ) : visibleVideos.length === 0 ? (
        <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[30px] border border-dashed border-slate-700 bg-[#0a0a0b]/40 px-8 text-center">
          <div className="mb-6 rounded-2xl border border-[hsl(var(--accent)/0.3)] bg-[hsl(var(--accent)/0.1)] p-4">
            <Film className="text-[hsl(var(--accent))]" size={36} />
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
            <Upload size={16} />
            Selecionar videos
          </button>
          <button
            className="mt-3 flex items-center gap-2 rounded-2xl border border-indigo-500/30 bg-indigo-600 px-6 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-indigo-500 active:scale-95"
            onClick={handleOpenFolderPicker}
            type="button"
          >
            <FolderOpen size={16} />
            Carregar pasta inteira
          </button>
          {directoryHandleSupported && (
            <button
              className="mt-3 flex items-center gap-2 rounded-2xl border border-violet-500/30 bg-violet-600 px-6 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-violet-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving}
              onClick={() => void handleOpenDirectoryPicker()}
              type="button"
            >
              <FolderOpen size={16} />
              Conectar pasta (alto volume)
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5" data-testid="course-player">
            <div className="group relative overflow-hidden rounded-[30px] border border-slate-800 bg-black/80 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
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
            </div>

            <div className="rounded-[24px] border border-slate-800 bg-[#0b0d12] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-lg font-black tracking-tight text-white">{selectedVideo?.name ?? "Sem aula selecionada"}</h3>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Pasta: {selectedVideo?.relativePath ?? "-"}
                  </p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Armazenamento: {selectedVideo ? formatStorageKind(selectedVideo) : "-"}
                  </p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Duracao detectada: {estimatedMinutes ? `${estimatedMinutes} min` : "aguardando metadados"}
                  </p>
                </div>

                <button
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-black uppercase transition-all ${selectedVideoCompleted
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-[hsl(var(--accent)/0.3)] bg-[hsl(var(--accent))] text-white hover:brightness-110"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  data-testid="complete-lesson-button"
                  disabled={
                    !selectedVideo ||
                    selectedVideoCompleted ||
                    completingLesson
                  }
                  onClick={() => void handleCompleteLesson()}
                  type="button"
                >
                  {completingLesson ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                  {!authUser
                    ? "Faca login para concluir"
                    : loadingCompletions
                      ? "Sincronizando..."
                    : selectedVideoCompleted
                      ? "Ja concluida"
                      : completingLesson
                        ? "Concluindo..."
                        : "Concluir aula (+XP)"}
                </button>
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
          </div>

          <aside className="hidden lg:block">
            <div className="space-y-4">
              <LessonSidebar
                folderSections={folderSections}
                selectedLessonId={selectedLessonId}
                completedVideoRefs={completedVideoRefs}
                collapsedFolders={collapsedFolders}
                visibleCountByFolder={visibleCountByFolder}
                onToggleFolder={handleToggleFolder}
                onSelectLesson={handleSelectLesson}
                onShowMore={handleShowMoreLessons}
                onClose={() => setIsSidebarMobileOpen(false)}
              />
              <div className="cursor-pointer rounded-xl border border-dashed border-slate-700 bg-slate-900/30 p-4 transition-all hover:border-cyan-500/30 hover:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-slate-800 p-2 text-slate-300">
                    <FileVideo size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-300">Material de Apoio</h4>
                    <p className="text-xs text-slate-500">Use arquivos locais para reforcar a aula atual.</p>
                  </div>
                </div>
              </div>
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
              folderSections={folderSections}
              selectedLessonId={selectedLessonId}
              completedVideoRefs={completedVideoRefs}
              collapsedFolders={collapsedFolders}
              visibleCountByFolder={visibleCountByFolder}
              mobile={true}
              onToggleFolder={handleToggleFolder}
              onSelectLesson={handleSelectLesson}
              onShowMore={handleShowMoreLessons}
              onClose={() => setIsSidebarMobileOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
