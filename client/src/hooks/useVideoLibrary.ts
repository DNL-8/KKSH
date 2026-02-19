import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
    checkPersistence,
    clearVideos,
    exportMetadata,
    importMetadata,
    listVideos,
    MAX_LIBRARY_VIDEOS,
    requestPersistentStorage,
    type SaveResult,
    type StoredVideo,
} from "../lib/localVideosStore";
import { toErrorMessage } from "../components/files/utils";
import { useFileImporter } from "./useFileImporter";
import { trackFilesTelemetry } from "../lib/filesTelemetry";
import { useLocalBridge } from "./useLocalBridge";

interface BridgeLibraryVideo {
    id?: unknown;
    name?: unknown;
    path?: unknown;
    size?: unknown;
    last_modified?: unknown;
    created_at?: unknown;
}

function toSafeNumber(value: unknown, fallback = 0): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
        return fallback;
    }
    return numeric;
}

function normalizeBridgeTimestamp(value: unknown): number {
    const numeric = toSafeNumber(value, 0);
    if (numeric <= 0) {
        return Date.now();
    }
    if (numeric > 10 ** 12) {
        return numeric;
    }
    return numeric * 1000;
}

function normalizePath(path: string): string {
    return path.replace(/\\/g, "/").replace(/\/+/g, "/").trim();
}

function deriveBridgeName(path: string, fallback = "video-bridge.mp4"): string {
    const normalized = normalizePath(path);
    if (!normalized) {
        return fallback;
    }
    const parts = normalized.split("/").filter(Boolean);
    return parts[parts.length - 1] || fallback;
}

function deriveBridgeRelativePath(path: string): string {
    const normalized = normalizePath(path);
    if (!normalized) {
        return "Biblioteca Local";
    }

    const parts = normalized.split("/").filter(Boolean);
    if (parts.length <= 1) {
        return "Biblioteca Local";
    }

    parts.pop();
    return parts.join("/") || "Biblioteca Local";
}

function summarizeImportResult(result: SaveResult): string {
    const parts: string[] = [
        `${result.processed} item(ns) processado(s)`,
        `${result.added.length} adicionado(s)`,
    ];
    if (result.ignored.length > 0) {
        parts.push(`${result.ignored.length} ignorado(s)`);
    }
    if (result.rejected.length > 0) {
        parts.push(`${result.rejected.length} rejeitado(s)`);
    }
    if (result.skippedByLimit.length > 0) {
        parts.push(`${result.skippedByLimit.length} acima do limite`);
    }
    if (result.skippedNoSpace.length > 0) {
        parts.push(`${result.skippedNoSpace.length} sem espaco`);
    }
    return `Restauracao concluida: ${parts.join(" | ")}.`;
}

