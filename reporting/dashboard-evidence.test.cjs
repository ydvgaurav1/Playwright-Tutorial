const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { chromium } = require("playwright");
const { loadRepo } = require("./universal/test/load-ts.cjs");

const { createDashboard } = loadRepo("reporting/dashboard-template.ts");

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function dashboardDocument(artifacts) {
  const summary = {
    total: 1,
    passed: 0,
    failed: 1,
    skipped: 0,
    flaky: 0,
    passPercentage: 0,
    durationMs: 10,
  };
  return {
    schemaVersion: 2,
    run: {
      id: "evidence-run",
      status: "failed",
      startTime: "2026-10-28T10:00:00.000Z",
      endTime: "2026-10-28T10:00:00.010Z",
      timezone: "Asia/Kolkata",
    },
    metadata: {
      environment: "evidence-test",
      baseURL: "",
      browsers: ["chromium"],
      projects: ["chromium"],
      operatingSystem: "test-os",
      nodeVersion: "v22",
      ci: false,
    },
    summary,
    suites: [],
    modules: [{ name: "evidence", specKeys: ["evidence::chromium"], summary }],
    specs: [
      {
        key: "evidence::chromium",
        name: "evidence.spec.ts",
        path: "evidence.spec.ts",
        project: "chromium",
        browser: "chromium",
        module: "evidence",
        summary,
      },
    ],
    tests: [
      {
        id: "evidence-test",
        title: "renders every evidence type",
        titlePath: ["renders every evidence type"],
        suites: [],
        module: "evidence",
        spec: {
          key: "evidence::chromium",
          name: "evidence.spec.ts",
          path: "evidence.spec.ts",
        },
        file: "evidence.spec.ts",
        line: 1,
        column: 1,
        status: "failed",
        project: "chromium",
        browser: "chromium",
        repeatEachIndex: 0,
        durationMs: 10,
        retriesConfigured: 0,
        retryAttempts: 0,
        tags: [],
        attempts: [
          {
            attempt: 1,
            retry: 0,
            status: "failed",
            durationMs: 10,
            startTime: "2026-10-28T10:00:00.000Z",
            workerIndex: 0,
            errors: [
              {
                message: "Expected the response status to match",
                expected: "200",
                actual: "500",
                stack: "at evidence.spec.ts:1:1",
              },
            ],
            steps: [],
            artifacts,
            logs: [],
          },
        ],
      },
    ],
    globalErrors: [],
    history: [],
  };
}

function artifact(kind, filename, contentType, overrides = {}) {
  return {
    kind,
    name: `${kind} evidence`,
    filename,
    contentType,
    path: `../attachments/${filename}`,
    bytes: 12,
    available: true,
    ...overrides,
  };
}

