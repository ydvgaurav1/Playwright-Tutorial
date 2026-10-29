# JUnit XML Adapter

Converts JUnit-compatible XML into the canonical `run.json` and renders the
existing dashboard. The converter is standalone: it never imports Playwright and
does not run a test framework.

## Usage

After installing `universal-qa-reporter` from the public npm registry:

```bash
# One file
npx universal-qa-report path/to/junit.xml

# Several files or directories (directories are scanned recursively for *.xml)
npx universal-qa-report results/pytest.xml results/surefire/ --environment staging

# Explicit framework, fallback start, and evidence manifest
npx universal-qa-report results/ \
  --framework selenium \
  --started-at 2026-10-27T06:53:47.569Z \
  --manifest evidence/attachments.json

# Help
npx universal-qa-report --help
```

Repository contributors can run the same CLI through
`npm run report:junit -- <arguments>` from the repository root.

Output uses the same run-folder shape as the Playwright adapter:

```
reports/<run-id>/
├── run.json              # canonical schema 1.0.0
├── results.json          # schema-v2 projection used by the dashboard
├── dashboard/index.html  # existing dashboard, JUnit labels
├── junit/<source>.xml    # copied source XML
├── junit-manifest.json   # copied manifest, when supplied
└── attachments/<test-id>/<file>  # manifest evidence
```

`reports/latest/index.html` is updated only after a complete, validated report
has been written. A failed conversion removes the reserved run folder and leaves
history and `latest` untouched.

## XML mapping

| JUnit XML | Canonical field |
|---|---|
| `<testcase>` | Exactly one `TestRecord` with exactly one attempt. |
| `<failure>`, `<error>` | `status: "failed"`; message, type, and stack text are preserved. |
| `<skipped>` | `status: "skipped"`. |
| No failure/error/skipped | `status: "passed"`. |
| `classname`, `name` | Stable identity and `nativeId` (`classname#name`). |
| `file`, `line` | `source.file`, `source.line`. |
| `time` | Test duration in milliseconds. Run duration prefers root `time`, then suite `time`, then the sum of testcase times. |
| `timestamp` | Test attempt start. Run start prefers the earliest testcase timestamp, then suite timestamp, then CLI `--started-at`, then source file mtime, then generation time. |
| `<system-out>`, `<system-err>` | Log records. Suite-level output is attached once, to the first test in the suite. |
| `<properties>` | Framework, environment, module, tags, base URL, branch, commit, OS, runtime, and framework version. |
| `<testsuite>` nesting | `extensions.junit.suitePath`, `titlePath`, and suite labels. |

Identity is derived from the source path, suite path, classname, test name, and
an occurrence counter (FNV-1a hash). IDs are stable across repeated conversions
of the same XML and never collide for duplicate names.

Framework detection uses properties, suite names, and file paths, and records
the source (`cli`, `xml`, or `default`) in `extensions.junit.frameworkSource`.
Use `--framework` to override detection. JUnit XML produced by Selenium,
REST Assured, Pytest, and similar tools is supported as JUnit-compatible input;
no native integration is claimed.

## Attachment manifest

JUnit XML has no standard evidence link. Evidence is copied only when a manifest
names both the test and the file. Paths are resolved relative to the manifest.
Absolute paths, parent-directory escapes, NUL bytes, and symlinks that resolve
outside the manifest directory are rejected.

```json
{
  "version": 1,
  "attachments": [
    {
      "classname": "com.example.LoginTest",
      "testName": "invalidLogin",
      "suite": "com.example.LoginTest",
      "kind": "screenshot",
      "path": "evidence/failure.png"
    },
    {
      "testId": "junit-1a2b3c4d",
      "kind": "log",
      "path": "evidence/server.log"
    }
  ]
}
```

A test is selected by one of:

- `testId` — the canonical stable ID from `run.json`
- `nativeId` — `classname#testName`
- `classname` + `testName`, with optional `suite`

`kind` is one of `screenshot`, `video`, `trace`, `log`, `file`, or
`native-report`. Unknown or ambiguous selectors and missing files are hard
errors; the converter never guesses. `log` attachments also add a log record
(truncated at 256 KiB). Copied evidence records include byte counts and SHA-256
hashes, and the manifest is copied into the run as `junit-manifest.json`.

## Dashboard

The same dashboard template is used with JUnit labels:

- title: **JUnit Execution Dashboard**
- variant column: **Suite / Class**
- runtime row: **Runtime**
- no Playwright report or Trace Viewer links

Browser, project, and retry fields are shown as `Not captured` or `0` because
JUnit XML does not define them. The browser filter is hidden when no browser
data exists, and empty runs render explicit empty states.

## Limitations

JUnit XML has no standard representation for retries, steps, browser metadata,
per-test timestamps, or attachment links. The adapter therefore:

- creates one attempt per testcase and never invents retries or steps;
- leaves `environment.browsers` and `variant.browser` absent;
- uses the documented timestamp fallbacks and records the chosen source in
  `extensions.junit.timestampSource` and
  `attempts[].extensions.junit.timestampSource`;
- copies only manifest evidence;
- rejects any individual XML file larger than 64 MiB before reading it or
  reserving a run folder;
- records warnings in `extensions.junit.warnings` rather than failing on
  recoverable gaps.

The universal dashboard renders every manifest evidence record. Screenshots,
videos, and traces retain their framework-specific presentation. Generic files
receive a safe download action with filename, MIME type, and measured size.
JSON and `text/*` files receive an inert preview capped at 128 KiB; larger or
binary files remain downloadable without an inline preview. A `log` attachment
is also shown in the dashboard's **Available logs** section.

Before rendering, the shared writer revalidates each dashboard-relative path,
checks the real filesystem path remains inside the run directory, and marks
missing, non-file, traversal, encoded-path, or escaping-symlink evidence
unavailable. The browser performs the same relative-path check before creating
a link. Preview text is embedded at generation time and rendered with
`textContent`, which keeps local `file://` reports read-only and avoids executing
attachment content.

## Tests

```bash
npm run test:junit
```

Fixtures cover Pytest, Maven Surefire, REST Assured/TestNG-style XML, nested
suites, missing metadata, empty runs, malformed XML, entity/CDATA handling,
oversized input, manifest matching, path traversal, absolute paths, and symlink
escapes. Tests use temporary report roots and never modify `reports/` or
`reports/latest`.
