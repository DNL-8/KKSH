import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Film,
  FolderOpen,
  List,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useOutletContext } from "react-router-dom";

import {
  ApiRequestError,
  createSession,
  listVideoSessions,
} from "../lib/api";
import {
  DEFAULT_RELATIVE_PATH,
  MAX_LIBRARY_VIDEOS,
  buildStoredVideoFromFile,
  buildStoredVideoFromHandle,
  clearVideos,
  listVideos,
  resolveRelativePath,
  saveStoredVideos,
  saveVideos,
  supportsDirectoryHandles,
  type StoredVideo,
  type VideoImportSource,
} from "../lib/localVideosStore";
import type { AppShellContextValue } from "../layout/types";

interface FolderSection {
  path: string;
  pathId: string;
  lessons: StoredVideo[];
}

type OrderMode = "newest" | "oldest";
type TabMode = "overview" | "metadata";
interface DirectoryHandleScanResult {
  videos: StoredVideo[];
  rejected: string[];
  processed: number;
}
type FileHandlePermissionMode = "read" | "readwrite";
type FileSystemPermissionCompat = {
  queryPermission?: (descriptor?: { mode?: FileHandlePermissionMode }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: { mode?: FileHandlePermissionMode }) => Promise<PermissionState>;
};
type DirectoryHandleCompat = FileSystemDirectoryHandle & {
  entries?: () => AsyncIterable<[string, FileSystemHandle]>;
  values?: () => AsyncIterable<FileSystemHandle>;
};

const VIDEO_COMPLETION_PREFIX = "video_completion::";
const MAX_SESSION_PAGES = 300;
const LESSONS_VISIBLE_DEFAULT = 120;
const LESSONS_VISIBLE_INCREMENT = 200;

function normalizePathForTestId(path: string): string {
  const normalized = path
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "folder";
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function summarizeNames(names: string[]): string {
  if (names.length <= 3) {
    return names.join(", ");
  }

  const preview = names.slice(0, 3).join(", ");
  return `${preview} (+${names.length - 3})`;
}

function countFoldersFromFiles(files: File[]): number {
  const folderSet = new Set<string>();
  for (const file of files) {
    if (!file.type.startsWith("video/")) {
      continue;
    }
    folderSet.add(resolveRelativePath(file));
  }
  return folderSet.size;
}

function countFoldersFromVideos(videos: StoredVideo[]): number {
  const folderSet = new Set<string>();
  for (const video of videos) {
    folderSet.add(video.relativePath || DEFAULT_RELATIVE_PATH);
  }
  return folderSet.size;
}

function sortGroupPaths(a: string, b: string): number {
  if (a === DEFAULT_RELATIVE_PATH) {
    return b === DEFAULT_RELATIVE_PATH ? 0 : -1;
  }
  if (b === DEFAULT_RELATIVE_PATH) {
    return 1;
  }
  return a.localeCompare(b, "pt-BR", { sensitivity: "base" });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 ** 2) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 ** 3) {
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  }
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function formatStorageKind(video: StoredVideo): string {
  return video.storageKind === "handle" ? "Conectado (Handle)" : "Local (Blob)";
}

function buildVideoRef(video: StoredVideo): string {
  return video.id;
}

function extractVideoRefFromNotes(notes: string | null | undefined): string | null {
  if (!notes || !notes.startsWith(VIDEO_COMPLETION_PREFIX)) {
    return null;
  }

  const value = notes.slice(VIDEO_COMPLETION_PREFIX.length).trim();
  return value || null;
}

function subjectFromRelativePath(path: string): string {
  const normalized = path.replace(/\\/g, "/").trim();
  if (!normalized || normalized === DEFAULT_RELATIVE_PATH) {
    return DEFAULT_RELATIVE_PATH;
  }

  const [root] = normalized.split("/");
  const subject = (root || DEFAULT_RELATIVE_PATH).trim();
  return subject || DEFAULT_RELATIVE_PATH;
}

