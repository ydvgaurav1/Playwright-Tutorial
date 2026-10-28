const assert = require("node:assert/strict");
const test = require("node:test");
const { load, loadRepo } = require("./load-ts.cjs");
const { validRun } = require("./fixtures.cjs");

const core = load("index.ts");
const legacyModel = loadRepo("reporting/report-model.ts");

function clone(value) {
  return structuredClone(value);
}

function legacyShapedTests(tests) {
  return tests.map((test) => ({
    ...clone(test),
    project: test.variant.name,
    browser: test.variant.browser,
    repeatEachIndex: test.variant.repeat,
  }));
}

function makeResults(statuses) {
  const base = validRun().tests[0];
  return statuses.map((status, index) => {
    const test = clone(base);
    test.id = `test-${index}`;
    test.title = `test ${index}`;
    test.status = status;
    test.durationMs = (index + 1) * 100;
    test.attempts = [
      {
        ...clone(base.attempts[0]),
        status: status === "flaky" ? "passed" : status,
        durationMs: test.durationMs,
      },
    ];
    return test;
  });
}

test("classification matches the existing Playwright model exactly", () => {
  const labels = [
    "@regression",
    "@sanity",
    "@module:authentication",
    "@demo",
    "@suite:release-candidate",
    "@sanity",
  ];

  assert.deepEqual(
    core.classifySuites(labels),
    legacyModel.classifySuites(labels),
  );

  for (const file of [
    "tests/demo/login.spec.ts",
    "tests/cart/add-item.spec.ts",
    "tests/login.spec.ts",
    "src/checkout/login.test.js",
  ]) {
    assert.equal(
      core.classifyModule([], file),
      legacyModel.classifyModule([], file),
      `module fallback differs for ${file}`,
    );
  }

  assert.equal(
    core.classifyModule(["@module:authentication"], "tests/demo/login.spec.ts"),
    legacyModel.classifyModule(
      ["@module:authentication"],
      "tests/demo/login.spec.ts",
    ),
  );
});

test("classification accepts a project-specific policy", () => {
  const policy = {
    directSuites: ["smoke"],
    suitePrefix: "group:",
    modulePrefix: "feature:",
    sourceRoot: "spec",
    specSuffixes: ["spec", "test"],
  };

  assert.deepEqual(
    core.classifySuites(["@smoke", "@group:billing", "@module:ignore"], policy),
    ["billing", "smoke"],
  );
  assert.equal(
    core.classifyModule(["@feature:payments"], "spec/api/pay.spec.ts", policy),
    "payments",
  );
  assert.equal(
    core.classifyModule([], "spec/api/pay.spec.ts", policy),
    "api",
  );
});

test("summary and grouping match the existing metrics model", () => {
  const document = validRun();
  const tests = document.tests;
  const legacyTests = legacyShapedTests(tests);

  assert.deepEqual(
    core.createSummary(tests, 5000),
    legacyModel.createSummary(legacyTests, 5000),
  );
  assert.deepEqual(
    core.createSuiteRecords(tests),
    legacyModel.createSuiteRecords(legacyTests),
  );
  assert.deepEqual(
    core.createModuleRecords(tests),
    legacyModel.createModuleRecords(legacyTests),
  );

  const universalSpecs = core.createSpecRecords(tests);
  const legacySpecs = legacyModel.createSpecRecords(legacyTests).map((spec) => ({
    key: spec.key,
    name: spec.name,
    path: spec.path,
    variant: spec.project,
    browser: spec.browser,
    module: spec.module,
    summary: spec.summary,
  }));
  assert.deepEqual(universalSpecs, legacySpecs);
});

test("keeps pass rate as passed divided by total, including skipped tests", () => {
  const tests = makeResults(["passed", "passed", "failed", "skipped"]);
  const summary = core.createSummary(tests, 5000);

  assert.equal(summary.total, 4);
  assert.equal(summary.passed, 2);
  assert.equal(summary.failed, 1);
  assert.equal(summary.skipped, 1);
  assert.equal(summary.passPercentage, 50);
});

test("separates wall-clock run duration from summed test duration", () => {
  const tests = makeResults(["passed", "failed"]);

  assert.equal(core.createSummary(tests).durationMs, 300);
  assert.equal(core.createSummary(tests, 1000).durationMs, 1000);
  assert.equal(core.createSummary(tests).passPercentage, 50);
});

