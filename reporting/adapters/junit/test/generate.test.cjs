const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  EMPTY_RUN_XML,
  PYTEST_XML,
  REST_ASSURED_XML,
  createEvidence,
  createPriorReport,
  createWorkspace,
  readJson,
  writeManifest,
  writeXml,
} = require("./fixtures.cjs");
const { loadRepo } = require("../../../universal/test/load-ts.cjs");

const { generateJunitReport, MAX_JUNIT_XML_BYTES } = loadRepo(
  "reporting/adapters/junit/generate.ts",
);
const { validateRunDocument } = loadRepo(
  "reporting/universal/schema/validate.ts",
);

const TIMEZONE = "Asia/Kolkata";

function read(file) {
  return fs.readFileSync(file, "utf8");
}

test("generates a JUnit-only run folder, dashboard, history, and evidence", async (t) => {
  const workspace = createWorkspace();
  t.after(() => fs.rmSync(workspace.root, { recursive: true, force: true }));
  createPriorReport(workspace.reportsRoot);

  const xml = writeXml(workspace, "results.xml", PYTEST_XML);
  const evidence = createEvidence(workspace);
  const manifest = writeManifest(workspace, {
    version: 1,
    attachments: [
      {
        classname: "tests.test_login",
        testName: "test_valid_login",
        kind: "screenshot",
        path: path.relative(workspace.root, evidence.screenshot),
      },
      {
        classname: "tests.test_login",
        testName: "test_invalid_password",
        kind: "log",
        path: path.relative(workspace.root, evidence.log),
      },
    ],
  });

  const result = await generateJunitReport({
    inputs: [xml],
    reportsRoot: workspace.reportsRoot,
    manifestPath: manifest,
    timezone: TIMEZONE,
  });

  assert.equal(path.basename(result.runDirectory), result.runId);
  assert.equal(result.copiedAttachments, 2);
  assert.equal(result.sourceFiles.length, 1);
  assert.equal(result.report.summary.total, 3);
  assert.equal(result.report.summary.passed, 1);
  assert.equal(result.report.summary.failed, 1);
  assert.equal(result.report.summary.skipped, 1);

  const runJson = path.join(result.runDirectory, "run.json");
  const resultsJson = path.join(result.runDirectory, "results.json");
  const dashboardHtml = path.join(
    result.runDirectory,
    "dashboard",
    "index.html",
  );
  const document = readJson(runJson);
  const legacy = readJson(resultsJson);
  const html = read(dashboardHtml);

  assert.equal(validateRunDocument(document).ok, true);
  assert.equal(document.run.id, result.runId);
  assert.equal(document.tests.length, 3);
  assert.equal(legacy.tests.length, 3, "tests must not be double-counted");
  assert.equal(legacy.schemaVersion, 2);
  assert.equal(document.capabilities.attachments, true);
  assert.equal(document.capabilities.logs, true);

  const copiedXml = path.join(result.runDirectory, "junit", "results.xml");
  assert.equal(read(copiedXml), PYTEST_XML);
  assert.ok(
    document.externalReports.some(
      (report) => report.path === "junit/results.xml" && report.kind === "xml",
    ),
  );
  assert.ok(
    document.externalReports.some(
      (report) => report.path === "junit-manifest.json",
    ),
  );
  assert.equal(
    fs.existsSync(path.join(result.runDirectory, "junit-manifest.json")),
    true,
  );

  const passed = document.tests.find(
    (item) => item.title === "test_valid_login",
  );
  const failed = document.tests.find(
    (item) => item.title === "test_invalid_password",
  );
  assert.equal(passed.attempts[0].evidence.length, 1);
  assert.equal(passed.attempts[0].evidence[0].kind, "screenshot");
  assert.equal(
    fs.existsSync(
      path.join(result.runDirectory, passed.attempts[0].evidence[0].path),
    ),
    true,
  );
  assert.equal(failed.attempts[0].evidence[0].kind, "log");
  assert.ok(
    failed.attempts[0].logs.some((log) => /line one/.test(log.text)),
  );
  const legacyFailed = legacy.tests.find(
    (item) => item.title === "test_invalid_password",
  );
  const logArtifact = legacyFailed.attempts[0].artifacts.find(
    (artifact) => artifact.kind === "log",
  );
  assert.equal(logArtifact.filename, "test.log");
  assert.equal(logArtifact.contentType, "text/plain");
  assert.equal(logArtifact.available, true);
  assert.match(logArtifact.preview.content, /line one/);
  assert.equal(logArtifact.preview.kind, "text");

  assert.match(html, /<title>JUnit Execution Dashboard/);
  assert.match(html, /JUnit execution intelligence/);
  assert.match(html, /Suite \/ Class/);
  assert.match(html, /Not captured/);
  assert.match(html, /browserFilter\.hidden = true/);
  assert.doesNotMatch(html, /Playwright report/);
  assert.doesNotMatch(html, /trace\.playwright\.dev/);
  assert.match(html, /"runId":"prior-run"/);
  assert.match(html, new RegExp(`"runId":"${result.runId}"`));

  const latest = read(
    path.join(workspace.reportsRoot, "latest", "index.html"),
  );
  assert.match(
    latest,
    new RegExp(`url=\\.\\./${result.runId}/dashboard/index\\.html`),
  );
  assert.equal(
    fs.existsSync(path.join(workspace.reportsRoot, "prior-run", "results.json")),
    true,
  );
});

