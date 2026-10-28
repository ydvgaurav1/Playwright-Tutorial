import { createHash } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { redactText } from "../../universal/core/normalize";
import { copyFileAtomic } from "../../universal/output/files";
import type {
  EvidenceKind,
  EvidenceRecord,
  LogRecord,
  RunDocument,
  TestRecord,
} from "../../universal/schema/types";

/**
 * A small, explicit attachment manifest. JUnit XML has no standard evidence
 * links, so evidence is copied only when a manifest names the test and file.
 *
 * Paths are resolved relative to the manifest file. A test is selected by one
 * of: testId, nativeId, or classname + testName (+ optional suite). Unknown and
 * ambiguous selectors are hard errors so evidence is never attached to the
 * wrong test.
 */
export type JunitManifestAttachment = {
  testId?: string;
  nativeId?: string;
  classname?: string;
  testName?: string;
  suite?: string;
  kind: EvidenceKind;
  path: string;
  name?: string;
  mimeType?: string;
  format?: string;
};

export type JunitManifest = {
  version: 1;
  /** Absolute path of the manifest file. */
  file: string;
  /** Directory used to resolve relative evidence paths. */
  directory: string;
  attachments: JunitManifestAttachment[];
};

export type ManifestAttachmentResult = {
  document: RunDocument;
  warnings: string[];
  copied: number;
  externalReport?: {
    label: string;
    path: string;
    kind: "json";
  };
};

export class JunitManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JunitManifestError";
  }
}

const EVIDENCE_KINDS: readonly EvidenceKind[] = [
  "screenshot",
  "video",
  "trace",
  "log",
  "file",
  "native-report",
];

/** Log files larger than this are truncated so a run cannot be bloated. */
const MAX_LOG_BYTES = 256 * 1024;
const REDACTION = {
  patterns: [
    /(?<=(?:password|passwd|pwd|token|secret|api[_-]?key)\s*[:=]\s*)[^\s,;]+/gi,
  ],
};

