import path from "node:path";
import {
  classifySuites,
  normalizeClassification,
} from "../../universal/core/classify";
import {
  normalizeTestStatus,
  redactText,
  secondsToMilliseconds,
} from "../../universal/core/normalize";
import type {
  AttemptRecord,
  AttemptStatus,
  CapturedError,
  LogRecord,
  RunDocument,
  RunStatus,
  SpecIdentity,
  TestRecord,
  UniversalTestStatus,
} from "../../universal/schema/types";
import { assertValidRunDocument } from "../../universal/schema/validate";
import type {
  JunitConversionOptions,
  JunitConversionResult,
  JunitFile,
  JunitProblem,
  JunitSuite,
  JunitTestCase,
} from "./types";

const REDACTION = {
  patterns: [
    /(?<=(?:password|passwd|pwd|token|secret|api[_-]?key)\s*[:=]\s*)[^\s,;]+/gi,
  ],
};

const FRAMEWORK_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/pytest/, "pytest"],
  [/surefire/, "maven-surefire"],
  [/testng/, "testng"],
  [/rest[\s._-]*assured/, "rest-assured"],
  [/selenium/, "selenium"],
  [/phpunit/, "phpunit"],
  [/nunit/, "nunit"],
  [/xunit/, "xunit"],
  [/mstest/, "mstest"],
  [/gradle/, "gradle"],
  [/jest/, "jest"],
  [/vitest/, "vitest"],
  [/mocha/, "mocha"],
  [/cypress/, "cypress"],
  [/playwright/, "playwright"],
  [/junit/, "junit"],
];

const TAG_PROPERTY_KEYS = new Set([
  "tags",
  "tag",
  "labels",
  "label",
  "groups",
  "group",
  "categories",
  "category",
]);

const GENERIC_PARENT_DIRECTORIES = new Set([
  "tests",
  "test",
  "spec",
  "specs",
  "__tests__",
  "src",
  "java",
  "kotlin",
]);

type FrameworkDetection = {
  framework: string;
  detected: boolean;
  source: "cli" | "xml" | "default";
};

type RunStart = {
  startedAt: string;
  source:
    | "testcase.timestamp"
    | "testsuite.timestamp"
    | "cli.started-at"
    | "source-file-mtime"
    | "generated-at";
  warning?: string;
};

type RunDuration = {
  durationMs: number;
  source: "root.time" | "testsuite.time" | "sum(testcase.time)" | "missing";
};

type WarningStats = {
  missingDuration: number;
  missingTimestamp: number;
  missingIdentity: number;
  flaky: string[];
  unknownStatus: Array<{ name: string; status: string }>;
};

/**
 * Converts already-parsed JUnit files into the canonical document. It never
 * reads or writes files and never imports Playwright.
 */
