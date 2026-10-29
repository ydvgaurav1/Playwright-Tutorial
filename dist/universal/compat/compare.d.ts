export type ComparisonDifference = {
    path: string;
    legacy: unknown;
    universal: unknown;
};
export type LegacyComparison = {
    runId: string;
    schemaVersion: string;
    checked: string[];
    differences: ComparisonDifference[];
};
/**
 * Compares the stored legacy results.json model with the model derived from
 * the canonical projection. This is read-only and never touches the report
 * directory.
 */
export declare function compareLegacyResults(value: unknown): LegacyComparison;
