import { defineConfig } from "@playwright/test";

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
    command: "pnpm e2e:serve",
    url: "http://127.0.0.1:3000/hub",
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});