export function convertJunitFiles(
  files: readonly JunitFile[],
  options: JunitConversionOptions,
): JunitConversionResult {
  const testcases = flattenTestcases(files);
  const suites = files.flatMap((file) => allSuites(file.suites));
  const properties = mergeProperties(files);
  const framework = detectFramework(files, properties, options);
  const warnings: string[] = [];
  const runStart = deriveRunStart(files, testcases, options);
  if (runStart.warning) warnings.push(runStart.warning);
  const runDuration = deriveRunDuration(files, testcases);
  if (runDuration.source === "missing") {
    warnings.push(
      "No execution duration was present in the JUnit XML; the run duration is recorded as 0 ms.",
    );
  }

  const occurrences = new Map<string, number>();
  const warningStats: WarningStats = {
    missingDuration: 0,
    missingTimestamp: 0,
    missingIdentity: 0,
    flaky: [],
    unknownStatus: [],
  };
  const tests = testcases.map((testcase) =>
    convertTestCase(
      testcase,
      options,
      runStart.startedAt,
      occurrences,
      warningStats,
    ),
  );

  if (warningStats.missingDuration > 0) {
    warnings.push(
      `${warningStats.missingDuration} testcase(s) have no time attribute; their durations are recorded as 0 ms.`,
    );
  }
  if (warningStats.missingTimestamp > 0) {
    warnings.push(
      `${warningStats.missingTimestamp} testcase(s) have no timestamp; the run start time is used as their attempt start.`,
    );
  }
  if (warningStats.missingIdentity > 0) {
    warnings.push(
      `${warningStats.missingIdentity} testcase(s) have neither classname nor file metadata; suite/source identity is used.`,
    );
  }
  if (warningStats.flaky.length > 0) {
    warnings.push(
      `${warningStats.flaky.length} testcase(s) report a flaky status and are treated as failed because JUnit XML carries no retry evidence (${sample(warningStats.flaky)}).`,
    );
  }
  if (warningStats.unknownStatus.length > 0) {
    warnings.push(
      `${warningStats.unknownStatus.length} testcase(s) have an unrecognized status and are treated as passed (${sample(
        warningStats.unknownStatus.map(
          (item) => `${item.name}: ${item.status}`,
        ),
      )}).`,
    );
  }
  if (testcases.length === 0) {
    warnings.push(
      "The JUnit XML contains no testcase elements; the report is an empty run.",
    );
  }
  if (!framework.detected && !options.framework) {
    warnings.push(
      'The source framework could not be detected; producer.framework is recorded as "junit".',
    );
  }
  const suiteLogCount = suites.filter(
    (suite) =>
      Boolean(suite.systemOut || suite.systemErr) &&
      countTestcases(suite) > 1,
  ).length;
  if (suiteLogCount > 0) {
    warnings.push(
      `${suiteLogCount} suite-level log(s) were attached to the first test in each suite to avoid duplicating the same output across every test.`,
    );
  }

  const runStatus = deriveRunStatus(tests);
  const hasLogs = tests.some((test) =>
    test.attempts.some((attempt) => attempt.logs.length > 0),
  );
  const frameworkVersion = propertyValue(
    properties,
    "framework.version",
    "frameworkversion",
    "pytest.version",
    "junit.version",
    "testng.version",
    "phpunit.version",
    "nunit.version",
    "mstest.version",
    "jest.version",
    "vitest.version",
    "mocha.version",
    "cypress.version",
  );
  const runId =
    options.runId ??
    `junit-${runStart.startedAt.replace(/[:.]/g, "-")}`;
  const startedAtMs = Date.parse(runStart.startedAt);
  const endedAt = new Date(startedAtMs + runDuration.durationMs).toISOString();

  const document: RunDocument = {
    schemaVersion: "1.0.0",
    producer: {
      name: "junit-universal-adapter",
      version: "1.0.0",
      framework: framework.framework,
      frameworkVersion,
      sourceSchemaVersion: "junit-xml",
    },
    run: {
      id: runId,
      status: runStatus,
      startedAt: runStart.startedAt,
      endedAt,
      durationMs: runDuration.durationMs,
      timezone: options.timezone,
    },
    environment: {
      name:
        options.environment?.trim() ||
        propertyValue(
          properties,
          "environment",
          "env",
          "test.environment",
          "deployment.environment",
        ) ||
        (framework.framework === "junit" ? "junit" : framework.framework),
      baseUrl: options.baseURL ?? propertyValue(properties, "base.url", "baseurl", "url"),
      branch: propertyValue(properties, "branch", "git.branch", "vcs.branch"),
      commit: propertyValue(properties, "commit", "git.commit", "vcs.commit"),
      ci: booleanProperty(properties, "ci", "continuous.integration"),
      os: propertyValue(
        properties,
        "os.name",
        "os",
        "operating.system",
        "platform",
      ),
      runtime: propertyValue(
        properties,
        "runtime",
        "python.version",
        "java.version",
        "node.version",
        "nodejs.version",
        "ruby.version",
      ),
      // Browsers and projects are intentionally absent: JUnit XML does not
      // define either concept, and suite names must not be presented as browsers.
    },
    capabilities: {
      steps: false,
      retries: false,
      logs: hasLogs,
      attachments: false,
      traceFormats: [],
      timings: "test",
    },
    externalReports: [],
    tests,
    globalErrors: suites.flatMap((suite) => [
      ...suite.failures.map((problem) =>
        toCapturedError(problem, "Suite failure"),
      ),
      ...suite.errors.map((problem) => toCapturedError(problem, "Suite error")),
    ]),
    extensions: {
      junit: {
        format: "junit-xml",
        parserVersion: "1.0.0",
        framework: framework.framework,
        frameworkSource: framework.source,
        sourceFiles: files.map((file) => file.path),
        timestampSource: runStart.source,
        durationSource: runDuration.source,
        warnings,
        testcaseCount: tests.length,
        suiteCount: suites.length,
        metadata: options.metadata ?? {},
        unsupported: {
          steps: "JUnit XML has no standard step representation.",
          retries: "JUnit XML has no standard retry representation.",
          browser: "JUnit XML has no standard browser metadata.",
          perTestTimestamp:
            "A testcase timestamp is used when present; otherwise the nearest testsuite timestamp or the run start is used.",
          attachments: "Only explicit manifest attachments are copied.",
        },
      },
    },
  };

  return {
    document: assertValidRunDocument(document),
    warnings,
    framework: framework.framework,
    frameworkDetected: framework.detected,
    sourceFiles: files.map((file) => file.path),
    testCount: tests.length,
  };
}

