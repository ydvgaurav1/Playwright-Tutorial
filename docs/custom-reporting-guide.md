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
| `reporting/report-model.ts` | Pure suite/module classification and aggregate calculations retained for the legacy reference and tests. |
| `reporting/custom-reporter.ts` | Pre-migration collector kept as a reference; no longer registered in `playwright.config.ts`. |
| `reporting/playwright-reporter.ts` | Thin entry point registered in `playwright.config.ts`. |
| `reporting/adapters/playwright/adapter.ts` | Collects Playwright results, logs, steps, retries, errors, evidence, project/browser identity, and global errors. |
| `reporting/adapters/playwright/legacy-projection.ts` | Backwards-compatible re-export of the shared canonical-to-schema-v2 projection. |
| `reporting/adapters/playwright/report-writer.ts` | Playwright-specific native-report copying; delegates run folders, documents, history, and `latest` to the shared writer. |
| `reporting/adapters/junit/` | Standalone JUnit XML parser, converter, manifest evidence handling, report generator, and CLI. |
| `reporting/universal/output/` | Shared atomic file helpers, canonical-to-schema-v2 projection, and the universal report writer. |
| `reporting/dashboard-template.ts` | Renders the self-contained dark dashboard and all client-side filters/drill-down interactions. |
| `reporting/run-context.ts` | Defines report storage, staging, environment, and `Asia/Kolkata`. |
| `reporting/report-model.test.cjs` | Unit coverage for classification, duplicate prevention, project isolation, header cleanup, filter controls, and generated-script syntax. |
| `reporting/universal/` | Framework-independent schema `1.0.0`, metrics, normalization, classification, runtime validation, and read-only legacy projection. |
| `reporting/adapters/playwright/test/` | Adapter, compatibility, retry, and failure-isolation coverage (`npm run test:adapter`). |
| `reporting/adapters/junit/test/` | Parser, conversion, manifest, generator, dashboard-label, and empty-state coverage (`npm run test:junit`). |
| `playwright.config.ts` | Registers list, native HTML, and the Playwright adapter reporter and retains failure evidence. |

### Universal core boundary

Phase 3 connects the shared core to the live Playwright path. Phase 4 adds a standalone JUnit XML path that writes the same canonical document, schema-v2 projection, dashboard, history, and `latest` shape without importing Playwright. The adapter builds a canonical `RunDocument`, validates it against schema `1.0.0`, and then projects it into schema-v2 `results.json` for the existing dashboard and history reader. The universal core has no Playwright imports; Playwright-specific lifecycle and object traversal live in `reporting/adapters/playwright/`, while the compatibility reader remains confined to `reporting/universal/compat/legacy-playwright.ts`. Run `npm run test:universal` for schema, metric, normalization, and historical-equivalence coverage, `npm run test:adapter` for lifecycle, projection, evidence, retry, and failure-isolation coverage, and `npm run test:junit` for parser, conversion, manifest, generator, and empty-state coverage.

### JUnit XML input

```bash
npm run report:junit -- results/pytest.xml
npm run report:junit -- results/ --environment staging --manifest evidence/attachments.json
```

Each `<testcase>` becomes exactly one canonical test with one attempt. `<failure>` and `<error>` map to failed, `<skipped>` maps to skipped, and a testcase with none of those maps to passed. JUnit XML has no standard retry, step, browser, or attachment representation, so the adapter does not invent them: browsers remain absent, retries and steps remain empty, and evidence is copied only from an explicit manifest. The adapter records timestamp/duration sources and warnings in `extensions.junit`. See `reporting/adapters/junit/README.md` for the full mapping, manifest schema, and limitations.

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
2. The Playwright adapter receives actual test/project outcomes, attempts, step trees, assertion errors, stdout/stderr, and attachments.
3. At completion it atomically reserves a collision-safe `DD-MMM-YYYY_hh-mm-AM/PM` Run ID.
4. It copies screenshots, videos, and traces into stable categorized folders.
5. It normalizes and classifies the collected tests, builds the canonical `run.json`, and validates schema `1.0.0`.
6. It projects the canonical document into schema-v2 `results.json`, including overall, suite, module, and project-qualified spec aggregates.
7. It copies the native report to `<run>/playwright-report/` and renders `<run>/dashboard/index.html` from the projection.
8. It reads only valid completed `results.json` files for history and then updates `reports/latest/index.html`.
9. It removes temporary staging. Incomplete directories without valid results are excluded.

```text
reports/
├── DD-MMM-YYYY_hh-mm-AM-or-PM/
│   ├── dashboard/index.html
│   ├── playwright-report/
│   ├── run.json
│   ├── results.json
│   ├── screenshots/
│   ├── videos/
│   └── traces/
├── <older-completed-runs>/
└── latest/index.html
```

