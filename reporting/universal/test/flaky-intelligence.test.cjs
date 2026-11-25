const assert = require("node:assert/strict");
const test = require("node:test");
const { load } = require("./load-ts.cjs");

const intelligence = load("core/flaky-intelligence.ts");

function snapshot(id, status, overrides = {}) {
  return {
    id,
    title: id.replaceAll("-", " "),
    file: `tests/${id}.spec.ts`,
    suites: ["regression"],
    status:
      status === "timedOut" ||
      status === "interrupted" ||
      status === "unknown"
        ? "failed"
        : status,
    observationStatus: status,
    project: "chromium",
    browser: "chromium",
    repeatEachIndex: 0,
    retriesConfigured: 1,
    retryAttempts: 0,
    ...overrides,
  };
}

function run(index, tests, overrides = {}) {
  return {
    runId: `run-${index}`,
    startTime: `2026-11-${String(index).padStart(2, "0")}T10:00:00.000Z`,
    environment: "staging",
    browsers: ["chromium"],
    projects: ["chromium"],
    dashboardPath: `../../run-${index}/dashboard/index.html`,
    dashboardAvailable: true,
    tests,
    ...overrides,
  };
}

function historyFor(id, statuses, overrides = {}) {
  return statuses.map((status, index) =>
    run(index + 1, [snapshot(id, status, overrides.snapshot)], overrides.run),
  );
}

function analyze(runs, options) {
  return intelligence.analyzeHistoricalFlakiness(runs, options);
}

function onlyTest(result) {
  assert.equal(result.tests.length, 1);
  return result.tests[0];
}

test("classifies always-passing history as stable with explicit denominators", () => {
  const result = onlyTest(analyze(historyFor("always-pass", ["passed", "passed", "passed"])));

  assert.deepEqual(result.failureFrequency, {
    numerator: 0,
    denominator: 3,
    percentage: 0,
  });
  assert.deepEqual(result.retryFrequency, {
    numerator: 0,
    denominator: 3,
    percentage: 0,
  });
  assert.equal(result.counts.comparable, 3);
  assert.equal(result.classification.kind, "stable");
  assert.equal(result.classification.unstable, false);
});

test("keeps persistent failures separate from historical intermittency", () => {
  const result = onlyTest(analyze(historyFor("always-fail", ["failed", "failed", "failed"])));

  assert.equal(result.counts.finalFailures, 3);
  assert.equal(result.measured.passFailIntermittency, false);
  assert.equal(result.classification.kind, "persistent-failure");
  assert.equal(result.classification.unstable, false);
});

test("classifies repeated alternating pass/fail outcomes as historically intermittent", () => {
  const result = onlyTest(
    analyze(historyFor("alternating", ["passed", "failed", "passed", "failed"])),
  );

  assert.deepEqual(result.failureFrequency, {
    numerator: 2,
    denominator: 4,
    percentage: 50,
  });
  assert.equal(result.measured.passFailIntermittency, true);
  assert.equal(result.classification.kind, "historically-intermittent");
  assert.equal(result.classification.unstable, true);
});

test("distinguishes isolated failure and one successful retry from repeated instability", () => {
  const isolatedFailure = onlyTest(
    analyze(historyFor("isolated-failure", ["passed", "failed", "passed"])),
  );
  const retryObserved = onlyTest(
    analyze([
      run(1, [snapshot("retry-once", "passed")]),
      run(2, [
        snapshot("retry-once", "flaky", {
          retryAttempts: 1,
        }),
      ]),
      run(3, [snapshot("retry-once", "passed")]),
    ]),
  );

  assert.equal(isolatedFailure.classification.kind, "isolated-failure");
  assert.equal(isolatedFailure.classification.unstable, false);
  assert.equal(retryObserved.counts.retryObserved, 1);
  assert.equal(retryObserved.counts.finalFailures, 0);
  assert.deepEqual(retryObserved.retryFrequency, {
    numerator: 1,
    denominator: 3,
    percentage: 33.3,
  });
  assert.equal(retryObserved.classification.kind, "retry-observed");
  assert.equal(retryObserved.classification.unstable, false);
});

