"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toLegacyReport = void 0;
/**
 * Backwards-compatible re-export. The projection now lives in the shared
 * universal output layer so the Playwright and JUnit adapters write exactly the
 * same schema-v2 results document.
 */
var legacy_projection_1 = require("../../universal/output/legacy-projection");
Object.defineProperty(exports, "toLegacyReport", { enumerable: true, get: function () { return legacy_projection_1.toLegacyReport; } });
