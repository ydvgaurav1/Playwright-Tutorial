"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UniversalReportWriter = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const dashboard_template_1 = require("../../dashboard-template");
const validate_1 = require("../schema/validate");
const evidence_1 = require("./evidence");
const files_1 = require("./files");
const legacy_projection_1 = require("./legacy-projection");
/**
 * Writes the durable shape shared by every adapter: a reserved run folder,
 * canonical run.json, schema-v2 results.json, the existing dashboard, history,
 * and the latest redirect.
 *
 * The dashboard is written before results.json. That way a failed dashboard
 * write can never leave a completed run in history with a missing dashboard.
 * The current run is added to the dashboard history in memory, so the rendered
 * content is the same as reading it back from disk.
 */
class UniversalReportWriter {
    options;
    constructor(options) {
        this.options = options;
    }
    async reserveRunDirectory(executionStartedAt) {
        await node_fs_1.promises.mkdir(this.options.reportsRoot, { recursive: true });
        let folderTime = executionStartedAt;
        while (true) {
            const runId = this.timestampInTimezone(folderTime);
            const runDirectory = node_path_1.default.join(this.options.reportsRoot, runId);
            try {
                await node_fs_1.promises.mkdir(runDirectory);
                for (const directory of [
                    "dashboard",
                    "screenshots",
                    "videos",
                    "traces",
                ]) {
                    await node_fs_1.promises.mkdir(node_path_1.default.join(runDirectory, directory));
                }
                return { runId, runDirectory };
            }
            catch (error) {
                const code = error.code;
                if (code !== "EEXIST")
                    throw error;
                folderTime = new Date(folderTime.getTime() + 60_000);
            }
        }
    }
    async writeRun(runDirectory, document, overrides = {}) {
        const report = await (0, evidence_1.prepareEvidenceForDashboard)((0, legacy_projection_1.toLegacyReport)(document), runDirectory);
        const history = await this.loadHistory(report.run.id);
        history.push(toHistoryRecord(report));
        history.sort((left, right) => left.startTime.localeCompare(right.startTime));
        await (0, files_1.writeFileAtomic)(node_path_1.default.join(runDirectory, "run.json"), (0, validate_1.stringifyRunDocument)(document));
        const dashboard = { ...report, history };
        const dashboardSettings = {
            ...this.options.dashboard,
            ...overrides.dashboard,
        };
        await (0, files_1.writeFileAtomic)(node_path_1.default.join(runDirectory, "dashboard", "index.html"), (0, dashboard_template_1.createDashboard)(dashboard, dashboardSettings));
        await (0, files_1.writeFileAtomic)(node_path_1.default.join(runDirectory, "results.json"), JSON.stringify(report, null, 2));
        await this.updateLatestRedirect(report.run.id, overrides.latestTitle ?? this.options.latestTitle ?? "Latest report");
        return report;
    }
    async loadHistory(excludedRunId) {
        const entries = await node_fs_1.promises.readdir(this.options.reportsRoot, {
            withFileTypes: true,
        });
        const history = [];
        for (const entry of entries) {
            if (!entry.isDirectory() ||
                entry.name === "latest" ||
                entry.name === ".current" ||
                entry.name === excludedRunId) {
                continue;
            }
            try {
                const content = await node_fs_1.promises.readFile(node_path_1.default.join(this.options.reportsRoot, entry.name, "results.json"), "utf8");
                const previous = JSON.parse(content);
                history.push({
                    runId: previous.run.id,
                    startTime: previous.run.startTime,
                    endTime: previous.run.endTime,
                    environment: previous.metadata.environment,
                    browsers: previous.metadata.browsers ?? [],
                    projects: previous.metadata.projects ?? previous.metadata.browsers ?? [],
                    suites: previous.suites ?? [],
                    summary: previous.summary,
                    failedTestIds: (previous.tests ?? [])
                        .filter(({ status }) => status === "failed")
                        .map(({ id }) => id),
                    dashboardPath: `../../${previous.run.id}/dashboard/index.html`,
                });
            }
            catch {
                // Incomplete runs have no valid results.json and are intentionally omitted.
            }
        }
        return history.sort((left, right) => left.startTime.localeCompare(right.startTime));
    }
    async updateLatestRedirect(runId, title) {
        const latestDirectory = node_path_1.default.join(this.options.reportsRoot, "latest");
        await node_fs_1.promises.mkdir(latestDirectory, { recursive: true });
        const dashboardPath = `../${runId}/dashboard/index.html`;
        const redirect = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="refresh" content="0; url=${dashboardPath}">
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <p>Opening the latest completed report. <a href="${dashboardPath}">Continue manually</a>.</p>
  </body>
</html>`;
        await (0, files_1.writeFileAtomic)(node_path_1.default.join(latestDirectory, "index.html"), redirect);
    }
    timestampInTimezone(date) {
        const formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: this.options.timezone,
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        });
        const parts = Object.fromEntries(formatter
            .formatToParts(date)
            .filter(({ type }) => type !== "literal")
            .map(({ type, value }) => [type, value]));
        return `${parts.day}-${parts.month}-${parts.year}_${parts.hour}-${parts.minute}-${parts.dayPeriod}`;
    }
}
exports.UniversalReportWriter = UniversalReportWriter;
function toHistoryRecord(report) {
    return {
        runId: report.run.id,
        startTime: report.run.startTime,
        endTime: report.run.endTime,
        environment: report.metadata.environment,
        browsers: report.metadata.browsers,
        projects: report.metadata.projects,
        suites: report.suites,
        summary: report.summary,
        failedTestIds: report.tests
            .filter(({ status }) => status === "failed")
            .map(({ id }) => id),
        dashboardPath: `../../${report.run.id}/dashboard/index.html`,
    };
}
function escapeHtml(value) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