function convertTestCase(
  testcase: JunitTestCase,
  options: JunitConversionOptions,
  runStartedAt: string,
  occurrences: Map<string, number>,
  warningStats: WarningStats,
): TestRecord {
  const properties = {
    ...testcase.suiteProperties,
    ...testcase.properties,
  };
  const status = deriveStatus(testcase, warningStats);
  const attemptStart = deriveAttemptStart(testcase, runStartedAt);
  const durationMs = secondsToMilliseconds(testcase.timeSeconds);
  if (testcase.timeSeconds === undefined) {
    warningStats.missingDuration += 1;
  }
  if (attemptStart.source === "run.startedAt") {
    warningStats.missingTimestamp += 1;
  }
  if (!testcase.classname && !testcase.file) {
    warningStats.missingIdentity += 1;
  }

  const module = deriveModule(testcase, properties);
  const labels = deriveLabels(testcase, module);
  const suites = classifySuites(labels, options.classifierPolicy);
  const variantName = deriveVariantName(testcase);
  const spec = deriveSpec(testcase, variantName);
  const sourceFile = deriveSourceFile(testcase);
  const title = testcase.name.trim() || "Unnamed test";
  const attemptStatus: AttemptStatus =
    status === "flaky" ? "failed" : status;
  const errors = deriveErrors(testcase);
  const logs = deriveLogs(testcase, attemptStart.startedAt);

  const attempt: AttemptRecord = {
    index: 1,
    retry: 0,
    status: attemptStatus,
    startedAt: attemptStart.startedAt,
    durationMs,
    errors,
    steps: [],
    logs,
    evidence: [],
    extensions: {
      junit: {
        source: testcase.sourcePath,
        suitePath: testcase.suitePath,
        classname: testcase.classname,
        file: testcase.file,
        line: testcase.line,
        assertions: testcase.assertions,
        status: testcase.status,
        timestampSource: attemptStart.source,
        durationSource:
          testcase.timeSeconds === undefined ? "missing" : "testcase.time",
      },
    },
  };

  const idKey = [
    testcase.sourcePath,
    testcase.suitePath.join("/"),
    testcase.classname ?? "",
    title,
  ].join("::");
  const occurrence = occurrences.get(idKey) ?? 0;
  occurrences.set(idKey, occurrence + 1);

  return {
    id: stableTestId(idKey, occurrence),
    nativeId: nativeId(testcase, title),
    idStrategy: "junit",
    title,
    titlePath: uniqueStrings([
      ...testcase.suitePath,
      testcase.classname ?? "",
      title,
    ]),
    labels,
    suites,
    module,
    spec,
    source: {
      file: sourceFile,
      line: testcase.line,
    },
    variant: {
      name: variantName,
    },
    status,
    durationMs,
    retries: { configured: 0, used: 0 },
    attempts: [attempt],
    extensions: {
      junit: {
        source: testcase.sourcePath,
        suitePath: testcase.suitePath,
        classname: testcase.classname,
        file: testcase.file,
        line: testcase.line,
        status: testcase.status,
        assertions: testcase.assertions,
      },
    },
  };
}

