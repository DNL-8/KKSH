import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useOutletContext } from "react-router-dom";

import { Icon } from "../components/common/Icon";
import { BridgeBrowser } from "../components/files/BridgeBrowser";

import type { AppShellContextValue } from "../layout/types";
import { VideoPlayer } from "../components/files/VideoPlayer";
import { VideoMetadata } from "../components/files/VideoMetadata";
import { LessonSidebar } from "../components/files/LessonSidebar";
import { heightPercentClass } from "../lib/percentClasses";
import {
  formatStorageKind,
  normalizePathForTestId,
  summarizeNames,
} from "../components/files/utils";
import { type FolderSectionWithMeta, compareFolderSections, compareVideos } from "../components/files/sorting";
import { useFilesViewState } from "../hooks/useFilesViewState";
import type { FolderSection } from "../components/files/types";

import {
  DEFAULT_RELATIVE_PATH,
  HIGH_VOLUME_FOLDER_THRESHOLD,
  MAX_LIBRARY_VIDEOS,
  type StoredVideo,
} from "../lib/localVideosStore";
import { useVideoLibrary } from "../hooks/useVideoLibrary";
import { useVideoSelection } from "../hooks/useVideoSelection";
import { FilesToolbar } from "../components/files/FilesToolbar";
import { ErrorBanner } from "../components/common/ErrorBanner";
import { trackFilesTelemetry } from "../lib/filesTelemetry";

const PLAYER_WAVEFORM_PATTERN = Array.from({ length: 60 }, (_, index) => 30 + ((index * 37) % 65));

function deriveBridgeRelativePath(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/\/+/g, "/").trim();
  if (!normalized) {
    return "Bridge";
  }
  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash <= 0) {
    return "Bridge";
  }
  const parent = normalized.slice(0, lastSlash).replace(/^\/+|\/+$/g, "");
  return parent || "Bridge";
}





