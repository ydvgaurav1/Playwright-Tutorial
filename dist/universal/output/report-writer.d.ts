import { type DashboardSettings } from "../../dashboard-template";
import type { ReportDocument } from "../../report-types";
import type { RunDocument } from "../schema/types";
export type UniversalReportWriterOptions = {
    reportsRoot: string;
    timezone: string;
    latestTitle?: string;
    dashboard?: DashboardSettings;
};
export type WriteRunOptions = {
    dashboard?: DashboardSettings;
    latestTitle?: string;
};
/**
 * Writes the durable shape shared by every adapter: a reserved run folder,
 * canonical run.json, schema-v2 results.json, the existing dashboard, history,
 * and the latest redirect.
 *
 * The dashboard is written before results.json. That way a failed dashboard
 * write can never leave a completed run in history with a missing dashboard.
 * The current run is added to the dashboard history in memory, so the rendered
 * content is the same as reading it back from disk.
 */
export declare class UniversalReportWriter {
    private readonly options;
    constructor(options: UniversalReportWriterOptions);
    reserveRunDirectory(executionStartedAt: Date): Promise<{
        runId: string;
        runDirectory: string;
    }>;
    writeRun(runDirectory: string, document: RunDocument, overrides?: WriteRunOptions): Promise<ReportDocument>;
    private loadHistory;
    private updateLatestRedirect;
    private timestampInTimezone;
}
