import { promises as fs } from "node:fs";
import path from "node:path";
import type { ArtifactRecord, ReportDocument } from "../../report-types";
import { isSafeRelativePath } from "../schema/paths";

export const MAX_EVIDENCE_PREVIEW_BYTES = 128 * 1024;

/**
 * Resolves dashboard evidence against an immutable run directory. This is the
 * only stage that reads evidence content: the generated dashboard remains a
 * static, read-only document suitable for file:// use or static cloud hosting.
 */
export async function prepareEvidenceForDashboard(
  report: ReportDocument,
  runDirectory: string,
): Promise<ReportDocument> {
  const prepared = structuredClone(report) as ReportDocument;
  const realRunDirectory = await fs.realpath(runDirectory);

  await Promise.all(
    prepared.tests.flatMap((test) =>
      test.attempts.flatMap((attempt) =>
        attempt.artifacts.map(async (artifact) => {
          const next = await prepareArtifact(
            artifact,
            runDirectory,
            realRunDirectory,
          );
          Object.assign(artifact, next);
        }),
      ),
    ),
  );

  return prepared;
}

async function prepareArtifact(
  artifact: ArtifactRecord,
  runDirectory: string,
  realRunDirectory: string,
): Promise<ArtifactRecord> {
  if (artifact.available === false) {
    return unavailable(
      artifact,
      artifact.unavailableReason ?? "Attachment is unavailable.",
    );
  }

  const runRelativePath = safeRunRelativePath(artifact.path);
  if (!runRelativePath) {
    return unavailable(artifact, "Unsafe attachment path was blocked.");
  }

  const sourcePath = path.resolve(runDirectory, runRelativePath);
  let realSourcePath: string;
  let stats;
  try {
    [realSourcePath, stats] = await Promise.all([
      fs.realpath(sourcePath),
      fs.stat(sourcePath),
    ]);
  } catch {
    return unavailable(artifact, "Attachment was not found or could not be read.");
  }

  if (!stats.isFile()) {
    return unavailable(artifact, "Attachment is not a regular file.");
  }
  if (!isWithin(realRunDirectory, realSourcePath)) {
    return unavailable(artifact, "Attachment resolves outside the report run directory.");
  }

  const next: ArtifactRecord = {
    ...artifact,
    filename: artifact.filename || path.basename(realSourcePath),
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

function safeRunRelativePath(dashboardPath: string): string | undefined {
  if (
    typeof dashboardPath !== "string" ||
    !dashboardPath.startsWith("../") ||
    dashboardPath.startsWith("../../") ||
    dashboardPath.includes("\\") ||
    dashboardPath.includes("%") ||
    dashboardPath.includes("?") ||
    dashboardPath.includes("#")
  ) {
    return undefined;
  }

  const runRelativePath = dashboardPath.slice(3);
  return isSafeRelativePath(runRelativePath) ? runRelativePath : undefined;
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

function previewKindFor(
  contentType: string,
): "json" | "text" | undefined {
  const mimeType = contentType.toLowerCase().split(";", 1)[0].trim();
  if (mimeType === "application/json" || mimeType.endsWith("+json")) {
    return "json";
  }
  if (mimeType.startsWith("text/")) return "text";
  return undefined;
}

async function readPreview(
  sourcePath: string,
  size: number,
  kind: "json" | "text",
): Promise<NonNullable<ArtifactRecord["preview"]>> {
  const bytesToRead = Math.min(size, MAX_EVIDENCE_PREVIEW_BYTES);
  const buffer = Buffer.alloc(bytesToRead);
  const handle = await fs.open(sourcePath, "r");
  let bytesRead = 0;
  try {
    ({ bytesRead } = await handle.read(buffer, 0, bytesToRead, 0));
  } finally {
    await handle.close();
  }

  const truncated = size > bytesRead;
  const raw = buffer.subarray(0, bytesRead).toString("utf8");
  let content = raw;
  if (kind === "json" && !truncated) {
    try {
      content = JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      // Invalid JSON is still safe to show as inert text.
    }
  }
  return { kind, content, truncated };
}

function unavailable(
  artifact: ArtifactRecord,
  unavailableReason: string,
): ArtifactRecord {
  const next: ArtifactRecord = {
    ...artifact,
    path: "",
    available: false,
    unavailableReason,
  };
  delete next.preview;
  return next;
}
