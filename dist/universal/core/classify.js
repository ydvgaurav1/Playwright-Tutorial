"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CLASSIFIER_POLICY = void 0;
exports.normalizeClassification = normalizeClassification;
exports.classifySuites = classifySuites;
exports.classifyModule = classifyModule;
exports.basenameAsModule = basenameAsModule;
const node_path_1 = __importDefault(require("node:path"));
exports.DEFAULT_CLASSIFIER_POLICY = Object.freeze({
    directSuites: Object.freeze(["sanity", "regression"]),
    suitePrefix: "suite:",
    modulePrefix: "module:",
    sourceRoot: "tests",
    specSuffixes: Object.freeze(["spec", "test"]),
});
function normalizeClassification(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/^@/, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}
function classifySuites(labels, policy = {}) {
    const resolved = resolvePolicy(policy);
    const directSuites = new Set(resolved.directSuites.map(normalizeClassification).filter(Boolean));
    const suites = new Set();
    for (const originalLabel of labels) {
        const label = originalLabel.trim().toLowerCase().replace(/^@/, "");
        if (directSuites.has(label))
            suites.add(label);
        if (resolved.suitePrefix && label.startsWith(resolved.suitePrefix)) {
            const suite = normalizeClassification(label.slice(resolved.suitePrefix.length));
            if (suite)
                suites.add(suite);
        }
    }
    return [...suites].sort();
}
function classifyModule(labels, file, policy = {}) {
    const resolved = resolvePolicy(policy);
    for (const originalLabel of labels) {
        const label = originalLabel.trim().toLowerCase().replace(/^@/, "");
        if (!resolved.modulePrefix || !label.startsWith(resolved.modulePrefix)) {
            continue;
        }
        const module = normalizeClassification(label.slice(resolved.modulePrefix.length));
        if (module)
            return module;
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
function basenameAsModule(file, policy = {}) {
    const resolved = resolvePolicy(policy);
    const normalizedPath = file.replaceAll("\\", "/");
    let basename = node_path_1.default.posix.basename(normalizedPath);
    if (resolved.specSuffixes.length > 0) {
        const suffixes = resolved.specSuffixes
            .map((suffix) => escapeRegExp(suffix.replace(/^\./, "")))
            .filter(Boolean)
            .join("|");
        if (suffixes) {
            basename = basename.replace(new RegExp(`\\.(?:${suffixes})\\.[^.]+$`, "i"), "");
        }
    }
    return basename.replace(/\.[^.]+$/i, "");
}
function resolvePolicy(policy) {
    return {
        directSuites: policy.directSuites ?? exports.DEFAULT_CLASSIFIER_POLICY.directSuites,
        suitePrefix: normalizePrefix(policy.suitePrefix ?? exports.DEFAULT_CLASSIFIER_POLICY.suitePrefix),
        modulePrefix: normalizePrefix(policy.modulePrefix ?? exports.DEFAULT_CLASSIFIER_POLICY.modulePrefix),
        sourceRoot: (policy.sourceRoot ?? exports.DEFAULT_CLASSIFIER_POLICY.sourceRoot).replace(/^\/+|\/+$/g, ""),
        specSuffixes: policy.specSuffixes ?? exports.DEFAULT_CLASSIFIER_POLICY.specSuffixes,
    };
}
function normalizePrefix(prefix) {
    const trimmed = prefix.trim().toLowerCase();
    if (!trimmed)
        return "";
    return trimmed.endsWith(":") ? trimmed : `${trimmed}:`;
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
