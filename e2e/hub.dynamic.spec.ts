import { expect, test } from "@playwright/test";

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildState(revision: number) {
  return {
    user: { id: "hub-user-1", email: "hub@example.com", isAdmin: false },
    onboardingDone: true,
    todayMinutes: revision === 0 ? 45 : 90,
    weekMinutes: revision === 0 ? 220 : 315,
    streakDays: revision === 0 ? 4 : 5,
    goals: {
      SQL: 180,
      Python: 120,
      Excel: 90,
      ETL: 80,
    },
    dueReviews: revision === 0 ? 7 : 3,
    dailyQuests: [
      {
        id: "quest-hub-main",
        date: todayDate(),
        subject: "SQL",
        title: revision === 0 ? "Limpar backlog SQL" : "Concluir sprint SQL",
        description: "Resolver consultas e revisar joins criticos.",
        rank: "A",
        difficulty: "hard",
        objective: revision === 0 ? "Resolver 12 consultas com joins." : "Resolver 20 consultas com joins.",
        tags: ["sql", "joins"],
        rewardXp: 120,
        rewardGold: 60,
        source: "mixed",
        generatedAt: "2026-02-14T12:00:00Z",
        targetMinutes: 60,
        progressMinutes: revision === 0 ? 30 : 60,
        claimed: false,
      },
    ],
    weeklyQuests: [],
    inventory: [],
    studyBlocks: [],
    settings: {
      dailyTargetMinutes: 90,
      pomodoroWorkMin: 25,
      pomodoroBreakMin: 5,
      timezone: "America/Sao_Paulo",
      language: "pt-BR",
      reminderEnabled: true,
      reminderTime: "20:00",
      reminderEveryMin: 5,
      xpPerMinute: 5,
      goldPerMinute: 1,
      geminiApiKey: null,
      agentPersonality: "standard",
    },
    progression: {
      level: 12,
      rank: "D",
      xp: revision === 0 ? 420 : 580,
      maxXp: 1000,
      gold: revision === 0 ? 210 : 260,
    },
    vitals: {
      hp: 96,
      maxHp: 100,
      mana: 88,
      maxMana: 100,
      fatigue: 22,
      maxFatigue: 100,
    },
  };
}

function buildWeeklyReport(revision: number) {
  return {
    from: "2026-02-08",
    to: "2026-02-14",
    totalMinutes: revision === 0 ? 220 : 315,
    byDay: [
      { date: "2026-02-08", minutes: 20 },
      { date: "2026-02-09", minutes: 30 },
      { date: "2026-02-10", minutes: 25 },
      { date: "2026-02-11", minutes: 35 },
      { date: "2026-02-12", minutes: 40 },
      { date: "2026-02-13", minutes: revision === 0 ? 30 : 70 },
      { date: "2026-02-14", minutes: 40 },
    ],
    bySubject: [
      { subject: "SQL", minutes: revision === 0 ? 130 : 180 },
      { subject: "Python", minutes: revision === 0 ? 60 : 90 },
      { subject: "Excel", minutes: 30 },
    ],
    streakDays: revision === 0 ? 4 : 5,
  };
}

test("hub: login + dados dinamicos + refresh + modal persistente", async ({ page }) => {
  let authenticated = false;
  let revision = 0;

  await page.route("**/api/v1/auth/csrf", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ csrfToken: "csrf-hub-token" }),
    });
  });

  await page.route("**/api/v1/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: authenticated ? { id: "hub-user-1", email: "hub@example.com", isAdmin: false } : null,
      }),
    });
  });

  await page.route("**/api/v1/auth/login", async (route) => {
    authenticated = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: "hub-user-1", email: "hub@example.com", isAdmin: false },
      }),
    });
  });

  await page.route("**/api/v1/me/state", async (route) => {
    if (!authenticated) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ code: "http_error", message: "Not authenticated", details: {} }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildState(revision)),
    });
  });

  await page.route("**/api/v1/reports/weekly", async (route) => {
    if (!authenticated) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ code: "http_error", message: "Not authenticated", details: {} }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildWeeklyReport(revision)),
    });
  });

  await page.goto("/hub");
  await expect(page.getByTestId("hub-connect-button")).toBeVisible();
  await page.getByTestId("hub-connect-button").click();
  await expect(page.getByTestId("shell-auth-panel")).toBeVisible();
  await page.getByTestId("shell-auth-email").fill("hub@example.com");
  await page.getByTestId("shell-auth-password").fill("test123");
  await page.getByTestId("shell-auth-submit").click();

  await expect(page.getByTestId("shell-auth-panel")).toHaveCount(0);
  await expect(page.getByTestId("hub-mission-title")).toContainText("Limpar backlog SQL");
  await expect(page.getByTestId("hub-mission-progress")).toContainText("30/60 min");
  await expect(page.getByTestId("hub-system-masmorra-value")).toContainText("7 Revisoes");
  await expect(page.getByTestId("hub-system-training-value")).toContainText("45/90 min");

  revision = 1;
  await page.getByTestId("hub-refresh-button").click();
  await expect(page.getByTestId("hub-mission-title")).toContainText("Concluir sprint SQL");
  await expect(page.getByTestId("hub-mission-progress")).toContainText("60/60 min");
  await expect(page.getByTestId("hub-system-masmorra-value")).toContainText("3 Revisoes");
  await expect(page.getByTestId("hub-system-training-value")).toContainText("90/90 min");

  await page.getByTestId("hub-attributes-edit-open").click();
  await expect(page.getByTestId("hub-attributes-modal")).toBeVisible();

  await page.getByTestId("hub-attr-python").evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = "150";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.getByTestId("hub-attr-python-value")).toContainText("100%");

  await page.getByTestId("hub-attributes-save").click();
  await expect(page.getByTestId("hub-attributes-modal")).toHaveCount(0);

  await page.reload();
  await page.getByTestId("hub-attributes-edit-open").click();
  await expect(page.getByTestId("hub-attr-python")).toHaveValue("100");
});
