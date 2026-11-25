const assert = require("node:assert/strict");
const test = require("node:test");
const { load } = require("./load-ts.cjs");

const performance = load("core/performance-intelligence.ts");

function snapshot(id, durationMs, overrides = {}) {
  return {
    id,
    title: id.replaceAll("-", " "),
    file: `tests/${id}.spec.ts`,
    suites: ["regression"],
    module: "checkout",
    status: "passed",
    project: "chromium",
    browser: "chromium",
    repeatEachIndex: 0,
    durationMs,
    retriesConfigured: 1,
    retryAttempts: 0,
    ...overrides,
  };
}

function run(index, tests, overrides = {}) {
  return {
    runId: `run-${index}`,
    startTime: `2026-11-${String(index).padStart(2, "0")}T10:00:00.000Z`,
    endTime: `2026-11-${String(index).padStart(2, "0")}T10:00:10.000Z`,
    environment: "staging",
    browsers: ["chromium"],
    projects: ["chromium"],
    suites: [],
    summary: {
      total: tests?.length ?? 0,
      passed: tests?.length ?? 0,
      failed: 0,
      skipped: 0,
      flaky: 0,
      passPercentage: tests?.length ? 100 : 0,
      durationMs: 10_000,
    },
    failedTestIds: [],
    dashboardPath: `../../run-${index}/dashboard/index.html`,
    dashboardAvailable: true,
    ...(tests === undefined ? {} : { tests }),
    ...overrides,
  };
}

function history(id, durations, overrides = {}) {
  return durations.map((duration, index) =>
    run(index + 1, [snapshot(id, duration, overrides.snapshot)], overrides.run),
  );
}

function analyze(runs, selectedRunId = runs.at(-1).runId, options) {
  return performance.analyzeTestPerformance(runs, selectedRunId, options);
}

function onlyTest(result) {
  assert.equal(result.available, true);
  assert.equal(result.tests.length, 1);
  return result.tests[0];
}

test("classifies a consistently fast test as stable without calling it slow", () => {
  const result = onlyTest(analyze(history("fast-test", [900, 1000, 1100, 1050])));

  assert.equal(result.baseline.medianDurationMs, 1000);
  assert.equal(result.baseline.sampleCount, 3);
  assert.deepEqual(result.difference, {
    absoluteMs: 50,
    percentage: 5,
  });
  assert.equal(result.slow, false);
  assert.equal(result.classification.kind, "stable");
});

test("keeps a consistently slow test separate from regression classification", () => {
  const result = onlyTest(
    analyze(history("slow-test", [40_000, 42_000, 41_000, 43_000])),
  );

  assert.equal(result.slow, true);
  assert.equal(result.classification.kind, "stable");
  assert.equal(result.baseline.medianDurationMs, 41_000);
});

test("requires absolute and relative thresholds for a duration regression", () => {
  const significant = onlyTest(
    analyze(history("regression", [1000, 1100, 900, 2600])),
  );
  const relativeOnly = onlyTest(
    analyze(history("relative-only", [1000, 1000, 1000, 1500])),
  );
  const absoluteOnly = onlyTest(
    analyze(history("absolute-only", [10_000, 10_000, 10_000, 12_000])),
  );

  assert.equal(significant.classification.kind, "regression");
  assert.deepEqual(significant.difference, {
    absoluteMs: 1600,
    percentage: 160,
  });
  assert.equal(relativeOnly.classification.kind, "stable");
  assert.equal(absoluteOnly.classification.kind, "stable");
});

test("identifies a meaningful duration improvement with signed differences", () => {
  const result = onlyTest(
    analyze(history("improvement", [4000, 4200, 3800, 2000])),
  );

  assert.equal(result.classification.kind, "improvement");
  assert.deepEqual(result.difference, {
    absoluteMs: -2000,
    percentage: -50,
  });
});

