const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { load } = require("./load-ts.cjs");

const { MAX_EVIDENCE_PREVIEW_BYTES, prepareEvidenceForDashboard } = load(
  "output/evidence.ts",
);

function createReport(artifacts) {
  return {
    schemaVersion: 2,
    run: {
      id: "run-1",
      status: "failed",
      startTime: "2026-10-28T10:00:00.000Z",
      endTime: "2026-10-28T10:00:01.000Z",
      timezone: "Asia/Kolkata",
    },
    metadata: {
      environment: "test",
      baseURL: "",
      browsers: [],
      projects: ["junit"],
      operatingSystem: "test-os",
      nodeVersion: "v22",
      ci: false,
    },
    summary: {
      total: 1,
      passed: 0,
      failed: 1,
      skipped: 0,
      flaky: 0,
      passPercentage: 0,
      durationMs: 1,
    },
    suites: [],
    modules: [],
    specs: [],
    tests: [
      {
        id: "test-1",
        title: "evidence test",
        titlePath: ["evidence test"],
        suites: [],
        module: "evidence",
        spec: { key: "evidence::junit", name: "evidence", path: "evidence" },
        file: "evidence",
        line: 1,
        column: 1,
        status: "failed",
        project: "junit",
        browser: "",
        repeatEachIndex: 0,
        durationMs: 1,
        retriesConfigured: 0,
        retryAttempts: 0,
        tags: [],
        attempts: [
          {
            attempt: 1,
            retry: 0,
            status: "failed",
            durationMs: 1,
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
  };
}

function artifact(name, pathValue, contentType, overrides = {}) {
  return {
    kind: "file",
    name,
    filename: path.posix.basename(pathValue),
    contentType,
    path: pathValue,
    available: true,
    ...overrides,
  };
}

test("prepares safe JSON and text previews while leaving binary evidence downloadable", async (t) => {
  const runDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "qa-evidence-"));
  t.after(() => fs.rmSync(runDirectory, { recursive: true, force: true }));
  const attachments = path.join(runDirectory, "attachments");
  fs.mkdirSync(attachments, { recursive: true });
  fs.writeFileSync(
    path.join(attachments, "response.json"),
    '{"name":"Ada","roles":["engineer"]}',
  );
  fs.writeFileSync(path.join(attachments, "server.log"), "request complete\n");
  fs.writeFileSync(path.join(attachments, "archive.bin"), Buffer.from([0, 1, 2]));

  const source = createReport([
    artifact("Response", "../attachments/response.json", "application/json"),
    artifact("Server log", "../attachments/server.log", "text/plain"),
    artifact("Archive", "../attachments/archive.bin", "application/octet-stream"),
  ]);
  const prepared = await prepareEvidenceForDashboard(source, runDirectory);
  const [json, log, binary] = prepared.tests[0].attempts[0].artifacts;

  assert.notEqual(prepared, source);
  assert.equal(source.tests[0].attempts[0].artifacts[0].preview, undefined);
  assert.equal(json.available, true);
  assert.equal(json.bytes, 35);
  assert.deepEqual(json.preview, {
    kind: "json",
    content: '{\n  "name": "Ada",\n  "roles": [\n    "engineer"\n  ]\n}',
    truncated: false,
  });
  assert.deepEqual(log.preview, {
    kind: "text",
    content: "request complete\n",
    truncated: false,
  });
  assert.equal(binary.available, true);
  assert.equal(binary.bytes, 3);
  assert.equal(binary.preview, undefined);
});

test("marks missing, unsafe, encoded traversal, and escaping symlink evidence unavailable", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "qa-evidence-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const runDirectory = path.join(root, "run");
  const attachments = path.join(runDirectory, "attachments");
  fs.mkdirSync(attachments, { recursive: true });
  const outside = path.join(root, "outside.txt");
  fs.writeFileSync(outside, "outside");
  fs.symlinkSync(outside, path.join(attachments, "escape.txt"));

  const report = createReport([
    artifact("Absent", "../attachments/absent.txt", "text/plain"),
    artifact("Declared missing", "../attachments/declared.txt", "text/plain", {
      available: false,
      unavailableReason: "Attachment was declared missing by the source adapter.",
    }),
    artifact("Traversal", "../../outside.txt", "text/plain"),
    artifact("Encoded traversal", "../attachments/%2e%2e/outside.txt", "text/plain"),
    artifact("Symlink escape", "../attachments/escape.txt", "text/plain"),
  ]);
  const prepared = await prepareEvidenceForDashboard(report, runDirectory);
  const artifacts = prepared.tests[0].attempts[0].artifacts;

  for (const item of artifacts) {
    assert.equal(item.available, false, item.name);
    assert.equal(item.path, "", item.name);
    assert.ok(item.unavailableReason, item.name);
    assert.equal(item.preview, undefined, item.name);
  }
  assert.match(artifacts[0].unavailableReason, /not found|could not be read/i);
  assert.match(artifacts[1].unavailableReason, /declared missing/i);
  assert.match(artifacts[2].unavailableReason, /unsafe/i);
  assert.match(artifacts[3].unavailableReason, /unsafe/i);
  assert.match(artifacts[4].unavailableReason, /outside/i);
});

test("bounds large text previews without reading the complete file into the dashboard", async (t) => {
  const runDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "qa-evidence-"));
  t.after(() => fs.rmSync(runDirectory, { recursive: true, force: true }));
  const attachments = path.join(runDirectory, "attachments");
  fs.mkdirSync(attachments, { recursive: true });
  fs.writeFileSync(
    path.join(attachments, "large.log"),
    "x".repeat(MAX_EVIDENCE_PREVIEW_BYTES + 100),
  );

  const prepared = await prepareEvidenceForDashboard(
    createReport([
      artifact("Large log", "../attachments/large.log", "text/plain"),
    ]),
    runDirectory,
  );
  const item = prepared.tests[0].attempts[0].artifacts[0];

  assert.equal(item.available, true);
  assert.equal(item.bytes, MAX_EVIDENCE_PREVIEW_BYTES + 100);
  assert.equal(item.preview.kind, "text");
  assert.equal(item.preview.content.length, MAX_EVIDENCE_PREVIEW_BYTES);
  assert.equal(item.preview.truncated, true);
});
