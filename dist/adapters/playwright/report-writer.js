"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaywrightReportWriter = exports.writeFileAtomic = exports.copyFileAtomic = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const files_1 = require("../../universal/output/files");
const report_writer_1 = require("../../universal/output/report-writer");
var files_2 = require("../../universal/output/files");
Object.defineProperty(exports, "copyFileAtomic", { enumerable: true, get: function () { return files_2.copyFileAtomic; } });
Object.defineProperty(exports, "writeFileAtomic", { enumerable: true, get: function () { return files_2.writeFileAtomic; } });
/**
 * Playwright-specific durable work: native-report copying and staging cleanup.
 * Run folders, canonical/legacy documents, dashboard, history, and the latest
 * redirect are owned by the shared UniversalReportWriter.
 */
class PlaywrightReportWriter {
    options;
    universal;
    constructor(options) {
        this.options = options;
        this.universal = new report_writer_1.UniversalReportWriter({
            reportsRoot: options.reportsRoot,
            timezone: options.timezone,
            latestTitle: "Latest Playwright report",
        });
    }
    async reserveRunDirectory(executionStartedAt) {
        return this.universal.reserveRunDirectory(executionStartedAt);
    }
    async copyNativeReport(runDirectory) {
        const source = this.options.playwrightReportDirectory;
        const destination = node_path_1.default.join(runDirectory, "playwright-report");
        try {
            await (0, files_1.copyDirectoryAtomic)(source, destination);
        }
        catch (error) {
            throw new Error(`Could not copy the native Playwright report from "${source}": ${errorMessage(error)}`, { cause: error });
        }
        return "playwright-report/index.html";
    }
    async writeRun(runDirectory, document) {
        return this.universal.writeRun(runDirectory, document);
    }
    async cleanupStaging() {
        try {
            await node_fs_1.promises.rm(this.options.stagingDirectory, {
                recursive: true,
                force: true,
            });
        }
        catch (error) {
            console.warn(`[playwright-universal-reporter] Could not remove staging directory "${this.options.stagingDirectory}": ${errorMessage(error)}`);
        }
    }
}
exports.PlaywrightReportWriter = PlaywrightReportWriter;
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
