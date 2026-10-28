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
import { classifyModule, classifySuites } from "../../universal/core/classify";
import {
  normalizeAttemptStatus,
  normalizeRunStatus,
  redactText,
} from "../../universal/core/normalize";
import type {
  AttemptRecord,
  CapturedError,
  EvidenceRecord,
  LogRecord,
  RunDocument,
  StepRecord,
  TestRecord,
  UniversalTestStatus,
} from "../../universal/schema/types";
import { assertValidRunDocument } from "../../universal/schema/validate";
import {
  copyFileAtomic,
  PlaywrightReportWriter,
  writeFileAtomic,
} from "./report-writer";
import type { PlaywrightReporterOptions } from "./types";

type NativeAttachment = TestResult["attachments"][number];

const ANSI_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/g;
const SENSITIVE_PATTERN = /(?<=(?:password|passwd|pwd)\s*[:=]\s*)[^\s,;]+/gi;

/**
 * Playwright-specific reporter adapter.
 *
 * Lifecycle and Playwright object traversal live here. Normalization,
 * classification, metrics, schema validation, and legacy projection live in the
 * shared reporting modules.
 */
export class PlaywrightReportingAdapter implements Reporter {
  private rootSuite?: Suite;
  private config?: FullConfig;
  private runId?: string;
  private runDirectory?: string;
  private readonly globalErrors: TestError[] = [];
  private readonly attemptLogs = new WeakMap<TestResult, LogRecord[]>();
  private readonly writer: PlaywrightReportWriter;

  constructor(private readonly options: PlaywrightReporterOptions) {
    this.writer = new PlaywrightReportWriter(options);
  }

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

  onStdOut(
    chunk: string | Buffer,
    _test: void | TestCase,
    result: void | TestResult,
  ): void {
    this.captureLog("stdout", chunk, result);
  }

  onStdErr(
    chunk: string | Buffer,
    _test: void | TestCase,
    result: void | TestResult,
  ): void {
    this.captureLog("stderr", chunk, result);
  }

  async onEnd(result: FullResult): Promise<void> {
    try {
      await this.finalize(result);
    } catch (error) {
      // Reporter failures must not change the Playwright test exit status and
      // must not touch historical run folders. The reserved run folder is new,
      // so a partial write can never overwrite an older execution.
      console.error(
        `[playwright-universal-reporter] Report generation failed; historical reports were left untouched: ${errorMessage(error)}`,
      );
      if (error instanceof Error && error.stack) {
        console.error(error.stack);
      }
    }
  }

  private async finalize(result: FullResult): Promise<void> {
    if (!this.rootSuite || !this.config) {
      throw new Error(
        "Playwright reporting adapter did not receive run metadata.",
      );
    }

    const reserved = await this.writer.reserveRunDirectory(result.startTime);
    this.runId = reserved.runId;
    this.runDirectory = reserved.runDirectory;

    const nativeReportPath = await this.writer.copyNativeReport(
      reserved.runDirectory,
    );
    const tests = await Promise.all(
      this.rootSuite
        .allTests()
        .map((test) => this.serializeTest(test, result.startTime)),
    );
    const document = this.createRunDocument(
      result,
      tests,
      nativeReportPath,
    );
    await this.writer.writeRun(reserved.runDirectory, document);
    await this.writer.cleanupStaging();

    console.log(
      `Custom dashboard: ${path.join(reserved.runDirectory, "dashboard", "index.html")}`,
    );
    console.log(
      `Canonical run: ${path.join(reserved.runDirectory, "run.json")}`,
    );
  }

