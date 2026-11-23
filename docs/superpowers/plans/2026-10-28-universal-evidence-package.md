# Universal Evidence and Local Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve and safely render every canonical evidence type, then build and install a reusable local `universal-qa-reporter` tarball without publishing it.

**Architecture:** The canonical `run.json` remains authoritative. The schema-v2 dashboard projection will retain every evidence record and its metadata; the shared writer will resolve evidence only inside the immutable run directory, mark unavailable files, and embed bounded text/JSON previews so both `file://` and static cloud hosting work without runtime filesystem APIs. The existing dashboard will render media as before and add metadata, downloads, previews, and graceful unavailable states. A package-local TypeScript build will compile the existing reporting source—without copying it—into a tarball with universal, JUnit, and optional Playwright entry points.

**Tech Stack:** TypeScript 5.9, Node.js 22, Playwright 1.64, Node test runner, npm pack.

## Global Constraints

- Keep the current dark dashboard and do not redesign unrelated components.
- Preserve screenshot previews, video playback, and Playwright trace behavior.
- Treat attachment paths as untrusted and never read outside the run directory.
- Preview only bounded JSON and text content using `textContent`; never execute attachment content.
- Keep local reports functional and use relative URLs suitable for static cloud hosting.
- Do not publish the package or implement cloud hosting, email, databases, or new adapters.
- Do not modify production automation tests.
- Do not commit changes because the worktree contains pre-existing uncommitted user work.

---

### Task 1: Canonical-to-dashboard evidence preservation

**Files:**
- Modify: `reporting/report-types.ts`
- Modify: `reporting/universal/output/legacy-projection.ts`
- Test: `reporting/universal/test/core.test.cjs`

**Interfaces:**
- Consumes: canonical `EvidenceRecord` from `reporting/universal/schema/types.ts`.
- Produces: expanded `ArtifactRecord` with all six evidence kinds, filename, MIME type, bytes, format, missing state, availability, and optional preview metadata.

- [x] Add a projection test containing screenshot, video, trace, JSON file, text log, native report, and unsafe path evidence; assert generic records and metadata are retained while unsafe paths are unavailable.
- [x] Run `npm run test:universal` and confirm the new assertions fail because generic evidence is currently discarded.
- [x] Expand `ArtifactRecord` and replace the lossy kind filter with a safe all-kind projection using `isSafeRelativePath` and `path.posix.basename`.
- [x] Run `npm run test:universal` and confirm all tests pass.

### Task 2: Safe availability checks and bounded previews

**Files:**
- Create: `reporting/universal/output/evidence.ts`
- Modify: `reporting/universal/output/report-writer.ts`
- Test: `reporting/universal/test/evidence.test.cjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `prepareEvidenceForDashboard(report: ReportDocument, runDirectory: string): Promise<ReportDocument>`.
- Path contract: dashboard paths must be exactly `../<safe-run-relative-path>`; absolute, encoded traversal, lexical traversal, and symlink escapes become unavailable without throwing.
- Preview contract: valid `application/json` and `text/*` files receive at most 128 KiB of embedded read-only content and a truncation flag.

- [x] Write tests for JSON formatting, text preview, binary no-preview behavior, declared missing files, absent files, unsafe paths, escaping symlinks, and preview truncation.
- [x] Run the evidence test and verify it fails because the module does not exist.
- [x] Implement containment, realpath checks, file metadata, and bounded preview reads.
- [x] Invoke preparation in `UniversalReportWriter.writeRun` before writing dashboard/results documents.
- [x] Add the evidence tests to `test:universal` and run them until all cases pass.

### Task 3: Generic dashboard evidence UI

**Files:**
- Modify: `reporting/dashboard-template.ts`
- Create: `reporting/dashboard-evidence.test.cjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: expanded dashboard `ArtifactRecord` values.
- Produces: existing media previews plus metadata, safe download links, JSON/text `<pre>` previews, unsupported-file download cards, and unavailable notices.

- [x] Create a browser test that generates one dashboard containing all evidence kinds, opens test details, and asserts card count, metadata, JSON/text preview text, download attributes, screenshot/video/trace compatibility, unavailable behavior, and no console errors.
- [x] Run the browser test and confirm it fails because generic artifacts are absent/unrendered.
- [x] Add compact artifact metadata/preview styles without changing unrelated layout.
- [x] Add client-side defense-in-depth URL validation and render downloads only for prepared safe artifacts.
- [x] Render preview content exclusively through `textContent`; retain image, video, and trace-specific controls/help.
- [x] Run `npm run test:dashboard-evidence`, `npm run test:reporting`, and `npm run test:universal` until green.

### Task 4: Reusable local npm tarball

**Files:**
- Create: `reporting/package.json`
- Create: `reporting/tsconfig.package.json`
- Create: `reporting/adapters/junit/bin.ts`
- Create: `reporting/package.test.cjs`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Package name: `universal-qa-reporter`, version `0.1.0`, private/unpublished.
- Exports: `.`, `./junit`, `./playwright`, and `./dashboard`.
- Binary: `universal-qa-report` -> compiled JUnit CLI.
- Optional peer: `@playwright/test >=1.64.0`; JUnit conversion has no Playwright runtime dependency.

- [x] Write a package test that builds, packs to a temporary directory, inspects tarball contents, installs it into a temporary project with optional peers omitted, imports the universal API, and runs the JUnit binary while Playwright module loads are blocked.
- [x] Run the package test and verify failure because package metadata/build/bin are missing.
- [x] Add package metadata, CommonJS/declaration build configuration, executable JUnit wrapper, root build/test scripts, and ignore generated `reporting/dist/`.
- [x] Build and run `npm pack ./reporting --pack-destination <temp>`; assert only compiled runtime, declarations, schema, and documentation are included.
- [x] Run the installed-tarball JUnit smoke test and confirm a dashboard/run is generated without Playwright.

### Task 5: External sample and browser validation

**Files:**
- Modify: `integration-samples/README.md`
- Modify: `reporting/adapters/junit/README.md`
- Modify: `docs/custom-reporting-guide.md`

**Interfaces:**
- Consumes: existing Playwright and REST Assured samples.
- Produces: repeatable source-checkout and local-tarball installation instructions plus actual Phase 6 results.

- [x] Build a fresh local tarball in the approved temporary directory.
- [x] Run the existing Playwright sample with the packaged reporter and verify screenshot/media behavior.
- [x] Run the REST Assured sample, convert its Surefire XML through the installed package binary, and verify all four log/JSON evidence files appear in test details with working downloads and previews.
- [x] Browser-check both dashboards, downloads, preview text, missing-file state, and console/page errors.
- [x] Run typecheck and all reporting, universal, adapter, JUnit, evidence, dashboard, and package tests.
- [x] Confirm the real `reports/` checksums and latest redirect are unchanged.
- [x] Record files, commands, results, package tarball details, and remaining limitations, then stop after Phase 6.
