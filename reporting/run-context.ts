import path from "node:path";

const reportsRoot = path.resolve(process.cwd(), "reports");
const stagingDirectory = path.join(reportsRoot, ".current");
const reportTimezone = "Asia/Kolkata";

export const reportingSettings = Object.freeze({
  reportsRoot,
  stagingDirectory,
  timezone: reportTimezone,
  environment: process.env.TEST_ENV ?? "demo",
  playwrightReportDirectory: path.join(
    stagingDirectory,
    "playwright-report",
  ),
  artifactsDirectory: path.join(stagingDirectory, "playwright-artifacts"),
});
