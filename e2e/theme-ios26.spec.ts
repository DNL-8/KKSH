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

  const rootVars = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return {
      surface: styles.getPropertyValue("--ios26-surface").trim(),
      surfaceStrong: styles.getPropertyValue("--ios26-surface-strong").trim(),
      surfaceElevated: styles.getPropertyValue("--ios26-surface-elevated").trim(),
      blurPanel: styles.getPropertyValue("--ios26-blur-panel").trim(),
      blurCard: styles.getPropertyValue("--ios26-blur-card").trim(),
    };
  });
  expect(rootVars.surface).toBe("rgba(255, 255, 255, 0.26)");
  expect(rootVars.surfaceStrong).toBe("rgba(255, 255, 255, 0.34)");
  expect(rootVars.surfaceElevated).toBe("rgba(255, 255, 255, 0.42)");
  expect(rootVars.blurPanel).toBe("58px");
  expect(rootVars.blurCard).toBe("36px");

  const overlayLayer = page.getByTestId("theme-background-overlay");
  await expect(overlayLayer).toHaveCount(1);
  const overlayInline = await overlayLayer.evaluate((el) => (el as HTMLElement).style.backgroundColor);
  expect(overlayInline).toBe("rgba(255, 255, 255, 0.1)");

  await page.goto("/hub");
  await expect(page.getByTestId("top-command-panel")).toHaveClass(/ios26-panel-strong/);
  await expect(page.getByTestId("shell-sidebar")).toHaveClass(/ios26-panel/);
});
