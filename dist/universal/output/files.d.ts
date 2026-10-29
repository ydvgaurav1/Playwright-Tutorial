/**
 * Small filesystem primitives shared by report adapters.
 *
 * Writes are atomic inside the destination directory: a temporary sibling is
 * written first and then renamed. A failed write never truncates an existing
 * completed report file.
 */
export declare function writeFileAtomic(filePath: string, contents: string | Uint8Array): Promise<void>;
export declare function copyFileAtomic(source: string, destination: string): Promise<void>;
export declare function copyDirectoryAtomic(source: string, destination: string): Promise<void>;
