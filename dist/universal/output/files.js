"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeFileAtomic = writeFileAtomic;
exports.copyFileAtomic = copyFileAtomic;
exports.copyDirectoryAtomic = copyDirectoryAtomic;
const node_fs_1 = require("node:fs");
/**
 * Small filesystem primitives shared by report adapters.
 *
 * Writes are atomic inside the destination directory: a temporary sibling is
 * written first and then renamed. A failed write never truncates an existing
 * completed report file.
 */
async function writeFileAtomic(filePath, contents) {
    const temporaryPath = temporaryPathFor(filePath);
    try {
        await node_fs_1.promises.writeFile(temporaryPath, contents);
        await node_fs_1.promises.rename(temporaryPath, filePath);
    }
    finally {
        await node_fs_1.promises.rm(temporaryPath, { force: true }).catch(() => undefined);
    }
}
async function copyFileAtomic(source, destination) {
    const temporaryPath = temporaryPathFor(destination);
    try {
        await node_fs_1.promises.copyFile(source, temporaryPath);
        await node_fs_1.promises.rename(temporaryPath, destination);
    }
    finally {
        await node_fs_1.promises.rm(temporaryPath, { force: true }).catch(() => undefined);
    }
}
async function copyDirectoryAtomic(source, destination) {
    const temporaryPath = temporaryPathFor(destination);
    try {
        await node_fs_1.promises.rm(temporaryPath, { recursive: true, force: true });
        await node_fs_1.promises.cp(source, temporaryPath, { recursive: true, force: true });
        await node_fs_1.promises.rename(temporaryPath, destination);
    }
    finally {
        await node_fs_1.promises.rm(temporaryPath, { recursive: true, force: true }).catch(() => undefined);
    }
}
function temporaryPathFor(filePath) {
    const suffix = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${filePath}.tmp-${suffix}`;
}
