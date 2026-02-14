import { expect, test } from "@playwright/test";

const ROUTES = ["/hub", "/combate", "/revisoes", "/arquivos", "/evolucao", "/ia", "/config"];

test("rota raiz redireciona para /hub", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/hub$/);
  await expect(page.getByRole("heading", { name: "Centro de Comando" })).toBeVisible();
});

test("rotas principais carregam sem 404", async ({ page }) => {
  for (const route of ROUTES) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(`${route.replace("/", "\\/")}$`));
    await expect(page.getByTestId("top-command-panel")).toBeVisible();
  }
});

test("sidebar desktop alterna entre expandido e icones com persistencia", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/hub");

  const sidebar = page.getByTestId("shell-sidebar");
  const toggle = page.getByTestId("sidebar-mode-toggle");

  await expect(sidebar).toBeVisible();
  await expect(toggle).toBeVisible();
  await expect(sidebar.getByText("Arquivos de Sincronia")).toHaveCount(0);
  await expect(toggle).toHaveAttribute("aria-label", /modo com texto/i);
  await expect(page.getByTestId("sidebar-config-link")).toBeVisible();
  await expect(page.getByTestId("sidebar-config-card")).toHaveCount(0);

  const compactBox = await sidebar.boundingBox();
  expect(compactBox).not.toBeNull();
  const compactWidth = compactBox?.width ?? 0;
  expect(compactWidth).toBeLessThan(120);

  await page.getByTestId("sidebar-config-link").click();
  await expect(page).toHaveURL(/\/config$/);
  await expect(page.getByTestId("sidebar-config-active-indicator")).toBeVisible();

  await toggle.click();
  await expect(sidebar.getByText("Arquivos de Sincronia")).toHaveCount(1);
  await expect(toggle).toHaveAttribute("aria-label", /modo so icones/i);
  await expect(page.getByTestId("sidebar-config-card")).toBeVisible();
  await expect
    .poll(async () => {
      const expandedBox = await sidebar.boundingBox();
      return expandedBox?.width ?? 0;
    })
    .toBeGreaterThan(compactWidth + 120);

  await page.reload();
  const sidebarAfterReload = page.getByTestId("shell-sidebar");
  const toggleAfterReload = page.getByTestId("sidebar-mode-toggle");
  await expect(sidebarAfterReload).toBeVisible();
  await expect(toggleAfterReload).toHaveAttribute("aria-label", /modo so icones/i);
  await expect(page.getByTestId("sidebar-config-card")).toBeVisible();
  await expect
    .poll(async () => {
      const expandedReloadBox = await sidebarAfterReload.boundingBox();
      return expandedReloadBox?.width ?? 0;
    })
    .toBeGreaterThan(compactWidth + 120);

  await toggleAfterReload.click();
  await expect(sidebarAfterReload.getByText("Arquivos de Sincronia")).toHaveCount(0);
  await expect(page.getByTestId("sidebar-config-card")).toHaveCount(0);
});

test("menu mobile abre, navega e fecha por overlay", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/hub");

  const openMenu = page.getByTestId("mobile-menu-open");
  await expect(openMenu).toBeVisible();

  await openMenu.click();
  await expect(page.getByTestId("mobile-menu-drawer")).toBeVisible();
  await page.getByRole("link", { name: /arena de exterminio/i }).click();
  await expect(page).toHaveURL(/\/combate$/);
  await expect(page.getByTestId("mobile-menu-drawer")).toHaveCount(0);

  await page.getByTestId("mobile-menu-open").click();
  await expect(page.getByTestId("mobile-menu-drawer")).toBeVisible();
  await page.mouse.click(370, 120);
  await expect(page.getByTestId("mobile-menu-drawer")).toHaveCount(0);
});

test("modulo IA envia mensagem para /api/v1/ai/hunter", async ({ page }) => {
  let endpointCalled = false;

  await page.route("**/api/v1/ai/hunter", async (route) => {
    endpointCalled = true;
    const request = route.request();
    const payload = request.postDataJSON() as { mensagem: string };

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        resposta_texto: `Hunter, mensagem recebida: ${payload.mensagem}`,
        xp_ganho: 10,
        missao_concluida: false,
        status_mensagem: "Sincronizacao estavel.",
      }),
    });
  });

  await page.goto("/ia");
  const input = page.getByPlaceholder("Introduza diretriz para o Sistema...");
  await input.fill("Completar missao SQL");
  await input.press("Enter");

  await expect(page.getByText(/CA(?:C|[^\x00-\x7F])ADOR: Completar missao SQL/i)).toBeVisible();
  await expect(page.getByText("Hunter, mensagem recebida: Completar missao SQL")).toBeVisible();
  await expect(page.getByText("[STATUS] Sincronizacao estavel.")).toBeVisible();
  expect(endpointCalled).toBeTruthy();
});

test("topo exibe painel de comando com nivel e status/rank", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/hub");

  const topPanel = page.getByTestId("top-command-panel");
  await expect(topPanel).toBeVisible();
  await expect(page.getByTestId("top-level-card")).toContainText(/(nivel|lvl)/i);
  await expect(page.getByTestId("top-status-rank")).toContainText(/online/i);
  await expect(page.getByTestId("top-status-rank")).toContainText(/rank/i);

  const panelBox = await topPanel.boundingBox();
  const headerBox = await page.locator("header").first().boundingBox();
  expect(panelBox).not.toBeNull();
  expect(headerBox).not.toBeNull();
  if (panelBox && headerBox) {
    expect(panelBox.width).toBeGreaterThanOrEqual(headerBox.width - 96);
  }
});

test("topo responsivo mantem status/rank visivel em telas menores", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/hub");

  await expect(page.getByTestId("top-command-panel")).toBeVisible();
  await expect(page.getByTestId("top-level-card")).toBeVisible();
  await expect(page.getByTestId("top-status-rank")).toBeVisible();
});