function buildImportStatusMessage(
  options: {
    added: number;
    ignored: number;
    rejected: number;
    skippedNoSpace: number;
    skippedByLimit: number;
    folderCount: number;
    processed: number;
  },
  prefix = "Importacao concluida",
): string {
  const parts: string[] = [
    `${options.processed} processado(s)`,
    `${options.added} adicionado(s)`,
  ];
  if (options.ignored > 0) {
    parts.push(`${options.ignored} ignorado(s)`);
  }
  if (options.rejected > 0) {
    parts.push(`${options.rejected} rejeitado(s)`);
  }
  if (options.skippedNoSpace > 0) {
    parts.push(`${options.skippedNoSpace} sem espaco`);
  }
  if (options.skippedByLimit > 0) {
    parts.push(`${options.skippedByLimit} acima do limite (${MAX_LIBRARY_VIDEOS})`);
  }
  parts.push(`${options.folderCount} pasta(s)`);
  return `${prefix}: ${parts.join(" | ")}.`;
}

async function resolvePlayableFile(video: StoredVideo): Promise<File> {
  if (video.storageKind === "handle") {
    const handle = video.fileHandle as (FileSystemFileHandle & FileSystemPermissionCompat) | undefined;
    if (!handle) {
      throw new Error("Arquivo conectado indisponivel.");
    }

    let permission: PermissionState = "prompt";
    if (typeof handle.queryPermission === "function") {
      permission = await handle.queryPermission({ mode: "read" });
    }

    if (permission !== "granted" && typeof handle.requestPermission === "function") {
      permission = await handle.requestPermission({ mode: "read" });
    }

    if (permission !== "granted") {
      throw new Error("Permissao necessaria para reproduzir este arquivo.");
    }

    return handle.getFile();
  }

  if (!video.file) {
    throw new Error("Arquivo local indisponivel para reproducao.");
  }

  if (video.file instanceof File) {
    return video.file;
  }

  return new File([video.file], video.name, {
    type: video.type || "video/*",
    lastModified: video.lastModified,
  });
}

async function scanDirectoryHandle(rootHandle: FileSystemDirectoryHandle): Promise<DirectoryHandleScanResult> {
  const videos: StoredVideo[] = [];
  const rejected: string[] = [];
  let processed = 0;

  const walkDirectory = async (directory: DirectoryHandleCompat, segments: string[]): Promise<void> => {
    const iteratorFactory =
      typeof directory.entries === "function"
        ? async function* () {
            for await (const [, handle] of directory.entries!()) {
              yield handle;
            }
          }
        : typeof directory.values === "function"
          ? directory.values.bind(directory)
          : null;

    if (!iteratorFactory) {
      throw new Error("Navegador sem suporte para leitura de diretorio conectado.");
    }

    for await (const handle of iteratorFactory()) {
      if (handle.kind === "directory") {
        await walkDirectory(handle as DirectoryHandleCompat, [...segments, handle.name]);
        continue;
      }

      const fileHandle = handle as FileSystemFileHandle;
      const file = await fileHandle.getFile();
      processed += 1;

      if (!file.type.startsWith("video/")) {
        rejected.push(file.name);
        continue;
      }

      const relativePath = segments.length > 0 ? segments.join("/") : DEFAULT_RELATIVE_PATH;
      videos.push(buildStoredVideoFromHandle(file, fileHandle, relativePath));
    }
  };

  const rootSegment = rootHandle.name?.trim() || DEFAULT_RELATIVE_PATH;
  await walkDirectory(rootHandle as DirectoryHandleCompat, rootSegment === DEFAULT_RELATIVE_PATH ? [DEFAULT_RELATIVE_PATH] : [rootSegment]);

  return { videos, rejected, processed };
}

