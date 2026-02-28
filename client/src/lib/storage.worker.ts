// Web Worker for Local Video Storage
// Handles IndexedDB operations off the main thread to keep UI responsive.

// Re-defining constants here since workers react differently to imports
const LOCAL_MEDIA_DB_NAME = "cmd8_local_media";
const LOCAL_MEDIA_DB_VERSION = 4;
const LOCAL_MEDIA_STORE_VIDEOS = "videos";
const LOCAL_MEDIA_STORE_CHUNKS = "chunks";
const DEFAULT_RELATIVE_PATH = "Arquivos avulsos";
const MAX_LIBRARY_VIDEOS = 20000;
const SAVE_CHUNK_SIZE = 250;
const FILE_CHUNK_SIZE = 50 * 1024 * 1024; // 50MB chunks
const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024; // 100MB

type VideoSourceKind = "folder" | "file";
type VideoStorageKind = "blob" | "handle" | "chunks" | "bridge";
type VideoImportSource = "input_file" | "input_folder" | "directory_handle";

interface StoredVideo {
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

interface SaveResult {
    added: StoredVideo[];
    ignored: string[];
    rejected: string[];
    skippedNoSpace: string[];
    skippedByLimit: string[];
    processed: number;
}

type LocalMediaStorageErrorCode = "quota_exceeded" | "storage_unavailable" | "unknown";

class LocalMediaStorageError extends Error {
    readonly code: LocalMediaStorageErrorCode;

    constructor(code: LocalMediaStorageErrorCode, message: string) {
        super(message);
        this.name = "LocalMediaStorageError";
        this.code = code;
    }
}

// --- Utils ---

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

function buildLegacyVideoId(name: string, size: number, lastModified: number): string {
    return `${name}-${size}-${lastModified}`;
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

function toStorageError(error: unknown, fallbackMessage: string): LocalMediaStorageError {
    if (error instanceof LocalMediaStorageError) {
        return error;
    }
    if (isQuotaError(error)) {
        return new LocalMediaStorageError("quota_exceeded", "Sem espaco no navegador para salvar novos videos.");
    }
    if (error instanceof Error && error.message) {
        if (error.message.toLowerCase().includes("indisponivel")) {
            return new LocalMediaStorageError("storage_unavailable", error.message);
        }
        return new LocalMediaStorageError("unknown", error.message);
    }
    return new LocalMediaStorageError("unknown", fallbackMessage);
}

// --- IDB Core ---

async function initDb(): Promise<IDBDatabase> {
    if (!self.indexedDB) {
        throw new LocalMediaStorageError("storage_unavailable", "Persistencia local indisponivel: IndexedDB nao suportado.");
    }

    return new Promise<IDBDatabase>((resolve, reject) => {
        const request = self.indexedDB.open(LOCAL_MEDIA_DB_NAME, LOCAL_MEDIA_DB_VERSION);

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

            if (!db.objectStoreNames.contains(LOCAL_MEDIA_STORE_CHUNKS)) {
                db.createObjectStore(LOCAL_MEDIA_STORE_CHUNKS);
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
            reject(toStorageError(request.error ?? new Error("Nao foi possivel abrir o armazenamento local."), "Nao foi possivel abrir o armazenamento local."));
    });
}

// --- Operations ---

async function listVideos(): Promise<StoredVideo[]> {
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

async function putVideoWithChunks(db: IDBDatabase, video: StoredVideo): Promise<void> {
    const file = video.file;
    if (!file || video.storageKind !== "blob") {
        return putVideo(db, video);
    }

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

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkKey = `${video.id}::chunk_${i}`;

        try {
            const tx = db.transaction([LOCAL_MEDIA_STORE_CHUNKS], "readwrite");
            const store = tx.objectStore(LOCAL_MEDIA_STORE_CHUNKS);
            store.put(chunk, chunkKey);
            await transactionDone(tx);
        } catch (e) {
            console.error(`Worker: Falha ao salvar chunk ${i} do video ${video.name}`, e);
            throw e;
        }
    }

    const txMeta = db.transaction([LOCAL_MEDIA_STORE_VIDEOS], "readwrite");
    const storeMeta = txMeta.objectStore(LOCAL_MEDIA_STORE_VIDEOS);
    storeMeta.put(metadata);
    await transactionDone(txMeta);
}

async function saveStoredVideosInternal(
    db: IDBDatabase,
    rows: StoredVideo[],
    postProgress: (current: number, total: number) => void,
): Promise<SaveResult> {
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

        if (stored.size > LARGE_FILE_THRESHOLD) {
            pendingLarge.push(stored);
        } else {
            pendingSmall.push(stored);
        }

        pendingIds.add(stored.id);
    }

    // 1. Process small files
    const chunks = splitIntoChunks(pendingSmall, SAVE_CHUNK_SIZE);
    for (const chunk of chunks) {
        try {
            await putVideosChunk(db, chunk);
            for (const stored of chunk) {
                existingIds.add(stored.id);
                existingCount += 1;
                result.added.push(stored);
            }
            postProgress(result.added.length + result.ignored.length + result.rejected.length + result.skippedByLimit.length + result.skippedNoSpace.length, rows.length);
        } catch (chunkError) {
            if (!isQuotaError(chunkError)) {
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
                            console.error(`Worker: Falha ao salvar video pequeno individualmente: ${stored.name}`, itemError);
                        }
                    }
                    postProgress(result.added.length + result.ignored.length + result.rejected.length + result.skippedByLimit.length + result.skippedNoSpace.length, rows.length);
                }
                continue;
            }

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
                postProgress(result.added.length + result.ignored.length + result.rejected.length + result.skippedByLimit.length + result.skippedNoSpace.length, rows.length);
            }
        }
        await waitForUiBreath();
    }

    // 2. Process large files
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
                console.error(`Worker: Falha ao salvar video grande chunkado: ${stored.name}`, error);
            }
        }
        postProgress(result.added.length + result.ignored.length + result.rejected.length + result.skippedByLimit.length + result.skippedNoSpace.length, rows.length);
        await waitForUiBreath();
    }

    return result;
}

