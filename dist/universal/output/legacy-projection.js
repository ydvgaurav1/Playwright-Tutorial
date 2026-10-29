"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toLegacyReport = toLegacyReport;
const node_path_1 = __importDefault(require("node:path"));
const metrics_1 = require("../core/metrics");
const paths_1 = require("../schema/paths");
/**
 * Projects the canonical run document into the schema-v2 results document that
 * the existing dashboard and history reader already understand.
 *
 * The projection is intentionally lossy: canonical-only fields such as
 * evidence byte counts and richer statuses are not added to results.json.
 */
function toLegacyReport(document) {
    const derived = (0, metrics_1.createDerivedReport)(document.tests, document.run.durationMs);
    return {
        schemaVersion: 2,
        run: {
            id: document.run.id,
            status: document.run.status,
            startTime: document.run.startedAt,
            endTime: document.run.endedAt,
            timezone: document.run.timezone,
        },
        metadata: {
            environment: document.environment.name,
            baseURL: document.environment.baseUrl ?? "",
            browsers: document.environment.browsers ??
                unique(document.tests
                    .map((test) => test.variant.browser)
                    .filter((browser) => Boolean(browser))),
            projects: document.environment.projects ??
                unique(document.tests.map((test) => test.variant.name)),
            operatingSystem: document.environment.os ?? "",
            nodeVersion: document.environment.runtime ?? "",
            ci: document.environment.ci ?? false,
        },
        summary: toLegacySummary(derived.summary),
        suites: derived.suites.map((suite) => ({
            name: suite.name,
            summary: toLegacySummary(suite.summary),
        })),
        modules: derived.modules.map((module) => ({
            name: module.name,
            specKeys: module.specKeys,
            summary: toLegacySummary(module.summary),
        })),
        specs: derived.specs.map((spec) => ({
            key: spec.key,
            name: spec.name,
            path: spec.path,
            project: spec.variant,
            browser: spec.browser ?? "",
            module: spec.module,
            summary: toLegacySummary(spec.summary),
        })),
        tests: document.tests.map(toLegacyTest),
        globalErrors: document.globalErrors.map(toLegacyError),
    };
}
function toLegacyTest(test) {
    const attempts = test.attempts.map(toLegacyAttempt);
    return {
        id: test.id,
        title: test.title,
        titlePath: test.titlePath,
        suites: test.suites,
        module: test.module,
        spec: test.spec,
        file: test.source.file,
        line: test.source.line ?? 0,
        column: test.source.column ?? 0,
        status: toLegacyTestStatus(test.status),
        project: test.variant.name,
        browser: test.variant.browser ?? "",
        repeatEachIndex: test.variant.repeat ?? 0,
        durationMs: test.durationMs,
        retriesConfigured: test.retries.configured,
        retryAttempts: test.retries.used,
        tags: test.labels,
        attempts,
    };
}
function toLegacyAttempt(attempt) {
    return {
        attempt: attempt.index,
        retry: attempt.retry,
        status: attempt.status,
        durationMs: attempt.durationMs,
        startTime: attempt.startedAt,
        workerIndex: attempt.executor?.workerIndex ?? 0,
        errors: attempt.errors.map(toLegacyError),
        steps: attempt.steps.map(toLegacyStep),
        artifacts: attempt.evidence.map(toLegacyArtifact),
        logs: attempt.logs
            .filter((log) => log.stream === "stdout" || log.stream === "stderr")
            .map((log) => ({
            stream: log.stream,
            timestamp: log.timestamp,
            text: log.text,
        })),
    };
}
function toLegacyStep(step) {
    return {
        title: step.title,
        subtitle: step.subtitle,
        category: step.category,
        status: step.status === "failed" ? "failed" : "passed",
        durationMs: step.durationMs,
        startTime: step.startedAt,
        error: step.error ? toLegacyError(step.error) : undefined,
        steps: step.steps.map(toLegacyStep),
    };
}
function toLegacyError(error) {
    return {
        message: error.message,
        stack: error.stack,
        snippet: error.snippet,
        expected: error.expected,
        actual: error.actual,
    };
}
function toLegacyArtifact(evidence) {
    const safePath = (0, paths_1.isSafeRelativePath)(evidence.path);
    const available = safePath && evidence.missing !== true;
    const artifact = {
        kind: evidence.kind,
        name: evidence.name,
        filename: node_path_1.default.posix.basename(evidence.path.replaceAll("\\", "/")),
        contentType: evidence.mimeType ?? "",
        path: safePath ? `../${evidence.path}` : "",
        available,
    };
    if (evidence.bytes !== undefined)
        artifact.bytes = evidence.bytes;
    if (evidence.sha256 !== undefined)
        artifact.sha256 = evidence.sha256;
    if (evidence.format !== undefined)
        artifact.format = evidence.format;
    if (!safePath)
        artifact.unavailableReason = "Unsafe attachment path was blocked.";
    else if (evidence.missing) {
        artifact.unavailableReason =
            "Attachment was declared missing by the source adapter.";
    }
    return artifact;
}
function toLegacySummary(summary) {
    return {
        total: summary.total,
        passed: summary.passed,
        failed: summary.failed,
        skipped: summary.skipped,
        flaky: summary.flaky,
        passPercentage: summary.passPercentage,
        durationMs: summary.durationMs,
    };
}
function toLegacyTestStatus(status) {
    if (status === "passed" || status === "skipped" || status === "flaky") {
        return status;
    }
    return "failed";
}
function unique(values) {
    return [...new Set(values)];
}
