# Universal QA Reporter

`universal-qa-reporter` is a framework-neutral QA reporting package that turns
automated test results into a compact, professional HTML execution dashboard.

It integrates directly with Playwright and can also convert JUnit XML generated
by Java, pytest, Selenium, REST Assured, TestNG, and similar tools. Teams receive
one consistent reporting experience without replacing their existing test
runner or rewriting test cases.

## What problem does it solve?

Test runners are responsible for execution, but their reports often differ
between frameworks and projects. This makes it harder for QA engineers,
developers, and stakeholders to compare runs and quickly identify failures.

Universal QA Reporter adds a consistent presentation and storage layer:

- one dashboard format across supported frameworks;
- concise execution verdict and fixed run-level metrics;
- failed and flaky tests prioritized for triage;
- filters for status, browser, suite, module, and spec;
- screenshots, videos, traces, errors, attempts, and logs;
- immutable timestamped report folders;
- latest-run navigation and execution history;
- canonical JSON output for future integrations;
- responsive desktop and mobile layouts.

## What the package does

The package:

1. receives completed execution data from Playwright or JUnit XML;
2. normalizes the data into a framework-neutral run model;
3. derives summaries for tests, suites, modules, and spec files;
4. safely copies and links available evidence;
5. renders a self-contained HTML dashboard;
6. preserves the framework's native report when available;
7. writes an immutable run folder;
8. updates `reports/latest` only after successful report generation.

## What the package does not do

Universal QA Reporter does **not**:

- replace Playwright, pytest, Maven, TestNG, or another runner;
- execute tests;
- change pass, fail, skipped, or flaky outcomes;
- retry failed tests;
- modify test cases, fixtures, page objects, or application code;
- upload data to a hosted service;
- require a database;
- require a report server.

The original test runner remains authoritative. If tests fail, the runner still
returns its normal nonzero exit code.

## Supported integrations

| Integration | How results are collected |
| --- | --- |
| Playwright | Reporter lifecycle events |
| Java / Maven Surefire | JUnit XML conversion |
| REST Assured / TestNG | JUnit-compatible XML conversion |
| pytest | `--junitxml` conversion |
| Selenium | JUnit-compatible XML conversion |
| Other frameworks | Any supported JUnit XML plus optional evidence manifest |

## Package identity and status

```text
Name: universal-qa-reporter
Version: 0.1.2
License: MIT
Node.js: 20 or newer
Playwright peer: @playwright/test 1.64.0 or newer
```

Version `0.1.2` is prepared as a public npm package candidate. It has not yet
been published to the public npm registry.

### Current installation

Until public npm publication is approved, install the reviewed GitHub
distribution:

```bash
npm install --save-dev github:ydvgaurav1/Playwright-Tutorial#reporter-dist
```

For reproducible teammate and CI installations, pin an approved distribution
commit instead of a moving branch. See
[INSTALLATION_GUIDE.md](INSTALLATION_GUIDE.md).

### Installation after npm publication

After version `0.1.2` is published:

```bash
npm install --save-dev --save-exact universal-qa-reporter@0.1.2
```

Do not use this public npm command before publication; npm will return
`404 Not Found`.

## Playwright integration

### Requirements

- Node.js 20 or newer
- npm
- `@playwright/test` 1.64.0 or newer
- at least one installed Playwright browser

### Configure the reporter

Merge the following values into the existing `playwright.config.ts`. Preserve
the project's existing tests, browser projects, timeouts, retries, and unrelated
reporters.

```ts
import path from "node:path";
import { defineConfig } from "@playwright/test";

const reportsRoot = path.resolve("reports");
const stagingDirectory = path.join(reportsRoot, ".current");
const playwrightReportDirectory = path.join(
  stagingDirectory,
  "playwright-report",
);

export default defineConfig({
  outputDir: path.join(stagingDirectory, "playwright-artifacts"),

  reporter: [
    ["list"],
    [
      "html",
      {
        outputFolder: playwrightReportDirectory,
        open: "never",
      },
    ],
    [
      "universal-qa-reporter/playwright",
      {
        reportsRoot,
        stagingDirectory,
        playwrightReportDirectory,
        timezone: "Asia/Kolkata",
        environment: process.env.TEST_ENV ?? "local",
        baseURL: process.env.BASE_URL ?? "",
      },
    ],
  ],

  use: {
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
  },
});
```

### Why the native HTML reporter is retained

The universal dashboard complements the Playwright HTML report rather than
removing it.

- Playwright produces its normal HTML output.
- Universal QA Reporter copies it into the completed run.
- The dashboard provides a direct **Playwright report** link.
- Existing Playwright debugging workflows remain available.

### Run tests

Run the framework normally:

```bash
npx playwright test
```

