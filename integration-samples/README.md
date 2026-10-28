# External integration samples

These projects validate the universal reporter from outside the repository's
production `tests/` directory. They do not import the repository's fixtures or
page objects, and they do not duplicate the dashboard or reporting engine.

Both samples write to temporary report roots during validation. Nothing here
writes to the repository's real `reports/` history or `reports/latest`.

## Samples

| Sample | Framework | Result producer | Reporter path |
| --- | --- | --- | --- |
| `playwright-ts/` | Playwright Test 1.64.x | Native Playwright results | `reporting/playwright-reporter.ts` |
| `rest-assured-java/` | REST Assured 6.3.0 + JUnit 5.11.4 | Maven Surefire JUnit XML | `npm run report:junit` |

The Java sample is an API project, not a browser project. It starts a local
HTTP server, so it does not require network access after Maven dependencies
have been downloaded.

## Playwright sample

Prerequisites:

- Node.js 22+
- `@playwright/test` installed (the sample resolves the repository installation)
- Playwright Chromium installed

Run from the repository root:

```bash
cd integration-samples/playwright-ts
EXTERNAL_PLAYWRIGHT_REPORTS_ROOT=/tmp/qa-playwright-reports \
  ../../node_modules/.bin/playwright test
```

Exit code `1` is expected because one test fails on purpose. The run also
contains one pass, one skip, and one flaky result produced by a real retry.

The dashboard is written to:

```text
/tmp/qa-playwright-reports/<run-id>/dashboard/index.html
```

The native Playwright report is copied to
`<run-id>/playwright-report/index.html`, and `latest/index.html` redirects to
the newest completed run.

### Configuration for an external Playwright project

1. Install Playwright and its browser in the external project.
2. Authenticate to GitHub Packages and install
   `@ydvgaurav1/universal-qa-reporter`.
3. Register `@ydvgaurav1/universal-qa-reporter/playwright` as a reporter and pass
   `reportsRoot`, `stagingDirectory`, `playwrightReportDirectory`, `timezone`,
   `environment`, and `baseURL`.
4. Keep the native `html` reporter if the dashboard should link to it.
5. Run the project normally. No production test changes are required.

The repository sample defaults to a source path for contributor validation. Set
the reporter module name to validate the installed private package instead.

With `NODE_AUTH_TOKEN` configured as documented in `reporting/README.md`:

```bash
npm install --save-exact @ydvgaurav1/universal-qa-reporter@0.1.0
EXTERNAL_PLAYWRIGHT_REPORTER=@ydvgaurav1/universal-qa-reporter/playwright \
EXTERNAL_PLAYWRIGHT_REPORTS_ROOT=/tmp/qa-playwright-reports \
  npx playwright test
```

## REST Assured / JUnit sample

Prerequisites:

- Java 21+
- Maven 3.9.x (not installed globally in the validation environment; Apache
  Maven 3.9.9 was downloaded to a temporary directory)
- Node.js 22+
- For external use, authenticated access to the private
  `@ydvgaurav1/universal-qa-reporter` package

Run the tests:

```bash
cd integration-samples/rest-assured-java
mvn -B test
```

Exit code `1` is expected because one test fails on purpose. Surefire writes:

```text
target/surefire-reports/TEST-dev.universalqa.samples.UserApiTest.xml
```

Convert it from the repository root:

```bash
npm run report:junit -- \
  integration-samples/rest-assured-java/target/surefire-reports/TEST-dev.universalqa.samples.UserApiTest.xml \
  --reports-root /tmp/qa-junit-reports \
  --environment external-rest-assured \
  --base-url http://127.0.0.1 \
  --framework rest-assured \
  --manifest integration-samples/rest-assured-java/attachments.json
```

The dashboard is written to:

```text
/tmp/qa-junit-reports/<run-id>/dashboard/index.html
```

`--framework rest-assured` is used because Surefire is only the XML producer;
the tested framework is REST Assured. Without it, detection would report the
Maven Surefire toolchain from the file path.

### Minimum configuration for an external JUnit project

1. Produce JUnit-compatible XML with the project's normal test runner.
2. Install the private GitHub package and use `npx universal-qa-report`;
   Playwright installation is not required.
3. Pass the XML file or directory, a writable reports root, and an optional
   framework override.
4. Add an attachment manifest when evidence must be copied. Manifest paths are
   relative to the manifest file and must remain inside its directory.
5. Keep the XML and manifest as the external report sources; the converter
   copies them into the immutable run folder.

## Attachment manifest rules

- Paths must be relative to the manifest file.
- Absolute paths, `..` escapes, NUL bytes, and symlinks that resolve outside the
  manifest directory are rejected.
- A selector must identify exactly one test (`testId`, `nativeId`, or
  `classname` + `testName`, optionally `suite`). Unknown or ambiguous selectors
  are hard errors.
- `log` attachments are also added to the attempt's logs (truncated at 256 KiB).

## Universal evidence behavior

- Screenshots retain their inline image preview and open link.
- Videos retain native browser playback.
- Playwright traces retain their ZIP download and trace-viewer instructions.
- JSON and `text/*` attachments receive a bounded, inert preview embedded in
  the generated report. Attachment content is assigned through `textContent`
  and is never executed.
- Every safe generic attachment has a download action plus filename, MIME type,
  and measured size.
- Missing files, unsafe paths, encoded traversal, non-files, and symlinks that
  leave the run directory render an unavailable state without a link.
- Downloads use run-relative URLs, so the same report works from local disk and
  a future static host. No cloud service is implemented.

## Current limitations

- Each JUnit XML file is capped at 64 MiB. Larger files are rejected before a
  run folder is reserved.
- JUnit XML has no standard steps, retries, browser metadata, per-test
  timestamps, or attachment links. Missing values are recorded as unsupported
  and are not invented.
- Text/JSON previews are limited to 128 KiB. Larger attachments remain fully
  downloadable and are marked as truncated in the preview.
- Binary and unsupported MIME types are downloadable but are not previewed.
- Only Playwright Test and JUnit XML from REST Assured have been executed
  externally. Parser fixtures cover other JUnit-style producers, but no
  compatibility claim is made for frameworks that were not run.
- These samples are validation fixtures, not a cloud service.
