export function readEnv(name: string, fallback: string): string {
  const value = process.env[name] ?? fallback;

  if (value.trim() === "") {
    throw new Error(`${name} must not be empty.`);
  }

  return value;
}
