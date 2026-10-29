import type { DashboardSettings } from "../../dashboard-template";
import type { ReportDocument } from "../../report-types";
import type { RunDocument } from "../../universal/schema/types";
export type JunitGenerateOptions = {
    /** JUnit XML files or directories containing XML files. */
    inputs: readonly string[];
    reportsRoot: string;
    timezone?: string;
    environment?: string;
    baseURL?: string;
    framework?: string;
    /** Optional explicit attachment manifest. */
    manifestPath?: string;
    /** Explicit run start when the XML has no timestamps. */
    startedAt?: string;
    /** Extra metadata recorded in extensions.junit. */
    metadata?: Record<string, string>;
    latestTitle?: string;
};
export type JunitGenerateResult = {
    runId: string;
    runDirectory: string;
    dashboardPath: string;
    document: RunDocument;
    report: ReportDocument;
    warnings: string[];
    sourceFiles: string[];
    copiedAttachments: number;
};
export declare const JUNIT_DASHBOARD_SETTINGS: DashboardSettings;
/** Per-file safety limit. JUnit reports are read fully into memory. */
export declare const MAX_JUNIT_XML_BYTES: number;
/**
 * Generates a complete report from JUnit XML. The reserved run folder is the
 * only place written to; a failure removes the incomplete run folder and never
 * touches history or the latest redirect.
 */
export declare function generateJunitReport(options: JunitGenerateOptions): Promise<JunitGenerateResult>;
