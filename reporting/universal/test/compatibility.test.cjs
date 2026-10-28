const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { load, repoRoot } = require("./load-ts.cjs");

const core = load("index.ts");
const reportsRoot = path.join(repoRoot, "reports");

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

test("historical results.json files compare cleanly with the universal model", async (t) => {
  const runs = completedRuns();
  if (runs.length === 0) {
    t.skip("No completed reports are available in this workspace.");
    return;
  }

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
        `${run.id}: schema=${comparison.schemaVersion} checks=${comparison.checked.join(",")} differences=0`,
      );
    });
  }

  assert.ok(schemaVersions.has("2"), "expected at least one schema-v2 run");
  assert.ok(schemaVersions.has("1"), "expected at least one schema-v1 run");
});
