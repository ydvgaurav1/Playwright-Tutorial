import "dotenv/config";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { reportingSettings } from "./reporting/run-context";

const baseURL = process.env.BASE_URL ?? "https://www.saucedemo.com";
process.env.PLAYWRIGHT_LAST_RUN_OUTPUT_FILE ??= path.resolve(
  process.cwd(),
  "test-results/.last-run.json",
);

export default defineConfig({
  testDir: "./tests",
  outputDir: reportingSettings.artifactsDirectory,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [
    ["list"],
    [
      "html",
      {
        outputFolder: reportingSettings.playwrightReportDirectory,
        open: "never",
      },
    ],
    [
      "./reporting/playwright-reporter.ts",
      {
        reportsRoot: reportingSettings.reportsRoot,
        stagingDirectory: reportingSettings.stagingDirectory,
        playwrightReportDirectory:
          reportingSettings.playwrightReportDirectory,
        timezone: reportingSettings.timezone,
        environment: reportingSettings.environment,
        baseURL,
      },
    ],
  ],
  metadata: {
    environment: reportingSettings.environment,
    reportTimezone: reportingSettings.timezone,
    baseURL,
  },
  use: {
    baseURL,
    testIdAttribute: "data-test",
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
