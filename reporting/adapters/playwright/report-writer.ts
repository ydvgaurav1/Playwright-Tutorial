import { promises as fs } from "node:fs";
import path from "node:path";
import type { ReportDocument } from "../../report-types";
import type { RunDocument } from "../../universal/schema/types";
import { copyDirectoryAtomic } from "../../universal/output/files";
import { UniversalReportWriter } from "../../universal/output/report-writer";
import type { PlaywrightReporterOptions } from "./types";

export { copyFileAtomic, writeFileAtomic } from "../../universal/output/files";

/**
 * Playwright-specific durable work: native-report copying and staging cleanup.
 * Run folders, canonical/legacy documents, dashboard, history, and the latest
 * redirect are owned by the shared UniversalReportWriter.
 */
export class PlaywrightReportWriter {
  private readonly universal: UniversalReportWriter;

  constructor(private readonly options: PlaywrightReporterOptions) {
    this.universal = new UniversalReportWriter({
      reportsRoot: options.reportsRoot,
      timezone: options.timezone,
      latestTitle: "Latest Playwright report",
    });
  }

  async reserveRunDirectory(
    executionStartedAt: Date,
  ): Promise<{ runId: string; runDirectory: string }> {
    return this.universal.reserveRunDirectory(executionStartedAt);
  }

  async copyNativeReport(runDirectory: string): Promise<string> {
    const source = this.options.playwrightReportDirectory;
    const destination = path.join(runDirectory, "playwright-report");

    try {
      await copyDirectoryAtomic(source, destination);
    } catch (error) {
      throw new Error(
        `Could not copy the native Playwright report from "${source}": ${errorMessage(error)}`,
        { cause: error },
      );
    }

    return "playwright-report/index.html";
  }

  async writeRun(
    runDirectory: string,
    document: RunDocument,
  ): Promise<ReportDocument> {
    return this.universal.writeRun(runDirectory, document);
  }

  async cleanupStaging(): Promise<void> {
    try {
      await fs.rm(this.options.stagingDirectory, {
        recursive: true,
        force: true,
      });
    } catch (error) {
      console.warn(
        `[playwright-universal-reporter] Could not remove staging directory "${this.options.stagingDirectory}": ${errorMessage(error)}`,
      );
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