test("classifies repeated retry dependence separately from final failures", () => {
  const result = onlyTest(
    analyze([
      run(1, [snapshot("retry-dependent", "passed")]),
      run(2, [snapshot("retry-dependent", "flaky", { retryAttempts: 1 })]),
      run(3, [snapshot("retry-dependent", "flaky", { retryAttempts: 2 })]),
      run(4, [snapshot("retry-dependent", "passed")]),
    ]),
  );

  assert.equal(result.counts.finalFailures, 0);
  assert.deepEqual(result.retryFrequency, {
    numerator: 2,
    denominator: 4,
    percentage: 50,
  });
  assert.equal(result.classification.kind, "retry-dependent");
  assert.equal(result.classification.unstable, true);
});

test("records skipped, missing, interrupted, and insufficient observations without adding them to frequency denominators", () => {
  const runs = [
    run(1, [snapshot("incomplete-history", "passed")]),
    run(2, [snapshot("incomplete-history", "skipped")]),
    run(3, []),
    run(4, [snapshot("incomplete-history", "interrupted")]),
    run(5, undefined),
  ];
  const result = onlyTest(analyze(runs));

  assert.equal(result.counts.comparable, 5);
  assert.equal(result.counts.executed, 1);
  assert.equal(result.counts.skipped, 1);
  assert.equal(result.counts.interrupted, 1);
  assert.equal(result.counts.missing, 1);
  assert.equal(result.counts.insufficient, 1);
  assert.equal(result.failureFrequency.denominator, 1);
  assert.equal(result.retryFrequency.denominator, 1);
  assert.deepEqual(
    result.observations.map(({ status }) => status),
    ["passed", "skipped", "missing", "interrupted", "insufficient"],
  );
  assert.equal(result.classification.kind, "insufficient-data");
});

test("does not compare incompatible environments, projects, browsers, or repeat indexes", () => {
  const runs = [
    run(1, [snapshot("same-id", "passed")]),
    run(2, [snapshot("same-id", "failed")], { environment: "production" }),
    run(3, [snapshot("same-id", "failed", { project: "firefox", browser: "firefox" })], {
      projects: ["firefox"],
      browsers: ["firefox"],
    }),
    run(4, [snapshot("same-id", "failed", { repeatEachIndex: 1 })]),
  ];
  const result = analyze(runs);

  assert.equal(result.tests.length, 4);
  assert.ok(result.tests.every((item) => item.counts.comparable === 1));
  assert.ok(result.tests.every((item) => item.classification.kind === "insufficient-data"));
});

test("retains evidence availability without excluding unavailable dashboards", () => {
  const runs = historyFor("evidence-history", ["passed", "failed", "passed"], {
    run: { dashboardAvailable: false },
  });
  runs[2].dashboardAvailable = true;
  const result = onlyTest(analyze(runs));

  assert.equal(result.counts.comparable, 3);
  assert.deepEqual(
    result.observations.map(({ evidenceAvailable }) => evidenceAvailable),
    [false, false, true],
  );
  assert.equal(result.observations[2].dashboardPath, "../../run-3/dashboard/index.html");
});

test("respects configurable observation, event, rate, and window thresholds", () => {
  const runs = historyFor("thresholds", [
    "failed",
    "passed",
    "failed",
    "passed",
    "passed",
  ]);
  const result = onlyTest(
    analyze(runs, {
      maxHistoryRuns: 4,
      minComparableExecutions: 4,
      minInstabilityEvents: 2,
      instabilityRateThreshold: 60,
    }),
  );

  assert.equal(result.observations.length, 4);
  assert.equal(result.failureFrequency.percentage, 25);
  assert.equal(result.classification.kind, "isolated-failure");
  assert.deepEqual(result.window, {
    firstRunId: "run-2",
    lastRunId: "run-5",
    observedRuns: 4,
    maxHistoryRuns: 4,
  });
});