export function FilesPage() {
  const { globalStats, authUser, syncProgressionFromApi } =
    useOutletContext<AppShellContextValue>();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const playerRef = useRef<HTMLVideoElement | null>(null);

  const [videos, setVideos] = useState<StoredVideo[]>([]);
  const [runtimeVideos, setRuntimeVideos] = useState<StoredVideo[]>([]);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [rejectedFiles, setRejectedFiles] = useState<string[]>([]);
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
  const directoryHandleSupported = supportsDirectoryHandles();
  const visibleVideos = storageUnavailable ? runtimeVideos : videos;

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
  }, []);

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

  const handleOpenPicker = () => {
    fileInputRef.current?.click();
  };

  const handleOpenFolderPicker = () => {
    folderInputRef.current?.click();
  };

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

  const saveToRuntimeFallback = useCallback(
    (incoming: StoredVideo[], rejected: string[], processed: number, folderCount: number, prefix = "Modo temporario ativo") => {
      const { addedCount, ignoredCount, skippedByLimitCount } = mergeRuntimeVideos(incoming);
      setRejectedFiles(rejected);
      if (incoming.length === 0) {
        setStatusMessage("Nenhum video valido selecionado.");
        return;
      }

      setStatusMessage(
        buildImportStatusMessage(
          {
            added: addedCount,
            ignored: ignoredCount,
            rejected: rejected.length,
            skippedNoSpace: 0,
            skippedByLimit: skippedByLimitCount,
            folderCount,
            processed,
          },
          prefix,
        ),
      );
    },
    [mergeRuntimeVideos],
  );

  const processSelectedFiles = useCallback(
    async (selectedFiles: File[], importSource: VideoImportSource) => {
      if (selectedFiles.length === 0) {
        return;
      }

      const validVideos = selectedFiles.filter((file) => file.type.startsWith("video/"));
      const rejected = selectedFiles.filter((file) => !file.type.startsWith("video/")).map((file) => file.name);
      const incoming = validVideos.map((file) => buildStoredVideoFromFile(file, importSource));
      const folderCount = countFoldersFromFiles(selectedFiles);

      setSaving(true);
      setError(null);
      setStatusMessage(null);
      setRejectedFiles([]);

      if (storageUnavailable) {
        saveToRuntimeFallback(incoming, rejected, selectedFiles.length, folderCount);
        setSaving(false);
        return;
      }

      try {
        const result = await saveVideos(selectedFiles, importSource);
        await loadVideos();
        setRejectedFiles(result.rejected);
        setStatusMessage(
          buildImportStatusMessage({
            added: result.added.length,
            ignored: result.ignored.length,
            rejected: result.rejected.length,
            skippedNoSpace: result.skippedNoSpace.length,
            skippedByLimit: result.skippedByLimit.length,
            folderCount,
            processed: result.processed,
          }),
        );
      } catch (saveError) {
        const message = toErrorMessage(saveError, "Falha ao salvar videos.");
        setError(message);
        if (message.toLowerCase().includes("indisponivel")) {
          setStorageUnavailable(true);
          saveToRuntimeFallback(incoming, rejected, selectedFiles.length, folderCount);
        }
      } finally {
        setSaving(false);
      }
    },
    [loadVideos, saveToRuntimeFallback, storageUnavailable],
  );

  const handleOpenDirectoryPicker = async () => {
    if (!directoryHandleSupported) {
      setStatusMessage(
        "Seu navegador nao suporta Conectar pasta. Abrindo carregamento de pasta tradicional.",
      );
      handleOpenFolderPicker();
      return;
    }

    const pickerWindow = window as Window & {
      showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
    };

    if (typeof pickerWindow.showDirectoryPicker !== "function") {
      setStatusMessage(
        "Conectar pasta nao esta disponivel neste navegador. Abrindo carregamento de pasta tradicional.",
      );
      handleOpenFolderPicker();
      return;
    }

    setSaving(true);
    setError(null);
    setStatusMessage(null);
    setRejectedFiles([]);

    try {
      const rootHandle = await pickerWindow.showDirectoryPicker();
      const scanned = await scanDirectoryHandle(rootHandle);
      const folderCount = countFoldersFromVideos(scanned.videos);

      if (storageUnavailable) {
        saveToRuntimeFallback(scanned.videos, scanned.rejected, scanned.processed, folderCount);
        return;
      }

      const result = await saveStoredVideos(scanned.videos);
      await loadVideos();
      setRejectedFiles(scanned.rejected);
      setStatusMessage(
        buildImportStatusMessage(
          {
            added: result.added.length,
            ignored: result.ignored.length,
            rejected: scanned.rejected.length,
            skippedNoSpace: result.skippedNoSpace.length,
            skippedByLimit: result.skippedByLimit.length,
            folderCount,
            processed: scanned.processed,
          },
          "Conexao de pasta concluida",
        ),
      );
    } catch (connectError) {
      if (connectError instanceof DOMException && connectError.name === "AbortError") {
        return;
      }
      if (connectError instanceof DOMException && connectError.name === "SecurityError") {
        setStatusMessage(
          "Conectar pasta exige contexto seguro. Usando carregamento de pasta tradicional.",
        );
        handleOpenFolderPicker();
        return;
      }

      const message = toErrorMessage(connectError, "Falha ao conectar pasta.");
      setError(message);
      if (message.toLowerCase().includes("indisponivel")) {
        setStorageUnavailable(true);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.currentTarget.value = "";
    void processSelectedFiles(selectedFiles, "input_file");
  };

  const handleFolderSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.currentTarget.value = "";
    void processSelectedFiles(selectedFiles, "input_folder");
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

  const handleCompleteLesson = async () => {
    if (!selectedVideo || !selectedVideoRef) {
      return;
    }

    if (!authUser) {
      setStatusMessage("Faca login no topo para contabilizar XP e nivel.");
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

    const durationFromPlayer = playerRef.current?.duration;
    let durationSec =
      selectedDurationSec && Number.isFinite(selectedDurationSec)
        ? selectedDurationSec
        : durationFromPlayer && Number.isFinite(durationFromPlayer)
          ? durationFromPlayer
          : Number.NaN;
    let usedFallbackDuration = false;
    if (!Number.isFinite(durationSec) || durationSec <= 0) {
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
      await syncProgressionFromApi();
    } catch (completeError) {
      if (completeError instanceof ApiRequestError && completeError.status === 401) {
        setError("Sessao expirada. Faca login novamente.");
        await syncProgressionFromApi();
      }
      setError(toErrorMessage(completeError, "Falha ao registrar conclusao da aula."));
    } finally {
      setCompletingLesson(false);
    }
  };

  const renderSidebar = (mobile = false) => {
    const wrapperClasses = mobile
      ? "h-full w-[320px] max-w-[88vw] bg-[#0b0d12] border-l border-slate-800 shadow-2xl p-4 overflow-y-auto"
      : "h-full rounded-[28px] border border-slate-800 bg-[#0b0d12]/90 p-4";

    return (
      <div className={wrapperClasses} data-testid={mobile ? "course-sidebar-mobile" : "course-sidebar"}>
        <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Conteudo</h3>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{folderSections.length} pastas</p>
          </div>
          {mobile && (
            <button
              className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-300"
              onClick={() => setIsSidebarMobileOpen(false)}
              type="button"
            >
              Fechar
            </button>
          )}
        </div>
        <div className="space-y-3">
          {folderSections.map((section) => {
            const collapsed = collapsedFolders[section.path] ?? false;
            const visibleCount = visibleCountByFolder[section.path] ?? LESSONS_VISIBLE_DEFAULT;
            const visibleLessons = section.lessons.slice(0, visibleCount);
            const hiddenLessons = Math.max(0, section.lessons.length - visibleLessons.length);

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
                    onClick={() => handleToggleFolder(section.path)}
                    type="button"
                  >
                    {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>

                {!collapsed && (
                  <div className="space-y-1 border-t border-slate-800 p-2">
                    {visibleLessons.map((lesson, index) => {
                      const active = selectedLessonId === lesson.id;
                      const lessonCompleted = completedVideoRefs.has(buildVideoRef(lesson));

                      return (
                        <button
                          key={lesson.id}
                          className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-all ${
                            active
                              ? "border border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                              : "border border-transparent bg-slate-950/50 text-slate-300 hover:border-slate-700 hover:bg-slate-900"
                          }`}
                          data-active={active ? "true" : "false"}
                          data-testid={`lesson-item-${section.pathId}-${index}`}
                          onClick={() => handleSelectLesson(lesson.id)}
                          type="button"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[11px] font-semibold">{lesson.name}</span>
                            <span
                              className={`text-[9px] font-bold uppercase tracking-wider ${
                                lessonCompleted ? "text-emerald-400" : "text-slate-500"
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
                        onClick={() => handleShowMoreLessons(section.path)}
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
        </div>
      </div>
    );
  };

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

      <div className="rounded-[26px] border border-slate-800 bg-[#090b10]/90 p-4">
        <div className="flex flex-col gap-4 border-b border-slate-800 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white">
              Biblioteca de <span className="text-cyan-500">Aulas</span>
            </h2>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Layout de curso com player principal, trilha lateral por pasta e abas de detalhes.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className="flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-600 px-3 py-2 text-[10px] font-black uppercase text-white shadow-lg shadow-cyan-900/20 transition-all hover:bg-cyan-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
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
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] font-black uppercase text-slate-300 transition-all hover:border-cyan-500/30 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
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
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] font-black uppercase text-slate-300 transition-all hover:border-cyan-500/30 hover:text-cyan-300 lg:hidden"
              data-testid="sidebar-mobile-toggle"
              disabled={visibleVideos.length === 0}
              onClick={() => setIsSidebarMobileOpen(true)}
              type="button"
            >
              <List size={14} />
              Conteudo
            </button>
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

        <div className="mt-4">
          <section className="rounded-2xl border border-slate-800 bg-[#0b0d12] p-4">
            <h3 className="mb-3 text-[11px] font-black uppercase tracking-[0.25em] text-slate-300">Progressao RPG</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">Nivel</p>
                <p className="mt-1 text-lg font-black text-cyan-300">{globalStats.level}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">Rank</p>
                <p className="mt-1 text-lg font-black text-cyan-300">{globalStats.rank}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">XP</p>
                <p className="mt-1 text-lg font-black text-cyan-300">
                  {globalStats.xp}/{globalStats.maxXp}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-500">Gold</p>
                <p className="mt-1 text-lg font-black text-cyan-300">{globalStats.gold}</p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>{completedVideoRefs.size} aula(s) concluidas nesta conta</span>
              {loadingCompletions && (
                <span className="flex items-center gap-1 text-cyan-300">
                  <Loader2 size={12} className="animate-spin" />
                  sincronizando
                </span>
              )}
            </div>
          </section>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-[30px] border border-slate-800 bg-[#0a0a0b]/60">
          <div className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.2em] text-slate-400">
            <Loader2 className="animate-spin text-cyan-500" size={20} />
            Carregando biblioteca local...
          </div>
        </div>
      ) : visibleVideos.length === 0 ? (
        <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[30px] border border-dashed border-slate-700 bg-[#0a0a0b]/40 px-8 text-center">
          <div className="mb-6 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4">
            <Film className="text-cyan-400" size={36} />
          </div>
          <h3 className="text-xl font-black uppercase tracking-[0.2em] text-white">Biblioteca vazia</h3>
          <p className="mt-2 max-w-xl text-sm text-slate-500">
            Selecione videos ou pasta para montar sua trilha de estudos em /arquivos.
          </p>
          <button
            className="mt-8 flex items-center gap-2 rounded-2xl border border-cyan-500/30 bg-cyan-600 px-6 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-cyan-500 active:scale-95"
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
            <div className="overflow-hidden rounded-[30px] border border-slate-800 bg-black/80">
              {selectedVideo ? (
                <video
                  key={selectedVideo.id}
                  ref={playerRef}
                  className="h-[320px] w-full bg-black object-contain md:h-[440px]"
                  controls
                  onDurationChange={(event) => {
                    const duration = event.currentTarget.duration;
                    if (Number.isFinite(duration) && duration > 0) {
                      setSelectedDurationSec(duration);
                    }
                  }}
                  onLoadedMetadata={(event) => {
                    const duration = event.currentTarget.duration;
                    if (Number.isFinite(duration) && duration > 0) {
                      setSelectedDurationSec(duration);
                    }
                  }}
                  playsInline
                  preload="metadata"
                  src={selectedVideoUrl}
                />
              ) : (
                <div className="flex h-[320px] items-center justify-center text-sm font-semibold text-slate-500 md:h-[440px]">
                  Nenhuma aula selecionada.
                </div>
              )}
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
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-black uppercase transition-all ${
                    selectedVideoCompleted
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : "border-cyan-500/30 bg-cyan-600 text-white hover:bg-cyan-500"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                  data-testid="complete-lesson-button"
                  disabled={
                    !selectedVideo ||
                    !authUser ||
                    selectedVideoCompleted ||
                    completingLesson ||
                    loadingCompletions
                  }
                  onClick={() => void handleCompleteLesson()}
                  type="button"
                >
                  {completingLesson ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                  {!authUser
                    ? "Faca login para concluir"
                    : selectedVideoCompleted
                      ? "Ja concluida"
                      : completingLesson
                        ? "Concluindo..."
                        : "Concluir aula (+XP)"}
                </button>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-800 bg-[#0b0d12] p-4">
              <div className="mb-4 flex items-center gap-2 border-b border-slate-800 pb-3">
                <button
                  className={`rounded-lg px-3 py-2 text-[11px] font-black uppercase tracking-wider transition-all ${
                    activeTab === "overview"
                      ? "bg-cyan-500/20 text-cyan-300"
                      : "bg-slate-900 text-slate-400 hover:text-slate-200"
                  }`}
                  data-testid="tab-overview"
                  onClick={() => setActiveTab("overview")}
                  type="button"
                >
                  Visao geral
                </button>
                <button
                  className={`rounded-lg px-3 py-2 text-[11px] font-black uppercase tracking-wider transition-all ${
                    activeTab === "metadata"
                      ? "bg-cyan-500/20 text-cyan-300"
                      : "bg-slate-900 text-slate-400 hover:text-slate-200"
                  }`}
                  data-testid="tab-metadata"
                  onClick={() => setActiveTab("metadata")}
                  type="button"
                >
                  Metadados
                </button>
              </div>

              {activeTab === "overview" ? (
                <div className="space-y-4 text-sm text-slate-300">
                  <p className="text-base font-semibold text-white">
                    {selectedVideo
                      ? `Aula atual: ${selectedVideo.name}`
                      : "Selecione uma aula na trilha lateral para iniciar."}
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Total de videos</p>
                      <p className="mt-1 text-lg font-black text-cyan-300">{visibleVideos.length}</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Total de pastas</p>
                      <p className="mt-1 text-lg font-black text-cyan-300">{folderSections.length}</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Pasta atual</p>
                      <p className="mt-1 truncate text-lg font-black text-cyan-300">{selectedVideo?.relativePath ?? "-"}</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Status RPG</p>
                      <p className="mt-1 text-lg font-black text-cyan-300">
                        {selectedVideoCompleted ? "Concluida" : "Pendente"}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-sm text-slate-300">
                  {selectedVideo ? (
                    <>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Nome do arquivo</p>
                          <p className="mt-1 font-semibold text-white">{selectedVideo.name}</p>
                        </div>
                        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Pasta</p>
                          <p className="mt-1 font-semibold text-white">{selectedVideo.relativePath}</p>
                        </div>
                        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Tipo</p>
                          <p className="mt-1 font-semibold text-white">{selectedVideo.type || "video/*"}</p>
                        </div>
                        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Tamanho</p>
                          <p className="mt-1 font-semibold text-white">{formatBytes(selectedVideo.size)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Adicionado em</p>
                          <p className="mt-1 font-semibold text-white">{formatDate(selectedVideo.createdAt)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Origem</p>
                          <p className="mt-1 font-semibold uppercase text-white">
                            {formatStorageKind(selectedVideo)} | {selectedVideo.sourceKind}
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 sm:col-span-2">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Video ref (dedupe)</p>
                          <p className="mt-1 break-all font-mono text-xs text-white">{selectedVideoRef}</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">Nenhuma aula selecionada para exibir metadados.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <aside className="hidden lg:block">{renderSidebar(false)}</aside>
        </div>
      )}

      {isSidebarMobileOpen && visibleVideos.length > 0 && (
        <div className="fixed inset-0 z-[120] lg:hidden" role="dialog" aria-modal="true">
          <button
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsSidebarMobileOpen(false)}
            type="button"
          />
          <div className="absolute bottom-0 right-0 top-0">{renderSidebar(true)}</div>
        </div>
      )}
    </div>
  );
}
