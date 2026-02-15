import { expect, type Page, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const sampleVideoBase64 = readFileSync("e2e/fixtures/sample-video.webm").toString("base64");

async function injectFolderVideos(page: Page): Promise<void> {
  await page.evaluate(
    ({ base64 }) => {
      const folderInput = document.querySelector('[data-testid="video-folder-input"]') as HTMLInputElement | null;
      if (!folderInput) {
        throw new Error("folder input not found");
      }

      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }

      const createFile = (relativePath: string): File => {
        const file = new File([bytes], "sample-video.webm", {
          type: "video/webm",
          lastModified: 1710000000000,
        });
        Object.defineProperty(file, "webkitRelativePath", {
          configurable: true,
          value: relativePath,
        });
        return file;
      };

      const dt = new DataTransfer();
      dt.items.add(createFile("A/sample-video.webm"));
      dt.items.add(createFile("B/sample-video.webm"));

      Object.defineProperty(folderInput, "files", {
        configurable: true,
        value: dt.files,
      });

      folderInput.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { base64: sampleVideoBase64 },
  );
}

async function injectManyFolderVideos(page: Page, total: number): Promise<void> {
  await page.evaluate(
    ({ base64, totalItems }) => {
      const folderInput = document.querySelector('[data-testid="video-folder-input"]') as HTMLInputElement | null;
      if (!folderInput) {
        throw new Error("folder input not found");
      }

      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }

      const dt = new DataTransfer();
      for (let itemIndex = 0; itemIndex < totalItems; itemIndex += 1) {
        const file = new File([bytes], `sample-${itemIndex}.webm`, {
          type: "video/webm",
          lastModified: 1710000000000 + itemIndex,
        });
        Object.defineProperty(file, "webkitRelativePath", {
          configurable: true,
          value: `A/sample-${itemIndex}.webm`,
        });
        dt.items.add(file);
      }

      Object.defineProperty(folderInput, "files", {
        configurable: true,
        value: dt.files,
      });

      folderInput.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { base64: sampleVideoBase64, totalItems: total },
  );
}

async function seedLibraryWithManyVideos(page: Page, total: number): Promise<void> {
  await page.evaluate(async (totalItems) => {
    const openDb = () =>
      new Promise<IDBDatabase>((resolve, reject) => {
        const request = window.indexedDB.open("cmd8_local_media", 4);
        request.onupgradeneeded = () => {
          const db = request.result;
          let store: IDBObjectStore;
          if (!db.objectStoreNames.contains("videos")) {
            store = db.createObjectStore("videos", { keyPath: "id" });
          } else if (request.transaction) {
            store = request.transaction.objectStore("videos");
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
          if (!db.objectStoreNames.contains("chunks")) {
            db.createObjectStore("chunks");
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("failed to open db"));
      });

    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("videos", "readwrite");
      const store = tx.objectStore("videos");
      const now = Date.now();
      for (let index = 0; index < totalItems; index += 1) {
        store.put({
          id: `Arquivos avulsos::seed-${index}.webm-1-${index}`,
          name: `seed-${index}.webm`,
          type: "video/webm",
          size: 1,
          lastModified: 1,
          createdAt: now - index,
          relativePath: "Arquivos avulsos",
          sourceKind: "file",
          storageKind: "blob",
          importSource: "input_file",
        });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("failed to seed"));
      tx.onabort = () => reject(tx.error ?? new Error("seed aborted"));
    });
    db.close();
  }, total);
}

test("modulo arquivos usa layout player + trilha + abas com drawer mobile", async ({ page }) => {
  await page.goto("/arquivos");
  await expect(page.locator("h2", { hasText: "Biblioteca de" })).toBeVisible();

  await injectFolderVideos(page);

  await expect(page.getByTestId("course-player")).toBeVisible();
  await expect(page.getByTestId("course-sidebar")).toBeVisible();
  const directoryHandleSupported = await page.evaluate(
    () => typeof (window as Window & { showDirectoryPicker?: unknown }).showDirectoryPicker === "function",
  );
  if (directoryHandleSupported) {
    await expect(page.getByTestId("connect-directory-handle")).toBeVisible();
  } else {
    await expect(page.getByTestId("connect-directory-handle")).toHaveCount(0);
  }
  await expect(page.getByTestId("toggle-order")).toBeVisible();
  await expect(page.getByTestId("toggle-order")).toContainText("Ordem: recentes");
  await page.getByTestId("toggle-order").click();
  await expect(page.getByTestId("toggle-order")).toContainText("Ordem: antigas");
  await page.getByTestId("toggle-order").click();
  await expect(page.getByTestId("toggle-order")).toContainText("Ordem: recentes");
  await expect(page.getByTestId("folder-section-a")).toBeVisible();
  await expect(page.getByTestId("folder-section-b")).toBeVisible();

  await expect(page.getByTestId("lesson-item-a-0")).toHaveAttribute("data-active", "true");
  await page.getByTestId("lesson-item-b-0").click();
  await expect(page.getByTestId("lesson-item-b-0")).toHaveAttribute("data-active", "true");

  await page.getByTestId("folder-toggle-a").click();
  await expect(page.getByTestId("lesson-item-a-0")).toHaveCount(0);
  await expect(page.getByTestId("folder-section-b")).toBeVisible();

  await page.getByTestId("tab-metadata").click();
  await expect(page.getByText("Nome do arquivo")).toBeVisible();
  await page.getByTestId("tab-overview").click();
  await expect(page.getByText("Total de videos")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("course-player")).toBeVisible();
  await expect(page.getByTestId("course-sidebar")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("sidebar-mobile-toggle")).toBeVisible();
  await page.getByTestId("sidebar-mobile-toggle").click();
  await expect(page.getByTestId("course-sidebar-mobile")).toBeVisible();
  await page.getByRole("button", { name: "Fechar" }).click();
  await expect(page.getByTestId("course-sidebar-mobile")).toHaveCount(0);

  await page.getByTestId("clear-library").click();
  await expect(page.getByText("Biblioteca vazia")).toBeVisible();
});

test("trilha lateral limita render por pasta e expande com mostrar mais", async ({ page }) => {
  await page.goto("/arquivos");
  await expect(page.locator("h2", { hasText: "Biblioteca de" })).toBeVisible();
  await injectManyFolderVideos(page, 130);

  await expect(page.getByTestId("folder-section-a")).toBeVisible();
  await expect(page.getByTestId("lesson-item-a-119")).toBeVisible();
  await expect(page.getByTestId("lesson-item-a-120")).toHaveCount(0);

  await page.getByTestId("folder-show-more-a").click();
  await expect(page.getByTestId("lesson-item-a-120")).toBeVisible();
});

test("auto-switch de pasta grande tenta conectar pasta e mostra CTA quando usuario cancela", async ({ page }) => {
  await page.addInitScript(() => {
    const state = { count: 0 };
    (window as Window & { __pickerState?: { count: number } }).__pickerState = state;
    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      writable: true,
      value: async () => {
        state.count += 1;
        throw new DOMException("cancelled", "AbortError");
      },
    });
  });

  await page.goto("/arquivos");
  await expect(page.locator("h2", { hasText: "Biblioteca de" })).toBeVisible();
  await injectManyFolderVideos(page, 500);

  await expect(page.getByTestId("high-volume-banner")).toBeVisible();
  await expect(page.getByTestId("switch-to-directory-handle")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => (window as Window & { __pickerState?: { count: number } }).__pickerState?.count ?? 0),
    )
    .toBeGreaterThan(0);

  const beforeManualClick = await page.evaluate(
    () => (window as Window & { __pickerState?: { count: number } }).__pickerState?.count ?? 0,
  );
  await page.getByTestId("switch-to-directory-handle").click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as Window & { __pickerState?: { count: number } }).__pickerState?.count ?? 0),
    )
    .toBeGreaterThan(beforeManualClick);
});

test("sem suporte a showDirectoryPicker, upload por pasta tradicional continua funcional", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      writable: true,
      value: undefined,
    });
  });

  await page.goto("/arquivos");
  await expect(page.locator("h2", { hasText: "Biblioteca de" })).toBeVisible();
  await injectManyFolderVideos(page, 520);

  await expect(page.getByTestId("high-volume-banner")).toHaveCount(0);
  await expect(page.getByTestId("course-player")).toBeVisible();
  await expect(page.getByTestId("folder-section-a")).toBeVisible();
});

test("mensagem de limite operacional reflete 20000 videos", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("/arquivos");
  await seedLibraryWithManyVideos(page, 20000);
  await page.reload();

  await expect(page.getByText("Limite operacional atingido: 20000 videos.")).toBeVisible();
});
