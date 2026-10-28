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
            errors: [],
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
  const dashboardPath = path.join(dashboardDirectory, "index.html");
  fs.writeFileSync(
    dashboardPath,
    createDashboard(dashboardDocument(artifacts), { traceViewerHref: null }),
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
  await page.locator("#testRows tr").click();

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
