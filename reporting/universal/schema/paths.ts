/**
 * Path rules shared by adapters and the runtime validator.
 *
 * Canonical artifact paths are relative to the run root. Absolute paths,
 * drive-letter paths, "." segments, ".." segments, and NUL bytes are rejected
 * so a report cannot reference files outside its own run directory.
 */
export function isSafeRelativePath(value: string): boolean {
  if (typeof value !== "string" || value.trim() === "" || value.includes("\0")) {
    return false;
  }

  const normalized = value.replaceAll("\\", "/");
  if (normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized)) {
    return false;
  }

  return normalized
    .split("/")
    .every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

export function toRunRelativePath(value: string): string {
  const normalized = value.replaceAll("\\", "/").replace(/^\.\//, "");
  let result = normalized;

  while (result.startsWith("../")) {
    result = result.slice(3);
  }

  return result;
}
