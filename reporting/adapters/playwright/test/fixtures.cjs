const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const DEFAULT_START = new Date("2026-10-28T06:00:00.000Z");

function createWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "qa-playwright-adapter-"));
  const reportsRoot = path.join(root, "reports");
  const stagingDirectory = path.join(reportsRoot, ".current");
  const playwrightReportDirectory = path.join(
    stagingDirectory,
    "playwright-report",
  );
  const artifactsRoot = path.join(root, "artifacts");

  fs.mkdirSync(playwrightReportDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(playwrightReportDirectory, "index.html"),
    "<!doctype html><title>Native report</title>",
    "utf8",
  );
  fs.mkdirSync(artifactsRoot, { recursive: true });

  return {
    root,
    reportsRoot,
    stagingDirectory,
    playwrightReportDirectory,
    artifactsRoot,
  };
}

function optionsFor(workspace) {
  return {
    reportsRoot: workspace.reportsRoot,
    stagingDirectory: workspace.stagingDirectory,
    playwrightReportDirectory: workspace.playwrightReportDirectory,
    timezone: "Asia/Kolkata",
    environment: "demo",
    baseURL: "https://example.test",
  };
}

function createArtifactFiles(workspace) {
  const screenshot = path.join(workspace.artifactsRoot, "failure.png");
  const video = path.join(workspace.artifactsRoot, "failure.webm");
  const trace = path.join(workspace.artifactsRoot, "trace.zip");

  fs.writeFileSync(screenshot, Buffer.from("fake-png"));
  fs.writeFileSync(video, Buffer.from("fake-video"));
  fs.writeFileSync(trace, Buffer.from("fake-trace"));

  return { screenshot, video, trace };
}

function createAttachment(name, contentType, filePath) {
  return { name, contentType, path: filePath };
}

function createStep({
  title = "step",
  subtitle,
  category = "test.step",
  duration = 10,
  startTime = DEFAULT_START,
  error,
  steps = [],
} = {}) {
  return {
    title,
    subtitle,
    category,
    duration,
    startTime,
    error,
    steps,
  };
}

function createTestResult({
  status = "passed",
  duration = 100,
  startTime = DEFAULT_START,
  retry = 0,
  workerIndex = 0,
  errors = [],
  steps = [],
  attachments = [],
} = {}) {
  return {
    status,
    duration,
    startTime,
    retry,
    workerIndex,
    errors,
    steps,
    attachments,
    stdout: [],
    stderr: [],
  };
}

function createTestCase({
  id,
  title,
  tags = [],
  file = "tests/login.spec.ts",
  line = 9,
  column = 7,
  projectName = "chromium",
  browserName = "chromium",
  repeatEachIndex = 0,
  retries = 0,
  results = [],
  outcome = "expected",
  titlePath,
} = {}) {
  const absoluteFile = path.isAbsolute(file)
    ? file
    : path.join(process.cwd(), file);

  return {
    id,
    title,
    tags,
    location: { file: absoluteFile, line, column },
    repeatEachIndex,
    retries,
    results,
    parent: {
      project: () => ({
        name: projectName,
        use: { browserName },
      }),
    },
    titlePath: () =>
      titlePath ?? [projectName, path.basename(absoluteFile), title],
    outcome: () => outcome,
  };
}

function createSuite(tests) {
  return { allTests: () => tests };
}

function createConfig(version = "1.64.1") {
  return { version };
}

function createFullResult({
  status = "passed",
  startTime = DEFAULT_START,
  duration = 1000,
} = {}) {
  return { status, startTime, duration };
}

function createPriorReport(reportsRoot, runId = "prior-run") {
  const runDirectory = path.join(reportsRoot, runId);
  fs.mkdirSync(path.join(runDirectory, "dashboard"), { recursive: true });
  fs.writeFileSync(
    path.join(runDirectory, "dashboard", "index.html"),
    "<!doctype html><title>Prior dashboard</title>",
    "utf8",
  );
  fs.writeFileSync(
    path.join(runDirectory, "results.json"),
    JSON.stringify(
      {
        schemaVersion: 2,
        run: {
          id: runId,
          status: "passed",
          startTime: "2026-10-27T06:00:00.000Z",
          endTime: "2026-10-27T06:00:01.000Z",
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
          total: 1,
          passed: 1,
          failed: 0,
          skipped: 0,
          flaky: 0,
          passPercentage: 100,
          durationMs: 100,
        },
        suites: [],
        modules: [],
        specs: [],
        tests: [],
        globalErrors: [],
      },
      null,
      2,
    ),
    "utf8",
  );
  return runDirectory;
}

function findRunDirectory(reportsRoot, excludedRunIds = []) {
  const entries = fs
    .readdirSync(reportsRoot, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name !== "latest" &&
        entry.name !== ".current" &&
        !excludedRunIds.includes(entry.name),
    );

  if (entries.length !== 1) {
    throw new Error(
      `Expected exactly one run directory, found ${entries.length}: ${entries
        .map((entry) => entry.name)
        .join(", ")}`,
    );
  }

  return path.join(reportsRoot, entries[0].name);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

module.exports = {
  DEFAULT_START,
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
};
