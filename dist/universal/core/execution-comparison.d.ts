import type { ComparisonTestSnapshot, DashboardStatus, SummaryRecord } from "../../report-types";
export type { ComparisonTestSnapshot } from "../../report-types";
export type ComparisonRun = {
    runId: string;
    startTime: string;
    environment: string;
    summary: SummaryRecord;
    tests?: ComparisonTestSnapshot[];
};
export type ComparisonTestChange = {
    key: string;
    id: string;
    title: string;
    file: string;
    suites: string[];
    project: string;
    browser: string;
    repeatEachIndex: number;
    baselineStatus?: DashboardStatus;
    currentStatus?: DashboardStatus;
    baselineRetryAttempts?: number;
    currentRetryAttempts?: number;
    baselineRetriesConfigured?: number;
    currentRetriesConfigured?: number;
    reasons: string[];
};
type MetricDelta = {
    baseline: number;
    current: number;
    delta: number;
};
export type AvailableExecutionComparison = {
    available: true;
    baselineRunId: string;
    currentRunId: string;
    context: {
        baselineEnvironment: string;
        currentEnvironment: string;
        environmentChanged: boolean;
    };
    metrics: {
        total: MetricDelta;
        passPercentage: MetricDelta;
        durationMs: MetricDelta;
    };
    newlyFailed: ComparisonTestChange[];
    resolved: ComparisonTestChange[];
    recurring: ComparisonTestChange[];
    nonExecuted: ComparisonTestChange[];
    missingFromBaseline: ComparisonTestChange[];
    missingFromCurrent: ComparisonTestChange[];
    retryChanges: ComparisonTestChange[];
    unchangedPassing: ComparisonTestChange[];
};
export type ExecutionComparison = AvailableExecutionComparison | {
    available: false;
    reason: string;
};
export type SnapshotProjectionOptions = {
    /** False when a source schema requires zero values despite no retry telemetry. */
    retryTelemetryAvailable?: boolean;
    /** Controls whether compact snapshots may expose attempt duration telemetry. */
    timingGranularity?: "run" | "test" | "attempt";
};
export declare function toComparisonSnapshots(tests: readonly unknown[], options?: SnapshotProjectionOptions): ComparisonTestSnapshot[];
/**
 * This function is intentionally self-contained. The dashboard template embeds
 * its compiled JavaScript source so Node tests and static reports use the exact
 * same deterministic comparison rules.
 */
export declare function compareExecutions(baseline: ComparisonRun, current: ComparisonRun): ExecutionComparison;
