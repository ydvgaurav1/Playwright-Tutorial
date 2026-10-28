/**
 * Backwards-compatible re-export. The projection now lives in the shared
 * universal output layer so the Playwright and JUnit adapters write exactly the
 * same schema-v2 results document.
 */
export { toLegacyReport } from "../../universal/output/legacy-projection";
