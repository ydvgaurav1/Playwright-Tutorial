"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toComparisonSnapshots = toComparisonSnapshots;
exports.compareExecutions = compareExecutions;
function toComparisonSnapshots(tests, options = {}) {
    const statuses = new Set([
        "passed",
        "failed",
        "skipped",
        "flaky",
        "timedOut",
        "interrupted",
        "unknown",
    ]);
    return tests
        .map((value) => {
        if (!value || typeof value !== "object")
            return undefined;
        const test = value;
        if (typeof test.id !== "string" ||
            typeof test.title !== "string" ||
            typeof test.status !== "string" ||
            !statuses.has(test.status)) {
            return undefined;
        }
        const variant = asRecord(test.variant);
        const source = asRecord(test.source);
        const retries = asRecord(test.retries);
        const canonical = Boolean(variant && source && retries);
        const project = canonical ? variant?.name : test.project;
        const browser = canonical ? variant?.browser ?? "" : test.browser;
        if (typeof project !== "string" || typeof browser !== "string") {
            return undefined;
        }
        const observationStatus = test.status;
        const dashboardStatus = observationStatus === "passed" ||
            observationStatus === "skipped" ||
            observationStatus === "flaky"
            ? observationStatus
            : "failed";
        const retriesConfigured = options.retryTelemetryAvailable === false
            ? undefined
            : canonical
                ? optionalFiniteNumber(retries?.configured)
                : optionalFiniteNumber(test.retriesConfigured);
        const retryAttempts = options.retryTelemetryAvailable === false
            ? undefined
            : canonical
                ? optionalFiniteNumber(retries?.used)
                : optionalFiniteNumber(test.retryAttempts);
        const attempts = Array.isArray(test.attempts) ? test.attempts : [];
        const missingCanonicalDuration = canonical &&
            attempts.some((attempt) => {
                const attemptRecord = asRecord(attempt);
                const extensions = asRecord(attemptRecord?.extensions);
                const junit = asRecord(extensions?.junit);
                return junit?.durationSource === "missing";
            });
        const durationMs = missingCanonicalDuration ||
            !isUsableDuration(test.durationMs) ||
            (!canonical && test.durationMs === 0)
            ? undefined
            : test.durationMs;
        const attemptDurations = options.timingGranularity === "attempt" && attempts.length > 0
            ? attempts.map((attempt) => optionalDuration(asRecord(attempt)?.durationMs))
            : [];
        const attemptDurationsMs = attemptDurations.length > 0 &&
            attemptDurations.every((duration) => duration !== undefined)
            ? attemptDurations
            : undefined;
        return {
            id: test.id,
            title: test.title,
            file: canonical
                ? typeof source?.file === "string"
                    ? source.file
                    : ""
                : typeof test.file === "string"
                    ? test.file
                    : "",
            suites: Array.isArray(test.suites)
                ? test.suites.filter((suite) => typeof suite === "string")
                : [],
            ...(typeof test.module === "string" ? { module: test.module } : {}),
            status: dashboardStatus,
            ...(canonical && observationStatus !== dashboardStatus
                ? { observationStatus }
                : {}),
            project,
            browser,
            repeatEachIndex: canonical
                ? finiteNumber(variant?.repeat)
                : finiteNumber(test.repeatEachIndex),
            ...(durationMs === undefined ? {} : { durationMs }),
            ...(retriesConfigured === undefined ? {} : { retriesConfigured }),
            ...(retryAttempts === undefined ? {} : { retryAttempts }),
            ...(attemptDurationsMs === undefined ? {} : { attemptDurationsMs }),
        };
    })
        .filter((test) => test !== undefined)
        .sort(compareSnapshots);
}
function finiteNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
function optionalFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value)
        ? value
        : undefined;
}
function isUsableDuration(value) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
function optionalDuration(value) {
    return isUsableDuration(value) ? value : undefined;
}
function asRecord(value) {
    return value && typeof value === "object"
        ? value
        : undefined;
}
function compareSnapshots(left, right) {
    return (left.id.localeCompare(right.id) ||
        left.project.localeCompare(right.project) ||
        left.browser.localeCompare(right.browser) ||
        left.repeatEachIndex - right.repeatEachIndex);
}
/**
 * This function is intentionally self-contained. The dashboard template embeds
 * its compiled JavaScript source so Node tests and static reports use the exact
 * same deterministic comparison rules.
 */
