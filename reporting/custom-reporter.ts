import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestError,
  TestResult,
  TestStep,
} from "@playwright/test/reporter";
import { createDashboard } from "./dashboard-template";
import {
  classifyModule,
  classifySuites,
  createModuleRecords,
  createSpecRecords,
  createSuiteRecords,
  createSummary,
} from "./report-model";
import type {
  ArtifactRecord,
  AttemptRecord,
  CapturedError,
  DashboardDocument,
  DashboardStatus,
  HistoryRecord,
  LogRecord,
  ReportDocument,
  StepRecord,
  TestRecord,
} from "./report-types";

type ReporterOptions = {
  reportsRoot: string;
  stagingDirectory: string;
  playwrightReportDirectory: string;
  timezone: string;
  environment: string;
  baseURL: string;
};

type NativeAttachment = TestResult["attachments"][number];

const ANSI_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/g;

class CustomDashboardReporter implements Reporter {
  private rootSuite?: Suite;
  private config?: FullConfig;
  private runId?: string;
  private runDirectory?: string;
  private readonly globalErrors: TestError[] = [];
  private readonly attemptLogs = new WeakMap<TestResult, LogRecord[]>();

  constructor(private readonly options: ReporterOptions) {}

  printsToStdio(): boolean {
    return false;
  }

  onBegin(config: FullConfig, suite: Suite): void {
    this.config = config;
    this.rootSuite = suite;
  }

  onError(error: TestError): void {
    this.globalErrors.push(error);
  }

  onStdOut(chunk: string | Buffer, _test: void | TestCase, result: void | TestResult): void {
    this.captureLog("stdout", chunk, result);
  }

  onStdErr(chunk: string | Buffer, _test: void | TestCase, result: void | TestResult): void {
    this.captureLog("stderr", chunk, result);
  }

  async onEnd(result: FullResult): Promise<void> {
    if (!this.rootSuite || !this.config) {
      throw new Error("Custom reporter did not receive Playwright run metadata.");
    }

    const run = await this.reserveRunDirectory(result.startTime);
    this.runId = run.runId;
    this.runDirectory = run.runDirectory;
    const tests = await Promise.all(
      this.rootSuite.allTests().map((test) => this.serializeTest(test)),
    );
    const summary = createSummary(tests, result.duration);
    const endTime = new Date(
      result.startTime.getTime() + result.duration,
    ).toISOString();
    const report: ReportDocument = {
      schemaVersion: 2,
      run: {
        id: this.runId,
        status: result.status,
        startTime: result.startTime.toISOString(),
        endTime,
        timezone: this.options.timezone,
      },
      metadata: {
        environment: this.options.environment,
        baseURL: this.options.baseURL,
        browsers: [...new Set(tests.map(({ browser }) => browser))],
        projects: [...new Set(tests.map(({ project }) => project))],
        operatingSystem: `${os.platform()} ${os.release()} (${os.arch()})`,
        nodeVersion: process.version,
        ci: Boolean(process.env.CI),
      },
      summary,
      suites: createSuiteRecords(tests),
      modules: createModuleRecords(tests),
      specs: createSpecRecords(tests),
      tests,
      globalErrors: this.globalErrors.map((error) => this.serializeError(error)),
    };

    const resultsPath = path.join(this.runDirectory, "results.json");
    await fs.writeFile(resultsPath, JSON.stringify(report, null, 2), "utf8");

    await fs.cp(
      this.options.playwrightReportDirectory,
      path.join(this.runDirectory, "playwright-report"),
      { recursive: true, force: true },
    );
    const history = await this.loadHistory();
    const dashboard: DashboardDocument = { ...report, history };
    await fs.writeFile(
      path.join(this.runDirectory, "dashboard", "index.html"),
      createDashboard(dashboard),
      "utf8",
    );
    await this.updateLatestRedirect();
    await fs.rm(this.options.stagingDirectory, { recursive: true, force: true });

    console.log(
      `Custom dashboard: ${path.join(this.runDirectory, "dashboard", "index.html")}`,
    );
  }

