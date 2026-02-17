
import { useCallback, useEffect, useRef, useState } from "react";
import {
    clearVideos,
    exportMetadata,
    importMetadata,
    listVideos,
    MAX_LIBRARY_VIDEOS,
    type StoredVideo,
} from "../lib/localVideosStore";
import { toErrorMessage } from "../components/files/utils";
import { useFileImporter } from "./useFileImporter";

export function useVideoLibrary() {
    const [videos, setVideos] = useState<StoredVideo[]>([]);
    const [runtimeVideos, setRuntimeVideos] = useState<StoredVideo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [storageUnavailable, setStorageUnavailable] = useState(false);
    const [exporting, setExporting] = useState(false);

    // If storage is unavailable (e.g. Firefox private mode without persistence), use runtime videos only
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

    useEffect(() => {
        void loadVideos();
    }, [loadVideos]);

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

    const importer = useFileImporter({
        onReload: loadVideos,
        mergeRuntimeVideos,
        setError,
        setStatusMessage,
        setStorageUnavailable,
        storageUnavailable,
    });

    const handleClearAll = async () => {
        if (!confirm("Tem certeza? Isso apagara todos os videos da biblioteca local.")) {
            return;
        }

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

    const handleExportMetadata = async () => {
        setExporting(true);
        setStatusMessage(null);
        setError(null);
        try {
            const json = await exportMetadata();
            const blob = new Blob([json], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            const date = new Date().toISOString().slice(0, 10);
            a.href = url;
            a.download = `cmd8-library-backup-${date}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setStatusMessage("Backup dos metadados (JSON) exportado com sucesso.");
        } catch (e) {
            setError(toErrorMessage(e, "Falha ao exportar metadados."));
        } finally {
            setExporting(false);
        }
    };

    const handleImportMetadata = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        event.target.value = "";

        setLoading(true);
        setError(null);
        setStatusMessage(null);
        try {
            const text = await file.text();
            const result = await importMetadata(text);
            await loadVideos();
            setStatusMessage(
                `Importacao de metadados concluida: ${result.added.length} itens restaurados (arquivos precisam ser realocados se movidos).`
            );
        } catch (e) {
            setError(toErrorMessage(e, "Falha ao importar metadados. Verifique se o arquivo eh valido."));
        } finally {
            setLoading(false);
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
        handleClearAll,
        handleExportMetadata,
        handleImportMetadata,
        importInputRef,
        setError,
        setStatusMessage,
        ...importer,
    };
}
