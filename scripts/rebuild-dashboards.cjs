#!/usr/bin/env node
/**
 * Rebuild every dashboard under reports/ with the current dashboard template.
 *
 * Dashboards are static HTML snapshots written when a run completes. After the
 * template changes, older report folders keep the old UI until they are
 * regenerated. This script reads each run's results.json, normalizes legacy
 * records to the current ReportDocument shape, and rewrites dashboard/index.html
 * so the date picker, filters, and layout stay consistent across history.
 *
 * Usage:
 *   npm run report:rebuild
 *   npm run report:rebuild -- ./reports
 *
 * Requires a compiled dashboard template. Run `npm run build:reporter` first.
 */
const fs = require("node:fs");
const path = require("node:path");

const reportsRoot = path.resolve(process.argv[2] || "reports");
const templatePath = path.resolve(
  __dirname,
  "..",
  "reporting",
  "dist",
  "dashboard-template.js",
);

if (!fs.existsSync(templatePath)) {
  console.error(
    `Missing ${templatePath}. Run "npm run build:reporter" before rebuilding dashboards.`,
  );
  process.exit(1);
}

const { createDashboard } = require(templatePath);
const DASHBOARD_SETTINGS = {
  timezone: "Asia/Kolkata",
  timezoneLabel: "IST",
  timezoneOffset: "UTC+05:30",
};

function readRuns() {
  return fs
    .readdirSync(reportsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name !== "latest" && name !== ".current")
    .map((name) => {
      const resultsPath = path.join(reportsRoot, name, "results.json");
      if (!fs.existsSync(resultsPath)) return undefined;
      try {
        return normalizeReport(
          JSON.parse(fs.readFileSync(resultsPath, "utf8")),
          name,
        );
      } catch (error) {
        console.warn(`Skipping ${name}: ${error.message}`);
        return undefined;
      }
    })
    .filter(Boolean)
    .sort((left, right) => left.run.startTime.localeCompare(right.run.startTime));
}

function normalizeReport(raw, fallbackRunId) {
  const run = raw.run || {};
  const metadata = raw.metadata || {};
  const browsers = Array.isArray(metadata.browsers) ? metadata.browsers : [];
  const projects = Array.isArray(metadata.projects)
    ? metadata.projects
    : browsers;
  const runStart = run.startTime || new Date(0).toISOString();
  const tests = (Array.isArray(raw.tests) ? raw.tests : []).map((test) =>
    normalizeTest(test, { runStart, browsers }),
  );
  const summary = raw.summary || summarize(tests);
  const suites =
    Array.isArray(raw.suites) && raw.suites.length
      ? raw.suites
      : buildSuites(tests);
  const modules =
    Array.isArray(raw.modules) && raw.modules.length
      ? raw.modules.map((module) => normalizeModule(module, tests))
      : buildModules(tests);
  const specs =
    Array.isArray(raw.specs) && raw.specs.length
      ? raw.specs
      : buildSpecs(tests);

  return {
    schemaVersion: 2,
    run: {
      id: run.id || fallbackRunId,
      status: run.status || "unknown",
      startTime: runStart,
      endTime: run.endTime || runStart,
      timezone: run.timezone || DASHBOARD_SETTINGS.timezone,
    },
    metadata: {
      environment: metadata.environment || "unknown",
      baseURL: metadata.baseURL || "",
      browsers,
      projects,
      operatingSystem: metadata.operatingSystem || "",
      nodeVersion: metadata.nodeVersion || "",
      ci: Boolean(metadata.ci),
    },
    summary,
    suites,
    modules,
    specs,
    tests,
    globalErrors: Array.isArray(raw.globalErrors) ? raw.globalErrors : [],
  };
}

function normalizeTest(test, { runStart, browsers }) {
  const file = test.file || test.spec?.path || "";
  const browser = test.browser || browsers[0] || "";
  const project = test.project || browser;
  const suites = Array.isArray(test.suites)
    ? test.suites
    : test.suite
      ? [test.suite]
      : [];
  const spec =
    test.spec && test.spec.key
      ? test.spec
      : {
          key: `${file}::${project}`,
          name: file.split("/").pop() || file,
          path: file,
        };
  const titlePath =
    Array.isArray(test.titlePath) && test.titlePath.length
      ? test.titlePath
      : [...suites, test.title].filter(Boolean);

  return {
    id: test.id || `${file}:${test.line || 0}:${test.title}`,
    title: test.title || "",
    titlePath,
    suites,
    module: normalizeModuleName(test, file),
    spec,
    file,
    line: Number(test.line) || 0,
    column: Number(test.column) || 0,
    status: test.status || "skipped",
    project,
    browser,
    repeatEachIndex: Number(test.repeatEachIndex) || 0,
    durationMs: Number(test.durationMs) || 0,
    retriesConfigured: Number(test.retriesConfigured) || 0,
    retryAttempts: Number(test.retryAttempts) || 0,
    tags: Array.isArray(test.tags) ? test.tags : [],
    attempts: (Array.isArray(test.attempts) ? test.attempts : []).map(
      (attempt) => normalizeAttempt(attempt, runStart),
    ),
  };
}

