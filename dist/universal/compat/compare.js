"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compareLegacyResults = compareLegacyResults;
const metrics_1 = require("../core/metrics");
const paths_1 = require("../schema/paths");
const legacy_playwright_1 = require("./legacy-playwright");
const SUMMARY_FIELDS = [
    "total",
    "passed",
    "failed",
    "skipped",
    "flaky",
    "passPercentage",
    "durationMs",
];
/**
 * Compares the stored legacy results.json model with the model derived from
 * the canonical projection. This is read-only and never touches the report
 * directory.
 */
function compareLegacyResults(value) {
    const source = asRecord(value);
    if (!source)
        throw new Error("Legacy results document must be an object.");
    const schemaVersion = String(source.schemaVersion ?? "unknown");
    const sourceRun = asRecord(source.run);
    const runId = asString(sourceRun?.id) ?? "unknown";
    const canonical = (0, legacy_playwright_1.fromLegacyResultsDocument)(value);
    const derived = (0, metrics_1.createDerivedReport)(canonical.tests, canonical.run.durationMs);
    const differences = [];
    const checked = [];
    const sourceSummary = asRecord(source.summary);
    if (sourceSummary) {
        checked.push("summary");
        compareSummary(sourceSummary, derived.summary, differences, "summary");
    }
    if (schemaVersion === "2") {
        checked.push("suites", "modules", "specs");
        compareValue("suites", source.suites, derived.suites, differences);
        compareValue("modules", source.modules, derived.modules, differences);
        compareValue("specs", normalizeLegacySpecs(source.specs), derived.specs, differences);
    }
    checked.push("tests");
    compareTests(source.tests, canonical, differences);
    return { runId, schemaVersion, checked, differences };
}
function compareSummary(legacy, universal, differences, prefix) {
    for (const field of SUMMARY_FIELDS) {
        compareValue(`${prefix}.${field}`, legacy[field], universal[field], differences);
    }
}
function compareTests(legacyTestsValue, canonical, differences) {
    const legacyTests = asArray(legacyTestsValue) ?? [];
    if (legacyTests.length !== canonical.tests.length) {
        addDifference(differences, "tests.length", legacyTests.length, canonical.tests.length);
    }
    legacyTests.forEach((legacyValue, index) => {
        const legacy = asRecord(legacyValue);
        const test = canonical.tests[index];
        if (!legacy || !test)
            return;
        const prefix = `tests[${index}]`;
        compareValue(`${prefix}.id`, legacy.id, test.id, differences);
        compareValue(`${prefix}.title`, legacy.title, test.title, differences);
        compareValue(`${prefix}.status`, legacy.status, test.status, differences);
        compareValue(`${prefix}.durationMs`, legacy.durationMs, test.durationMs, differences);
        compareValue(`${prefix}.retriesConfigured`, legacy.retriesConfigured, test.retries.configured, differences);
        compareValue(`${prefix}.retryAttempts`, legacy.retryAttempts, test.retries.used, differences);
        compareValue(`${prefix}.tags`, legacy.tags, test.labels, differences);
        if (canonical.producer.sourceSchemaVersion === "2") {
            compareValue(`${prefix}.suites`, legacy.suites, test.suites, differences);
            compareValue(`${prefix}.module`, legacy.module, test.module, differences);
            compareValue(`${prefix}.project`, legacy.project, test.variant.name, differences);
            compareValue(`${prefix}.browser`, legacy.browser, test.variant.browser, differences);
            compareValue(`${prefix}.repeatEachIndex`, legacy.repeatEachIndex, test.variant.repeat, differences);
            compareValue(`${prefix}.file`, legacy.file, test.source.file, differences);
            compareValue(`${prefix}.line`, legacy.line, test.source.line, differences);
            compareValue(`${prefix}.column`, legacy.column, test.source.column, differences);
            compareValue(`${prefix}.spec`, legacy.spec, test.spec, differences);
        }
        compareAttempts(legacy.attempts, test, differences, prefix);
    });
}
function compareAttempts(legacyAttemptsValue, test, differences, prefix) {
    const legacyAttempts = asArray(legacyAttemptsValue) ?? [];
    if (legacyAttempts.length !== test.attempts.length) {
        addDifference(differences, `${prefix}.attempts.length`, legacyAttempts.length, test.attempts.length);
    }
    legacyAttempts.forEach((legacyValue, index) => {
        const legacy = asRecord(legacyValue);
        const attempt = test.attempts[index];
        if (!legacy || !attempt)
            return;
        const attemptPrefix = `${prefix}.attempts[${index}]`;
        compareValue(`${attemptPrefix}.status`, legacy.status, attempt.status, differences);
        compareValue(`${attemptPrefix}.durationMs`, legacy.durationMs, attempt.durationMs, differences);
        compareValue(`${attemptPrefix}.retry`, legacy.retry, attempt.retry, differences);
        compareValue(`${attemptPrefix}.startTime`, legacy.startTime, attempt.startedAt, differences);
        compareValue(`${attemptPrefix}.workerIndex`, legacy.workerIndex, attempt.executor?.workerIndex, differences);
        compareErrors(legacy.errors, attempt.errors, differences, `${attemptPrefix}.errors`);
        compareSteps(legacy.steps, attempt.steps, differences, `${attemptPrefix}.steps`);
        compareLogs(legacy.logs, attempt.logs, differences, `${attemptPrefix}.logs`);
        compareEvidence(legacy.artifacts, attempt.evidence, differences, `${attemptPrefix}.artifacts`);
    });
}
function compareErrors(legacyErrorsValue, universalErrors, differences, prefix) {
    const legacyErrors = asArray(legacyErrorsValue) ?? [];
    if (legacyErrors.length !== universalErrors.length) {
        addDifference(differences, `${prefix}.length`, legacyErrors.length, universalErrors.length);
    }
    legacyErrors.forEach((legacyValue, index) => {
        const legacy = asRecord(legacyValue);
        const error = universalErrors[index];
        if (!legacy || !error)
            return;
        for (const field of [
            "message",
            "stack",
            "snippet",
            "expected",
            "actual",
            "type",
        ]) {
            if (legacy[field] !== undefined) {
                compareValue(`${prefix}[${index}].${field}`, legacy[field], error[field], differences);
            }
        }
    });
}
function compareSteps(legacyStepsValue, universalSteps, differences, prefix) {
    const legacySteps = asArray(legacyStepsValue) ?? [];
    if (legacySteps.length !== universalSteps.length) {
        addDifference(differences, `${prefix}.length`, legacySteps.length, universalSteps.length);
    }
    legacySteps.forEach((legacyValue, index) => {
        const legacy = asRecord(legacyValue);
        const step = universalSteps[index];
        if (!legacy || !step)
            return;
        const stepPrefix = `${prefix}[${index}]`;
        compareValue(`${stepPrefix}.title`, legacy.title, step.title, differences);
        compareValue(`${stepPrefix}.subtitle`, legacy.subtitle, step.subtitle, differences);
        compareValue(`${stepPrefix}.category`, legacy.category, step.category, differences);
        compareValue(`${stepPrefix}.status`, legacy.status, step.status, differences);
        compareValue(`${stepPrefix}.durationMs`, legacy.durationMs, step.durationMs, differences);
        compareValue(`${stepPrefix}.startTime`, legacy.startTime, step.startedAt, differences);
        if (legacy.error !== undefined || step.error !== undefined) {
            compareErrors(legacy.error === undefined ? [] : [legacy.error], step.error === undefined ? [] : [step.error], differences, `${stepPrefix}.error`);
        }
        compareSteps(legacy.steps, step.steps, differences, `${stepPrefix}.steps`);
    });
}
function compareLogs(legacyLogsValue, universalLogs, differences, prefix) {
    const legacyLogs = asArray(legacyLogsValue) ?? [];
    if (legacyLogs.length !== universalLogs.length) {
        addDifference(differences, `${prefix}.length`, legacyLogs.length, universalLogs.length);
    }
    legacyLogs.forEach((legacyValue, index) => {
        const legacy = asRecord(legacyValue);
        const log = universalLogs[index];
        if (!legacy || !log)
            return;
        compareValue(`${prefix}[${index}].stream`, legacy.stream, log.stream, differences);
        compareValue(`${prefix}[${index}].timestamp`, legacy.timestamp, log.timestamp, differences);
        compareValue(`${prefix}[${index}].text`, legacy.text, log.text, differences);
    });
}
function compareEvidence(legacyArtifactsValue, universalEvidence, differences, prefix) {
    const legacyArtifacts = asArray(legacyArtifactsValue) ?? [];
    if (legacyArtifacts.length !== universalEvidence.length) {
        addDifference(differences, `${prefix}.length`, legacyArtifacts.length, universalEvidence.length);
    }
    legacyArtifacts.forEach((legacyValue, index) => {
        const legacy = asRecord(legacyValue);
        const evidence = universalEvidence[index];
        if (!legacy || !evidence)
            return;
        compareValue(`${prefix}[${index}].kind`, legacy.kind, evidence.kind, differences);
        compareValue(`${prefix}[${index}].name`, legacy.name, evidence.name, differences);
        compareValue(`${prefix}[${index}].contentType`, legacy.contentType, evidence.mimeType, differences);
        const legacyPath = asString(legacy.path);
        compareValue(`${prefix}[${index}].path`, legacyPath === undefined ? undefined : (0, paths_1.toRunRelativePath)(legacyPath), evidence.path, differences);
    });
}
function normalizeLegacySpecs(value) {
    const specs = asArray(value);
    if (!specs)
        return value;
    return specs.map((specValue) => {
        const spec = asRecord(specValue);
        if (!spec)
            return specValue;
        return {
            key: spec.key,
            name: spec.name,
            path: spec.path,
            variant: spec.project,
            browser: spec.browser,
            module: spec.module,
            summary: spec.summary,
        };
    });
}
function compareValue(path, legacy, universal, differences) {
    if (!deepEqual(legacy, universal)) {
        addDifference(differences, path, legacy, universal);
    }
}
function addDifference(differences, path, legacy, universal) {
    differences.push({ path, legacy, universal });
}
function deepEqual(left, right) {
    if (Object.is(left, right))
        return true;
    if (Array.isArray(left) || Array.isArray(right)) {
        if (!Array.isArray(left) || !Array.isArray(right))
            return false;
        if (left.length !== right.length)
            return false;
        return left.every((value, index) => deepEqual(value, right[index]));
    }
    if (isRecord(left) || isRecord(right)) {
        if (!isRecord(left) || !isRecord(right))
            return false;
        const leftKeys = Object.keys(left);
        const rightKeys = Object.keys(right);
        if (leftKeys.length !== rightKeys.length)
            return false;
        return leftKeys.every((key) => Object.hasOwn(right, key) && deepEqual(left[key], right[key]));
    }
    return false;
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
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
