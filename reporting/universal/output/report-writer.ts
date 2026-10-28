import { promises as fs } from "node:fs";
import path from "node:path";
import {
  createDashboard,
  type DashboardSettings,
} from "../../dashboard-template";
import type {
  DashboardDocument,
  HistoryRecord,
  ReportDocument,
  SummaryRecord,
  TestRecord,
} from "../../report-types";
import type { RunDocument } from "../schema/types";
import { stringifyRunDocument } from "../schema/validate";
import { prepareEvidenceForDashboard } from "./evidence";
import { writeFileAtomic } from "./files";
import { toLegacyReport } from "./legacy-projection";

export type UniversalReportWriterOptions = {
  reportsRoot: string;
  timezone: string;
  latestTitle?: string;
  dashboard?: DashboardSettings;
};

export type WriteRunOptions = {
  dashboard?: DashboardSettings;
  latestTitle?: string;
};

/**
 * Writes the durable shape shared by every adapter: a reserved run folder,
 * canonical run.json, schema-v2 results.json, the existing dashboard, history,
 * and the latest redirect.
 *
 * The dashboard is written before results.json. That way a failed dashboard
 * write can never leave a completed run in history with a missing dashboard.
 * The current run is added to the dashboard history in memory, so the rendered
 * content is the same as reading it back from disk.
 */
export class UniversalReportWriter {
  constructor(private readonly options: UniversalReportWriterOptions) {}

  async reserveRunDirectory(
    executionStartedAt: Date,
  ): Promise<{ runId: string; runDirectory: string }> {
    await fs.mkdir(this.options.reportsRoot, { recursive: true });

    let folderTime = executionStartedAt;
    while (true) {
      const runId = this.timestampInTimezone(folderTime);
      const runDirectory = path.join(this.options.reportsRoot, runId);

      try {
        await fs.mkdir(runDirectory);
        for (const directory of [
          "dashboard",
          "screenshots",
          "videos",
          "traces",
        ]) {
          await fs.mkdir(path.join(runDirectory, directory));
        }
        return { runId, runDirectory };
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "EEXIST") throw error;
        folderTime = new Date(folderTime.getTime() + 60_000);
      }
    }
  }

  async writeRun(
    runDirectory: string,
    document: RunDocument,
    overrides: WriteRunOptions = {},
  ): Promise<ReportDocument> {
    const report = await prepareEvidenceForDashboard(
      toLegacyReport(document),
      runDirectory,
    );
    const history = await this.loadHistory(report.run.id);
    history.push(toHistoryRecord(report));
    history.sort((left, right) =>
      left.startTime.localeCompare(right.startTime),
    );

    await writeFileAtomic(
      path.join(runDirectory, "run.json"),
      stringifyRunDocument(document),
    );

    const dashboard: DashboardDocument = { ...report, history };
    const dashboardSettings = {
      ...this.options.dashboard,
      ...overrides.dashboard,
    };
    await writeFileAtomic(
      path.join(runDirectory, "dashboard", "index.html"),
      createDashboard(dashboard, dashboardSettings),
    );
    await writeFileAtomic(
      path.join(runDirectory, "results.json"),
      JSON.stringify(report, null, 2),
    );
    await this.updateLatestRedirect(
      report.run.id,
      overrides.latestTitle ?? this.options.latestTitle ?? "Latest report",
    );

    return report;
  }

  private async loadHistory(excludedRunId?: string): Promise<HistoryRecord[]> {
    const entries = await fs.readdir(this.options.reportsRoot, {
      withFileTypes: true,
    });
    const history: HistoryRecord[] = [];

    for (const entry of entries) {
      if (
        !entry.isDirectory() ||
        entry.name === "latest" ||
        entry.name === ".current" ||
        entry.name === excludedRunId
      ) {
        continue;
      }

      try {
        const content = await fs.readFile(
          path.join(this.options.reportsRoot, entry.name, "results.json"),
          "utf8",
        );
        const previous = JSON.parse(content) as Partial<ReportDocument> & {
          run: ReportDocument["run"];
          metadata: Partial<ReportDocument["metadata"]> & {
            environment: string;
          };
          summary: SummaryRecord;
          tests?: Array<Partial<TestRecord> & { id: string; status: string }>;
        };
        history.push({
          runId: previous.run.id,
          startTime: previous.run.startTime,
          endTime: previous.run.endTime,
          environment: previous.metadata.environment,
          browsers: previous.metadata.browsers ?? [],
          projects:
            previous.metadata.projects ?? previous.metadata.browsers ?? [],
          suites: previous.suites ?? [],
          summary: previous.summary,
          failedTestIds: (previous.tests ?? [])
            .filter(({ status }) => status === "failed")
            .map(({ id }) => id),
          dashboardPath: `../../${previous.run.id}/dashboard/index.html`,
        });
      } catch {
        // Incomplete runs have no valid results.json and are intentionally omitted.
      }
    }

    return history.sort((left, right) =>
      left.startTime.localeCompare(right.startTime),
    );
  }

  private async updateLatestRedirect(
    runId: string,
    title: string,
  ): Promise<void> {
    const latestDirectory = path.join(this.options.reportsRoot, "latest");
    await fs.mkdir(latestDirectory, { recursive: true });
    const dashboardPath = `../${runId}/dashboard/index.html`;
    const redirect = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="refresh" content="0; url=${dashboardPath}">
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <p>Opening the latest completed report. <a href="${dashboardPath}">Continue manually</a>.</p>
  </body>
</html>`;
    await writeFileAtomic(
      path.join(latestDirectory, "index.html"),
      redirect,
    );
  }

  private timestampInTimezone(date: Date): string {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: this.options.timezone,
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    const parts = Object.fromEntries(
      formatter
        .formatToParts(date)
        .filter(({ type }) => type !== "literal")
        .map(({ type, value }) => [type, value]),
    );

    return `${parts.day}-${parts.month}-${parts.year}_${parts.hour}-${parts.minute}-${parts.dayPeriod}`;
  }
}

function toHistoryRecord(report: ReportDocument): HistoryRecord {
  return {
    runId: report.run.id,
    startTime: report.run.startTime,
    endTime: report.run.endTime,
    environment: report.metadata.environment,
    browsers: report.metadata.browsers,
    projects: report.metadata.projects,
    suites: report.suites,
    summary: report.summary,
    failedTestIds: report.tests
      .filter(({ status }) => status === "failed")
      .map(({ id }) => id),
    dashboardPath: `../../${report.run.id}/dashboard/index.html`,
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
