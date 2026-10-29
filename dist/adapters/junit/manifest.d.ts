import type { EvidenceKind, RunDocument } from "../../universal/schema/types";
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
export declare class JunitManifestError extends Error {
    constructor(message: string);
}
export declare function loadJunitManifest(manifestPath: string): Promise<JunitManifest>;
/**
 * Copies every manifest attachment into the reserved run folder and attaches
 * it to the matching canonical test. Returns a new document; the input is not
 * mutated so a failed attachment pass cannot corrupt an already validated one.
 */
export declare function attachManifestEvidence(document: RunDocument, manifest: JunitManifest, runDirectory: string): Promise<ManifestAttachmentResult>;
