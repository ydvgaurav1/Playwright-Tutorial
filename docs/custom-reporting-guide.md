# Custom Reporting Guide

## Purpose

The framework keeps Playwright's native HTML report and adds a portable custom dashboard without databases, services, or third-party chart libraries. Every completed Playwright invocation receives its own Run ID and immutable timestamped directory.

## Reporting hierarchy

```text
Overall execution
└── Suite membership (many-to-many)
    └── Functional module
        └── Spec file + Playwright project
            └── Test/project result
                └── Attempts, steps, assertions, errors, logs and evidence
```

`results.json` uses schema version 2. It stores unique test/project results once and stores calculated `suites`, `modules`, and `specs` views separately. The dashboard derives its filter options and contextual metrics from this data; it does not contain hard-coded suite names, module names, spec names, or counts.

| File | Responsibility |
|---|---|
| `reporting/report-types.ts` | Defines schema-v2 run, test, attempt, evidence, hierarchy, metadata, and history records. |
| `reporting/report-model.ts` | Pure suite/module classification and aggregate calculations. |
| `reporting/custom-reporter.ts` | Collects Playwright results, logs, steps, retries, errors, evidence, project/browser identity, history, and writes completed reports. |
| `reporting/dashboard-template.ts` | Renders the self-contained dark dashboard and all client-side filters/drill-down interactions. |
| `reporting/run-context.ts` | Defines report storage, staging, environment, and `Asia/Kolkata`. |
| `reporting/report-model.test.cjs` | Unit coverage for classification, duplicate prevention, project isolation, header cleanup, filter controls, and generated-script syntax. |
| `playwright.config.ts` | Registers list, native HTML, and custom reporters and retains failure evidence. |

## Classification conventions

### Suites

- `@sanity` assigns a test to the Sanity suite.
- `@regression` assigns a test to the Regression suite.
- A test can carry both tags. It remains one overall test result and appears in both suite views.
- New suite names can use `@suite:<name>`, for example `@suite:release-candidate`, without a dashboard change.
- Operational tags such as `@demo` and module tags are not treated as suites.

### Functional modules

- Prefer an explicit `@module:<name>` tag, for example `@module:authentication`.
- If no module tag exists, the collector uses the first directory under `tests/`.
- For a root-level spec, it uses the spec basename (`tests/login.spec.ts` becomes `login`).

Example with one test in two suites:

```ts
test.describe(
  "Checkout",
  { tag: ["@sanity", "@regression", "@module:checkout"] },
  () => {
    test("customer completes card payment", async ({ page }) => {
      // Test behavior and assertions stay here.
    });
  },
);
```

Regression-only example:

```ts
test(
  "customer applies a coupon",
  { tag: ["@regression", "@module:cart"] },
  async ({ page }) => {
    // Test behavior and assertions stay here.
  },
);
```

## Identity and counting rules

- `TestRecord.id` is Playwright's stable test ID, calculated from source file, title, and project name.
- `project`, `browser`, and `repeatEachIndex` remain explicit on each test result.
- Spec aggregate keys are `<source-path>::<project>`, so the same spec in Chromium and Firefox is not merged.
- Overall metrics count the unique `TestRecord[]` once. Suite aggregates use membership references, so their totals can intentionally overlap.
- An invocation is one execution run even when it contains multiple suites. Independently invoked Sanity and Regression commands receive different Run IDs.
- Retry attempts stay inside their owning test record. A passed retry after a failed attempt is classified from Playwright's actual `flaky` outcome.

## Execution and storage flow

1. Playwright writes temporary artifacts and its native HTML report under `reports/.current/`.
2. The custom reporter receives actual test/project outcomes, attempts, step trees, assertion errors, stdout/stderr, and attachments.
3. At completion it atomically reserves a collision-safe `DD-MMM-YYYY_hh-mm-AM/PM` Run ID.
4. It copies screenshots, videos, and traces into stable categorized folders.
5. It calculates overall, suite, module, and project-qualified spec aggregates and writes `results.json`.
6. It copies the native report to `<run>/playwright-report/` and renders `<run>/dashboard/index.html`.
7. It reads only valid completed `results.json` files for history and then updates `reports/latest/index.html`.
8. It removes temporary staging. Incomplete directories without valid results are excluded.

