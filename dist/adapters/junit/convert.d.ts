import type { JunitConversionOptions, JunitConversionResult, JunitFile } from "./types";
/**
 * Converts already-parsed JUnit files into the canonical document. It never
 * reads or writes files and never imports Playwright.
 */
export declare function convertJunitFiles(files: readonly JunitFile[], options: JunitConversionOptions): JunitConversionResult;
