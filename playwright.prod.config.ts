import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e-prod",
  timeout: 60_000,
  workers: 1,
  reporter: "list",
  use: { baseURL: process.env.LIVE_URL ?? "https://chor-chintai.vercel.app", channel: "msedge", locale: "bn-BD" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1366, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "msedge" } },
  ],
});
