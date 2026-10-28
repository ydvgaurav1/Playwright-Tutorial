const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  PYTEST_XML,
  createEvidence,
  createWorkspace,
  writeManifest,
  writeXml,
} = require("./fixtures.cjs");
const { loadRepo } = require("../../../universal/test/load-ts.cjs");

const { parseJunitXml } = loadRepo("reporting/adapters/junit/parse.ts");
const { convertJunitFiles } = loadRepo(
  "reporting/adapters/junit/convert.ts",
);
const {
  attachManifestEvidence,
  JunitManifestError,
  loadJunitManifest,
} = loadRepo("reporting/adapters/junit/manifest.ts");
const { isSafeRelativePath } = loadRepo(
  "reporting/universal/schema/paths.ts",
);

const TIMEZONE = "Asia/Kolkata";

function setup(t, xml = PYTEST_XML) {
  const workspace = createWorkspace();
  t.after(() => fs.rmSync(workspace.root, { recursive: true, force: true }));
  const source = writeXml(workspace, "results.xml", xml);
  const conversion = convertJunitFiles(
    [parseJunitXml(xml, source)],
    { timezone: TIMEZONE, runId: "manifest-run" },
  );
  const runDirectory = path.join(workspace.root, "run");
  fs.mkdirSync(runDirectory, { recursive: true });
  return { workspace, conversion, runDirectory };
}

test("copies manifest evidence by testId, nativeId, and classname + testName", async (t) => {
  const { workspace, conversion, runDirectory } = setup(t);
  const evidence = createEvidence(workspace);
  const [passed, failed] = conversion.document.tests;

  const manifestFile = writeManifest(workspace, {
    version: 1,
    attachments: [
      {
        testId: passed.id,
        kind: "screenshot",
        path: path.relative(workspace.root, evidence.screenshot),
        name: "login failure",
      },
      {
        nativeId: passed.nativeId,
        kind: "trace",
        path: path.relative(workspace.root, evidence.trace),
        format: "zip",
      },
      {
        classname: "tests.test_login",
        testName: "test_invalid_password",
        suite: "tests.test_login",
        kind: "log",
        path: path.relative(workspace.root, evidence.log),
      },
    ],
  });
  const manifest = await loadJunitManifest(manifestFile);
  const result = await attachManifestEvidence(
    conversion.document,
    manifest,
    runDirectory,
  );

  assert.equal(result.copied, 3);
  assert.equal(result.document.capabilities.attachments, true);
  assert.equal(result.document.capabilities.logs, true);
  assert.deepEqual(result.document.capabilities.traceFormats, ["zip"]);
  assert.equal(result.document.tests.length, conversion.document.tests.length);
  assert.equal(conversion.document.capabilities.attachments, false);
  assert.equal(conversion.document.tests[0].attempts[0].evidence.length, 0);

  const attachedPassed = result.document.tests.find(
    (item) => item.id === passed.id,
  );
  const attachedFailed = result.document.tests.find(
    (item) => item.id === failed.id,
  );
  assert.equal(attachedPassed.attempts[0].evidence.length, 2);
  assert.equal(attachedFailed.attempts[0].evidence.length, 1);

  const screenshot = attachedPassed.attempts[0].evidence[0];
  assert.equal(screenshot.kind, "screenshot");
  assert.equal(screenshot.name, "login failure");
  assert.equal(screenshot.mimeType, "image/png");
  assert.equal(screenshot.bytes, 4);
  assert.equal(
    screenshot.sha256,
    crypto
      .createHash("sha256")
      .update(fs.readFileSync(evidence.screenshot))
      .digest("hex"),
  );
  assert.equal(isSafeRelativePath(screenshot.path), true);
  assert.equal(fs.existsSync(path.join(runDirectory, screenshot.path)), true);

  const trace = attachedPassed.attempts[0].evidence[1];
  assert.equal(trace.kind, "trace");
  assert.equal(trace.format, "zip");
  assert.equal(trace.mimeType, "application/zip");

  const logEvidence = attachedFailed.attempts[0].evidence[0];
  assert.equal(logEvidence.kind, "log");
  assert.equal(logEvidence.mimeType, "text/plain");
  assert.equal(attachedFailed.attempts[0].logs.length, 2);
  const log = attachedFailed.attempts[0].logs[1];
  assert.equal(log.stream, "stdout");
  assert.match(log.text, /line one/);
  assert.equal(log.timestamp, attachedFailed.attempts[0].startedAt);

  assert.deepEqual(result.externalReport, {
    label: "JUnit attachment manifest",
    path: "junit-manifest.json",
    kind: "json",
  });
  assert.equal(
    fs.existsSync(path.join(runDirectory, "junit-manifest.json")),
    true,
  );
  assert.ok(
    result.document.externalReports.some(
      (report) => report.path === "junit-manifest.json",
    ),
  );
});

