"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaywrightReportingAdapter = void 0;
const node_fs_1 = require("node:fs");
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const classify_1 = require("../../universal/core/classify");
const normalize_1 = require("../../universal/core/normalize");
const validate_1 = require("../../universal/schema/validate");
const report_writer_1 = require("./report-writer");
const ANSI_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/g;
const SENSITIVE_PATTERN = /(?<=(?:password|passwd|pwd)\s*[:=]\s*)[^\s,;]+/gi;
/**
 * Playwright-specific reporter adapter.
 *
 * Lifecycle and Playwright object traversal live here. Normalization,
 * classification, metrics, schema validation, and legacy projection live in the
 * shared reporting modules.
 */
class PlaywrightReportingAdapter {
    options;
    rootSuite;
    config;
    runId;
    runDirectory;
    globalErrors = [];
    attemptLogs = new WeakMap();
    writer;
    constructor(options) {
        this.options = options;
        this.writer = new report_writer_1.PlaywrightReportWriter(options);
    }
    printsToStdio() {
        return false;
    }
    onBegin(config, suite) {
        this.config = config;
        this.rootSuite = suite;
    }
    onError(error) {
        this.globalErrors.push(error);
    }
    onStdOut(chunk, _test, result) {
        this.captureLog("stdout", chunk, result);
    }
    onStdErr(chunk, _test, result) {
        this.captureLog("stderr", chunk, result);
    }
    async onEnd(result) {
        try {
            await this.finalize(result);
        }
        catch (error) {
            // Reporter failures must not change the Playwright test exit status and
            // must not touch historical run folders. The reserved run folder is new,
            // so a partial write can never overwrite an older execution.
            console.error(`[playwright-universal-reporter] Report generation failed; historical reports were left untouched: ${errorMessage(error)}`);
            if (error instanceof Error && error.stack) {
                console.error(error.stack);
            }
        }
    }
    async finalize(result) {
        if (!this.rootSuite || !this.config) {
            throw new Error("Playwright reporting adapter did not receive run metadata.");
        }
        const reserved = await this.writer.reserveRunDirectory(result.startTime);
        this.runId = reserved.runId;
        this.runDirectory = reserved.runDirectory;
        const nativeReportPath = await this.writer.copyNativeReport(reserved.runDirectory);
        const tests = await Promise.all(this.rootSuite
            .allTests()
            .map((test) => this.serializeTest(test, result.startTime)));
        const document = this.createRunDocument(result, tests, nativeReportPath);
        await this.writer.writeRun(reserved.runDirectory, document);
        await this.writer.cleanupStaging();
        console.log(`Custom dashboard: ${node_path_1.default.join(reserved.runDirectory, "dashboard", "index.html")}`);
        console.log(`Canonical run: ${node_path_1.default.join(reserved.runDirectory, "run.json")}`);
    }
    createRunDocument(result, tests, nativeReportPath) {
        const endedAt = new Date(result.startTime.getTime() + result.duration).toISOString();
        const traceFormats = unique(tests.flatMap((test) => test.attempts.flatMap((attempt) => attempt.evidence
            .filter((evidence) => evidence.kind === "trace")
            .map((evidence) => evidence.format ?? "playwright")))).sort();
        const document = {
            schemaVersion: "1.0.0",
            producer: {
                name: "playwright-universal-adapter",
                version: "1.0.0",
                framework: "playwright",
                frameworkVersion: this.config?.version,
            },
            run: {
                id: this.getRunId(),
                status: (0, normalize_1.normalizeRunStatus)(result.status),
                startedAt: result.startTime.toISOString(),
                endedAt,
                durationMs: result.duration,
                timezone: this.options.timezone,
            },
            environment: {
                name: this.options.environment,
                baseUrl: this.options.baseURL,
                ci: Boolean(process.env.CI),
                os: `${node_os_1.default.platform()} ${node_os_1.default.release()} (${node_os_1.default.arch()})`,
                runtime: process.version,
                browsers: unique(tests.map((test) => test.variant.browser ?? test.variant.name)),
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
            globalErrors: this.globalErrors.map((error) => this.serializeError(error)),
            extensions: {
                playwright: {
                    version: this.config?.version,
                },
            },
        };
        return (0, validate_1.assertValidRunDocument)(document);
    }
    async serializeTest(test, runStartedAt) {
        const project = test.parent.project();
        const projectName = String(project?.name ?? "unknown");
        const browser = String(project?.use.browserName ?? projectName);
        const file = node_path_1.default
            .relative(process.cwd(), test.location.file)
            .replaceAll("\\", "/");
        const titlePath = test
            .titlePath()
            .filter((title) => title &&
            title !== projectName &&
            title !== file &&
            !/\.(?:spec|test)\.[^.]+$/i.test(title));
        const attempts = test.results.length === 0
            ? [this.createSyntheticAttempt(runStartedAt)]
            : await Promise.all(test.results.map((attempt, index) => this.serializeAttempt(test, attempt, index)));
        return {
            id: test.id,
            nativeId: test.id,
            idStrategy: "playwright",
            title: test.title,
            titlePath,
            labels: [...test.tags],
            suites: (0, classify_1.classifySuites)(test.tags),
            module: (0, classify_1.classifyModule)(test.tags, file),
            spec: {
                key: `${file}::${projectName}`,
                name: node_path_1.default.posix.basename(file),
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
            durationMs: attempts.reduce((total, attempt) => total + attempt.durationMs, 0),
            retries: {
                configured: test.retries,
                used: Math.max(0, attempts.length - 1),
            },
            attempts,
        };
    }
    async serializeAttempt(test, result, attemptIndex) {
        const evidence = (await Promise.all(result.attachments.map((attachment, attachmentIndex) => this.copyEvidence(test, result, attachment, attachmentIndex)))).filter((artifact) => artifact !== undefined);
        return {
            index: attemptIndex + 1,
            retry: result.retry,
            status: (0, normalize_1.normalizeAttemptStatus)(result.status),
            startedAt: result.startTime.toISOString(),
            durationMs: result.duration,
            executor: { workerIndex: Math.max(0, result.workerIndex) },
            errors: result.errors.map((error) => this.serializeError(error)),
            steps: result.steps.map((step) => this.serializeStep(step)),
            logs: this.attemptLogs.get(result) ?? [],
            evidence,
        };
    }
    createSyntheticAttempt(runStartedAt) {
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
    captureLog(stream, chunk, result) {
        if (!result)
            return;
        const logs = this.attemptLogs.get(result) ?? [];
        logs.push({
            stream,
            timestamp: new Date().toISOString(),
            text: this.redact(Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk),
        });
        this.attemptLogs.set(result, logs);
    }
    serializeStep(step) {
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
    serializeError(error) {
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
    captureAssertionLine(message, pattern) {
        return message.match(pattern)?.[1]?.trim();
    }
    redact(value) {
        const knownSensitiveValues = [
            process.env.STANDARD_PASSWORD,
            "secret_sauce",
            "invalid_password",
        ].filter((item) => Boolean(item));
        return (0, normalize_1.redactText)(value, {
            values: knownSensitiveValues,
            patterns: [SENSITIVE_PATTERN],
        });
    }
    statusFor(test) {
        const outcome = test.outcome();
        if (outcome === "flaky")
            return "flaky";
        if (outcome === "skipped")
            return "skipped";
        if (outcome === "unexpected")
            return "failed";
        return test.results.at(-1)?.status === "skipped" ? "skipped" : "passed";
    }
    async copyEvidence(test, result, attachment, attachmentIndex) {
        const kind = this.artifactKind(attachment);
        if (!kind || (!attachment.path && !attachment.body))
            return undefined;
        const folder = kind === "screenshot" ? "screenshots" : `${kind}s`;
        const extension = this.artifactExtension(attachment, kind);
        const filename = `${this.slug(`${test.title}-${test.id}`)}-retry-${result.retry}-${attachmentIndex}${extension}`;
        const relativePath = `${folder}/${filename}`;
        const destination = node_path_1.default.join(this.getRunDirectory(), relativePath);
        try {
            await node_fs_1.promises.mkdir(node_path_1.default.dirname(destination), { recursive: true });
            if (attachment.path) {
                await (0, report_writer_1.copyFileAtomic)(attachment.path, destination);
            }
            else if (attachment.body) {
                await (0, report_writer_1.writeFileAtomic)(destination, attachment.body);
            }
            const stats = await node_fs_1.promises.stat(destination);
            return {
                kind,
                name: attachment.name,
                path: relativePath,
                mimeType: attachment.contentType,
                bytes: stats.size,
                format: kind === "trace" ? "playwright" : undefined,
            };
        }
        catch (error) {
            console.warn(`[playwright-universal-reporter] Could not copy ${kind} evidence for "${test.title}": ${errorMessage(error)}`);
            return undefined;
        }
    }
    artifactKind(attachment) {
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
    artifactExtension(attachment, kind) {
        const sourceExtension = attachment.path
            ? node_path_1.default.extname(attachment.path)
            : "";
        if (sourceExtension)
            return sourceExtension;
        if (kind === "screenshot")
            return ".png";
        if (kind === "video")
            return ".webm";
        return ".zip";
    }
    slug(value) {
        const slug = value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
        return (slug || "test").slice(0, 100);
    }
    getRunDirectory() {
        if (!this.runDirectory) {
            throw new Error("Run directory has not been created.");
        }
        return this.runDirectory;
    }
    getRunId() {
        if (!this.runId) {
            throw new Error("Run ID has not been created.");
        }
        return this.runId;
    }
}
exports.PlaywrightReportingAdapter = PlaywrightReportingAdapter;
function unique(values) {
    return [...new Set(values)];
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
exports.default = PlaywrightReportingAdapter;