```text
reports/
├── DD-MMM-YYYY_hh-mm-AM-or-PM/
│   ├── dashboard/index.html
│   ├── playwright-report/
│   ├── results.json
│   ├── screenshots/
│   ├── videos/
│   └── traces/
├── <older-completed-runs>/
└── latest/index.html
```

Stored timestamps are UTC ISO 8601 values. Folder labels and every displayed timestamp use `Asia/Kolkata`; displayed timestamps include `IST` explicitly. `TEST_ENV` controls the environment label and defaults to `demo`.

## Dashboard behavior

- The header title is independent of execution status; there is no Passed/Failed badge beside it.
- Six contextual cards remain: Total, Passed, Failed, Skipped, Flaky, and Pass Rate.
- The execution-health bar and result distribution remain clickable status filters.
- Run, suite, module, spec, status, browser, and text-search filters combine.
- Selecting a Run ID opens that run's immutable dashboard.
- Suite and module cards drill into lower levels; failed specs/tests are prioritized.
- Empty states are shown for suites, modules, specs, tests, and history when appropriate.
- Test details contain source, identity, project/browser, attempts, retry index, IST timestamps, captured steps/assertions, errors/stacks, available stdout/stderr, and real attachments.
- The native Playwright report and public Trace Viewer links remain in the header.

Historical trends use only completed reports found under `reports/`. Legacy schema-v1 reports contribute overall history but have no suite snapshots, so they are omitted from suite-specific trends instead of being inferred. A current failure is marked previously observed only when its stable ID appears in an earlier stored failure list; otherwise the UI says either new in available history or no prior run data.

## Commands

```bash
# Run the two Sanity-tagged passing tests.
npm run test:sanity

# Run Regression-tagged production-style tests and exclude the intentional demo.
npm run test:regression

# Run all three tests; exit code 1 is expected from the intentional demo assertion.
npm test

# Verify classification, aggregation, generated HTML, and embedded dashboard syntax.
npm run test:reporting

# Type-check framework code.
npm run typecheck

# Open the newest completed dashboard.
npm run report

# Open a downloaded/local trace directly.
npx playwright show-trace reports/<run-id>/traces/<trace>.zip
```

## Adding future coverage

1. Place the spec under `tests/`; directory organization can provide the module fallback.
2. Add one or more suite tags (`@sanity`, `@regression`, or `@suite:<name>`).
3. Add the explicit `@module:<name>` tag when possible.
4. Reuse the same tags on `test.describe` when every child test shares them; use test-level tags for exceptions.
5. Do not create separate copies of the same test for Sanity and Regression—apply both tags to one test.
6. Add a Playwright project normally when expanding browser coverage; the reporter keeps its records and specs separate automatically.

The current tests use Authentication as their explicit module. The two production-style login tests are both Sanity and Regression; the intentional demo is Regression plus `@demo`, allowing the regression script to exclude it without changing its assertion behavior.

## Verification record — 2026-10-26

- `npm run test:reporting`: 5/5 reporting tests passed.
- `npm run typecheck`: passed with no TypeScript errors.
- Regression invocation Run ID `26-Oct-2026_11-02-PM`: 2 passed, 0 failed.
- Final full invocation Run ID `26-Oct-2026_11-06-PM`: 3 total, 2 passed, 1 intentional failure, 0 skipped, 0 flaky, 66.7% pass rate.
- Chromium UI validation confirmed the clean header, six metrics, overlapping suite counts without overall duplication, all combined filters, empty states, failure-first ordering, test details, historical insight, IST display, and screenshot/video/trace references with no client errors.
- `reports/latest/index.html` points to `26-Oct-2026_11-06-PM`, the newest completed report at verification time.

No synthetic execution result was written. The reporting unit tests use small in-memory fixtures only to verify model and HTML contracts.