test("distinguishes insufficient history and an unusable current duration", () => {
  const insufficient = onlyTest(
    analyze(history("insufficient", [1000, 1100, 2500])),
  );
  const unusable = onlyTest(
    analyze([
      ...history("unusable-current", [1000, 1000, 1000]),
      run(4, [
        snapshot("unusable-current", undefined, {
          status: "interrupted",
          observationStatus: "interrupted",
        }),
      ]),
    ]),
  );

  assert.equal(insufficient.classification.kind, "insufficient-history");
  assert.equal(insufficient.baseline.sampleCount, 2);
  assert.equal(unusable.classification.kind, "unusable-current");
  assert.equal(unusable.currentDurationMs, undefined);
});

test("never uses missing, invalid, skipped, interrupted, or unknown durations in the baseline", () => {
  const runs = [
    run(1, [snapshot("incomplete", 1000)]),
    run(2, [snapshot("incomplete", undefined)]),
    run(3, [snapshot("incomplete", Number.NaN)]),
    run(4, [snapshot("incomplete", 0, { status: "skipped" })]),
    run(5, [
      snapshot("incomplete", 5000, {
        status: "failed",
        observationStatus: "interrupted",
      }),
    ]),
    run(6, [snapshot("incomplete", 1100)]),
  ];
  const result = onlyTest(analyze(runs));

  assert.equal(result.baseline.sampleCount, 1);
  assert.deepEqual(
    result.observations.map((observation) => observation.durationState),
    ["measured", "unusable", "unusable", "skipped", "interrupted", "measured"],
  );
  assert.equal(result.observations[1].durationMs, undefined);
  assert.equal(result.observations[2].durationMs, undefined);
});

test("does not mix environment, project, browser, or repeat contexts", () => {
  const runs = [
    run(1, [snapshot("same-id", 1000)]),
    run(2, [snapshot("same-id", 9000)], { environment: "production" }),
    run(
      3,
      [snapshot("same-id", 9000, { project: "firefox", browser: "firefox" })],
      { projects: ["firefox"], browsers: ["firefox"] },
    ),
    run(4, [snapshot("same-id", 9000, { repeatEachIndex: 1 })]),
    run(5, [snapshot("same-id", 1200)]),
  ];
  const result = onlyTest(analyze(runs));

  assert.equal(result.baseline.sampleCount, 1);
  assert.deepEqual(
    result.observations.map(({ runId }) => runId),
    ["run-1", "run-5"],
  );
});

test("retains exact trend values, timestamps, missing observations, and evidence availability", () => {
  const runs = [
    run(1, [snapshot("trend", 1000)], { dashboardAvailable: false }),
    run(2, []),
    run(3, [snapshot("trend", 1200, { status: "skipped" })]),
    run(4, undefined),
    run(5, [snapshot("trend", 1300)]),
  ];
  const result = onlyTest(analyze(runs));

  assert.deepEqual(
    result.observations.map(
      ({ runId, durationState, durationMs, evidenceAvailable }) => ({
        runId,
        durationState,
        durationMs,
        evidenceAvailable,
      }),
    ),
    [
      {
        runId: "run-1",
        durationState: "measured",
        durationMs: 1000,
        evidenceAvailable: false,
      },
      {
        runId: "run-2",
        durationState: "missing",
        durationMs: undefined,
        evidenceAvailable: true,
      },
      {
        runId: "run-3",
        durationState: "skipped",
        durationMs: undefined,
        evidenceAvailable: true,
      },
      {
        runId: "run-4",
        durationState: "insufficient",
        durationMs: undefined,
        evidenceAvailable: true,
      },
      {
        runId: "run-5",
        durationState: "measured",
        durationMs: 1300,
        evidenceAvailable: true,
      },
    ],
  );
  assert.equal(result.observations[0].startTime, runs[0].startTime);
  assert.equal(result.observations[4].dashboardPath, "../../run-5/dashboard/index.html");
});

