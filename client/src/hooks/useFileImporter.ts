import { useRef, useState, useCallback, type ChangeEvent } from "react";
import {
    buildStoredVideoFromFile,
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

    const directoryHandleSupported = supportsDirectoryHandles();

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
        [mergeRuntimeVideos, setStatusMessage],
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
        [onReload, saveToRuntimeFallback, storageUnavailable, setError, setStatusMessage, setStorageUnavailable],
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
        handleOpenPicker,
        handleOpenFolderPicker,
        handleOpenDirectoryPicker,
        handleFilesSelected,
        handleFolderSelected,
    };
}
