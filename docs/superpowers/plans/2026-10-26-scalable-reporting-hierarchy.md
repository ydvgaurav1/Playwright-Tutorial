# Scalable Reporting Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the existing custom Playwright dashboard into a clean, filterable Overall → Suite → Module → Spec → Test → Evidence report while preserving the current three test behaviors and native Playwright report.

**Architecture:** Keep Playwright collection in the custom reporter, move classification and aggregation into pure TypeScript utilities, and render the stored schema as a self-contained dashboard. Test records remain unique per Playwright project while suite membership is a many-to-many tag classification; aggregate views reference the unique records instead of cloning them.

**Tech Stack:** Playwright Test Reporter API, TypeScript, Node.js filesystem/crypto APIs, self-contained HTML/CSS/JavaScript, Node.js built-in test runner

## Global Constraints

- Preserve the current dark theme, compact layout, IST timestamps, report navigation, native HTML report, and Trace Viewer integration.
- Do not modify existing test actions or assertions and do not add Playwright scenarios.
- Do not add databases, services, runtime dependencies, synthetic test results, or hard-coded counts.
- Keep each execution immutable under a unique timestamped Run ID and update `latest/` only after completion.
- Count each Playwright test/project record once overall even when it belongs to multiple suites.

---

### Task 1: Classification and aggregation model

**Files:**
- Create: `reporting/report-model.ts`
- Modify: `reporting/report-types.ts`
- Test: `reporting/report-model.test.cjs`

**Interfaces:**
- Consumes: Playwright tags, project/browser metadata, source file paths, and serialized test outcomes.
- Produces: `classifySuites(tags)`, `classifyModule(tags, file)`, `createSummary(tests, durationMs?)`, `createSuiteRecords(tests)`, `createModuleRecords(tests)`, and `createSpecRecords(tests)`.

- [x] Write unit tests proving multi-suite membership, unique overall counts, explicit module metadata with path fallback, project-separated specs, and zero-result summaries.
- [x] Run `node --test reporting/report-model.test.cjs` and confirm failures describe missing hierarchy behavior.
- [x] Implement schema version 2 and the pure model utilities.
- [x] Re-run the reporting unit tests and confirm they pass.

### Task 2: Reporter collection and history

**Files:**
- Modify: `reporting/custom-reporter.ts`
- Modify: `playwright.config.ts`

**Interfaces:**
- Consumes: Task 1 model utilities and Playwright `TestCase`/`TestResult` lifecycle data.
- Produces: `results.json` with suites, modules, specs, project-aware tests, captured stdout/stderr, and history failure identities.

- [x] Add a failing unit expectation for hierarchy-compatible stable IDs and aggregate fields.
- [x] Serialize project, browser, spec key, multiple suites, module, title path, attempts, logs, and evidence without cloning tests.
- [x] Load both schema-v1 history and schema-v2 history, retaining only actual completed reports.
- [x] Type-check the reporter and run unit tests.

### Task 3: Dashboard hierarchy and combined filters

**Files:**
- Modify: `reporting/dashboard-template.ts`
- Test: `reporting/report-model.test.cjs`

**Interfaces:**
- Consumes: schema-v2 `DashboardDocument`.
- Produces: self-contained HTML with a clean header, contextual metrics, run/suite/module/spec/status/browser filters, search, drill-down cards, prioritized failures, test details, and evidence links.

- [x] Add a failing rendered-HTML test proving the header has no execution badge and the combined filter controls exist.
- [x] Remove header-only badge markup/styles/rendering while retaining test-level status badges.
- [x] Implement dynamic filter options, shared filter state, contextual metrics/health visualization, clear-all and empty states.
- [x] Add suite/module/spec progressive drill-down and history-based new/recurring failure labels.
- [x] Re-run unit tests and type-check.

### Task 4: Current test metadata and operating documentation

**Files:**
- Modify: `tests/login.spec.ts`
- Modify: `tests/demo/login-intentional-failure.spec.ts`
- Modify: `package.json`
- Modify: `docs/custom-reporting-guide.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: `@sanity`, `@regression`, and `@module:<name>` conventions.
- Produces: classified current tests and documented commands/conventions for future tests.

- [x] Add metadata-only tags without changing test bodies or assertions.
- [x] Add suite-specific scripts and the reporting unit-test script.
- [x] Document hierarchy, identity/counting rules, filters, history limits, and extension examples.
- [x] Run type-check and reporting unit tests.

### Task 5: End-to-end verification

**Files:** Generated only under `reports/`; no synthetic data fixtures.

- [x] Run the two passing production-style tests and verify their classified report.
- [x] Run all three current tests and confirm the expected 2 passed / 1 failed / 0 skipped / 0 flaky / 66.7% result.
- [x] Browser-check header, contextual metrics, all combined filters, drill-down, empty states, details, screenshot/video/trace/native-report links, IST timestamps, history, and `latest/`.
- [x] Confirm the nonzero all-tests exit is solely the existing intentional failure and record generated Run IDs.
