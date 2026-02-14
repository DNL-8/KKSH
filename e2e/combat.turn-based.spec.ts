import { expect, type Page, test } from "@playwright/test";

interface QuestionMeta {
  correctIndex: number;
  damage: number;
}

const BASIC_BOUNDS = { minDamage: 15, maxDamage: 20 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getQuestionMeta(questionText: string): QuestionMeta {
  const normalized = normalizeText(questionText);

  if (normalized.includes("atalho") && normalized.includes("coluna")) {
    return { correctIndex: 0, damage: 15 };
  }
  if (normalized.includes("simbolo") && normalized.includes("excel")) {
    return { correctIndex: 2, damage: 15 };
  }
  if (normalized.includes("fixar") && normalized.includes("referencia absoluta")) {
    return { correctIndex: 1, damage: 20 };
  }
  if (normalized.includes("linguagem") && normalized.includes("power query")) {
    return { correctIndex: 2, damage: 120 };
  }
  if (normalized.includes("unpivot")) {
    return { correctIndex: 1, damage: 130 };
  }
  if (normalized.includes("ferramenta de")) {
    return { correctIndex: 1, damage: 100 };
  }

  throw new Error(`Pergunta nao reconhecida: ${questionText}`);
}

function getExpectedPlayerDamageRange(questionDamage: number, bossMaxHp: number): { min: number; max: number } {
  const spread = Math.max(1, BASIC_BOUNDS.maxDamage - BASIC_BOUNDS.minDamage);
  const normalized = clamp((questionDamage - BASIC_BOUNDS.minDamage) / spread, 0, 1);
  const basePercent = 0.08 + normalized * 0.06;
  const minPercent = clamp(basePercent * 0.8, 0.05, 0.18);
  const maxPercent = clamp(basePercent * 1.2, 0.05, 0.18);
  const minDamage = Math.max(1, Math.round(bossMaxHp * minPercent));
  const maxDamage = Math.max(1, Math.round(bossMaxHp * maxPercent));
  return { min: Math.min(minDamage, maxDamage), max: Math.max(minDamage, maxDamage) };
}

async function readHp(page: Page, testId: string): Promise<number> {
  const value = await page.getByTestId(testId).innerText();
  return Number(value.trim());
}

async function openQuiz(page: Page): Promise<string> {
  const attackButton = page.getByTestId("combat-attack-button");
  await expect(attackButton).toBeEnabled();
  await attackButton.click();
  await expect(page.getByTestId("quiz-modal")).toBeVisible();
  return page.getByTestId("quiz-question-text").innerText();
}

test("acerto reduz HP do boss com dano relativo dentro da faixa", async ({ page }) => {
  await page.goto("/combate");

  const enemyHpBefore = await readHp(page, "enemy-hp-value");
  const enemyHpMax = await readHp(page, "enemy-hp-max");

  const questionText = await openQuiz(page);
  const questionMeta = getQuestionMeta(questionText);

  await page.getByTestId(`quiz-option-${questionMeta.correctIndex}`).click();
  await expect(page.getByTestId("quiz-modal")).toHaveCount(0);

  await expect
    .poll(async () => readHp(page, "enemy-hp-value"), { timeout: 5000 })
    .toBeLessThan(enemyHpBefore);

  const enemyHpAfter = await readHp(page, "enemy-hp-value");
  const dealtDamage = enemyHpBefore - enemyHpAfter;
  const expected = getExpectedPlayerDamageRange(questionMeta.damage, enemyHpMax);

  expect(dealtDamage).toBeGreaterThanOrEqual(expected.min);
  expect(dealtDamage).toBeLessThanOrEqual(expected.max);
});

test("erro nao causa dano no boss e ativa turno inimigo", async ({ page }) => {
  await page.goto("/combate");

  const enemyHpBefore = await readHp(page, "enemy-hp-value");
  const playerHpBefore = await readHp(page, "player-hp-value");

  const questionText = await openQuiz(page);
  const questionMeta = getQuestionMeta(questionText);
  const wrongOption = (questionMeta.correctIndex + 1) % 4;

  await page.getByTestId(`quiz-option-${wrongOption}`).click();
  await expect(page.getByTestId("quiz-modal")).toHaveCount(0);

  await expect.poll(async () => readHp(page, "enemy-hp-value"), { timeout: 5000 }).toBe(enemyHpBefore);
  await expect
    .poll(async () => readHp(page, "player-hp-value"), { timeout: 7000 })
    .toBeLessThan(playerHpBefore);
});

test("overlay de derrota aparece e permite voltar para revisoes", async ({ page }) => {
  await page.goto("/revisoes");
  await page.getByRole("button", { name: /power query/i }).first().click();
  await expect(page.getByText(/a hidra m/i)).toBeVisible();
  await page.getByRole("button", { name: /enfrentar boss/i }).click();
  await expect(page).toHaveURL(/\/combate$/);
  await expect.poll(async () => readHp(page, "enemy-hp-max")).toBeGreaterThanOrEqual(1200);

  const attackButton = page.getByTestId("combat-attack-button");
  const defeatOverlay = page.getByTestId("combat-defeat-overlay");

  for (let index = 0; index < 14; index += 1) {
    if ((await defeatOverlay.count()) > 0) {
      break;
    }

    await expect
      .poll(
        async () => {
          if ((await defeatOverlay.count()) > 0) {
            return "defeat";
          }
          return (await attackButton.isEnabled()) ? "ready" : "busy";
        },
        { timeout: 7000 },
      )
      .not.toBe("busy");

    if ((await defeatOverlay.count()) > 0) {
      break;
    }

    await attackButton.click();
    await expect(page.getByTestId("quiz-modal")).toBeVisible();
    const questionText = await page.getByTestId("quiz-question-text").innerText();
    const questionMeta = getQuestionMeta(questionText);
    const wrongOption = (questionMeta.correctIndex + 1) % 4;
    await page.getByTestId(`quiz-option-${wrongOption}`).click();
  }

  await expect(defeatOverlay).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId("combat-defeat-retry")).toBeVisible();
  await expect(page.getByTestId("combat-defeat-back")).toBeVisible();

  await page.getByTestId("combat-defeat-back").click();
  await expect(page).toHaveURL(/\/revisoes$/);
});
