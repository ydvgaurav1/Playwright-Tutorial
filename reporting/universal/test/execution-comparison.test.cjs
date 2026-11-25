const assert = require("node:assert/strict");
const test = require("node:test");
const { load } = require("./load-ts.cjs");

const comparison = load("core/execution-comparison.ts");

function summary(overrides = {}) {
  return {
    total: 1,
    passed: 1,
    failed: 0,
    skipped: 0,
    flaky: 0,
    passPercentage: 100,
    durationMs: 1000,
    ...overrides,
  };
}

function snapshot(id, status, overrides = {}) {
  return {
    id,
    title: id,
    file: `tests/${id}.spec.ts`,
    suites: ["regression"],
    status,
    project: "chromium",
    browser: "chromium",
    repeatEachIndex: 0,
    retriesConfigured: 1,
    retryAttempts: 0,
    ...overrides,
  };
}

function run(runId, tests, overrides = {}) {
  return {
    runId,
    startTime: `2026-11-${runId === "baseline" ? "24" : "25"}T10:00:00.000Z`,
    environment: "staging",
    summary: summary({ total: tests.length }),
    tests,
    ...overrides,
  };
}

function ids(records) {
  return records.map((record) => record.id);
}

test("classifies executed status transitions without treating unchanged passes as failures", () => {
  const baseline = run("baseline", [
    snapshot("passed-to-failed", "passed"),
    snapshot("failed-to-passed", "failed"),
    snapshot("failed-to-failed", "failed"),
    snapshot("passed-to-passed", "passed"),
    snapshot("flaky-to-failed", "flaky"),
  ]);
  const current = run("current", [
    snapshot("passed-to-failed", "failed"),
    snapshot("failed-to-passed", "passed"),
    snapshot("failed-to-failed", "failed"),
    snapshot("passed-to-passed", "passed"),
    snapshot("flaky-to-failed", "failed"),
  ]);

  const result = comparison.compareExecutions(baseline, current);

  assert.equal(result.available, true);
  assert.deepEqual(ids(result.newlyFailed), [
    "flaky-to-failed",
    "passed-to-failed",
  ]);
  assert.deepEqual(ids(result.resolved), ["failed-to-passed"]);
  assert.deepEqual(ids(result.recurring), ["failed-to-failed"]);
  assert.deepEqual(ids(result.unchangedPassing), ["passed-to-passed"]);
});

test("keeps skipped and absent tests out of resolved and newly-failed categories", () => {
  const baseline = run("baseline", [
    snapshot("failed-to-skipped", "failed"),
    snapshot("skipped-to-failed", "skipped"),
    snapshot("missing-current", "failed"),
  ]);
  const current = run("current", [
    snapshot("failed-to-skipped", "skipped"),
    snapshot("skipped-to-failed", "failed"),
    snapshot("missing-baseline", "failed"),
  ]);

  const result = comparison.compareExecutions(baseline, current);

  assert.deepEqual(ids(result.nonExecuted), [
    "failed-to-skipped",
    "skipped-to-failed",
  ]);
  assert.deepEqual(ids(result.missingFromCurrent), ["missing-current"]);
  assert.deepEqual(ids(result.missingFromBaseline), ["missing-baseline"]);
  assert.deepEqual(ids(result.resolved), []);
  assert.deepEqual(ids(result.newlyFailed), []);
});

test("reports flaky outcomes and retry configuration or usage changes", () => {
  const baseline = run("baseline", [
    snapshot("became-flaky", "passed"),
    snapshot("retry-usage", "passed"),
    snapshot("retry-config", "passed", { retriesConfigured: 1 }),
  ]);
  const current = run("current", [
    snapshot("became-flaky", "flaky", { retryAttempts: 1 }),
    snapshot("retry-usage", "passed", { retryAttempts: 1 }),
    snapshot("retry-config", "passed", { retriesConfigured: 2 }),
  ]);

  const result = comparison.compareExecutions(baseline, current);

  assert.deepEqual(ids(result.retryChanges), [
    "became-flaky",
    "retry-config",
    "retry-usage",
  ]);
  assert.deepEqual(result.retryChanges[0].reasons, [
    "Current execution is flaky",
    "Retries used changed from 0 to 1",
  ]);
});

test("matches stable IDs only within environment, project, browser, and repeat context", () => {
  const baseline = run("baseline", [
    snapshot("same-id", "passed", { suites: ["sanity"] }),
    snapshot("browser-context", "passed", { browser: "firefox" }),
    snapshot("project-context", "passed", { project: "mobile" }),
    snapshot("repeat-context", "passed", { repeatEachIndex: 1 }),
  ]);
  const current = run("current", [
    snapshot("same-id", "failed", { suites: ["regression"] }),
    snapshot("browser-context", "failed", { browser: "chromium" }),
    snapshot("project-context", "failed", { project: "desktop" }),
    snapshot("repeat-context", "failed", { repeatEachIndex: 0 }),
  ]);

  const result = comparison.compareExecutions(baseline, current);

  assert.deepEqual(ids(result.newlyFailed), ["same-id"]);
  assert.equal(result.missingFromBaseline.length, 3);
  assert.equal(result.missingFromCurrent.length, 3);

  const differentEnvironment = comparison.compareExecutions(
    baseline,
    run("current", [snapshot("same-id", "failed")], {
      environment: "production",
    }),
  );
  assert.deepEqual(ids(differentEnvironment.newlyFailed), []);
  assert.equal(differentEnvironment.missingFromBaseline.length, 1);
  assert.equal(differentEnvironment.missingFromCurrent.length, 4);
  assert.equal(differentEnvironment.context.environmentChanged, true);
});

