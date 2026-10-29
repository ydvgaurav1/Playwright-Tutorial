"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_JUNIT_XML_BYTES = exports.JUNIT_DASHBOARD_SETTINGS = void 0;
exports.generateJunitReport = generateJunitReport;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const report_writer_1 = require("../../universal/output/report-writer");
const files_1 = require("../../universal/output/files");
const validate_1 = require("../../universal/schema/validate");
const convert_1 = require("./convert");
const manifest_1 = require("./manifest");
const parse_1 = require("./parse");
const types_1 = require("./types");
exports.JUNIT_DASHBOARD_SETTINGS = {
    title: "JUnit Execution Dashboard",
    eyebrow: "JUnit execution intelligence",
    reportHref: null,
    traceViewerHref: null,
    traceHelp: "Open this trace file with your framework's trace viewer.",
    timezone: "Asia/Kolkata",
    timezoneLabel: "IST",
    timezoneOffset: "UTC+05:30",
    timestampsLabel: "timestamps",
    runtimeLabel: "Runtime",
    variantColumnLabel: "Suite / Class",
};
/** Per-file safety limit. JUnit reports are read fully into memory. */
exports.MAX_JUNIT_XML_BYTES = 64 * 1024 * 1024;
/**
 * Generates a complete report from JUnit XML. The reserved run folder is the
 * only place written to; a failure removes the incomplete run folder and never
 * touches history or the latest redirect.
 */
async function generateJunitReport(options) {
    if (options.inputs.length === 0) {
        throw new types_1.JunitFormatError("No JUnit XML input was provided. Pass one or more XML files or directories.");
    }
    const timezone = options.timezone?.trim() || "Asia/Kolkata";
    const inputFiles = await resolveInputFiles(options.inputs);
    if (inputFiles.length === 0) {
        throw new types_1.JunitFormatError(`No JUnit XML files were found in: ${options.inputs.join(", ")}.`);
    }
    const parsed = [];
    for (const file of inputFiles) {
        const stats = await node_fs_1.promises.stat(file);
        if (stats.size > exports.MAX_JUNIT_XML_BYTES) {
            throw new types_1.JunitFormatError(`JUnit XML "${file}" is ${formatBytes(stats.size)} and exceeds the ${formatBytes(exports.MAX_JUNIT_XML_BYTES)} safety limit.`);
        }
        const source = await node_fs_1.promises.readFile(file, "utf8");
        parsed.push((0, parse_1.parseJunitXml)(source, file));
    }
    const fallbackStartedAt = await newestModificationTime(inputFiles);
    const conversion = (0, convert_1.convertJunitFiles)(parsed, {
        framework: options.framework,
        environment: options.environment,
        timezone,
        baseURL: options.baseURL,
        startedAt: options.startedAt,
        fallbackStartedAt,
        metadata: options.metadata,
    });
    const writer = new report_writer_1.UniversalReportWriter({
        reportsRoot: options.reportsRoot,
        timezone,
        latestTitle: options.latestTitle ?? "Latest JUnit report",
        dashboard: exports.JUNIT_DASHBOARD_SETTINGS,
    });
    const startedAt = new Date(conversion.document.run.startedAt);
    const reserved = await writer.reserveRunDirectory(Number.isFinite(startedAt.getTime()) ? startedAt : new Date());
    try {
        const externalReports = await copySourceFiles(inputFiles, reserved.runDirectory);
        const document = (0, validate_1.assertValidRunDocument)({
            ...conversion.document,
            run: { ...conversion.document.run, id: reserved.runId },
            externalReports: [
                ...(conversion.document.externalReports ?? []),
                ...externalReports,
            ],
        });
        let finalDocument = document;
        const warnings = [...conversion.warnings];
        let copiedAttachments = 0;
        if (options.manifestPath) {
            const manifest = await (0, manifest_1.loadJunitManifest)(options.manifestPath);
            const attached = await (0, manifest_1.attachManifestEvidence)(document, manifest, reserved.runDirectory);
            finalDocument = (0, validate_1.assertValidRunDocument)(attached.document);
            warnings.push(...attached.warnings);
            copiedAttachments = attached.copied;
        }
        const report = await writer.writeRun(reserved.runDirectory, finalDocument);
        return {
            runId: reserved.runId,
            runDirectory: reserved.runDirectory,
            dashboardPath: node_path_1.default.join(reserved.runDirectory, "dashboard", "index.html"),
            document: finalDocument,
            report,
            warnings,
            sourceFiles: inputFiles,
            copiedAttachments,
        };
    }
    catch (error) {
        await node_fs_1.promises
            .rm(reserved.runDirectory, { recursive: true, force: true })
            .catch(() => undefined);
        throw error;
    }
}
/** Expands files and directories into a stable, de-duplicated XML file list. */
async function resolveInputFiles(inputs) {
    const files = new Set();
    for (const input of inputs) {
        const resolved = node_path_1.default.resolve(input);
        let stats;
        try {
            stats = await node_fs_1.promises.stat(resolved);
        }
        catch (error) {
            throw new types_1.JunitFormatError(`JUnit input "${input}" could not be read: ${errorMessage(error)}`);
        }
        if (stats.isDirectory()) {
            for (const file of await findXmlFiles(resolved))
                files.add(file);
        }
        else if (stats.isFile()) {
            files.add(resolved);
        }
        else {
            throw new types_1.JunitFormatError(`JUnit input "${input}" is neither a file nor a directory.`);
        }
    }
    return [...files].sort();
}
async function findXmlFiles(directory) {
    const found = [];
    const entries = await node_fs_1.promises.readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
        const fullPath = node_path_1.default.join(directory, entry.name);
        if (entry.isDirectory()) {
            found.push(...(await findXmlFiles(fullPath)));
        }
        else if (entry.isFile() && /\.xml$/i.test(entry.name)) {
            found.push(fullPath);
        }
    }
    return found;
}
async function copySourceFiles(files, runDirectory) {
    const destinationDirectory = node_path_1.default.join(runDirectory, "junit");
    await node_fs_1.promises.mkdir(destinationDirectory, { recursive: true });
    const used = new Set();
    const records = [];
    for (const file of files) {
        const relativePath = uniqueName(node_path_1.default.basename(file), used);
        await (0, files_1.copyFileAtomic)(file, node_path_1.default.join(destinationDirectory, relativePath));
        records.push({
            label: `JUnit XML: ${node_path_1.default.basename(file)}`,
            path: `junit/${relativePath}`,
            kind: "xml",
        });
    }
    return records;
}
function uniqueName(baseName, used) {
    const extension = node_path_1.default.extname(baseName);
    const stem = extension ? baseName.slice(0, -extension.length) : baseName;
    let candidate = baseName;
    let counter = 2;
    while (used.has(candidate)) {
        candidate = `${stem}-${counter}${extension}`;
        counter += 1;
    }
    used.add(candidate);
    return candidate;
}
async function newestModificationTime(files) {
    let newest = 0;
    for (const file of files) {
        try {
            const stats = await node_fs_1.promises.stat(file);
            newest = Math.max(newest, stats.mtimeMs);
        }
        catch {
            // The file was already read successfully; ignore a stat race.
        }
    }
    return newest > 0 ? new Date(newest).toISOString() : undefined;
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function formatBytes(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KiB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}
