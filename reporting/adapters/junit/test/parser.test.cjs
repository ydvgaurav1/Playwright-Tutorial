const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  EMPTY_RUN_XML,
  INVALID_XML,
  MISSING_METADATA_XML,
  NESTED_XML,
  PYTEST_XML,
  REST_ASSURED_XML,
  SPECIAL_CHARACTERS_XML,
  SUREFIRE_XML,
} = require("./fixtures.cjs");
const { loadRepo } = require("../../../universal/test/load-ts.cjs");

const { parseJunitXml } = loadRepo("reporting/adapters/junit/parse.ts");
const { convertJunitFiles } = loadRepo(
  "reporting/adapters/junit/convert.ts",
);
const { validateRunDocument } = loadRepo(
  "reporting/universal/schema/validate.ts",
);

const TIMEZONE = "Asia/Kolkata";

function convert(xml, options = {}) {
  return convertJunitFiles([parseJunitXml(xml, options.sourcePath ?? "input.xml")], {
    timezone: TIMEZONE,
    runId: options.runId,
    ...options,
  });
}

test("parses pytest JUnit XML into canonical tests without inventing retries or browsers", () => {
  const result = convert(PYTEST_XML, { runId: "pytest-run" });
  const document = result.document;

  assert.equal(result.framework, "pytest");
  assert.equal(result.frameworkDetected, true);
  assert.equal(document.producer.framework, "pytest");
  assert.equal(document.producer.frameworkVersion, "8.3.3");
  assert.equal(document.run.id, "pytest-run");
  assert.equal(document.run.startedAt, "2026-10-27T06:53:47.569Z");
  assert.equal(document.run.durationMs, 1250);
  assert.equal(document.run.status, "failed");
  assert.equal(document.environment.name, "staging");
  assert.equal(document.environment.browsers, undefined);

  assert.deepEqual(
    document.tests.map((item) => item.status),
    ["passed", "failed", "skipped"],
  );
  assert.deepEqual(
    document.tests.map((item) => item.title),
    ["test_valid_login", "test_invalid_password", "test_locked_user"],
  );

  for (const item of document.tests) {
    assert.equal(item.attempts.length, 1, "one testcase must be one attempt");
    assert.equal(item.attempts[0].retry, 0);
    assert.deepEqual(item.retries, { configured: 0, used: 0 });
    assert.equal(item.variant.browser, undefined);
    assert.equal(item.id.startsWith("junit-"), true);
  }

  const [passed, failed, skipped] = document.tests;
  assert.equal(passed.module, "login");
  assert.ok(passed.suites.includes("sanity"));
  assert.ok(passed.suites.includes("test-login"));
  assert.ok(passed.labels.includes("module:login"));
  assert.equal(passed.attempts[0].logs.length, 1);
  assert.equal(passed.attempts[0].logs[0].stream, "stdout");
  assert.match(passed.attempts[0].logs[0].text, /logged in as standard_user/);

  assert.equal(failed.attempts[0].errors.length, 1);
  assert.equal(failed.attempts[0].errors[0].message, "assert 200 == 401");
  assert.equal(failed.attempts[0].errors[0].type, "AssertionError");
  assert.match(failed.attempts[0].errors[0].stack, /test_login\.py:31/);
  assert.equal(failed.attempts[0].logs[0].stream, "stderr");

  assert.equal(skipped.status, "skipped");
  assert.equal(skipped.attempts[0].status, "skipped");

  assert.deepEqual(document.capabilities, {
    steps: false,
    retries: false,
    logs: true,
    attachments: false,
    traceFormats: [],
    timings: "test",
  });
  assert.equal(document.extensions.junit.durationSource, "root.time");
  assert.equal(document.extensions.junit.timestampSource, "testsuite.timestamp");

  assert.equal(validateRunDocument(document).ok, true);
});

test("uses one identity per testcase and keeps IDs stable across conversions", () => {
  const first = convert(PYTEST_XML, { runId: "one" }).document;
  const second = convert(PYTEST_XML, { runId: "two" }).document;

  assert.deepEqual(
    first.tests.map((item) => item.id),
    second.tests.map((item) => item.id),
  );
  assert.equal(new Set(first.tests.map((item) => item.id)).size, 3);
});

test("maps Surefire failures, suite logs, and JVM environment metadata", () => {
  const result = convert(SUREFIRE_XML, { runId: "surefire-run" });
  const document = result.document;

  assert.equal(result.framework, "maven-surefire");
  assert.equal(document.run.durationMs, 2500);
  assert.equal(document.environment.os, "Linux");
  assert.equal(document.environment.runtime, "21.0.1");
  assert.deepEqual(
    document.tests.map((item) => item.status),
    ["passed", "failed"],
  );

  const [passed, failed] = document.tests;
  assert.match(passed.attempts[0].logs[0].text, /suite output shared/);
  assert.match(passed.attempts[0].logs[1].text, /suite warning/);
  assert.equal(failed.attempts[0].logs.length, 0);
  assert.match(failed.attempts[0].errors[0].stack, /LoginTest\.java:42/);

  const logWarnings = result.warnings.filter((warning) =>
    warning.includes("suite-level log"),
  );
  assert.equal(logWarnings.length, 1);
  assert.match(logWarnings[0], /1 suite-level log/);
});

test("maps REST Assured errors and XML metadata", () => {
  const result = convert(REST_ASSURED_XML, { runId: "api-run" });
  const document = result.document;

  assert.equal(result.framework, "rest-assured");
  assert.equal(document.environment.baseUrl, "https://api.example.test");
  assert.equal(document.environment.branch, "main");
  assert.equal(document.tests[0].module, "api");
  assert.equal(document.tests[0].status, "passed");
  assert.equal(document.tests[1].status, "failed");
  assert.equal(
    document.tests[1].attempts[0].errors[0].message,
    "500 Internal Server Error",
  );
  assert.equal(document.run.status, "failed");
});