  private async serializeTest(test: TestCase): Promise<TestRecord> {
    const project = test.parent.project();
    const projectName = String(project?.name ?? "unknown");
    const browser = String(project?.use.browserName ?? projectName);
    const file = path.relative(process.cwd(), test.location.file).replaceAll("\\", "/");
    const titlePath = test
      .titlePath()
      .filter(
        (title) =>
          title &&
          title !== projectName &&
          title !== file &&
          !/\.(?:spec|test)\.[^.]+$/i.test(title),
      );
    const attempts = await Promise.all(
      test.results.map((attempt, index) =>
        this.serializeAttempt(test, attempt, index),
      ),
    );

    return {
      id: test.id,
      title: test.title,
      titlePath,
      suites: classifySuites(test.tags),
      module: classifyModule(test.tags, file),
      spec: {
        key: `${file}::${projectName}`,
        name: path.posix.basename(file),
        path: file,
      },
      file,
      line: test.location.line,
      column: test.location.column,
      status: this.statusFor(test),
      project: projectName,
      browser,
      repeatEachIndex: test.repeatEachIndex,
      durationMs: attempts.reduce((total, attempt) => total + attempt.durationMs, 0),
      retriesConfigured: test.retries,
      retryAttempts: Math.max(0, attempts.length - 1),
      tags: test.tags,
      attempts,
    };
  }

  private async serializeAttempt(
    test: TestCase,
    result: TestResult,
    attemptIndex: number,
  ): Promise<AttemptRecord> {
    const artifacts = (
      await Promise.all(
        result.attachments.map((attachment, attachmentIndex) =>
          this.copyEvidence(test, result, attachment, attachmentIndex),
        ),
      )
    ).filter((artifact): artifact is ArtifactRecord => artifact !== undefined);

    return {
      attempt: attemptIndex + 1,
      retry: result.retry,
      status: result.status,
      durationMs: result.duration,
      startTime: result.startTime.toISOString(),
      workerIndex: result.workerIndex,
      errors: result.errors.map((error) => this.serializeError(error)),
      steps: result.steps.map((step) => this.serializeStep(step)),
      artifacts,
      logs: this.attemptLogs.get(result) ?? [],
    };
  }

  private captureLog(
    stream: LogRecord["stream"],
    chunk: string | Buffer,
    result: void | TestResult,
  ): void {
    if (!result) return;
    const logs = this.attemptLogs.get(result) ?? [];
    logs.push({
      stream,
      timestamp: new Date().toISOString(),
      text: this.redact(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk),
    });
    this.attemptLogs.set(result, logs);
  }

  private serializeStep(step: TestStep): StepRecord {
    return {
      title: this.redact(step.title),
      subtitle: step.subtitle ? this.redact(step.subtitle) : undefined,
      category: step.category,
      status: step.error ? "failed" : "passed",
      durationMs: step.duration,
      startTime: step.startTime.toISOString(),
      error: step.error ? this.serializeError(step.error) : undefined,
      steps: step.steps.map((child) => this.serializeStep(child)),
    };
  }

  private serializeError(error: TestError): CapturedError {
    const message = this.redact((error.message ?? error.value ?? "Unknown error").replace(ANSI_PATTERN, ""));
    const expected = this.captureAssertionLine(message, /^Expected(?: string| substring)?:\s*(.+)$/im);
    const actual = this.captureAssertionLine(message, /^Received(?: string)?:\s*(.+)$/im);

    return {
      message,
      stack: error.stack
        ? this.redact(error.stack.replace(ANSI_PATTERN, ""))
        : undefined,
      snippet: error.snippet
        ? this.redact(error.snippet.replace(ANSI_PATTERN, ""))
        : undefined,
      expected,
      actual,
    };
  }

  private captureAssertionLine(message: string, pattern: RegExp): string | undefined {
    return message.match(pattern)?.[1]?.trim();
  }

  private redact(value: string): string {
    const knownSensitiveValues = [
      process.env.STANDARD_PASSWORD,
      "secret_sauce",
      "invalid_password",
    ].filter((item): item is string => Boolean(item));

    let redacted = value;
    for (const sensitiveValue of knownSensitiveValues) {
      redacted = redacted.replaceAll(sensitiveValue, "[REDACTED]");
    }

    return redacted.replace(
      /((?:password|passwd|pwd)\s*[:=]\s*)[^\s,;]+/gi,
      "$1[REDACTED]",
    );
  }

