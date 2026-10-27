import path from "node:path";
import type {
  DashboardStatus,
  ModuleRecord,
  SpecRecord,
  SuiteRecord,
  SummaryRecord,
  TestRecord,
} from "./report-types";

const DIRECT_SUITE_TAGS = new Set(["sanity", "regression"]);
const SUITE_PREFIX = "suite:";
const MODULE_PREFIX = "module:";

function normalizeClassification(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function classifySuites(tags: string[]): string[] {
  const suites = new Set<string>();

  for (const originalTag of tags) {
    const tag = originalTag.trim().toLowerCase().replace(/^@/, "");
    if (DIRECT_SUITE_TAGS.has(tag)) suites.add(tag);
    if (tag.startsWith(SUITE_PREFIX)) {
      const suite = normalizeClassification(tag.slice(SUITE_PREFIX.length));
      if (suite) suites.add(suite);
    }
  }

  return [...suites].sort();
}

export function classifyModule(tags: string[], file: string): string {
  for (const originalTag of tags) {
    const tag = originalTag.trim().toLowerCase().replace(/^@/, "");
    if (!tag.startsWith(MODULE_PREFIX)) continue;
    const module = normalizeClassification(tag.slice(MODULE_PREFIX.length));
    if (module) return module;
  }

  const normalizedPath = file.replaceAll("\\", "/");
  const segments = normalizedPath.split("/").filter(Boolean);
  const testsIndex = segments.lastIndexOf("tests");
  const sourceSegments = testsIndex >= 0 ? segments.slice(testsIndex + 1) : segments;
  if (sourceSegments.length > 1) {
    return normalizeClassification(sourceSegments[0]) || "unclassified";
  }

  const basename = path.posix.basename(normalizedPath)
    .replace(/\.(?:spec|test)\.[^.]+$/i, "")
    .replace(/\.[^.]+$/i, "");
  return normalizeClassification(basename) || "unclassified";
}

export function createSummary(
  tests: TestRecord[],
  durationMs = tests.reduce((total, test) => total + test.durationMs, 0),
): SummaryRecord {
  const count = (status: DashboardStatus): number =>
    tests.filter((test) => test.status === status).length;
  const total = tests.length;
  const passed = count("passed");

  return {
    total,
    passed,
    failed: count("failed"),
    skipped: count("skipped"),
    flaky: count("flaky"),
    passPercentage: total === 0 ? 0 : Number(((passed / total) * 100).toFixed(1)),
    durationMs,
  };
}

export function createSuiteRecords(tests: TestRecord[]): SuiteRecord[] {
  const grouped = new Map<string, TestRecord[]>();
  for (const test of tests) {
    for (const suite of test.suites) {
      grouped.set(suite, [...(grouped.get(suite) ?? []), test]);
    }
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, suiteTests]) => ({ name, summary: createSummary(suiteTests) }));
}

export function createModuleRecords(tests: TestRecord[]): ModuleRecord[] {
  const grouped = groupTests(tests, (test) => test.module);
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, moduleTests]) => ({
      name,
      specKeys: [...new Set(moduleTests.map((test) => test.spec.key))].sort(),
      summary: createSummary(moduleTests),
    }));
}

export function createSpecRecords(tests: TestRecord[]): SpecRecord[] {
  const grouped = groupTests(tests, (test) => test.spec.key);
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
        summary: createSummary(specTests),
      };
    });
}

function groupTests(
  tests: TestRecord[],
  keyFor: (test: TestRecord) => string,
): Map<string, TestRecord[]> {
  const grouped = new Map<string, TestRecord[]>();
  for (const test of tests) {
    const key = keyFor(test);
    grouped.set(key, [...(grouped.get(key) ?? []), test]);
  }
  return grouped;
}
