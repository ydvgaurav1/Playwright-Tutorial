# Historical Test Intelligence Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic execution comparison that identifies regressions, resolved and recurring failures, non-executed or missing tests, and flaky/retry changes across completed Playwright and JUnit-compatible runs.

**Architecture:** Each dashboard history record gains a compact test snapshot generated from its existing `results.json`; the universal report schema remains unchanged. A pure comparison engine matches snapshots by stable test ID plus environment, project, browser, and repeat context, and the same compiled function is embedded in the static dashboard so calculations stay deterministic without a server.

**Tech Stack:** TypeScript 5.9, Node.js test runner, static HTML/CSS/JavaScript dashboard, Playwright browser verification.

## Global Constraints

- Preserve all Phase 1 UI/UX improvements and historical dashboard availability behavior.
- Do not modify application automation tests, historical report files, or `reporter-dist`.
- Do not introduce AI, databases, cloud hosting, external services, or fabricated comparison data.
- Keep calculations deterministic and support Playwright and JUnit records when identity metadata is sufficient.
- Do not push changes; stop for review before further analytics.

## File Structure

- Create `reporting/universal/core/execution-comparison.ts`: snapshot projection, context-aware identity, deterministic comparison categories, and metric deltas.
- Create `reporting/universal/test/execution-comparison.test.cjs`: pure behavior coverage for every required transition and context boundary.
- Modify `reporting/report-types.ts`: dashboard-only snapshot types on `HistoryRecord`; no universal schema change.
- Modify `reporting/universal/index.ts`: public export for comparison helpers.
- Modify `reporting/universal/output/report-writer.ts`: populate snapshots from current and prior schema-v2/v1-compatible result projections.
- Modify `reporting/custom-reporter.ts`: keep the legacy direct writer aligned.
- Modify `scripts/rebuild-dashboards.cjs`: keep optional manual rebuild output aligned without running it.
- Modify `reporting/dashboard-template.ts`: compact comparison controls, summary deltas, result filters, accessible rows, and explicit insufficient-data states.
- Modify reporter/adapter/JUnit/dashboard tests: verify generated history data and browser behavior.

## Design Plan

- **Color:** Reuse `#08111f` base, `#17263b` raised surface, `#67e8f9` focus/accent, `#fb7185` regression, `#34d399` resolved, and `#fbbf24` retry attention.
- **Type:** Preserve the existing system sans for scanning and existing monospace only for stable identifiers; no new font dependency.
- **Layout:** Add one wide comparison workbench before the trend, with baseline/current selectors in a single control strip, six compact metric cells, and a filtered table below.

```text
+ Compare executions ------------------------------------------------+
| Baseline [run ▼]  Current [run ▼]  Context note                   |
| Regressions | Resolved | Recurring | Missing | Retry | Pass Δ     |
| [All] [Regressions] [Resolved] [Recurring] [Missing] [Retry]       |
| Test                    Change             Context       Retries    |
+--------------------------------------------------------------------+
```

- **Principles:** Treat comparison as evidence triage, not a second dashboard. Use status color only to encode change meaning, preserve dense scanning, and make unavailable/insufficient states actionable.
- **Brief review:** A separate card grid would repeat generic dashboard chrome. The revised design uses one connected workbench and a single change rail so the feature reads as a run diff rather than unrelated analytics cards.

---

### Task 1: Deterministic comparison engine

**Files:**
- Create: `reporting/universal/core/execution-comparison.ts`
- Create: `reporting/universal/test/execution-comparison.test.cjs`
- Modify: `reporting/universal/index.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `toComparisonSnapshots(tests: readonly TestRecord[]): ComparisonTestSnapshot[]`
- Produces: `compareExecutions(baseline: ComparisonRun, current: ComparisonRun): ExecutionComparison`
- Identity: `environment + stable test id + project + browser + repeatEachIndex`.

- [ ] **Step 1: Write failing transition tests**

Cover passed→failed, failed→passed, failed→failed, passed→passed, skipped transitions, missing on each side, flaky status, retry count/config changes, suite differences, browser/project/environment separation, and absent snapshots. Assert exact category membership and summary deltas.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test reporting/universal/test/execution-comparison.test.cjs`

Expected: failure because `execution-comparison.ts` does not exist.

- [ ] **Step 3: Implement the pure engine**

Use sorted arrays and `Map` lookup. A skipped test is `nonExecuted`, never resolved or newly failed. A test absent from one run is `missingFromBaseline` or `missingFromCurrent`. `failed→failed` is recurring, `passed/flaky→failed` is newly failed, and only `failed→passed` is resolved. Flaky status and changes to retries used/configured are also emitted in `retryChanges`.

