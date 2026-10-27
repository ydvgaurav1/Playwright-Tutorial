const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const vm = require("node:vm");

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};

const projectRoot = path.resolve(__dirname, "..");

function loadModel() {
  try {
    return require(path.join(__dirname, "report-model.ts"));
  } catch (error) {
    if (error.code === "MODULE_NOT_FOUND") return {};
    throw error;
  }
}

function testRecord(overrides = {}) {
  return {
    id: "test-id-1",
    title: "standard user can log in",
    titlePath: ["SauceDemo login", "standard user can log in"],
    suites: ["sanity", "regression"],
    module: "authentication",
    spec: {
      key: "tests/login.spec.ts::chromium",
      name: "login.spec.ts",
      path: "tests/login.spec.ts",
    },
    file: "tests/login.spec.ts",
    line: 9,
    column: 7,
    status: "passed",
    project: "chromium",
    browser: "chromium",
    repeatEachIndex: 0,
    durationMs: 100,
    retriesConfigured: 0,
    retryAttempts: 0,
    tags: ["@sanity", "@regression", "@module:authentication"],
    attempts: [],
    ...overrides,
  };
}

test("classifies one test into every declared suite without treating module tags as suites", () => {
  const { classifySuites } = loadModel();

  assert.deepEqual(
    typeof classifySuites === "function"
      ? classifySuites([
          "@regression",
          "@sanity",
          "@module:authentication",
          "@demo",
          "@suite:release-candidate",
          "@sanity",
        ])
      : undefined,
    ["regression", "release-candidate", "sanity"],
  );
});

test("uses explicit module metadata and a deterministic source-path fallback", () => {
  const { classifyModule } = loadModel();

  assert.equal(
    typeof classifyModule === "function"
      ? classifyModule(["@module:authentication"], "tests/demo/login.spec.ts")
      : undefined,
    "authentication",
  );
  assert.equal(
    typeof classifyModule === "function"
      ? classifyModule([], "tests/cart/add-item.spec.ts")
      : undefined,
    "cart",
  );
  assert.equal(
    typeof classifyModule === "function"
      ? classifyModule([], "tests/login.spec.ts")
      : undefined,
    "login",
  );
});

test("counts overlapping suite membership once overall and once in each suite view", () => {
  const { createSummary, createSuiteRecords } = loadModel();
  const tests = [
    testRecord(),
    testRecord({
      id: "test-id-2",
      title: "invalid user sees an authentication error",
      suites: ["regression"],
      status: "failed",
      durationMs: 250,
    }),
  ];

  assert.deepEqual(
    typeof createSummary === "function" ? createSummary(tests, 500) : undefined,
    {
      total: 2,
      passed: 1,
      failed: 1,
      skipped: 0,
      flaky: 0,
      passPercentage: 50,
      durationMs: 500,
    },
  );
  assert.deepEqual(
    typeof createSuiteRecords === "function" ? createSuiteRecords(tests) : undefined,
    [
      {
        name: "regression",
        summary: {
          total: 2,
          passed: 1,
          failed: 1,
          skipped: 0,
          flaky: 0,
          passPercentage: 50,
          durationMs: 350,
        },
      },
      {
        name: "sanity",
        summary: {
          total: 1,
          passed: 1,
          failed: 0,
          skipped: 0,
          flaky: 0,
          passPercentage: 100,
          durationMs: 100,
        },
      },
    ],
  );
});

test("keeps the same spec path separate across Playwright projects", () => {
  const { createSpecRecords } = loadModel();
  const tests = [
    testRecord(),
    testRecord({
      id: "test-id-firefox",
      project: "firefox",
      browser: "firefox",
      spec: {
        key: "tests/login.spec.ts::firefox",
        name: "login.spec.ts",
        path: "tests/login.spec.ts",
      },
    }),
  ];

  const specs =
    typeof createSpecRecords === "function" ? createSpecRecords(tests) : undefined;
  assert.equal(specs?.length, 2);
  assert.deepEqual(
    specs?.map(({ key, project, summary }) => ({ key, project, total: summary.total })),
    [
      { key: "tests/login.spec.ts::chromium", project: "chromium", total: 1 },
      { key: "tests/login.spec.ts::firefox", project: "firefox", total: 1 },
    ],
  );
});

test("renders a result-independent dashboard title and the complete filter set", () => {
  const { createDashboard } = require(path.join(
    projectRoot,
    "reporting/dashboard-template.ts",
  ));
  const html = createDashboard({
    schemaVersion: 2,
    run: {
      id: "run-1",
      status: "failed",
      startTime: "2026-10-26T10:00:00.000Z",
      endTime: "2026-10-26T10:00:01.000Z",
      timezone: "Asia/Kolkata",
    },
    metadata: {
      environment: "demo",
      baseURL: "https://example.test",
      browsers: ["chromium"],
      projects: ["chromium"],
      operatingSystem: "test-os",
      nodeVersion: "v22",
      ci: false,
    },
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      flaky: 0,
      passPercentage: 0,
      durationMs: 0,
    },
    suites: [],
    modules: [],
    specs: [],
    tests: [],
    globalErrors: [],
    history: [],
  });

  assert.match(html, /<h1>Automation Dashboard<\/h1>/);
  assert.doesNotMatch(html, /id="overallStatus"/);
  for (const filterId of [
    "runFilter",
    "suiteFilter",
    "moduleFilter",
    "specFilter",
    "statusFilter",
    "browserFilter",
  ]) {
    assert.match(html, new RegExp(`id="${filterId}"`));
  }

  const embeddedScript = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
  assert.ok(embeddedScript, "dashboard must include its client script");
  assert.doesNotThrow(
    () => new vm.Script(embeddedScript, { filename: "dashboard-embedded.js" }),
    "generated dashboard client script must parse",
  );
});
