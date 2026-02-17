import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useOutletContext } from "react-router-dom";

import { Icon } from "../components/common/Icon";
import { BridgeBrowser } from "../components/files/BridgeBrowser";

import type { AppShellContextValue } from "../layout/types";
import { VideoPlayer } from "../components/files/VideoPlayer";
import { VideoMetadata } from "../components/files/VideoMetadata";
import { LessonSidebar, LESSONS_VISIBLE_DEFAULT, LESSONS_VISIBLE_INCREMENT } from "../components/files/LessonSidebar";
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
import { useLocalBridge } from "../hooks/useLocalBridge";

const PLAYER_WAVEFORM_PATTERN = Array.from({ length: 60 }, (_, index) => 30 + ((index * 37) % 65));

import { FilesHeader } from "../components/files/FilesHeader";
import { FilesToolbar } from "../components/files/FilesToolbar";
import { ErrorBanner } from "../components/common/ErrorBanner";




export function FilesPage() {
  const { globalStats, authUser, openAuthPanel } =
    useOutletContext<AppShellContextValue>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Bridge Integration
  const {
    isConnected: isBridgeConnected,
    checkConnection: checkBridgeConnection
  } = useLocalBridge();

  useEffect(() => {
    checkBridgeConnection();
  }, [checkBridgeConnection]);

  // Bridge Browser Logic
  const [showBridgeBrowser, setShowBridgeBrowser] = useState(false);
  const [bridgeVideo, setBridgeVideo] = useState<{ video: StoredVideo, url: string } | null>(null);

  const handleBridgePlay = (url: string, name: string, path: string) => {
    const mockVideo: StoredVideo = {
      id: `bridge-${path}`,
      name: name,
      relativePath: path.substring(0, path.lastIndexOf(name) - 1) || "Bridge",
      size: 0,
      type: "video/mp4",
      lastModified: Date.now(),
      createdAt: Date.now(),
      sourceKind: "file",
      storageKind: "bridge",
      importSource: "input_file",
    };
    setBridgeVideo({ video: mockVideo, url });
    setShowBridgeBrowser(false);
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

  const authUserId = authUser?.id ?? null;
  const {
    selectedLessonId,
    setSelectedLessonId,
    collapsedFolders,
    setCollapsedFolders,
    visibleCountByFolder,
    setVisibleCountByFolder,
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
      <input
        ref={importInputRef}
        accept=".json"
        className="hidden"
        onChange={(e) => void handleImportMetadata(e)}
        type="file"
      />

      <div className="relative overflow-hidden rounded-[30px] border border-slate-800 bg-[#090b10]/90 p-4 md:p-6" data-testid="files-header">
        <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-cyan-900/10 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-violet-900/10 blur-[120px]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.04)_1px,transparent_1px)] bg-[size:36px_36px]" />

        <div className="relative z-10 space-y-4">
          <FilesHeader globalStats={globalStats} />

          <FilesToolbar
            saving={saving}
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
              className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-600/20 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-400 transition-colors hover:bg-emerald-600/30 mr-3"
              onClick={() => setShowBridgeBrowser(true)}
            >
              <Icon name="folder-search" />
              Browse Bridge
            </button>
          )}

          {/* Local Bridge Indicator */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wider w-fit ml-auto ${isBridgeConnected
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            : "border-slate-800 bg-slate-900/50 text-slate-500"
            }`}>
            <div className={`w-2 h-2 rounded-full ${isBridgeConnected ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-slate-700"}`} />
            {isBridgeConnected ? "Bridge: Online" : "Bridge: Offline"}
          </div>
        </div>

        {storageUnavailable && (
          <div className="mt-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs font-semibold text-yellow-300">
            Persistencia local indisponivel neste navegador. Os videos ficam somente nesta sessao.
          </div>
        )}

        {
          !directoryHandleSupported && (
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 text-xs font-medium text-orange-200">
              <Icon name="exclamation" className="text-orange-400 text-[18px]" />
              <div>
                <p className="font-bold text-orange-300 uppercase tracking-wide text-[10px] mb-1">Compatibilidade Limitada</p>
                Seu navegador nao suporta a API de Acesso ao Sistema de Arquivos (padrao em Chrome/Edge).
                A opcao <strong>Carregar pasta</strong> copiara os arquivos para o navegador, o que pode lotar o armazenamento rapido.
                Recomendamos importar poucas pastas por vez.
              </div>
            </div>
          )
        }

        <div className="mt-3 flex items-center gap-3 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-xs font-medium text-blue-200">
          <Icon name="device-hdd" className="text-blue-400 text-[18px]" />
          <div>
            <p className="font-bold text-blue-300 uppercase tracking-wide text-[10px] mb-1">Persistencia de Dados</p>
            A biblioteca e salva no <strong>cache do navegador</strong>. Se voce limpar os dados do site ou o cache, a biblioteca sera apagada.
            Use o botao <strong>Backup</strong> acima para salvar seus metadados regularmente.
          </div>
        </div>

        {
          highVolumeHint && directoryHandleSupported && (
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
          )
        }

        {
          visibleVideos.length >= MAX_LIBRARY_VIDEOS && (
            <div className="mt-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3 text-xs font-semibold text-indigo-200">
              Limite operacional atingido: {MAX_LIBRARY_VIDEOS} videos. Remova itens para importar novos.
            </div>
          )
        }

        {
          statusMessage && (
            <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-300">
              {statusMessage}
            </div>
          )
        }

        {
          rejectedFiles.length > 0 && (
            <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-semibold text-amber-200">
              Arquivos ignorados (nao sao video): {summarizeNames(rejectedFiles)}
            </div>
          )
        }

        <div className="mt-3">
          <ErrorBanner message={error} onClose={handleClearError} />
        </div>
      </div >

      {
        loading ? (
          <div className="flex min-h-[280px] items-center justify-center rounded-[30px] border border-slate-800 bg-[#0a0a0b]/60" >
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
        )
      }

      {
        isSidebarMobileOpen && visibleVideos.length > 0 && (
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