The reporter prints paths similar to:

```text
Custom dashboard: <project>/reports/<run-id>/dashboard/index.html
Canonical run: <project>/reports/<run-id>/run.json
```

## JUnit XML integration

Playwright is optional. A JUnit consumer only needs Node.js, npm, the reporter
package, and XML produced by its existing framework.

### Generate XML

#### Java / Maven Surefire

```bash
mvn test
```

Surefire normally writes XML under:

```text
target/surefire-reports/
```

#### pytest

```bash
pytest --junitxml=test-results/junit.xml
```

### Convert XML

#### Java, REST Assured, TestNG, or Selenium

```bash
npx universal-qa-report target/surefire-reports \
  --reports-root reports \
  --framework rest-assured \
  --environment local \
  --base-url http://localhost:8080
```

#### pytest

```bash
npx universal-qa-report test-results/junit.xml \
  --reports-root reports \
  --framework pytest \
  --environment local
```

Run the authoritative CLI help:

```bash
npx universal-qa-report --help
```

### JUnit CLI options

| Option | Purpose |
| --- | --- |
| `--input <path>` | Add another XML file or directory |
| `--reports-root <dir>` | Set the output root; default is `reports` |
| `--timezone <zone>` | Set an IANA timezone |
| `--environment <name>` | Record the target environment |
| `--base-url <url>` | Record the application URL |
| `--framework <name>` | Record the source framework |
| `--manifest <file>` | Attach generic evidence |
| `--started-at <iso>` | Supply a fallback start timestamp |
| `--metadata <k=v>` | Add repeatable extension metadata |
| `--latest-title <text>` | Customize the latest redirect title |

## Dashboard capabilities

### Execution summary

- prominent passed, failed, warning, incomplete, or empty verdict;
- total, passed, failed, skipped, flaky, and pass-rate metrics;
- result-distribution visualization;
- run duration and IST execution timestamp;
- environment, browser, and run selector.

Run-level metrics remain fixed while filters are active. Filters change only the
visible result rows and contextual drill-down sections.

### Test triage

- failed tests first;
- flaky tests second;
- dense, sortable-by-priority execution presentation;
- test title, suite, module, spec, status, start time, duration, browser, and
  retry information;
- indicators for new and previously observed failures.

### Search and filters

- free-text search;
- status filter;
- browser filter;
- expandable suite, module, and spec filters;
- selected-filter summary;
- one-action reset;
- themed keyboard-accessible dropdowns.

### Test details

Selecting a test opens:

- execution metadata;
- all attempts and retries;
- captured steps and assertions;
- expected and actual values when available;
- error messages, snippets, and stacks;
- stdout and stderr logs;
- screenshots, videos, traces, and attachments.

### History and comparison

- immutable completed runs;
- latest-run shortcut;
- calendar-based run selector;
- execution history table;
- pass-rate trend;
- suite-scoped historical comparison.

### Responsive and accessible UI

- compact desktop layout;
- responsive mobile layout;
- keyboard-operable rows, filters, charts, and dialogs;
- visible focus states;
- accessible control names;
- reduced-motion support;
- semantic status colors and tabular numeric alignment.

## Evidence support

| Evidence type | Dashboard behavior |
| --- | --- |
| Screenshot | Inline preview and open action |
| Video | Native browser playback |
| Playwright trace | ZIP download and Trace Viewer instructions |
| JSON | Inert read-only preview plus download |
| Text and logs | Inert read-only preview plus download |
| Other safe files | Metadata and download |
| Missing or unsafe file | Marked unavailable without an active link |

Every available evidence item includes its filename, MIME type, and measured
size when captured.

Evidence paths are run-relative, so a completed report can be moved, archived,
or uploaded as one directory without rewriting links.

## Generic JUnit evidence manifest

JUnit XML does not define a standard way to link screenshots or arbitrary
attachments. A manifest can associate files with tests:

```json
{
  "version": 1,
  "attachments": [
    {
      "classname": "com.example.UserApiTest",
      "testName": "returnsUserById",
      "kind": "file",
      "path": "evidence/response.json",
      "mimeType": "application/json"
    },
    {
      "classname": "com.example.UserApiTest",
      "testName": "returnsUserById",
      "kind": "log",
      "path": "evidence/request.log"
    }
  ]
}
```

Manifest paths are relative to the manifest file and must remain inside its
directory. Unsafe traversal, encoded, absolute, and escaping-symlink paths are
blocked.

## Report output

```text
reports/
├── <run-id>/
│   ├── dashboard/
│   │   └── index.html
│   ├── run.json
│   ├── results.json
│   ├── playwright-report/   # Playwright integration
│   ├── junit/               # JUnit integration
│   ├── screenshots/
│   ├── videos/
│   ├── traces/
│   └── attachments/
└── latest/
    └── index.html
```

