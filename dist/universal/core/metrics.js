"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sumTestDurations = sumTestDurations;
exports.createSummary = createSummary;
exports.createSuiteRecords = createSuiteRecords;
exports.createModuleRecords = createModuleRecords;
exports.createSpecRecords = createSpecRecords;
exports.createDerivedReport = createDerivedReport;
function sumTestDurations(tests) {
    return tests.reduce((total, test) => total + test.durationMs, 0);
}
/**
 * Shared metric calculation.
 *
 * `durationMs` is optional so callers can pass the framework's wall-clock
 * invocation duration for an overall summary. Without it, the duration is the
 * sum of the member tests, which is the correct value for a filtered scope.
 */
function createSummary(tests, durationMs) {
    const count = (status) => tests.filter((test) => test.status === status).length;
    const total = tests.length;
    const passed = count("passed");
    const timedOut = count("timedOut");
    const interrupted = count("interrupted");
    const unknown = count("unknown");
    const summary = {
        total,
        passed,
        failed: count("failed"),
        skipped: count("skipped"),
        flaky: count("flaky"),
        passPercentage: total === 0 ? 0 : Number(((passed / total) * 100).toFixed(1)),
        durationMs: typeof durationMs === "number" &&
            Number.isFinite(durationMs) &&
            durationMs >= 0
            ? durationMs
            : sumTestDurations(tests),
    };
    if (timedOut > 0)
        summary.timedOut = timedOut;
    if (interrupted > 0)
        summary.interrupted = interrupted;
    if (unknown > 0)
        summary.unknown = unknown;
    return summary;
}
function createSuiteRecords(tests) {
    const grouped = groupTests(tests, (test) => test.suites);
    return [...grouped.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, suiteTests]) => ({
        name,
        summary: createSummary(suiteTests),
    }));
}
function createModuleRecords(tests) {
    const grouped = groupTests(tests, (test) => [test.module]);
    return [...grouped.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, moduleTests]) => ({
        name,
        specKeys: [...new Set(moduleTests.map((test) => test.spec.key))].sort(),
        summary: createSummary(moduleTests),
    }));
}
function createSpecRecords(tests) {
    const grouped = groupTests(tests, (test) => [test.spec.key]);
    return [...grouped.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, specTests]) => {
        const first = specTests[0];
        return {
            key,
            name: first.spec.name,
            path: first.spec.path,
            variant: first.variant.name,
            browser: first.variant.browser,
            module: first.module,
            summary: createSummary(specTests),
        };
    });
}
function createDerivedReport(tests, runDurationMs) {
    return {
        summary: createSummary(tests, runDurationMs),
        suites: createSuiteRecords(tests),
        modules: createModuleRecords(tests),
        specs: createSpecRecords(tests),
    };
}
function groupTests(tests, keysFor) {
    const grouped = new Map();
    for (const test of tests) {
        for (const key of keysFor(test)) {
            grouped.set(key, [...(grouped.get(key) ?? []), test]);
        }
    }
    return grouped;
}
