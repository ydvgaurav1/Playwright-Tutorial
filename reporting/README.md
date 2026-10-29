# Universal QA Reporter — Public npm Package

`universal-qa-reporter` is prepared for public distribution through the official
npm registry. After publication, consumers install by package name without
GitHub authentication, personal access tokens, or local archives.

## Requirements

- Node.js 20 or newer
- Playwright projects: `@playwright/test >=1.64.0`
- JUnit projects: a framework-generated JUnit XML file; Playwright is not needed

## Install from npm

```bash
npm install --save-dev --save-exact universal-qa-reporter@0.1.2
```

No registry mapping, npm login, or authentication token is required for public
package installation.

## Playwright TypeScript

Keep Playwright's HTML reporter and point both reporters at the same staging
location:

```ts
import path from "node:path";
import { defineConfig } from "@playwright/test";

const reportsRoot = path.resolve("reports");
const stagingDirectory = path.join(reportsRoot, ".current");
const playwrightReportDirectory = path.join(stagingDirectory, "playwright-report");

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
older reports, and does not replace Playwright's original test exit status. A
new incomplete reserved directory may remain and is ignored by history because
it has no valid `results.json`.

## JUnit XML from Java or Python

Generate JUnit XML using the framework's existing tooling. Examples:

```bash
# Java / Maven Surefire
mvn test
# XML is normally under target/surefire-reports/

# Python / pytest
pytest --junitxml=test-results/junit.xml
```

These commands describe XML production, not additional native adapters. Convert
the resulting file or a directory of XML files:

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
--reports-root <dir>  Output root (default: reports)
--timezone <zone>     IANA timezone (default: Asia/Kolkata)
--environment <name> Environment label
--base-url <url>      Base URL metadata
--framework <name>   Explicit source framework label
--manifest <file>    Generic evidence manifest
--started-at <iso>   Timestamp fallback
--metadata <k=v>     Repeatable extension metadata
--latest-title <t>   Latest redirect title
```

Run `npx universal-qa-report --help` for the authoritative command help.

### Optional JUnit evidence manifest

Manifest paths are relative to the manifest file and must remain inside its
directory:

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

## Evidence behavior

- Screenshots: inline preview and open action
- Videos: native browser playback
- Playwright traces: ZIP download and trace-viewer guidance
- JSON and `text/*`: inert, read-only preview capped at 128 KiB plus download
- Other safe files: metadata and download without preview
- Every card shows filename, MIME type, and measured size when available
- Missing, non-file, traversal, encoded, absolute, or escaping-symlink paths are
  unavailable and receive no link

Evidence paths are run-relative, so reports work from local disk and static HTTP
hosting. Attachment content is rendered through `textContent` and never executed.

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

## Package API

| Import / command | Purpose |
| --- | --- |
| `universal-qa-reporter` | Canonical types, validation, metrics, projection, writer |
| `universal-qa-reporter/junit` | Programmatic JUnit report generator |
| `universal-qa-reporter/playwright` | Playwright reporter entry point |
| `universal-qa-reporter/dashboard` | Dashboard renderer |
| `universal-qa-reporter/schema` | Canonical JSON Schema |
| `universal-qa-report` | Installed JUnit XML CLI |

## Updates

Published versions are immutable. Install an approved update explicitly and
commit the resulting lockfile:

```bash
npm install --save-dev --save-exact universal-qa-reporter@0.1.2
```

## Publication controls

`.github/workflows/publish-universal-qa-reporter.yml` is manual-only. It checks
the requested version and `universal-qa-reporter-npm-v<version>` tag, runs the
full reporting test suite, builds and inspects the package, and is designed for
npm Trusted Publishing with provenance through a protected `npm-production`
environment.

The workflow also requires an approved SPDX license and the matching
`reporting/LICENSE` file; the `0.1.2` candidate declares `MIT` and includes the
license in the published tarball. This `0.1.2` candidate has not been published
to npm and requires explicit publication approval.

The existing private GitHub Packages release
`@ydvgaurav1/universal-qa-reporter@0.1.1` remains a separate, unchanged package.

## License

MIT. See [LICENSE](LICENSE).

See `adapters/junit/README.md` for detailed XML mappings and limits.
