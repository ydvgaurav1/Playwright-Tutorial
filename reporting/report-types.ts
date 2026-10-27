export type DashboardStatus = "passed" | "failed" | "skipped" | "flaky";

export type CapturedError = {
  message: string;
  stack?: string;
  snippet?: string;
  expected?: string;
  actual?: string;
};

export type StepRecord = {
  title: string;
  subtitle?: string;
  category: string;
  status: "passed" | "failed";
  durationMs: number;
  startTime: string;
  error?: CapturedError;
  steps: StepRecord[];
};

export type ArtifactRecord = {
  kind: "screenshot" | "video" | "trace";
  name: string;
  contentType: string;
  path: string;
};

export type LogRecord = {
  stream: "stdout" | "stderr";
  timestamp: string;
  text: string;
};

export type AttemptRecord = {
  attempt: number;
  retry: number;
  status: string;
  durationMs: number;
  startTime: string;
  workerIndex: number;
  errors: CapturedError[];
  steps: StepRecord[];
  artifacts: ArtifactRecord[];
  logs: LogRecord[];
};

export type SpecIdentity = {
  key: string;
  name: string;
  path: string;
};

export type TestRecord = {
  /** Stable Playwright identity includes source title and project name. */
  id: string;
  title: string;
  titlePath: string[];
  /** Many-to-many suite membership. The test remains one record overall. */
  suites: string[];
  module: string;
  spec: SpecIdentity;
  file: string;
  line: number;
  column: number;
  status: DashboardStatus;
  project: string;
  browser: string;
  repeatEachIndex: number;
  durationMs: number;
  retriesConfigured: number;
  retryAttempts: number;
  tags: string[];
  attempts: AttemptRecord[];
};

export type SummaryRecord = {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  passPercentage: number;
  durationMs: number;
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
  project: string;
  browser: string;
  module: string;
  summary: SummaryRecord;
};

export type HistoryRecord = {
  runId: string;
  startTime: string;
  endTime: string;
  environment: string;
  browsers: string[];
  projects: string[];
  suites: SuiteRecord[];
  summary: SummaryRecord;
  failedTestIds: string[];
  dashboardPath: string;
};

export type ReportDocument = {
  schemaVersion: 2;
  run: {
    id: string;
    status: string;
    startTime: string;
    endTime: string;
    timezone: string;
  };
  metadata: {
    environment: string;
    baseURL: string;
    browsers: string[];
    projects: string[];
    operatingSystem: string;
    nodeVersion: string;
    ci: boolean;
  };
  summary: SummaryRecord;
  suites: SuiteRecord[];
  modules: ModuleRecord[];
  specs: SpecRecord[];
  tests: TestRecord[];
  globalErrors: CapturedError[];
};

export type DashboardDocument = ReportDocument & {
  history: HistoryRecord[];
};