  private statusFor(test: TestCase): DashboardStatus {
    const outcome = test.outcome();
    if (outcome === "flaky") return "flaky";
    if (outcome === "skipped") return "skipped";
    if (outcome === "unexpected") return "failed";
    return test.results.at(-1)?.status === "skipped" ? "skipped" : "passed";
  }

  private async copyEvidence(
    test: TestCase,
    result: TestResult,
    attachment: NativeAttachment,
    attachmentIndex: number,
  ): Promise<ArtifactRecord | undefined> {
    const kind = this.artifactKind(attachment);
    if (!kind || (!attachment.path && !attachment.body)) return undefined;

    const folder = kind === "screenshot" ? "screenshots" : `${kind}s`;
    const extension = this.artifactExtension(attachment, kind);
    const filename = `${this.slug(`${test.title}-${test.id}`)}-retry-${result.retry}-${attachmentIndex}${extension}`;
    const destination = path.join(this.getRunDirectory(), folder, filename);

    if (attachment.path) {
      await fs.copyFile(attachment.path, destination);
    } else if (attachment.body) {
      await fs.writeFile(destination, attachment.body);
    }

    return {
      kind,
      name: attachment.name,
      contentType: attachment.contentType,
      path: `../${folder}/${filename}`,
    };
  }

  private artifactKind(
    attachment: NativeAttachment,
  ): ArtifactRecord["kind"] | undefined {
    const name = attachment.name.toLowerCase();
    const contentType = attachment.contentType.toLowerCase();
    if (contentType.startsWith("image/") || name.includes("screenshot")) {
      return "screenshot";
    }
    if (contentType.startsWith("video/") || name.includes("video")) {
      return "video";
    }
    if (name.includes("trace") || attachment.path?.endsWith("trace.zip")) {
      return "trace";
    }
    return undefined;
  }

  private artifactExtension(
    attachment: NativeAttachment,
    kind: ArtifactRecord["kind"],
  ): string {
    const sourceExtension = attachment.path ? path.extname(attachment.path) : "";
    if (sourceExtension) return sourceExtension;
    if (kind === "screenshot") return ".png";
    if (kind === "video") return ".webm";
    return ".zip";
  }

  private slug(value: string): string {
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return (slug || "test").slice(0, 100);
  }

  private async loadHistory(): Promise<HistoryRecord[]> {
    const entries = await fs.readdir(this.options.reportsRoot, {
      withFileTypes: true,
    });
    const history: HistoryRecord[] = [];

    for (const entry of entries) {
      if (
        !entry.isDirectory() ||
        entry.name === "latest" ||
        entry.name === ".current"
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
          summary: ReportDocument["summary"];
          tests?: Array<Partial<TestRecord> & { id: string; status: DashboardStatus }>;
        };
        history.push({
          runId: previous.run.id,
          startTime: previous.run.startTime,
          endTime: previous.run.endTime,
          environment: previous.metadata.environment,
          browsers: previous.metadata.browsers ?? [],
          projects: previous.metadata.projects ?? previous.metadata.browsers ?? [],
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

  private async updateLatestRedirect(): Promise<void> {
    const latestDirectory = path.join(this.options.reportsRoot, "latest");
    await fs.mkdir(latestDirectory, { recursive: true });
    const dashboardPath = `../${this.getRunId()}/dashboard/index.html`;
    const redirect = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="refresh" content="0; url=${dashboardPath}">
    <title>Latest Playwright report</title>
  </head>
  <body>
    <p>Opening the latest completed report. <a href="${dashboardPath}">Continue manually</a>.</p>
  </body>
</html>`;
    await fs.writeFile(path.join(latestDirectory, "index.html"), redirect, "utf8");
  }

  private async reserveRunDirectory(
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

  private getRunDirectory(): string {
    if (!this.runDirectory) throw new Error("Run directory has not been created.");
    return this.runDirectory;
  }

  private getRunId(): string {
    if (!this.runId) throw new Error("Run ID has not been created.");
    return this.runId;
  }
}

export default CustomDashboardReporter;