export async function loadJunitManifest(
  manifestPath: string,
): Promise<JunitManifest> {
  const file = path.resolve(manifestPath);
  let source: string;

  try {
    source = await fs.readFile(file, "utf8");
  } catch (error) {
    throw new JunitManifestError(
      `Could not read the attachment manifest "${file}": ${errorMessage(error)}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new JunitManifestError(
      `The attachment manifest "${file}" is not valid JSON: ${errorMessage(error)}`,
    );
  }

  if (!isRecord(parsed)) {
    throw new JunitManifestError(
      `The attachment manifest "${file}" must contain a JSON object.`,
    );
  }
  if (parsed.version !== undefined && parsed.version !== 1) {
    throw new JunitManifestError(
      `Unsupported attachment manifest version "${String(parsed.version)}" in "${file}"; expected 1.`,
    );
  }

  const rawAttachments = parsed.attachments ?? parsed.evidence;
  if (!Array.isArray(rawAttachments)) {
    throw new JunitManifestError(
      `The attachment manifest "${file}" must contain an "attachments" array.`,
    );
  }

  const attachments = rawAttachments.map((entry, index) =>
    validateAttachment(entry, index, file),
  );

  return {
    version: 1,
    file,
    directory: path.dirname(file),
    attachments,
  };
}

/**
 * Copies every manifest attachment into the reserved run folder and attaches
 * it to the matching canonical test. Returns a new document; the input is not
 * mutated so a failed attachment pass cannot corrupt an already validated one.
 */
export async function attachManifestEvidence(
  document: RunDocument,
  manifest: JunitManifest,
  runDirectory: string,
): Promise<ManifestAttachmentResult> {
  const next = structuredClone(document) as RunDocument;
  const warnings: string[] = [];
  const usedDestinations = new Set<string>();
  const traceFormats = new Set(next.capabilities.traceFormats);
  let copied = 0;

  for (const attachment of manifest.attachments) {
    const matches = findMatches(next.tests, attachment, manifest.file);
    if (matches.length === 0) {
      throw new JunitManifestError(
        `Attachment "${attachment.path}" in "${manifest.file}" does not match any test (${describeSelector(attachment)}).`,
      );
    }
    if (matches.length > 1) {
      throw new JunitManifestError(
        `Attachment "${attachment.path}" in "${manifest.file}" is ambiguous: ${describeSelector(attachment)} matches ${matches.length} tests (${matches
          .map((test) => test.id)
          .join(", ")}). Add testId, nativeId, or a suite to disambiguate.`,
      );
    }

    const test = matches[0];
    const sourcePath = resolveAttachmentSource(manifest, attachment);

    let stats;
    try {
      stats = await fs.stat(sourcePath);
    } catch (error) {
      throw new JunitManifestError(
        `Attachment "${attachment.path}" for test "${test.id}" was not found at "${sourcePath}": ${errorMessage(error)}`,
      );
    }
    if (!stats.isFile()) {
      throw new JunitManifestError(
        `Attachment "${attachment.path}" for test "${test.id}" is not a file: "${sourcePath}".`,
      );
    }

    // A symlink inside the manifest directory must not escape it either.
    const realDirectory = await fs.realpath(manifest.directory);
    const realSource = await fs.realpath(sourcePath);
    if (!isWithin(realDirectory, realSource)) {
      throw new JunitManifestError(
        `Attachment "${attachment.path}" for test "${test.id}" resolves outside the manifest directory "${manifest.directory}".`,
      );
    }

    const relativePath = uniqueDestination(
      test.id,
      attachment.path,
      usedDestinations,
    );
    const destination = path.join(runDirectory, relativePath);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await copyFileAtomic(sourcePath, destination);

    const evidence: EvidenceRecord = {
      kind: attachment.kind,
      name: attachment.name?.trim() || path.basename(sourcePath),
      path: relativePath,
      mimeType: attachment.mimeType?.trim() || mimeTypeFor(sourcePath),
      bytes: stats.size,
      sha256: await sha256(sourcePath),
    };
    if (attachment.format?.trim()) {
      evidence.format = attachment.format.trim();
    }
    if (attachment.kind === "trace") {
      traceFormats.add(evidence.format ?? "zip");
    }

    const attempt = test.attempts[0];
    if (!attempt) {
      throw new JunitManifestError(
        `Test "${test.id}" has no attempt to attach "${attachment.path}" to.`,
      );
    }
    attempt.evidence.push(evidence);

    if (attachment.kind === "log") {
      const log = await readLog(sourcePath, attempt.startedAt, stats.size);
      if (log) attempt.logs.push(log);
      else {
        warnings.push(
          `Attachment "${attachment.path}" for test "${test.id}" is empty; no log record was added.`,
        );
      }
    }

    copied += 1;
  }

  if (copied > 0) {
    next.capabilities.attachments = true;
    next.capabilities.logs =
      next.capabilities.logs ||
      next.tests.some((test) =>
        test.attempts.some((attempt) => attempt.logs.length > 0),
      );
    next.capabilities.traceFormats = [...traceFormats].sort();
  }

  const externalReport = await copyManifestFile(manifest, runDirectory);
  if (externalReport) next.externalReports = [
    ...(next.externalReports ?? []),
    externalReport,
  ];

  return { document: next, warnings, copied, externalReport };
}

async function copyManifestFile(
  manifest: JunitManifest,
  runDirectory: string,
): Promise<ManifestAttachmentResult["externalReport"]> {
  const destination = "junit-manifest.json";
  await copyFileAtomic(manifest.file, path.join(runDirectory, destination));
  return {
    label: "JUnit attachment manifest",
    path: destination,
    kind: "json",
  };
}

function findMatches(
  tests: readonly TestRecord[],
  attachment: JunitManifestAttachment,
  manifestFile: string,
): TestRecord[] {
  if (attachment.testId) {
    return tests.filter((test) => test.id === attachment.testId);
  }
  if (attachment.nativeId) {
    return tests.filter((test) => test.nativeId === attachment.nativeId);
  }

  const classname = attachment.classname?.trim();
  const testName = attachment.testName?.trim();
  if (!classname || !testName) {
    throw new JunitManifestError(
      `Attachment "${attachment.path}" in "${manifestFile}" needs testId, nativeId, or both classname and testName.`,
    );
  }
  const suite = attachment.suite?.trim();

  return tests.filter((test) => {
    const junit = junitExtension(test);
    if (junit.classname !== classname) return false;
    if (test.title !== testName) return false;
    if (!suite) return true;
    return (
      test.suites.includes(suite) ||
      junit.suitePath.includes(suite) ||
      junit.suitePath.at(-1) === suite
    );
  });
}

function junitExtension(test: TestRecord): {
  classname?: string;
  suitePath: string[];
} {
  const value = test.extensions?.junit;
  if (!isRecord(value)) return { suitePath: [] };
  return {
    classname:
      typeof value.classname === "string" ? value.classname : undefined,
    suitePath: Array.isArray(value.suitePath)
      ? value.suitePath.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
  };
}

function describeSelector(attachment: JunitManifestAttachment): string {
  if (attachment.testId) return `testId=${attachment.testId}`;
  if (attachment.nativeId) return `nativeId=${attachment.nativeId}`;
  return [
    `classname=${attachment.classname ?? ""}`,
    `testName=${attachment.testName ?? ""}`,
    attachment.suite ? `suite=${attachment.suite}` : undefined,
  ]
    .filter(Boolean)
    .join(", ");
}

function resolveAttachmentSource(
  manifest: JunitManifest,
  attachment: JunitManifestAttachment,
): string {
  if (attachment.path.includes("\0")) {
    throw new JunitManifestError(
      `Attachment "${attachment.path}" contains a NUL byte.`,
    );
  }
  if (path.isAbsolute(attachment.path)) {
    throw new JunitManifestError(
      `Attachment "${attachment.path}" must be relative to the manifest directory "${manifest.directory}".`,
    );
  }

  const resolved = path.resolve(manifest.directory, attachment.path);
  if (!isWithin(manifest.directory, resolved)) {
    throw new JunitManifestError(
      `Attachment "${attachment.path}" escapes the manifest directory "${manifest.directory}".`,
    );
  }
  return resolved;
}

function isWithin(directory: string, target: string): boolean {
  const relative = path.relative(directory, target);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}

function uniqueDestination(
  testId: string,
  sourcePath: string,
  used: Set<string>,
): string {  const safeTestId = sanitizeSegment(testId);
  const baseName = sanitizeSegment(path.basename(sourcePath));
  const extension = path.extname(baseName);
  const stem = extension ? baseName.slice(0, -extension.length) : baseName;
  let candidate = `attachments/${safeTestId}/${baseName}`;
  let counter = 2;

  while (used.has(candidate)) {
    candidate = `attachments/${safeTestId}/${stem}-${counter}${extension}`;
    counter += 1;
  }
  used.add(candidate);
  return candidate;
}

function sanitizeSegment(value: string): string {
  const sanitized = value
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[.-]+/, "")
    .replace(/[.-]+$/, "");
  return sanitized || "attachment";
}

async function readLog(
  sourcePath: string,
  timestamp: string,
  size: number,
): Promise<LogRecord | undefined> {
  if (size === 0) return undefined;

  const length = Math.min(size, MAX_LOG_BYTES);
  const handle = await fs.open(sourcePath, "r");
  let bytesRead: number;
  let buffer: Buffer;
  try {
    buffer = Buffer.alloc(length);
    ({ bytesRead } = await handle.read(buffer, 0, length, 0));
  } finally {
    await handle.close();
  }

  const text = buffer.subarray(0, bytesRead).toString("utf8");
  if (!text) return undefined;
  const stream = /\.err(?:or)?$/i.test(sourcePath) ? "stderr" : "stdout";
  const log: LogRecord = {
    stream,
    timestamp,
    text: redactText(text, REDACTION),
  };
  if (size > MAX_LOG_BYTES) log.truncated = true;
  return log;
}

async function sha256(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk as Buffer);
  }
  return hash.digest("hex");
}

function mimeTypeFor(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".mp4":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    case ".zip":
      return "application/zip";
    case ".txt":
    case ".log":
      return "text/plain";
    case ".json":
      return "application/json";
    case ".xml":
      return "application/xml";
    case ".html":
      return "text/html";
    default:
      return "application/octet-stream";
  }
}

function validateAttachment(
  value: unknown,
  index: number,
  manifestFile: string,
): JunitManifestAttachment {
  if (!isRecord(value)) {
    throw new JunitManifestError(
      `Attachment #${index + 1} in "${manifestFile}" must be an object.`,
    );
  }

  const kind = typeof value.kind === "string" ? value.kind : "file";
  if (!EVIDENCE_KINDS.includes(kind as EvidenceKind)) {
    throw new JunitManifestError(
      `Attachment #${index + 1} in "${manifestFile}" has an unsupported kind "${kind}". Expected one of: ${EVIDENCE_KINDS.join(", ")}.`,
    );
  }

  const attachmentPath = value.path;
  if (typeof attachmentPath !== "string" || attachmentPath.trim() === "") {
    throw new JunitManifestError(
      `Attachment #${index + 1} in "${manifestFile}" must have a non-empty "path".`,
    );
  }

  const attachment: JunitManifestAttachment = {
    kind: kind as EvidenceKind,
    path: attachmentPath.trim(),
  };
  for (const key of [
    "testId",
    "nativeId",
    "classname",
    "testName",
    "suite",
    "name",
    "mimeType",
    "format",
  ] as const) {
    const item = value[key];
    if (item === undefined) continue;
    if (typeof item !== "string") {
      throw new JunitManifestError(
        `Attachment #${index + 1} in "${manifestFile}" has a non-string "${key}".`,
      );
    }
    if (item.trim() !== "") attachment[key] = item.trim();
  }

  if (Boolean(attachment.classname) !== Boolean(attachment.testName)) {
    throw new JunitManifestError(
      `Attachment #${index + 1} in "${manifestFile}" must provide classname and testName together.`,
    );
  }

  const hasSelector =
    Boolean(attachment.testId) ||
    Boolean(attachment.nativeId) ||
    (Boolean(attachment.classname) && Boolean(attachment.testName));
  if (!hasSelector) {
    throw new JunitManifestError(
      `Attachment #${index + 1} in "${manifestFile}" must select a test by testId, nativeId, or classname + testName.`,
    );
  }

  return attachment;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