function compareExecutions(baseline, current) {
    if (!Array.isArray(baseline.tests)) {
        return {
            available: false,
            reason: "Baseline execution does not include test-level comparison data.",
        };
    }
    if (!Array.isArray(current.tests)) {
        return {
            available: false,
            reason: "Current execution does not include test-level comparison data.",
        };
    }
    const identity = (environment, item) => [
        environment,
        item.id,
        item.project,
        item.browser,
        String(item.repeatEachIndex),
    ].join("\u0000");
    const byIdentity = (environment, tests) => new Map(tests.map((item) => [identity(environment, item), item]));
    const baselineTests = byIdentity(baseline.environment, baseline.tests);
    const currentTests = byIdentity(current.environment, current.tests);
    const keys = [...new Set([...baselineTests.keys(), ...currentTests.keys()])].sort();
    const newlyFailed = [];
    const resolved = [];
    const recurring = [];
    const nonExecuted = [];
    const missingFromBaseline = [];
    const missingFromCurrent = [];
    const retryChanges = [];
    const unchangedPassing = [];
    const changeFor = (key, before, after, reasons = []) => {
        const item = after ?? before;
        if (!item)
            throw new Error("Comparison change requires at least one test.");
        return {
            key,
            id: item.id,
            title: item.title,
            file: item.file,
            suites: item.suites,
            project: item.project,
            browser: item.browser,
            repeatEachIndex: item.repeatEachIndex,
            baselineStatus: before?.status,
            currentStatus: after?.status,
            baselineRetryAttempts: before?.retryAttempts,
            currentRetryAttempts: after?.retryAttempts,
            baselineRetriesConfigured: before?.retriesConfigured,
            currentRetriesConfigured: after?.retriesConfigured,
            reasons,
        };
    };
    for (const key of keys) {
        const before = baselineTests.get(key);
        const after = currentTests.get(key);
        if (!before) {
            missingFromBaseline.push(changeFor(key, undefined, after, ["Not present in baseline execution"]));
            continue;
        }
        if (!after) {
            missingFromCurrent.push(changeFor(key, before, undefined, ["Not present in current execution"]));
            continue;
        }
        const retryReasons = [];
        if (before.status === "flaky")
            retryReasons.push("Baseline execution is flaky");
        if (after.status === "flaky")
            retryReasons.push("Current execution is flaky");
        if (before.retryAttempts !== undefined &&
            after.retryAttempts !== undefined &&
            before.retryAttempts !== after.retryAttempts) {
            retryReasons.push(`Retries used changed from ${before.retryAttempts} to ${after.retryAttempts}`);
        }
        if (before.retriesConfigured !== undefined &&
            after.retriesConfigured !== undefined &&
            before.retriesConfigured !== after.retriesConfigured) {
            retryReasons.push(`Configured retries changed from ${before.retriesConfigured} to ${after.retriesConfigured}`);
        }
        if (retryReasons.length) {
            retryChanges.push(changeFor(key, before, after, retryReasons));
        }
        if (before.status === "skipped" || after.status === "skipped") {
            nonExecuted.push(changeFor(key, before, after, [
                before.status === "skipped"
                    ? "Baseline execution did not run the test"
                    : "Current execution did not run the test",
            ]));
        }
        else if (after.status === "failed" && before.status === "failed") {
            recurring.push(changeFor(key, before, after, ["Failed in both executions"]));
        }
        else if (after.status === "failed") {
            newlyFailed.push(changeFor(key, before, after, [
                `Status changed from ${before.status} to failed`,
            ]));
        }
        else if (before.status === "failed" && after.status === "passed") {
            resolved.push(changeFor(key, before, after, ["Status changed from failed to passed"]));
        }
        else if (before.status === "passed" && after.status === "passed") {
            unchangedPassing.push(changeFor(key, before, after, ["Passed in both executions"]));
        }
    }
    const delta = (before, after) => ({
        baseline: before,
        current: after,
        delta: after - before,
    });
    return {
        available: true,
        baselineRunId: baseline.runId,
        currentRunId: current.runId,
        context: {
            baselineEnvironment: baseline.environment,
            currentEnvironment: current.environment,
            environmentChanged: baseline.environment !== current.environment,
        },
        metrics: {
            total: delta(baseline.summary.total, current.summary.total),
            passPercentage: delta(baseline.summary.passPercentage, current.summary.passPercentage),
            durationMs: delta(baseline.summary.durationMs, current.summary.durationMs),
        },
        newlyFailed,
        resolved,
        recurring,
        nonExecuted,
        missingFromBaseline,
        missingFromCurrent,
        retryChanges,
        unchangedPassing,
    };
}
