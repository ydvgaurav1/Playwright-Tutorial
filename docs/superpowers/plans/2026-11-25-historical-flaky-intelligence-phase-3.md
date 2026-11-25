# Historical Flaky Test Intelligence Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic historical flaky-test intelligence that separates retry dependence, final-outcome intermittency, persistent failures, and incomplete observations.

**Architecture:** Preserve exact canonical statuses in dashboard-only history snapshots when `run.json` is available, while retaining the Phase 2 legacy status for compatibility. A pure, self-contained engine groups tests by environment, stable ID, project, browser, and repeat index; computes measured frequencies with explicit denominators; and produces configurable inferred classifications consumed by the static dashboard.

**Tech Stack:** TypeScript 5.9, Node.js test runner, static HTML/CSS/JavaScript, Playwright Chromium.

## Global Constraints

- Preserve all Phase 1 evidence and Phase 2 comparison behavior.
- Do not change the canonical schema, application automation tests, historical artifacts, or `reporter-dist`.
- Do not fabricate missing observations or retry telemetry.
- Do not use AI, databases, cloud hosting, or external services.
- Do not push changes; stop for approval after verification.

## File Structure

- Create `reporting/universal/core/flaky-intelligence.ts`: pure grouping, observation, frequency, classification, and threshold logic.
- Create `reporting/universal/test/flaky-intelligence.test.cjs`: accuracy coverage for all required histories and contexts.
- Modify `reporting/report-types.ts`: optional exact observation status and optional retry telemetry in dashboard snapshots.
- Modify `reporting/universal/core/execution-comparison.ts`: generic canonical/legacy snapshot projection without invented retry values.
- Modify `reporting/universal/output/report-writer.ts`: prefer canonical `run.json` snapshots for prior runs and canonical in-memory snapshots for the current run.
- Modify `reporting/dashboard-template.ts`: configurable flaky-intelligence panel, timeline, filters, severity, and evidence links.
- Modify adapter, JUnit, reporting, and dashboard tests to protect generated snapshots and interactions.

## Default Thresholds

- Comparable observation window: latest **12** compatible completed executions.
- Minimum executed observations for a historical classification: **3**.
- Repeated instability requires at least **2** measured instability events.
- Repeated instability rate must be at least **25%** of the relevant measured denominator.
- Thresholds are presentation settings and do not alter stored results or measured statistics.

---

### Task 1: Preserve accurate snapshot telemetry

**Interfaces:**
- `ComparisonTestSnapshot.observationStatus?: UniversalTestStatus`
- `retryAttempts?: number`
- `retriesConfigured?: number`
- `toComparisonSnapshots(tests: readonly unknown[]): ComparisonTestSnapshot[]`

- [ ] Write failing projection tests for canonical interrupted/timed-out statuses and absent retry telemetry.
- [ ] Run `npm run test:comparison` and verify the new assertions fail.
- [ ] Implement canonical/legacy shape detection without defaulting unknown retries to zero.
- [ ] Make the universal writer use canonical tests for the current run and canonical `run.json` tests for prior runs when valid.
- [ ] Run comparison, adapter, JUnit, universal, and typecheck suites.

### Task 2: Deterministic flaky-intelligence engine

**Interfaces:**
- `analyzeHistoricalFlakiness(runs, options?): HistoricalFlakyIntelligence`
- `DEFAULT_FLAKY_INTELLIGENCE_OPTIONS`
- Identity: environment + stable test ID + project + browser + repeat index.

- [ ] Write failing tests for always passing, always failing, alternating outcomes, successful retry, repeated retries, isolated failure, skipped, missing, interrupted, insufficient data, incompatible browsers/environments, and unavailable dashboards.
- [ ] Verify RED with `npm run test:flaky-intelligence`.
- [ ] Implement measured counts and percentages with explicit numerator/denominator fields.
- [ ] Implement inferred classifications separately: stable, isolated failure, retry observed, persistent failure, historically intermittent, retry dependent, repeated instability, and insufficient data.
- [ ] Verify stable ordering and configurable thresholds.

### Task 3: Historical flaky-intelligence dashboard

**Interfaces:**
- Dashboard IDs: `flakyIntelligenceSection`, `flakyIntelligenceState`, `flakyIntelligenceFilters`, `flakyIntelligenceRows`.
- Filter values: `unstable`, `all`, `intermittent`, `retry`, `insufficient`.

- [ ] Add failing structural and browser tests for filter counts, percentages and denominators, timeline labels, context, severity, evidence links, missing/skipped/interrupted markers, and unavailable reports.
- [ ] Verify RED with reporting and dashboard-evidence suites.
- [ ] Embed the same compiled analysis function used by Node tests.
- [ ] Render one compact row per stable context with measured statistics, inferred classification, and a latest-12-run timeline.
- [ ] Collapse the panel by default on mobile and preserve keyboard focus, native labels, and horizontal timeline scrolling.
- [ ] Verify dashboard tests with zero console/page errors.

### Task 4: Full verification

- [ ] Run comparison, flaky-intelligence, reporting, universal, adapter, JUnit, dashboard, package, and both typechecks.
- [ ] Verify 1440×900 and 390×844 browser views, accessible filters, evidence links, and responsive layout.
- [ ] Save screenshots under `docs/dashboard-phase3-review/`.
- [ ] Run `git diff --check` and confirm reports, application tests, and distribution files are untouched.
- [ ] Report measured results, configured thresholds, remaining limitations, and stop for approval.
