import type { RunDocument } from "./types";
export type ValidationIssue = {
    path: string;
    message: string;
};
export type ValidationResult = {
    ok: true;
    value: RunDocument;
} | {
    ok: false;
    issues: ValidationIssue[];
};
export declare class SchemaValidationError extends Error {
    readonly issues: ValidationIssue[];
    constructor(issues: ValidationIssue[]);
}
export declare function validateRunDocument(value: unknown): ValidationResult;
export declare function assertValidRunDocument(value: unknown): RunDocument;
export declare function parseRunDocument(json: string): RunDocument;
export declare function stringifyRunDocument(value: unknown): string;
export declare function isRunDocument(value: unknown): value is RunDocument;
