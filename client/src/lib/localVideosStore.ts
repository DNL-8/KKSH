export const LOCAL_MEDIA_DB_NAME = "cmd8_local_media";
export const LOCAL_MEDIA_DB_VERSION = 4;
export const LOCAL_MEDIA_STORE_VIDEOS = "videos";
export const LOCAL_MEDIA_STORE_CHUNKS = "chunks";
export const DEFAULT_RELATIVE_PATH = "Arquivos avulsos";
export const MAX_LIBRARY_VIDEOS = 5000;
const SAVE_CHUNK_SIZE = 250;
const FILE_CHUNK_SIZE = 50 * 1024 * 1024; // 50MB chunks

export type VideoSourceKind = "folder" | "file";
export type VideoStorageKind = "blob" | "handle" | "chunks";
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

type RelativeFile = File & { webkitRelativePath?: string };

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
  });
}

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").trim();
}

function extractDirectoryFromRelativePath(value: string): string {
  const normalized = normalizeRelativePath(value);
  if (!normalized) {
    return DEFAULT_RELATIVE_PATH;
  }

  const lastSlashIndex = normalized.lastIndexOf("/");
  if (lastSlashIndex <= 0) {
    return DEFAULT_RELATIVE_PATH;
  }

  return normalized.slice(0, lastSlashIndex);
}

function getWebkitRelativePath(file: File): string {
  const relativeFile = file as RelativeFile;
  return typeof relativeFile.webkitRelativePath === "string" ? relativeFile.webkitRelativePath : "";
}

export function resolveRelativePath(file: File): string {
  const rawPath = getWebkitRelativePath(file);
  if (!rawPath) {
    return DEFAULT_RELATIVE_PATH;
  }

  return extractDirectoryFromRelativePath(rawPath);
}

export function resolveSourceKind(file: File): VideoSourceKind {
  return getWebkitRelativePath(file) ? "folder" : "file";
}

function buildVideoIdWithPath(name: string, size: number, lastModified: number, relativePath: string): string {
  return `${relativePath}::${name}-${size}-${lastModified}`;
}

function buildLegacyVideoId(name: string, size: number, lastModified: number): string {
  return `${name}-${size}-${lastModified}`;
}

export function buildVideoId(file: File): string {
  return buildVideoIdWithPath(file.name, file.size, file.lastModified, resolveRelativePath(file));
}

