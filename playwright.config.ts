import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "npm --workspace=orchestrator run dev",
      url: "http://localhost:3001/health",
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: "npm --workspace=portal run dev",
      url: "http://localhost:3000/login",
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
