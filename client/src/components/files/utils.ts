/**
 * Utility functions for the Files (Arquivos) page.
 *
 * These pure helpers were extracted from the monolithic FilesPage component
 * to improve readability and testability.
 */
import {
    DEFAULT_RELATIVE_PATH,
    MAX_LIBRARY_VIDEOS,
    type StoredVideo,
    buildStoredVideoFromHandle,
    resolveRelativePath,
    getFileFromVideo,
} from "../../lib/localVideosStore";

/* ------------------------------------------------------------------ */
/*  Path helpers                                                      */
/* ------------------------------------------------------------------ */

export function normalizePathForTestId(path: string): string {
    const normalized = path
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return normalized || "folder";
}

export function sortGroupPaths(a: string, b: string): number {
    if (a === DEFAULT_RELATIVE_PATH) {
        return b === DEFAULT_RELATIVE_PATH ? 0 : -1;
    }
    if (b === DEFAULT_RELATIVE_PATH) {
        return 1;
    }
    const naturalOrder = a.localeCompare(b, "pt-BR", { sensitivity: "base", numeric: true });
    if (naturalOrder !== 0) {
        return naturalOrder;
    }
    return a.localeCompare(b, "pt-BR", { sensitivity: "variant" });
}

export function subjectFromRelativePath(path: string): string {
    const normalized = path.replace(/\\/g, "/").trim();
    if (!normalized || normalized === DEFAULT_RELATIVE_PATH) {
        return DEFAULT_RELATIVE_PATH;
    }
    const [root] = normalized.split("/");
    const subject = (root || DEFAULT_RELATIVE_PATH).trim();
    return subject || DEFAULT_RELATIVE_PATH;
}

/* ------------------------------------------------------------------ */
/*  Formatting                                                        */
/* ------------------------------------------------------------------ */

export function formatBytes(bytes: number): string {
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

export function formatDate(timestamp: number): string {
    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(new Date(timestamp));
}

export function formatStorageKind(video: StoredVideo): string {
    if (video.storageKind === "chunks") {
        return `Local (Chunks: ${video.chunkCount ?? "?"})`;
    }
    return video.storageKind === "handle" ? "Conectado (Handle)" : "Local (Blob)";
}

/* ------------------------------------------------------------------ */
/*  Video references                                                  */
/* ------------------------------------------------------------------ */

export const VIDEO_COMPLETION_PREFIX = "video_completion::";
const VIDEO_REF_SAMPLE_BYTES = 64 * 1024;

export function buildVideoRef(video: StoredVideo): string {
    return video.id;
}

function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

function buildMetadataVideoRef(video: StoredVideo): string {
    return `v2:meta:${video.storageKind}:${video.size}:${video.lastModified}`;
}

async function partialSha256ForFile(file: File): Promise<string> {
    const size = file.size;
    const sample = VIDEO_REF_SAMPLE_BYTES;
    const middleStart = Math.max(0, Math.floor(size / 2) - Math.floor(sample / 2));
    const tailStart = Math.max(0, size - sample);

    const header = new TextEncoder().encode(`v2|${size}|${file.lastModified}|${file.type}|`);
    const material = new Blob([
        header,
        file.slice(0, Math.min(sample, size)),
        file.slice(middleStart, Math.min(size, middleStart + sample)),
        file.slice(tailStart, size),
    ]);
    const digest = await crypto.subtle.digest("SHA-256", await material.arrayBuffer());
    return bytesToHex(new Uint8Array(digest));
}

export async function resolveVideoCompletionRef(video: StoredVideo): Promise<string> {
    if (typeof crypto === "undefined" || !crypto.subtle) {
        return buildMetadataVideoRef(video);
    }

    try {
        const file = await resolvePlayableFile(video);
        const digest = await partialSha256ForFile(file);
        return `v2:sha256:${digest}`;
    } catch {
        return buildMetadataVideoRef(video);
    }
}

export function extractVideoRefFromNotes(notes: string | null | undefined): string | null {
    if (!notes || !notes.startsWith(VIDEO_COMPLETION_PREFIX)) {
        return null;
    }
    const value = notes.slice(VIDEO_COMPLETION_PREFIX.length).trim();
    return value || null;
}

/* ------------------------------------------------------------------ */
/*  Count helpers                                                     */
/* ------------------------------------------------------------------ */

export function countFoldersFromFiles(files: File[]): number {
    const folderSet = new Set<string>();
    for (const file of files) {
        if (!file.type.startsWith("video/")) {
            continue;
        }
        folderSet.add(resolveRelativePath(file));
    }
    return folderSet.size;
}

export function countFoldersFromVideos(videos: StoredVideo[]): number {
    const folderSet = new Set<string>();
    for (const video of videos) {
        folderSet.add(video.relativePath || DEFAULT_RELATIVE_PATH);
    }
    return folderSet.size;
}

/* ------------------------------------------------------------------ */
/*  Status messages                                                   */
/* ------------------------------------------------------------------ */

export function toErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
}

export function summarizeNames(names: string[]): string {
    if (names.length <= 3) {
        return names.join(", ");
    }
    const preview = names.slice(0, 3).join(", ");
    return `${preview} (+${names.length - 3})`;
}

export function buildImportStatusMessage(
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

/* ------------------------------------------------------------------ */
/*  Playable file resolution                                          */
/* ------------------------------------------------------------------ */

type FileHandlePermissionMode = "read" | "readwrite";
type FileSystemPermissionCompat = {
    queryPermission?: (descriptor?: { mode?: FileHandlePermissionMode }) => Promise<PermissionState>;
    requestPermission?: (descriptor?: { mode?: FileHandlePermissionMode }) => Promise<PermissionState>;
};

export async function resolvePlayableFile(video: StoredVideo): Promise<File> {
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

    // Try to get file from chunks or direct property
    const file = await getFileFromVideo(video);

    if (!file) {
        throw new Error("Arquivo local indisponivel para reproducao.");
    }

    if (file instanceof File) {
        return file;
    }

    return new File([file], video.name, {
        type: video.type || "video/*",
        lastModified: video.lastModified,
    });
}

/* ------------------------------------------------------------------ */
/*  Directory handle scanning                                         */
/* ------------------------------------------------------------------ */

export interface DirectoryHandleScanResult {
    videos: StoredVideo[];
    rejected: string[];
    processed: number;
}

type DirectoryHandleCompat = FileSystemDirectoryHandle & {
    entries?: () => AsyncIterable<[string, FileSystemHandle]>;
    values?: () => AsyncIterable<FileSystemHandle>;
};

export async function scanDirectoryHandle(rootHandle: FileSystemDirectoryHandle): Promise<DirectoryHandleScanResult> {
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