test("aggregates multiple XML files from a directory without double-counting", async (t) => {
  const workspace = createWorkspace();
  t.after(() => fs.rmSync(workspace.root, { recursive: true, force: true }));

  writeXml(workspace, "pytest.xml", PYTEST_XML);
  writeXml(workspace, "api.xml", REST_ASSURED_XML);
  fs.mkdirSync(path.join(workspace.inputs, "nested"));
  writeXml(workspace, "nested/empty.xml", EMPTY_RUN_XML);

  const result = await generateJunitReport({
    inputs: [workspace.inputs],
    reportsRoot: workspace.reportsRoot,
    timezone: TIMEZONE,
  });

  assert.equal(result.sourceFiles.length, 3);
  assert.equal(result.document.tests.length, 5);
  assert.equal(result.report.summary.total, 5);
  assert.equal(result.document.run.durationMs, 1250 + 900);
  assert.equal(result.document.run.startedAt, "2026-10-27T06:53:47.569Z");
  assert.deepEqual(
    fs.readdirSync(path.join(result.runDirectory, "junit")).sort(),
    ["api.xml", "empty.xml", "pytest.xml"],
  );
  assert.equal(
    result.document.externalReports.filter(
      (report) => report.kind === "xml",
    ).length,
    3,
  );
});

test("renders an empty JUnit run with explicit empty states", async (t) => {
  const workspace = createWorkspace();
  t.after(() => fs.rmSync(workspace.root, { recursive: true, force: true }));

  const xml = writeXml(workspace, "empty.xml", EMPTY_RUN_XML);
  const result = await generateJunitReport({
    inputs: [xml],
    reportsRoot: workspace.reportsRoot,
    timezone: TIMEZONE,
  });

  assert.equal(result.report.summary.total, 0);
  assert.equal(result.document.run.status, "unknown");
  const html = read(result.dashboardPath);
  assert.match(html, /JUnit Execution Dashboard/);
  assert.match(html, /No test results match the current filters/);
  assert.match(html, /Not captured/);
  assert.match(html, /browserFilter\.hidden = true/);
  assert.match(
    read(path.join(workspace.reportsRoot, "latest", "index.html")),
    new RegExp(`url=\\.\\./${result.runId}/dashboard/index\\.html`),
  );
});

test("a failed generation removes the incomplete run and preserves latest", async (t) => {
  const workspace = createWorkspace();
  t.after(() => fs.rmSync(workspace.root, { recursive: true, force: true }));
  createPriorReport(workspace.reportsRoot);
  const latestPath = path.join(workspace.reportsRoot, "latest", "index.html");
  const latestBefore = read(latestPath);

  const xml = writeXml(workspace, "results.xml", PYTEST_XML);
  const manifest = writeManifest(workspace, {
    attachments: [
      {
        testId: "junit-does-not-exist",
        kind: "screenshot",
        path: "missing.png",
      },
    ],
  });

  await assert.rejects(
    () =>
      generateJunitReport({
        inputs: [xml],
        reportsRoot: workspace.reportsRoot,
        manifestPath: manifest,
        timezone: TIMEZONE,
      }),
    /does not match any test/,
  );

  assert.equal(read(latestPath), latestBefore);
  assert.deepEqual(
    fs.readdirSync(workspace.reportsRoot).sort(),
    ["latest", "prior-run"],
  );
  assert.equal(
    fs.existsSync(path.join(workspace.reportsRoot, "prior-run", "results.json")),
    true,
  );
});

test("invalid XML fails before reserving a run folder", async (t) => {
  const workspace = createWorkspace();
  t.after(() => fs.rmSync(workspace.root, { recursive: true, force: true }));
  createPriorReport(workspace.reportsRoot);
  const xml = writeXml(workspace, "broken.xml", "<testsuite><testcase></testsuite>");

  await assert.rejects(
    () =>
      generateJunitReport({
        inputs: [xml],
        reportsRoot: workspace.reportsRoot,
        timezone: TIMEZONE,
      }),
    /Unexpected closing tag|Unclosed tag/,
  );
  assert.deepEqual(
    fs.readdirSync(workspace.reportsRoot).sort(),
    ["latest", "prior-run"],
  );
});

test("rejects an oversized XML input before reserving a run folder", async (t) => {
  const workspace = createWorkspace();
  t.after(() => fs.rmSync(workspace.root, { recursive: true, force: true }));
  createPriorReport(workspace.reportsRoot);

  const oversized = path.join(workspace.inputs, "oversized.xml");
  const handle = fs.openSync(oversized, "w");
  fs.ftruncateSync(handle, MAX_JUNIT_XML_BYTES + 1);
  fs.closeSync(handle);

  await assert.rejects(
    () =>
      generateJunitReport({
        inputs: [oversized],
        reportsRoot: workspace.reportsRoot,
        timezone: TIMEZONE,
      }),
    /exceeds the 64\.0 MiB safety limit/,
  );
  assert.deepEqual(
    fs.readdirSync(workspace.reportsRoot).sort(),
    ["latest", "prior-run"],
  );
});

test("rejects missing inputs and empty directories", async (t) => {
  const workspace = createWorkspace();
  t.after(() => fs.rmSync(workspace.root, { recursive: true, force: true }));

  await assert.rejects(
    () =>
      generateJunitReport({
        inputs: [],
        reportsRoot: workspace.reportsRoot,
        timezone: TIMEZONE,
      }),
    /No JUnit XML input/,
  );
  await assert.rejects(
    () =>
      generateJunitReport({
        inputs: [workspace.inputs],
        reportsRoot: workspace.reportsRoot,
        timezone: TIMEZONE,
      }),
    /No JUnit XML files were found/,
  );
  await assert.rejects(
    () =>
      generateJunitReport({
        inputs: [path.join(workspace.root, "nope.xml")],
        reportsRoot: workspace.reportsRoot,
        timezone: TIMEZONE,
      }),
    /could not be read/,
  );
});