function comparisonSnapshot(id, status, overrides = {}) {
  return {
    id,
    title: id.replaceAll("-", " "),
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

async function serve(directory) {
  const server = http.createServer((request, response) => {
    const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const file = path.resolve(directory, `.${requestPath}`);
    if (file !== directory && !file.startsWith(`${directory}${path.sep}`)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    try {
      const content = fs.readFileSync(file);
      response.writeHead(200, {
        "Content-Type": file.endsWith(".html")
          ? "text/html"
          : file.endsWith(".json")
            ? "application/json"
            : "application/octet-stream",
      });
      response.end(content);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    server,
    origin: `http://127.0.0.1:${address.port}`,
  };
}

test("renders, previews, and downloads universal evidence without regressing media", async (t) => {
  const runDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "qa-dashboard-evidence-"));
  t.after(() => fs.rmSync(runDirectory, { recursive: true, force: true }));
  const dashboardDirectory = path.join(runDirectory, "dashboard");
  const attachmentDirectory = path.join(runDirectory, "attachments");
  fs.mkdirSync(dashboardDirectory, { recursive: true });
  fs.mkdirSync(attachmentDirectory, { recursive: true });
  fs.writeFileSync(path.join(attachmentDirectory, "failure.png"), ONE_PIXEL_PNG);
  fs.writeFileSync(path.join(attachmentDirectory, "failure.webm"), "video fixture");
  fs.writeFileSync(path.join(attachmentDirectory, "trace.zip"), "trace fixture");
  fs.writeFileSync(path.join(attachmentDirectory, "response.json"), '{"name":"Ada"}');
  fs.writeFileSync(path.join(attachmentDirectory, "server.log"), "request complete\n");
  fs.writeFileSync(path.join(attachmentDirectory, "archive.bin"), "binary fixture");
  fs.writeFileSync(path.join(attachmentDirectory, "native.html"), "<h1>native</h1>");

  const artifacts = [
    artifact("screenshot", "failure.png", "image/png", { bytes: ONE_PIXEL_PNG.length }),
    artifact("video", "failure.webm", "video/webm"),
    artifact("trace", "trace.zip", "application/zip", { format: "playwright" }),
    artifact("file", "response.json", "application/json", {
      preview: {
        kind: "json",
        content: '{\n  "name": "Ada"\n}',
        truncated: false,
      },
    }),
    artifact("log", "server.log", "text/plain", {
      preview: { kind: "text", content: "request complete\n", truncated: false },
    }),
    artifact("file", "archive.bin", "application/octet-stream"),
    artifact("native-report", "native.html", "text/html", {
      preview: { kind: "text", content: "<h1>native</h1>", truncated: false },
    }),
    artifact("file", "missing.txt", "text/plain", {
      path: "",
      available: false,
      unavailableReason: "Attachment was not found or could not be read.",
    }),
    artifact("file", "unsafe.txt", "text/plain", {
      path: "../../unsafe.txt",
      available: true,
    }),
  ];
  const document = dashboardDocument(artifacts);
  document.history = Array.from({ length: 7 }, (_, index) => ({
    runId: `history-run-${index + 1}`,
    startTime: `2026-10-${String(27 - index).padStart(2, "0")}T10:00:00.000Z`,
    endTime: `2026-10-${String(27 - index).padStart(2, "0")}T10:00:00.010Z`,
    environment: "evidence-test",
    browsers: ["chromium"],
    projects: ["chromium"],
    suites: [],
    summary: document.summary,
    failedTestIds: [],
    dashboardPath: `../../history-run-${index + 1}/dashboard/index.html`,
    dashboardAvailable: index === 0,
  }));
  const dashboardPath = path.join(dashboardDirectory, "index.html");
  fs.writeFileSync(
    dashboardPath,
    createDashboard(document, { traceViewerHref: null }),
  );

  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const hosted = await serve(runDirectory);
  t.after(() => new Promise((resolve) => hosted.server.close(resolve)));
  const page = await browser.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`${hosted.origin}/dashboard/index.html`);
  assert.equal(await page.locator("#historyRows tr").count(), 5);
  assert.match(
    await page.locator("#comparisonState").innerText(),
    /insufficient historical data/i,
  );
  assert.equal(await page.locator("#historyRows a").count(), 1);
  assert.equal(
    await page.locator("#historyRows .history-unavailable").count(),
    4,
  );
  assert.equal(
    await page.getByRole("button", { name: /View all 7 executions/i }).isVisible(),
    true,
  );
  await page.getByRole("button", { name: /View all 7 executions/i }).click();
  assert.equal(await page.locator("#historyRows tr").count(), 7);
  assert.equal(await page.locator("#historyRows a").count(), 1);
  assert.equal(
    await page.locator("#historyRows .history-unavailable").count(),
    6,
  );
  await page.getByRole("button", { name: /Show latest 5 executions/i }).click();
  assert.equal(await page.locator("#historyRows tr").count(), 5);

  const statusControl = page.locator(
    '[data-select-id="statusFilter"]',
  );
  assert.equal(await statusControl.locator(".select-trigger").isVisible(), true);
  await statusControl.locator(".select-trigger").click();
  assert.equal(await statusControl.locator(".select-listbox").isVisible(), true);
  assert.equal(
    await statusControl.locator(".select-listbox").evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
    "rgb(16, 28, 46)",
  );
  await statusControl.getByRole("option", { name: "Failed", exact: true }).click();
  assert.equal(await page.locator("#statusFilter").inputValue(), "failed");
  assert.doesNotMatch(
    await page.locator("#testRows").innerText(),
    /evidence-test/,
  );
  await page.locator("#testRows tr").click();

  assert.match(
    await page.locator("#detailContent").innerText(),
    /Stable test ID[\s\S]*evidence-test/i,
  );
  const copyId = page.getByRole("button", { name: "Copy stable test ID" });
  assert.equal(await copyId.isVisible(), true);
  await copyId.click();
  await page.waitForFunction(
    () =>
      document.querySelector('[aria-label="Copy stable test ID"]')
        ?.textContent === "Copied",
  );
  assert.equal(await copyId.innerText(), "Copied");
  const priority = page.locator(".detail-priority");
  assert.match(await priority.innerText(), /Primary failure/i);
  assert.match(
    await priority.innerText(),
    /Expected: 200[\s\S]*Actual: 500/,
  );
  assert.match(
    await priority.innerText(),
    /7 captured[\s\S]*2 unavailable/i,
  );
  assert.ok(
    (await page.locator(".detail-priority").evaluate((element) => {
      const details = element.parentElement;
      return (
        [...details.children].indexOf(element) <
        [...details.children].findIndex((child) =>
          child.classList.contains("details-grid"),
        )
      );
    })),
    "primary failure should appear before technical test metadata",
  );
  assert.equal(await page.locator(".artifact").count(), 9);
  assert.equal(await page.locator('[data-evidence-kind="screenshot"] img').count(), 1);
  assert.equal(
    await page.locator('[data-evidence-kind="screenshot"] img').evaluate(
      (image) => image.complete && image.naturalWidth > 0,
    ),
    true,
  );
  assert.equal(await page.locator('[data-evidence-kind="video"] video[controls]').count(), 1);
  assert.match(
    await page.locator('[data-evidence-kind="trace"]').innerText(),
    /Download trace ZIP|Playwright trace/i,
  );
  assert.match(
    await page.locator('[data-evidence-filename="response.json"]').innerText(),
    /response\.json[\s\S]*application\/json[\s\S]*12 B[\s\S]*"name": "Ada"/,
  );
  assert.match(
    await page.locator('[data-evidence-filename="server.log"] .artifact-preview').innerText(),
    /request complete/,
  );
  assert.match(
    await page.locator('[data-evidence-filename="archive.bin"]').innerText(),
    /Preview is not available/i,
  );
  assert.equal(
    await page.locator('[data-evidence-filename="missing.txt"] a').count(),
    0,
  );
  assert.match(
    await page.locator('[data-evidence-filename="missing.txt"]').innerText(),
    /not found|unavailable/i,
  );
  assert.equal(
    await page.locator('[data-evidence-filename="unsafe.txt"] a').count(),
    0,
  );
  assert.match(
    await page.locator('[data-evidence-filename="unsafe.txt"]').innerText(),
    /unsafe|blocked/i,
  );

  const jsonDownload = page.locator(
    '[data-evidence-filename="response.json"] .artifact-download',
  );
  assert.equal(await jsonDownload.getAttribute("download"), "response.json");
  const downloadPromise = page.waitForEvent("download");
  await jsonDownload.click();
  const download = await downloadPromise;
  const downloadedPath = await download.path();
  assert.equal(fs.readFileSync(downloadedPath, "utf8"), '{"name":"Ada"}');

  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(pageErrors, []);
});

test("compares completed executions with accessible filters at desktop and mobile sizes", async (t) => {
  const runDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "qa-dashboard-comparison-"),
  );
  t.after(() => fs.rmSync(runDirectory, { recursive: true, force: true }));
  const dashboardDirectory = path.join(runDirectory, "dashboard");
  fs.mkdirSync(dashboardDirectory, { recursive: true });

  const document = dashboardDocument([]);
  document.run.id = "current-run";
  document.run.startTime = "2026-11-25T10:00:00.000Z";
  document.run.endTime = "2026-11-25T10:00:01.400Z";
  document.summary = {
    total: 7,
    passed: 2,
    failed: 2,
    skipped: 1,
    flaky: 1,
    passPercentage: 28.57,
    durationMs: 1400,
  };
  const baselineTests = [
    comparisonSnapshot("new-regression", "passed"),
    comparisonSnapshot("resolved-failure", "failed"),
    comparisonSnapshot("recurring-failure", "failed"),
    comparisonSnapshot("not-executed", "failed"),
    comparisonSnapshot("missing-current", "passed"),
    comparisonSnapshot("retry-change", "passed"),
    comparisonSnapshot("unchanged-pass", "passed"),
  ];
  const currentTests = [
    comparisonSnapshot("new-regression", "failed"),
    comparisonSnapshot("resolved-failure", "passed"),
    comparisonSnapshot("recurring-failure", "failed"),
    comparisonSnapshot("not-executed", "skipped"),
    comparisonSnapshot("missing-baseline", "passed"),
    comparisonSnapshot("retry-change", "flaky", { retryAttempts: 1 }),
    comparisonSnapshot("unchanged-pass", "passed"),
  ];
  document.history = [
    {
      runId: "baseline-run",
      startTime: "2026-11-24T10:00:00.000Z",
      endTime: "2026-11-24T10:00:01.000Z",
      environment: "evidence-test",
      browsers: ["chromium"],
      projects: ["chromium"],
      suites: [],
      summary: {
        total: 7,
        passed: 4,
        failed: 3,
        skipped: 0,
        flaky: 0,
        passPercentage: 57.14,
        durationMs: 1000,
      },
      failedTestIds: ["resolved-failure", "recurring-failure", "not-executed"],
      dashboardPath: "../../baseline-run/dashboard/index.html",
      dashboardAvailable: false,
      tests: baselineTests,
    },
    {
      runId: "current-run",
      startTime: document.run.startTime,
      endTime: document.run.endTime,
      environment: "evidence-test",
      browsers: ["chromium"],
      projects: ["chromium"],
      suites: [],
      summary: document.summary,
      failedTestIds: ["new-regression", "recurring-failure"],
      dashboardPath: "../../current-run/dashboard/index.html",
      dashboardAvailable: true,
      tests: currentTests,
    },
  ];
  fs.writeFileSync(
    path.join(dashboardDirectory, "index.html"),
    createDashboard(document),
  );

  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const hosted = await serve(runDirectory);
  t.after(() => new Promise((resolve) => hosted.server.close(resolve)));

  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport });
    const consoleErrors = [];
    const pageErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(`${hosted.origin}/dashboard/index.html`);

    assert.equal(
      await page.locator("#comparisonSection").getAttribute("open"),
      viewport.name === "desktop" ? "" : null,
    );
    if (viewport.name === "mobile") {
      await page.locator("#comparisonSection > summary").click();
    }
    assert.equal(
      await page.locator("#comparisonBaseline").inputValue(),
      "baseline-run",
    );
    assert.equal(
      await page.locator("#comparisonCurrent").inputValue(),
      "current-run",
    );
    assert.match(
      await page.locator("#comparisonState").innerText(),
      /baseline report unavailable[\s\S]*embedded test data/i,
    );
    assert.equal(
      await page.locator('[data-comparison-metric="newlyFailed"] .comparison-value').innerText(),
      "1",
    );
    assert.equal(
      await page.locator('[data-comparison-metric="resolved"] .comparison-value').innerText(),
      "1",
    );
    assert.equal(
      await page.locator('[data-comparison-metric="recurring"] .comparison-value').innerText(),
      "1",
    );
    assert.match(
      await page.locator('[data-comparison-metric="passPercentage"]').innerText(),
      /−28\.57 pp/,
    );
    assert.match(
      await page.locator('[data-comparison-metric="durationMs"]').innerText(),
      /\+400 ms/,
    );

    const regressionFilter = page.getByRole("button", {
      name: "Newly failed (1)",
    });
    await regressionFilter.click();
    assert.equal(await regressionFilter.getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator("#comparisonRows tr").count(), 1);
    assert.match(
      await page.locator("#comparisonRows").innerText(),
      /new regression[\s\S]*passed[\s\S]*failed/i,
    );

    await page.getByRole("button", { name: "Missing (2)" }).click();
    assert.equal(await page.locator("#comparisonRows tr").count(), 2);
    assert.match(
      await page.locator("#comparisonRows").innerText(),
      /missing baseline[\s\S]*missing current/i,
    );

    await page.getByRole("button", { name: "Flaky or retry changes (1)" }).click();
    assert.equal(await page.locator("#comparisonRows tr").count(), 1);
    assert.match(
      await page.locator("#comparisonRows").innerText(),
      /retry change[\s\S]*Retries used changed from 0 to 1/i,
    );
    assert.equal(
      await page.locator("#historyRows .history-unavailable").count(),
      1,
    );
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(pageErrors, []);
    await page.close();
  }
});

