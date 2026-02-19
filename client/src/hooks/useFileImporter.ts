import { useRef, useState, useCallback, type ChangeEvent } from "react";
import {
  HIGH_VOLUME_FOLDER_THRESHOLD,
  buildStoredVideoFromFile,
  isLocalMediaStorageError,
  saveStoredVideos,
  saveVideos,
  supportsDirectoryHandles,
  type StoredVideo,
  type VideoImportSource,
} from "../lib/localVideosStore";
import { trackFilesTelemetry } from "../lib/filesTelemetry";
import {
  buildImportStatusMessage,
  countFoldersFromFiles,
  countFoldersFromVideos,
  scanDirectoryHandle,
  toErrorMessage,
} from "../components/files/utils";

interface UseFileImporterProps {
  onReload: () => Promise<void>;
  mergeRuntimeVideos: (videos: StoredVideo[]) => {
    addedCount: number;
    ignoredCount: number;
    skippedByLimitCount: number;
  };
  setError: (error: string | null) => void;
  setStatusMessage: (message: string | null) => void;
  setStorageUnavailable: (unavailable: boolean) => void;
  storageUnavailable: boolean;
}

type ConnectReason = "manual" | "high_volume" | "quota";

function pickerSupportedOnWindow(): boolean {
  return typeof (window as Window & { showDirectoryPicker?: unknown }).showDirectoryPicker === "function";
}

