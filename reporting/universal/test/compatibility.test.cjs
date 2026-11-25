const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { load, repoRoot } = require("./load-ts.cjs");

const core = load("index.ts");
const reportsRoot = path.join(repoRoot, "reports");
const syntheticSchemaV1Fixture = path.join(
  __dirname,
  "fixtures",
  "synthetic-schema-v1-results.json",
);
const syntheticSchemaV2Fixture = path.join(
  __dirname,
  "fixtures",
  "synthetic-schema-v2-results.json",
);

function completedRuns() {
  if (!fs.existsSync(reportsRoot)) return [];

  return fs
    .readdirSync(reportsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const file = path.join(reportsRoot, entry.name, "results.json");
      if (!fs.existsSync(file)) return undefined;
      try {
        return {
          id: entry.name,
          file,
          document: JSON.parse(fs.readFileSync(file, "utf8")),
        };
      } catch {
        return undefined;
      }
    })
    .filter(Boolean)
    .sort((left, right) =>
      String(left.document.run?.startTime ?? "").localeCompare(
        String(right.document.run?.startTime ?? ""),
      ),
    );
}

test("historical and synthetic results.json files compare cleanly with the universal model", async (t) => {
  const historicalRuns = completedRuns();
  const runs = [
    {
      id: "synthetic-schema-v1-fixture",
      file: syntheticSchemaV1Fixture,
      document: JSON.parse(fs.readFileSync(syntheticSchemaV1Fixture, "utf8")),
      syntheticFixture: true,
    },
    {
      id: "synthetic-schema-v2-fixture",
      file: syntheticSchemaV2Fixture,
      document: JSON.parse(fs.readFileSync(syntheticSchemaV2Fixture, "utf8")),
      syntheticFixture: true,
    },
    ...historicalRuns,
  ];

  const schemaVersions = new Set();
  for (const run of runs) {
    await t.test(run.id, () => {
      const comparison = core.compareLegacyResults(run.document);
      schemaVersions.add(comparison.schemaVersion);

      assert.deepEqual(
        comparison.differences,
        [],
        `${run.id} has compatibility differences: ${JSON.stringify(
          comparison.differences,
          null,
          2,
        )}`,
      );

      if (comparison.schemaVersion === "2") {
        assert.deepEqual(comparison.checked, [
          "summary",
          "suites",
          "modules",
          "specs",
          "tests",
        ]);
      } else {
        assert.deepEqual(comparison.checked, ["summary", "tests"]);
      }

      console.log(
        `${run.id}${run.syntheticFixture ? " [synthetic fixture]" : ""}: schema=${comparison.schemaVersion} checks=${comparison.checked.join(",")} differences=0`,
      );
    });
  }

  assert.ok(schemaVersions.has("2"), "expected at least one schema-v2 run");
  assert.ok(schemaVersions.has("1"), "expected at least one schema-v1 run");
});
