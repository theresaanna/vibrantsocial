import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });
dotenv.config();

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.spec\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/auth/user.json",
      },
      dependencies: ["setup"],
      testIgnore: /auth\.spec\.ts/,
    },
  ],
  webServer: {
    command: process.env.CI ? "npm start" : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  globalSetup: "./e2e/helpers/global-setup.ts",
  globalTeardown: "./e2e/helpers/global-teardown.ts",
});