  private createRunDocument(
    result: FullResult,
    tests: readonly TestRecord[],
    nativeReportPath: string,
  ): RunDocument {
    const endedAt = new Date(
      result.startTime.getTime() + result.duration,
    ).toISOString();
    const traceFormats = unique(
      tests.flatMap((test) =>
        test.attempts.flatMap((attempt) =>
          attempt.evidence
            .filter((evidence) => evidence.kind === "trace")
            .map((evidence) => evidence.format ?? "playwright"),
        ),
      ),
    ).sort();

    const document: RunDocument = {
      schemaVersion: "1.0.0",
      producer: {
        name: "playwright-universal-adapter",
        version: "1.0.0",
        framework: "playwright",
        frameworkVersion: this.config?.version,
      },
      run: {
        id: this.getRunId(),
        status: normalizeRunStatus(result.status),
        startedAt: result.startTime.toISOString(),
        endedAt,
        durationMs: result.duration,
        timezone: this.options.timezone,
      },
      environment: {
        name: this.options.environment,
        baseUrl: this.options.baseURL,
        ci: Boolean(process.env.CI),
        os: `${os.platform()} ${os.release()} (${os.arch()})`,
        runtime: process.version,
        browsers: unique(
          tests.map((test) => test.variant.browser ?? test.variant.name),
        ),
        projects: unique(tests.map((test) => test.variant.name)),
      },
      capabilities: {
        steps: true,
        retries: true,
        logs: true,
        attachments: true,
        traceFormats,
        timings: "attempt",
      },
      externalReports: [
        {
          label: "Native report",
          path: nativeReportPath,
          kind: "html",
        },
      ],
      tests: [...tests],
      globalErrors: this.globalErrors.map((error) =>
        this.serializeError(error),
      ),
      extensions: {
        playwright: {
          version: this.config?.version,
        },
      },
    };

    return assertValidRunDocument(document);
  }

  private async serializeTest(
    test: TestCase,
    runStartedAt: Date,
  ): Promise<TestRecord> {
    const project = test.parent.project();
    const projectName = String(project?.name ?? "unknown");
    const browser = String(project?.use.browserName ?? projectName);
    const file = path
      .relative(process.cwd(), test.location.file)
      .replaceAll("\\", "/");
    const titlePath = test
      .titlePath()
      .filter(
        (title) =>
          title &&
          title !== projectName &&
          title !== file &&
          !/\.(?:spec|test)\.[^.]+$/i.test(title),
      );
    const attempts =
      test.results.length === 0
        ? [this.createSyntheticAttempt(runStartedAt)]
        : await Promise.all(
            test.results.map((attempt, index) =>
              this.serializeAttempt(test, attempt, index),
            ),
          );

    return {
      id: test.id,
      nativeId: test.id,
      idStrategy: "playwright",
      title: test.title,
      titlePath,
      labels: [...test.tags],
      suites: classifySuites(test.tags),
      module: classifyModule(test.tags, file),
      spec: {
        key: `${file}::${projectName}`,
        name: path.posix.basename(file),
        path: file,
      },
      source: {
        file,
        line: test.location.line,
        column: test.location.column,
      },
      variant: {
        name: projectName,
        browser,
        repeat: test.repeatEachIndex,
      },
      status: this.statusFor(test),
      durationMs: attempts.reduce(
        (total, attempt) => total + attempt.durationMs,
        0,
      ),
      retries: {
        configured: test.retries,
        used: Math.max(0, attempts.length - 1),
      },
      attempts,
    };
  }

  private async serializeAttempt(
    test: TestCase,
    result: TestResult,
    attemptIndex: number,
  ): Promise<AttemptRecord> {
    const evidence = (
      await Promise.all(
        result.attachments.map((attachment, attachmentIndex) =>
          this.copyEvidence(
            test,
            result,
            attachment,
            attachmentIndex,
          ),
        ),
      )
    ).filter(
      (artifact): artifact is EvidenceRecord => artifact !== undefined,
    );

    return {
      index: attemptIndex + 1,
      retry: result.retry,
      status: normalizeAttemptStatus(result.status),
      startedAt: result.startTime.toISOString(),
      durationMs: result.duration,
      executor: { workerIndex: Math.max(0, result.workerIndex) },
      errors: result.errors.map((error) => this.serializeError(error)),
      steps: result.steps.map((step) => this.serializeStep(step)),
      logs: this.attemptLogs.get(result) ?? [],
      evidence,
    };
  }

