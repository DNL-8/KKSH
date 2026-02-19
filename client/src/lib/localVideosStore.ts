// Client-side wrapper for storage.worker.ts

export const LOCAL_MEDIA_DB_NAME = "cmd8_local_media";
export const LOCAL_MEDIA_DB_VERSION = 4;
export const LOCAL_MEDIA_STORE_VIDEOS = "videos";
export const LOCAL_MEDIA_STORE_CHUNKS = "chunks";

export const DEFAULT_RELATIVE_PATH = "Arquivos avulsos";
export const MAX_LIBRARY_VIDEOS = 20000;
export const HIGH_VOLUME_FOLDER_THRESHOLD = 500;

export type VideoSourceKind = "folder" | "file";
export type VideoStorageKind = "blob" | "handle" | "chunks" | "bridge";
export type VideoImportSource = "input_file" | "input_folder" | "directory_handle";

export interface StoredVideo {
  id: string;
  name: string;
  type: string;
  size: number;
  lastModified: number;
  createdAt: number;
  relativePath: string;
  sourceKind: VideoSourceKind;
  storageKind: VideoStorageKind;
  importSource: VideoImportSource;
  bridgePath?: string;
  file?: Blob;
  fileHandle?: FileSystemFileHandle;
  chunkCount?: number;
}

export interface SaveResult {
  added: StoredVideo[];
  ignored: string[];
  rejected: string[];
  skippedNoSpace: string[];
  skippedByLimit: string[];
  processed: number;
}

export class LocalMediaStorageError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export function isLocalMediaStorageError(error: unknown): error is LocalMediaStorageError {
  return error instanceof LocalMediaStorageError;
}

// Worker Singleton
let worker: Worker | null = null;
const requestMap = new Map<string, { resolve: (data: any) => void; reject: (err: any) => void; onProgress?: (c: number, t: number) => void }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./storage.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e) => {
      const { type, requestId, data, error, current, total } = e.data;
      const handler = requestMap.get(requestId);
      if (!handler) return;

      if (type === "SUCCESS") {
        handler.resolve(data);
        requestMap.delete(requestId);
      } else if (type === "ERROR") {
        handler.reject(new Error(error));
        requestMap.delete(requestId);
      } else if (type === "PROGRESS") {
        handler.onProgress?.(current, total);
      }
    };
  }
  return worker;
}

function sendToWorker<T>(
  type: string,
  payload: any = {},
  onProgress?: (current: number, total: number) => void
): Promise<T> {
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    requestMap.set(requestId, { resolve, reject, onProgress });
    getWorker().postMessage({ type, requestId, ...payload });
  });
}

// Re-exported helpers
type RelativeFile = File & { webkitRelativePath?: string };

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").trim();
}

function extractDirectoryFromRelativePath(value: string): string {
  const normalized = normalizeRelativePath(value);
  if (!normalized) return DEFAULT_RELATIVE_PATH;
  const lastSlashIndex = normalized.lastIndexOf("/");
  if (lastSlashIndex <= 0) return DEFAULT_RELATIVE_PATH;
  return normalized.slice(0, lastSlashIndex);
}

function getWebkitRelativePath(file: File): string {
  const relativeFile = file as RelativeFile;
  return typeof relativeFile.webkitRelativePath === "string" ? relativeFile.webkitRelativePath : "";
}

export function resolveRelativePath(file: File): string {
  const rawPath = getWebkitRelativePath(file);
  if (!rawPath) return DEFAULT_RELATIVE_PATH;
  return extractDirectoryFromRelativePath(rawPath);
}

export function resolveSourceKind(file: File): VideoSourceKind {
  return getWebkitRelativePath(file) ? "folder" : "file";
}

function buildVideoIdWithPath(name: string, size: number, lastModified: number, relativePath: string): string {
  return `${relativePath}::${name}-${size}-${lastModified}`;
}

export function buildVideoId(file: File): string {
  return buildVideoIdWithPath(file.name, file.size, file.lastModified, resolveRelativePath(file));
}

export function supportsDirectoryHandles(): boolean {
  if (typeof window === "undefined") return false;
  return typeof (window as Window & { showDirectoryPicker?: unknown }).showDirectoryPicker === "function";
}

