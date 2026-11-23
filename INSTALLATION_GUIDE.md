# Universal QA Reporter installation guide

This guide explains how to install and use
`universal-qa-reporter@0.1.2` from the public GitHub repository in a
Playwright, Java/JUnit, or Python/pytest project.

The package is not currently published to the public npm registry. Install it
from the `reporter-dist` branch using the commands below.

## Contents

- [Requirements](#requirements)
- [Choose an installation version](#choose-an-installation-version)
- [Install in a Playwright project](#install-in-a-playwright-project)
- [Install in a JUnit XML project](#install-in-a-junit-xml-project)
- [Open the dashboard](#open-the-dashboard)
- [Report output](#report-output)
- [Team and CI setup](#team-and-ci-setup)
- [Update or remove the package](#update-or-remove-the-package)
- [Troubleshooting](#troubleshooting)

## Requirements

### All projects

- Windows, macOS, or Linux
- Node.js 20 or newer
- npm (included with Node.js)
- Internet access to the public GitHub repository
- A `package.json` in the project where the reporter will be installed

Check the installed versions:

```bash
node --version
npm --version
```

The Node.js version must be `v20` or newer.

If the project does not have a `package.json`, create one:

```bash
npm init -y
```

### Playwright projects

- `@playwright/test` version 1.64.0 or newer
- At least one Playwright browser installed

Check Playwright:

```bash
npx playwright --version
```

Install Playwright and Chromium when starting a new project:

```bash
npm install --save-dev @playwright/test@latest
npx playwright install chromium
```

Linux CI environments may need Playwright's operating-system dependencies:

```bash
npx playwright install --with-deps chromium
```

### JUnit XML projects

Playwright is not required. The project needs a tool that produces JUnit XML,
for example:

- Maven Surefire or another Java test runner
- pytest with `--junitxml`
- Any framework that emits standard JUnit XML

## Choose an installation version

Run installation commands from the project root, next to `package.json`.

### Option 1: Follow the latest reviewed distribution

```bash
npm install --save-dev github:ydvgaurav1/Playwright-Tutorial#reporter-dist
```

Use this option when the project should receive the newest package revision
the next time the dependency is explicitly reinstalled.

### Option 2: Pin the currently reviewed distribution

```bash
npm install --save-dev github:ydvgaurav1/Playwright-Tutorial#7dfa203777c32fe89022b2b88d0ffcb259d6cc56
```

Pinning a commit is recommended for reproducible teammate and CI
installations.

Both commands download from the public GitHub repository over HTTPS. They do
not require:

- `npm login`
- A GitHub personal access token
- GitHub Packages access
- An SSH key
- A private npm registry configuration

Do not use the following command because the package is not published to the
public npm registry:

```bash
npm install universal-qa-reporter
```

## Install in a Playwright project

### 1. Install the reporter

Choose one of the installation commands above, then verify the package:

```bash
npm list universal-qa-reporter
```

Expected package version:

```text
universal-qa-reporter@0.1.2
```

### 2. Configure Playwright

Add the universal reporter to `playwright.config.ts`. Preserve unrelated
settings from the existing configuration.

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
  testDir: "./tests",

  outputDir: path.join(
    stagingDirectory,
    "playwright-artifacts",
  ),

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
    baseURL: process.env.BASE_URL,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
  },
});
```

Why both reporters use the same staging area:

- Playwright writes its native HTML report and artifacts first.
- The universal reporter creates the completed run folder.
- Evidence and the native Playwright report remain linked from the dashboard.
- An incomplete generation does not replace `reports/latest`.

If the project already defines `reporter`, `outputDir`, or `use`, merge these
values instead of creating duplicate configuration keys.

### 3. Protect generated output

Add the following entry to `.gitignore`:

```gitignore
reports/
```

### 4. Run the tests

```bash
npx playwright test
```

The reporter prints output locations similar to:

```text
Custom dashboard: <project>/reports/<run-id>/dashboard/index.html
Canonical run: <project>/reports/<run-id>/run.json
```

The Playwright test exit code remains authoritative. Failed tests still make
the command exit with a nonzero status.

## Install in a JUnit XML project

### 1. Install the reporter

Use either the moving branch or pinned commit installation command from
[Choose an installation version](#choose-an-installation-version).

Playwright will not be installed because it is an optional peer dependency.

Verify the CLI:

```bash
npx universal-qa-report --help
```

### 2. Generate JUnit XML

#### Java with Maven Surefire

```bash
mvn test
```

Surefire XML files are normally written to:

```text
target/surefire-reports/
```

#### Python with pytest

```bash
pytest --junitxml=test-results/junit.xml
```

### 3. Convert the XML into the universal report

Convert a directory of Maven/Surefire XML files:

```bash
npx universal-qa-report target/surefire-reports \
  --reports-root reports \
  --framework rest-assured \
  --environment local \
  --base-url http://localhost:8080
```

Convert a pytest XML file:

```bash
npx universal-qa-report test-results/junit.xml \
  --reports-root reports \
  --framework pytest \
  --environment local
```

On Windows PowerShell, either enter the command on one line or use PowerShell's
backtick continuation character:

```powershell
npx universal-qa-report test-results/junit.xml `
  --reports-root reports `
  --framework pytest `
  --environment local
```

Useful CLI options:

| Option | Purpose |
| --- | --- |
| `--input <path>` | Add another XML file or directory |
| `--reports-root <dir>` | Set the output root; default is `reports` |
| `--timezone <zone>` | Set an IANA timezone; default is `Asia/Kolkata` |
| `--environment <name>` | Record the target environment |
| `--base-url <url>` | Record the application URL |
| `--framework <name>` | Record the source framework |
| `--manifest <file>` | Attach evidence using a generic manifest |
| `--started-at <iso>` | Supply a fallback start timestamp |
| `--metadata <k=v>` | Add repeatable extension metadata |
| `--latest-title <text>` | Customize the latest redirect title |

Run `npx universal-qa-report --help` for the complete command reference.

## Open the dashboard

The newest completed report is:

```text
reports/latest/index.html
```

### macOS

```bash
open reports/latest/index.html
```

### Windows PowerShell

```powershell
Start-Process reports/latest/index.html
```

### Windows Command Prompt

```bat
start reports\latest\index.html
```

### Linux

```bash
xdg-open reports/latest/index.html
```

The dashboard is self-contained and can also be opened directly from a file
browser.

## Report output

For a `reports` output root, completed runs use this structure:

```text
reports/
├── <run-id>/
│   ├── dashboard/
│   │   └── index.html
│   ├── run.json
│   ├── results.json
│   ├── playwright-report/    # Playwright only
│   ├── junit/                # JUnit conversion only
│   ├── screenshots/
│   ├── videos/
│   ├── traces/
│   └── attachments/
└── latest/
    └── index.html
```

- `dashboard/index.html` is the interactive universal dashboard.
- `run.json` is the canonical report document.
- `results.json` supplies the dashboard and historical projection.
- `latest/index.html` redirects to the newest completed run.
- Older run folders remain available for historical comparisons.

## Team and CI setup

### Commit dependency metadata

Commit the dependency declaration and lockfile:

```bash
git add package.json package-lock.json
git commit -m "test: add universal QA reporter"
```

For Playwright projects, also commit:

```bash
git add playwright.config.ts .gitignore
```

Do not commit `reports/`.

### Install from the lockfile

After `package-lock.json` is committed, teammates and CI should run:

```bash
npm ci
```

For Playwright CI, install the required browser:

```bash
npx playwright install --with-deps chromium
```

Then run the normal test command:

```bash
npx playwright test
```

No package authentication secret is required in CI.

## Update or remove the package

### Update a branch-based installation

```bash
npm install --save-dev github:ydvgaurav1/Playwright-Tutorial#reporter-dist
```

Review and commit the updated `package-lock.json`.

### Move a pinned installation to a newer commit

```bash
npm install --save-dev github:ydvgaurav1/Playwright-Tutorial#<new-commit-sha>
```

### Remove the package

```bash
npm uninstall universal-qa-reporter
```

Also remove the universal reporter entry from `playwright.config.ts` if it was
configured there.

## Troubleshooting

### npm reports `404 Not Found`

The package is not on the public npm registry. Use the GitHub installation
command:

```bash
npm install --save-dev github:ydvgaurav1/Playwright-Tutorial#reporter-dist
```

### The Playwright reporter cannot be resolved

Confirm the dependency is installed:

```bash
npm list universal-qa-reporter
```

Confirm the reporter entry uses the exported path:

```ts
"universal-qa-reporter/playwright"
```

Then reinstall dependencies:

```bash
npm ci
```

### No dashboard was generated

For Playwright:

1. Confirm the native HTML reporter uses `playwrightReportDirectory`.
2. Confirm the universal reporter uses the same `stagingDirectory` and
   `playwrightReportDirectory`.
3. Read the terminal output for a reporter generation error.
4. Confirm the process can write to the configured `reportsRoot`.

For JUnit:

1. Confirm the XML file or directory exists.
2. Run `npx universal-qa-report --help`.
3. Pass the input path explicitly.
4. Check that the XML is valid and contains a JUnit `<testsuite>` or
   `<testsuites>` document.

### The browser executable is missing

Install the browser:

```bash
npx playwright install chromium
```

Linux CI may require:

```bash
npx playwright install --with-deps chromium
```

### The latest dashboard shows an older run

Only complete, validated report generations update `reports/latest`. Review the
terminal output for the latest test or conversion command. Open a specific
completed run directly from:

```text
reports/<run-id>/dashboard/index.html
```

### Clean installation

If dependencies are inconsistent, remove `node_modules` using the appropriate
operating-system command and reinstall from the committed lockfile:

```bash
npm ci
```

Avoid deleting `package-lock.json` unless the team intentionally wants to
resolve every dependency again.

## Package entry points

| Import or command | Purpose |
| --- | --- |
| `universal-qa-reporter` | Canonical types, validation, metrics, projection, and writer |
| `universal-qa-reporter/playwright` | Playwright reporter |
| `universal-qa-reporter/junit` | Programmatic JUnit generator |
| `universal-qa-reporter/dashboard` | Dashboard renderer |
| `universal-qa-reporter/schema` | Canonical JSON Schema |
| `universal-qa-report` | JUnit XML command-line converter |

## License

The package is distributed under the MIT License.