function deriveStatus(
  testcase: JunitTestCase,
  warningStats: WarningStats,
): UniversalTestStatus {
  if (testcase.failures.length > 0 || testcase.errors.length > 0) {
    return "failed";
  }
  if (testcase.skipped) return "skipped";
  if (!testcase.status) return "passed";

  const normalized = normalizeTestStatus(testcase.status);
  if (normalized === "flaky") {
    warningStats.flaky.push(testcase.name);
    return "failed";
  }
  if (normalized !== "unknown") return normalized;
  if (testcase.status.trim().toLowerCase() === "run") return "passed";

  warningStats.unknownStatus.push({
    name: testcase.name,
    status: testcase.status,
  });
  return "passed";
}

function deriveAttemptStart(
  testcase: JunitTestCase,
  runStartedAt: string,
): { startedAt: string; source: "testcase.timestamp" | "testsuite.timestamp" | "run.startedAt" } {
  const own = validTimestamp(testcase.timestamp);
  if (own) return { startedAt: own, source: "testcase.timestamp" };
  const suite = validTimestamp(testcase.suiteTimestamp);
  if (suite) return { startedAt: suite, source: "testsuite.timestamp" };
  return { startedAt: runStartedAt, source: "run.startedAt" };
}

function deriveErrors(testcase: JunitTestCase): CapturedError[] {
  return [
    ...testcase.failures.map((problem) =>
      toCapturedError(problem, "Test failed"),
    ),
    ...testcase.errors.map((problem) =>
      toCapturedError(problem, "Test error"),
    ),
  ];
}

function toCapturedError(
  problem: JunitProblem,
  fallbackMessage: string,
): CapturedError {
  const text = problem.text?.trim();
  const message =
    problem.message?.trim() || firstLine(text) || fallbackMessage;
  const stack = text && text !== message ? redactText(text, REDACTION) : undefined;

  return {
    message: redactText(message, REDACTION),
    type: problem.type,
    stack,
  };
}

function deriveLogs(
  testcase: JunitTestCase,
  startedAt: string,
): LogRecord[] {
  const logs: LogRecord[] = [];
  const add = (text: string | undefined, stream: "stdout" | "stderr"): void => {
    if (!text) return;
    logs.push({
      stream,
      timestamp: startedAt,
      text: redactText(text, REDACTION),
    });
  };

  add(testcase.suiteSystemOut, "stdout");
  add(testcase.suiteSystemErr, "stderr");
  add(testcase.systemOut, "stdout");
  add(testcase.systemErr, "stderr");

  return logs;
}

function deriveModule(
  testcase: JunitTestCase,
  properties: Record<string, string>,
): string {
  const explicit = propertyValue(
    properties,
    "module",
    "functional.module",
    "feature",
    "component",
  );
  if (explicit) return normalizeClassification(explicit) || "unclassified";

  if (testcase.classname) {
    const simple = testcase.classname.split(".").filter(Boolean).at(-1);
    const normalized = moduleFromName(simple ?? "");
    if (normalized) return normalized;
  }

  if (testcase.file) {
    const normalizedPath = testcase.file.replaceAll("\\", "/");
    const segments = normalizedPath.split("/").filter(Boolean);
    if (segments.length >= 2) {
      const parent = segments[segments.length - 2];
      if (!GENERIC_PARENT_DIRECTORIES.has(parent.toLowerCase())) {
        const normalized = moduleFromName(parent);
        if (normalized) return normalized;
      }
    }
    const base = path.posix
      .basename(normalizedPath)
      .replace(/\.(?:spec|test)\.[^.]+$/i, "")
      .replace(/\.[^.]+$/, "");
    const normalized = moduleFromName(base);
    if (normalized) return normalized;
  }

  const suite = testcase.suitePath.at(-1);
  if (suite) {
    const normalized = moduleFromName(suite);
    if (normalized) return normalized;
  }

  const packageName = propertyValue(properties, "package", "java.package");
  if (packageName) {
    const last = packageName.split(".").filter(Boolean).at(-1);
    const normalized = moduleFromName(last ?? packageName);
    if (normalized) return normalized;
  }

  return "unclassified";
}

