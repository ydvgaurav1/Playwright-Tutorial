import type {
  ComparisonTestSnapshot,
  HistoricalObservationStatus,
  HistoryRecord,
} from "../../report-types";

export type TestPerformanceOptions = {
  maxHistoricalRuns: number;
  minHistoricalSamples: number;
  slowTestThresholdMs: number;
  absoluteChangeThresholdMs: number;
  relativeChangeThresholdPercent: number;
};

export const DEFAULT_TEST_PERFORMANCE_OPTIONS: TestPerformanceOptions = {
  maxHistoricalRuns: 12,
  minHistoricalSamples: 3,
  slowTestThresholdMs: 30_000,
  absoluteChangeThresholdMs: 1_000,
  relativeChangeThresholdPercent: 25,
};

export type DurationState =
  | "measured"
  | "missing"
  | "skipped"
  | "interrupted"
  | "unusable"
  | "insufficient";

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

export type RetryOverhead =
  | {
      available: true;
      initialAttemptDurationMs: number;
      subsequentAttemptDurationsMs: number[];
      retryOverheadMs: number;
      totalTestDurationMs: number;
    }
  | {
      available: false;
      reason: string;
    };

export type PerformanceClassification =
  | "regression"
  | "improvement"
  | "stable"
  | "insufficient-history"
  | "unusable-current";

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

export type TestPerformanceIntelligence =
  | AvailableTestPerformanceIntelligence
  | {
      available: false;
      reason: string;
    };

type PerformanceRun = Pick<
  HistoryRecord,
  | "runId"
  | "startTime"
  | "environment"
  | "browsers"
  | "projects"
  | "summary"
  | "dashboardPath"
  | "dashboardAvailable"
  | "tests"
>;

/**
 * Self-contained so static dashboards and Node tests execute identical rules.
 */