test("renders deterministic flaky intelligence, timelines, filters, and evidence links", async (t) => {
  const runDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "qa-dashboard-flaky-intelligence-"),
  );
  t.after(() => fs.rmSync(runDirectory, { recursive: true, force: true }));
  const dashboardDirectory = path.join(runDirectory, "dashboard");
  fs.mkdirSync(dashboardDirectory, { recursive: true });

  const document = dashboardDocument([]);
  document.run.id = "history-run-4";
  document.run.startTime = "2026-11-04T10:00:00.000Z";
  const observed = (id, status, overrides = {}) =>
    comparisonSnapshot(id, status, {
      ...(status === "interrupted"
        ? { status: "failed", observationStatus: "interrupted" }
        : {}),
      ...overrides,
    });
  const statuses = {
    "stable-test": ["passed", "passed", "passed", "passed"],
    "persistent-failure": ["failed", "failed", "failed", "failed"],
    "alternating-test": ["passed", "failed", "passed", "failed"],
    "retry-dependent": ["passed", "flaky", "passed", "flaky"],
    "repeated-instability": ["passed", "failed", "flaky", "failed"],
  };
  document.history = Array.from({ length: 5 }, (_, index) => {
    const runNumber = index + 1;
    const tests =
      runNumber === 5
        ? undefined
        : Object.entries(statuses).map(([id, outcomes]) =>
            observed(id, outcomes[index], {
              retryAttempts:
                (id === "retry-dependent" && outcomes[index] === "flaky") ||
                (id === "repeated-instability" &&
                  (outcomes[index] === "flaky" ||
                    (runNumber === 4 && outcomes[index] === "failed")))
                  ? 1
                  : 0,
            }),
          );
    if (runNumber === 1) tests.push(observed("incomplete-test", "passed"));
    if (runNumber === 2) tests.push(observed("incomplete-test", "skipped"));
    if (runNumber === 4) tests.push(observed("incomplete-test", "interrupted"));
    return {
      runId: `history-run-${runNumber}`,
      startTime: `2026-11-0${runNumber}T10:00:00.000Z`,
      endTime: `2026-11-0${runNumber}T10:00:01.000Z`,
      environment: "evidence-test",
      browsers: ["chromium"],
      projects: ["chromium"],
      suites: [],
      summary: document.summary,
      failedTestIds: [],
      dashboardPath: `../../history-run-${runNumber}/dashboard/index.html`,
      dashboardAvailable: runNumber !== 1 && runNumber !== 5,
      ...(tests === undefined ? {} : { tests }),
    };
  });
  fs.writeFileSync(
    path.join(dashboardDirectory, "index.html"),
    createDashboard(document),
  );

  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const hosted = await serve(runDirectory);
  t.after(() => new Promise((resolve) => hosted.server.close(resolve)));

  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport });
    const consoleErrors = [];
    const pageErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(`${hosted.origin}/dashboard/index.html`);

    const section = page.locator("#flakyIntelligenceSection");
    assert.equal(
      await section.getAttribute("open"),
      viewport.name === "desktop" ? "" : null,
    );
    if (viewport.name === "mobile") {
      await section.locator("> summary").click();
    }
    assert.match(
      await page.locator("#flakyIntelligenceState").innerText(),
      /latest 12 compatible runs[\s\S]*3 executed observations[\s\S]*2 instability events[\s\S]*25%/i,
    );
    assert.equal(
      await page.locator("#flakyIntelligenceRows .flaky-intelligence-row").count(),
      3,
    );
    const alternating = page.locator(
      '[data-flaky-test-id="alternating-test"]',
    );
    assert.match(
      await alternating.innerText(),
      /Historically intermittent[\s\S]*Failures 2\/4 \(50%\)[\s\S]*Retries 0\/4 \(0%\)/i,
    );
    assert.equal(
      await alternating.locator(".timeline-observation").count(),
      5,
    );
    assert.equal(await alternating.locator("a.timeline-observation").count(), 3);
    assert.match(
      await alternating.locator(".timeline-observation").first().getAttribute("aria-label"),
      /history-run-1[\s\S]*passed[\s\S]*report unavailable/i,
    );

    const retryDependent = page.locator(
      '[data-flaky-test-id="retry-dependent"]',
    );
    assert.match(
      await retryDependent.innerText(),
      /Retry dependent[\s\S]*Failures 0\/4 \(0%\)[\s\S]*Retries 2\/4 \(50%\)/i,
    );
    const repeated = page.locator(
      '[data-flaky-test-id="repeated-instability"]',
    );
    assert.match(await repeated.innerText(), /Repeated instability/i);

    await page.getByRole("button", { name: "All observed (6)" }).click();
    assert.equal(
      await page.locator("#flakyIntelligenceRows .flaky-intelligence-row").count(),
      6,
    );
    assert.match(
      await page.locator('[data-flaky-test-id="persistent-failure"]').innerText(),
      /Persistent failure[\s\S]*Failures 4\/4 \(100%\)/i,
    );
    const incomplete = page.locator(
      '[data-flaky-test-id="incomplete-test"]',
    );
    assert.match(
      await incomplete.innerText(),
      /Insufficient data[\s\S]*1\/3 required executed observations/i,
    );
    assert.deepEqual(
      await incomplete
        .locator(".timeline-observation")
        .evaluateAll((elements) =>
          elements.map((element) => element.dataset.observationStatus),
        ),
      ["passed", "skipped", "missing", "interrupted", "insufficient"],
    );

    const unstableFilter = page.getByRole("button", {
      name: "Unstable (3)",
    });
    await unstableFilter.focus();
    await page.keyboard.press("Enter");
    assert.equal(await unstableFilter.getAttribute("aria-pressed"), "true");
    assert.equal(
      await page.locator("#flakyIntelligenceRows .flaky-intelligence-row").count(),
      3,
    );
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(pageErrors, []);
    await page.close();
  }
});