function normalizeAttempt(attempt, runStart) {
  const startTime = attempt.startTime || runStart;
  return {
    attempt: Number(attempt.attempt) || 1,
    retry: Number(attempt.retry) || 0,
    status: attempt.status || "unknown",
    durationMs: Number(attempt.durationMs) || 0,
    startTime,
    workerIndex: Number(attempt.workerIndex) || 0,
    errors: Array.isArray(attempt.errors) ? attempt.errors : [],
    steps: (Array.isArray(attempt.steps) ? attempt.steps : []).map((step) =>
      normalizeStep(step, startTime),
    ),
    artifacts: Array.isArray(attempt.artifacts) ? attempt.artifacts : [],
    logs: Array.isArray(attempt.logs) ? attempt.logs : [],
  };
}

function normalizeStep(step, fallbackStart) {
  return {
    title: step.title || "",
    subtitle: step.subtitle,
    category: step.category || "step",
    status: step.status === "failed" ? "failed" : "passed",
    durationMs: Number(step.durationMs) || 0,
    startTime: step.startTime || fallbackStart,
    error: step.error,
    steps: (Array.isArray(step.steps) ? step.steps : []).map((child) =>
      normalizeStep(child, fallbackStart),
    ),
  };
}

function normalizeModuleName(test, file) {
  const tagged = (Array.isArray(test.tags) ? test.tags : [])
    .map((tag) => String(tag).trim().toLowerCase().replace(/^@/, ""))
    .find((tag) => tag.startsWith("module:"));
  if (tagged) return normalizeClassification(tagged.slice("module:".length));

  const normalizedPath = file.replaceAll("\\", "/");
  const segments = normalizedPath.split("/").filter(Boolean);
  const testsIndex = segments.lastIndexOf("tests");
  const sourceSegments =
    testsIndex >= 0 ? segments.slice(testsIndex + 1) : segments;
  if (sourceSegments.length > 1) {
    return normalizeClassification(sourceSegments[0]) || "unclassified";
  }
  const basename = (sourceSegments[0] || normalizedPath)
    .replace(/\.(?:spec|test)\.[^.]+$/i, "")
    .replace(/\.[^.]+$/i, "");
  return normalizeClassification(basename) || "unclassified";
}

function normalizeClassification(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function summarize(tests) {
  const count = (status) =>
    tests.filter((test) => test.status === status).length;
  const total = tests.length;
  const passed = count("passed");
  return {
    total,
    passed,
    failed: count("failed"),
    skipped: count("skipped"),
    flaky: count("flaky"),
    passPercentage:
      total === 0 ? 0 : Number(((passed / total) * 100).toFixed(1)),
    durationMs: tests.reduce((totalMs, test) => totalMs + test.durationMs, 0),
  };
}

function buildSuites(tests) {
  const grouped = new Map();
  for (const test of tests) {
    for (const suite of test.suites) {
      grouped.set(suite, [...(grouped.get(suite) || []), test]);
    }
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, suiteTests]) => ({ name, summary: summarize(suiteTests) }));
}

function buildModules(tests) {
  const grouped = new Map();
  for (const test of tests) {
    grouped.set(test.module, [...(grouped.get(test.module) || []), test]);
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, moduleTests]) => ({
      name,
      specKeys: [...new Set(moduleTests.map((test) => test.spec.key))].sort(),
      summary: summarize(moduleTests),
    }));
}

function buildSpecs(tests) {
  const grouped = new Map();
  for (const test of tests) {
    grouped.set(test.spec.key, [...(grouped.get(test.spec.key) || []), test]);
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, specTests]) => {
      const first = specTests[0];
      return {
        key,
        name: first.spec.name,
        path: first.spec.path,
        project: first.project,
        browser: first.browser,
        module: first.module,
        summary: summarize(specTests),
      };
    });
}

function normalizeModule(module, tests) {
  if (module && module.summary) return module;
  const moduleTests = tests.filter((test) => test.module === module?.name);
  return {
    name: module?.name || "unclassified",
    specKeys: [...new Set(moduleTests.map((test) => test.spec.key))].sort(),
    summary: module?.summary || summarize(moduleTests),
  };
}

function historyRecord(report) {
  return {
    runId: report.run.id,
    startTime: report.run.startTime,
    endTime: report.run.endTime,
    environment: report.metadata.environment,
    browsers: report.metadata.browsers,
    projects: report.metadata.projects,
    suites: report.suites,
    summary: report.summary,
    failedTestIds: report.tests
      .filter((test) => test.status === "failed")
      .map((test) => test.id),
    dashboardPath: `../../${report.run.id}/dashboard/index.html`,
  };
}

function writeDashboard(report, history) {
  const outputPath = path.join(
    reportsRoot,
    report.run.id,
    "dashboard",
    "index.html",
  );
  const temporaryPath = `${outputPath}.tmp`;
  const html = createDashboard({ ...report, history }, DASHBOARD_SETTINGS);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(temporaryPath, html);
  fs.renameSync(temporaryPath, outputPath);
}

function main() {
  if (!fs.existsSync(reportsRoot)) {
    console.error(`Reports root not found: ${reportsRoot}`);
    process.exit(1);
  }

  const reports = readRuns();
  if (!reports.length) {
    console.log(`No completed runs found under ${reportsRoot}.`);
    return;
  }

  const history = reports.map(historyRecord);
  for (const report of reports) {
    writeDashboard(report, history);
    console.log(`Rebuilt ${report.run.id}`);
  }
  console.log(
    `\nRebuilt ${reports.length} dashboard${reports.length === 1 ? "" : "s"} under ${reportsRoot}.`,
  );
}

main();
