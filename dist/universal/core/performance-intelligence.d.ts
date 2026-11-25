import type { HistoricalObservationStatus, HistoryRecord } from "../../report-types";
export type TestPerformanceOptions = {
    maxHistoricalRuns: number;
    minHistoricalSamples: number;
    slowTestThresholdMs: number;
    absoluteChangeThresholdMs: number;
    relativeChangeThresholdPercent: number;
};
export declare const DEFAULT_TEST_PERFORMANCE_OPTIONS: TestPerformanceOptions;
export type DurationState = "measured" | "missing" | "skipped" | "interrupted" | "unusable" | "insufficient";
export type DurationObservation = {
    runId: string;
    startTime: string;
    status?: HistoricalObservationStatus;
    durationState: DurationState;
    durationMs?: number;
    reportAvailable: boolean;
    evidenceAvailable: boolean;
    dashboardPath: string;
    current: boolean;
};
export type RetryOverhead = {
    available: true;
    initialAttemptDurationMs: number;
    subsequentAttemptDurationsMs: number[];
    retryOverheadMs: number;
    totalTestDurationMs: number;
} | {
    available: false;
    reason: string;
};
export type PerformanceClassification = "regression" | "improvement" | "stable" | "insufficient-history" | "unusable-current";
export type TestPerformanceRecord = {
    key: string;
    id: string;
    title: string;
    file: string;
    suites: string[];
    module: string;
    environment: string;
    project: string;
    browser: string;
    repeatEachIndex: number;
    status: HistoricalObservationStatus;
    currentDurationMs?: number;
    slow: boolean;
    baseline: {
        medianDurationMs?: number;
        sampleCount: number;
    };
    difference?: {
        absoluteMs: number;
        percentage?: number;
    };
    classification: {
        kind: PerformanceClassification;
        reasons: string[];
    };
    retryOverhead: RetryOverhead;
    observations: DurationObservation[];
};
export type PerformanceBottleneckGroup = {
    name: string;
    summedTestDurationMs: number;
    measuredTestCount: number;
    testCount: number;
};
export type AvailableTestPerformanceIntelligence = {
    available: true;
    selectedRunId: string;
    options: TestPerformanceOptions;
    tests: TestPerformanceRecord[];
    slowestTests: TestPerformanceRecord[];
    regressions: TestPerformanceRecord[];
    improvements: TestPerformanceRecord[];
    bottlenecks: {
        wallClockDurationMs: number;
        summedTestDurationMs: number;
        durationCoverage: {
            measured: number;
            total: number;
        };
        suites: PerformanceBottleneckGroup[];
        modules: PerformanceBottleneckGroup[];
        interpretation: string;
    };
};
export type TestPerformanceIntelligence = AvailableTestPerformanceIntelligence | {
    available: false;
    reason: string;
};
type PerformanceRun = Pick<HistoryRecord, "runId" | "startTime" | "environment" | "browsers" | "projects" | "summary" | "dashboardPath" | "dashboardAvailable" | "tests">;
/**
 * Self-contained so static dashboards and Node tests execute identical rules.
 */
export declare function analyzeTestPerformance(inputRuns: readonly PerformanceRun[], selectedRunId: string, inputOptions?: Partial<TestPerformanceOptions>): TestPerformanceIntelligence;
export {};