  private createSyntheticAttempt(runStartedAt: Date): AttemptRecord {
    return {
      index: 1,
      retry: 0,
      status: "skipped",
      startedAt: runStartedAt.toISOString(),
      durationMs: 0,
      executor: { workerIndex: 0 },
      errors: [],
      steps: [],
      logs: [],
      evidence: [],
      extensions: { synthetic: true },
    };
  }

  private captureLog(
    stream: "stdout" | "stderr",
    chunk: string | Buffer,
    result: void | TestResult,
  ): void {
    if (!result) return;
    const logs = this.attemptLogs.get(result) ?? [];
    logs.push({
      stream,
      timestamp: new Date().toISOString(),
      text: this.redact(
        Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk,
      ),
    });
    this.attemptLogs.set(result, logs);
  }

  private serializeStep(step: TestStep): StepRecord {
    return {
      title: this.redact(step.title),
      subtitle: step.subtitle ? this.redact(step.subtitle) : undefined,
      category: step.category,
      status: step.error ? "failed" : "passed",
      startedAt: step.startTime.toISOString(),
      durationMs: step.duration,
      error: step.error ? this.serializeError(step.error) : undefined,
      steps: step.steps.map((child) => this.serializeStep(child)),
    };
  }

  private serializeError(error: TestError): CapturedError {
    const message = this.redact(
      (error.message ?? error.value ?? "Unknown error").replace(
        ANSI_PATTERN,
        "",
      ),
    );
    const expected = this.captureAssertionLine(
      message,
      /^Expected(?: string| substring)?:\s*(.+)$/im,
    );
    const actual = this.captureAssertionLine(
      message,
      /^Received(?: string)?:\s*(.+)$/im,
    );

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

  private captureAssertionLine(
    message: string,
    pattern: RegExp,
  ): string | undefined {
    return message.match(pattern)?.[1]?.trim();
  }

  private redact(value: string): string {
    const knownSensitiveValues = [
      process.env.STANDARD_PASSWORD,
      "secret_sauce",
      "invalid_password",
    ].filter((item): item is string => Boolean(item));

    return redactText(value, {
      values: knownSensitiveValues,
      patterns: [SENSITIVE_PATTERN],
    });
  }

  private statusFor(test: TestCase): UniversalTestStatus {
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
  ): Promise<EvidenceRecord | undefined> {
    const kind = this.artifactKind(attachment);
    if (!kind || (!attachment.path && !attachment.body)) return undefined;

    const folder = kind === "screenshot" ? "screenshots" : `${kind}s`;
    const extension = this.artifactExtension(attachment, kind);
    const filename = `${this.slug(
      `${test.title}-${test.id}`,
    )}-retry-${result.retry}-${attachmentIndex}${extension}`;
    const relativePath = `${folder}/${filename}`;
    const destination = path.join(this.getRunDirectory(), relativePath);

    try {
      await fs.mkdir(path.dirname(destination), { recursive: true });
      if (attachment.path) {
        await copyFileAtomic(attachment.path, destination);
      } else if (attachment.body) {
        await writeFileAtomic(destination, attachment.body);
      }

      const stats = await fs.stat(destination);
      return {
        kind,
        name: attachment.name,
        path: relativePath,
        mimeType: attachment.contentType,
        bytes: stats.size,
        format: kind === "trace" ? "playwright" : undefined,
      };
    } catch (error) {
      console.warn(
        `[playwright-universal-reporter] Could not copy ${kind} evidence for "${test.title}": ${errorMessage(error)}`,
      );
      return undefined;
    }
  }

  private artifactKind(
    attachment: NativeAttachment,
  ): EvidenceRecord["kind"] | undefined {
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
    kind: EvidenceRecord["kind"],
  ): string {
    const sourceExtension = attachment.path
      ? path.extname(attachment.path)
      : "";
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

  private getRunDirectory(): string {
    if (!this.runDirectory) {
      throw new Error("Run directory has not been created.");
    }
    return this.runDirectory;
  }

  private getRunId(): string {
    if (!this.runId) {
      throw new Error("Run ID has not been created.");
    }
    return this.runId;
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default PlaywrightReportingAdapter;