test("calculates retry overhead only from reliable attempt-level durations", () => {
  const reliable = onlyTest(
    analyze(
      history("retried", [1000, 1000, 1000, 1700], {
        snapshot: {
          retryAttempts: 1,
          attemptDurationsMs: [700, 1000],
        },
      }),
    ),
  );
  const noRetry = onlyTest(
    analyze(
      history("no-retry", [800, 800, 800, 800], {
        snapshot: { attemptDurationsMs: [800] },
      }),
    ),
  );
  const unavailable = onlyTest(
    analyze(history("junit-style", [800, 800, 800, 800])),
  );

  assert.deepEqual(reliable.retryOverhead, {
    available: true,
    initialAttemptDurationMs: 700,
    subsequentAttemptDurationsMs: [1000],
    retryOverheadMs: 1000,
    totalTestDurationMs: 1700,
  });
  assert.deepEqual(noRetry.retryOverhead, {
    available: true,
    initialAttemptDurationMs: 800,
    subsequentAttemptDurationsMs: [],
    retryOverheadMs: 0,
    totalTestDurationMs: 800,
  });
  assert.equal(unavailable.retryOverhead.available, false);
  assert.match(unavailable.retryOverhead.reason, /attempt-level duration telemetry/i);
});

test("keeps summed test and suite durations distinct from wall-clock duration under parallel execution", () => {
  const selected = run(
    4,
    [
      snapshot("checkout-a", 8000, {
        suites: ["regression", "critical"],
        module: "checkout",
      }),
      snapshot("checkout-b", 7000, {
        suites: ["regression"],
        module: "checkout",
      }),
      snapshot("search", 6000, {
        suites: ["regression"],
        module: "catalog",
      }),
      snapshot("missing-duration", undefined, {
        suites: ["regression"],
        module: "catalog",
      }),
    ],
    {
      summary: {
        total: 4,
        passed: 4,
        failed: 0,
        skipped: 0,
        flaky: 0,
        passPercentage: 100,
        durationMs: 10_000,
      },
    },
  );
  const result = analyze([selected]);

  assert.equal(result.bottlenecks.wallClockDurationMs, 10_000);
  assert.equal(result.bottlenecks.summedTestDurationMs, 21_000);
  assert.deepEqual(result.bottlenecks.durationCoverage, {
    measured: 3,
    total: 4,
  });
  assert.deepEqual(result.bottlenecks.suites[0], {
    name: "regression",
    summedTestDurationMs: 21_000,
    measuredTestCount: 3,
    testCount: 4,
  });
  assert.match(result.bottlenecks.interpretation, /parallel/i);
  assert.match(result.bottlenecks.interpretation, /not.*wall-clock/i);
});

test("respects configurable history, slow-test, absolute, and relative thresholds", () => {
  const result = onlyTest(
    analyze(history("configured", [1000, 2000, 3000, 4500, 6000]), "run-5", {
      maxHistoricalRuns: 2,
      minHistoricalSamples: 2,
      slowTestThresholdMs: 5000,
      absoluteChangeThresholdMs: 1000,
      relativeChangeThresholdPercent: 50,
    }),
  );

  assert.equal(result.baseline.sampleCount, 2);
  assert.equal(result.baseline.medianDurationMs, 3750);
  assert.equal(result.slow, true);
  assert.equal(result.classification.kind, "regression");
  assert.equal(result.observations.length, 3);
});

test("uses earlier report records when source executions have identical timestamps", () => {
  const runs = history("same-source-time", [1000, 1100, 900, 2600]);
  for (const item of runs) {
    item.startTime = "2026-11-01T10:00:00.000Z";
  }

  const result = onlyTest(analyze(runs, "run-4"));

  assert.equal(result.baseline.sampleCount, 3);
  assert.equal(result.baseline.medianDurationMs, 1000);
  assert.equal(result.classification.kind, "regression");
});

test("returns an explicit unavailable result when the selected run has no snapshots", () => {
  const result = analyze([run(1, undefined)], "run-1");

  assert.deepEqual(result, {
    available: false,
    reason: "Selected execution does not include test-level performance data.",
  });
});
