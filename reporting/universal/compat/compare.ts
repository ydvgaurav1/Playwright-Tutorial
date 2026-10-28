import type { RunDocument, SummaryRecord, TestRecord } from "../schema/types";
import { createDerivedReport } from "../core/metrics";
import { toRunRelativePath } from "../schema/paths";
import { fromLegacyResultsDocument } from "./legacy-playwright";

export type ComparisonDifference = {
  path: string;
  legacy: unknown;
  universal: unknown;
};

export type LegacyComparison = {
  runId: string;
  schemaVersion: string;
  checked: string[];
  differences: ComparisonDifference[];
};

const SUMMARY_FIELDS = [
  "total",
  "passed",
  "failed",
  "skipped",
  "flaky",
  "passPercentage",
  "durationMs",
] as const;

/**
 * Compares the stored legacy results.json model with the model derived from
 * the canonical projection. This is read-only and never touches the report
 * directory.
 */
export function compareLegacyResults(value: unknown): LegacyComparison {
  const source = asRecord(value);
  if (!source) throw new Error("Legacy results document must be an object.");

  const schemaVersion = String(source.schemaVersion ?? "unknown");
  const sourceRun = asRecord(source.run);
  const runId = asString(sourceRun?.id) ?? "unknown";
  const canonical = fromLegacyResultsDocument(value);
  const derived = createDerivedReport(canonical.tests, canonical.run.durationMs);
  const differences: ComparisonDifference[] = [];
  const checked: string[] = [];

  const sourceSummary = asRecord(source.summary);
  if (sourceSummary) {
    checked.push("summary");
    compareSummary(sourceSummary, derived.summary, differences, "summary");
  }

  if (schemaVersion === "2") {
    checked.push("suites", "modules", "specs");
    compareValue("suites", source.suites, derived.suites, differences);
    compareValue("modules", source.modules, derived.modules, differences);
    compareValue(
      "specs",
      normalizeLegacySpecs(source.specs),
      derived.specs,
      differences,
    );
  }

  checked.push("tests");
  compareTests(source.tests, canonical, differences);

  return { runId, schemaVersion, checked, differences };
}

function compareSummary(
  legacy: Record<string, unknown>,
  universal: SummaryRecord,
  differences: ComparisonDifference[],
  prefix: string,
): void {
  for (const field of SUMMARY_FIELDS) {
    compareValue(
      `${prefix}.${field}`,
      legacy[field],
      universal[field],
      differences,
    );
  }
}

function compareTests(
  legacyTestsValue: unknown,
  canonical: RunDocument,
  differences: ComparisonDifference[],
): void {
  const legacyTests = asArray(legacyTestsValue) ?? [];
  if (legacyTests.length !== canonical.tests.length) {
    addDifference(
      differences,
      "tests.length",
      legacyTests.length,
      canonical.tests.length,
    );
  }

  legacyTests.forEach((legacyValue, index) => {
    const legacy = asRecord(legacyValue);
    const test = canonical.tests[index];
    if (!legacy || !test) return;

    const prefix = `tests[${index}]`;
    compareValue(`${prefix}.id`, legacy.id, test.id, differences);
    compareValue(`${prefix}.title`, legacy.title, test.title, differences);
    compareValue(`${prefix}.status`, legacy.status, test.status, differences);
    compareValue(
      `${prefix}.durationMs`,
      legacy.durationMs,
      test.durationMs,
      differences,
    );
    compareValue(
      `${prefix}.retriesConfigured`,
      legacy.retriesConfigured,
      test.retries.configured,
      differences,
    );
    compareValue(
      `${prefix}.retryAttempts`,
      legacy.retryAttempts,
      test.retries.used,
      differences,
    );
    compareValue(`${prefix}.tags`, legacy.tags, test.labels, differences);

    if (canonical.producer.sourceSchemaVersion === "2") {
      compareValue(`${prefix}.suites`, legacy.suites, test.suites, differences);
      compareValue(`${prefix}.module`, legacy.module, test.module, differences);
      compareValue(`${prefix}.project`, legacy.project, test.variant.name, differences);
      compareValue(`${prefix}.browser`, legacy.browser, test.variant.browser, differences);
      compareValue(
        `${prefix}.repeatEachIndex`,
        legacy.repeatEachIndex,
        test.variant.repeat,
        differences,
      );
      compareValue(`${prefix}.file`, legacy.file, test.source.file, differences);
      compareValue(`${prefix}.line`, legacy.line, test.source.line, differences);
      compareValue(
        `${prefix}.column`,
        legacy.column,
        test.source.column,
        differences,
      );
      compareValue(`${prefix}.spec`, legacy.spec, test.spec, differences);
    }

    compareAttempts(legacy.attempts, test, differences, prefix);
  });
}

