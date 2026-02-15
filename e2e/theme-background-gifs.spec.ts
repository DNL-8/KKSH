import { expect, test } from "@playwright/test";

const STORAGE_KEY = "cmd8_hud_theme";

const GIF_THEMES = [
  { id: "naruto", assetPath: "/assets/themes/naruto.gif" },
  { id: "dragonball", assetPath: "/assets/themes/dragonball.gif" },
  { id: "sololeveling", assetPath: "/assets/themes/sololeveling.gif" },
  { id: "hxh", assetPath: "/assets/themes/hxh.gif" },
  { id: "lotr", assetPath: "/assets/themes/lotr.gif" },
] as const;

test("tema aplica GIF local e asset e servido corretamente", async ({ page }) => {
  await page.goto("/config");
  await expect(page.getByTestId("settings-page")).toBeVisible();

  const backgroundImageLayer = page.getByTestId("theme-background-image");
  await expect(backgroundImageLayer).toBeVisible();

  for (const theme of GIF_THEMES) {
    await page.getByTestId(`theme-option-${theme.id}`).click();
    await expect(backgroundImageLayer).toHaveAttribute("data-theme-id", theme.id);

    const inlineBackgroundImage = await backgroundImageLayer.evaluate(
      (element) => (element as HTMLElement).style.backgroundImage,
    );
    expect(inlineBackgroundImage).toContain(theme.assetPath);

    const storedThemeRaw = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
    const storedTheme = storedThemeRaw ? (JSON.parse(storedThemeRaw) as string) : null;
    expect(storedTheme).toBe(theme.id);

    const assetResponse = await page.request.get(theme.assetPath);
    expect(assetResponse.ok()).toBeTruthy();
    const contentType = assetResponse.headers()["content-type"] ?? "";
    expect(contentType).toContain("image/gif");
  }
});
