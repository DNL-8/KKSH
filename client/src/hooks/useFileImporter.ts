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
      if (!directoryHandleSupported || !pickerSupportedOnWindow()) {
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
          saveToRuntimeFallback(
            scanned.videos,
            scanned.rejected,
            scanned.processed,
            folderCount,
            "Modo temporario ativo (pasta conectada)",
          );
          clearHighVolumeHint();
          return true;
        }

        const result = await saveStoredVideos(scanned.videos);
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
        return true;
      } catch (connectError) {
        if (connectError instanceof DOMException && connectError.name === "AbortError") {
          if (fromAutoSwitch) {
            setConnectHint(reason);
            setStatusMessage("Importacao de pasta grande pausada. Use Conectar pasta agora para continuar.");
          }
          return false;
        }

        if (connectError instanceof DOMException && connectError.name === "SecurityError") {
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
    setError(null);
    setStatusMessage(null);
    setRejectedFiles([]);
    try {
      await connectDirectoryFlow("manual", false);
    } finally {
      setSaving(false);
    }
  }, [connectDirectoryFlow, setError, setStatusMessage]);

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
      clearHighVolumeHint();

      if (storageUnavailable) {
        saveToRuntimeFallback(incoming, rejected, selectedFiles.length, folderCount);
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

        const result = await saveVideos(selectedFiles, importSource);
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
        setError(message);
        if (message.toLowerCase().includes("indisponivel")) {
          setStorageUnavailable(true);
          saveToRuntimeFallback(incoming, rejected, selectedFiles.length, folderCount);
        }
      } finally {
        setSaving(false);
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
