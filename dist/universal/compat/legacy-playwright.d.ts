import type { RunDocument } from "../schema/types";
export type LegacyReadOptions = {
    /**
     * Optional native report path relative to the run root. It is not part of
     * results.json, so it is never inferred automatically.
     */
    nativeReportPath?: string;
};
/**
 * Compatibility reader for the existing Playwright results.json documents.
 *
 * This is a schema projection, not a Playwright reporter adapter: it reads
 * already-written files and produces canonical in-memory documents. It does
 * not write to, move, or mutate historical reports.
 */
export declare function fromLegacyResultsDocument(value: unknown, options?: LegacyReadOptions): RunDocument;
export declare function isLegacyResultsDocument(value: unknown): boolean;
