import { promises as fs } from "node:fs";

/**
 * Small filesystem primitives shared by report adapters.
 *
 * Writes are atomic inside the destination directory: a temporary sibling is
 * written first and then renamed. A failed write never truncates an existing
 * completed report file.
 */
export async function writeFileAtomic(
  filePath: string,
  contents: string | Uint8Array,
): Promise<void> {
  const temporaryPath = temporaryPathFor(filePath);

  try {
    await fs.writeFile(temporaryPath, contents);
    await fs.rename(temporaryPath, filePath);
  } finally {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}

export async function copyFileAtomic(
  source: string,
  destination: string,
): Promise<void> {
  const temporaryPath = temporaryPathFor(destination);

  try {
    await fs.copyFile(source, temporaryPath);
    await fs.rename(temporaryPath, destination);
  } finally {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}

export async function copyDirectoryAtomic(
  source: string,
  destination: string,
): Promise<void> {
  const temporaryPath = temporaryPathFor(destination);

  try {
    await fs.rm(temporaryPath, { recursive: true, force: true });
    await fs.cp(source, temporaryPath, { recursive: true, force: true });
    await fs.rename(temporaryPath, destination);
  } finally {
    await fs.rm(temporaryPath, { recursive: true, force: true }).catch(
      () => undefined,
    );
  }
}

function temporaryPathFor(filePath: string): string {
  const suffix = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${filePath}.tmp-${suffix}`;
}
