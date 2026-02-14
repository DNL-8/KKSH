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

test("hub: login + dados dinamicos + refresh atualiza missao e progresso", async ({ page }) => {
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

  await page.goto("/hub");

  await expect(page.getByRole("button", { name: /conectar para sincronizar/i })).toBeVisible();

  await page.getByRole("button", { name: /conectar para sincronizar/i }).click();
  await expect(page.getByTestId("shell-auth-panel")).toBeVisible();
  await page.getByTestId("shell-auth-email").fill("hub@example.com");
  await page.getByTestId("shell-auth-password").fill("test123");
  await page.getByTestId("shell-auth-submit").click();

  await expect(page.getByTestId("shell-auth-panel")).toHaveCount(0);
  await expect(page.getByText("Limpar backlog SQL")).toBeVisible();
  await expect(page.getByText("30/60 min")).toBeVisible();
  await expect(page.getByText("Masmorra Ativa")).toBeVisible();
  await expect(page.getByText("7 Revisoes")).toBeVisible();
  await expect(page.getByText("Fonte: MIXED")).toBeVisible();
  await expect(page.getByRole("button", { name: /protocolo treino/i })).toContainText("45/90 min");

  revision = 1;
  await page.getByRole("button", { name: /atualizar dados do hub/i }).click();

  await expect(page.getByText("Concluir sprint SQL")).toBeVisible();
  await expect(page.getByText("60/60 min")).toBeVisible();
  await expect(page.getByText("3 Revisoes")).toBeVisible();
  await expect(page.getByRole("button", { name: /protocolo treino/i })).toContainText("90/90 min");
});
