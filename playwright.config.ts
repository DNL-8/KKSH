import { defineConfig } from "@playwright/test";

const webServerCommand = process.env.PW_WEB_SERVER_COMMAND || "pnpm e2e:serve";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: true,
    trace: "on-first-retry",
  },
  webServer: {
    // Allows running Playwright in environments where pnpm is unavailable.
    command: webServerCommand,
    url: "http://127.0.0.1:3000/hub",
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