export function useFileImporter({
  onReload,
  mergeRuntimeVideos,
  setError,
  setStatusMessage,
  setStorageUnavailable,
  storageUnavailable,
}: UseFileImporterProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const [saving, setSaving] = useState(false);
  const [importProgress, setImportProgress] = useState<{ processed: number; total: number } | null>(null);
  const [rejectedFiles, setRejectedFiles] = useState<string[]>([]);
  const [highVolumeHint, setHighVolumeHint] = useState<string | null>(null);

  const directoryHandleSupported = supportsDirectoryHandles();

  const clearHighVolumeHint = useCallback(() => {
    setHighVolumeHint(null);
  }, []);

  const saveToRuntimeFallback = useCallback(
    (
      incoming: StoredVideo[],
      rejected: string[],
      processed: number,
      folderCount: number,
      prefix = "Modo temporario ativo",
    ) => {
      const { addedCount, ignoredCount, skippedByLimitCount } = mergeRuntimeVideos(incoming);
      setRejectedFiles(rejected);
      if (incoming.length === 0) {
        setStatusMessage("Nenhum video valido selecionado.");
        return {
          addedCount,
          ignoredCount,
          skippedByLimitCount,
        };
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

      return {
        addedCount,
        ignoredCount,
        skippedByLimitCount,
      };
    },
    [mergeRuntimeVideos, setStatusMessage],
  );

  const setConnectHint = useCallback((reason: ConnectReason, fileCount?: number) => {
    if (reason === "quota") {
      setHighVolumeHint(
        "Sem espaco local para copiar videos em massa. Use Conectar pasta agora para importacao de alto volume.",
      );
      return;
    }
    if (reason === "high_volume") {
      const suffix = typeof fileCount === "number" ? ` (${fileCount} arquivos detectados)` : "";
      setHighVolumeHint(
        `Pasta grande detectada${suffix}. Use Conectar pasta agora para evitar limite de armazenamento local.`,
      );
      return;
    }
    setHighVolumeHint("Use Conectar pasta agora para modo de alto volume.");
  }, []);

  const connectDirectoryFlow = useCallback(
    async (reason: ConnectReason, fromAutoSwitch: boolean): Promise<boolean> => {
      const startedAt = Date.now();
      trackFilesTelemetry("files.import.start", {
        source: "local",
        importSource: "directory_handle",
        reason,
        fromAutoSwitch,
      });

      if (!directoryHandleSupported || !pickerSupportedOnWindow()) {
        trackFilesTelemetry("files.import.error", {
          source: "local",
          importSource: "directory_handle",
          reason,
          error: "directory_handle_unsupported",
          durationMs: Date.now() - startedAt,
        });
        if (!fromAutoSwitch) {
          setStatusMessage(
            "Seu navegador nao suporta Conectar pasta. Abrindo carregamento de pasta tradicional.",
          );
          folderInputRef.current?.click();
        }
        return false;
      }

      const pickerWindow = window as Window & {
        showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
      };

      try {
        const rootHandle = await pickerWindow.showDirectoryPicker!();
        const scanned = await scanDirectoryHandle(rootHandle);
        const folderCount = countFoldersFromVideos(scanned.videos);

        if (storageUnavailable) {
          const fallbackResult = saveToRuntimeFallback(
            scanned.videos,
            scanned.rejected,
            scanned.processed,
            folderCount,
            "Modo temporario ativo (pasta conectada)",
          );
          clearHighVolumeHint();

          trackFilesTelemetry("files.import.success", {
            source: "runtime",
            importSource: "directory_handle",
            reason,
            added: fallbackResult.addedCount,
            ignored: fallbackResult.ignoredCount,
            rejected: scanned.rejected.length,
            skippedByLimit: fallbackResult.skippedByLimitCount,
            skippedNoSpace: 0,
            folderCount,
            processed: scanned.processed,
            durationMs: Date.now() - startedAt,
          });
          return true;
        }

        const result = await saveStoredVideos(scanned.videos, (processed, total) => {
          setImportProgress({ processed, total });
        });
        await onReload();
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
        clearHighVolumeHint();

        trackFilesTelemetry("files.import.success", {
          source: "local",
          importSource: "directory_handle",
          reason,
          added: result.added.length,
          ignored: result.ignored.length,
          rejected: scanned.rejected.length,
          skippedNoSpace: result.skippedNoSpace.length,
          skippedByLimit: result.skippedByLimit.length,
          folderCount,
          processed: scanned.processed,
          durationMs: Date.now() - startedAt,
        });
        return true;
      } catch (connectError) {
        if (connectError instanceof DOMException && connectError.name === "AbortError") {
          trackFilesTelemetry("files.import.error", {
            source: "local",
            importSource: "directory_handle",
            reason,
            error: "aborted_by_user",
            durationMs: Date.now() - startedAt,
          });
          if (fromAutoSwitch) {
            setConnectHint(reason);
            setStatusMessage("Importacao de pasta grande pausada. Use Conectar pasta agora para continuar.");
          }
          return false;
        }

        if (connectError instanceof DOMException && connectError.name === "SecurityError") {
          trackFilesTelemetry("files.import.error", {
            source: "local",
            importSource: "directory_handle",
            reason,
            error: "security_error",
            durationMs: Date.now() - startedAt,
          });
          if (fromAutoSwitch) {
            setConnectHint(reason);
          } else {
            setStatusMessage(
              "Conectar pasta exige contexto seguro. Usando carregamento de pasta tradicional.",
            );
            folderInputRef.current?.click();
          }
          return false;
        }

        if (isLocalMediaStorageError(connectError) && connectError.code === "quota_exceeded") {
          setConnectHint("quota");
        }

        const message = toErrorMessage(connectError, "Falha ao conectar pasta.");
        trackFilesTelemetry("files.import.error", {
          source: "local",
          importSource: "directory_handle",
          reason,
          error: message,
          durationMs: Date.now() - startedAt,
        });
        setError(message);

        if (message.toLowerCase().includes("indisponivel")) {
          setStorageUnavailable(true);
        }
        return false;
      }
    },
    [
      clearHighVolumeHint,
      directoryHandleSupported,
      onReload,
      saveToRuntimeFallback,
      setConnectHint,
      setError,
      setStatusMessage,
      setStorageUnavailable,
      storageUnavailable,
    ],
  );

  const triggerDirectoryConnect = useCallback(async () => {
    setSaving(true);
    setImportProgress(null);
    setError(null);
    setStatusMessage(null);
    setRejectedFiles([]);
    try {
      await connectDirectoryFlow("manual", false);
    } finally {
      setSaving(false);
      setImportProgress(null);
    }
  }, [connectDirectoryFlow, setError, setStatusMessage]);

  const processSelectedFiles = useCallback(
    async (selectedFiles: File[], importSource: VideoImportSource) => {
      if (selectedFiles.length === 0) {
        return;
      }

      const startedAt = Date.now();
      const validVideos = selectedFiles.filter((file) => file.type.startsWith("video/"));
      const rejected = selectedFiles.filter((file) => !file.type.startsWith("video/")).map((file) => file.name);
      const incoming = validVideos.map((file) => buildStoredVideoFromFile(file, importSource));
      const folderCount = countFoldersFromFiles(selectedFiles);

      trackFilesTelemetry("files.import.start", {
        source: "local",
        importSource,
        selected: selectedFiles.length,
        validVideos: validVideos.length,
        rejected: rejected.length,
      });

      setSaving(true);
      setImportProgress(null);
      setError(null);
      setStatusMessage(null);
      setRejectedFiles([]);
      clearHighVolumeHint();

      if (storageUnavailable) {
        const fallbackResult = saveToRuntimeFallback(incoming, rejected, selectedFiles.length, folderCount);
        trackFilesTelemetry("files.import.success", {
          source: "runtime",
          importSource,
          added: fallbackResult.addedCount,
          ignored: fallbackResult.ignoredCount,
          rejected: rejected.length,
          skippedByLimit: fallbackResult.skippedByLimitCount,
          skippedNoSpace: 0,
          folderCount,
          processed: selectedFiles.length,
          durationMs: Date.now() - startedAt,
        });
        setSaving(false);
        return;
      }

      try {
        const shouldAutoSwitchToDirectory =
          importSource === "input_folder" &&
          directoryHandleSupported &&
          selectedFiles.length >= HIGH_VOLUME_FOLDER_THRESHOLD;

        if (shouldAutoSwitchToDirectory) {
          setConnectHint("high_volume", selectedFiles.length);
          const switched = await connectDirectoryFlow("high_volume", true);
          if (!switched) {
            setStatusMessage(
              `Pasta grande detectada (${selectedFiles.length} arquivos). Recomendado: Conectar pasta agora.`,
            );
          }
          return;
        }

        const result = await saveVideos(selectedFiles, importSource, (processed, total) => {
          setImportProgress({ processed, total });
        });
        await onReload();
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

        trackFilesTelemetry("files.import.success", {
          source: "local",
          importSource,
          added: result.added.length,
          ignored: result.ignored.length,
          rejected: result.rejected.length,
          skippedNoSpace: result.skippedNoSpace.length,
          skippedByLimit: result.skippedByLimit.length,
          folderCount,
          processed: result.processed,
          durationMs: Date.now() - startedAt,
        });
      } catch (saveError) {
        const shouldRetryWithDirectory =
          importSource === "input_folder" &&
          directoryHandleSupported &&
          isLocalMediaStorageError(saveError) &&
          saveError.code === "quota_exceeded";

        if (shouldRetryWithDirectory) {
          setConnectHint("quota");
          const switched = await connectDirectoryFlow("quota", true);
          if (switched) {
            return;
          }
        }

        const message = toErrorMessage(saveError, "Falha ao salvar videos.");
        trackFilesTelemetry("files.import.error", {
          source: "local",
          importSource,
          selected: selectedFiles.length,
          validVideos: validVideos.length,
          rejected: rejected.length,
          error: message,
          durationMs: Date.now() - startedAt,
        });
        setError(message);
        if (message.toLowerCase().includes("indisponivel")) {
          setStorageUnavailable(true);
          const fallbackResult = saveToRuntimeFallback(incoming, rejected, selectedFiles.length, folderCount);
          trackFilesTelemetry("files.import.success", {
            source: "runtime",
            importSource,
            added: fallbackResult.addedCount,
            ignored: fallbackResult.ignoredCount,
            rejected: rejected.length,
            skippedByLimit: fallbackResult.skippedByLimitCount,
            skippedNoSpace: 0,
            folderCount,
            processed: selectedFiles.length,
            durationMs: Date.now() - startedAt,
          });
        }
      } finally {
        setSaving(false);
        setImportProgress(null);
      }
    },
    [
      clearHighVolumeHint,
      connectDirectoryFlow,
      directoryHandleSupported,
      onReload,
      saveToRuntimeFallback,
      setConnectHint,
      setError,
      setStatusMessage,
      setStorageUnavailable,
      storageUnavailable,
    ],
  );

  const handleOpenPicker = () => {
    fileInputRef.current?.click();
  };

  const handleOpenFolderPicker = () => {
    folderInputRef.current?.click();
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

  return {
    fileInputRef,
    folderInputRef,
    saving,
    importProgress,
    rejectedFiles,
    directoryHandleSupported,
    highVolumeHint,
    clearHighVolumeHint,
    handleOpenPicker,
    handleOpenFolderPicker,
    handleOpenDirectoryPicker: triggerDirectoryConnect,
    triggerDirectoryConnect,
    handleFilesSelected,
    handleFolderSelected,
  };
}