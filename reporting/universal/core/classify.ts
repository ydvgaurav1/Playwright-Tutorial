import path from "node:path";

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

export const DEFAULT_CLASSIFIER_POLICY: ClassifierPolicy = Object.freeze({
  directSuites: Object.freeze(["sanity", "regression"]),
  suitePrefix: "suite:",
  modulePrefix: "module:",
  sourceRoot: "tests",
  specSuffixes: Object.freeze(["spec", "test"]),
});

export function normalizeClassification(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function classifySuites(
  labels: readonly string[],
  policy: Partial<ClassifierPolicy> = {},
): string[] {
  const resolved = resolvePolicy(policy);
  const directSuites = new Set(
    resolved.directSuites.map(normalizeClassification).filter(Boolean),
  );
  const suites = new Set<string>();

  for (const originalLabel of labels) {
    const label = originalLabel.trim().toLowerCase().replace(/^@/, "");
    if (directSuites.has(label)) suites.add(label);
    if (resolved.suitePrefix && label.startsWith(resolved.suitePrefix)) {
      const suite = normalizeClassification(
        label.slice(resolved.suitePrefix.length),
      );
      if (suite) suites.add(suite);
    }
  }

  return [...suites].sort();
}

export function classifyModule(
  labels: readonly string[],
  file: string,
  policy: Partial<ClassifierPolicy> = {},
): string {
  const resolved = resolvePolicy(policy);

  for (const originalLabel of labels) {
    const label = originalLabel.trim().toLowerCase().replace(/^@/, "");
    if (!resolved.modulePrefix || !label.startsWith(resolved.modulePrefix)) {
      continue;
    }
    const module = normalizeClassification(
      label.slice(resolved.modulePrefix.length),
    );
    if (module) return module;
  }

  const normalizedPath = file.replaceAll("\\", "/");
  const segments = normalizedPath.split("/").filter(Boolean);
  const sourceIndex = resolved.sourceRoot
    ? segments.lastIndexOf(resolved.sourceRoot)
    : -1;
  const sourceSegments = sourceIndex >= 0 ? segments.slice(sourceIndex + 1) : segments;

  if (sourceSegments.length > 1) {
    return normalizeClassification(sourceSegments[0]) || "unclassified";
  }

  const basename = basenameAsModule(normalizedPath, resolved);
  return normalizeClassification(basename) || "unclassified";
}

/** Exposed for adapters that need the same filename convention. */
export function basenameAsModule(
  file: string,
  policy: Partial<ClassifierPolicy> = {},
): string {
  const resolved = resolvePolicy(policy);
  const normalizedPath = file.replaceAll("\\", "/");
  let basename = path.posix.basename(normalizedPath);

  if (resolved.specSuffixes.length > 0) {
    const suffixes = resolved.specSuffixes
      .map((suffix) => escapeRegExp(suffix.replace(/^\./, "")))
      .filter(Boolean)
      .join("|");
    if (suffixes) {
      basename = basename.replace(
        new RegExp(`\\.(?:${suffixes})\\.[^.]+$`, "i"),
        "",
      );
    }
  }

  return basename.replace(/\.[^.]+$/i, "");
}

function resolvePolicy(
  policy: Partial<ClassifierPolicy>,
): ClassifierPolicy {
  return {
    directSuites: policy.directSuites ?? DEFAULT_CLASSIFIER_POLICY.directSuites,
    suitePrefix: normalizePrefix(
      policy.suitePrefix ?? DEFAULT_CLASSIFIER_POLICY.suitePrefix,
    ),
    modulePrefix: normalizePrefix(
      policy.modulePrefix ?? DEFAULT_CLASSIFIER_POLICY.modulePrefix,
    ),
    sourceRoot: (policy.sourceRoot ?? DEFAULT_CLASSIFIER_POLICY.sourceRoot).replace(
      /^\/+|\/+$/g,
      "",
    ),
    specSuffixes:
      policy.specSuffixes ?? DEFAULT_CLASSIFIER_POLICY.specSuffixes,
  };
}

function normalizePrefix(prefix: string): string {
  const trimmed = prefix.trim().toLowerCase();
  if (!trimmed) return "";
  return trimmed.endsWith(":") ? trimmed : `${trimmed}:`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
