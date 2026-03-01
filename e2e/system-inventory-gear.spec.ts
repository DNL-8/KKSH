import { expect, test } from "@playwright/test";

test("engrenagem do inventario alterna editor, mostra resumo e persiste estado", async ({ page }) => {
  await page.goto("/sistema");

  const gearButton = page.getByTestId("system-inventory-gear-button");
  await expect(gearButton).toBeVisible();
  await expect(gearButton).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("system-inventory-editor")).toBeVisible();
  await expect(page.getByTestId("system-inventory-summary")).toHaveCount(0);

  await gearButton.click();
  await expect(gearButton).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("system-inventory-editor")).toHaveCount(0);
  await expect(page.getByTestId("system-inventory-summary")).toBeVisible();

  await gearButton.click();
  await expect(gearButton).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("system-inventory-editor")).toBeVisible();

  const rarityBar150 = page.getByTestId("system-inventory-rarity-bar_150");
  await rarityBar150.selectOption("mythic");
  await expect(rarityBar150).toHaveValue("mythic");

  const nameBar150 = page.getByTestId("system-inventory-name-bar_150");
  await nameBar150.fill("Barra Olimpica 1,50m");
  await expect(nameBar150).toHaveValue("Barra Olimpica 1,50m");

  const typeBar150 = page.getByTestId("system-inventory-type-bar_150");
  await typeBar150.selectOption("Calistenia");
  await expect(typeBar150).toHaveValue("Calistenia");

  const toggleBarShort = page.getByTestId("system-inventory-toggle-bar_short");
  await expect(toggleBarShort).toHaveAttribute("aria-pressed", "true");
  await toggleBarShort.click();
  await expect(toggleBarShort).toHaveAttribute("aria-pressed", "false");

  await gearButton.click();
  const summary = page.getByTestId("system-inventory-summary");
  await expect(summary).toBeVisible();
  await expect(summary).toContainText("Barra Olimpica 1,50m");
  await expect(summary).toContainText("Calistenia");
  await expect(summary).toContainText("Mitico");
  await expect(summary).not.toContainText("Barra curta 20cm (Halter)");

  await page.reload();

  const gearAfterReload = page.getByTestId("system-inventory-gear-button");
  await expect(gearAfterReload).toBeVisible();
  await expect(gearAfterReload).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("system-inventory-summary")).toBeVisible();

  await gearAfterReload.click();
  await expect(gearAfterReload).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("system-inventory-rarity-bar_150")).toHaveValue("mythic");
  await expect(page.getByTestId("system-inventory-name-bar_150")).toHaveValue("Barra Olimpica 1,50m");
  await expect(page.getByTestId("system-inventory-type-bar_150")).toHaveValue("Calistenia");
  await expect(page.getByTestId("system-inventory-toggle-bar_short")).toHaveAttribute("aria-pressed", "false");
});

test("engrenagem do inventario no dashboard alterna editor/resumo e preserva configuracao", async ({ page }) => {
  await page.goto("/sistema");
  await page.getByRole("button", { name: /Aceder ao Sistema/i }).click();

  const gearButton = page.getByTestId("system-dashboard-inventory-gear-button");
  await expect(gearButton).toBeVisible();
  await expect(gearButton).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("system-dashboard-inventory-editor")).toBeVisible();

  const rarityBar150 = page.getByTestId("system-dashboard-inventory-rarity-bar_150");
  await rarityBar150.selectOption("legendary");
  await expect(rarityBar150).toHaveValue("legendary");

  const nameBar150 = page.getByTestId("system-dashboard-inventory-name-bar_150");
  await nameBar150.fill("Barra Power 1,50m");
  await expect(nameBar150).toHaveValue("Barra Power 1,50m");

  const typeBar150 = page.getByTestId("system-dashboard-inventory-type-bar_150");
  await typeBar150.selectOption("Cardio");
  await expect(typeBar150).toHaveValue("Cardio");

  const toggleBarShort = page.getByTestId("system-dashboard-inventory-toggle-bar_short");
  await expect(toggleBarShort).toHaveAttribute("aria-pressed", "true");
  await toggleBarShort.click();
  await expect(toggleBarShort).toHaveAttribute("aria-pressed", "false");

  await gearButton.click();
  await expect(gearButton).toHaveAttribute("aria-expanded", "false");
  const summary = page.getByTestId("system-dashboard-inventory-summary");
  await expect(summary).toBeVisible();
  await expect(summary).toContainText("Barra Power 1,50m");
  await expect(summary).toContainText("Cardio");
  await expect(summary).toContainText("Lendario");
  await expect(summary).not.toContainText("Barra curta 20cm (Halter)");

  await page.reload();
  await page.getByRole("button", { name: /Aceder ao Sistema/i }).click();

  const gearAfterReload = page.getByTestId("system-dashboard-inventory-gear-button");
  await expect(gearAfterReload).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("system-dashboard-inventory-summary")).toBeVisible();

  await gearAfterReload.click();
  await expect(page.getByTestId("system-dashboard-inventory-rarity-bar_150")).toHaveValue("legendary");
  await expect(page.getByTestId("system-dashboard-inventory-name-bar_150")).toHaveValue("Barra Power 1,50m");
  await expect(page.getByTestId("system-dashboard-inventory-type-bar_150")).toHaveValue("Cardio");
  await expect(page.getByTestId("system-dashboard-inventory-toggle-bar_short")).toHaveAttribute("aria-pressed", "false");
});
