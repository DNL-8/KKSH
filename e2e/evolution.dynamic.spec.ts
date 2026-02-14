import { expect, test } from "@playwright/test";

function toIsoDate(offsetDays = 0): string {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  value.setDate(value.getDate() + offsetDays);
  return value.toISOString().slice(0, 10);
}

function buildAppState(revision: number) {
  return {
    user: { id: "user-evolution", email: "evolution@example.com", isAdmin: false },
    streakDays: revision === 0 ? 5 : 6,
    progression: {
      level: 12,
      xp: revision === 0 ? 450 : 520,
      maxXp: 1000,
      gold: revision === 0 ? 210 : 255,
    },
    vitals: {
      hp: 96,
      maxHp: 100,
      mana: 88,
      maxMana: 100,
      fatigue: 20,
      maxFatigue: 100,
    },
    settings: {
      dailyTargetMinutes: 70,
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
  };
}

function buildWeeklyReport(revision: number) {
  return {
    from: "2026-02-08",
    to: "2026-02-14",
    totalMinutes: revision === 0 ? 294 : 420,
    byDay: [
      { date: "2026-02-08", minutes: 32 },
      { date: "2026-02-09", minutes: 40 },
      { date: "2026-02-10", minutes: 38 },
      { date: "2026-02-11", minutes: 44 },
      { date: "2026-02-12", minutes: 50 },
      { date: "2026-02-13", minutes: revision === 0 ? 40 : 96 },
      { date: "2026-02-14", minutes: 50 },
    ],
    streakDays: revision === 0 ? 5 : 6,
  };
}

function buildMonthlyReport(revision: number) {
  return {
    months: [
      { month: "2026-02", minutes: revision === 0 ? 294 : 420, sessions: revision === 0 ? 3 : 4, xp: 630, gold: 126 },
      { month: "2026-01", minutes: 510, sessions: 8, xp: 900, gold: 180 },
      { month: "2025-12", minutes: 430, sessions: 7, xp: 810, gold: 162 },
      { month: "2025-11", minutes: 360, sessions: 6, xp: 720, gold: 144 },
      { month: "2025-10", minutes: 300, sessions: 5, xp: 600, gold: 120 },
      { month: "2025-09", minutes: 220, sessions: 4, xp: 440, gold: 88 },
    ],
  };
}

function buildAchievements(revision: number) {
  return [
    {
      key: "first_session",
      name: "Primeira Sessao",
      description: "Registre sua primeira sessao de estudo.",
      icon: "sparkles",
      unlocked: true,
      unlockedAt: "2026-02-01T10:00:00Z",
    },
    {
      key: "hundred_minutes",
      name: "100 Minutos",
      description: "Acumule 100 minutos estudando.",
      icon: "clock",
      unlocked: true,
      unlockedAt: "2026-02-05T10:00:00Z",
    },
    {
      key: "ten_sessions",
      name: "Ritmo de Cacador",
      description: "Complete 10 sessoes de estudo.",
      icon: "trending-up",
      unlocked: revision >= 1,
      unlockedAt: revision >= 1 ? "2026-02-14T09:00:00Z" : null,
    },
    {
      key: "streak_7",
      name: "Sequencia 7 Dias",
      description: "Mantenha uma sequencia de 7 dias.",
      icon: "flame",
      unlocked: false,
      unlockedAt: null,
    },
  ];
}

function buildSessions(revision: number) {
  const sessions = [
    {
      id: "sess-1",
      subject: "SQL",
      minutes: 50,
      mode: "pomodoro",
      notes: null,
      date: toIsoDate(-2),
      createdAt: `${toIsoDate(-2)}T13:00:00Z`,
      xpEarned: 250,
      goldEarned: 50,
    },
    {
      id: "sess-2",
      subject: "Python",
      minutes: 40,
      mode: "pomodoro",
      notes: null,
      date: toIsoDate(-1),
      createdAt: `${toIsoDate(-1)}T13:00:00Z`,
      xpEarned: 200,
      goldEarned: 40,
    },
    {
      id: "sess-3",
      subject: "Excel",
      minutes: 44,
      mode: "pomodoro",
      notes: null,
      date: toIsoDate(0),
      createdAt: `${toIsoDate(0)}T13:00:00Z`,
      xpEarned: 220,
      goldEarned: 44,
    },
  ];

  if (revision >= 1) {
    sessions.push({
      id: "sess-4",
      subject: "Data Modeling",
      minutes: 86,
      mode: "pomodoro",
      notes: null,
      date: toIsoDate(0),
      createdAt: `${toIsoDate(0)}T15:30:00Z`,
      xpEarned: 430,
      goldEarned: 86,
    });
  }

  return { sessions, nextCursor: null };
}

test("evolucao: login e atualizacao dinamica de heatmap e conquistas", async ({ page }) => {
  let authenticated = false;
  let revision = 0;

  await page.route("**/api/v1/auth/csrf", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ csrfToken: "csrf-evolution-token" }),
    });
  });

  await page.route("**/api/v1/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: authenticated
          ? { id: "user-evolution", email: "evolution@example.com", isAdmin: false }
          : null,
      }),
    });
  });

  await page.route("**/api/v1/auth/login", async (route) => {
    authenticated = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: "user-evolution", email: "evolution@example.com", isAdmin: false },
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
      body: JSON.stringify(buildAppState(revision)),
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

  await page.route("**/api/v1/reports/monthly**", async (route) => {
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
      body: JSON.stringify(buildMonthlyReport(revision)),
    });
  });

  await page.route("**/api/v1/achievements", async (route) => {
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
      body: JSON.stringify(buildAchievements(revision)),
    });
  });

  await page.route("**/api/v1/sessions**", async (route) => {
    if (route.request().method().toUpperCase() !== "GET") {
      await route.continue();
      return;
    }

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
      body: JSON.stringify(buildSessions(revision)),
    });
  });

  await page.goto("/evolucao");

  await expect(page.getByTestId("evolution-login-button")).toBeVisible();

  await page.getByTestId("evolution-login-button").click();
  await expect(page.getByTestId("shell-auth-panel")).toBeVisible();
  await page.getByTestId("shell-auth-email").fill("evolution@example.com");
  await page.getByTestId("shell-auth-password").fill("test123");
  await page.getByTestId("shell-auth-submit").click();
  await expect(page.getByTestId("shell-auth-panel")).toHaveCount(0);

  await expect(page.getByTestId("evolution-heatmap")).toBeVisible();
  await expect(page.locator('[data-testid="evolution-heatmap"] > div')).toHaveCount(119);
  await expect(page.getByTestId("evolution-achievements")).toContainText("Primeira Sessao");
  await expect(page.getByText(/Semana 60% \(294\/490 min\)/)).toBeVisible();
  await expect(page.getByText("2/4 desbloqueadas")).toBeVisible();

  revision = 1;
  await page.getByTestId("evolution-refresh").click();

  await expect(page.getByText(/Semana 86% \(420\/490 min\)/)).toBeVisible();
  await expect(page.getByText("3/4 desbloqueadas")).toBeVisible();
});
