"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeTestStatus = normalizeTestStatus;
exports.normalizeAttemptStatus = normalizeAttemptStatus;
exports.normalizeRunStatus = normalizeRunStatus;
exports.normalizeStepStatus = normalizeStepStatus;
exports.deriveTestStatus = deriveTestStatus;
exports.normalizeTimestamp = normalizeTimestamp;
exports.normalizeDurationMs = normalizeDurationMs;
exports.secondsToMilliseconds = secondsToMilliseconds;
exports.normalizeRetries = normalizeRetries;
exports.normalizeEvidencePath = normalizeEvidencePath;
exports.redactText = redactText;
const paths_1 = require("../schema/paths");
const STATUS_ALIASES = {
    passed: "passed",
    pass: "passed",
    success: "passed",
    succeeded: "passed",
    ok: "passed",
    expected: "passed",
    failed: "failed",
    fail: "failed",
    failure: "failed",
    error: "failed",
    unexpected: "failed",
    broken: "failed",
    skipped: "skipped",
    skip: "skipped",
    pending: "skipped",
    disabled: "skipped",
    notrun: "skipped",
    ignored: "skipped",
    flaky: "flaky",
    timedout: "timedOut",
    timeout: "timedOut",
    interrupted: "interrupted",
    unknown: "unknown",
};
function normalizeTestStatus(value) {
    const key = String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, "");
    return STATUS_ALIASES[key] ?? "unknown";
}
function normalizeAttemptStatus(value) {
    const status = normalizeTestStatus(value);
    return status === "flaky" ? "unknown" : status;
}
function normalizeRunStatus(value) {
    const status = normalizeTestStatus(value);
    if (status === "passed")
        return "passed";
    if (status === "failed" || status === "flaky")
        return "failed";
    if (status === "timedOut")
        return "timedOut";
    if (status === "interrupted")
        return "interrupted";
    return "unknown";
}
function normalizeStepStatus(value) {
    const status = normalizeTestStatus(value);
    if (status === "passed")
        return "passed";
    if (status === "skipped")
        return "skipped";
    return "failed";
}
/**
 * Derives a test-level status from attempts. A supplied status wins when it is
 * meaningful, because only the source framework knows its retry semantics.
 */
function deriveTestStatus(attempts, reportedStatus) {
    const reported = normalizeTestStatus(reportedStatus);
    if (reportedStatus !== undefined && reported !== "unknown") {
        return reported;
    }
    if (attempts.length === 0)
        return "unknown";
    const statuses = attempts.map((attempt) => normalizeAttemptStatus(attempt.status));
    const last = statuses[statuses.length - 1];
    const earlier = statuses.slice(0, -1);
    const earlierFailed = earlier.some((status) => status === "failed" ||
        status === "timedOut" ||
        status === "interrupted");
    if (last === "passed" && earlierFailed)
        return "flaky";
    if (last === "passed")
        return "passed";
    if (last === "skipped")
        return "skipped";
    if (last === "failed")
        return "failed";
    if (last === "timedOut")
        return "timedOut";
    if (last === "interrupted")
        return "interrupted";
    return "unknown";
}
function normalizeTimestamp(value, fallback) {
    const candidate = value instanceof Date
        ? value
        : typeof value === "string"
            ? new Date(value)
            : undefined;
    if (candidate && Number.isFinite(candidate.getTime())) {
        return candidate.toISOString();
    }
    if (fallback !== undefined) {
        const fallbackDate = new Date(fallback);
        if (Number.isFinite(fallbackDate.getTime())) {
            return fallbackDate.toISOString();
        }
    }
    throw new Error(`Invalid timestamp: ${String(value)}`);
}
function normalizeDurationMs(value, fallback = 0) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        return value;
    }
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed >= 0)
            return parsed;
    }
    return fallback;
}
function secondsToMilliseconds(value, fallbackMs = 0) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        return value * 1000;
    }
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed >= 0)
            return parsed * 1000;
    }
    return fallbackMs;
}
function normalizeRetries(configured, attempts) {
    const attemptCount = typeof attempts === "number" ? attempts : attempts.length;
    const configuredNumber = typeof configured === "number" &&
        Number.isFinite(configured) &&
        configured >= 0
        ? Math.floor(configured)
        : 0;
    return {
        configured: configuredNumber,
        used: Math.max(0, attemptCount - 1),
    };
}
/** Converts a legacy dashboard-relative path into a run-root-relative path. */
function normalizeEvidencePath(value) {
    return (0, paths_1.toRunRelativePath)(value);
}
/**
 * Defense-in-depth redaction for messages, stacks, step titles, and logs.
 * Adapters should call this before writing canonical results.
 */
function redactText(value, policy = {}) {
    const replacement = policy.replacement ?? "[REDACTED]";
    let redacted = value;
    for (const sensitiveValue of policy.values ?? []) {
        if (sensitiveValue) {
            redacted = redacted.replaceAll(sensitiveValue, () => replacement);
        }
    }
    for (const pattern of policy.patterns ?? []) {
        const flags = pattern.flags.includes("g")
            ? pattern.flags
            : `${pattern.flags}g`;
        redacted = redacted.replace(new RegExp(pattern.source, flags), () => replacement);
    }
    return redacted;
}