function deriveSuiteNames(testcase: JunitTestCase): string[] {
  const names = new Set<string>();
  for (const suite of testcase.suitePath) {
    const normalized = normalizeClassification(humanizeName(suite));
    if (normalized) names.add(normalized);
  }
  if (testcase.classname) {
    const simple = testcase.classname.split(".").filter(Boolean).at(-1);
    if (simple) {
      const normalized = normalizeClassification(humanizeName(simple));
      if (normalized) names.add(normalized);
    }
  }
  return [...names].sort();
}

function deriveLabels(
  testcase: JunitTestCase,
  module: string,
): string[] {
  const properties = {
    ...testcase.suiteProperties,
    ...testcase.properties,
  };
  const labels = new Set<string>(propertyTags(properties));
  for (const suite of deriveSuiteNames(testcase)) {
    labels.add(`suite:${suite}`);
  }
  labels.add(`module:${module}`);
  return [...labels].sort();
}

function propertyTags(properties: Record<string, string>): string[] {
  const tags = new Set<string>();

  for (const [key, value] of Object.entries(properties)) {
    const normalizedKey = normalizePropertyKey(key);
    if (TAG_PROPERTY_KEYS.has(normalizedKey)) {
      for (const item of splitTags(value)) tags.add(item);
      continue;
    }
    if (normalizedKey === "suite" || normalizedKey === "suites") {
      for (const item of splitTags(value)) tags.add(`suite:${item}`);
      continue;
    }
    if (
      normalizedKey.startsWith("tag.") ||
      normalizedKey.startsWith("label.")
    ) {
      if (isTruthy(value)) {
        tags.add(normalizedKey.slice(normalizedKey.indexOf(".") + 1));
      }
      continue;
    }
    if (
      ["sanity", "regression", "smoke", "critical", "demo"].includes(
        normalizedKey,
      ) &&
      isTruthy(value)
    ) {
      tags.add(normalizedKey);
    }
  }

  return [...tags];
}

