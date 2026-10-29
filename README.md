# Universal QA Reporter — GitHub distribution

`universal-qa-reporter@0.1.2` is distributed from the public
`reporter-dist` branch of `ydvgaurav1/Playwright-Tutorial`. Consumers install
directly from GitHub over HTTPS without npm publication, GitHub Packages
authentication, personal access tokens, SSH keys, or manual `.tgz` files.

The branch contains only the installable package: compiled CommonJS JavaScript,
TypeScript declarations, package metadata, the MIT license, the canonical JSON
Schema, the JUnit CLI, and documentation. It does not contain the Playwright
tutorial source, tests, build scripts, or generated reports.

## Requirements

- Node.js 20 or newer
- Playwright projects: `@playwright/test >=1.64.0`
- JUnit projects: a framework-generated JUnit XML file; Playwright is not needed

## Install from GitHub

```bash
npm install --save-dev github:ydvgaurav1/Playwright-Tutorial#reporter-dist
```

No registry mapping, `npm login`, token, SSH key, or GitHub Packages access is
required. The repository is public, and npm downloads the branch tarball from
GitHub over HTTPS.

The equivalent explicit URL is:

```bash
npm install --save-dev https://github.com/ydvgaurav1/Playwright-Tutorial.git#reporter-dist
```

To pin an exact reviewed distribution commit instead of the moving branch:

```bash
npm install --save-dev github:ydvgaurav1/Playwright-Tutorial#<commit-sha>
```

Commit the resulting `package-lock.json` so every teammate and CI job installs
the same distribution revision.

## Playwright TypeScript

Keep Playwright's HTML reporter and point both reporters at the same staging
location:

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
    ["html", { outputFolder: playwrightReportDirectory, open: "never" }],
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
});
```

Run Playwright normally:

```bash
npx playwright test
```

The native HTML directory must exist when the universal reporter finishes. If
copying it fails, the reporter logs a generation error, does not write
`run.json` or `results.json`, does not change `reports/latest`, does not alter
older reports, and does not replace Playwright's original test exit status.

## JUnit XML from Java or Python

Generate JUnit XML with the framework's existing tooling:

```bash
# Java / Maven Surefire
mvn test
# XML is normally under target/surefire-reports/

# Python / pytest
pytest --junitxml=test-results/junit.xml
```

Convert one file or a directory of XML files:

```bash
npx universal-qa-report target/surefire-reports \
  --reports-root reports \
  --framework rest-assured \
  --environment local \
  --base-url http://localhost:8080

npx universal-qa-report test-results/junit.xml \
  --reports-root reports \
  --framework pytest \
  --environment local
```

Useful CLI options:

```text
--input <path>         Repeatable XML file or directory
--reports-root <dir>   Output root (default: reports)
--timezone <zone>      IANA timezone (default: Asia/Kolkata)
--environment <name>   Environment label
--base-url <url>       Base URL metadata
--framework <name>     Explicit source framework label
--manifest <file>      Generic evidence manifest
--started-at <iso>     Timestamp fallback
--metadata <k=v>       Repeatable extension metadata
--latest-title <t>     Latest redirect title
```

Run `npx universal-qa-report --help` for the authoritative command help. See
[`adapters/junit/README.md`](adapters/junit/README.md) for XML mappings,
attachment manifests, dashboard behavior, and limitations.

## Report locations

For `--reports-root reports`, each completed run has this shape:

```text
reports/
├── <run-id>/
│   ├── dashboard/index.html     # universal dashboard
│   ├── run.json                 # canonical schema 1.0.0 document
│   ├── results.json             # dashboard/history projection
│   ├── playwright-report/       # Playwright only
│   ├── junit/                   # copied JUnit XML sources
│   └── attachments/             # generic evidence
└── latest/index.html            # redirect to newest completed run
```

Open `reports/latest/index.html` for the newest dashboard. Historical run
folders remain intact, and `latest` changes only after a complete, validated
report has been written.

## Package API

| Import / command | Purpose |
| --- | --- |
| `universal-qa-reporter` | Canonical types, validation, metrics, projection, writer |
| `universal-qa-reporter/junit` | Programmatic JUnit report generator |
| `universal-qa-reporter/playwright` | Playwright reporter entry point |
| `universal-qa-reporter/dashboard` | Dashboard renderer |
| `universal-qa-reporter/schema` | Canonical JSON Schema |
| `universal-qa-report` | Installed JUnit XML CLI |

## Windows compatibility

The distribution contains JavaScript, declarations, JSON, Markdown, and the MIT
license only. It has no native modules, symlinks, platform-specific binaries, or
install/build scripts, so `npm install` works on Windows, macOS, and Linux.

Use Node's `path` module in Playwright configuration and run commands from
PowerShell, Command Prompt, or a POSIX shell. npm creates the
`universal-qa-report` command shim for the host platform automatically.

## Updating

The `reporter-dist` branch is updated only from a reviewed and tested source
release. Reinstall to move to the latest distribution revision, or pin a commit
for reproducible installs:

```bash
npm install --save-dev github:ydvgaurav1/Playwright-Tutorial#reporter-dist
```

## Distribution scope

This branch is not published to npm. The source package candidate remains on
the `release/universal-qa-reporter-npm-v0.1.2` branch, and the private GitHub
Packages release `@ydvgaurav1/universal-qa-reporter@0.1.1` remains separate and
unchanged.

## License

MIT. See [LICENSE](LICENSE).
