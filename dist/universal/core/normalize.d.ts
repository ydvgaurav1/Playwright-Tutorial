import type { AttemptRecord, AttemptStatus, RunStatus, StepStatus, UniversalTestStatus } from "../schema/types";
export declare function normalizeTestStatus(value: unknown): UniversalTestStatus;
export declare function normalizeAttemptStatus(value: unknown): AttemptStatus;
export declare function normalizeRunStatus(value: unknown): RunStatus;
export declare function normalizeStepStatus(value: unknown): StepStatus;
/**
 * Derives a test-level status from attempts. A supplied status wins when it is
 * meaningful, because only the source framework knows its retry semantics.
 */
export declare function deriveTestStatus(attempts: readonly Pick<AttemptRecord, "status">[], reportedStatus?: unknown): UniversalTestStatus;
export declare function normalizeTimestamp(value: unknown, fallback?: string): string;
export declare function normalizeDurationMs(value: unknown, fallback?: number): number;
export declare function secondsToMilliseconds(value: unknown, fallbackMs?: number): number;
export declare function normalizeRetries(configured: unknown, attempts: readonly unknown[] | number): {
    configured: number;
    used: number;
};
/** Converts a legacy dashboard-relative path into a run-root-relative path. */
export declare function normalizeEvidencePath(value: string): string;
export type RedactionPolicy = {
    values?: readonly string[];
    patterns?: readonly RegExp[];
    replacement?: string;
};
/**
 * Defense-in-depth redaction for messages, stacks, step titles, and logs.
 * Adapters should call this before writing canonical results.
 */
export declare function redactText(value: string, policy?: RedactionPolicy): string;
