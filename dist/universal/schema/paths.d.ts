/**
 * Path rules shared by adapters and the runtime validator.
 *
 * Canonical artifact paths are relative to the run root. Absolute paths,
 * drive-letter paths, "." segments, ".." segments, and NUL bytes are rejected
 * so a report cannot reference files outside its own run directory.
 */
export declare function isSafeRelativePath(value: string): boolean;
export declare function toRunRelativePath(value: string): string;