test("deduplicates identical destination filenames for the same test", async (t) => {
  const { workspace, conversion, runDirectory } = setup(t);
  const evidence = createEvidence(workspace);
  const target = conversion.document.tests[0];

  const manifestFile = writeManifest(workspace, {
    attachments: [
      {
        testId: target.id,
        kind: "screenshot",
        path: path.relative(workspace.root, evidence.screenshot),
      },
      {
        testId: target.id,
        kind: "screenshot",
        path: path.relative(workspace.root, evidence.screenshot),
      },
    ],
  });
  const result = await attachManifestEvidence(
    conversion.document,
    await loadJunitManifest(manifestFile),
    runDirectory,
  );

  const [first, second] = result.document.tests[0].attempts[0].evidence;
  assert.equal(first.path, `attachments/${target.id}/failure.png`);
  assert.equal(second.path, `attachments/${target.id}/failure-2.png`);
  assert.equal(fs.existsSync(path.join(runDirectory, first.path)), true);
  assert.equal(fs.existsSync(path.join(runDirectory, second.path)), true);
});

test("rejects unknown and ambiguous selectors instead of guessing", async (t) => {
  const { workspace, conversion, runDirectory } = setup(t);
  const evidence = createEvidence(workspace);

  const unknown = await loadJunitManifest(
    writeManifest(workspace, {
      attachments: [
        {
          testId: "junit-missing",
          kind: "screenshot",
          path: path.relative(workspace.root, evidence.screenshot),
        },
      ],
    }),
  );
  await assert.rejects(
    () => attachManifestEvidence(conversion.document, unknown, runDirectory),
    (error) =>
      error instanceof JunitManifestError &&
      /does not match any test/.test(error.message),
  );

  const ambiguousXml = `<testsuites>
    <testsuite name="first" time="0.1">
      <testcase classname="pkg.DuplicateTest" name="sameName" time="0.1"/>
    </testsuite>
    <testsuite name="second" time="0.1">
      <testcase classname="pkg.DuplicateTest" name="sameName" time="0.1"/>
    </testsuite>
  </testsuites>`;
  const ambiguousSource = writeXml(workspace, "duplicate.xml", ambiguousXml);
  const ambiguousDocument = convertJunitFiles(
    [parseJunitXml(ambiguousXml, ambiguousSource)],
    { timezone: TIMEZONE, runId: "duplicate-run" },
  ).document;

  const ambiguous = await loadJunitManifest(
    writeManifest(workspace, {
      attachments: [
        {
          classname: "pkg.DuplicateTest",
          testName: "sameName",
          kind: "screenshot",
          path: path.relative(workspace.root, evidence.screenshot),
        },
      ],
    }),
  );
  await assert.rejects(
    () =>
      attachManifestEvidence(ambiguousDocument, ambiguous, runDirectory),
    (error) =>
      error instanceof JunitManifestError &&
      /ambiguous/.test(error.message) &&
      /Add testId, nativeId, or a suite/.test(error.message),
  );

  const scoped = await loadJunitManifest(
    writeManifest(workspace, {
      attachments: [
        {
          classname: "pkg.DuplicateTest",
          testName: "sameName",
          suite: "second",
          kind: "screenshot",
          path: path.relative(workspace.root, evidence.screenshot),
        },
      ],
    }),
  );
  const scopedResult = await attachManifestEvidence(
    ambiguousDocument,
    scoped,
    runDirectory,
  );
  assert.equal(scopedResult.copied, 1);
  assert.equal(
    scopedResult.document.tests.find(
      (item) => item.attempts[0].evidence.length === 1,
    ).suites.includes("second"),
    true,
  );
});

