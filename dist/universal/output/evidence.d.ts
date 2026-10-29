import type { ReportDocument } from "../../report-types";
export declare const MAX_EVIDENCE_PREVIEW_BYTES: number;
/**
 * Resolves dashboard evidence against an immutable run directory. This is the
 * only stage that reads evidence content: the generated dashboard remains a
 * static, read-only document suitable for file:// use or static cloud hosting.
 */
export declare function prepareEvidenceForDashboard(report: ReportDocument, runDirectory: string): Promise<ReportDocument>;