function splitTags(value: string): string[] {
  return value
    .split(/[,;\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function deriveVariantName(testcase: JunitTestCase): string {
  if (testcase.classname) {
    const simple = testcase.classname.split(".").filter(Boolean).at(-1);
    if (simple) {
      const normalized = normalizeClassification(humanizeName(simple));
      if (normalized) return normalized;
    }
  }
  const suite = testcase.suitePath.at(-1);
  if (suite) {
    const normalized = normalizeClassification(humanizeName(suite));
    if (normalized) return normalized;
  }
  return "junit";
}

function deriveSpec(
  testcase: JunitTestCase,
  variantName: string,
): SpecIdentity {
  const specPath =
    testcase.file ??
    testcase.classname ??
    (testcase.suitePath.join("/") ||
      path.posix.basename(testcase.sourcePath));
  const specName = testcase.file
    ? path.posix.basename(testcase.file)
    : testcase.classname
      ? testcase.classname.split(".").filter(Boolean).at(-1) ??
        testcase.classname
      : path.posix.basename(specPath);

  return {
    key: `${specPath}::${variantName}`,
    name: specName,
    path: specPath,
  };
}

function deriveSourceFile(testcase: JunitTestCase): string {
  return (
    testcase.file ??
    testcase.classname ??
    (testcase.suitePath.join("/") ||
      path.posix.basename(testcase.sourcePath))
  );
}

function nativeId(testcase: JunitTestCase, title: string): string {
  if (testcase.classname) return `${testcase.classname}#${title}`;
  const suite = testcase.suitePath.at(-1);
  if (suite) return `${suite}#${title}`;
  return title;
}

function stableTestId(key: string, occurrence: number): string {
  const digest = fnv1a(key).toString(16).padStart(8, "0");
  return `junit-${digest}${occurrence > 0 ? `-${occurrence}` : ""}`;
}

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function deriveRunStatus(tests: readonly TestRecord[]): RunStatus {
  if (tests.length === 0) return "unknown";
  if (tests.some((test) => test.status === "failed" || test.status === "flaky")) {
    return "failed";
  }
  if (tests.some((test) => test.status === "timedOut")) return "timedOut";
  if (tests.some((test) => test.status === "interrupted")) return "interrupted";
  return "passed";
}

function deriveRunStart(
  files: readonly JunitFile[],
  testcases: readonly JunitTestCase[],
  options: JunitConversionOptions,
): RunStart {
  const candidates: Array<{
    startedAt: string;
    source: "testcase.timestamp" | "testsuite.timestamp";
    priority: number;
  }> = [];

  for (const testcase of testcases) {
    const startedAt = validTimestamp(testcase.timestamp);
    if (startedAt) {
      candidates.push({
        startedAt,
        source: "testcase.timestamp",
        priority: 0,
      });
    }
  }
  for (const suite of files.flatMap((file) => allSuites(file.suites))) {
    const startedAt = validTimestamp(suite.timestamp);
    if (startedAt) {
      candidates.push({
        startedAt,
        source: "testsuite.timestamp",
        priority: 1,
      });
    }
  }

  if (candidates.length > 0) {
    candidates.sort(
      (left, right) =>
        Date.parse(left.startedAt) - Date.parse(right.startedAt) ||
        left.priority - right.priority,
    );
    return {
      startedAt: candidates[0].startedAt,
      source: candidates[0].source,
    };
  }

  const cliStartedAt = validTimestamp(options.startedAt);
  if (cliStartedAt) {
    return {
      startedAt: cliStartedAt,
      source: "cli.started-at",
      warning:
        "The JUnit XML has no timestamps; the explicitly supplied start time is used.",
    };
  }

  const fileTime = validTimestamp(options.fallbackStartedAt);
  if (fileTime) {
    return {
      startedAt: fileTime,
      source: "source-file-mtime",
      warning:
        "The JUnit XML has no timestamps; the source file modification time is used as the run start.",
    };
  }

  return {
    startedAt: new Date().toISOString(),
    source: "generated-at",
    warning:
      "The JUnit XML has no timestamps and no source file time was available; the report generation time is used as the run start.",
  };
}

function deriveRunDuration(
  files: readonly JunitFile[],
  testcases: readonly JunitTestCase[],
): RunDuration {
  const rootTimes = files.map((file) => file.timeSeconds);
  const definedRootTimes = rootTimes.filter(
    (value): value is number => value !== undefined,
  );
  if (
    rootTimes.length > 0 &&
    definedRootTimes.length === rootTimes.length
  ) {
    const durationMs = definedRootTimes.reduce(
      (total, value) => total + secondsToMilliseconds(value),
      0,
    );
    if (durationMs > 0) {
      return { durationMs, source: "root.time" };
    }
  }

  const suiteTimes = files.flatMap((file) =>
    file.suites.map((suite) => suite.timeSeconds),
  );
  const definedSuiteTimes = suiteTimes.filter(
    (value): value is number => value !== undefined,
  );
  if (
    suiteTimes.length > 0 &&
    definedSuiteTimes.length === suiteTimes.length
  ) {
    const durationMs = definedSuiteTimes.reduce(
      (total, value) => total + secondsToMilliseconds(value),
      0,
    );
    if (durationMs > 0) {
      return { durationMs, source: "testsuite.time" };
    }
  }

  const durationMs = testcases.reduce(
    (total, testcase) => total + secondsToMilliseconds(testcase.timeSeconds),
    0,
  );
  if (durationMs > 0) {
    return { durationMs, source: "sum(testcase.time)" };
  }

  return { durationMs: 0, source: "missing" };
}

function detectFramework(
  files: readonly JunitFile[],
  properties: Record<string, string>,
  options: JunitConversionOptions,
): FrameworkDetection {
  if (options.framework?.trim()) {
    return {
      framework: options.framework.trim(),
      detected: false,
      source: "cli",
    };
  }

  const explicit = propertyValue(
    properties,
    "framework",
    "test.framework",
    "tool",
    "generator",
  );
  const haystack = [
    explicit,
    ...Object.entries(properties).flatMap(([key, value]) => [key, value]),
    ...files.map((file) => file.path),
    ...files.flatMap((file) => allSuiteNames(file.suites)),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  for (const [pattern, framework] of FRAMEWORK_PATTERNS) {
    if (pattern.test(haystack)) {
      return { framework, detected: true, source: "xml" };
    }
  }

  return { framework: "junit", detected: false, source: "default" };
}

function allSuiteNames(suites: readonly JunitSuite[]): string[] {
  const names: string[] = [];
  for (const suite of suites) {
    if (suite.name) names.push(suite.name);
    names.push(...allSuiteNames(suite.suites));
  }
  return names;
}

function allSuites(suites: readonly JunitSuite[]): JunitSuite[] {
  return suites.flatMap((suite) => [suite, ...allSuites(suite.suites)]);
}

function countTestcases(suite: JunitSuite): number {
  return (
    suite.testcases.length +
    suite.suites.reduce((total, child) => total + countTestcases(child), 0)
  );
}

function flattenTestcases(files: readonly JunitFile[]): JunitTestCase[] {
  const testcases: JunitTestCase[] = [];
  for (const file of files) {
    const fileTestcases = [
      ...file.testcases,
      ...allSuites(file.suites).flatMap((suite) => suite.testcases),
    ].sort((left, right) => left.index - right.index);
    testcases.push(...fileTestcases);
  }
  return testcases;
}

function mergeProperties(files: readonly JunitFile[]): Record<string, string> {
  const properties: Record<string, string> = {};
  for (const file of files) {
    Object.assign(properties, file.properties);
    for (const suite of allSuites(file.suites)) {
      Object.assign(properties, suite.properties);
    }
  }
  return properties;
}

function propertyValue(
  properties: Record<string, string>,
  ...names: string[]
): string | undefined {
  const normalized = new Map<string, string>();
  for (const [key, value] of Object.entries(properties)) {
    normalized.set(normalizePropertyKey(key), value);
  }
  for (const name of names) {
    const value = normalized.get(normalizePropertyKey(name));
    if (value !== undefined && value.trim() !== "") return value.trim();
  }
  return undefined;
}

function normalizePropertyKey(key: string): string {
  return key.trim().toLowerCase().replace(/[\s_-]+/g, ".");
}

function booleanProperty(
  properties: Record<string, string>,
  ...names: string[]
): boolean | undefined {
  const value = propertyValue(properties, ...names);
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  return undefined;
}

function isTruthy(value: string): boolean {
  return ["true", "1", "yes", "y", "on"].includes(
    value.trim().toLowerCase(),
  );
}

function validTimestamp(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function firstLine(value: string | undefined): string | undefined {
  return value
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
}

function humanizeName(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2");
}

/**
 * Turns a class/file name into a functional module. Common test suffixes are
 * removed so "LoginTest", "test_login", and "login_test" agree.
 */
function moduleFromName(value: string): string {
  const normalized = normalizeClassification(humanizeName(value));
  if (!normalized) return "";
  return (
    normalized
      .replace(/^test-/, "")
      .replace(/-(?:test|tests|it|spec)$/, "") || normalized
  );
}

function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

/** Summarizes the first few offenders so warnings stay readable. */
function sample(values: readonly string[], limit = 3): string {
  const shown = values.slice(0, limit).join(", ");
  const remaining = values.length - Math.min(values.length, limit);
  return remaining > 0 ? `${shown}, +${remaining} more` : shown;
}