export function supportsDirectoryHandles(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
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

function ensureCompatibleRow(row: StoredVideo): StoredVideo {
  const relativePath = row.relativePath ? normalizeRelativePath(row.relativePath) || DEFAULT_RELATIVE_PATH : DEFAULT_RELATIVE_PATH;
  const sourceKind: VideoSourceKind = row.sourceKind === "folder" || row.sourceKind === "file" ? row.sourceKind : "file";
  const storageKind: VideoStorageKind = row.storageKind === "handle" || row.storageKind === "chunks" ? row.storageKind : "blob";
  const importSource: VideoImportSource =
    row.importSource === "directory_handle" || row.importSource === "input_folder" || row.importSource === "input_file"
      ? row.importSource
      : sourceKind === "folder"
        ? "input_folder"
        : "input_file";

  return {
    ...row,
    relativePath,
    sourceKind,
    storageKind,
    importSource,
  };
}

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

function toStorageError(error: unknown, fallbackMessage: string): Error {
  if (isQuotaError(error)) {
    return new Error("Sem espaco no navegador para salvar novos videos.");
  }
  if (error instanceof Error && error.message) {
    return error;
  }
  return new Error(fallbackMessage);
}

export async function initDb(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !window.indexedDB) {
    throw new Error("Persistencia local indisponivel: IndexedDB nao suportado.");
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(LOCAL_MEDIA_DB_NAME, LOCAL_MEDIA_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      const tx = request.transaction;
      let store: IDBObjectStore;

      if (!db.objectStoreNames.contains(LOCAL_MEDIA_STORE_VIDEOS)) {
        store = db.createObjectStore(LOCAL_MEDIA_STORE_VIDEOS, { keyPath: "id" });
      } else if (tx) {
        store = tx.objectStore(LOCAL_MEDIA_STORE_VIDEOS);
      } else {
        return;
      }

      if (!store.indexNames.contains("createdAt")) {
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!store.indexNames.contains("relativePath")) {
        store.createIndex("relativePath", "relativePath", { unique: false });
      }
      if (!store.indexNames.contains("storageKind")) {
        store.createIndex("storageKind", "storageKind", { unique: false });
      }

      // Create chunks store if it doesn't exist
      if (!db.objectStoreNames.contains(LOCAL_MEDIA_STORE_CHUNKS)) {
        db.createObjectStore(LOCAL_MEDIA_STORE_CHUNKS);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Nao foi possivel abrir o armazenamento local."));
  });
}

export async function listVideos(): Promise<StoredVideo[]> {
  const db = await initDb();
  try {
    const transaction = db.transaction(LOCAL_MEDIA_STORE_VIDEOS, "readonly");
    const store = transaction.objectStore(LOCAL_MEDIA_STORE_VIDEOS);
    const rows = await requestToPromise<StoredVideo[]>(store.getAll() as IDBRequest<StoredVideo[]>);
    await transactionDone(transaction);
    return rows.map(ensureCompatibleRow).sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    throw toStorageError(error, "Falha ao ler videos salvos.");
  } finally {
    db.close();
  }
}

async function loadExistingVideoIds(db: IDBDatabase): Promise<Set<string>> {
  const transaction = db.transaction(LOCAL_MEDIA_STORE_VIDEOS, "readonly");
  const store = transaction.objectStore(LOCAL_MEDIA_STORE_VIDEOS);
  const keys = await requestToPromise<IDBValidKey[]>(store.getAllKeys() as IDBRequest<IDBValidKey[]>);
  await transactionDone(transaction);
  const ids = new Set<string>();
  for (const key of keys) {
    if (typeof key === "string") {
      ids.add(key);
      continue;
    }
    ids.add(String(key));
  }
  return ids;
}

async function putVideosChunk(db: IDBDatabase, videos: StoredVideo[]): Promise<void> {
  if (videos.length === 0) {
    return;
  }
  const transaction = db.transaction(LOCAL_MEDIA_STORE_VIDEOS, "readwrite");
  const store = transaction.objectStore(LOCAL_MEDIA_STORE_VIDEOS);
  for (const video of videos) {
    store.put(video);
  }
  await transactionDone(transaction);
}

async function putVideo(db: IDBDatabase, video: StoredVideo): Promise<void> {
  await putVideosChunk(db, [video]);
}

function splitIntoChunks<T>(rows: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize));
  }
  return chunks;
}

