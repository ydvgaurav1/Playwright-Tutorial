# Universal QA Reporter — Private GitHub Package

`@ydvgaurav1/universal-qa-reporter` is prepared for private distribution through
GitHub Packages. Consumers install by package name and do not copy reporter
source files or exchange local archives.

## Requirements

- Node.js 20 or newer
- Playwright projects: `@playwright/test >=1.64.0`
- JUnit projects: a framework-generated JUnit XML file; Playwright is not needed

## Authenticate to GitHub Packages

Approved users need a GitHub personal access token (classic) with only
`read:packages`, plus read access to the private package. Authorize the token for
the organization if SAML SSO applies. Never commit the token.

Configure the registry and environment-based credential in the consuming
project's `.npmrc`:

```ini
@ydvgaurav1:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

The placeholder is safe to commit; the token value is not.

### macOS and Linux

```bash
export NODE_AUTH_TOKEN="YOUR_CLASSIC_PAT"
npm install --save-exact @ydvgaurav1/universal-qa-reporter@0.1.0
```

### Windows PowerShell

```powershell
$env:NODE_AUTH_TOKEN = "YOUR_CLASSIC_PAT"
npm install --save-exact @ydvgaurav1/universal-qa-reporter@0.1.0
```

### Windows Command Prompt

```cmd
set NODE_AUTH_TOKEN=YOUR_CLASSIC_PAT
npm install --save-exact @ydvgaurav1/universal-qa-reporter@0.1.0
```

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
      "@ydvgaurav1/universal-qa-reporter/playwright",
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
| `@ydvgaurav1/universal-qa-reporter` | Canonical types, validation, metrics, projection, writer |
| `@ydvgaurav1/universal-qa-reporter/junit` | Programmatic JUnit report generator |
| `@ydvgaurav1/universal-qa-reporter/playwright` | Playwright reporter entry point |
| `@ydvgaurav1/universal-qa-reporter/dashboard` | Dashboard renderer |
| `@ydvgaurav1/universal-qa-reporter/schema` | Canonical JSON Schema |
| `universal-qa-report` | Installed JUnit XML CLI |

## Updates

Published versions are immutable. Install an approved update explicitly and
commit the resulting lockfile:

```bash
npm install --save-exact @ydvgaurav1/universal-qa-reporter@0.1.1
```

## Publication controls

`.github/workflows/publish-universal-qa-reporter.yml` is manual-only. It checks
the requested version and `universal-qa-reporter-v<version>` tag, runs the full
reporting test suite, builds the package, shows `npm pack --dry-run`, and then
publishes with the workflow's short-lived `GITHUB_TOKEN`. The workflow grants
only `contents: read` and `packages: write`.

Before first publication, configure the `github-packages` environment with
required reviewers. GitHub Packages creates the first version as private; keep
visibility **Private** and grant approved users **Read** access. Do not change it
to public. The package has not yet been published.

### Approval-gated first publication

1. Review and merge the scoped metadata, workflow, package dry-run, and test
   results.
2. In repository settings, create the `github-packages` environment and add the
   required release reviewers.
3. Tag the approved commit and push only the tag:

   ```bash
   git tag -a universal-qa-reporter-v0.1.0 -m "Universal QA Reporter 0.1.0"
   git push origin universal-qa-reporter-v0.1.0
   ```

4. In GitHub Actions, manually run **Publish Universal QA Reporter** against the
   tagged commit with `version` set to `0.1.0` and `confirm_publish` enabled.
5. Approve the protected environment deployment. The workflow then validates,
   packs, and publishes with restricted access.
6. Confirm package visibility is **Private**, then grant only approved users
   **Read** access. Consumers should not receive Write or Admin access.

See `adapters/junit/README.md` for detailed XML mappings and limits.
