import { unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");

const pathsToDelete = [
  "e2e.db",
  "e2e.db-shm",
  "e2e.db-wal",
  "backend/e2e.db",
  "backend/e2e.db-shm",
  "backend/e2e.db-wal",
].map((relativePath) => resolve(repoRoot, relativePath));

for (const filePath of pathsToDelete) {
  try {
    await unlink(filePath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      continue;
    }
    throw error;
  }
}