Stored timestamps are UTC ISO 8601 values. Folder labels and every displayed timestamp use `Asia/Kolkata`; displayed timestamps include `IST` explicitly. `TEST_ENV` controls the environment label and defaults to `demo`.

Report generation failures are caught in `onEnd` and logged. They do not rethrow, so Playwright's original test exit status is preserved, and a new run folder is never allowed to overwrite an older one.

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

# Verify canonical schema, metrics, normalization, and historical equivalence.
npm run test:universal

# Verify the Playwright adapter, projection, retries, evidence, and failure isolation.
npm run test:adapter

# Verify JUnit parsing, conversion, manifest matching, generation, and empty states.
npm run test:junit

# Convert JUnit-compatible XML into the shared dashboard.
npm run report:junit -- path/to/junit.xml --manifest path/to/attachments.json

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

## External integration validation (Phase 5)

The validation projects live under `integration-samples/`, outside the production `tests/` directory. They reference the same Playwright adapter or JUnit CLI and therefore reuse the universal schema, metrics/classification core, output writer, legacy projection, and dashboard template. No reporting or dashboard source is copied into either sample.

### Standalone Playwright TypeScript

`integration-samples/playwright-ts/` is an independent Playwright configuration and spec set. It uses only `@playwright/test` plus the reporter entry point; it does not import this repository's fixtures, pages, test data, production config, or production tests. Minimum setup is Node.js, `@playwright/test`, a Playwright browser, and a reporter registration providing `reportsRoot`, `stagingDirectory`, `playwrightReportDirectory`, `timezone`, `environment`, and `baseURL`. Keep Playwright's HTML reporter when the dashboard should link to a native report.

The verified run had four unique tests: one passed, one failed, one skipped, and one flaky after a failed first attempt and passing retry. The canonical report preserved tags/modules, nested steps, stdout, assertion message and stack, retry attempts, two screenshots, browser/project identity, and the native Playwright report path. The schema-v2 projection also had four tests, so no retry or suite double-counting occurred.

### REST Assured Java through JUnit XML

`integration-samples/rest-assured-java/` is a Maven project using REST Assured 6.3.0 and JUnit 5.11.4 against its own local HTTP server. Maven Surefire 3.5.2 independently produced the XML; the shared JUnit CLI then converted it with `--framework rest-assured`. Minimum setup is Java, Maven (or another JUnit XML producer), Node.js plus this reporter checkout, an XML input path, and a writable reports root. Playwright is not required. An optional manifest adds evidence using paths contained by the manifest directory.

The verified XML contained four tests: two passed, one failed, and one skipped. Conversion preserved all four identities and durations, the intentional assertion message and Java stack, Surefire stdout, runtime/OS metadata, copied source XML, and four manifest attachments (two logs and two JSON response bodies). The schema-v2 projection also contained four tests.

### Verified safety and compatibility boundaries

- malformed XML returned exit code 1 and created no run folder;
- a 64 MiB + 1 byte XML file was rejected before reading/reserving a run;
- external and custom entities remained literal (`&xxe;`, `&custom;`), numeric entities decoded normally, and `/etc/passwd` content was not read;
- absolute attachment paths, `..` traversal, and symlinks resolving outside the manifest directory returned exit code 1 and left no partial run;
- the JUnit CLI completed while module loading for both `playwright` and `@playwright/test` was explicitly blocked;
- both generated dashboards passed headless Chromium checks with correct metrics, statuses, labels, details, logs/evidence, latest redirects, and zero console/page errors;
- all Phase 5 report roots were temporary; the 312 real historical report files remained byte-identical and `reports/latest/index.html` still pointed to `28-Oct-2026_02-47-PM`.

See `integration-samples/README.md` for repeatable commands and detailed limitations. External execution was verified only for Playwright Test and REST Assured/JUnit 5 through Maven Surefire JUnit XML; no unexecuted framework compatibility is claimed.

## Universal evidence and local packaging (Phase 6)

The schema-v2 dashboard projection now preserves all canonical evidence kinds:
`screenshot`, `video`, `trace`, `log`, `file`, and `native-report`. Every card
shows its filename, MIME type, measured size, and a download/open action when
the attachment is available. Existing screenshot previews, video controls, and
Playwright trace instructions remain unchanged. JSON and `text/*` evidence is
embedded as inert text with a 128 KiB preview limit; binary or unsupported MIME
types remain downloadable without a preview.

Evidence is prepared by the shared writer before `results.json` and the
dashboard are written. A dashboard path must be exactly one parent hop from
`dashboard/` into a safe run-relative path. Absolute paths, lexical or encoded
traversal, query/fragment ambiguity, missing files, non-files, and symlinks
whose real path leaves the run directory are marked unavailable and receive no
link. The generated browser code repeats the path check before creating any
media or download URL. Preview content is assigned with `textContent`, never
`innerHTML`, and requires no runtime filesystem request; this supports both
local `file://` reports and future static hosting.

