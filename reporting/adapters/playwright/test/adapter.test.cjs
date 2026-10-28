const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  createArtifactFiles,
  createAttachment,
  createConfig,
  createFullResult,
  createPriorReport,
  createStep,
  createSuite,
  createTestCase,
  createTestResult,
  createWorkspace,
  findRunDirectory,
  optionsFor,
  readJson,
  DEFAULT_START,
} = require("./fixtures.cjs");
const { loadRepo } = require("../../../universal/test/load-ts.cjs");

const { PlaywrightReportingAdapter } = loadRepo(
  "reporting/adapters/playwright/adapter.ts",
);
const core = loadRepo("reporting/universal/index.ts");

test("writes canonical run.json, compatible results.json, dashboard, history, and evidence", async (t) => {
  const workspace = createWorkspace();
  t.after(() => fs.rmSync(workspace.root, { recursive: true, force: true }));
  createPriorReport(workspace.reportsRoot, "prior-run");

  const artifacts = createArtifactFiles(workspace);
  const assertionError = {
    message:
      "expect(locator).toContainText(expected) failed\n\nExpected string: \"Account locked after invalid login\"\nReceived string: \"Epic sadface: Username and password do not match\"\npassword=secret_sauce",
    stack: "Error: expect(locator).toContainText(expected) failed",
    snippet: "> 12 | expect(error).toContainText('Account locked')",
  };

  const passedResult = createTestResult({
    status: "passed",
    duration: 100,
    startTime: new Date(DEFAULT_START.getTime() + 10),
    workerIndex: 1,
    steps: [createStep({ title: "Submit valid credentials" })],
  });
  const failedResult = createTestResult({
    status: "failed",
    duration: 200,
    startTime: new Date(DEFAULT_START.getTime() + 20),
    workerIndex: 0,
    errors: [assertionError],
    steps: [
      createStep({
        title: "Assert error message",
        error: assertionError,
        steps: [createStep({ title: "nested lookup" })],
      }),
    ],
    attachments: [
      createAttachment("screenshot", "image/png", artifacts.screenshot),
      createAttachment("video", "video/webm", artifacts.video),
      createAttachment("trace", "application/zip", artifacts.trace),
    ],
  });
  const skippedResult = createTestResult({
    status: "skipped",
    duration: 0,
    startTime: new Date(DEFAULT_START.getTime() + 30),
    workerIndex: 0,
  });

  const passedTest = createTestCase({
    id: "test-passed",
    title: "standard user can log in",
    tags: ["@sanity", "@regression", "@module:authentication"],
    file: "tests/login.spec.ts",
    results: [passedResult],
    outcome: "expected",
    titlePath: [
      "chromium",
      "login.spec.ts",
      "SauceDemo login",
      "standard user can log in",
    ],
  });
  const failedTest = createTestCase({
    id: "test-failed",
    title: "intentional failure",
    tags: ["@regression", "@module:authentication"],
    file: "tests/demo/login-intentional-failure.spec.ts",
    results: [failedResult],
    outcome: "unexpected",
  });
  const skippedTest = createTestCase({
    id: "test-skipped",
    title: "skipped test",
    file: "tests/skipped.spec.ts",
    results: [skippedResult],
    outcome: "skipped",
  });

  const adapter = new PlaywrightReportingAdapter(optionsFor(workspace));
  adapter.onBegin(
    createConfig(),
    createSuite([passedTest, failedTest, skippedTest]),
  );
  adapter.onStdOut(
    "user=standard password=secret_sauce token=abc",
    passedTest,
    passedResult,
  );
  adapter.onStdErr(
    "failure password=invalid_password",
    failedTest,
    failedResult,
  );

  await adapter.onEnd(
    createFullResult({ status: "failed", duration: 1000 }),
  );

  const runDirectory = findRunDirectory(workspace.reportsRoot, ["prior-run"]);
  const canonical = core.parseRunDocument(
    fs.readFileSync(path.join(runDirectory, "run.json"), "utf8"),
  );
  const legacy = readJson(path.join(runDirectory, "results.json"));

  assert.equal(canonical.schemaVersion, "1.0.0");
  assert.equal(canonical.run.id, path.basename(runDirectory));
  assert.equal(canonical.run.status, "failed");
  assert.equal(canonical.run.durationMs, 1000);
  assert.equal(canonical.tests.length, 3);
  assert.equal(canonical.producer.framework, "playwright");
  assert.equal(canonical.externalReports?.[0]?.path, "playwright-report/index.html");

  const canonicalPassed = canonical.tests.find(
    (entry) => entry.id === "test-passed",
  );
  const canonicalFailed = canonical.tests.find(
    (entry) => entry.id === "test-failed",
  );
  const canonicalSkipped = canonical.tests.find(
    (entry) => entry.id === "test-skipped",
  );

  assert.equal(canonicalPassed.status, "passed");
  assert.deepEqual(canonicalPassed.suites, ["regression", "sanity"]);
  assert.equal(canonicalPassed.module, "authentication");
  assert.deepEqual(canonicalPassed.spec, {
    key: "tests/login.spec.ts::chromium",
    name: "login.spec.ts",
    path: "tests/login.spec.ts",
  });
  assert.equal(canonicalPassed.attempts[0].logs[0].text, "user=standard password=[REDACTED] token=abc");

  assert.equal(canonicalFailed.status, "failed");
  assert.equal(canonicalFailed.attempts[0].errors[0].expected, '"Account locked after invalid login"');
  assert.equal(
    canonicalFailed.attempts[0].errors[0].actual,
    '"Epic sadface: Username and password do not match"',
  );
  assert.equal(canonicalFailed.attempts[0].steps[0].status, "failed");
  assert.equal(
    canonicalFailed.attempts[0].steps[0].steps[0].status,
    "passed",
  );
  assert.equal(
    canonicalFailed.attempts[0].logs[0].text,
    "failure password=[REDACTED]",
  );
  assert.deepEqual(
    canonicalFailed.attempts[0].evidence.map((evidence) => evidence.kind),
    ["screenshot", "video", "trace"],
  );
  assert.equal(
    canonicalFailed.attempts[0].evidence.find(
      (evidence) => evidence.kind === "trace",
    ).format,
    "playwright",
  );
  for (const evidence of canonicalFailed.attempts[0].evidence) {
    assert.match(evidence.path, /^(?:screenshots|videos|traces)\//);
    assert.ok(evidence.bytes > 0);
    assert.equal(
      fs.existsSync(path.join(runDirectory, evidence.path)),
      true,
      `missing copied evidence ${evidence.path}`,
    );
  }
  assert.equal(canonicalSkipped.status, "skipped");

  assert.equal(legacy.schemaVersion, 2);
  assert.equal(legacy.run.id, canonical.run.id);
  assert.equal(legacy.tests.length, 3);
  const legacyPassed = legacy.tests.find((entry) => entry.id === "test-passed");
  const legacyFailed = legacy.tests.find((entry) => entry.id === "test-failed");
  assert.equal(legacyPassed.status, "passed");
  assert.deepEqual(legacyPassed.suites, ["regression", "sanity"]);
  assert.equal(legacyPassed.module, "authentication");
  assert.equal(legacyFailed.attempts[0].artifacts.length, 3);
  assert.match(
    legacyFailed.attempts[0].artifacts[0].path,
    /^\.\.\/(?:screenshots|videos|traces)\//,
  );
  assert.equal(legacyFailed.attempts[0].logs[0].text, "failure password=[REDACTED]");

  const comparison = core.compareLegacyResults(legacy);
  assert.deepEqual(comparison.differences, []);
  const projected = core.fromLegacyResultsDocument(legacy);
  assert.deepEqual(
    projected.tests.map((entry) => ({
      id: entry.id,
      title: entry.title,
      status: entry.status,
      suites: entry.suites,
      module: entry.module,
      attempts: entry.attempts.length,
    })),
    canonical.tests.map((entry) => ({
      id: entry.id,
      title: entry.title,
      status: entry.status,
      suites: entry.suites,
      module: entry.module,
      attempts: entry.attempts.length,
    })),
  );

  assert.equal(
    fs.existsSync(path.join(runDirectory, "playwright-report", "index.html")),
    true,
  );
  const dashboard = fs.readFileSync(
    path.join(runDirectory, "dashboard", "index.html"),
    "utf8",
  );
  assert.match(dashboard, /<h1>Automation Dashboard<\/h1>/);
  assert.match(dashboard, /prior-run/);

  const latest = fs.readFileSync(
    path.join(workspace.reportsRoot, "latest", "index.html"),
    "utf8",
  );
  assert.match(latest, new RegExp(path.basename(runDirectory)));
});

test("preserves flaky retry semantics and schema-valid synthetic attempts", async (t) => {
  const workspace = createWorkspace();
  t.after(() => fs.rmSync(workspace.root, { recursive: true, force: true }));

  const firstAttempt = createTestResult({
    status: "failed",
    duration: 40,
    retry: 0,
    errors: [{ message: "first attempt failed" }],
  });
  const secondAttempt = createTestResult({
    status: "passed",
    duration: 60,
    retry: 1,
    startTime: new Date(DEFAULT_START.getTime() + 40),
  });
  const flakyTest = createTestCase({
    id: "test-flaky",
    title: "retried test",
    tags: ["@sanity"],
    file: "tests/flaky.spec.ts",
    retries: 1,
    results: [firstAttempt, secondAttempt],
    outcome: "flaky",
  });
  const noResultTest = createTestCase({
    id: "test-skipped-no-results",
    title: "not run",
    file: "tests/not-run.spec.ts",
    results: [],
    outcome: "skipped",
  });

  const adapter = new PlaywrightReportingAdapter(optionsFor(workspace));
  adapter.onBegin(createConfig(), createSuite([flakyTest, noResultTest]));
  await adapter.onEnd(
    createFullResult({ status: "passed", duration: 500 }),
  );

  const runDirectory = findRunDirectory(workspace.reportsRoot);
  const canonical = core.parseRunDocument(
    fs.readFileSync(path.join(runDirectory, "run.json"), "utf8"),
  );
  const legacy = readJson(path.join(runDirectory, "results.json"));

  const flaky = canonical.tests.find((entry) => entry.id === "test-flaky");
  const skipped = canonical.tests.find(
    (entry) => entry.id === "test-skipped-no-results",
  );

  assert.equal(flaky.status, "flaky");
  assert.equal(flaky.attempts.length, 2);
  assert.deepEqual(flaky.retries, { configured: 1, used: 1 });
  assert.equal(flaky.durationMs, 100);
  assert.equal(skipped.status, "skipped");
  assert.equal(skipped.attempts.length, 1);
  assert.equal(skipped.attempts[0].status, "skipped");
  assert.equal(skipped.attempts[0].extensions?.synthetic, true);

  const legacyFlaky = legacy.tests.find((entry) => entry.id === "test-flaky");
  const legacySkipped = legacy.tests.find(
    (entry) => entry.id === "test-skipped-no-results",
  );
  assert.equal(legacyFlaky.status, "flaky");
  assert.equal(legacyFlaky.retryAttempts, 1);
  assert.equal(legacySkipped.status, "skipped");
  assert.equal(legacySkipped.attempts.length, 1);

  assert.deepEqual(core.compareLegacyResults(legacy).differences, []);
  assert.equal(core.validateRunDocument(canonical).ok, true);
});

test("reports generation failures without throwing or changing latest history", async (t) => {
  const workspace = createWorkspace();
  t.after(() => fs.rmSync(workspace.root, { recursive: true, force: true }));
  fs.rmSync(workspace.playwrightReportDirectory, {
    recursive: true,
    force: true,
  });

  const priorDirectory = createPriorReport(workspace.reportsRoot, "prior-run");
  const priorResults = fs.readFileSync(
    path.join(priorDirectory, "results.json"),
    "utf8",
  );
  const latestDirectory = path.join(workspace.reportsRoot, "latest");
  fs.mkdirSync(latestDirectory, { recursive: true });
  const sentinel = "<!doctype html><title>Previous latest</title>";
  fs.writeFileSync(
    path.join(latestDirectory, "index.html"),
    sentinel,
    "utf8",
  );

  const passingResult = createTestResult();
  const passingTest = createTestCase({
    id: "test-passed",
    title: "standard user can log in",
    results: [passingResult],
  });

  const adapter = new PlaywrightReportingAdapter(optionsFor(workspace));
  adapter.onBegin(createConfig(), createSuite([passingTest]));

  const messages = [];
  const originalError = console.error;
  console.error = (...args) => {
    messages.push(args.join(" "));
  };

  const exitCodeBefore = process.exitCode;
  try {
    await adapter.onEnd(createFullResult({ duration: 1000 }));
    assert.equal(process.exitCode, exitCodeBefore);
  } finally {
    console.error = originalError;
  }

  assert.ok(
    messages.some((message) =>
      message.includes("Report generation failed"),
    ),
  );
  assert.equal(
    fs.readFileSync(path.join(latestDirectory, "index.html"), "utf8"),
    sentinel,
  );
  assert.equal(
    fs.readFileSync(path.join(priorDirectory, "results.json"), "utf8"),
    priorResults,
  );

  const failedRunDirectory = findRunDirectory(workspace.reportsRoot, [
    "prior-run",
  ]);
  assert.equal(
    fs.existsSync(path.join(failedRunDirectory, "run.json")),
    false,
  );
  assert.equal(
    fs.existsSync(path.join(failedRunDirectory, "results.json")),
    false,
  );
});
