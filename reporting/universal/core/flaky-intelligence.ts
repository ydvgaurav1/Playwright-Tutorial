import type {
  ComparisonTestSnapshot,
  HistoricalObservationStatus,
  HistoryRecord,
} from "../../report-types";

export type FlakyIntelligenceOptions = {
  maxHistoryRuns: number;
  minComparableExecutions: number;
  minInstabilityEvents: number;
  instabilityRateThreshold: number;
};

export const DEFAULT_FLAKY_INTELLIGENCE_OPTIONS: FlakyIntelligenceOptions = {
  maxHistoryRuns: 12,
  minComparableExecutions: 3,
  minInstabilityEvents: 2,
  instabilityRateThreshold: 25,
};

export type HistoricalObservationKind =
  | HistoricalObservationStatus
  | "missing"
  | "insufficient";

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

export type InstabilityClassificationKind =
  | "stable"
  | "isolated-failure"
  | "retry-observed"
  | "persistent-failure"
  | "historically-intermittent"
  | "retry-dependent"
  | "repeated-instability"
  | "insufficient-data";

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

type HistoricalRun = Pick<
  HistoryRecord,
  | "runId"
  | "startTime"
  | "environment"
  | "browsers"
  | "projects"
  | "dashboardPath"
  | "dashboardAvailable"
  | "tests"
>;

/**
 * Self-contained so the exact tested implementation can be embedded in a
 * static dashboard without a browser-side build or backend.
 */
