"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_EVIDENCE_PREVIEW_BYTES = void 0;
exports.prepareEvidenceForDashboard = prepareEvidenceForDashboard;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const paths_1 = require("../schema/paths");
exports.MAX_EVIDENCE_PREVIEW_BYTES = 128 * 1024;
/**
 * Resolves dashboard evidence against an immutable run directory. This is the
 * only stage that reads evidence content: the generated dashboard remains a
 * static, read-only document suitable for file:// use or static cloud hosting.
 */
async function prepareEvidenceForDashboard(report, runDirectory) {
    const prepared = structuredClone(report);
    const realRunDirectory = await node_fs_1.promises.realpath(runDirectory);
    await Promise.all(prepared.tests.flatMap((test) => test.attempts.flatMap((attempt) => attempt.artifacts.map(async (artifact) => {
        const next = await prepareArtifact(artifact, runDirectory, realRunDirectory);
        Object.assign(artifact, next);
    }))));
    return prepared;
}
async function prepareArtifact(artifact, runDirectory, realRunDirectory) {
    if (artifact.available === false) {
        return unavailable(artifact, artifact.unavailableReason ?? "Attachment is unavailable.");
    }
    const runRelativePath = safeRunRelativePath(artifact.path);
    if (!runRelativePath) {
        return unavailable(artifact, "Unsafe attachment path was blocked.");
    }
    const sourcePath = node_path_1.default.resolve(runDirectory, runRelativePath);
    let realSourcePath;
    let stats;
    try {
        [realSourcePath, stats] = await Promise.all([
            node_fs_1.promises.realpath(sourcePath),
            node_fs_1.promises.stat(sourcePath),
        ]);
    }
    catch {
        return unavailable(artifact, "Attachment was not found or could not be read.");
    }
    if (!stats.isFile()) {
        return unavailable(artifact, "Attachment is not a regular file.");
    }
    if (!isWithin(realRunDirectory, realSourcePath)) {
        return unavailable(artifact, "Attachment resolves outside the report run directory.");
    }
    const next = {
        ...artifact,
        filename: artifact.filename || node_path_1.default.basename(realSourcePath),
        bytes: stats.size,
        available: true,
    };
    delete next.unavailableReason;
    delete next.preview;
    const previewKind = previewKindFor(artifact.contentType);
    if (previewKind) {
        next.preview = await readPreview(realSourcePath, stats.size, previewKind);
    }
    return next;
}
function safeRunRelativePath(dashboardPath) {
    if (typeof dashboardPath !== "string" ||
        !dashboardPath.startsWith("../") ||
        dashboardPath.startsWith("../../") ||
        dashboardPath.includes("\\") ||
        dashboardPath.includes("%") ||
        dashboardPath.includes("?") ||
        dashboardPath.includes("#")) {
        return undefined;
    }
    const runRelativePath = dashboardPath.slice(3);
    return (0, paths_1.isSafeRelativePath)(runRelativePath) ? runRelativePath : undefined;
}
function isWithin(directory, target) {
    const relative = node_path_1.default.relative(directory, target);
    return (relative === "" ||
        (!relative.startsWith(`..${node_path_1.default.sep}`) &&
            relative !== ".." &&
            !node_path_1.default.isAbsolute(relative)));
}
function previewKindFor(contentType) {
    const mimeType = contentType.toLowerCase().split(";", 1)[0].trim();
    if (mimeType === "application/json" || mimeType.endsWith("+json")) {
        return "json";
    }
    if (mimeType.startsWith("text/"))
        return "text";
    return undefined;
}
async function readPreview(sourcePath, size, kind) {
    const bytesToRead = Math.min(size, exports.MAX_EVIDENCE_PREVIEW_BYTES);
    const buffer = Buffer.alloc(bytesToRead);
    const handle = await node_fs_1.promises.open(sourcePath, "r");
    let bytesRead = 0;
    try {
        ({ bytesRead } = await handle.read(buffer, 0, bytesToRead, 0));
    }
    finally {
        await handle.close();
    }
    const truncated = size > bytesRead;
    const raw = buffer.subarray(0, bytesRead).toString("utf8");
    let content = raw;
    if (kind === "json" && !truncated) {
        try {
            content = JSON.stringify(JSON.parse(raw), null, 2);
        }
        catch {
            // Invalid JSON is still safe to show as inert text.
        }
    }
    return { kind, content, truncated };
}
function unavailable(artifact, unavailableReason) {
    const next = {
        ...artifact,
        path: "",
        available: false,
        unavailableReason,
    };
    delete next.preview;
    return next;
}
