import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// This sample is intentionally independent of the repository's fixtures and
// pages. Only @playwright/test and the universal reporter entry point are used.
const reportsRoot = process.env.EXTERNAL_PLAYWRIGHT_REPORTS_ROOT
  ? path.resolve(process.env.EXTERNAL_PLAYWRIGHT_REPORTS_ROOT)
  : path.resolve(__dirname, ".reports");
const stagingDirectory = path.join(reportsRoot, ".current");
const playwrightReportDirectory = path.join(stagingDirectory, "playwright-report");
const artifactsDirectory = path.join(stagingDirectory, "playwright-artifacts");
const universalReporter =
  process.env.EXTERNAL_PLAYWRIGHT_REPORTER ??
  path.resolve(__dirname, "../../reporting/playwright-reporter.ts");

export default defineConfig({
  testDir: "./tests",
  outputDir: artifactsDirectory,
  fullyParallel: false,
  forbidOnly: false,
  retries: 0,
  workers: 1,
  timeout: 15_000,
  expect: { timeout: 2_000 },
  reporter: [
    ["list"],
    [
      "html",
      {
        outputFolder: playwrightReportDirectory,
        open: "never",
      },
    ],
    [
      universalReporter,
      {
        reportsRoot,
        stagingDirectory,
        playwrightReportDirectory,
        timezone: "Asia/Kolkata",
        environment: "external-playwright-ts",
        baseURL: "local://external-playwright-sample",
      },
    ],
  ],
  use: {
    ...devices["Desktop Chrome"],
    headless: true,
  },
  projects: [
    {
      name: "external-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