function compareAttempts(
  legacyAttemptsValue: unknown,
  test: TestRecord,
  differences: ComparisonDifference[],
  prefix: string,
): void {
  const legacyAttempts = asArray(legacyAttemptsValue) ?? [];
  if (legacyAttempts.length !== test.attempts.length) {
    addDifference(
      differences,
      `${prefix}.attempts.length`,
      legacyAttempts.length,
      test.attempts.length,
    );
  }

  legacyAttempts.forEach((legacyValue, index) => {
    const legacy = asRecord(legacyValue);
    const attempt = test.attempts[index];
    if (!legacy || !attempt) return;

    const attemptPrefix = `${prefix}.attempts[${index}]`;
    compareValue(
      `${attemptPrefix}.status`,
      legacy.status,
      attempt.status,
      differences,
    );
    compareValue(
      `${attemptPrefix}.durationMs`,
      legacy.durationMs,
      attempt.durationMs,
      differences,
    );
    compareValue(`${attemptPrefix}.retry`, legacy.retry, attempt.retry, differences);
    compareValue(
      `${attemptPrefix}.startTime`,
      legacy.startTime,
      attempt.startedAt,
      differences,
    );
    compareValue(
      `${attemptPrefix}.workerIndex`,
      legacy.workerIndex,
      attempt.executor?.workerIndex,
      differences,
    );

    compareErrors(
      legacy.errors,
      attempt.errors,
      differences,
      `${attemptPrefix}.errors`,
    );
    compareSteps(
      legacy.steps,
      attempt.steps,
      differences,
      `${attemptPrefix}.steps`,
    );
    compareLogs(
      legacy.logs,
      attempt.logs,
      differences,
      `${attemptPrefix}.logs`,
    );
    compareEvidence(
      legacy.artifacts,
      attempt.evidence,
      differences,
      `${attemptPrefix}.artifacts`,
    );
  });
}

function compareErrors(
  legacyErrorsValue: unknown,
  universalErrors: RunDocument["globalErrors"],
  differences: ComparisonDifference[],
  prefix: string,
): void {
  const legacyErrors = asArray(legacyErrorsValue) ?? [];
  if (legacyErrors.length !== universalErrors.length) {
    addDifference(
      differences,
      `${prefix}.length`,
      legacyErrors.length,
      universalErrors.length,
    );
  }

  legacyErrors.forEach((legacyValue, index) => {
    const legacy = asRecord(legacyValue);
    const error = universalErrors[index];
    if (!legacy || !error) return;
    for (const field of [
      "message",
      "stack",
      "snippet",
      "expected",
      "actual",
      "type",
    ] as const) {
      if (legacy[field] !== undefined) {
        compareValue(
          `${prefix}[${index}].${field}`,
          legacy[field],
          error[field],
          differences,
        );
      }
    }
  });
}

function compareSteps(
  legacyStepsValue: unknown,
  universalSteps: TestRecord["attempts"][number]["steps"],
  differences: ComparisonDifference[],
  prefix: string,
): void {
  const legacySteps = asArray(legacyStepsValue) ?? [];
  if (legacySteps.length !== universalSteps.length) {
    addDifference(
      differences,
      `${prefix}.length`,
      legacySteps.length,
      universalSteps.length,
    );
  }

  legacySteps.forEach((legacyValue, index) => {
    const legacy = asRecord(legacyValue);
    const step = universalSteps[index];
    if (!legacy || !step) return;
    const stepPrefix = `${prefix}[${index}]`;
    compareValue(`${stepPrefix}.title`, legacy.title, step.title, differences);
    compareValue(
      `${stepPrefix}.subtitle`,
      legacy.subtitle,
      step.subtitle,
      differences,
    );
    compareValue(
      `${stepPrefix}.category`,
      legacy.category,
      step.category,
      differences,
    );
    compareValue(`${stepPrefix}.status`, legacy.status, step.status, differences);
    compareValue(
      `${stepPrefix}.durationMs`,
      legacy.durationMs,
      step.durationMs,
      differences,
    );
    compareValue(
      `${stepPrefix}.startTime`,
      legacy.startTime,
      step.startedAt,
      differences,
    );
    if (legacy.error !== undefined || step.error !== undefined) {
      compareErrors(
        legacy.error === undefined ? [] : [legacy.error],
        step.error === undefined ? [] : [step.error],
        differences,
        `${stepPrefix}.error`,
      );
    }
    compareSteps(legacy.steps, step.steps, differences, `${stepPrefix}.steps`);
  });
}