function waitForUiBreath(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024; // 100MB

async function saveStoredVideosInternal(db: IDBDatabase, rows: StoredVideo[]): Promise<SaveResult> {
  const result: SaveResult = {
    added: [],
    ignored: [],
    rejected: [],
    skippedNoSpace: [],
    skippedByLimit: [],
    processed: rows.length,
  };

  const existingIds = await loadExistingVideoIds(db);
  let existingCount = existingIds.size;

  const pendingSmall: StoredVideo[] = [];
  const pendingLarge: StoredVideo[] = [];
  const pendingIds = new Set<string>();

  for (const row of rows) {
    const stored = ensureCompatibleRow(row);

    if (!stored.type.startsWith("video/")) {
      result.rejected.push(stored.name);
      continue;
    }

    const legacyId =
      stored.relativePath === DEFAULT_RELATIVE_PATH ? buildLegacyVideoId(stored.name, stored.size, stored.lastModified) : null;

    if (existingIds.has(stored.id) || pendingIds.has(stored.id) || (legacyId !== null && existingIds.has(legacyId))) {
      result.ignored.push(stored.name);
      continue;
    }
    if (existingCount + pendingSmall.length + pendingLarge.length >= MAX_LIBRARY_VIDEOS) {
      result.skippedByLimit.push(stored.name);
      continue;
    }

    // Separa arquivos grandes para salvar individualmente
    if (stored.size > LARGE_FILE_THRESHOLD) {
      pendingLarge.push(stored);
    } else {
      pendingSmall.push(stored);
    }

    pendingIds.add(stored.id);
  }

  // 1. Processa arquivos pequenos em lotes (transação compartilhada para performance)
  const chunks = splitIntoChunks(pendingSmall, SAVE_CHUNK_SIZE);
  for (const chunk of chunks) {
    try {
      await putVideosChunk(db, chunk);
      for (const stored of chunk) {
        existingIds.add(stored.id);
        existingCount += 1;
        result.added.push(stored);
      }
    } catch (chunkError) {
      if (!isQuotaError(chunkError)) {
        // Se não for erro de cota, tenta salvar individualmente (fallback)
        // Isso ajuda se um arquivo específico do lote estiver corrompido ou causando erro
        for (const stored of chunk) {
          try {
            await putVideo(db, stored);
            existingIds.add(stored.id);
            existingCount += 1;
            result.added.push(stored);
          } catch (itemError) {
            if (isQuotaError(itemError)) {
              result.skippedNoSpace.push(stored.name);
            } else {
              // Loga mas não para tudo, apenas marca como falha (neste caso, rejeitado ou ignorado seria impreciso,
              // mas vamos tratar como erro de storage genérico se precisar, 
              // por enquanto vamos deixar rejeitado apenas se não for video)
              console.error(`Falha ao salvar video pequeno individualmente: ${stored.name}`, itemError);
              // Opcional: Adicionar a um array de falhas se quisermos reportar ao usuário
            }
          }
        }
        continue;
      }

      // Se for erro de cota no lote, tenta um por um
      for (const stored of chunk) {
        try {
          await putVideo(db, stored);
          existingIds.add(stored.id);
          existingCount += 1;
          result.added.push(stored);
        } catch (itemError) {
          if (isQuotaError(itemError)) {
            result.skippedNoSpace.push(stored.name);
            continue;
          }
          throw toStorageError(itemError, "Falha ao salvar video local.");
        }
      }
    }
    await waitForUiBreath();
  }

  async function putVideoWithChunks(db: IDBDatabase, video: StoredVideo): Promise<void> {
    const file = video.file;
    if (!file || video.storageKind !== "blob") {
      return putVideo(db, video);
    }

    // Calculate chunks
    const chunks: Blob[] = [];
    let start = 0;
    while (start < file.size) {
      const end = Math.min(start + FILE_CHUNK_SIZE, file.size);
      chunks.push(file.slice(start, end));
      start = end;
    }

    const metadata: StoredVideo = {
      ...video,
      storageKind: "chunks",
      chunkCount: chunks.length,
      file: undefined
    };

    // 1. Save chunks individually
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkKey = `${video.id}::chunk_${i}`;

      try {
        const tx = db.transaction([LOCAL_MEDIA_STORE_CHUNKS], "readwrite");
        const store = tx.objectStore(LOCAL_MEDIA_STORE_CHUNKS);
        store.put(chunk, chunkKey);
        await transactionDone(tx);
      } catch (e) {
        console.error(`Falha ao salvar chunk ${i} do video ${video.name}`, e);
        throw e;
      }
    }

    // 2. Save metadata
    const txMeta = db.transaction([LOCAL_MEDIA_STORE_VIDEOS], "readwrite");
    const storeMeta = txMeta.objectStore(LOCAL_MEDIA_STORE_VIDEOS);
    storeMeta.put(metadata);
    await transactionDone(txMeta);
  }

  // ... existing code ...

  // 2. Processa arquivos grandes individualmente (transação isolada para evitar timeout)
  for (const stored of pendingLarge) {
    try {
      await putVideoWithChunks(db, stored);
      existingIds.add(stored.id);
      existingCount += 1;
      result.added.push(stored);
    } catch (error) {
      if (isQuotaError(error)) {
        result.skippedNoSpace.push(stored.name);
      } else {
        console.error(`Falha ao salvar video grande chunkado: ${stored.name}`, error);
      }
    }
    await waitForUiBreath();
  }

  return result;
}

