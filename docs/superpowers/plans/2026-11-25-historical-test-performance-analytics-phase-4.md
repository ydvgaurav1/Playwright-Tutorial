# Historical Test Performance Analytics Phase 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic slow-test, historical duration-change, retry-overhead, and execution-bottleneck analytics to the Universal QA Reporter.

**Architecture:** Extend the existing compact history snapshot with optional duration, module, and reliable attempt-duration fields without changing the canonical schema. A pure self-contained TypeScript engine will select one completed execution, match prior observations with the Phase 2/3 identity, calculate median baselines and thresholded changes, and provide presentation-ready trends and aggregates to a new secondary dashboard panel.

**Tech Stack:** TypeScript 5.9, Node.js test runner, static HTML/CSS/JavaScript, Playwright Chromium.

## Global Constraints

- Preserve Phase 1 evidence, Phase 2 comparison, and Phase 3 flaky-intelligence behavior.
- Do not change existing failure or flaky-test classification calculations.
- Do not change the canonical schema, application automation tests, historical report artifacts, or `reporter-dist`.
- Do not fabricate missing duration or retry-attempt telemetry.
- Do not add AI, databases, cloud services, external APIs, or dependencies.
- Keep failure investigation as the dashboard's primary workflow and retain the approved dark theme.
- Do not commit or push; stop for approval after Phase 4 verification.

## Inspection Findings

- Canonical tests already contain `durationMs`, `module`, suites, variant identity, retry counts, and attempts. `capabilities.timings` declares whether timings are run-, test-, or attempt-level.
- Playwright declares `timings: "attempt"` and its test duration is the sum of recorded attempt durations.
- JUnit declares `timings: "test"` and `capabilities.retries: false`; its one synthetic attempt must not be presented as retry-duration telemetry.
- JUnit marks a missing testcase duration in `attempt.extensions.junit.durationSource`; the required canonical zero must be omitted from performance snapshots when that source says `missing`.
- Legacy `results.json` contains test duration and attempts but no capability declaration. Test duration can be retained when valid; retry overhead remains unavailable unless the known legacy Playwright writer explicitly declares attempt timing during projection.
- `summary.durationMs` at overall run scope is wall-clock invocation duration. Suite/module summaries and newly calculated bottleneck totals are sums of test durations and may exceed wall time under parallel execution.
- Existing historical identity is environment + stable test ID + project + browser + repeat index. Phase 4 will use the same exact tuple.

## File Structure

- Create `reporting/universal/core/performance-intelligence.ts`: pure median, duration classification, trend, retry overhead, and bottleneck calculations.
- Create `reporting/universal/test/performance-intelligence.test.cjs`: deterministic unit coverage for required telemetry and contexts.
- Modify `reporting/report-types.ts`: add optional performance fields to compact snapshots only.
- Modify `reporting/universal/core/execution-comparison.ts`: project canonical/legacy duration data and reliable attempt durations.
- Modify `reporting/universal/output/report-writer.ts`, `reporting/custom-reporter.ts`, and `scripts/rebuild-dashboards.cjs`: pass source timing capability into snapshot projection.
- Modify `reporting/dashboard-template.ts`: add the compact expandable performance section using existing tokens and controls.
- Modify reporting, adapter, JUnit, compatibility, and browser tests to protect projection and UI behavior.
- Modify `docs/custom-reporting-guide.md`: document formulas, defaults, source fidelity, and parallel-execution limitations.

## Default Calculations and Thresholds

- Historical window: latest **12** compatible prior executions plus the selected execution.
- Minimum baseline: **3** valid prior duration observations.
- Slow-test threshold: **30,000 ms**; slow is descriptive and never implies regression.
- Regression/improvement thresholds: absolute change of at least **1,000 ms** and relative change of at least **25%** in the same direction.
- Baseline: median of valid prior durations. For an even sample count, use the arithmetic mean of the two middle values.
- Percentage difference: `(current - median baseline) / median baseline × 100`, rounded to one decimal. A zero baseline has no valid relative difference and cannot produce a regression/improvement inference.
- Retry overhead: sum of attempts after the initial attempt, only when attempt-level timing capability is declared and every included attempt duration is valid.
- Test/suite duration sums and wall-clock run duration are independent measures; no pipeline-time equivalence or inferred parallel efficiency is claimed.

---

### Task 1: Performance-aware compact history snapshots

**Files:**
- Modify: `reporting/report-types.ts`
- Modify: `reporting/universal/core/execution-comparison.ts`
- Modify: `reporting/universal/output/report-writer.ts`
- Modify: `reporting/custom-reporter.ts`
- Modify: `scripts/rebuild-dashboards.cjs`
- Test: `reporting/universal/test/execution-comparison.test.cjs`
- Test: `reporting/adapters/playwright/test/adapter.test.cjs`
- Test: `reporting/adapters/junit/test/generate.test.cjs`

**Interfaces:**
- `ComparisonTestSnapshot.module?: string`
- `ComparisonTestSnapshot.durationMs?: number`
- `ComparisonTestSnapshot.attemptDurationsMs?: number[]`
- `SnapshotProjectionOptions.timingGranularity?: "run" | "test" | "attempt"`

