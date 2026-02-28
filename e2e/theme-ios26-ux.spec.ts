import { expect, test, type Page } from "@playwright/test";

async function activateIosTheme(page: Page) {
  await page.goto("/config");
  await expect(page.getByTestId("settings-page")).toBeVisible();
  await page.getByTestId("theme-option-ios26").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme-id", "ios26");
}

test("ios26 aplica classes semanticas em desktop e foco visivel", async ({ page }) => {
  await activateIosTheme(page);
  await page.goto("/hub");

  const topPanel = page.getByTestId("top-command-panel");
  const sidebar = page.getByTestId("shell-sidebar");
  const historyButton = page.getByTestId("top-history-button");

  await expect(topPanel).toHaveClass(/ios26-panel-strong/);
  await expect(sidebar).toHaveClass(/ios26-panel/);
  await expect(historyButton).toHaveClass(/ios26-focusable/);

  await historyButton.focus();
  const focusShadow = await historyButton.evaluate((element) => getComputedStyle(element as HTMLElement).boxShadow);
  expect(focusShadow).not.toBe("none");
});

test("ios26 mantém glass intenso no mobile menu", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await activateIosTheme(page);
  await page.goto("/hub");

  await page.getByTestId("mobile-menu-open").click();

  const drawer = page.getByTestId("mobile-menu-drawer");
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveClass(/ios26-panel-strong/);

  const firstNavItem = drawer.locator("a").first();
  await expect(firstNavItem).toHaveClass(/ios26-nav-item/);
});

test("ios26 respeita reduced motion desativando sheen decorativo", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await activateIosTheme(page);
  await page.goto("/hub");

  const topPanel = page.getByTestId("top-command-panel");
  const sheenAnimation = await topPanel.evaluate((element) =>
    getComputedStyle(element as HTMLElement, "::after").animationName,
  );
  expect(sheenAnimation).toBe("none");

  const bgSheenLayer = page.getByTestId("theme-background-ios26-sheen");
  await expect(bgSheenLayer).toHaveCount(1);
  const bgSheenAnimation = await bgSheenLayer.evaluate((element) =>
    getComputedStyle(element as HTMLElement, "::after").animationName,
  );
  expect(bgSheenAnimation).toBe("none");
});
