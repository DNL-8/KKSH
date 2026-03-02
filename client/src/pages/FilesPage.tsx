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
  ensureHandleReadPermission,
  formatStorageKind,
  normalizePathForTestId,
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
import { FilesEmptyState } from "../components/files/FilesEmptyState";
import { FilesAlerts } from "../components/files/FilesAlerts";
import { useTheme } from "../contexts/ThemeContext";
import { useFilesBridgePlayer } from "../hooks/useFilesBridgePlayer";

const PLAYER_WAVEFORM_PATTERN = Array.from({ length: 60 }, (_, index) => 30 + ((index * 37) % 65));





export function FilesPage() {
  const { authUser, openAuthPanel } =
    useOutletContext<AppShellContextValue>();
  const { isIosTheme } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    showBridgeBrowser,
    bridgeVideo,
    handleBridgePlay,
    openBridgeBrowser,
    closeBridgeBrowser,
    clearBridgeVideo,
  } = useFilesBridgePlayer();

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
    reloadSelectedVideoSource,
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
    const candidate = visibleVideos.find((video) => video.id === lessonId) ?? null;
    const finalizeSelection = () => {
      setSelectedLessonId(lessonId);
      clearBridgeVideo();
      setIsSidebarMobileOpen(false);
    };

    if (!candidate || candidate.storageKind !== "handle") {
      setSelectionError(null);
      finalizeSelection();
      return;
    }

    void (async () => {
      let permissionGranted = false;
      try {
        await ensureHandleReadPermission(candidate, { requestPermissionIfNeeded: true });
        setSelectionError(null);
        permissionGranted = true;
      } catch (permissionError) {
        setSelectionError(
          permissionError instanceof Error && permissionError.message
            ? permissionError.message
            : "Permissao necessaria para reproduzir este arquivo conectado.",
        );
      } finally {
        finalizeSelection();
        if (permissionGranted && selectedLessonId === lessonId) {
          reloadSelectedVideoSource();
        }
      }
    })();
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
  const filteredVideosCount = useMemo(
    () =>
      filteredFolderSections.reduce(
        (acc, section) => acc + section.lessons.reduce((inner, lesson) => inner + (lesson.storageKind === "bridge" ? 0 : 1), 0),
        0,
      ),
    [filteredFolderSections],
  );
  const filteredCompletedCount = useMemo(
    () =>
      filteredFolderSections.reduce(
        (acc, section) =>
          acc + section.lessons.reduce((inner, lesson) => {
            if (lesson.storageKind === "bridge") {
              return inner;
            }
            return inner + (isVideoCompleted(lesson) ? 1 : 0);
          }, 0),
        0,
      ),
    [filteredFolderSections, isVideoCompleted],
  );
  const completionRate = visibleVideos.length > 0
    ? Math.round((completedLessonCount / visibleVideos.length) * 100)
    : 0;
  const filteredCompletionRate = filteredVideosCount > 0
    ? Math.round((filteredCompletedCount / filteredVideosCount) * 100)
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

  useEffect(() => {
    if (!isSidebarMobileOpen) {
      return;
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSidebarMobileOpen(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isSidebarMobileOpen]);

  return (
    <div
      className={`files-page animate-in slide-in-from-right-10 relative space-y-6 pb-20 duration-700 ${isIosTheme ? "ios26-text-secondary" : ""}`}
      data-page="files"
      data-testid="files-main-panel"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className={`pointer-events-none fixed inset-0 z-[200] m-4 md:m-8 flex items-center justify-center rounded-[40px] transition-all duration-300 ${isIosTheme
          ? "ios26-section-hero border-2 border-dashed border-[hsl(var(--accent)/0.45)]"
          : "border-4 border-dashed border-cyan-400/60 bg-[#020814]/80 backdrop-blur-xl shadow-[0_0_100px_rgba(34,211,238,0.2)_inset]"
          }`}>
            <div className="text-center animate-in zoom-in-50 duration-300 flex flex-col items-center">
              <div className="h-32 w-32 rounded-full bg-cyan-500/10 flex items-center justify-center mb-6 animate-pulse shadow-[0_0_50px_rgba(34,211,238,0.3)]">
                <Icon name="cloud-upload" className="text-7xl text-cyan-300 drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]" />
              </div>
              <h2 className="text-4xl font-black uppercase tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 to-cyan-500 drop-shadow-sm">Upload Local</h2>
              <p className="mt-3 text-cyan-200/60 font-medium tracking-widest uppercase text-sm">Solte os arquivos para processamento local</p>
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

      <div className="relative overflow-hidden pt-4 pb-2" data-testid="files-header">
        <div className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-[hsl(var(--accent)/0.03)] blur-[120px] mix-blend-screen" />
        <div className="pointer-events-none absolute bottom-0 right-20 h-64 w-64 rounded-full bg-indigo-500/5 blur-[100px] mix-blend-screen" />

        <div className="relative z-10 space-y-4">
          <div data-testid="files-toolbar-panel" className={isIosTheme ? "ios26-section" : ""}>
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
              completionRate={completionRate}
              filteredVideosCount={filteredVideosCount}
              filteredCompletionRate={filteredCompletionRate}
              onOpenPicker={handleOpenPicker}
              onOpenFolderPicker={handleOpenFolderPicker}
              onOpenDirectoryPicker={handleOpenDirectoryPicker}
              onExportMetadata={handleExportMetadata}
              onImportMetadataClick={() => importInputRef.current?.click()}
              onClearLibrary={handleClearAll}
              onOpenVisualSettings={handleOpenVisualSettings}
              onToggleMobileSidebar={() => setIsSidebarMobileOpen((o) => !o)}
            />
          </div>

          {/* Badges de Status do Sistema */}
          <div className="flex flex-wrap items-center gap-2.5 px-1 pt-2">
            {isBridgeConnected && (
              <button
                className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${isIosTheme
                  ? "ios26-chip ios26-focusable"
                  : "border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 hover:border-indigo-400/40 shadow-[0_2px_12px_rgba(99,102,241,0.1)]"
                  }`}
                aria-label="Abrir navegador Bridge"
                onClick={openBridgeBrowser}
                type="button"
              >
                <Icon name="folder-search" className="text-[12px]" />
                Abrir Bridge
              </button>
            )}

            {/* Local Bridge Indicator */}
            <div className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all ${isIosTheme
              ? isBridgeConnected ? "ios26-chip ios26-status-success" : "ios26-chip"
              : isBridgeConnected ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 files-badge-online" : "border-slate-700/60 bg-slate-800/30 text-slate-400"
              }`}>
              <div className={`w-2 h-2 rounded-full transition-colors ${isBridgeConnected ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-slate-600"}`} />
              Bridge {isBridgeConnected ? "Online" : "Offline"}
            </div>

            {/* Persistence Indicator */}
            <div className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all cursor-help ${isIosTheme
              ? isPersisted ? "ios26-chip ios26-chip-active" : "ios26-chip ios26-status-warning"
              : isPersisted ? "border-blue-500/30 bg-blue-500/10 text-blue-300" : "border-amber-500/30 bg-amber-500/10 text-amber-400"
              }`} title={isPersisted ? "Armazenamento Persistente Ativo" : "Armazenamento Temporario (pode ser limpo pelo navegador)"}>
              <div className={`w-2 h-2 rounded-full transition-colors ${isPersisted ? "bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)] animate-pulse" : "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]"}`} />
              HD {isPersisted ? "Persistente" : "Temporario"}
            </div>
          </div>
        </div>

        {/* Alertas de Sistema e Erros */}
        <FilesAlerts
          error={error}
          onClearError={handleClearError}
          storageUnavailable={storageUnavailable}
          directoryHandleSupported={directoryHandleSupported}
          highVolumeHint={highVolumeHint}
          onTriggerDirectoryConnect={() => void triggerDirectoryConnect()}
          onClearHighVolumeHint={clearHighVolumeHint}
          visibleVideosCount={visibleVideos.length}
          maxLibraryVideos={MAX_LIBRARY_VIDEOS}
          rejectedFiles={rejectedFiles}
          statusMessage={statusMessage}
        />
      </div >

      {loading || visibleVideos.length === 0 ? (
        <FilesEmptyState
          loading={loading}
          visibleCount={visibleVideos.length}
          saving={saving}
          directoryHandleSupported={directoryHandleSupported}
          highVolumeThreshold={HIGH_VOLUME_FOLDER_THRESHOLD}
          onOpenPicker={handleOpenPicker}
          onOpenFolderPicker={handleOpenFolderPicker}
          onOpenDirectoryPicker={() => void handleOpenDirectoryPicker()}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="space-y-5" data-testid="files-player">
            <div className={`group relative overflow-hidden rounded-[30px] files-scanlines ${isIosTheme ? "ios26-section-hero ios26-sheen" : "files-panel-elevated"}`} data-testid="course-player">
              <span className="files-bracket-corner" data-pos="tl" />
              <span className="files-bracket-corner" data-pos="tr" />
              <span className="files-bracket-corner" data-pos="bl" />
              <span className="files-bracket-corner" data-pos="br" />
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

            <div className={`rounded-[24px] p-5 ${isIosTheme ? "ios26-section" : "files-panel"}`}>
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <h3 className={`text-lg font-black tracking-tight leading-snug ${isIosTheme ? "text-slate-900" : "text-slate-100"}`}>{selectedVideo?.name ?? "Sem aula selecionada"}</h3>
                  <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-bold uppercase tracking-wider ${isIosTheme ? "text-slate-500" : "text-slate-400"}`}>
                    <span className="flex items-center gap-1.5">
                      <Icon name="folder-open" className="text-[11px] opacity-60" />
                      {selectedVideo?.relativePath ?? "-"}
                    </span>
                    <span className="hidden sm:inline opacity-30">|</span>
                    <span className="flex items-center gap-1.5">
                      <Icon name="device-hdd" className="text-[11px] opacity-60" />
                      {selectedVideo ? formatStorageKind(selectedVideo) : "-"}
                    </span>
                    <span className="hidden sm:inline opacity-30">|</span>
                    <span className="flex items-center gap-1.5">
                      <Icon name="clock" className="text-[11px] opacity-60" />
                      {estimatedMinutes ? `${estimatedMinutes} min` : "aguardando"}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2" data-testid="files-complete-button">
                  <button
                    className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-[10px] font-black uppercase tracking-wider transition-all ${selectedVideoCompleted
                      ? isIosTheme ? "ios26-control ios26-focusable ios26-status-success" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.1)]"
                      : isIosTheme ? "ios26-control ios26-focusable text-slate-800" : "border-cyan-400/50 bg-gradient-to-r from-cyan-600 to-cyan-500 text-slate-900 hover:brightness-110 shadow-[0_4px_20px_rgba(34,211,238,0.25)]"
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
                    className={`rounded-xl p-2 transition-colors ${isIosTheme
                      ? "ios26-control ios26-focusable text-slate-700 hover:text-slate-900"
                      : "border border-slate-700 liquid-glass text-slate-300 hover:text-slate-100"
                      }`}
                    aria-label={activeTab === "overview" ? "Abrir painel de metadados" : "Voltar para visao geral"}
                    aria-pressed={activeTab !== "overview"}
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
                className={`w-full rounded-2xl p-4 text-left transition-all group/upload ${isIosTheme
                  ? "ios26-section ios26-focusable border border-dashed border-[hsl(var(--accent)/0.45)]"
                  : "files-panel border border-dashed border-cyan-700/30 hover:border-cyan-400/40 hover:shadow-[0_0_30px_rgba(34,211,238,0.04)_inset]"
                  }`}
                data-testid="files-support-material-upload"
                onClick={handleOpenFolderPicker}
                type="button"
              >
                <div className="flex items-center gap-3">
                  <div className={`rounded-xl p-2.5 transition-colors ${isIosTheme ? "bg-[hsl(var(--accent)/0.1)]" : "border border-cyan-700/30 bg-cyan-950/40 group-hover/upload:bg-cyan-900/50"}`}>
                    <Icon name="file-video" className="text-[20px] text-cyan-200" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className={`text-sm font-bold ${isIosTheme ? "text-slate-800" : "text-slate-100"}`}>Material de Apoio</h4>
                    <p className={`text-xs leading-relaxed ${isIosTheme ? "text-slate-500" : "text-slate-400"}`}>Pastas visiveis: {currentFolderCount}. Use arquivos locais para reforcar a aula atual.</p>
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
            aria-label="Lista de aulas"
          >
            {/* Backdrop */}
            <div
              className={`absolute inset-0 transition-opacity duration-300 ${isSidebarMobileOpen ? "opacity-100" : "opacity-0"} ${isIosTheme
                ? "ios26-section"
                : "liquid-glass backdrop-blur-sm"
                }`}
              onClick={() => setIsSidebarMobileOpen(false)}
              aria-hidden="true"
            />

            {/* Sidebar Container */}
            <div
              className={`absolute bottom-0 right-0 top-0 w-[340px] max-w-[92vw] transition-transform duration-300 ease-in-out ${isSidebarMobileOpen ? "translate-x-0" : "translate-x-full"}`}
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
            onClose={closeBridgeBrowser}
            onPlayVideo={handleBridgePlay}
          />
        )
      }
    </div >
  );
}