test("renders deterministic performance intelligence, trends, retry overhead, and bottlenecks", async (t) => {
  const runDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "qa-dashboard-performance-intelligence-"),
  );
  t.after(() => fs.rmSync(runDirectory, { recursive: true, force: true }));
  const dashboardDirectory = path.join(runDirectory, "dashboard");
  fs.mkdirSync(dashboardDirectory, { recursive: true });

  const document = dashboardDocument([]);
  document.run.id = "performance-run-4";
  document.run.startTime = "2026-11-04T10:00:00.000Z";
  document.run.endTime = "2026-11-04T10:00:10.000Z";
  document.summary.durationMs = 10_000;
  const durations = {
    "fast-test": [900, 1000, 1100, 1050],
    "slow-test": [40_000, 42_000, 41_000, 43_000],
    regression: [1000, 1100, 900, 2600],
    improvement: [4000, 4200, 3800, 2000],
    retried: [1000, 1000, 1000, 1700],
    "junit-style": [800, 800, 800, 800],
  };
  document.history = Array.from({ length: 4 }, (_, index) => {
    const runNumber = index + 1;
    const tests = Object.entries(durations).map(([id, values]) =>
      comparisonSnapshot(id, id === "retried" && runNumber === 4 ? "flaky" : "passed", {
        module: id === "junit-style" ? "api" : "checkout",
        durationMs: values[index],
        ...(id === "retried" && runNumber === 4
          ? {
              retryAttempts: 1,
              attemptDurationsMs: [700, 1000],
            }
          : {}),
      }),
    );
    if (runNumber > 1) {
      tests.push(
        comparisonSnapshot("insufficient", "passed", {
          module: "catalog",
          durationMs: runNumber === 4 ? 2500 : 1000 + (runNumber - 2) * 100,
        }),
      );
    }
    return {
      runId: `performance-run-${runNumber}`,
      startTime: `2026-11-0${runNumber}T10:00:00.000Z`,
      endTime: `2026-11-0${runNumber}T10:00:10.000Z`,
      environment: "evidence-test",
      browsers: ["chromium"],
      projects: ["chromium"],
      suites: [],
      summary: {
        total: tests.length,
        passed: tests.length,
        failed: 0,
        skipped: 0,
        flaky: 0,
        passPercentage: 100,
        durationMs: 10_000,
      },
      failedTestIds: [],
      dashboardPath: `../../performance-run-${runNumber}/dashboard/index.html`,
      dashboardAvailable: runNumber !== 1,
      tests,
    };
  });
  const retriedTest = {
    ...document.tests[0],
    id: "retried",
    title: "retried",
    titlePath: ["retried"],
    suites: ["regression"],
    module: "checkout",
    file: "tests/retried.spec.ts",
    spec: {
      key: "tests/retried.spec.ts::chromium",
      name: "retried.spec.ts",
      path: "tests/retried.spec.ts",
    },
    status: "flaky",
    durationMs: 1700,
    retryAttempts: 1,
    retriesConfigured: 1,
    attempts: [
      {
        ...document.tests[0].attempts[0],
        attempt: 1,
        retry: 0,
        status: "failed",
        durationMs: 700,
      },
      {
        ...document.tests[0].attempts[0],
        attempt: 2,
        retry: 1,
        status: "passed",
        durationMs: 1000,
        errors: [],
      },
    ],
  };
  document.tests.push(retriedTest);
  fs.writeFileSync(
    path.join(dashboardDirectory, "index.html"),
    createDashboard(document),
  );

  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const hosted = await serve(runDirectory);
  t.after(() => new Promise((resolve) => hosted.server.close(resolve)));

  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport });
    const consoleErrors = [];
    const pageErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(`${hosted.origin}/dashboard/index.html`);

    const section = page.locator("#performanceIntelligenceSection");
    assert.equal(
      await section.getAttribute("open"),
      viewport.name === "desktop" ? "" : null,
    );
    if (viewport.name === "mobile") {
      await section.locator("> summary").click();
    }
    assert.match(
      await page.locator("#performanceIntelligenceState").innerText(),
      /median[^\n]*latest 12 compatible prior executions[\s\S]*3 historical samples[\s\S]*1s and 25%[\s\S]*slow threshold 30s/i,
    );
    assert.match(
      await page.locator("#performanceBottlenecks").innerText(),
      /Wall-clock run duration\s+10s[\s\S]*Summed measured test duration[\s\S]*parallel execution[\s\S]*not wall-clock pipeline time/i,
    );
    assert.equal(
      await page.locator("#performanceIntelligenceRows .performance-row").count(),
      7,
    );
    assert.match(
      await page.locator("#performanceIntelligenceRows .performance-row").first().innerText(),
      /slow test[\s\S]*43s[\s\S]*Stable/i,
    );

    await page.getByRole("button", { name: "Regressions (1)" }).click();
    const regression = page.locator('[data-performance-test-id="regression"]');
    assert.match(
      await regression.innerText(),
      /Regression[\s\S]*Current\s+2\.6s[\s\S]*Baseline\s+1s \(n=3\)[\s\S]*\+1\.6s \(\+160%\)/i,
    );
    assert.equal(
      await regression.locator(".duration-observation").count(),
      4,
    );
    assert.equal(
      await regression.locator("a.duration-observation").count(),
      2,
    );
    assert.match(
      await regression.locator(".duration-observation").first().getAttribute("aria-label"),
      /performance-run-1[\s\S]*1s[\s\S]*report unavailable/i,
    );

    await page.getByRole("button", { name: "Improvements (1)" }).click();
    assert.match(
      await page.locator('[data-performance-test-id="improvement"]').innerText(),
      /Improvement[\s\S]*Current\s+2s[\s\S]*Baseline\s+4s \(n=3\)[\s\S]*−2s \(−50%\)/i,
    );

    const retryFilter = page.getByRole("button", {
      name: "Retry overhead (1)",
    });
    await retryFilter.focus();
    await page.keyboard.press("Enter");
    assert.equal(await retryFilter.getAttribute("aria-pressed"), "true");
    const retried = page.locator('[data-performance-test-id="retried"]');
    assert.match(
      await retried.innerText(),
      /Initial\s+700ms[\s\S]*Subsequent\s+1s[\s\S]*Retry overhead\s+1s[\s\S]*Total\s+1\.7s/i,
    );
    await retried.locator("button.duration-observation").click();
    await page.locator("#testDetails").waitFor({ state: "visible" });
    assert.equal(await page.locator("#detailTitle").innerText(), "retried");
    await page.locator("#closeDetails").click();

    await page.getByRole("button", { name: "All tests (7)" }).click();
    const junit = page.locator('[data-performance-test-id="junit-style"]');
    assert.match(await junit.innerText(), /Retry overhead[\s\S]*Unavailable/i);
    await page.locator("#performanceIntelligenceSort").selectOption("title-asc");
    assert.equal(
      await page.locator("#performanceIntelligenceRows .performance-row").first().getAttribute("data-performance-test-id"),
      "fast-test",
    );
    await page.getByRole("button", { name: "Insufficient (1)" }).click();
    assert.match(
      await page.locator('[data-performance-test-id="insufficient"]').innerText(),
      /Insufficient history[\s\S]*2\/3 required historical duration observations/i,
    );

    if (viewport.name === "mobile") {
      const columns = await page
        .locator(".performance-row")
        .first()
        .evaluate((element) => getComputedStyle(element).gridTemplateColumns);
      assert.equal(columns.split(" ").length, 1);
    }
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(pageErrors, []);
    await page.close();
  }
});

