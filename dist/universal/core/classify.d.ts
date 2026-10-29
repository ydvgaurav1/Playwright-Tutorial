/**
 * Classification is policy-driven so a Playwright project, a JUnit project,
 * or a future adapter can keep its own conventions without forking the core.
 */
export type ClassifierPolicy = {
    /** Tags that map directly to a suite, e.g. ["sanity", "regression"]. */
    directSuites: readonly string[];
    /** Prefix for additional suites, e.g. "suite:". */
    suitePrefix: string;
    /** Prefix for the functional module, e.g. "module:". */
    modulePrefix: string;
    /** Directory whose children become module fallbacks, e.g. "tests". */
    sourceRoot: string;
    /** Filename suffixes stripped before using the basename as a module. */
    specSuffixes: readonly string[];
};
export declare const DEFAULT_CLASSIFIER_POLICY: ClassifierPolicy;
export declare function normalizeClassification(value: string): string;
export declare function classifySuites(labels: readonly string[], policy?: Partial<ClassifierPolicy>): string[];
export declare function classifyModule(labels: readonly string[], file: string, policy?: Partial<ClassifierPolicy>): string;
/** Exposed for adapters that need the same filename convention. */
export declare function basenameAsModule(file: string, policy?: Partial<ClassifierPolicy>): string;