test("computes signed overall count, pass-rate, and duration deltas", () => {
  const baseline = run("baseline", [snapshot("one", "passed")], {
    summary: summary({
      total: 10,
      passed: 8,
      failed: 2,
      passPercentage: 80,
      durationMs: 1000,
    }),
  });
  const current = run("current", [snapshot("one", "passed")], {
    summary: summary({
      total: 12,
      passed: 9,
      failed: 3,
      passPercentage: 75,
      durationMs: 1400,
    }),
  });

  const result = comparison.compareExecutions(baseline, current);

  assert.deepEqual(result.metrics.total, {
    baseline: 10,
    current: 12,
    delta: 2,
  });
  assert.deepEqual(result.metrics.passPercentage, {
    baseline: 80,
    current: 75,
    delta: -5,
  });
  assert.deepEqual(result.metrics.durationMs, {
    baseline: 1000,
    current: 1400,
    delta: 400,
  });
});

test("returns an explicit insufficient-data result when either snapshot set is absent", () => {
  const baseline = run("baseline", []);
  delete baseline.tests;

  const result = comparison.compareExecutions(
    baseline,
    run("current", [snapshot("one", "passed")]),
  );

  assert.deepEqual(result, {
    available: false,
    reason:
      "Baseline execution does not include test-level comparison data.",
  });
});

test("projects compact snapshots without evidence, attempts, or errors", () => {
  const projected = comparison.toComparisonSnapshots([
    {
      id: "stable-id",
      title: "works",
      file: "tests/example.spec.ts",
      suites: ["sanity"],
      status: "flaky",
      project: "chromium",
      browser: "chromium",
      repeatEachIndex: 0,
      retriesConfigured: 2,
      retryAttempts: 1,
      attempts: [{ errors: [{ message: "must not be copied" }] }],
    },
  ]);

  assert.deepEqual(projected, [
    {
      id: "stable-id",
      title: "works",
      file: "tests/example.spec.ts",
      suites: ["sanity"],
      status: "flaky",
      project: "chromium",
      browser: "chromium",
      repeatEachIndex: 0,
      retriesConfigured: 2,
      retryAttempts: 1,
    },
  ]);
});

test("preserves exact canonical status and does not invent absent retry telemetry", () => {
  const projected = comparison.toComparisonSnapshots([
    {
      id: "canonical-interrupted",
      title: "interrupted canonical test",
      suites: ["regression"],
      status: "interrupted",
      source: { file: "tests/interrupted.spec.ts" },
      variant: { name: "chromium", browser: "chromium", repeat: 1 },
      retries: { configured: 2, used: 1 },
    },
    {
      id: "legacy-without-retries",
      title: "legacy test without retry telemetry",
      file: "tests/legacy.spec.ts",
      suites: [],
      status: "passed",
      project: "chromium",
      browser: "chromium",
      repeatEachIndex: 0,
    },
  ]);

  assert.deepEqual(projected[0], {
    id: "canonical-interrupted",
    title: "interrupted canonical test",
    file: "tests/interrupted.spec.ts",
    suites: ["regression"],
    status: "failed",
    observationStatus: "interrupted",
    project: "chromium",
    browser: "chromium",
    repeatEachIndex: 1,
    retriesConfigured: 2,
    retryAttempts: 1,
  });
  assert.deepEqual(projected[1], {
    id: "legacy-without-retries",
    title: "legacy test without retry telemetry",
    file: "tests/legacy.spec.ts",
    suites: [],
    status: "passed",
    project: "chromium",
    browser: "chromium",
    repeatEachIndex: 0,
  });
});

test("projects valid test durations and only capability-backed attempt durations", () => {
  const canonical = {
    id: "canonical-timing",
    title: "canonical timing",
    suites: ["regression"],
    module: "checkout",
    status: "flaky",
    durationMs: 1700,
    source: { file: "tests/checkout.spec.ts" },
    variant: { name: "desktop", browser: "chromium", repeat: 0 },
    retries: { configured: 1, used: 1 },
    attempts: [
      { durationMs: 700 },
      { durationMs: 1000 },
    ],
  };

  const attemptCapable = comparison.toComparisonSnapshots([canonical], {
    timingGranularity: "attempt",
  });
  const testOnly = comparison.toComparisonSnapshots([canonical], {
    timingGranularity: "test",
  });

  assert.equal(attemptCapable[0].module, "checkout");
  assert.equal(attemptCapable[0].durationMs, 1700);
  assert.deepEqual(attemptCapable[0].attemptDurationsMs, [700, 1000]);
  assert.equal("attemptDurationsMs" in testOnly[0], false);
});

test("omits missing JUnit and invalid legacy durations instead of projecting zero", () => {
  const projected = comparison.toComparisonSnapshots(
    [
      {
        id: "junit-missing",
        title: "missing JUnit duration",
        suites: [],
        module: "api",
        status: "passed",
        durationMs: 0,
        source: { file: "TEST-api.xml" },
        variant: { name: "junit" },
        retries: { configured: 0, used: 0 },
        attempts: [
          {
            durationMs: 0,
            extensions: { junit: { durationSource: "missing" } },
          },
        ],
      },
      {
        id: "legacy-invalid",
        title: "legacy invalid duration",
        file: "tests/legacy.spec.ts",
        suites: [],
        module: "legacy",
        status: "passed",
        project: "chromium",
        browser: "chromium",
        repeatEachIndex: 0,
        durationMs: -1,
      },
    ],
    { timingGranularity: "test" },
  );

  assert.equal("durationMs" in projected[0], false);
  assert.equal("attemptDurationsMs" in projected[0], false);
  assert.equal("durationMs" in projected[1], false);
});
