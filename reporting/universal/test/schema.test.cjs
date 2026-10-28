const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { load, universalRoot } = require("./load-ts.cjs");
const { validRun } = require("./fixtures.cjs");

const core = load("index.ts");

function issuesFor(document) {
  const result = core.validateRunDocument(document);
  return result.ok ? [] : result.issues.map((issue) => issue.path);
}

test("accepts a valid canonical document and round-trips it", () => {
  const document = validRun();
  const result = core.validateRunDocument(document);
  assert.equal(result.ok, true);

  const json = core.stringifyRunDocument(document);
  const parsed = core.parseRunDocument(json);
  assert.deepEqual(parsed, document);
});

test("rejects a schema version other than 1.0.0", () => {
  const document = validRun();
  document.schemaVersion = "2.0.0";
  assert.ok(issuesFor(document).includes("$.schemaVersion"));
});

test("rejects duplicate test identities", () => {
  const document = validRun();
  document.tests[1].id = document.tests[0].id;
  assert.ok(
    issuesFor(document).includes("$.tests[1].id"),
    "duplicate test id must be reported at the second occurrence",
  );
});

test("rejects unsupported test statuses", () => {
  const document = validRun();
  document.tests[0].status = "maybe";
  assert.ok(issuesFor(document).includes("$.tests[0].status"));
});

test("rejects evidence paths that escape the run directory", () => {
  const document = validRun();
  document.tests[1].attempts[0].evidence[0].path = "../screenshots/failure.png";
  assert.ok(issuesFor(document).includes("$.tests[1].attempts[0].evidence[0].path"));

  document.tests[1].attempts[0].evidence[0].path = "/tmp/failure.png";
  assert.ok(issuesFor(document).includes("$.tests[1].attempts[0].evidence[0].path"));

  document.tests[1].attempts[0].evidence[0].path = "C:\\tmp\\failure.png";
  assert.ok(issuesFor(document).includes("$.tests[1].attempts[0].evidence[0].path"));
});

test("rejects invalid timestamps, negative durations, and missing attempts", () => {
  const document = validRun();
  document.run.startedAt = "not-a-date";
  document.tests[0].durationMs = -1;
  document.tests[0].attempts = [];
  const paths = issuesFor(document);

  assert.ok(paths.includes("$.run.startedAt"));
  assert.ok(paths.includes("$.tests[0].durationMs"));
  assert.ok(paths.includes("$.tests[0].attempts"));
});

test("rejects a run that ends before it starts", () => {
  const document = validRun();
  document.run.endedAt = "2026-10-27T06:00:00.000Z";
  assert.ok(issuesFor(document).includes("$.run.endedAt"));
});

test("allows unknown fields for forward-compatible extensions", () => {
  const document = validRun();
  document.futureField = { enabled: true };
  document.tests[0].extensions = { custom: "value" };
  document.tests[0].attempts[0].extensions = { requestId: "abc" };

  const result = core.validateRunDocument(document);
  assert.equal(result.ok, true);
});

test("publishes a parseable JSON Schema that matches the canonical version", () => {
  const schemaPath = path.join(
    universalRoot,
    "schema",
    "qa-report.schema.json",
  );
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));

  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.properties.schemaVersion.const, "1.0.0");
  assert.ok(schema.$defs.test);
  assert.ok(schema.$defs.attempt);
  assert.ok(schema.$defs.evidence);
});

test("does not persist derived aggregates in the canonical document", () => {
  const document = validRun();
  const serialized = JSON.parse(core.stringifyRunDocument(document));

  for (const field of ["summary", "suites", "modules", "specs"]) {
    assert.equal(
      Object.hasOwn(serialized, field),
      false,
      `${field} must be derived at read time, not stored in run.json`,
    );
  }
});
