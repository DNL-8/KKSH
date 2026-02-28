import { expect, test } from "@playwright/test";

const STORAGE_KEY = "cmd8_hud_theme";

test("tema ios26 aplica modo light e escopo no root", async ({ page }) => {
  await page.goto("/config");
  await expect(page.getByTestId("settings-page")).toBeVisible();

  await page.getByTestId("theme-option-ios26").click();

  const root = page.locator("html");
  await expect(root).toHaveAttribute("data-theme-id", "ios26");
  await expect(root).toHaveClass(/theme-light/);

  const colorScheme = await page.evaluate(() => document.documentElement.style.colorScheme);
  expect(colorScheme).toBe("light");

  const storedThemeRaw = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
  const storedTheme = storedThemeRaw ? (JSON.parse(storedThemeRaw) as string) : null;
  expect(storedTheme).toBe("ios26");

  const backgroundImageLayer = page.getByTestId("theme-background-image");
  await expect(backgroundImageLayer).toHaveCount(1);
  const backgroundImageCss = await backgroundImageLayer.evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(backgroundImageCss).toContain("455974.jpg");

  await page.goto("/hub");
  await expect(page.getByTestId("top-command-panel")).toHaveClass(/ios26-panel-strong/);
  await expect(page.getByTestId("shell-sidebar")).toHaveClass(/ios26-panel/);
});
