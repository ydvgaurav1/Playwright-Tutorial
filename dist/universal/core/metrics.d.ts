import type { DerivedReport, ModuleRecord, SpecRecord, SuiteRecord, SummaryRecord, TestRecord } from "../schema/types";
export declare function sumTestDurations(tests: readonly TestRecord[]): number;
/**
 * Shared metric calculation.
 *
 * `durationMs` is optional so callers can pass the framework's wall-clock
 * invocation duration for an overall summary. Without it, the duration is the
 * sum of the member tests, which is the correct value for a filtered scope.
 */
export declare function createSummary(tests: readonly TestRecord[], durationMs?: number): SummaryRecord;
export declare function createSuiteRecords(tests: readonly TestRecord[]): SuiteRecord[];
export declare function createModuleRecords(tests: readonly TestRecord[]): ModuleRecord[];
export declare function createSpecRecords(tests: readonly TestRecord[]): SpecRecord[];
export declare function createDerivedReport(tests: readonly TestRecord[], runDurationMs?: number): DerivedReport;