test("fails clearly when an attachment file is missing or not a file", async (t) => {
  const { workspace, conversion, runDirectory } = setup(t);

  const missing = await loadJunitManifest(
    writeManifest(workspace, {
      attachments: [
        {
          testId: conversion.document.tests[0].id,
          kind: "screenshot",
          path: "evidence/does-not-exist.png",
        },
      ],
    }),
  );
  await assert.rejects(
    () => attachManifestEvidence(conversion.document, missing, runDirectory),
    (error) =>
      error instanceof JunitManifestError &&
      /was not found/.test(error.message),
  );

  const directoryPath = path.join(workspace.root, "evidence-directory");
  fs.mkdirSync(directoryPath);
  const notAFile = await loadJunitManifest(
    writeManifest(workspace, {
      attachments: [
        {
          testId: conversion.document.tests[0].id,
          kind: "file",
          path: path.relative(workspace.root, directoryPath),
        },
      ],
    }),
  );
  await assert.rejects(
    () => attachManifestEvidence(conversion.document, notAFile, runDirectory),
    (error) =>
      error instanceof JunitManifestError && /is not a file/.test(error.message),
  );
});

test("rejects absolute, traversal, and symlink-escaping attachment paths", async (t) => {
  const { workspace, conversion, runDirectory } = setup(t);
  const evidence = createEvidence(workspace);
  const target = conversion.document.tests[0];

  const absolute = await loadJunitManifest(
    writeManifest(workspace, {
      attachments: [
        { testId: target.id, kind: "screenshot", path: evidence.screenshot },
      ],
    }),
  );
  await assert.rejects(
    () => attachManifestEvidence(conversion.document, absolute, runDirectory),
    (error) =>
      error instanceof JunitManifestError &&
      /must be relative to the manifest directory/.test(error.message),
  );

  // Put the manifest in a subdirectory so ../evidence escapes it.
  const nestedManifest = path.join(workspace.root, "manifests", "attachments.json");
  fs.mkdirSync(path.dirname(nestedManifest), { recursive: true });
  fs.writeFileSync(
    nestedManifest,
    JSON.stringify({
      attachments: [
        {
          testId: target.id,
          kind: "screenshot",
          path: "../evidence/failure.png",
        },
      ],
    }),
  );
  const nested = await loadJunitManifest(nestedManifest);
  await assert.rejects(
    () => attachManifestEvidence(conversion.document, nested, runDirectory),
    (error) =>
      error instanceof JunitManifestError &&
      /escapes the manifest directory/.test(error.message),
  );

  // A symlink that points outside the manifest directory is also rejected.
  const symlink = path.join(workspace.root, "manifests", "linked.png");
  fs.symlinkSync(evidence.screenshot, symlink);
  fs.writeFileSync(
    path.join(workspace.root, "manifests", "symlink.json"),
    JSON.stringify({
      attachments: [
        { testId: target.id, kind: "screenshot", path: "linked.png" },
      ],
    }),
  );
  const linkedManifest = path.join(workspace.root, "manifests", "symlink.json");
  const linked = await loadJunitManifest(linkedManifest);
  await assert.rejects(
    () => attachManifestEvidence(conversion.document, linked, runDirectory),
    (error) =>
      error instanceof JunitManifestError &&
      /resolves outside the manifest directory/.test(error.message),
  );
});

test("validates manifest JSON before copying anything", async (t) => {
  const workspace = createWorkspace();
  t.after(() => fs.rmSync(workspace.root, { recursive: true, force: true }));

  await assert.rejects(
    () => loadJunitManifest(path.join(workspace.root, "missing.json")),
    (error) =>
      error instanceof JunitManifestError && /Could not read/.test(error.message),
  );

  const invalidJson = writeManifest(workspace, {});
  fs.writeFileSync(invalidJson, "{not json", "utf8");
  await assert.rejects(
    () => loadJunitManifest(invalidJson),
    (error) =>
      error instanceof JunitManifestError && /not valid JSON/.test(error.message),
  );

  await assert.rejects(
    () => loadJunitManifest(writeManifest(workspace, { version: 2, attachments: [] })),
    /Unsupported attachment manifest version/,
  );
  await assert.rejects(
    () => loadJunitManifest(writeManifest(workspace, { version: 1 })),
    /must contain an "attachments" array/,
  );
  await assert.rejects(
    () =>
      loadJunitManifest(
        writeManifest(workspace, {
          attachments: [{ kind: "hologram", path: "x.png", testId: "a" }],
        }),
      ),
    /unsupported kind/,
  );
  await assert.rejects(
    () =>
      loadJunitManifest(
        writeManifest(workspace, {
          attachments: [{ kind: "screenshot", path: "x.png" }],
        }),
      ),
    /must select a test/,
  );
  await assert.rejects(
    () =>
      loadJunitManifest(
        writeManifest(workspace, {
          attachments: [
            {
              kind: "screenshot",
              path: "x.png",
              classname: "pkg.Test",
            },
          ],
        }),
      ),
    /classname and testName together/,
  );
});
