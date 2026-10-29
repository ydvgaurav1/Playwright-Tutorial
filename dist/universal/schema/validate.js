"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchemaValidationError = void 0;
exports.validateRunDocument = validateRunDocument;
exports.assertValidRunDocument = assertValidRunDocument;
exports.parseRunDocument = parseRunDocument;
exports.stringifyRunDocument = stringifyRunDocument;
exports.isRunDocument = isRunDocument;
const types_1 = require("./types");
const paths_1 = require("./paths");
class SchemaValidationError extends Error {
    issues;
    constructor(issues) {
        super(`Invalid universal QA report: ${issues.length} validation issue(s)`);
        this.name = "SchemaValidationError";
        this.issues = issues;
    }
}
exports.SchemaValidationError = SchemaValidationError;
const TEST_STATUSES = [
    "passed",
    "failed",
    "skipped",
    "flaky",
    "timedOut",
    "interrupted",
    "unknown",
];
const ATTEMPT_STATUSES = [
    "passed",
    "failed",
    "skipped",
    "timedOut",
    "interrupted",
    "unknown",
];
const RUN_STATUSES = [
    "passed",
    "failed",
    "timedOut",
    "interrupted",
    "unknown",
];
const STEP_STATUSES = ["passed", "failed", "skipped"];
const EVIDENCE_KINDS = [
    "screenshot",
    "video",
    "trace",
    "log",
    "file",
    "native-report",
];
const LOG_STREAMS = ["stdout", "stderr", "system"];
function validateRunDocument(value) {
    const issues = [];
    const document = asRecord(value, "$", issues);
    if (!document)
        return { ok: false, issues };
    const version = stringValue(document.schemaVersion, "$.schemaVersion", issues);
    if (version !== undefined && version !== types_1.SCHEMA_VERSION) {
        addIssue(issues, "$.schemaVersion", `must be "${types_1.SCHEMA_VERSION}" (received "${version}")`);
    }
    validateProducer(document.producer, "$.producer", issues);
    const run = validateRun(document.run, "$.run", issues);
    validateEnvironment(document.environment, "$.environment", issues);
    validateLabels(document.labels, "$.labels", issues);
    validateCapabilities(document.capabilities, "$.capabilities", issues);
    validateExternalReports(document.externalReports, "$.externalReports", issues);
    const tests = arrayValue(document.tests, "$.tests", issues, true);
    const testIds = new Set();
    if (tests) {
        tests.forEach((test, index) => {
            const id = validateTest(test, `$.tests[${index}]`, issues);
            if (!id)
                return;
            if (testIds.has(id)) {
                addIssue(issues, `$.tests[${index}].id`, `duplicate test id "${id}"`);
            }
            testIds.add(id);
        });
    }
    const globalErrors = arrayValue(document.globalErrors, "$.globalErrors", issues, true);
    if (globalErrors) {
        globalErrors.forEach((error, index) => validateError(error, `$.globalErrors[${index}]`, issues));
    }
    if (document.extensions !== undefined) {
        asRecord(document.extensions, "$.extensions", issues);
    }
    if (run?.startedAt && run.endedAt) {
        const start = Date.parse(run.startedAt);
        const end = Date.parse(run.endedAt);
        if (Number.isFinite(start) && Number.isFinite(end) && end < start) {
            addIssue(issues, "$.run.endedAt", "must not be earlier than run.startedAt");
        }
    }
    if (issues.length > 0) {
        return { ok: false, issues };
    }
    return { ok: true, value: value };
}
function assertValidRunDocument(value) {
    const result = validateRunDocument(value);
    if (!result.ok) {
        throw new SchemaValidationError(result.issues);
    }
    return result.value;
}
function parseRunDocument(json) {
    return assertValidRunDocument(JSON.parse(json));
}
function stringifyRunDocument(value) {
    assertValidRunDocument(value);
    return JSON.stringify(value, null, 2);
}
function isRunDocument(value) {
    return validateRunDocument(value).ok;
}
function validateProducer(value, path, issues) {
    const producer = asRecord(value, path, issues);
    if (!producer)
        return;
    stringValue(producer.name, `${path}.name`, issues, true);
    stringValue(producer.version, `${path}.version`, issues, true);
    stringValue(producer.framework, `${path}.framework`, issues, true);
    stringValue(producer.frameworkVersion, `${path}.frameworkVersion`, issues);
    stringValue(producer.sourceSchemaVersion, `${path}.sourceSchemaVersion`, issues);
}
function validateRun(value, path, issues) {
    const run = asRecord(value, path, issues);
    if (!run)
        return undefined;
    stringValue(run.id, `${path}.id`, issues, true);
    enumValue(run.status, RUN_STATUSES, `${path}.status`, issues);
    const startedAt = timestampValue(run.startedAt, `${path}.startedAt`, issues);
    const endedAt = timestampValue(run.endedAt, `${path}.endedAt`, issues);
    numberValue(run.durationMs, `${path}.durationMs`, issues, {
        min: 0,
        required: true,
    });
    stringValue(run.timezone, `${path}.timezone`, issues, true);
    return { startedAt, endedAt };
}
function validateEnvironment(value, path, issues) {
    const environment = asRecord(value, path, issues);
    if (!environment)
        return;
    stringValue(environment.name, `${path}.name`, issues, true);
    for (const field of ["baseUrl", "branch", "commit", "os", "runtime"]) {
        stringValue(environment[field], `${path}.${field}`, issues);
    }
    booleanValue(environment.ci, `${path}.ci`, issues);
    stringArrayValue(environment.browsers, `${path}.browsers`, issues);
    stringArrayValue(environment.projects, `${path}.projects`, issues);
}
function validateLabels(value, path, issues) {
    if (value === undefined)
        return;
    const labels = asRecord(value, path, issues);
    if (!labels)
        return;
    for (const [key, label] of Object.entries(labels)) {
        stringValue(label, `${path}.${key}`, issues);
    }
}
function validateCapabilities(value, path, issues) {
    const capabilities = asRecord(value, path, issues);
    if (!capabilities)
        return;
    for (const field of ["steps", "retries", "logs", "attachments"]) {
        booleanValue(capabilities[field], `${path}.${field}`, issues, true);
    }
    stringArrayValue(capabilities.traceFormats, `${path}.traceFormats`, issues, true);
    enumValue(capabilities.timings, ["run", "test", "attempt"], `${path}.timings`, issues);
}
function validateExternalReports(value, path, issues) {
    if (value === undefined)
        return;
    const reports = arrayValue(value, path, issues, true);
    if (!reports)
        return;
    reports.forEach((report, index) => {
        const reportPath = `${path}[${index}]`;
        const record = asRecord(report, reportPath, issues);
        if (!record)
            return;
        stringValue(record.label, `${reportPath}.label`, issues, true);
        const relativePath = stringValue(record.path, `${reportPath}.path`, issues, true);
        if (relativePath && !(0, paths_1.isSafeRelativePath)(relativePath)) {
            addIssue(issues, `${reportPath}.path`, "must be a safe run-relative path");
        }
        if (record.kind !== undefined) {
            enumValue(record.kind, ["html", "json", "xml", "other"], `${reportPath}.kind`, issues);
        }
    });
}
function validateTest(value, path, issues) {
    const test = asRecord(value, path, issues);
    if (!test)
        return undefined;
    const id = stringValue(test.id, `${path}.id`, issues, true);
    stringValue(test.nativeId, `${path}.nativeId`, issues);
    stringValue(test.idStrategy, `${path}.idStrategy`, issues);
    stringValue(test.title, `${path}.title`, issues, true);
    stringArrayValue(test.titlePath, `${path}.titlePath`, issues, true);
    stringArrayValue(test.labels, `${path}.labels`, issues, true);
    stringArrayValue(test.suites, `${path}.suites`, issues, true);
    stringValue(test.module, `${path}.module`, issues, true);
    validateSpec(test.spec, `${path}.spec`, issues);
    validateSource(test.source, `${path}.source`, issues);
    validateVariant(test.variant, `${path}.variant`, issues);
    enumValue(test.status, TEST_STATUSES, `${path}.status`, issues);
    numberValue(test.durationMs, `${path}.durationMs`, issues, {
        min: 0,
        required: true,
    });
    validateRetries(test.retries, `${path}.retries`, issues);
    const attempts = arrayValue(test.attempts, `${path}.attempts`, issues, true);
    if (attempts) {
        if (attempts.length === 0) {
            addIssue(issues, `${path}.attempts`, "must contain at least one attempt");
        }
        const indexes = new Set();
        attempts.forEach((attempt, index) => {
            const attemptIndex = validateAttempt(attempt, `${path}.attempts[${index}]`, issues);
            if (attemptIndex === undefined)
                return;
            if (indexes.has(attemptIndex)) {
                addIssue(issues, `${path}.attempts[${index}].index`, `duplicate attempt index "${attemptIndex}"`);
            }
            indexes.add(attemptIndex);
        });
    }
    if (test.extensions !== undefined) {
        asRecord(test.extensions, `${path}.extensions`, issues);
    }
    return id;
}
function validateSpec(value, path, issues) {
    const spec = asRecord(value, path, issues);
    if (!spec)
        return;
    stringValue(spec.key, `${path}.key`, issues, true);
    stringValue(spec.name, `${path}.name`, issues, true);
    stringValue(spec.path, `${path}.path`, issues, true);
}
function validateSource(value, path, issues) {
    const source = asRecord(value, path, issues);
    if (!source)
        return;
    stringValue(source.file, `${path}.file`, issues, true);
    numberValue(source.line, `${path}.line`, issues, { min: 1, integer: true });
    numberValue(source.column, `${path}.column`, issues, { min: 1, integer: true });
}
function validateVariant(value, path, issues) {
    const variant = asRecord(value, path, issues);
    if (!variant)
        return;
    stringValue(variant.name, `${path}.name`, issues, true);
    stringValue(variant.browser, `${path}.browser`, issues);
    stringValue(variant.device, `${path}.device`, issues);
    numberValue(variant.repeat, `${path}.repeat`, issues, { min: 0, integer: true });
}
function validateRetries(value, path, issues) {
    const retries = asRecord(value, path, issues);
    if (!retries)
        return;
    numberValue(retries.configured, `${path}.configured`, issues, {
        min: 0,
        integer: true,
        required: true,
    });
    numberValue(retries.used, `${path}.used`, issues, {
        min: 0,
        integer: true,
        required: true,
    });
}
function validateAttempt(value, path, issues) {
    const attempt = asRecord(value, path, issues);
    if (!attempt)
        return undefined;
    const index = numberValue(attempt.index, `${path}.index`, issues, {
        min: 1,
        integer: true,
        required: true,
    });
    numberValue(attempt.retry, `${path}.retry`, issues, {
        min: 0,
        integer: true,
        required: true,
    });
    enumValue(attempt.status, ATTEMPT_STATUSES, `${path}.status`, issues);
    timestampValue(attempt.startedAt, `${path}.startedAt`, issues);
    numberValue(attempt.durationMs, `${path}.durationMs`, issues, {
        min: 0,
        required: true,
    });
    validateExecutor(attempt.executor, `${path}.executor`, issues);
    const errors = arrayValue(attempt.errors, `${path}.errors`, issues, true);
    errors?.forEach((error, errorIndex) => validateError(error, `${path}.errors[${errorIndex}]`, issues));
    const steps = arrayValue(attempt.steps, `${path}.steps`, issues, true);
    steps?.forEach((step, stepIndex) => validateStep(step, `${path}.steps[${stepIndex}]`, issues));
    const logs = arrayValue(attempt.logs, `${path}.logs`, issues, true);
    logs?.forEach((log, logIndex) => validateLog(log, `${path}.logs[${logIndex}]`, issues));
    const evidence = arrayValue(attempt.evidence, `${path}.evidence`, issues, true);
    evidence?.forEach((item, evidenceIndex) => validateEvidence(item, `${path}.evidence[${evidenceIndex}]`, issues));
    if (attempt.extensions !== undefined) {
        asRecord(attempt.extensions, `${path}.extensions`, issues);
    }
    return index;
}
function validateExecutor(value, path, issues) {
    if (value === undefined)
        return;
    const executor = asRecord(value, path, issues);
    if (!executor)
        return;
    stringValue(executor.id, `${path}.id`, issues);
    stringValue(executor.host, `${path}.host`, issues);
    numberValue(executor.workerIndex, `${path}.workerIndex`, issues, {
        min: 0,
        integer: true,
    });
}
function validateError(value, path, issues) {
    const error = asRecord(value, path, issues);
    if (!error)
        return;
    stringValue(error.message, `${path}.message`, issues, true);
    for (const field of ["type", "stack", "snippet", "expected", "actual"]) {
        stringValue(error[field], `${path}.${field}`, issues);
    }
}
function validateStep(value, path, issues) {
    const step = asRecord(value, path, issues);
    if (!step)
        return;
    stringValue(step.title, `${path}.title`, issues, true);
    stringValue(step.subtitle, `${path}.subtitle`, issues);
    stringValue(step.category, `${path}.category`, issues, true);
    enumValue(step.status, STEP_STATUSES, `${path}.status`, issues);
    timestampValue(step.startedAt, `${path}.startedAt`, issues);
    numberValue(step.durationMs, `${path}.durationMs`, issues, {
        min: 0,
        required: true,
    });
    if (step.error !== undefined) {
        validateError(step.error, `${path}.error`, issues);
    }
    const children = arrayValue(step.steps, `${path}.steps`, issues, true);
    children?.forEach((child, index) => validateStep(child, `${path}.steps[${index}]`, issues));
}
function validateLog(value, path, issues) {
    const log = asRecord(value, path, issues);
    if (!log)
        return;
    enumValue(log.stream, LOG_STREAMS, `${path}.stream`, issues);
    timestampValue(log.timestamp, `${path}.timestamp`, issues);
    stringValue(log.text, `${path}.text`, issues, true);
    booleanValue(log.truncated, `${path}.truncated`, issues);
}
function validateEvidence(value, path, issues) {
    const evidence = asRecord(value, path, issues);
    if (!evidence)
        return;
    enumValue(evidence.kind, EVIDENCE_KINDS, `${path}.kind`, issues);
    stringValue(evidence.name, `${path}.name`, issues, true);
    const relativePath = stringValue(evidence.path, `${path}.path`, issues, true);
    if (relativePath && !(0, paths_1.isSafeRelativePath)(relativePath)) {
        addIssue(issues, `${path}.path`, "must be a safe run-relative path");
    }
    stringValue(evidence.mimeType, `${path}.mimeType`, issues);
    numberValue(evidence.bytes, `${path}.bytes`, issues, { min: 0 });
    stringValue(evidence.sha256, `${path}.sha256`, issues);
    stringValue(evidence.format, `${path}.format`, issues);
    booleanValue(evidence.missing, `${path}.missing`, issues);
}
function asRecord(value, path, issues) {
    if (!isRecord(value)) {
        addIssue(issues, path, "must be an object");
        return undefined;
    }
    return value;
}
function arrayValue(value, path, issues, required = false) {
    if (value === undefined) {
        if (required)
            addIssue(issues, path, "is required");
        return undefined;
    }
    if (!Array.isArray(value)) {
        addIssue(issues, path, "must be an array");
        return undefined;
    }
    return value;
}
function stringArrayValue(value, path, issues, required = false) {
    const items = arrayValue(value, path, issues, required);
    if (!items)
        return undefined;
    const strings = [];
    items.forEach((item, index) => {
        const text = stringValue(item, `${path}[${index}]`, issues);
        if (text !== undefined)
            strings.push(text);
    });
    return strings;
}
function stringValue(value, path, issues, required = false) {
    if (value === undefined) {
        if (required)
            addIssue(issues, path, "is required");
        return undefined;
    }
    if (typeof value !== "string") {
        addIssue(issues, path, "must be a string");
        return undefined;
    }
    if (required && value.trim() === "") {
        addIssue(issues, path, "must not be empty");
        return undefined;
    }
    return value;
}
function numberValue(value, path, issues, options = {}) {
    if (value === undefined) {
        if (options.required)
            addIssue(issues, path, "is required");
        return undefined;
    }
    if (typeof value !== "number" || !Number.isFinite(value)) {
        addIssue(issues, path, "must be a finite number");
        return undefined;
    }
    if (options.min !== undefined && value < options.min) {
        addIssue(issues, path, `must be >= ${options.min}`);
        return undefined;
    }
    if (options.integer && !Number.isInteger(value)) {
        addIssue(issues, path, "must be an integer");
        return undefined;
    }
    return value;
}
function booleanValue(value, path, issues, required = false) {
    if (value === undefined) {
        if (required)
            addIssue(issues, path, "is required");
        return undefined;
    }
    if (typeof value !== "boolean") {
        addIssue(issues, path, "must be a boolean");
        return undefined;
    }
    return value;
}
function timestampValue(value, path, issues) {
    const text = stringValue(value, path, issues, true);
    if (text === undefined)
        return undefined;
    if (!Number.isFinite(Date.parse(text))) {
        addIssue(issues, path, "must be a valid ISO 8601 timestamp");
        return undefined;
    }
    return text;
}
function enumValue(value, allowed, path, issues) {
    if (value === undefined) {
        addIssue(issues, path, "is required");
        return undefined;
    }
    if (typeof value !== "string" || !allowed.includes(value)) {
        addIssue(issues, path, `must be one of: ${allowed.join(", ")}`);
        return undefined;
    }
    return value;
}
function addIssue(issues, path, message) {
    issues.push({ path, message });
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
