import type { DashboardDocument } from "./report-types";
/**
 * Optional presentation settings. Every default preserves the original
 * Playwright dashboard so existing reports and tests keep their behavior.
 */
export type DashboardSettings = {
    title?: string;
    eyebrow?: string;
    reportLabel?: string;
    /** Set to null to hide the primary report link. */
    reportHref?: string | null;
    /** Set to null to hide the trace viewer link. */
    traceViewerHref?: string | null;
    traceViewerLabel?: string;
    traceHelp?: string;
    timezone?: string;
    timezoneLabel?: string;
    timezoneOffset?: string;
    timestampsLabel?: string;
    runtimeLabel?: string;
    variantColumnLabel?: string;
};
export declare function createDashboard(report: DashboardDocument, settings?: DashboardSettings): string;