### Public npm package preparation

`reporting/package.json` defines the unscoped, unpublished
`universal-qa-reporter@0.1.2` package for the official npm registry.
`npm run build:reporter` compiles the
existing reporting source into CommonJS JavaScript and declarations under the
ignored `reporting/dist/` directory; it does not duplicate source. The package
exports the universal API, JUnit generator, optional Playwright
reporter, dashboard renderer, and canonical JSON Schema, plus the
`universal-qa-report` CLI. `@playwright/test` is an optional peer, so JUnit-only
installation and conversion do not install or import Playwright.

```bash
npm install --save-dev --save-exact universal-qa-reporter@0.1.2

# JUnit XML
npx universal-qa-report results.xml --reports-root reports

# Playwright config reporter entry
universal-qa-reporter/playwright
```

The unscoped public package uses the default npm registry and requires no
consumer credential or registry mapping. Publication is manual-only through
`.github/workflows/publish-universal-qa-reporter.yml`, requires a matching
versioned Git tag and protected environment approval, and is intended to use npm
Trusted Publishing. The package is licensed under MIT and the matching
`reporting/LICENSE` file is included in the tarball; the workflow fails closed
unless an approved SPDX license and license file are present. No public npm
publication or cloud service has been performed.

## Verification record — 2026-10-28 (Phase 6)

- Local package: `universal-qa-reporter@0.1.0`; built, packed, inspected,
  installed into clean temporary consumers, imported through all documented
  entry points, and executed through its installed CLI. The final stable archive
  is `local-packages/universal-qa-reporter/0.1.0/universal-qa-reporter-0.1.0.tgz`:
  66,740 bytes, 60 entries, SHA-256
  `4d773ff371d735eb9f6e115e471db3f091f87cd0ebc2416bc71525163092b54f`.
- The saved archive was installed without reporter source in clean external
  Playwright and JUnit-only projects. Its documented exports and CLI matched
  the installed package metadata; the JUnit consumer installed no Playwright
  dependency and completed while Playwright imports were blocked.
- Installed-package Playwright run `28-Oct-2026_04-31-PM`: 4 tests — 1 passed,
  1 intentional failure, 1 skipped, and 1 flaky. Both screenshot cards loaded
  from valid run-relative paths and retained metadata/open actions.
- Installed-package REST Assured conversion run `28-Oct-2026_04-31-PM`: 4
  tests — 2 passed, 1 intentional failure, and 1 skipped. All four manifest
  attachments rendered: two text logs and two JSON response files, each with
  filename/MIME/size metadata, an inline preview, and a working download.
- A hosted download of `failure-response.json` returned the original parsed
  payload (`Ada Lovelace`, role `engineer`). Both dashboards also opened from
  local `file://` paths with all evidence links resolving on disk.
- Browser validation found 2 Playwright evidence cards and 4 JUnit evidence
  cards, with 0 console errors and 0 page errors.
- Automated evidence tests cover generic projection, JSON/text previews,
  binary download-only behavior, 128 KiB truncation, missing files, unsafe and
  encoded paths, escaping symlinks, generic downloads, and compatibility with
  screenshot, video, and trace rendering.
- Final verification: typecheck passed; external sample typecheck passed;
  reporting 5/5, universal 39/39, Playwright adapter 3/3, JUnit 24/24,
  dashboard evidence 1/1, and installed-package 1/1 tests passed.
- Native Playwright report copy failure is non-fatal to the test process and
  cannot publish a partial universal report: it logs the error, leaves prior
  history and `latest` unchanged, and writes neither `run.json` nor
  `results.json` in the newly reserved incomplete directory.
- All 312 real historical report files excluding `reports/latest/` remained
  byte-identical, and the real latest redirect still points to
  `28-Oct-2026_02-47-PM`.

## Verification record — 2026-10-28 (Phase 5)