- [ ] **Step 4: Run focused and universal tests**

Run: `npm run test:comparison && npm run test:universal`

Expected: all pass with stable ordering.

### Task 2: Dashboard history snapshots

**Files:**
- Modify: `reporting/report-types.ts`
- Modify: `reporting/universal/output/report-writer.ts`
- Modify: `reporting/custom-reporter.ts`
- Modify: `scripts/rebuild-dashboards.cjs`
- Modify: `reporting/adapters/playwright/test/adapter.test.cjs`
- Modify: `reporting/adapters/junit/test/generate.test.cjs`

**Interfaces:**
- Consumes: `toComparisonSnapshots`.
- Produces: optional `tests?: ComparisonTestSnapshot[]` on dashboard-only `HistoryRecord`.

- [ ] **Step 1: Add failing writer tests**

Assert current and prior records carry compact snapshots with identity, status, suites, variant, and retry values. Assert missing dashboard files still retain snapshots while `dashboardAvailable` remains false. Assert JUnit snapshots retain blank/available browser metadata without inventing it.

- [ ] **Step 2: Run adapter and JUnit tests and verify RED**

Run: `npm run test:adapter && npm run test:junit`

Expected: snapshot assertions fail because history records do not include `tests`.

- [ ] **Step 3: Populate snapshots in every writer**

Project only existing fields from `results.json`. Do not alter `results.json`, `run.json`, summary calculations, or schema validation. Legacy records without sufficient test fields omit snapshots and remain valid history.

- [ ] **Step 4: Run adapter, JUnit, reporting, and type checks**

Run: `npm run test:adapter && npm run test:junit && npm run test:reporting && npm run typecheck && npx tsc -p reporting/tsconfig.package.json --noEmit`

Expected: all pass.

### Task 3: Static dashboard comparison workbench

**Files:**
- Modify: `reporting/dashboard-template.ts`
- Modify: `reporting/report-model.test.cjs`
- Modify: `reporting/dashboard-evidence.test.cjs`

**Interfaces:**
- Consumes: embedded `compareExecutions` and `HistoryRecord.tests`.
- Produces DOM IDs: `comparisonSection`, `comparisonBaseline`, `comparisonCurrent`, `comparisonState`, `comparisonMetrics`, `comparisonFilters`, `comparisonRows`.

- [ ] **Step 1: Add failing structure and browser tests**

Assert semantic labels, two selectors, metric delta output, category filters, keyboard-operable controls, exact transition rows, and explicit “insufficient historical data” copy. Assert unavailable dashboard records can still be compared when snapshots exist and never gain report links.

- [ ] **Step 2: Run dashboard tests and verify RED**

Run: `npm run test:reporting && npm run test:dashboard-evidence`

Expected: failures because comparison controls are absent.

- [ ] **Step 3: Implement the minimal workbench**

Populate selectors only from completed history records. Default current to the loaded run and baseline to the nearest earlier run with snapshots. Render counts and signed total/pass-rate/duration deltas; render rows by selected category. Keep a visible note for environment changes and report availability, and use an `aria-live="polite"` state region.

- [ ] **Step 4: Add responsive and accessible styling**

Desktop uses a single dense control row; mobile stacks selectors and metric cells, keeps a horizontally scrollable details table, and collapses the section by default alongside trend/history. Preserve visible focus, native labels, buttons, and reduced-motion behavior.

- [ ] **Step 5: Run dashboard suites**

Run: `npm run test:reporting && npm run test:dashboard-evidence`

Expected: all pass with no console or page errors.

### Task 4: Full verification and review stop

**Files:**
- Verify only; do not modify reports or distribution output.

- [ ] **Step 1: Run the full reporting regression**

Run:

```bash
npm run test:comparison
npm run test:reporting
npm run test:universal
npm run test:adapter
npm run test:junit
npm run test:dashboard-evidence
npm run typecheck
npx tsc -p reporting/tsconfig.package.json --noEmit
```

- [ ] **Step 2: Validate package behavior in an isolated temporary copy**

Run `npm run test:package` only in a temporary copied workspace so `reporting/dist` in the working tree is not changed.

- [ ] **Step 3: Verify desktop and mobile**

At 1440×900 and 390×844, assert selector defaults, all category counts, filters, insufficient state, unavailable report labels, collapsed mobile behavior, zero console errors, and zero page errors.

- [ ] **Step 4: Inspect the working tree**

Run: `git diff --check && git status --short && git diff --stat`

Confirm historical reports, application tests, and `reporter-dist` are untouched.

- [ ] **Step 5: Stop for review**

Report exact test totals, files changed, identity rules, and limitations. Do not start additional analytics.