function downloadJsonBackup(payload: string, fileName: string): void {
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

export function useVideoLibrary() {
    const [videos, setVideos] = useState<StoredVideo[]>([]);
    const [runtimeVideos, setRuntimeVideos] = useState<StoredVideo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [storageUnavailable, setStorageUnavailable] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [isPersisted, setIsPersisted] = useState(false);

    const { isConnected: isBridgeConnected, getLibrary: getBridgeLibrary, checkConnection } = useLocalBridge();

    const visibleVideos = useMemo(() => {
        const dedup = new Map<string, StoredVideo>();

        for (const video of videos) {
            dedup.set(video.id, video);
        }

        for (const video of runtimeVideos) {
            if (!dedup.has(video.id)) {
                dedup.set(video.id, video);
            }
        }

        return Array.from(dedup.values()).sort((left, right) => right.createdAt - left.createdAt);
    }, [runtimeVideos, videos]);

    const loadVideos = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const persisted = await checkPersistence();
            setIsPersisted(persisted);
            if (!persisted) {
                requestPersistentStorage().then(setIsPersisted).catch(() => {
                    // no-op
                });
            }

            const bridgeConnected = await checkConnection();

            let localRows: StoredVideo[] = [];
            let localLoadFailed = false;
            try {
                localRows = await listVideos();
                setStorageUnavailable(false);
            } catch (loadError) {
                localLoadFailed = true;
                setStorageUnavailable(true);
                if (!bridgeConnected) {
                    setError(toErrorMessage(loadError, "Nao foi possivel carregar a biblioteca local."));
                }
            }

            let bridgeRows: StoredVideo[] = [];
            if (bridgeConnected) {
                const bridgeData = await getBridgeLibrary();
                const bridgeItems = Array.isArray(bridgeData) ? bridgeData : [];

                bridgeRows = bridgeItems.map((raw, index) => {
                    const row = raw as BridgeLibraryVideo;
                    const bridgePath = typeof row.path === "string" ? row.path : "";
                    const fallbackName = `video-bridge-${index + 1}.mp4`;
                    const name = typeof row.name === "string" && row.name.trim().length > 0
                        ? row.name.trim()
                        : deriveBridgeName(bridgePath, fallbackName);
                    const size = toSafeNumber(row.size, 0);
                    const lastModified = normalizeBridgeTimestamp(row.last_modified ?? row.created_at);
                    const createdAt = normalizeBridgeTimestamp(row.created_at ?? row.last_modified);
                    const baseId = typeof row.id === "string" && row.id.trim().length > 0
                        ? row.id.trim()
                        : bridgePath || `${name}-${size}-${lastModified}`;

                    return {
                        id: baseId,
                        name,
                        type: "video/mp4",
                        size,
                        lastModified,
                        createdAt,
                        relativePath: deriveBridgeRelativePath(bridgePath),
                        sourceKind: "file",
                        storageKind: "bridge",
                        importSource: "input_file",
                        bridgePath,
                    } satisfies StoredVideo;
                });
            }

            const bridgeIds = new Set(bridgeRows.map((video) => video.id));
            const mergedPersisted: StoredVideo[] = [...bridgeRows];
            for (const row of localRows) {
                if (!bridgeIds.has(row.id)) {
                    mergedPersisted.push(row);
                }
            }
            mergedPersisted.sort((left, right) => right.createdAt - left.createdAt);
            setVideos(mergedPersisted);

            const persistedIds = new Set(mergedPersisted.map((video) => video.id));
            setRuntimeVideos((current) => current.filter((video) => !persistedIds.has(video.id)));

            if (localLoadFailed && bridgeConnected) {
                setStatusMessage("Biblioteca local indisponivel. Exibindo somente itens da Bridge e do modo temporario.");
            }
        } catch (loadError) {
            setError(toErrorMessage(loadError, "Erro ao carregar biblioteca."));
        } finally {
            setLoading(false);
        }
    }, [checkConnection, getBridgeLibrary]);

    useEffect(() => {
        void loadVideos();
    }, [loadVideos]);

    const mergeRuntimeVideos = useCallback(
        (incoming: StoredVideo[]) => {
            let addedCount = 0;
            let ignoredCount = 0;
            let skippedByLimitCount = 0;

            setRuntimeVideos((current) => {
                const next = [...current];
                const knownIds = new Set<string>();

                for (const video of videos) {
                    knownIds.add(video.id);
                }
                for (const video of current) {
                    knownIds.add(video.id);
                }

                for (const video of incoming) {
                    if (knownIds.has(video.id)) {
                        ignoredCount += 1;
                        continue;
                    }

                    if (knownIds.size >= MAX_LIBRARY_VIDEOS) {
                        skippedByLimitCount += 1;
                        continue;
                    }

                    next.push(video);
                    knownIds.add(video.id);
                    addedCount += 1;
                }

                next.sort((left, right) => right.createdAt - left.createdAt);
                return next;
            });

            return {
                addedCount,
                ignoredCount,
                skippedByLimitCount,
            };
        },
        [videos],
    );

    const importer = useFileImporter({
        onReload: loadVideos,
        mergeRuntimeVideos,
        setError,
        setStatusMessage,
        setStorageUnavailable,
        storageUnavailable,
    });

    const handleClearAll = async () => {
        if (!confirm("Tem certeza? Isso apagara apenas o cache do navegador. A biblioteca da Bridge (SQLite) deve ser limpa manualmente.")) {
            return;
        }

        try {
            setRuntimeVideos([]);
            await clearVideos();
            await loadVideos();
            setStatusMessage("Cache do navegador limpo.");
        } catch (clearError) {
            setError(toErrorMessage(clearError, "Falha ao limpar cache."));
        }
    };

    const handleExportMetadata = async () => {
        if (typeof window === "undefined") {
            return;
        }

        const startedAt = Date.now();
        setExporting(true);
        setError(null);
        setStatusMessage(null);

        try {
            const payload = await exportMetadata();
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const fileName = `cmd8-files-metadata-${timestamp}.json`;
            downloadJsonBackup(payload, fileName);
            setStatusMessage("Backup exportado com sucesso (metadados locais). A Bridge nao esta incluida.");
            trackFilesTelemetry("files.metadata.export.success", {
                source: "local",
                fileName,
                bytes: payload.length,
                durationMs: Date.now() - startedAt,
            });
        } catch (exportError) {
            const message = toErrorMessage(exportError, "Falha ao exportar backup de metadados.");
            setError(message);
            trackFilesTelemetry("files.metadata.export.error", {
                source: "local",
                error: message,
                durationMs: Date.now() - startedAt,
            });
        } finally {
            setExporting(false);
        }
    };

    const handleImportMetadata = async (event: ChangeEvent<HTMLInputElement>) => {
        const input = event.currentTarget;
        const selectedFile = input.files?.[0];
        input.value = "";

        if (!selectedFile) {
            return;
        }

        const startedAt = Date.now();
        setError(null);
        setStatusMessage(null);

        try {
            const payload = await selectedFile.text();
            if (!payload.trim()) {
                throw new Error("Arquivo de backup vazio.");
            }

            const result = await importMetadata(payload);
            await loadVideos();
            setStatusMessage(`${summarizeImportResult(result)} A Bridge nao foi alterada.`);
            trackFilesTelemetry("files.metadata.import.success", {
                source: "local",
                fileName: selectedFile.name,
                fileSize: selectedFile.size,
                processed: result.processed,
                added: result.added.length,
                ignored: result.ignored.length,
                rejected: result.rejected.length,
                skippedNoSpace: result.skippedNoSpace.length,
                skippedByLimit: result.skippedByLimit.length,
                durationMs: Date.now() - startedAt,
            });
        } catch (importError) {
            const message = toErrorMessage(importError, "Falha ao restaurar metadados.");
            setError(message);
            trackFilesTelemetry("files.metadata.import.error", {
                source: "local",
                fileName: selectedFile.name,
                fileSize: selectedFile.size,
                error: message,
                durationMs: Date.now() - startedAt,
            });
        }
    };

    const importInputRef = useRef<HTMLInputElement>(null);

    return {
        videos,
        runtimeVideos,
        visibleVideos,
        loading,
        error,
        statusMessage,
        storageUnavailable,
        exporting,
        isPersisted,
        isBridgeConnected,
        handleClearAll,
        handleExportMetadata,
        handleImportMetadata,
        importInputRef,
        fileInputRef: importer.fileInputRef,
        folderInputRef: importer.folderInputRef,
        setError,
        setStatusMessage,
        handleFileSelect: importer.handleFilesSelected,
        handleFolderSelect: importer.handleFolderSelected,
        saving: importer.saving,
        importProgress: importer.importProgress,
        rejectedFiles: importer.rejectedFiles,
        directoryHandleSupported: importer.directoryHandleSupported,
        highVolumeHint: importer.highVolumeHint,
        clearHighVolumeHint: importer.clearHighVolumeHint,
        triggerDirectoryConnect: importer.triggerDirectoryConnect,
        handleOpenPicker: importer.handleOpenPicker,
        handleOpenFolderPicker: importer.handleOpenFolderPicker,
        handleOpenDirectoryPicker: importer.handleOpenDirectoryPicker,
        handleFilesSelected: importer.handleFilesSelected,
        handleFolderSelected: importer.handleFolderSelected,
    };
}