test("resetting filters returns a historical dashboard to the latest run", async (t) => {
  const reportsRoot = fs.mkdtempSync(path.join(os.tmpdir(), "qa-dashboard-reset-"));
  t.after(() => fs.rmSync(reportsRoot, { recursive: true, force: true }));

  const oldReport = dashboardDocument([]);
  oldReport.run = {
    ...oldReport.run,
    id: "old-run",
    startTime: "2026-10-28T10:00:00.000Z",
    endTime: "2026-10-28T10:00:00.010Z",
  };
  const latestReport = dashboardDocument([]);
  latestReport.run = {
    ...latestReport.run,
    id: "latest-run",
    startTime: "2026-10-29T10:00:00.000Z",
    endTime: "2026-10-29T10:00:00.010Z",
  };
  const history = [oldReport, latestReport].map((report) => ({
    runId: report.run.id,
    startTime: report.run.startTime,
    endTime: report.run.endTime,
    environment: report.metadata.environment,
    browsers: report.metadata.browsers,
    projects: report.metadata.projects,
    suites: report.suites,
    summary: report.summary,
    failedTestIds: [],
    dashboardPath: `../../${report.run.id}/dashboard/index.html`,
    dashboardAvailable: true,
  }));

  for (const report of [oldReport, latestReport]) {
    const dashboardDirectory = path.join(
      reportsRoot,
      report.run.id,
      "dashboard",
    );
    fs.mkdirSync(dashboardDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(dashboardDirectory, "index.html"),
      createDashboard({ ...report, history }),
    );
  }

  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const hosted = await serve(reportsRoot);
  t.after(() => new Promise((resolve) => hosted.server.close(resolve)));
  const page = await browser.newPage();

  await page.goto(`${hosted.origin}/old-run/dashboard/index.html`);
  await page.locator("#search").fill("failure");
  await page.locator("#clearFilters").click();

  assert.equal(
    page.url(),
    `${hosted.origin}/latest-run/dashboard/index.html`,
  );
  assert.equal(await page.locator("#search").inputValue(), "");
});