// --- Worker Messaging ---

type WorkerCommand =
    | { type: "SAVE"; rows: StoredVideo[]; requestId: string }
    | { type: "LIST"; requestId: string }
    | { type: "DELETE"; id: string; requestId: string }
    | { type: "CLEAR"; requestId: string }
    | { type: "GET_FILE"; video: StoredVideo; requestId: string };

self.onmessage = async (e: MessageEvent<WorkerCommand>) => {
    const { type, requestId } = e.data;

    try {
        if (type === "SAVE") {
            const db = await initDb();
            const result = await saveStoredVideosInternal(db, e.data.rows, (current, total) => {
                self.postMessage({ type: "PROGRESS", requestId, current, total });
            });
            db.close();
            self.postMessage({ type: "SUCCESS", requestId, data: result });
        } else if (type === "LIST") {
            const videos = await listVideos();
            // Important: clear file handles if sending across boundary? IDB handles are cloneable.
            self.postMessage({ type: "SUCCESS", requestId, data: videos });
        } else if (type === "DELETE") {
            // Logic for delete ... reused from main thread logic
            const db = await initDb();
            // ... transaction logic ...
            // For brevity, putting direct implementation here or call reused function
            // (Reusing deleteVideo logic here, adapted for Worker)
            const id = e.data.id;
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
            db.close();
            self.postMessage({ type: "SUCCESS", requestId });
        } else if (type === "CLEAR") {
            const db = await initDb();
            const list = [LOCAL_MEDIA_STORE_VIDEOS];
            if (db.objectStoreNames.contains(LOCAL_MEDIA_STORE_CHUNKS)) {
                list.push(LOCAL_MEDIA_STORE_CHUNKS);
            }
            const transaction = db.transaction(list, "readwrite");
            transaction.objectStore(LOCAL_MEDIA_STORE_VIDEOS).clear();
            if (db.objectStoreNames.contains(LOCAL_MEDIA_STORE_CHUNKS)) {
                transaction.objectStore(LOCAL_MEDIA_STORE_CHUNKS).clear();
            }
            await transactionDone(transaction);
            db.close();
            self.postMessage({ type: "SUCCESS", requestId });
        } else if (type === "GET_FILE") {
            const video = e.data.video;
            if (video.storageKind === "chunks" && video.chunkCount) {
                const db = await initDb();
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
                db.close();
                for (const res of results) {
                    if (!res) throw new Error("Chunk missing");
                    chunks.push(res as Blob);
                }
                const file = new File(chunks, video.name, { type: video.type, lastModified: video.lastModified });
                self.postMessage({ type: "SUCCESS", requestId, data: file });
            } else {
                self.postMessage({ type: "SUCCESS", requestId, data: video.file });
            }
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown worker error";
        self.postMessage({ type: "ERROR", requestId, error: message });
    }
};
