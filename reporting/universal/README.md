# Universal QA Reporting Core

Framework-independent reporting contracts and calculations. This package has no
Playwright, JUnit, or other runner imports. The compatibility reader understands
the legacy Playwright JSON shape, but it does not import Playwright. Adapters
translate runner events into the canonical document defined here; the Playwright
adapter currently lives in `reporting/adapters/playwright/`.

## Status

Phase 3 adds the Playwright adapter. Phase 4 adds the standalone JUnit XML
converter in `reporting/adapters/junit/`. The live Playwright reporter now:

- collects Playwright lifecycle data in `reporting/adapters/playwright/`
- writes canonical `run.json` plus the preserved schema-v2 `results.json`
- renders the existing dashboard from the legacy projection
- preserves history, IST folder labels, latest navigation, and evidence folders

The JUnit converter reads JUnit-compatible XML (Pytest, Selenium/Surefire,
REST Assured/TestNG-style, and similar output), writes the same run-folder shape,
and never imports Playwright. See `reporting/adapters/junit/README.md`.

The original `reporting/custom-reporter.ts` remains in the repository as the
pre-migration reference and is no longer registered in `playwright.config.ts`.

## Canonical document

`RunDocument` is the canonical `run.json` shape. It stores source facts and test
records. It does **not** store `summary`, `suites`, `modules`, or `specs`; those
are derived at read time with `createDerivedReport`.

```ts
import {
  assertValidRunDocument,
  createDerivedReport,
  stringifyRunDocument,
} from "./reporting/universal";

const document = assertValidRunDocument(source);
const derived = createDerivedReport(document.tests, document.run.durationMs);
const json = stringifyRunDocument(document);
```

Metric rules:

- pass rate is `passed / total`, with skipped tests in the denominator
- `run.durationMs` is wall-clock invocation duration
- suite, module, and spec summaries sum their member test durations

Artifact paths in canonical records are relative to the run root. The
compatibility reader converts dashboard-relative legacy paths such as
`../screenshots/a.png` into `screenshots/a.png` in memory. The adapter's legacy
projection performs the reverse when writing `results.json`.

## Validation

```bash
npm run test:universal
npm run test:adapter
npm run test:junit
npm run test:reporting
npm run typecheck
```

The compatibility test reads every completed `reports/*/results.json` and
asserts that the projected model matches the stored legacy model. It never
writes to `reports/`.