| Output | Purpose |
| --- | --- |
| `dashboard/index.html` | Self-contained universal dashboard |
| `run.json` | Canonical framework-neutral source record |
| `results.json` | Derived dashboard and history projection |
| `playwright-report/` | Preserved Playwright HTML report |
| `junit/` | Copied JUnit XML sources |
| Evidence folders | Run-specific diagnostic files |
| `latest/index.html` | Redirect to the newest completed report |

Older run folders are never overwritten by a new execution.

## Canonical result model

`run.json` stores normalized source facts:

- producer and framework identity;
- run ID, status, timestamps, duration, and timezone;
- environment and runtime metadata;
- normalized test identities and locations;
- attempts, retries, steps, errors, logs, and evidence.

Summaries, suites, modules, and specs are derived from the canonical test
records rather than persisted as competing sources of truth.

Metric rules:

- pass rate is `passed / total`;
- skipped tests remain in the denominator;
- run duration is wall-clock execution duration;
- group durations sum their member test durations.

## Package entry points

| Import or command | Purpose |
| --- | --- |
| `universal-qa-reporter` | Canonical types, validation, metrics, projection, and writer |
| `universal-qa-reporter/playwright` | Playwright reporter |
| `universal-qa-reporter/junit` | Programmatic JUnit generator |
| `universal-qa-reporter/dashboard` | Dashboard renderer |
| `universal-qa-reporter/schema` | Canonical JSON Schema |
| `universal-qa-report` | JUnit XML conversion CLI |

## Team and CI adoption

### Commit configuration, not reports

Commit:

- the dependency in `package.json`;
- the updated `package-lock.json`;
- Playwright or JUnit integration configuration;
- CI artifact-upload configuration.

Ignore generated output:

```gitignore
reports/
```

### Install reproducibly

After the lockfile is committed:

```bash
npm ci
```

For Playwright CI:

```bash
npx playwright install --with-deps chromium
npx playwright test
```

Upload `reports/` as a CI artifact even when the test command fails. Configure
the CI upload step to run with an equivalent of `if: always()`.

### Recommended rollout

1. Install a pinned package revision.
2. Add the reporter without removing the native report.
3. Run passed and failed test scenarios.
4. Verify screenshots, videos, traces, logs, and attachments.
5. Verify `reports/latest/index.html`.
6. Upload the complete `reports/` directory in CI.
7. Agree on report-retention and cleanup policies.
8. Update the pinned package only after review.

## Updating or removing the package

### Update the current GitHub distribution

```bash
npm install --save-dev github:ydvgaurav1/Playwright-Tutorial#reporter-dist
```

Review and commit the changed lockfile.

### Update a published npm version

```bash
npm install --save-dev --save-exact universal-qa-reporter@<approved-version>
```

### Remove

```bash
npm uninstall universal-qa-reporter
```

Also remove the reporter entry and package-specific staging paths from the
consumer configuration.

## Troubleshooting

### npm returns `404 Not Found`

The package has not yet been published to the public npm registry. Use the
current GitHub distribution:

```bash
npm install --save-dev github:ydvgaurav1/Playwright-Tutorial#reporter-dist
```

### The Playwright reporter cannot be resolved

Verify installation:

```bash
npm list universal-qa-reporter
```

Verify the configured entry point:

```ts
"universal-qa-reporter/playwright"
```

### No dashboard was generated

For Playwright:

1. Confirm the native HTML reporter writes to `playwrightReportDirectory`.
2. Confirm both reporters use the same staging paths.
3. Confirm the process can write to `reportsRoot`.
4. Review the terminal for a generation error.

For JUnit:

1. Confirm the XML path exists.
2. Confirm the XML contains `<testsuite>` or `<testsuites>`.
3. Run `npx universal-qa-report --help`.
4. Pass the XML path explicitly.

### The latest dashboard shows an older run

`reports/latest` changes only after a complete report is written successfully.
Open a specific report directly:

```text
reports/<run-id>/dashboard/index.html
```

### Failure evidence is missing

For Playwright, enable evidence capture in `use`:

```ts
{
  screenshot: "only-on-failure",
  video: "retain-on-failure",
  trace: "retain-on-failure",
}
```

For JUnit, provide a valid evidence manifest.

## Detailed documentation

- [Complete installation guide](INSTALLATION_GUIDE.md)
- [Package reference](reporting/README.md)
- [Reporting architecture](docs/custom-reporting-guide.md)
- [JUnit adapter](reporting/adapters/junit/README.md)
- [Canonical reporting model](reporting/universal/README.md)

## License

Universal QA Reporter is licensed under the MIT License. See
[reporting/LICENSE](reporting/LICENSE).
