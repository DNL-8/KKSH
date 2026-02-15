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
      dt.items.add(createFile("SQL/Aula-1/sample-video.webm"));

      Object.defineProperty(folderInput, "files", {
        configurable: true,
        value: dt.files,
      });

      folderInput.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { base64: sampleVideoBase64 },
  );
}

test("arquivos integra login + conclusao manual + dedupe por video", async ({ page }) => {
  let authenticated = false;
  let postedSessions = 0;
  const completedVideoRefs = new Set<string>();
  let lastSessionPayload: Record<string, unknown> | null = null;

  await page.route("**/api/v1/auth/csrf", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ csrfToken: "csrf-test-token" }),
    });
  });

  await page.route("**/api/v1/me/state", async (route) => {
    if (!authenticated) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          code: "http_error",
          message: "Not authenticated",
          details: {},
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: "user-1", email: "test@example.com", isAdmin: false },
        streakDays: 5,
        progression: {
          level: 10,
          xp: 320 + completedVideoRefs.size * 15,
          maxXp: 1000,
          gold: 100 + completedVideoRefs.size * 3,
        },
        vitals: {
          hp: 98,
          maxHp: 100,
          mana: 91,
          maxMana: 100,
          fatigue: 20,
          maxFatigue: 100,
        },
      }),
    });
  });

  await page.route("**/api/v1/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: authenticated ? { id: "user-1", email: "test@example.com", isAdmin: false } : null,
      }),
    });
  });

  await page.route("**/api/v1/auth/login", async (route) => {
    authenticated = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: "user-1", email: "test@example.com", isAdmin: false },
      }),
    });
  });

  await page.route("**/api/v1/auth/logout", async (route) => {
    authenticated = false;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route("**/api/v1/sessions**", async (route) => {
    const request = route.request();
    if (request.method().toUpperCase() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sessions: Array.from(completedVideoRefs).map((ref, index) => ({
            id: `session-${index + 1}`,
            subject: "SQL",
            minutes: 1,
            mode: "video_lesson",
            notes: `video_completion::${ref}`,
            date: "2026-02-13",
            createdAt: "2026-02-13T00:00:00Z",
            xpEarned: 5,
            goldEarned: 1,
          })),
          nextCursor: null,
        }),
      });
      return;
    }

    lastSessionPayload = request.postDataJSON() as Record<string, unknown>;
    postedSessions += 1;

    const notes = String(lastSessionPayload.notes ?? "");
    const prefix = "video_completion::";
    if (notes.startsWith(prefix)) {
      completedVideoRefs.add(notes.slice(prefix.length));
    }

    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        xpEarned: 5,
        goldEarned: 1,
      }),
    });
  });

  await page.goto("/arquivos");
  await expect(page.getByTestId("files-header")).toBeVisible();
  await injectFolderVideos(page);

  await page.getByTestId("header-auth-button").click();
  await expect(page.getByTestId("shell-auth-panel")).toBeVisible();
  await page.getByTestId("shell-auth-email").fill("test@example.com");
  await page.getByTestId("shell-auth-password").fill("test123");
  await page.getByTestId("shell-auth-password").press("Enter");

  await expect(page.getByTestId("files-complete-button")).toBeVisible();
  const completeButton = page.getByTestId("complete-lesson-button");
  await expect(completeButton).toBeEnabled({ timeout: 10000 });
  await completeButton.click();

  await expect.poll(() => postedSessions).toBe(1);
  await expect(page.getByText("Concluida (+XP)")).toBeVisible();

  expect(postedSessions).toBe(1);
  expect(lastSessionPayload?.mode).toBe("video_lesson");
  expect(String(lastSessionPayload?.notes ?? "")).toContain("video_completion::");

  await expect(completeButton).toBeDisabled();
  await expect(completeButton).toContainText("Ja concluida");

  await page.reload();
  await expect(page.getByText("Concluida (+XP)")).toBeVisible();
  await expect(completeButton).toContainText("Ja concluida");
  expect(postedSessions).toBe(1);
});
