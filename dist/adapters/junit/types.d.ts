import type { ClassifierPolicy } from "../../universal/core/classify";
import type { RunDocument } from "../../universal/schema/types";
export type JunitProblem = {
    message?: string;
    type?: string;
    text?: string;
};
export type JunitSkipped = JunitProblem;
export type JunitTestCase = {
    name: string;
    classname?: string;
    file?: string;
    line?: number;
    timeSeconds?: number;
    timestamp?: string;
    status?: string;
    assertions?: number;
    failures: JunitProblem[];
    errors: JunitProblem[];
    skipped?: JunitSkipped;
    systemOut?: string;
    systemErr?: string;
    properties: Record<string, string>;
    suiteProperties: Record<string, string>;
    suitePath: string[];
    suiteTimestamp?: string;
    /** Suite-level output is attached to the first test in that suite. */
    suiteSystemOut?: string;
    suiteSystemErr?: string;
    sourcePath: string;
    /** Document order across every input file. */
    index: number;
};
export type JunitSuite = {
    name?: string;
    timestamp?: string;
    timeSeconds?: number;
    hostname?: string;
    properties: Record<string, string>;
    systemOut?: string;
    systemErr?: string;
    testcases: JunitTestCase[];
    suites: JunitSuite[];
    failures: JunitProblem[];
    errors: JunitProblem[];
    sourcePath: string;
};
export type JunitFile = {
    path: string;
    rootName: string;
    timeSeconds?: number;
    properties: Record<string, string>;
    suites: JunitSuite[];
    testcases: JunitTestCase[];
    systemOut?: string;
    systemErr?: string;
};
export type JunitConversionOptions = {
    /** Reserved run folder name. Generated from the start time when omitted. */
    runId?: string;
    /** Explicit framework name. Overrides detection from the XML. */
    framework?: string;
    /** Environment label shown on the dashboard. */
    environment?: string;
    timezone: string;
    baseURL?: string;
    /** Fallback start time when the XML has no usable timestamp. */
    startedAt?: string;
    /** Source file modification time, used as a last-resort timestamp. */
    fallbackStartedAt?: string;
    /** Optional classification policy overrides. */
    classifierPolicy?: Partial<ClassifierPolicy>;
    /** Extra key/value metadata, normally from CLI flags. */
    metadata?: Record<string, string>;
};
export type JunitConversionResult = {
    document: RunDocument;
    warnings: string[];
    framework: string;
    frameworkDetected: boolean;
    sourceFiles: string[];
    testCount: number;
};
export declare class JunitFormatError extends Error {
    constructor(message: string);
}