test("retains optional counts for richer statuses", () => {
  const tests = makeResults(["timedOut", "interrupted", "unknown"]);
  const summary = core.createSummary(tests, 900);

  assert.equal(summary.total, 3);
  assert.equal(summary.timedOut, 1);
  assert.equal(summary.interrupted, 1);
  assert.equal(summary.unknown, 1);
  assert.equal(summary.passed, 0);
  assert.equal(summary.passPercentage, 0);
});

test("normalizes framework status aliases", () => {
  assert.equal(core.normalizeTestStatus("PASSED"), "passed");
  assert.equal(core.normalizeTestStatus("success"), "passed");
  assert.equal(core.normalizeTestStatus("TIMED_OUT"), "timedOut");
  assert.equal(core.normalizeTestStatus("not run"), "skipped");
  assert.equal(core.normalizeTestStatus("error"), "failed");
  assert.equal(core.normalizeTestStatus("something else"), "unknown");
  assert.equal(core.normalizeAttemptStatus("flaky"), "unknown");
  assert.equal(core.normalizeRunStatus("flaky"), "failed");
  assert.equal(core.normalizeStepStatus("timeout"), "failed");
});

test("derives flaky tests from retry attempts unless the source reports a status", () => {
  assert.equal(
    core.deriveTestStatus([{ status: "failed" }, { status: "passed" }]),
    "flaky",
  );
  assert.equal(
    core.deriveTestStatus(
      [{ status: "failed" }, { status: "passed" }],
      "failed",
    ),
    "failed",
  );
  assert.equal(core.deriveTestStatus([{ status: "passed" }]), "passed");
  assert.equal(core.deriveTestStatus([{ status: "skipped" }]), "skipped");
  assert.equal(core.deriveTestStatus([]), "unknown");
});

test("normalizes timestamps, durations, retries, and evidence paths", () => {
  assert.equal(
    core.normalizeTimestamp("2026-10-27T06:53:47.569Z"),
    "2026-10-27T06:53:47.569Z",
  );
  assert.equal(core.secondsToMilliseconds("1.5"), 1500);
  assert.equal(core.normalizeDurationMs(-1, 25), 25);
  assert.deepEqual(core.normalizeRetries(2, 3), { configured: 2, used: 2 });
  assert.equal(
    core.normalizeEvidencePath("../screenshots/failure.png"),
    "screenshots/failure.png",
  );
  assert.equal(core.isSafeRelativePath("screenshots/failure.png"), true);
  assert.equal(core.isSafeRelativePath("../failure.png"), false);
  assert.equal(core.isSafeRelativePath("/tmp/failure.png"), false);
});

test("redacts configured values and patterns without changing other text", () => {
  const redacted = core.redactText(
    "user=standard password=secret_sauce token=abc123",
    {
      values: ["secret_sauce"],
      patterns: [/(?<=token=)\S+/g],
    },
  );

  assert.equal(redacted, "user=standard password=[REDACTED] token=[REDACTED]");
});