export function analyzeHistoricalFlakiness(
  inputRuns: readonly HistoricalRun[],
  inputOptions: Partial<FlakyIntelligenceOptions> = {},
): HistoricalFlakyIntelligence {
  const options: FlakyIntelligenceOptions = {
    maxHistoryRuns: 12,
    minComparableExecutions: 3,
    minInstabilityEvents: 2,
    instabilityRateThreshold: 25,
    ...inputOptions,
  };
  const runs = [...inputRuns].sort((left, right) =>
    left.startTime.localeCompare(right.startTime),
  );
  const identity = (
    environment: string,
    test: ComparisonTestSnapshot,
  ): string =>
    [
      environment,
      test.id,
      test.project,
      test.browser,
      String(test.repeatEachIndex),
    ].join("\u0000");
  const seeds = new Map<
    string,
    { environment: string; test: ComparisonTestSnapshot }
  >();
  for (const run of runs) {
    for (const test of run.tests ?? []) {
      const key = identity(run.environment, test);
      if (!seeds.has(key)) seeds.set(key, { environment: run.environment, test });
    }
  }

  const percentage = (numerator: number, denominator: number): number =>
    denominator === 0
      ? 0
      : Math.round((numerator / denominator) * 1000) / 10;
  const supportsContext = (
    run: HistoricalRun,
    environment: string,
    test: ComparisonTestSnapshot,
  ): boolean => {
    if (run.environment !== environment) return false;
    const observed = run.tests ?? [];
    const sameStableId = observed.filter((item) => item.id === test.id);
    if (
      sameStableId.length > 0 &&
      !sameStableId.some(
        (item) =>
          item.project === test.project &&
          item.browser === test.browser &&
          item.repeatEachIndex === test.repeatEachIndex,
      )
    ) {
      return false;
    }
    const projects =
      run.projects.length > 0
        ? run.projects
        : [...new Set(observed.map((item) => item.project).filter(Boolean))];
    const browsers =
      run.browsers.length > 0
        ? run.browsers
        : [...new Set(observed.map((item) => item.browser).filter(Boolean))];
    if (test.project && !projects.includes(test.project)) return false;
    if (test.browser && !browsers.includes(test.browser)) return false;
    return true;
  };

  const tests = [...seeds.entries()].map(([key, seed]) => {
    const compatibleRuns = runs
      .filter((run) => supportsContext(run, seed.environment, seed.test))
      .slice(-Math.max(1, options.maxHistoryRuns));
    const observations: HistoricalTestObservation[] = compatibleRuns.map(
      (run) => {
        if (!Array.isArray(run.tests)) {
          return {
            runId: run.runId,
            startTime: run.startTime,
            status: "insufficient",
            reportAvailable: run.dashboardAvailable,
            evidenceAvailable: false,
            dashboardPath: run.dashboardPath,
          };
        }
        const observed = run.tests.find(
          (test) => identity(run.environment, test) === key,
        );
        if (!observed) {
          return {
            runId: run.runId,
            startTime: run.startTime,
            status: "missing",
            reportAvailable: run.dashboardAvailable,
            evidenceAvailable: false,
            dashboardPath: run.dashboardPath,
          };
        }
        return {
          runId: run.runId,
          startTime: run.startTime,
          status: observed.observationStatus ?? observed.status,
          retryAttempts: observed.retryAttempts,
          retriesConfigured: observed.retriesConfigured,
          reportAvailable: run.dashboardAvailable,
          evidenceAvailable: run.dashboardAvailable,
          dashboardPath: run.dashboardPath,
        };
      },
    );
    const count = (status: HistoricalObservationKind): number =>
      observations.filter((item) => item.status === status).length;
    const executed = observations.filter((item) =>
      ["passed", "failed", "flaky", "timedOut"].includes(item.status),
    );
    const passed = executed.filter((item) =>
      ["passed", "flaky"].includes(item.status),
    ).length;
    const finalFailures = executed.filter((item) =>
      ["failed", "timedOut"].includes(item.status),
    ).length;
    const retryMeasured = executed.filter(
      (item) =>
        item.retryAttempts !== undefined || item.status === "flaky",
    );
    const retryObserved = retryMeasured.filter(
      (item) => item.status === "flaky" || (item.retryAttempts ?? 0) > 0,
    ).length;
    const failureFrequency = {
      numerator: finalFailures,
      denominator: executed.length,
      percentage: percentage(finalFailures, executed.length),
    };
    const retryFrequency = {
      numerator: retryObserved,
      denominator: retryMeasured.length,
      percentage: percentage(retryObserved, retryMeasured.length),
    };
    const passFailIntermittency = finalFailures > 0 && passed > 0;
    const enoughData = executed.length >= options.minComparableExecutions;
    const repeatedFailures =
      passFailIntermittency &&
      finalFailures >= options.minInstabilityEvents &&
      failureFrequency.percentage >= options.instabilityRateThreshold;
    const repeatedRetries =
      retryObserved >= options.minInstabilityEvents &&
      retryFrequency.percentage >= options.instabilityRateThreshold;

    let kind: InstabilityClassificationKind;
    let severity: HistoricalTestIntelligence["classification"]["severity"];
    let unstable = false;
    const reasons: string[] = [];
    if (!enoughData) {
      kind = "insufficient-data";
      severity = "none";
      reasons.push(
        `Only ${executed.length}/${options.minComparableExecutions} required executed observations are available`,
      );
    } else if (finalFailures === executed.length && executed.length > 0) {
      kind = "persistent-failure";
      severity = "high";
      reasons.push("Every executed observation ended in failure");
    } else if (repeatedFailures && repeatedRetries) {
      kind = "repeated-instability";
      severity = "high";
      unstable = true;
      reasons.push(
        "Repeated final-outcome intermittency and retry dependence were measured",
      );
    } else if (repeatedFailures) {
      kind = "historically-intermittent";
      severity = "high";
      unstable = true;
      reasons.push("Repeated passing and failing final outcomes were measured");
    } else if (repeatedRetries) {
      kind = "retry-dependent";
      severity = "medium";
      unstable = true;
      reasons.push("Repeated successful execution required retries");
    } else if (passFailIntermittency) {
      kind = "isolated-failure";
      severity = "low";
      reasons.push("Pass/fail variation exists but does not meet instability thresholds");
    } else if (retryObserved > 0) {
      kind = "retry-observed";
      severity = "low";
      reasons.push("A retry-dependent observation exists but is not repeated");
    } else {
      kind = "stable";
      severity = "none";
      reasons.push("No final failures or retry-dependent observations were measured");
    }

    return {
      key,
      id: seed.test.id,
      title: seed.test.title,
      file: seed.test.file,
      suites: seed.test.suites,
      environment: seed.environment,
      project: seed.test.project,
      browser: seed.test.browser,
      repeatEachIndex: seed.test.repeatEachIndex,
      counts: {
        comparable: observations.length,
        executed: executed.length,
        passed,
        finalFailures,
        retryObserved,
        retryMeasured: retryMeasured.length,
        skipped: count("skipped"),
        interrupted: count("interrupted"),
        timedOut: count("timedOut"),
        unknown: count("unknown"),
        missing: count("missing"),
        insufficient: count("insufficient"),
      },
      failureFrequency,
      retryFrequency,
      measured: { passFailIntermittency },
      classification: { kind, severity, unstable, reasons },
      window: {
        firstRunId: observations[0]?.runId ?? "",
        lastRunId: observations.at(-1)?.runId ?? "",
        observedRuns: observations.length,
        maxHistoryRuns: options.maxHistoryRuns,
      },
      observations,
    };
  });

  const severityOrder = { high: 0, medium: 1, low: 2, none: 3 };
  tests.sort(
    (left, right) =>
      Number(right.classification.unstable) -
        Number(left.classification.unstable) ||
      severityOrder[left.classification.severity] -
        severityOrder[right.classification.severity] ||
      left.title.localeCompare(right.title) ||
      left.key.localeCompare(right.key),
  );
  return { options, tests };
}
