import { expect, test, type Page } from "@playwright/test";

async function activateIosTheme(page: Page) {
  await page.goto("/config");
  await expect(page.getByTestId("settings-page")).toBeVisible();
  await page.getByTestId("theme-option-ios26").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme-id", "ios26");
}

test("ios26 aplica preset translucido forte nos tokens e overlay", async ({ page }) => {
  await activateIosTheme(page);
  await page.goto("/hub");

  const vars = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    return {
      surface: styles.getPropertyValue("--ios26-surface").trim(),
      surfaceStrong: styles.getPropertyValue("--ios26-surface-strong").trim(),
      surfaceElevated: styles.getPropertyValue("--ios26-surface-elevated").trim(),
      surfaceSubtle: styles.getPropertyValue("--ios26-surface-subtle").trim(),
      fieldBg: styles.getPropertyValue("--ios26-field-bg").trim(),
      border: styles.getPropertyValue("--ios26-border").trim(),
      borderStrong: styles.getPropertyValue("--ios26-border-strong").trim(),
      hover: styles.getPropertyValue("--ios26-hover").trim(),
      active: styles.getPropertyValue("--ios26-active").trim(),
      blurPanel: styles.getPropertyValue("--ios26-blur-panel").trim(),
      blurCard: styles.getPropertyValue("--ios26-blur-card").trim(),
    };
  });

  expect(vars.surface).toBe("rgba(255, 255, 255, 0.26)");
  expect(vars.surfaceStrong).toBe("rgba(255, 255, 255, 0.34)");
  expect(vars.surfaceElevated).toBe("rgba(255, 255, 255, 0.42)");
  expect(vars.surfaceSubtle).toBe("rgba(255, 255, 255, 0.18)");
  expect(vars.fieldBg).toBe("rgba(255, 255, 255, 0.34)");
  expect(vars.border).toBe("rgba(255, 255, 255, 0.5)");
  expect(vars.borderStrong).toBe("rgba(255, 255, 255, 0.62)");
  expect(vars.hover).toBe("rgba(255, 255, 255, 0.36)");
  expect(vars.active).toBe("rgba(255, 255, 255, 0.24)");
  expect(vars.blurPanel).toBe("58px");
  expect(vars.blurCard).toBe("36px");

  const overlayLayer = page.getByTestId("theme-background-overlay");
  const overlayInline = await overlayLayer.evaluate((el) => (el as HTMLElement).style.backgroundColor);
  expect(overlayInline).toBe("rgba(255, 255, 255, 0.1)");
});

test("ios26 reduz opacidade do sheen de fundo", async ({ page }) => {
  await activateIosTheme(page);
  await page.goto("/hub");

  const sheenLayer = page.getByTestId("theme-background-ios26-sheen");
  await expect(sheenLayer).toHaveCount(1);

  const sheenBg = await sheenLayer.evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(sheenBg).toContain("0.46");
  expect(sheenBg).toContain("0.2");
  expect(sheenBg).toContain("0.14");
});
