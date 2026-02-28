import { expect, test, type Page } from "@playwright/test";

async function activateIosTheme(page: Page) {
  await page.goto("/config");
  await expect(page.getByTestId("settings-page")).toBeVisible();
  await page.getByTestId("theme-option-ios26").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme-id", "ios26");
}

test("ios26 aplica wrappers semanticos nas paginas core", async ({ page }) => {
  await activateIosTheme(page);

  await page.goto("/hub");
  await expect(page.getByTestId("hub-biometry-card")).toHaveClass(/ios26-section/);
  await expect(page.getByTestId("hub-hero-panel")).toHaveClass(/ios26-section-hero/);

  await page.goto("/config");
  await expect(page.getByTestId("settings-main-panel")).toHaveClass(/ios26-section/);
  await expect(page.getByTestId("settings-theme-section")).toHaveClass(/ios26-section/);

  await page.goto("/arquivos");
  await expect(page.getByTestId("files-main-panel")).toBeVisible();
  await expect(page.getByTestId("files-toolbar-panel")).toHaveClass(/ios26-section/);

  await page.goto("/sistema");
  const enterSystemButton = page.getByRole("button", { name: /aceder ao sistema/i });
  await expect(enterSystemButton).toBeVisible();
  await enterSystemButton.click();
  await expect(page.getByTestId("system-dashboard-panel")).toHaveClass(/ios26-section/);
  await expect(page.getByTestId("system-action-list")).toBeVisible();
});

test("ios26 preserva foco visivel nas paginas core", async ({ page }) => {
  await activateIosTheme(page);
  await page.goto("/config");

  const applyButton = page.getByRole("button", { name: /aplicar agora/i });
  await applyButton.focus();
  const focusShadow = await applyButton.evaluate((element) => getComputedStyle(element as HTMLElement).boxShadow);
  expect(focusShadow).not.toBe("none");
});