- [ ] Add projection tests proving canonical Playwright duration/attempt data is preserved, JUnit missing duration is omitted, JUnit attempt duration is unavailable, and legacy invalid values are omitted.
- [ ] Run `npm run test:comparison`, `npm run test:adapter`, and `npm run test:junit`; verify the new assertions fail because performance fields are absent.
- [ ] Extend snapshot projection with optional module and valid test duration.
- [ ] Project attempt durations only when `timingGranularity === "attempt"` and every attempt duration is finite and non-negative.
- [ ] Pass canonical timing capability through the universal writer and rebuild script; mark the direct legacy Playwright writer as attempt-capable.
- [ ] Re-run focused tests and both TypeScript checks.

### Task 2: Deterministic performance-intelligence engine

**Files:**
- Create: `reporting/universal/core/performance-intelligence.ts`
- Create: `reporting/universal/test/performance-intelligence.test.cjs`
- Modify: `reporting/universal/index.ts`
- Modify: `package.json`

**Interfaces:**
- `analyzeTestPerformance(runs, selectedRunId, options?): TestPerformanceIntelligence`
- `DEFAULT_TEST_PERFORMANCE_OPTIONS`
- Identity: environment + stable test ID + project + browser + repeat index.
- Classifications: `regression`, `improvement`, `stable`, `insufficient-history`, `unusable-current`.

- [ ] Write tests for consistently fast, consistently slow, significant regression, significant improvement, insufficient history, invalid/missing durations, mixed contexts, unavailable dashboards, configurable windows, and simultaneous absolute/relative thresholds.
- [ ] Write retry-overhead tests for reliable multiple attempts, reliable no-retry zero overhead, and unavailable JUnit-style telemetry.
- [ ] Write aggregate tests proving test/suite sums are labeled separately from wall-clock duration and can exceed wall time under parallel execution.
- [ ] Run `npm run test:performance-intelligence`; verify RED because the module is missing.
- [ ] Implement stable context matching, valid-observation classification, median, signed absolute/relative differences, and deterministic sorting.
- [ ] Implement trend observations that retain timestamps, exact values, statuses, evidence availability, missing/skipped/interrupted/unusable states, and no fabricated values.
- [ ] Implement retry overhead and selected-run bottlenecks without inferring unsupported timing.
- [ ] Re-run the focused suite and refactor only while it remains green.

### Task 3: Test Performance Intelligence dashboard

**Files:**
- Modify: `reporting/dashboard-template.ts`
- Modify: `reporting/report-model.test.cjs`
- Modify: `reporting/dashboard-evidence.test.cjs`

**Interfaces:**
- Dashboard IDs: `performanceIntelligenceSection`, `performanceIntelligenceState`, `performanceIntelligenceFilters`, `performanceIntelligenceSort`, `performanceIntelligenceRows`, `performanceBottlenecks`.
- Filters: `slowest`, `regressions`, `improvements`, `all`, `insufficient`, `retry-overhead`.
- Sorts: `duration-desc`, `change-desc`, `title-asc`.

- [ ] Add structural tests for the section, controls, bottleneck summary, and embedded analyzer.
- [ ] Add browser tests for slow-but-stable separation, regression/improvement values, median baseline, trends, unavailable telemetry, evidence links, keyboard filters, sorting, tooltips, and mobile collapse/layout.
- [ ] Run reporting and dashboard browser tests; verify RED because the section does not exist.
- [ ] Embed the exact tested analysis function and configured defaults in the static dashboard.
- [ ] Add the secondary panel after flaky intelligence so failure/flaky investigation remains primary.
- [ ] Render compact test rows with title, suite/module, variant, status, current/baseline/delta values, duration timeline, retry overhead, and current-detail or historical-evidence navigation.
- [ ] Render expensive suite/test totals beside a clear wall-clock note; do not equate aggregate test time with pipeline time.
- [ ] Re-run browser tests at desktop and mobile sizes with zero console/page errors.

### Task 4: Documentation and compatibility

**Files:**
- Modify: `docs/custom-reporting-guide.md`
- Modify: compatibility and package tests only where snapshot assertions require the new optional fields.

- [ ] Document median calculation, validity rules, formulas, threshold conjunction, zero-baseline behavior, attempt-timing requirements, and default values.
- [ ] Document that JUnit retry overhead is unavailable and that legacy fallback never invents duration fidelity.
- [ ] Document the difference between wall-clock run duration and summed test/suite duration under parallel execution.
- [ ] Verify Phase 1 evidence, Phase 2 comparison, and Phase 3 flaky-intelligence suites remain unchanged in behavior.

### Task 5: Full verification and visual review

**Files:**
- Create: `docs/dashboard-phase4-review/desktop.png`
- Create: `docs/dashboard-phase4-review/mobile.png`
- Create: `docs/dashboard-phase4-review/mobile-trend.png`

- [ ] Run comparison, flaky intelligence, performance intelligence, reporting, universal, adapter, JUnit, dashboard, and package suites.
- [ ] Run `npm run typecheck` and `npx tsc -p reporting/tsconfig.package.json --noEmit`.
- [ ] Run package build/install validation in an isolated temporary copy.
- [ ] Verify 1440×900 and 390×844 views, native keyboard activation, filter/sort state, tooltip/accessible labels, responsive rows, evidence links, and zero browser errors.
- [ ] Save and inspect the three Phase 4 screenshots.
- [ ] Run `git diff --check` and confirm application tests, historical artifacts, canonical schema, and `reporter-dist` remain untouched.
- [ ] Report changed files, exact test totals, thresholds, limitations, and stop for review.
