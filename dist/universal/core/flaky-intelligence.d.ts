import type { HistoricalObservationStatus, HistoryRecord } from "../../report-types";
export type FlakyIntelligenceOptions = {
    maxHistoryRuns: number;
    minComparableExecutions: number;
    minInstabilityEvents: number;
    instabilityRateThreshold: number;
};
export declare const DEFAULT_FLAKY_INTELLIGENCE_OPTIONS: FlakyIntelligenceOptions;
export type HistoricalObservationKind = HistoricalObservationStatus | "missing" | "insufficient";
export type HistoricalTestObservation = {
    runId: string;
    startTime: string;
    status: HistoricalObservationKind;
    retryAttempts?: number;
    retriesConfigured?: number;
    reportAvailable: boolean;
    evidenceAvailable: boolean;
    dashboardPath: string;
};
export type MeasuredFrequency = {
    numerator: number;
    denominator: number;
    percentage: number;
};
export type InstabilityClassificationKind = "stable" | "isolated-failure" | "retry-observed" | "persistent-failure" | "historically-intermittent" | "retry-dependent" | "repeated-instability" | "insufficient-data";
export type HistoricalTestIntelligence = {
    key: string;
    id: string;
    title: string;
    file: string;
    suites: string[];
    environment: string;
    project: string;
    browser: string;
    repeatEachIndex: number;
    counts: {
        comparable: number;
        executed: number;
        passed: number;
        finalFailures: number;
        retryObserved: number;
        retryMeasured: number;
        skipped: number;
        interrupted: number;
        timedOut: number;
        unknown: number;
        missing: number;
        insufficient: number;
    };
    failureFrequency: MeasuredFrequency;
    retryFrequency: MeasuredFrequency;
    measured: {
        passFailIntermittency: boolean;
    };
    classification: {
        kind: InstabilityClassificationKind;
        severity: "none" | "low" | "medium" | "high";
        unstable: boolean;
        reasons: string[];
    };
    window: {
        firstRunId: string;
        lastRunId: string;
        observedRuns: number;
        maxHistoryRuns: number;
    };
    observations: HistoricalTestObservation[];
};
export type HistoricalFlakyIntelligence = {
    options: FlakyIntelligenceOptions;
    tests: HistoricalTestIntelligence[];
};
type HistoricalRun = Pick<HistoryRecord, "runId" | "startTime" | "environment" | "browsers" | "projects" | "dashboardPath" | "dashboardAvailable" | "tests">;
/**
 * Self-contained so the exact tested implementation can be embedded in a
 * static dashboard without a browser-side build or backend.
 */
export declare function analyzeHistoricalFlakiness(inputRuns: readonly HistoricalRun[], inputOptions?: Partial<FlakyIntelligenceOptions>): HistoricalFlakyIntelligence;
export {};