function compareLogs(
  legacyLogsValue: unknown,
  universalLogs: TestRecord["attempts"][number]["logs"],
  differences: ComparisonDifference[],
  prefix: string,
): void {
  const legacyLogs = asArray(legacyLogsValue) ?? [];
  if (legacyLogs.length !== universalLogs.length) {
    addDifference(
      differences,
      `${prefix}.length`,
      legacyLogs.length,
      universalLogs.length,
    );
  }

  legacyLogs.forEach((legacyValue, index) => {
    const legacy = asRecord(legacyValue);
    const log = universalLogs[index];
    if (!legacy || !log) return;
    compareValue(`${prefix}[${index}].stream`, legacy.stream, log.stream, differences);
    compareValue(
      `${prefix}[${index}].timestamp`,
      legacy.timestamp,
      log.timestamp,
      differences,
    );
    compareValue(`${prefix}[${index}].text`, legacy.text, log.text, differences);
  });
}

function compareEvidence(
  legacyArtifactsValue: unknown,
  universalEvidence: TestRecord["attempts"][number]["evidence"],
  differences: ComparisonDifference[],
  prefix: string,
): void {
  const legacyArtifacts = asArray(legacyArtifactsValue) ?? [];
  if (legacyArtifacts.length !== universalEvidence.length) {
    addDifference(
      differences,
      `${prefix}.length`,
      legacyArtifacts.length,
      universalEvidence.length,
    );
  }

  legacyArtifacts.forEach((legacyValue, index) => {
    const legacy = asRecord(legacyValue);
    const evidence = universalEvidence[index];
    if (!legacy || !evidence) return;
    compareValue(
      `${prefix}[${index}].kind`,
      legacy.kind,
      evidence.kind,
      differences,
    );
    compareValue(
      `${prefix}[${index}].name`,
      legacy.name,
      evidence.name,
      differences,
    );
    compareValue(
      `${prefix}[${index}].contentType`,
      legacy.contentType,
      evidence.mimeType,
      differences,
    );
    const legacyPath = asString(legacy.path);
    compareValue(
      `${prefix}[${index}].path`,
      legacyPath === undefined ? undefined : toRunRelativePath(legacyPath),
      evidence.path,
      differences,
    );
  });
}

function normalizeLegacySpecs(value: unknown): unknown {
  const specs = asArray(value);
  if (!specs) return value;

  return specs.map((specValue) => {
    const spec = asRecord(specValue);
    if (!spec) return specValue;
    return {
      key: spec.key,
      name: spec.name,
      path: spec.path,
      variant: spec.project,
      browser: spec.browser,
      module: spec.module,
      summary: spec.summary,
    };
  });
}

function compareValue(
  path: string,
  legacy: unknown,
  universal: unknown,
  differences: ComparisonDifference[],
): void {
  if (!deepEqual(legacy, universal)) {
    addDifference(differences, path, legacy, universal);
  }
}

function addDifference(
  differences: ComparisonDifference[],
  path: string,
  legacy: unknown,
  universal: unknown,
): void {
  differences.push({ path, legacy, universal });
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    return left.every((value, index) => deepEqual(value, right[index]));
  }
  if (isRecord(left) || isRecord(right)) {
    if (!isRecord(left) || !isRecord(right)) return false;
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every(
      (key) => Object.hasOwn(right, key) && deepEqual(left[key], right[key]),
    );
  }
  return false;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
