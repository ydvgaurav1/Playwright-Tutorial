import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestError, TestResult } from "@playwright/test/reporter";
import type { PlaywrightReporterOptions } from "./types";
/**
 * Playwright-specific reporter adapter.
 *
 * Lifecycle and Playwright object traversal live here. Normalization,
 * classification, metrics, schema validation, and legacy projection live in the
 * shared reporting modules.
 */
export declare class PlaywrightReportingAdapter implements Reporter {
    private readonly options;
    private rootSuite?;
    private config?;
    private runId?;
    private runDirectory?;
    private readonly globalErrors;
    private readonly attemptLogs;
    private readonly writer;
    constructor(options: PlaywrightReporterOptions);
    printsToStdio(): boolean;
    onBegin(config: FullConfig, suite: Suite): void;
    onError(error: TestError): void;
    onStdOut(chunk: string | Buffer, _test: void | TestCase, result: void | TestResult): void;
    onStdErr(chunk: string | Buffer, _test: void | TestCase, result: void | TestResult): void;
    onEnd(result: FullResult): Promise<void>;
    private finalize;
    private createRunDocument;
    private serializeTest;
    private serializeAttempt;
    private createSyntheticAttempt;
    private captureLog;
    private serializeStep;
    private serializeError;
    private captureAssertionLine;
    private redact;
    private statusFor;
    private copyEvidence;
    private artifactKind;
    private artifactExtension;
    private slug;
    private getRunDirectory;
    private getRunId;
}
export default PlaywrightReportingAdapter;