export async function saveStoredVideos(rows: StoredVideo[]): Promise<SaveResult> {
  const db = await initDb();
  try {
    return await saveStoredVideosInternal(db, rows);
  } finally {
    db.close();
  }
}

export async function saveVideos(
  files: File[],
  importSource: VideoImportSource = "input_file",
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

  const db = await initDb();
  try {
    const result = await saveStoredVideosInternal(db, rows);
    result.rejected.push(...rejected);
    result.processed = files.length;
    return result;
  } finally {
    db.close();
  }
}

export async function getFileFromVideo(video: StoredVideo): Promise<Blob | File | undefined> {
  if (video.storageKind === "chunks" && video.chunkCount && video.chunkCount > 0) {
    const db = await initDb();
    try {
      const chunks: Blob[] = [];
      const ids: string[] = [];
      for (let i = 0; i < video.chunkCount; i++) {
        ids.push(`${video.id}::chunk_${i}`);
      }

      const tx = db.transaction([LOCAL_MEDIA_STORE_CHUNKS], "readonly");
      const store = tx.objectStore(LOCAL_MEDIA_STORE_CHUNKS);

      const promises = ids.map(id => requestToPromise(store.get(id)));
      const results = await Promise.all(promises);
      await transactionDone(tx);

      for (const res of results) {
        if (!res) {
          throw new Error("Partes do video corrompidas ou faltantes.");
        }
        chunks.push(res as Blob);
      }

      return new File(chunks, video.name, { type: video.type, lastModified: video.lastModified });
    } catch (error) {
      console.error("Falha ao reconstruir video:", error);
      throw error;
    } finally {
      db.close();
    }
  }

  return video.fileHandle ? undefined : video.file;
}

export async function deleteVideo(id: string): Promise<void> {
  const db = await initDb();
  try {
    const txRead = db.transaction([LOCAL_MEDIA_STORE_VIDEOS], "readonly");
    const storeRead = txRead.objectStore(LOCAL_MEDIA_STORE_VIDEOS);
    const video = await requestToPromise<StoredVideo | undefined>(storeRead.get(id));
    await transactionDone(txRead);

    if (video && video.storageKind === "chunks" && video.chunkCount) {
      const txChunks = db.transaction([LOCAL_MEDIA_STORE_CHUNKS], "readwrite");
      const storeChunks = txChunks.objectStore(LOCAL_MEDIA_STORE_CHUNKS);
      for (let i = 0; i < video.chunkCount; i++) {
        storeChunks.delete(`${video.id}::chunk_${i}`);
      }
      await transactionDone(txChunks);
    }

    const transaction = db.transaction(LOCAL_MEDIA_STORE_VIDEOS, "readwrite");
    const store = transaction.objectStore(LOCAL_MEDIA_STORE_VIDEOS);
    store.delete(id);
    await transactionDone(transaction);
  } catch (error) {
    throw toStorageError(error, "Falha ao remover video.");
  } finally {
    db.close();
  }
}

export async function clearVideos(): Promise<void> {
  const db = await initDb();
  try {
    const list = [LOCAL_MEDIA_STORE_VIDEOS];
    if (db.objectStoreNames.contains(LOCAL_MEDIA_STORE_CHUNKS)) {
      list.push(LOCAL_MEDIA_STORE_CHUNKS);
    }

    const transaction = db.transaction(list, "readwrite");
    const store = transaction.objectStore(LOCAL_MEDIA_STORE_VIDEOS);
    store.clear();

    if (db.objectStoreNames.contains(LOCAL_MEDIA_STORE_CHUNKS)) {
      const chunkStore = transaction.objectStore(LOCAL_MEDIA_STORE_CHUNKS);
      chunkStore.clear();
    }

    await transactionDone(transaction);
  } catch (error) {
    throw toStorageError(error, "Falha ao limpar biblioteca local.");
  } finally {
    db.close();
  }
}