- Standalone Playwright TypeScript run `28-Oct-2026_04-01-PM`: four unique tests — 1 passed, 1 intentional failure, 1 skipped, and 1 flaky with two attempts. Exit code 1 was expected. Two screenshots, logs, steps, the failure stack, and the native HTML report were present at valid paths.
- Independent REST Assured 6.3.0/JUnit 5.11.4 run: Maven Surefire 3.5.2 produced four testcases — 2 passed, 1 intentional failure, and 1 skipped. Maven exit code 1 was expected. JUnit conversion run `28-Oct-2026_04-01-PM` exited 0, copied one XML source and four manifest attachments, and retained the assertion message, Java stack, and stdout/response logs.
- Both canonical `run.json` files and schema-v2 `results.json` projections had four tests with matching statuses and summaries; neither retries nor suite memberships were double-counted.
- Headless Chromium validation passed every dashboard check. The Playwright dashboard showed its browser filter, project/browser column, native report link, retry/step details, and screenshot. The JUnit dashboard hid its browser filter, used **Suite / Class**, showed failure/log details, and had no Playwright links. Both had 0 console errors and 0 page errors, and all presented evidence/report paths resolved.
- CLI safety checks: malformed XML, 64 MiB + 1 byte XML, absolute attachment paths, `..` traversal, and escaping symlinks each exited 1 without a run folder. External/custom XML entities stayed literal and did not expose `/etc/passwd`.
- The JUnit CLI completed with exit code 0 while imports of `playwright` and `@playwright/test` were blocked.
- `npm run typecheck`: passed. External Playwright sample typecheck: passed. `npm run test:reporting`: 5/5; `npm run test:universal`: 35/35; `npm run test:adapter`: 3/3; `npm run test:junit`: 24/24.
- All 312 real historical report files excluding `reports/latest/` remained byte-identical; real `reports/latest/index.html` still points to `28-Oct-2026_02-47-PM`.

## Verification record — 2026-10-28 (Phase 4)

- `npm run typecheck`: passed with no TypeScript errors.
- `npm run test:reporting`: 5/5 reporting tests passed.
- `npm run test:universal`: 35/35 tests passed; all 12 available runs reported `differences=0`.
- `npm run test:adapter`: 3/3 adapter tests passed; the Playwright path continues to use the shared writer and projection.
- `npm run test:junit`: 21/21 tests passed, covering Pytest, Surefire, REST Assured/TestNG-style XML, nested suites, missing metadata, empty runs, malformed XML, entities/CDATA, manifest matching, ambiguity, missing files, cleanup, dashboard labels, and absence of Playwright imports.
- JUnit-only validation used a temporary reports root. The generated run contained 5 tests (2 passed, 2 failed, 1 skipped) with 3 manifest attachments; `run.json` validated as schema `1.0.0`, `results.json` stayed schema 2 with 5 tests (no double-counting), and the dashboard hid the browser filter, rendered evidence links and logs, and produced 0 console errors.
- The real Playwright `reports/latest/index.html` dashboard was regression-checked in Chromium: 3 test rows, visible browser filter, Playwright report link, and 0 console errors.
- All 312 historical `reports/` files excluding `reports/latest/` were byte-identical after Phase 4; `reports/latest/index.html` still points to `28-Oct-2026_02-47-PM`.

## Verification record — 2026-10-28 (Phase 3)

- `npm run typecheck`: passed with no TypeScript errors.
- `npm run test:reporting`: 5/5 reporting tests passed.
- `npm run test:universal`: 35/35 tests passed; all 12 available runs reported `differences=0`.
- `npm run test:adapter`: 3/3 adapter tests passed, covering canonical output, legacy compatibility, flaky retries, evidence, and failure isolation.
- Full invocation Run ID `28-Oct-2026_02-47-PM`: 3 total, 2 passed, 1 intentional failure, 0 skipped, 0 flaky, 66.7% pass rate, 7406.278 ms.
- `run.json` validated as schema `1.0.0`; `results.json` remained schema 2 and compared with zero differences against the previous `27-Oct-2026_12-23-PM` report.
- Screenshot, WebM video, trace ZIP, and the native Playwright report were copied into the new run folder.
- Browser validation of the new dashboard found 6 filters, 3 test rows, 12 history rows, 3 evidence links in the failed-test dialog, and 0 console errors.
- All 284 historical report files except `reports/latest/index.html` were byte-identical after the run; latest intentionally points to `28-Oct-2026_02-47-PM`.

## Verification record — 2026-10-26

- `npm run test:reporting`: 5/5 reporting tests passed.
- `npm run typecheck`: passed with no TypeScript errors.
- Regression invocation Run ID `26-Oct-2026_11-02-PM`: 2 passed, 0 failed.
- Final full invocation Run ID `26-Oct-2026_11-06-PM`: 3 total, 2 passed, 1 intentional failure, 0 skipped, 0 flaky, 66.7% pass rate.
- Chromium UI validation confirmed the clean header, six metrics, overlapping suite counts without overall duplication, all combined filters, empty states, failure-first ordering, test details, historical insight, IST display, and screenshot/video/trace references with no client errors.
- `reports/latest/index.html` points to `26-Oct-2026_11-06-PM`, the newest completed report at verification time.

No synthetic execution result was written. The reporting unit tests use small in-memory fixtures only to verify model and HTML contracts.
