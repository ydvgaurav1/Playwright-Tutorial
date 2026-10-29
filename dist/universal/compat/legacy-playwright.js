"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fromLegacyResultsDocument = fromLegacyResultsDocument;
exports.isLegacyResultsDocument = isLegacyResultsDocument;
const node_path_1 = __importDefault(require("node:path"));
const validate_1 = require("../schema/validate");
const classify_1 = require("../core/classify");
const normalize_1 = require("../core/normalize");
/**
 * Compatibility reader for the existing Playwright results.json documents.
 *
 * This is a schema projection, not a Playwright reporter adapter: it reads
 * already-written files and produces canonical in-memory documents. It does
 * not write to, move, or mutate historical reports.
 */
function fromLegacyResultsDocument(value, options = {}) {
    const source = asRecord(value);
    if (!source)
        throw new Error("Legacy results document must be an object.");
    const sourceRun = asRecord(source.run);
    if (!sourceRun)
        throw new Error("Legacy results document is missing run.");
    const sourceVersion = String(source.schemaVersion ?? "unknown");
    const isV2 = sourceVersion === "2";
    const sourceTests = asArray(source.tests);
    if (!sourceTests)
        throw new Error("Legacy results document is missing tests.");
    const startedAt = (0, normalize_1.normalizeTimestamp)(sourceRun.startTime);
    const endedAt = (0, normalize_1.normalizeTimestamp)(sourceRun.endTime);
    const sourceSummary = asRecord(source.summary);
    const summaryDuration = asNumber(sourceSummary?.durationMs);
    const wallClockDuration = summaryDuration !== undefined
        ? summaryDuration
        : Math.max(0, Date.parse(endedAt) - Date.parse(startedAt));
    const tests = sourceTests.map((test, index) => mapTest(test, index, isV2));
    const traceFormats = [
        ...new Set(tests.flatMap((test) => test.attempts.flatMap((attempt) => attempt.evidence
            .filter((evidence) => evidence.kind === "trace")
            .map((evidence) => evidence.format ?? "unknown")))),
    ].sort();
    const metadata = asRecord(source.metadata) ?? {};
    const browsers = asStringArray(metadata.browsers) ?? [];
    const projects = asStringArray(metadata.projects) ?? browsers;
    const externalReports = [];
    if (options.nativeReportPath) {
        externalReports.push({
            label: "Native report",
            path: options.nativeReportPath,
            kind: "html",
        });
    }
    const document = {
        schemaVersion: "1.0.0",
        producer: {
            name: "legacy-results-json-reader",
            version: "1.0.0",
            framework: "playwright",
            sourceSchemaVersion: sourceVersion,
        },
        run: {
            id: requireString(sourceRun.id, "run.id"),
            status: (0, normalize_1.normalizeRunStatus)(sourceRun.status),
            startedAt,
            endedAt,
            durationMs: wallClockDuration,
            timezone: asString(sourceRun.timezone) ?? "UTC",
        },
        environment: {
            name: asString(metadata.environment) ?? "unknown",
            baseUrl: asString(metadata.baseURL),
            ci: asBoolean(metadata.ci),
            os: asString(metadata.operatingSystem),
            runtime: asString(metadata.nodeVersion),
            browsers,
            projects,
        },
        capabilities: {
            steps: true,
            retries: true,
            logs: true,
            attachments: true,
            traceFormats,
            timings: "test",
        },
        externalReports,
        tests,
        globalErrors: mapErrors(source.globalErrors),
        extensions: {
            legacy: {
                sourceFormat: "results.json",
                sourceSchemaVersion: sourceVersion,
            },
        },
    };
    return (0, validate_1.assertValidRunDocument)(document);
}
function isLegacyResultsDocument(value) {
    const record = asRecord(value);
    return Boolean(record &&
        record.run &&
        record.tests &&
        (record.schemaVersion === 1 || record.schemaVersion === 2));
}
function mapTest(value, index, isV2) {
    const test = asRecord(value);
    if (!test)
        throw new Error(`tests[${index}] must be an object.`);
    const id = requireString(test.id, `tests[${index}].id`);
    const title = requireString(test.title, `tests[${index}].title`);
    const labels = asStringArray(test.tags) ?? [];
    const file = asString(test.file) ??
        asString(asRecord(test.spec)?.path) ??
        `unknown-source-${index}`;
    const attemptsSource = asArray(test.attempts);
    if (!attemptsSource) {
        throw new Error(`tests[${index}].attempts must be an array.`);
    }
    const attempts = attemptsSource.map((attempt, attemptIndex) => mapAttempt(attempt, attemptIndex));
    const variantName = asString(test.project) ?? asString(test.browser) ?? "unknown";
    const spec = mapSpec(test, file, variantName, isV2);
    const module = asString(test.module) || (0, classify_1.classifyModule)(labels, file);
    const suiteValue = asString(test.suite)?.trim();
    const suites = asStringArray(test.suites) ?? (suiteValue ? [suiteValue] : []);
    const durationFromAttempts = attempts.reduce((total, attempt) => total + attempt.durationMs, 0);
    const durationMs = (0, normalize_1.normalizeDurationMs)(test.durationMs, durationFromAttempts);
    const configuredRetries = asNumber(test.retriesConfigured) ?? 0;
    return {
        id,
        nativeId: id,
        idStrategy: isV2 ? "playwright" : "legacy-results-json",
        title,
        titlePath: nonEmptyStrings(asStringArray(test.titlePath)) ?? [title],
        labels,
        suites,
        module,
        spec,
        source: {
            file,
            line: positiveInteger(asNumber(test.line)),
            column: positiveInteger(asNumber(test.column)),
        },
        variant: {
            name: variantName,
            browser: asString(test.browser),
            repeat: nonNegativeInteger(asNumber(test.repeatEachIndex)) ?? 0,
        },
        status: (0, normalize_1.deriveTestStatus)(attempts, test.status),
        durationMs,
        retries: {
            configured: nonNegativeInteger(configuredRetries) ?? 0,
            used: Math.max(0, attempts.length - 1),
        },
        attempts,
    };
}
function mapSpec(test, file, variantName, isV2) {
    const source = asRecord(test.spec);
    if (isV2 && source) {
        const key = asString(source.key);
        const name = asString(source.name);
        const specPath = asString(source.path);
        if (key && name && specPath)
            return { key, name, path: specPath };
    }
    return {
        key: `${file}::${variantName}`,
        name: node_path_1.default.posix.basename(file.replaceAll("\\", "/")),
        path: file,
    };
}
function mapAttempt(value, index) {
    const attempt = asRecord(value);
    if (!attempt)
        throw new Error(`attempts[${index}] must be an object.`);
    const workerIndex = asNumber(attempt.workerIndex);
    const evidence = mapEvidenceList(attempt.artifacts);
    return {
        index: positiveInteger(asNumber(attempt.attempt)) ?? index + 1,
        retry: nonNegativeInteger(asNumber(attempt.retry)) ?? 0,
        status: (0, normalize_1.normalizeAttemptStatus)(attempt.status),
        startedAt: (0, normalize_1.normalizeTimestamp)(attempt.startTime),
        durationMs: (0, normalize_1.normalizeDurationMs)(attempt.durationMs),
        executor: workerIndex !== undefined
            ? { workerIndex: nonNegativeInteger(workerIndex) ?? 0 }
            : undefined,
        errors: mapErrors(attempt.errors),
        steps: mapSteps(attempt.steps),
        logs: mapLogs(attempt.logs),
        evidence,
    };
}
function mapSteps(value) {
    const steps = asArray(value) ?? [];
    return steps.map((value, index) => {
        const step = asRecord(value);
        if (!step)
            throw new Error(`steps[${index}] must be an object.`);
        return {
            title: requireString(step.title, `steps[${index}].title`),
            subtitle: asString(step.subtitle),
            category: asString(step.category) ?? "unknown",
            status: (0, normalize_1.normalizeStepStatus)(step.status),
            startedAt: (0, normalize_1.normalizeTimestamp)(step.startTime),
            durationMs: (0, normalize_1.normalizeDurationMs)(step.durationMs),
            error: step.error !== undefined
                ? mapError(step.error, `steps[${index}].error`)
                : undefined,
            steps: mapSteps(step.steps),
        };
    });
}
function mapErrors(value) {
    const errors = asArray(value) ?? [];
    return errors.map((error, index) => mapError(error, `errors[${index}]`));
}
function mapError(value, pathLabel) {
    const error = asRecord(value);
    if (!error)
        throw new Error(`${pathLabel} must be an object.`);
    return {
        message: requireString(error.message, `${pathLabel}.message`),
        type: asString(error.type),
        stack: asString(error.stack),
        snippet: asString(error.snippet),
        expected: asString(error.expected),
        actual: asString(error.actual),
    };
}
function mapLogs(value) {
    const logs = asArray(value) ?? [];
    return logs.map((log, index) => {
        const record = asRecord(log);
        if (!record)
            throw new Error(`logs[${index}] must be an object.`);
        return {
            stream: normalizeLogStream(record.stream),
            timestamp: (0, normalize_1.normalizeTimestamp)(record.timestamp),
            text: asString(record.text) ?? "",
            truncated: asBoolean(record.truncated),
        };
    });
}
function mapEvidenceList(value) {
    const artifacts = asArray(value) ?? [];
    return artifacts
        .map((artifact, index) => mapEvidence(artifact, index))
        .filter((artifact) => artifact !== undefined);
}
function mapEvidence(value, index) {
    const artifact = asRecord(value);
    if (!artifact)
        throw new Error(`artifacts[${index}] must be an object.`);
    const sourcePath = asString(artifact.path);
    if (!sourcePath)
        return undefined;
    const kind = normalizeEvidenceKind(artifact.kind);
    return {
        kind,
        name: asString(artifact.name) ?? `artifact-${index}`,
        path: (0, normalize_1.normalizeEvidencePath)(sourcePath),
        mimeType: asString(artifact.contentType),
        bytes: nonNegativeInteger(asNumber(artifact.bytes)),
        sha256: asString(artifact.sha256),
        format: kind === "trace" ? asString(artifact.format) ?? "playwright" : undefined,
        missing: asBoolean(artifact.missing),
    };
}
function normalizeEvidenceKind(value) {
    const kind = asString(value);
    if (kind === "screenshot" ||
        kind === "video" ||
        kind === "trace" ||
        kind === "log" ||
        kind === "file" ||
        kind === "native-report") {
        return kind;
    }
    return "file";
}
function normalizeLogStream(value) {
    if (value === "stdout" || value === "stderr" || value === "system") {
        return value;
    }
    return "system";
}
function asRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? value
        : undefined;
}
function asArray(value) {
    return Array.isArray(value) ? value : undefined;
}
function asString(value) {
    return typeof value === "string" ? value : undefined;
}
function asStringArray(value) {
    return Array.isArray(value)
        ? value.filter((item) => typeof item === "string")
        : undefined;
}
function nonEmptyStrings(value) {
    return value && value.length > 0 ? value : undefined;
}
function asNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function asBoolean(value) {
    return typeof value === "boolean" ? value : undefined;
}
function requireString(value, pathLabel) {
    const text = asString(value);
    if (!text || text.trim() === "") {
        throw new Error(`${pathLabel} must be a non-empty string.`);
    }
    return text;
}
function positiveInteger(value) {
    return value !== undefined && Number.isInteger(value) && value >= 1
        ? value
        : undefined;
}
function nonNegativeInteger(value) {
    return value !== undefined && Number.isInteger(value) && value >= 0
        ? value
        : undefined;
}
