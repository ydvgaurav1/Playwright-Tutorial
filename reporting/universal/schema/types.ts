/**
 * Framework-independent result contracts.
 *
 * This module intentionally imports nothing from Playwright, Selenium, JUnit,
 * or any other runner. Adapters are responsible for producing this shape.
 */

export const SCHEMA_VERSION = "1.0.0" as const;
export const SCHEMA_MAJOR = 1 as const;

export type SchemaVersion = typeof SCHEMA_VERSION;

/** Status of a complete test after all attempts have finished. */
export type UniversalTestStatus =
  | "passed"
  | "failed"
  | "skipped"
  | "flaky"
  | "timedOut"
  | "interrupted"
  | "unknown";

/** Status of one attempt. A flaky outcome is meaningful only at test level. */
export type AttemptStatus = Exclude<UniversalTestStatus, "flaky">;

export type RunStatus =
  | "passed"
  | "failed"
  | "timedOut"
  | "interrupted"
  | "unknown";

export type StepStatus = "passed" | "failed" | "skipped";

export type EvidenceKind =
  | "screenshot"
  | "video"
  | "trace"
  | "log"
  | "file"
  | "native-report";

export type LogStream = "stdout" | "stderr" | "system";

export type CapturedError = {
  message: string;
  type?: string;
  stack?: string;
  snippet?: string;
  expected?: string;
  actual?: string;
};

export type StepRecord = {
  title: string;
  subtitle?: string;
  category: string;
  status: StepStatus;
  startedAt: string;
  durationMs: number;
  error?: CapturedError;
  steps: StepRecord[];
};

export type EvidenceRecord = {
  kind: EvidenceKind;
  name: string;
  /** Path relative to the run root. Never absolute and never contains "..". */
  path: string;
  mimeType?: string;
  bytes?: number;
  sha256?: string;
  /** Optional hint such as "playwright" for trace files. */
  format?: string;
  missing?: boolean;
};

export type LogRecord = {
  stream: LogStream;
  timestamp: string;
  text: string;
  truncated?: boolean;
};

export type ExecutorRecord = {
  id?: string;
  workerIndex?: number;
  host?: string;
};

export type AttemptRecord = {
  index: number;
  retry: number;
  status: AttemptStatus;
  startedAt: string;
  durationMs: number;
  executor?: ExecutorRecord;
  errors: CapturedError[];
  steps: StepRecord[];
  logs: LogRecord[];
  evidence: EvidenceRecord[];
  extensions?: Record<string, unknown>;
};

export type SpecIdentity = {
  /** Stable grouping key, for example "<source-file>::<variant>". */
  key: string;
  name: string;
  path: string;
};

export type SourceLocation = {
  file: string;
  line?: number;
  column?: number;
};

export type VariantRecord = {
  /** Project/configuration name, for example "chromium" or "testng-suite". */
  name: string;
  browser?: string;
  device?: string;
  repeat?: number;
};

export type RetryRecord = {
  configured: number;
  used: number;
};

export type TestRecord = {
  /** Opaque, stable adapter-owned identity. Preserved from the source framework. */
  id: string;
  nativeId?: string;
  idStrategy?: string;
  title: string;
  titlePath: string[];
  labels: string[];
  suites: string[];
  module: string;
  spec: SpecIdentity;
  source: SourceLocation;
  variant: VariantRecord;
  status: UniversalTestStatus;
  durationMs: number;
  retries: RetryRecord;
  attempts: AttemptRecord[];
  extensions?: Record<string, unknown>;
};

export type SummaryRecord = {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  /** passed / total, rounded to one decimal place. */
  passPercentage: number;
  /** Sum of the durations of the tests in scope. */
  durationMs: number;
  /** Present only when the scope contains such results. */
  timedOut?: number;
  interrupted?: number;
  unknown?: number;
};

export type SuiteRecord = {
  name: string;
  summary: SummaryRecord;
};

export type ModuleRecord = {
  name: string;
  specKeys: string[];
  summary: SummaryRecord;
};

export type SpecRecord = SpecIdentity & {
  variant: string;
  browser?: string;
  module: string;
  summary: SummaryRecord;
};

export type DerivedReport = {
  summary: SummaryRecord;
  suites: SuiteRecord[];
  modules: ModuleRecord[];
  specs: SpecRecord[];
};

export type ProducerRecord = {
  name: string;
  version: string;
  framework: string;
  frameworkVersion?: string;
  /** Legacy source schema, when the canonical document was projected from disk. */
  sourceSchemaVersion?: string;
};

export type RunRecord = {
  id: string;
  status: RunStatus;
  startedAt: string;
  endedAt: string;
  /** Wall-clock duration of the framework invocation. */
  durationMs: number;
  timezone: string;
};

export type EnvironmentRecord = {
  name: string;
  baseUrl?: string;
  branch?: string;
  commit?: string;
  ci?: boolean;
  os?: string;
  runtime?: string;
  browsers?: string[];
  projects?: string[];
};

export type CapabilitiesRecord = {
  steps: boolean;
  retries: boolean;
  logs: boolean;
  attachments: boolean;
  traceFormats: string[];
  timings: "run" | "test" | "attempt";
};

export type ExternalReportRecord = {
  label: string;
  /** Path relative to the run root. */
  path: string;
  kind?: "html" | "json" | "xml" | "other";
};

export type RunDocument = {
  schemaVersion: SchemaVersion;
  producer: ProducerRecord;
  run: RunRecord;
  environment: EnvironmentRecord;
  labels?: Record<string, string>;
  capabilities: CapabilitiesRecord;
  externalReports?: ExternalReportRecord[];
  tests: TestRecord[];
  globalErrors: CapturedError[];
  extensions?: Record<string, unknown>;
};
