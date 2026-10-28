import { promises as fs } from "node:fs";
import path from "node:path";
import type { DashboardSettings } from "../../dashboard-template";
import type { ReportDocument } from "../../report-types";
import { UniversalReportWriter } from "../../universal/output/report-writer";
import { copyFileAtomic } from "../../universal/output/files";
import type { ExternalReportRecord, RunDocument } from "../../universal/schema/types";
import { assertValidRunDocument } from "../../universal/schema/validate";
import { convertJunitFiles } from "./convert";
import {
  attachManifestEvidence,
  loadJunitManifest,
} from "./manifest";
import { parseJunitXml } from "./parse";
import { JunitFormatError } from "./types";
import type { JunitConversionResult, JunitFile } from "./types";

export type JunitGenerateOptions = {
  /** JUnit XML files or directories containing XML files. */
  inputs: readonly string[];
  reportsRoot: string;
  timezone?: string;
  environment?: string;
  baseURL?: string;
  framework?: string;
  /** Optional explicit attachment manifest. */
  manifestPath?: string;
  /** Explicit run start when the XML has no timestamps. */
  startedAt?: string;
  /** Extra metadata recorded in extensions.junit. */
  metadata?: Record<string, string>;
  latestTitle?: string;
};

export type JunitGenerateResult = {
  runId: string;
  runDirectory: string;
  dashboardPath: string;
  document: RunDocument;
  report: ReportDocument;
  warnings: string[];
  sourceFiles: string[];
  copiedAttachments: number;
};

export const JUNIT_DASHBOARD_SETTINGS: DashboardSettings = {
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
export const MAX_JUNIT_XML_BYTES = 64 * 1024 * 1024;

/**
 * Generates a complete report from JUnit XML. The reserved run folder is the
 * only place written to; a failure removes the incomplete run folder and never
 * touches history or the latest redirect.
 */
export async function generateJunitReport(
  options: JunitGenerateOptions,
): Promise<JunitGenerateResult> {
  if (options.inputs.length === 0) {
    throw new JunitFormatError(
      "No JUnit XML input was provided. Pass one or more XML files or directories.",
    );
  }

  const timezone = options.timezone?.trim() || "Asia/Kolkata";
  const inputFiles = await resolveInputFiles(options.inputs);
  if (inputFiles.length === 0) {
    throw new JunitFormatError(
      `No JUnit XML files were found in: ${options.inputs.join(", ")}.`,
    );
  }

  const parsed: JunitFile[] = [];
  for (const file of inputFiles) {
    const stats = await fs.stat(file);
    if (stats.size > MAX_JUNIT_XML_BYTES) {
      throw new JunitFormatError(
        `JUnit XML "${file}" is ${formatBytes(stats.size)} and exceeds the ${formatBytes(MAX_JUNIT_XML_BYTES)} safety limit.`,
      );
    }
    const source = await fs.readFile(file, "utf8");
    parsed.push(parseJunitXml(source, file));
  }

  const fallbackStartedAt = await newestModificationTime(inputFiles);
  const conversion = convertJunitFiles(parsed, {
    framework: options.framework,
    environment: options.environment,
    timezone,
    baseURL: options.baseURL,
    startedAt: options.startedAt,
    fallbackStartedAt,
    metadata: options.metadata,
  });

  const writer = new UniversalReportWriter({
    reportsRoot: options.reportsRoot,
    timezone,
    latestTitle: options.latestTitle ?? "Latest JUnit report",
    dashboard: JUNIT_DASHBOARD_SETTINGS,
  });

  const startedAt = new Date(conversion.document.run.startedAt);
  const reserved = await writer.reserveRunDirectory(
    Number.isFinite(startedAt.getTime()) ? startedAt : new Date(),
  );

  try {
    const externalReports = await copySourceFiles(
      inputFiles,
      reserved.runDirectory,
    );
    const document = assertValidRunDocument({
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
      const manifest = await loadJunitManifest(options.manifestPath);
      const attached = await attachManifestEvidence(
        document,
        manifest,
        reserved.runDirectory,
      );
      finalDocument = assertValidRunDocument(attached.document);
      warnings.push(...attached.warnings);
      copiedAttachments = attached.copied;
    }

    const report = await writer.writeRun(reserved.runDirectory, finalDocument);

    return {
      runId: reserved.runId,
      runDirectory: reserved.runDirectory,
      dashboardPath: path.join(
        reserved.runDirectory,
        "dashboard",
        "index.html",
      ),
      document: finalDocument,
      report,
      warnings,
      sourceFiles: inputFiles,
      copiedAttachments,
    };
  } catch (error) {
    await fs
      .rm(reserved.runDirectory, { recursive: true, force: true })
      .catch(() => undefined);
    throw error;
  }
}

/** Expands files and directories into a stable, de-duplicated XML file list. */
async function resolveInputFiles(
  inputs: readonly string[],
): Promise<string[]> {
  const files = new Set<string>();

  for (const input of inputs) {
    const resolved = path.resolve(input);
    let stats;
    try {
      stats = await fs.stat(resolved);
    } catch (error) {
      throw new JunitFormatError(
        `JUnit input "${input}" could not be read: ${errorMessage(error)}`,
      );
    }

    if (stats.isDirectory()) {
      for (const file of await findXmlFiles(resolved)) files.add(file);
    } else if (stats.isFile()) {
      files.add(resolved);
    } else {
      throw new JunitFormatError(
        `JUnit input "${input}" is neither a file nor a directory.`,
      );
    }
  }

  return [...files].sort();
}

async function findXmlFiles(directory: string): Promise<string[]> {
  const found: string[] = [];
  const entries = await fs.readdir(directory, { withFileTypes: true });

  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await findXmlFiles(fullPath)));
    } else if (entry.isFile() && /\.xml$/i.test(entry.name)) {
      found.push(fullPath);
    }
  }

  return found;
}

async function copySourceFiles(
  files: readonly string[],
  runDirectory: string,
): Promise<ExternalReportRecord[]> {
  const destinationDirectory = path.join(runDirectory, "junit");
  await fs.mkdir(destinationDirectory, { recursive: true });
  const used = new Set<string>();
  const records: ExternalReportRecord[] = [];

  for (const file of files) {
    const relativePath = uniqueName(path.basename(file), used);
    await copyFileAtomic(file, path.join(destinationDirectory, relativePath));
    records.push({
      label: `JUnit XML: ${path.basename(file)}`,
      path: `junit/${relativePath}`,
      kind: "xml",
    });
  }

  return records;
}

function uniqueName(baseName: string, used: Set<string>): string {
  const extension = path.extname(baseName);
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

async function newestModificationTime(
  files: readonly string[],
): Promise<string | undefined> {
  let newest = 0;
  for (const file of files) {
    try {
      const stats = await fs.stat(file);
      newest = Math.max(newest, stats.mtimeMs);
    } catch {
      // The file was already read successfully; ignore a stat race.
    }
  }
  return newest > 0 ? new Date(newest).toISOString() : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}