test("keeps nested suite paths and class grouping", () => {
  const document = convert(NESTED_XML, { runId: "nested-run" }).document;

  assert.equal(document.tests.length, 2);
  const nested = document.tests.find((item) => item.title === "nestedPass");
  const outer = document.tests.find((item) => item.title === "outerPass");

  assert.deepEqual(nested.extensions.junit.suitePath, ["outer", "inner"]);
  assert.deepEqual(nested.titlePath, ["outer", "inner", "pkg.OuterTest", "nestedPass"]);
  assert.deepEqual(outer.extensions.junit.suitePath, ["outer"]);
  assert.equal(nested.module, "outer");
  assert.equal(nested.variant.name, "outer-test");
  assert.equal(outer.variant.name, "outer-test");
  assert.equal(document.extensions.junit.suiteCount, 2);
});

test("handles missing timestamps, durations, and identity without fabricating values", () => {
  const result = convert(MISSING_METADATA_XML, {
    runId: "missing-run",
    startedAt: "2026-10-27T08:00:00.000Z",
  });
  const document = result.document;

  assert.equal(document.run.startedAt, "2026-10-27T08:00:00.000Z");
  assert.equal(document.run.durationMs, 0);
  assert.equal(document.tests.length, 2);
  assert.notEqual(document.tests[0].id, document.tests[1].id);
  assert.equal(document.tests[0].module, "unclassified");
  assert.equal(document.tests[0].variant.name, "junit");
  assert.equal(document.tests[0].attempts[0].durationMs, 0);
  assert.equal(
    document.tests[0].attempts[0].extensions.junit.timestampSource,
    "run.startedAt",
  );

  assert.ok(
    result.warnings.some((warning) => /2 testcase\(s\) have no time/.test(warning)),
  );
  assert.ok(
    result.warnings.some((warning) =>
      /2 testcase\(s\) have no timestamp/.test(warning),
    ),
  );
  assert.ok(
    result.warnings.some((warning) =>
      /2 testcase\(s\) have neither classname nor file/.test(warning),
    ),
  );
  assert.ok(
    result.warnings.some((warning) => /could not be detected/.test(warning)),
  );
});

test("produces a valid empty run when the XML has no testcases", () => {
  const result = convert(EMPTY_RUN_XML, { runId: "empty-run" });
  const document = result.document;

  assert.equal(document.tests.length, 0);
  assert.equal(document.run.status, "unknown");
  assert.equal(document.run.durationMs, 0);
  assert.equal(document.capabilities.logs, false);
  assert.ok(
    result.warnings.some((warning) => /no testcase elements/.test(warning)),
  );
  assert.equal(validateRunDocument(document).ok, true);

  const containerOnly = convert("<testsuites/>", { runId: "empty-container" });
  assert.equal(containerOnly.document.tests.length, 0);
  assert.equal(containerOnly.document.run.status, "unknown");
  assert.equal(validateRunDocument(containerOnly.document).ok, true);
});

test("decodes entities, CDATA, and special characters in names and errors", () => {
  const document = convert(SPECIAL_CHARACTERS_XML, {
    runId: "encoding-run",
  }).document;
  const item = document.tests[0];

  assert.equal(item.title, "handles & entities");
  assert.equal(
    item.attempts[0].errors[0].message,
    'expected "A" < B',
  );
  assert.match(item.attempts[0].errors[0].stack, /actual & expected/);
  assert.equal(
    item.attempts[0].logs[0].text,
    "raw <output> & text",
  );
});

test("does not resolve external or custom XML entities", () => {
  const xxe = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE testsuite [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
  <!ENTITY custom "expanded">
]>
<testsuite name="security" time="0.1" timestamp="2026-10-27T09:00:00Z">
  <testcase classname="pkg.SecurityTest" name="doesNotResolveEntities" time="0.1">
    <failure message="&xxe;" type="Error">&xxe;</failure>
    <system-out>literal &custom; and numeric &#x41;</system-out>
  </testcase>
</testsuite>`;

  const document = convert(xxe, { runId: "entity-run" }).document;
  const item = document.tests[0];

  assert.equal(item.attempts[0].errors[0].message, "&xxe;");
  assert.equal(item.attempts[0].errors[0].stack, undefined);
  assert.doesNotMatch(item.attempts[0].errors[0].message, /root:/);
  assert.match(item.attempts[0].logs[0].text, /literal &custom;/);
  assert.match(item.attempts[0].logs[0].text, /numeric A/);
});

test("rejects malformed XML instead of producing a partial report", () => {
  assert.throws(
    () => parseJunitXml(INVALID_XML, "broken.xml"),
    /Unexpected closing tag|Unclosed tag/,
  );
  assert.throws(() => parseJunitXml("", "empty.xml"), /No root element/);
  assert.throws(
    () => parseJunitXml("<a/><b/>", "two-roots.xml"),
    /Multiple root elements/,
  );
});

test("the JUnit adapter does not import Playwright", () => {
  const directory = path.resolve(__dirname, "..");
  const sources = fs
    .readdirSync(directory)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => fs.readFileSync(path.join(directory, name), "utf8"));

  assert.ok(sources.length > 0);
  for (const source of sources) {
    assert.doesNotMatch(
      source,
      /(?:from\s+|require\()\s*["'][^"']*playwright/i,
      "JUnit conversion must stay independent of Playwright",
    );
  }
});