export function analyzeTestPerformance(
  inputRuns: readonly PerformanceRun[],
  selectedRunId: string,
  inputOptions: Partial<TestPerformanceOptions> = {},
): TestPerformanceIntelligence {
  const options: TestPerformanceOptions = {
    maxHistoricalRuns: 12,
    minHistoricalSamples: 3,
    slowTestThresholdMs: 30_000,
    absoluteChangeThresholdMs: 1_000,
    relativeChangeThresholdPercent: 25,
    ...inputOptions,
  };
  const runs = [...inputRuns].sort(
    (left, right) =>
      left.startTime.localeCompare(right.startTime) ||
      left.runId.localeCompare(right.runId),
  );
  const selectedRun = runs.find((run) => run.runId === selectedRunId);
  if (!selectedRun || !Array.isArray(selectedRun.tests)) {
    return {
      available: false,
      reason:
        "Selected execution does not include test-level performance data.",
    };
  }
  const selectedRunIndex = runs.findIndex(
    (run) => run.runId === selectedRun.runId,
  );

  const validDuration = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value) && value >= 0;
  const exactStatus = (
    test: ComparisonTestSnapshot,
  ): HistoricalObservationStatus =>
    test.observationStatus ?? test.status;
  const identity = (
    environment: string,
    item: ComparisonTestSnapshot,
  ): string =>
    [
      environment,
      item.id,
      item.project,
      item.browser,
      String(item.repeatEachIndex),
    ].join("\u0000");
  const supportsContext = (
    run: PerformanceRun,
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
  const median = (values: number[]): number | undefined => {
    if (values.length === 0) return undefined;
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  };
  const roundedPercentage = (value: number): number =>
    Math.round(value * 10) / 10;
  const durationState = (
    test: ComparisonTestSnapshot,
  ): DurationState => {
    const status = exactStatus(test);
    if (status === "skipped") return "skipped";
    if (status === "interrupted") return "interrupted";
    if (status === "unknown") return "unusable";
    return validDuration(test.durationMs) ? "measured" : "unusable";
  };
  const observationFor = (
    run: PerformanceRun,
    key: string,
    current: boolean,
  ): DurationObservation => {
    if (!Array.isArray(run.tests)) {
      return {
        runId: run.runId,
        startTime: run.startTime,
        durationState: "insufficient",
        reportAvailable: run.dashboardAvailable,
        evidenceAvailable: run.dashboardAvailable,
        dashboardPath: run.dashboardPath,
        current,
      };
    }
    const observed = run.tests.find(
      (test) => identity(run.environment, test) === key,
    );
    if (!observed) {
      return {
        runId: run.runId,
        startTime: run.startTime,
        durationState: "missing",
        reportAvailable: run.dashboardAvailable,
        evidenceAvailable: run.dashboardAvailable,
        dashboardPath: run.dashboardPath,
        current,
      };
    }
    const state = durationState(observed);
    return {
      runId: run.runId,
      startTime: run.startTime,
      status: exactStatus(observed),
      durationState: state,
      ...(state === "measured" && validDuration(observed.durationMs)
        ? { durationMs: observed.durationMs }
        : {}),
      reportAvailable: run.dashboardAvailable,
      evidenceAvailable: run.dashboardAvailable,
      dashboardPath: run.dashboardPath,
      current,
    };
  };
  const retryOverheadFor = (
    test: ComparisonTestSnapshot,
  ): RetryOverhead => {
    if (
      !Array.isArray(test.attemptDurationsMs) ||
      test.attemptDurationsMs.length === 0 ||
      !test.attemptDurationsMs.every(validDuration) ||
      !validDuration(test.durationMs)
    ) {
      return {
        available: false,
        reason: "Reliable attempt-level duration telemetry is unavailable.",
      };
    }
    const [initialAttemptDurationMs, ...subsequentAttemptDurationsMs] =
      test.attemptDurationsMs;
    return {
      available: true,
      initialAttemptDurationMs,
      subsequentAttemptDurationsMs,
      retryOverheadMs: subsequentAttemptDurationsMs.reduce(
        (total, duration) => total + duration,
        0,
      ),
      totalTestDurationMs: test.durationMs,
    };
  };

  const tests = selectedRun.tests.map((selectedTest) => {
    const key = identity(selectedRun.environment, selectedTest);
    const compatiblePriorRuns = runs
      .slice(0, selectedRunIndex)
      .filter(
        (run) =>
          supportsContext(run, selectedRun.environment, selectedTest),
      )
      .slice(-Math.max(0, options.maxHistoricalRuns));
    const observationRuns = [...compatiblePriorRuns, selectedRun];
    const observations = observationRuns.map((run) =>
      observationFor(run, key, run.runId === selectedRun.runId),
    );
    const historicalDurations = observations
      .filter((observation) => !observation.current)
      .flatMap((observation) =>
        observation.durationState === "measured" &&
        validDuration(observation.durationMs)
          ? [observation.durationMs]
          : [],
      );
    const medianDurationMs = median(historicalDurations);
    const currentState = durationState(selectedTest);
    const currentDurationMs =
      currentState === "measured" && validDuration(selectedTest.durationMs)
        ? selectedTest.durationMs
        : undefined;
    const baseline = {
      ...(medianDurationMs === undefined ? {} : { medianDurationMs }),
      sampleCount: historicalDurations.length,
    };
    const difference =
      currentDurationMs !== undefined && medianDurationMs !== undefined
        ? {
            absoluteMs: currentDurationMs - medianDurationMs,
            ...(medianDurationMs === 0
              ? {}
              : {
                  percentage: roundedPercentage(
                    ((currentDurationMs - medianDurationMs) /
                      medianDurationMs) *
                      100,
                  ),
                }),
          }
        : undefined;
    const reasons: string[] = [];
    let kind: PerformanceClassification;
    if (currentDurationMs === undefined) {
      kind = "unusable-current";
      reasons.push("The selected execution has no usable test duration");
    } else if (
      historicalDurations.length < options.minHistoricalSamples ||
      medianDurationMs === undefined
    ) {
      kind = "insufficient-history";
      reasons.push(
        `Only ${historicalDurations.length}/${options.minHistoricalSamples} required historical duration observations are available`,
      );
    } else if (medianDurationMs === 0 || difference?.percentage === undefined) {
      kind = "insufficient-history";
      reasons.push(
        "The median baseline is zero, so relative duration change is unavailable",
      );
    } else if (
      difference.absoluteMs >= options.absoluteChangeThresholdMs &&
      difference.percentage >= options.relativeChangeThresholdPercent
    ) {
      kind = "regression";
      reasons.push(
        "Both absolute and relative regression thresholds were met",
      );
    } else if (
      difference.absoluteMs <= -options.absoluteChangeThresholdMs &&
      difference.percentage <= -options.relativeChangeThresholdPercent
    ) {
      kind = "improvement";
      reasons.push(
        "Both absolute and relative improvement thresholds were met",
      );
    } else {
      kind = "stable";
      reasons.push(
        "The measured change did not meet both configured change thresholds",
      );
    }

    return {
      key,
      id: selectedTest.id,
      title: selectedTest.title,
      file: selectedTest.file,
      suites: selectedTest.suites,
      module: selectedTest.module ?? "",
      environment: selectedRun.environment,
      project: selectedTest.project,
      browser: selectedTest.browser,
      repeatEachIndex: selectedTest.repeatEachIndex,
      status: exactStatus(selectedTest),
      ...(currentDurationMs === undefined ? {} : { currentDurationMs }),
      slow:
        currentDurationMs !== undefined &&
        currentDurationMs >= options.slowTestThresholdMs,
      baseline,
      ...(difference === undefined ? {} : { difference }),
      classification: { kind, reasons },
      retryOverhead: retryOverheadFor(selectedTest),
      observations,
    } satisfies TestPerformanceRecord;
  });

  const groupBottlenecks = (
    keysFor: (test: ComparisonTestSnapshot) => readonly string[],
  ): PerformanceBottleneckGroup[] => {
    const groups = new Map<string, ComparisonTestSnapshot[]>();
    for (const test of selectedRun.tests ?? []) {
      for (const name of keysFor(test).filter(Boolean)) {
        groups.set(name, [...(groups.get(name) ?? []), test]);
      }
    }
    return [...groups.entries()]
      .map(([name, groupedTests]) => {
        const measured = groupedTests.filter((test) =>
          validDuration(test.durationMs),
        );
        return {
          name,
          summedTestDurationMs: measured.reduce(
            (total, test) => total + (test.durationMs ?? 0),
            0,
          ),
          measuredTestCount: measured.length,
          testCount: groupedTests.length,
        };
      })
      .sort(
        (left, right) =>
          right.summedTestDurationMs - left.summedTestDurationMs ||
          left.name.localeCompare(right.name),
      );
  };
  const measuredSelectedTests = selectedRun.tests.filter((test) =>
    validDuration(test.durationMs),
  );
  const byDuration = (left: TestPerformanceRecord, right: TestPerformanceRecord) =>
    (right.currentDurationMs ?? -1) - (left.currentDurationMs ?? -1) ||
    left.title.localeCompare(right.title) ||
    left.key.localeCompare(right.key);
  tests.sort(byDuration);

  return {
    available: true,
    selectedRunId,
    options,
    tests,
    slowestTests: tests
      .filter((record) => record.currentDurationMs !== undefined)
      .sort(byDuration),
    regressions: tests.filter(
      (record) => record.classification.kind === "regression",
    ),
    improvements: tests.filter(
      (record) => record.classification.kind === "improvement",
    ),
    bottlenecks: {
      wallClockDurationMs: selectedRun.summary.durationMs,
      summedTestDurationMs: measuredSelectedTests.reduce(
        (total, test) => total + (test.durationMs ?? 0),
        0,
      ),
      durationCoverage: {
        measured: measuredSelectedTests.length,
        total: selectedRun.tests.length,
      },
      suites: groupBottlenecks((test) => test.suites),
      modules: groupBottlenecks((test) =>
        test.module ? [test.module] : [],
      ),
      interpretation:
        "Parallel execution can make summed test and suite durations exceed the run duration; these workload measures are not wall-clock pipeline time.",
    },
  };
}