function buildStoredVideoBase(
  file: File,
  relativePath: string,
  sourceKind: VideoSourceKind,
  storageKind: VideoStorageKind,
  importSource: VideoImportSource,
  createdAt = Date.now(),
): StoredVideo {
  const normalizedPath = normalizeRelativePath(relativePath) || DEFAULT_RELATIVE_PATH;
  return {
    id: buildVideoIdWithPath(file.name, file.size, file.lastModified, normalizedPath),
    name: file.name,
    type: file.type,
    size: file.size,
    lastModified: file.lastModified,
    createdAt,
    relativePath: normalizedPath,
    sourceKind,
    storageKind,
    importSource,
  };
}

export function buildStoredVideoFromFile(
  file: File,
  importSource: VideoImportSource = resolveSourceKind(file) === "folder" ? "input_folder" : "input_file",
  createdAt = Date.now(),
): StoredVideo {
  const relativePath = resolveRelativePath(file);
  return {
    ...buildStoredVideoBase(file, relativePath, resolveSourceKind(file), "blob", importSource, createdAt),
    file,
  };
}

export function buildStoredVideoFromHandle(
  file: File,
  fileHandle: FileSystemFileHandle,
  relativePath: string,
  createdAt = Date.now(),
): StoredVideo {
  return {
    ...buildStoredVideoBase(file, relativePath, "folder", "handle", "directory_handle", createdAt),
    fileHandle,
  };
}

export function buildStoredVideo(file: File, createdAt = Date.now()): StoredVideo {
  return buildStoredVideoFromFile(file, resolveSourceKind(file) === "folder" ? "input_folder" : "input_file", createdAt);
}


// Public API forwarded to Worker

export async function listVideos(): Promise<StoredVideo[]> {
  return sendToWorker<StoredVideo[]>("LIST");
}

export async function saveStoredVideos(
  rows: StoredVideo[],
  onProgress?: (current: number, total: number) => void,
): Promise<SaveResult> {
  // Can't send File handles or blobs easily if not careful, but File objects are cloneable.
  // We need to make sure we aren't sending FileSystemFileHandle if it's not supported by structured clone in all browsers?
  // Actually FileSystemFileHandle IS structured cloneable in supported browsers.
  return sendToWorker<SaveResult>("SAVE", { rows }, onProgress);
}

export async function saveVideos(
  files: File[],
  importSource: VideoImportSource = "input_file",
  onProgress?: (current: number, total: number) => void,
): Promise<SaveResult> {
  const rows: StoredVideo[] = [];
  const rejected: string[] = [];

  for (const file of files) {
    if (!file.type.startsWith("video/")) {
      rejected.push(file.name);
      continue;
    }
    const normalizedImportSource: VideoImportSource =
      importSource === "input_folder" || resolveSourceKind(file) === "folder" ? "input_folder" : "input_file";
    rows.push(buildStoredVideoFromFile(file, normalizedImportSource));
  }

  const result = await saveStoredVideos(rows, onProgress);
  result.rejected.push(...rejected);
  result.processed = files.length;
  return result;
}

export async function getFileFromVideo(video: StoredVideo): Promise<Blob | File | undefined> {
  if (video.storageKind === "chunks") {
    return sendToWorker<Blob | File>("GET_FILE", { video });
  }
  return video.fileHandle ? undefined : video.file;
}

export async function deleteVideo(id: string): Promise<void> {
  return sendToWorker("DELETE", { id });
}

export async function clearVideos(): Promise<void> {
  return sendToWorker("CLEAR");
}

export async function exportMetadata(): Promise<string> {
  const videos = await listVideos();
  const metadata = videos.map((v) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { file, fileHandle, chunkCount, ...meta } = v;
    return meta;
  });
  return JSON.stringify(metadata, null, 2);
}

export async function importMetadata(json: string): Promise<SaveResult> {
  let metadata: StoredVideo[];
  try {
    metadata = JSON.parse(json) as StoredVideo[];
  } catch {
    throw new Error("Formato JSON invalido.");
  }

  if (!Array.isArray(metadata)) {
    throw new Error("Estrutura de metadados invalida.");
  }

  const cleanVideos = metadata.map((m) => ({
    ...m,
    storageKind: "blob" as VideoStorageKind,
    bridgePath: undefined,
    file: undefined,
    fileHandle: undefined,
    chunkCount: undefined,
  }));

  return saveStoredVideos(cleanVideos);
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.persist) {
    return await navigator.storage.persist();
  }
  return false;
}

export async function checkPersistence(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.persisted) {
    return await navigator.storage.persisted();
  }
  return false;
}

// Deprecated or removed exports that might still be imported:
export function initDb() { return Promise.reject("initDb is worker-only"); }




