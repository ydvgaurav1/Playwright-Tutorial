import type { ReportDocument } from "../../report-types";
import type { RunDocument } from "../../universal/schema/types";
import type { PlaywrightReporterOptions } from "./types";
export { copyFileAtomic, writeFileAtomic } from "../../universal/output/files";
/**
 * Playwright-specific durable work: native-report copying and staging cleanup.
 * Run folders, canonical/legacy documents, dashboard, history, and the latest
 * redirect are owned by the shared UniversalReportWriter.
 */
export declare class PlaywrightReportWriter {
    private readonly options;
    private readonly universal;
    constructor(options: PlaywrightReporterOptions);
    reserveRunDirectory(executionStartedAt: Date): Promise<{
        runId: string;
        runDirectory: string;
    }>;
    copyNativeReport(runDirectory: string): Promise<string>;
    writeRun(runDirectory: string, document: RunDocument): Promise<ReportDocument>;
    cleanupStaging(): Promise<void>;
}
