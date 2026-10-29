import type { RunDocument } from "../schema/types";
import type { ReportDocument } from "../../report-types";
/**
 * Projects the canonical run document into the schema-v2 results document that
 * the existing dashboard and history reader already understand.
 *
 * The projection is intentionally lossy: canonical-only fields such as
 * evidence byte counts and richer statuses are not added to results.json.
 */
export declare function toLegacyReport(document: RunDocument): ReportDocument;