test("projects legacy results.json without changing identity or evidence paths", () => {
  const legacy = {
    schemaVersion: 2,
    run: {
      id: "legacy-run",
      status: "failed",
      startTime: "2026-10-27T06:53:47.569Z",
      endTime: "2026-10-27T06:53:54.821Z",
      timezone: "Asia/Kolkata",
    },
    metadata: {
      environment: "demo",
      baseURL: "https://example.test",
      browsers: ["chromium"],
      projects: ["chromium"],
      ci: false,
    },
    summary: {
      total: 1,
      passed: 0,
      failed: 1,
      skipped: 0,
      flaky: 0,
      passPercentage: 0,
      durationMs: 7252,
    },
    suites: [{ name: "regression", summary: { total: 1, passed: 0, failed: 1, skipped: 0, flaky: 0, passPercentage: 0, durationMs: 1000 } }],
    modules: [],
    specs: [],
    tests: [
      {
        id: "playwright-id",
        title: "legacy failure",
        titlePath: ["legacy failure"],
        suites: ["regression"],
        module: "authentication",
        spec: {
          key: "tests/login.spec.ts::chromium",
          name: "login.spec.ts",
          path: "tests/login.spec.ts",
        },
        file: "tests/login.spec.ts",
        line: 12,
        column: 5,
        status: "failed",
        project: "chromium",
        browser: "chromium",
        repeatEachIndex: 0,
        durationMs: 1000,
        retriesConfigured: 0,
        retryAttempts: 0,
        tags: ["@regression", "@module:authentication"],
        attempts: [
          {
            attempt: 1,
            retry: 0,
            status: "failed",
            durationMs: 1000,
            startTime: "2026-10-27T06:53:48.000Z",
            workerIndex: 0,
            errors: [{ message: "failure" }],
            steps: [],
            artifacts: [
              {
                kind: "screenshot",
                name: "failure",
                contentType: "image/png",
                path: "../screenshots/failure.png",
              },
            ],
            logs: [],
          },
        ],
      },
    ],
    globalErrors: [],
  };

  const canonical = core.fromLegacyResultsDocument(legacy);
  assert.equal(canonical.tests[0].id, "playwright-id");
  assert.equal(canonical.tests[0].variant.name, "chromium");
  assert.equal(canonical.tests[0].suites[0], "regression");
  assert.equal(canonical.tests[0].attempts[0].evidence[0].path, "screenshots/failure.png");
  assert.equal(canonical.run.durationMs, 7252);
  assert.equal(core.validateRunDocument(canonical).ok, true);
});

test("projects every canonical evidence kind and its download metadata", () => {
  const document = validRun();
  document.tests[1].attempts[0].evidence = [
    {
      kind: "screenshot",
      name: "Failure screenshot",
      path: "screenshots/failure.png",
      mimeType: "image/png",
      bytes: 101,
    },
    {
      kind: "video",
      name: "Failure video",
      path: "videos/failure.webm",
      mimeType: "video/webm",
      bytes: 202,
    },
    {
      kind: "trace",
      name: "Playwright trace",
      path: "traces/trace.zip",
      mimeType: "application/zip",
      bytes: 303,
      format: "playwright",
    },
    {
      kind: "file",
      name: "Response body",
      path: "attachments/test-2/response.json",
      mimeType: "application/json",
      bytes: 404,
      sha256: "a".repeat(64),
    },
    {
      kind: "log",
      name: "Server log",
      path: "attachments/test-2/server.log",
      mimeType: "text/plain",
      bytes: 505,
    },
    {
      kind: "native-report",
      name: "Framework report",
      path: "attachments/test-2/native.html",
      mimeType: "text/html",
      bytes: 606,
    },
    {
      kind: "file",
      name: "Unsafe attachment",
      path: "../outside.txt",
      mimeType: "text/plain",
    },
    {
      kind: "file",
      name: "Declared missing attachment",
      path: "attachments/test-2/missing.txt",
      mimeType: "text/plain",
      missing: true,
    },
  ];

  const report = core.toLegacyReport(document);
  const artifacts = report.tests[1].attempts[0].artifacts;

  assert.deepEqual(
    artifacts.map((artifact) => artifact.kind),
    [
      "screenshot",
      "video",
      "trace",
      "file",
      "log",
      "native-report",
      "file",
      "file",
    ],
  );
  assert.deepEqual(
    artifacts.map((artifact) => artifact.filename),
    [
      "failure.png",
      "failure.webm",
      "trace.zip",
      "response.json",
      "server.log",
      "native.html",
      "outside.txt",
      "missing.txt",
    ],
  );
  assert.deepEqual(artifacts[3], {
    kind: "file",
    name: "Response body",
    filename: "response.json",
    contentType: "application/json",
    path: "../attachments/test-2/response.json",
    bytes: 404,
    sha256: "a".repeat(64),
    available: true,
  });
  assert.equal(artifacts[2].format, "playwright");
  assert.equal(artifacts[6].available, false);
  assert.equal(artifacts[6].path, "");
  assert.match(artifacts[6].unavailableReason, /unsafe/i);
  assert.equal(artifacts[7].available, false);
  assert.match(artifacts[7].unavailableReason, /missing/i);
});

test("throws a structured error for an invalid document", () => {
  assert.throws(
    () => core.assertValidRunDocument({}),
    (error) => error instanceof core.SchemaValidationError && error.issues.length > 0,
  );
});