export function FilesPage() {
  const { authUser, openAuthPanel } =
    useOutletContext<AppShellContextValue>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Bridge Browser Logic
  const [showBridgeBrowser, setShowBridgeBrowser] = useState(false);
  const [bridgeVideo, setBridgeVideo] = useState<{ video: StoredVideo, url: string } | null>(null);

  const handleBridgePlay = (url: string, name: string, path: string) => {
    const now = Date.now();

    if (!url) {
      trackFilesTelemetry("files.bridge.play.error", {
        source: "bridge",
        name,
        path,
        error: "empty_stream_url",
      });
      return;
    }

    const mockVideo: StoredVideo = {
      id: `bridge::${path || name}`,
      name,
      relativePath: deriveBridgeRelativePath(path),
      size: 0,
      type: "video/mp4",
      lastModified: now,
      createdAt: now,
      sourceKind: "file",
      storageKind: "bridge",
      importSource: "input_file",
      bridgePath: path,
    };
    setBridgeVideo({ video: mockVideo, url });
    setShowBridgeBrowser(false);

    trackFilesTelemetry("files.bridge.play.success", {
      source: "bridge",
      name,
      path,
      trigger: "bridge_browser",
    });
  };

  const invalidateProgressCaches = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] }),
      queryClient.invalidateQueries({ queryKey: ["auth", "progress"] }),
      queryClient.invalidateQueries({ queryKey: ["hub-state"] }),
      queryClient.invalidateQueries({ queryKey: ["evolution-state"] }),
      queryClient.invalidateQueries({ queryKey: ["top-history-activity"] }),
    ]);
  }, [queryClient]);

  const [isSidebarMobileOpen, setIsSidebarMobileOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  // Defer search to keep UI responsive during typing
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const authUserId = authUser?.id ?? null;
  const {
    selectedLessonId,
    setSelectedLessonId,
    collapsedFolders,
    setCollapsedFolders,
    orderMode,
    setOrderMode,
    activeTab,
    setActiveTab,
  } = useFilesViewState(authUserId);

  const {
    visibleVideos,
    loading: libraryLoading,
    error: libraryError,
    statusMessage: libraryStatusMessage,
    storageUnavailable,
    exporting,
    handleClearAll,
    handleExportMetadata,
    handleImportMetadata,
    fileInputRef,
    folderInputRef,
    importInputRef,
    saving,
    importProgress,
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
    setError: setLibraryError,
    isPersisted,
    isBridgeConnected,
  } = useVideoLibrary();

  const folderSections = useMemo<FolderSection[]>(() => {
    const groups = new Map<string, StoredVideo[]>();

    for (const video of visibleVideos) {
      const path = video.relativePath || DEFAULT_RELATIVE_PATH;
      const current = groups.get(path) ?? [];
      current.push(video);
      groups.set(path, current);
    }

    const sections: FolderSectionWithMeta[] = Array.from(groups.entries()).map(([path, lessons]) => {
      const sortedLessons = [...lessons].sort((a, b) => compareVideos(a, b, orderMode));
      const totalSize = lessons.reduce((acc, lesson) => acc + Math.max(0, lesson.size), 0);
      const newestCreatedAt = lessons.reduce(
        (maxValue, lesson) => Math.max(maxValue, lesson.createdAt),
        Number.NEGATIVE_INFINITY,
      );
      const oldestCreatedAt = lessons.reduce(
        (minValue, lesson) => Math.min(minValue, lesson.createdAt),
        Number.POSITIVE_INFINITY,
      );

      return {
        path,
        pathId: normalizePathForTestId(path),
        lessons: sortedLessons,
        totalSize,
        newestCreatedAt,
        oldestCreatedAt,
      };
    });

    sections.sort((left, right) => compareFolderSections(left, right, orderMode));

    return sections.map(({ totalSize: _totalSize, newestCreatedAt: _newest, oldestCreatedAt: _oldest, ...section }) => section);
  }, [orderMode, visibleVideos]);

  const filteredFolderSections = useMemo<FolderSection[]>(() => {
    const query = deferredSearchTerm.trim().toLowerCase();
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
  }, [folderSections, deferredSearchTerm]);

  const filteredLessonCount = useMemo(
    () => filteredFolderSections.reduce((acc, section) => acc + section.lessons.length, 0),
    [filteredFolderSections],
  );

  const {
    selectedVideo,
    selectedVideoUrl,
    selectedDurationSec,
    setSelectedDurationSec,
    completedVideoRefs,
    loadingCompletions,
    handleCompleteLesson,
    handleVideoEnded,
    isVideoCompleted,
    resolvingSelectedVideoRef,
    completingLesson,
    selectedVideoRef,
    resolvedVideoRefsById,
    error: selectionError,
    statusMessage: selectionStatusMessage,
    setError: setSelectionError,
  } = useVideoSelection({
    visibleVideos,
    folderSections,
    selectedLessonId,
    setSelectedLessonId,
    authUser,
    openAuthPanel,
    invalidateProgressCaches,
  });

  const selectedVideoCompleted = isVideoCompleted(selectedVideo);
  const estimatedMinutes =
    selectedDurationSec && Number.isFinite(selectedDurationSec)
      ? Math.max(1, Math.ceil(selectedDurationSec / 60))
      : null;
  const error = libraryError ?? selectionError;
  const statusMessage = libraryStatusMessage ?? selectionStatusMessage;
  const loading = libraryLoading;

  const handleClearError = useCallback(() => {
    setLibraryError(null);
    setSelectionError(null);
  }, [setLibraryError, setSelectionError]);





  useEffect(() => {
    const folderInput = folderInputRef.current;
    if (!folderInput) {
      return;
    }
    folderInput.setAttribute("webkitdirectory", "");
    folderInput.setAttribute("directory", "");
  }, [folderInputRef]);



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
  }, [folderSections, loading, selectedLessonId, setSelectedLessonId, visibleVideos]);

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
  }, [folderSections, loading, setCollapsedFolders]);





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
  }, [folderSections, setCollapsedFolders]);

  const handleExpandAllFolders = useCallback(() => {
    setCollapsedFolders({});
  }, [setCollapsedFolders]);

  const handleSelectLesson = (lessonId: string) => {
    setSelectedLessonId(lessonId);
    setBridgeVideo(null);
    setIsSidebarMobileOpen(false);
  };



  const handleOpenVisualSettings = useCallback(() => {
    navigate("/config");
  }, [navigate]);

  const handleToggleMetadataPanel = useCallback(() => {
    setActiveTab((current) => (current === "overview" ? "metadata" : "overview"));
  }, [setActiveTab]);



  const completedLessonCount = useMemo(
    () => visibleVideos.reduce((acc, video) => (isVideoCompleted(video) ? acc + 1 : acc), 0),
    [isVideoCompleted, visibleVideos],
  );
  const completionRate = visibleVideos.length > 0
    ? Math.round((completedLessonCount / visibleVideos.length) * 100)
    : 0;


  const currentFolderCount = filteredFolderSections.length;

  // Drag & Drop
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected({ target: { files: e.dataTransfer.files } } as any);
    }
  }, [handleFilesSelected]);

  return (
    <div
      className="files-page animate-in slide-in-from-right-10 relative space-y-6 pb-20 duration-700"
      data-page="files"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="pointer-events-none fixed inset-0 z-[200] m-4 flex items-center justify-center rounded-3xl border-4 border-dashed border-cyan-300/50 bg-cyan-500/10 backdrop-blur-sm">
          <div className="text-center animate-bounce">
            <Icon name="upload" className="text-6xl text-cyan-400 mx-auto mb-4" />
            <h2 className="text-3xl font-black uppercase text-cyan-300">Solte arquivos aqui</h2>
          </div>
        </div>
      )}
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
      <input
        ref={importInputRef}
        accept=".json"
        className="hidden"
        onChange={(e) => void handleImportMetadata(e)}
        type="file"
      />

      <div className="files-panel-elevated relative overflow-hidden rounded-[30px] p-4 md:p-6" data-testid="files-header">
        <div className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-cyan-500/14 blur-[130px]" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-amber-500/10 blur-[130px]" />
        <div className="files-grid-overlay pointer-events-none absolute inset-0 opacity-60" />

        <div className="relative z-10 space-y-5">

          <FilesToolbar
            saving={saving}
            importProgress={importProgress}
            loading={loading}
            exporting={exporting}
            visibleVideosCount={visibleVideos.length}
            directoryHandleSupported={directoryHandleSupported}
            orderMode={orderMode}
            onOrderModeChange={setOrderMode}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            completedLessonCount={completedLessonCount}
            filteredLessonCount={filteredLessonCount}
            completionRate={completionRate}
            loadingCompletions={loadingCompletions}
            onOpenPicker={handleOpenPicker}
            onOpenFolderPicker={handleOpenFolderPicker}
            onOpenDirectoryPicker={handleOpenDirectoryPicker}
            onExportMetadata={handleExportMetadata}
            onImportMetadataClick={() => importInputRef.current?.click()}
            onClearLibrary={handleClearAll}
            onOpenVisualSettings={handleOpenVisualSettings}
            onToggleMobileSidebar={() => setIsSidebarMobileOpen(true)}
          />


          {isBridgeConnected && (
            <button
              className="files-chip border-emerald-400/45 bg-emerald-700/25 text-emerald-100 transition-colors hover:bg-emerald-700/40"
              onClick={() => setShowBridgeBrowser(true)}
            >
              <Icon name="folder-search" />
              Browse Bridge
            </button>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {/* Local Bridge Indicator */}
            <div className={`files-chip ${isBridgeConnected
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-slate-800 bg-slate-900/50 text-slate-500"
              }`}>
              <div className={`w-2 h-2 rounded-full ${isBridgeConnected ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-slate-700"}`} />
              {isBridgeConnected ? "Bridge: Online" : "Bridge: Offline"}
            </div>

            {/* Persistence Indicator */}
            <div className={`files-chip ${isPersisted
              ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
              : "border-orange-500/30 bg-orange-500/10 text-orange-400 cursor-help"
              }`} title={isPersisted ? "Armazenamento Persistente Ativo" : "Armazenamento Temporario (Pode ser limpo pelo navegador)"}>
              <div className={`w-2 h-2 rounded-full ${isPersisted ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "bg-orange-500"}`} />
              {isPersisted ? "HD: Persistente" : "HD: Temporario"}
            </div>
          </div>
        </div>

                <div className="mt-3 space-y-2">
          <ErrorBanner message={error} onClose={handleClearError} />

          {storageUnavailable && (
            <div className="files-alert files-alert-warning">
              Persistencia local indisponivel neste navegador. Os videos ficam somente nesta sessao.
            </div>
          )}

          {!directoryHandleSupported && (
            <div className="files-alert files-alert-warning flex items-start gap-3">
              <Icon name="exclamation" className="mt-0.5 text-[16px] text-amber-300" />
              <div>
                <p className="files-display mb-1 text-[10px] uppercase text-amber-200">Compatibilidade limitada (Firefox/Safari)</p>
                Seu navegador nao suporta conexao direta de pastas. Inicie o backend e use o botao <span className="font-bold text-emerald-300">BROWSE BRIDGE</span> para navegar sem limitacoes.
              </div>
            </div>
          )}

          {highVolumeHint && directoryHandleSupported && (
            <div
              className="files-alert files-alert-info"
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
            <div className="files-alert files-alert-warning">
              Limite operacional atingido: {MAX_LIBRARY_VIDEOS} videos. Remova itens para importar novos.
            </div>
          )}

          {rejectedFiles.length > 0 && (
            <div className="files-alert files-alert-warning">
              Arquivos ignorados (nao sao video): {summarizeNames(rejectedFiles)}
            </div>
          )}

          {statusMessage && (
            <div className="files-alert files-alert-success">
              {statusMessage}
            </div>
          )}

          <div className="files-alert files-alert-info flex items-start gap-3">
            <Icon name="device-hdd" className="mt-0.5 text-[16px] text-blue-200" />
            <div>
              <p className="files-display mb-1 text-[10px] uppercase text-blue-100">Persistencia de dados</p>
              A biblioteca e salva no <strong>cache do navegador</strong>. Se voce limpar os dados do site, a biblioteca sera apagada. Use <strong>Backup</strong> regularmente.
            </div>
          </div>
        </div>
      </div >

      {
        loading ? (
          <div className="files-panel flex min-h-[280px] items-center justify-center rounded-[30px]" >
            <div className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.2em] text-slate-400">
              <Icon name="spinner" className="animate-spin text-[hsl(var(--accent))] text-[20px]" />
              Carregando biblioteca local...
            </div>
          </div>
        ) : visibleVideos.length === 0 ? (
          <div className="files-panel flex min-h-[360px] flex-col items-center justify-center rounded-[30px] border border-dashed border-cyan-700/40 px-8 text-center transition-colors hover:border-cyan-400/45 hover:bg-[#061127]">
            <div className="mb-6 rounded-2xl border border-cyan-400/35 bg-cyan-500/12 p-4">
              <Icon name="cloud-upload" className="text-[hsl(var(--accent))] text-[36px]" />
            </div>
            <h3 className="text-xl font-black uppercase tracking-[0.2em] text-white">Biblioteca vazia</h3>
            <p className="mt-2 max-w-xl text-sm text-slate-500">
              Arraste e solte videos aqui ou selecione abaixo para comecar.
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
              <div className="files-panel-elevated group relative overflow-hidden rounded-[30px]" data-testid="course-player">
                <div className="pointer-events-none absolute left-0 top-0 h-8 w-8 rounded-tl-lg border-l-2 border-t-2 border-cyan-500/70" />
                <div className="pointer-events-none absolute right-0 top-0 h-8 w-8 rounded-tr-lg border-r-2 border-t-2 border-cyan-500/70" />
                <div className="pointer-events-none absolute bottom-0 left-0 h-8 w-8 rounded-bl-lg border-b-2 border-l-2 border-cyan-500/70" />
                <div className="pointer-events-none absolute bottom-0 right-0 h-8 w-8 rounded-br-lg border-b-2 border-r-2 border-cyan-500/70" />
                <VideoPlayer
                  onDurationChange={setSelectedDurationSec}
                  onEnded={handleVideoEnded}
                  video={bridgeVideo ? bridgeVideo.video : selectedVideo}
                  videoUrl={bridgeVideo ? bridgeVideo.url : selectedVideoUrl}
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

              <div className="files-panel rounded-[24px] p-4">
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
                  onToggleFolder={handleToggleFolder}
                  onSelectLesson={handleSelectLesson}
                  onCollapseAllFolders={handleCollapseAllFolders}
                  onExpandAllFolders={handleExpandAllFolders}
                  onClose={() => setIsSidebarMobileOpen(false)}
                />
                <button
                  className="files-panel w-full rounded-xl border border-dashed border-cyan-700/35 p-4 text-left transition-all hover:border-cyan-400/45 hover:bg-[#0a1a31]"
                  data-testid="files-support-material-upload"
                  onClick={handleOpenFolderPicker}
                  type="button"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg border border-cyan-700/35 bg-[#071427] p-2 text-cyan-200">
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
        )
      }

      {
        visibleVideos.length > 0 && (
          <div
            className={`fixed inset-0 z-[120] lg:hidden transition-all duration-300 ${isSidebarMobileOpen ? "visible" : "invisible pointer-events-none delay-300"}`}
            role="dialog"
            aria-modal="true"
          >
            {/* Backdrop */}
            <div
              className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${isSidebarMobileOpen ? "opacity-100" : "opacity-0"}`}
              onClick={() => setIsSidebarMobileOpen(false)}
              aria-hidden="true"
            />

            {/* Sidebar Container */}
            <div
              className={`absolute bottom-0 right-0 top-0 w-[340px] max-w-[90vw] transition-transform duration-300 ease-in-out ${isSidebarMobileOpen ? "translate-x-0" : "translate-x-full"}`}
            >
              <LessonSidebar
                folderSections={filteredFolderSections}
                selectedLessonId={selectedLessonId}
                completedVideoRefs={completedVideoRefs}
                resolvedVideoRefsById={resolvedVideoRefsById}
                collapsedFolders={collapsedFolders}
                mobile={true}
                onToggleFolder={handleToggleFolder}
                onSelectLesson={handleSelectLesson}
                onCollapseAllFolders={handleCollapseAllFolders}
                onExpandAllFolders={handleExpandAllFolders}
                onClose={() => setIsSidebarMobileOpen(false)}
              />
            </div>
          </div>
        )
      }
      {
        showBridgeBrowser && (
          <BridgeBrowser
            onClose={() => setShowBridgeBrowser(false)}
            onPlayVideo={handleBridgePlay}
          />
        )
      }
    </div >
  );
}









