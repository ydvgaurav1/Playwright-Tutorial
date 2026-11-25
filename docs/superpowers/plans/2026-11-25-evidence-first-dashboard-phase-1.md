# Evidence-first Dashboard Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Universal QA Reporter a failure-triage workspace while preserving its schema, metrics, adapters, history, and automated selector contract.

**Architecture:** Keep the existing `createDashboard(report, settings)` static-document architecture and embedded browser renderer. Restrict production changes to semantic structure, styles, and view rendering in `reporting/dashboard-template.ts`; use existing report fields without deriving new reporting data.

**Tech Stack:** TypeScript template generation, embedded HTML/CSS/JavaScript, Node test runner, Playwright Chromium.

## Global Constraints

- Do not modify Playwright test cases, framework adapters, the universal schema, or reporting calculations.
- Do not rebuild or overwrite historical reports.
- Do not update `reporting/dist` or the `reporter-dist` branch.
- Preserve existing dashboard IDs and evidence data attributes used by automation.
- Keep overall run metrics fixed when filters are active.
- Stop after local Phase 1 validation and visual-review screenshots.

## Design Plan

- **Color:** midnight `#08111f`, panel navy `#101c2e`, border slate `#2a3d56`, text `#e8f0fa`, control cyan `#67e8f9`, semantic green/red/amber `#34d399`/`#fb7185`/`#fbbf24`.
- **Type:** existing system sans for fast scanning; system monospace only for IDs, paths, errors, logs, and evidence payloads.
- **Layout:** left-aligned triage sequence: compact run context, verdict/metrics, failure queue, filters/table, suite-module-spec breakdown, history/trend, technical metadata.
- **Principles:** captured evidence before secondary context; fixed run truth versus clearly labeled filtered scope; unavailable diagnostics are explicit; no decorative duplicate metrics.

---

### Task 1: Lock the hierarchy and investigation contract

**Files:**
- Modify: `reporting/report-model.test.cjs`
- Modify: `reporting/dashboard-evidence.test.cjs`

**Interfaces:**
- Consumes: Existing dashboard section IDs, evidence attributes, and generated test fixture.
- Produces: Regression assertions for section order, one result visualization, primary failure priority, and evidence availability.

- [ ] Add source-level hierarchy assertions without changing Playwright test cases.
- [ ] Add browser assertions for primary error, expected/actual values, and evidence inventory.
- [ ] Run `npm run test:reporting` and `npm run test:dashboard-evidence`; confirm the new assertions fail for the intended missing behavior.

### Task 2: Implement evidence-first presentation

**Files:**
- Modify: `reporting/dashboard-template.ts`

**Interfaces:**
- Consumes: Existing `DashboardDocument`, test attempts, errors, steps, artifacts, logs, and history.
- Produces: The unchanged `createDashboard(report, settings): string` API and preserved selector contract.

- [ ] Render failed-test highlights directly below the run summary.
- [ ] Move technical execution metadata after history and trends.
- [ ] Remove the duplicate donut distribution while retaining the interactive summary distribution bar.
- [ ] Put the latest captured failure and expected/actual values first in test details.
- [ ] Add captured/unavailable evidence inventory and order attempt content as errors, evidence, steps, then logs.
- [ ] Preserve retries and all attempt history.

### Task 3: Validate and capture review evidence

**Files:**
- Create: `docs/dashboard-phase1/before-desktop.png`
- Create: `docs/dashboard-phase1/before-mobile.png`
- Create: `docs/dashboard-phase1/after-desktop.png`
- Create: `docs/dashboard-phase1/after-mobile.png`

**Interfaces:**
- Consumes: Generated temporary Playwright and JUnit dashboard fixtures.
- Produces: Automated results and local screenshots for visual approval.

- [ ] Run reporting, universal, Playwright adapter, JUnit, evidence, package, type-check, and build validation without writing `reporting/dist`.
- [ ] Check failed, passed, skipped, flaky, empty, filtered, evidence, IST timestamp, and history-link states in Chromium.
- [ ] Check browser console and page errors at desktop and mobile viewports.
- [ ] Capture after screenshots and stop for visual approval.
