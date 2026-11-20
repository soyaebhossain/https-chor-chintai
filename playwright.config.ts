import { defineConfig } from "@playwright/test";

/**
 * End-to-end tests against the dev server with real PostgreSQL and S3
 * (docker compose up -d). Uses the installed Edge/Chrome so no browser
 * download is needed; set PW_CHANNEL=chrome to switch.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3100",
    channel: process.env.PW_CHANNEL ?? "msedge",
    locale: "bn-BD",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx next dev -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
