import { expect, test } from "@playwright/test";

test("botao de historico abre popover com novidades e aba de atividade", async ({ page }) => {
  await page.goto("/hub");

  const historyButton = page.getByTestId("top-history-button");
  await expect(historyButton).toBeVisible();
  await expect(page.getByTestId("top-history-badge")).toBeVisible();

  await historyButton.click();

  await expect(historyButton).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("history-popover")).toBeVisible();
  await expect(page.getByTestId("history-tab-changes")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("history-changes-list")).toBeVisible();
  await expect(page.getByTestId("top-history-badge")).toHaveCount(0);

  await page.getByTestId("history-tab-activity").click();
  await expect(page.getByTestId("history-login-cta")).toBeVisible();
});

test("popover de historico fecha com escape e clique fora, e estado visto persiste", async ({ page }) => {
  await page.goto("/hub");

  await page.getByTestId("top-history-button").click();
  await expect(page.getByTestId("history-popover")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("history-popover")).toHaveCount(0);

  await page.getByTestId("top-history-button").click();
  await expect(page.getByTestId("history-popover")).toBeVisible();

  await page.mouse.click(10, 10);
  await expect(page.getByTestId("history-popover")).toHaveCount(0);

  await page.reload();
  await expect(page.getByTestId("top-history-badge")).toHaveCount(0);
});

test("aba minha atividade exibe timeline combinada de sessoes e eventos XP para usuario autenticado", async ({ page }) => {
  await page.route("**/api/v1/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: "user-activity-1", email: "activity@test.com", isAdmin: false },
      }),
    });
  });

  await page.route("**/api/v1/progress", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        level: 8,
        rank: "D",
        xp: 520,
        maxXp: 1000,
        gold: 240,
        streakDays: 4,
        vitals: { hp: 96, mana: 88, fatigue: 12 },
      }),
    });
  });

  await page.route("**/api/v1/me/state", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { id: "user-activity-1", email: "activity@test.com", isAdmin: false },
        streakDays: 4,
        todayMinutes: 35,
        weekMinutes: 140,
        dueReviews: 2,
        dailyQuests: [],
        weeklyQuests: [],
        progression: { level: 8, rank: "D", xp: 520, maxXp: 1000, gold: 240 },
        vitals: { hp: 96, maxHp: 100, mana: 88, maxMana: 100, fatigue: 12, maxFatigue: 100 },
        settings: { dailyTargetMinutes: 60 },
      }),
    });
  });

  await page.route("**/api/v1/reports/weekly", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        from: "2026-02-09",
        to: "2026-02-15",
        totalMinutes: 140,
        byDay: [],
        bySubject: [{ subject: "SQL", minutes: 90 }],
        streakDays: 4,
      }),
    });
  });

  await page.route("**/api/v1/sessions**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sessions: [
          {
            id: "s-1",
            subject: "SQL",
            minutes: 25,
            mode: "review",
            notes: null,
            date: "2026-02-15",
            createdAt: "2026-02-15T12:00:00Z",
            xpEarned: 30,
            goldEarned: 6,
          },
        ],
        nextCursor: null,
      }),
    });
  });

  await page.route("**/api/v1/history/xp**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        events: [
          {
            id: "xp-1",
            eventType: "review.completed",
            sourceType: "session",
            sourceRef: "session:s-1",
            xpDelta: 30,
            goldDelta: 6,
            rulesetVersion: 1,
            createdAt: "2026-02-15T12:05:00Z",
          },
        ],
      }),
    });
  });

  await page.goto("/hub");
  await page.getByTestId("top-history-button").click();
  await page.getByTestId("history-tab-activity").click();

  await expect(page.getByTestId("history-activity-list")).toBeVisible();
  await expect(page.getByText("SQL (25 min)")).toBeVisible();
  await expect(page.getByText("XP 30 | Gold 6")).toBeVisible();
  await expect(page.getByText(/review completed/i)).toBeVisible();
  await expect(page.getByText("XP +30 | Gold +6")).toBeVisible();
});
