# Compact QA Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the Universal QA Reporter dashboard into a compact execution-triage workspace while preserving its report model and interactions.

**Architecture:** Keep `createDashboard` and the embedded client-side rendering model unchanged. Limit implementation to semantic HTML, CSS, and small view-rendering changes in the dashboard template, with browser regression assertions covering layout-independent behavior.

**Tech Stack:** TypeScript template generation, embedded HTML/CSS/JavaScript, Node test runner, Playwright Chromium.

## Global Constraints

- Do not change adapters, schemas, test cases, or report calculations.
- Do not remove filtering, history, comparison, evidence, details, attempts, errors, logs, timestamps, or framework compatibility.
- Do not overwrite historical reports or update distribution output.
- Keep overall metrics independent of active filters.
- Stop after local validation for visual review.

---

### Task 1: Compact information hierarchy

**Files:**
- Modify: `reporting/dashboard-template.ts`
- Test: `reporting/report-model.test.cjs`

**Interfaces:**
- Consumes: `DashboardDocument` and existing element IDs used by the embedded script.
- Produces: The same `createDashboard(report, settings): string` API and control IDs.

- [x] Add structural regression assertions for the compact header, advanced filters, and table ordering.
- [x] Run `npm run test:reporting` and confirm the new assertions fail.
- [x] Consolidate verdict, metrics, and health into one compact summary.
- [x] Move the run selector into the header and make suite/module/spec filters expandable.
- [x] Place Test Execution before secondary metadata and analytics.
- [x] Run `npm run test:reporting` and confirm it passes.

### Task 2: Responsive and interaction verification

**Files:**
- Modify: `reporting/dashboard-template.ts`
- Test: `reporting/dashboard-evidence.test.cjs`

**Interfaces:**
- Consumes: Existing dashboard controls, status filters, details dialog, and evidence links.
- Produces: Keyboard-accessible controls and responsive 1440×900 / 390×844 layouts.

- [x] Add browser assertions for run-level metric stability and advanced-filter behavior.
- [x] Run dashboard browser tests and confirm the assertions fail before implementation where applicable.
- [x] Implement compact desktop/mobile density, focus states, numeric alignment, and mobile table visibility.
- [x] Run reporting, universal, adapter, JUnit, evidence, and type-check tests without rebuilding distribution output.
- [x] Capture before/after screenshots at 1440×900 and 390×844.
- [x] Verify passed, failed, skipped, flaky, filtered, details, and evidence states in Chromium.
