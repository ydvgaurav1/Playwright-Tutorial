# Public npm Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare `universal-qa-reporter@0.1.2` as a reviewed public npm candidate without publishing it or changing the existing private GitHub Packages release.

**Architecture:** Reuse the existing compiled package and public APIs, changing only distribution metadata, consumer documentation, package identity assertions, integration examples, release configuration, and the approved MIT license. The owner explicitly authorized MIT licensing for public distribution, and publication still requires explicit release approval.

**Tech Stack:** Node.js 20+, TypeScript, npm, Playwright, Node test runner, GitHub Actions.

## Global Constraints

- Do not publish to npm, create release tags, or change GitHub package visibility.
- Do not modify reporting implementation, adapters, dashboard behavior, or existing automation tests.
- Use only the owner-approved MIT license; do not change licensing without explicit approval.
- Public package identity is exactly `universal-qa-reporter@0.1.2`.
- Public registry is exactly `https://registry.npmjs.org`.

---

### Task 1: Public package identity and assertions

**Files:**
- Modify: `reporting/package.json`
- Modify: `reporting/package.test.cjs`

**Interfaces:**
- Consumes: Existing `dist/`, exports, CLI, optional Playwright peer, and package test.
- Produces: Public npm metadata and assertions for the same compiled functionality.

- [x] Change package name, version, public registry, and access; set the approved license to `MIT`.
- [x] Update only package identity and registry assertions in `reporting/package.test.cjs`.
- [x] Run `npm run test:package` and confirm the packed package installs and its exports and CLI execute.

### Task 2: Authentication-free consumer documentation

**Files:**
- Modify: `reporting/README.md`
- Modify: `reporting/adapters/junit/README.md`
- Modify: `integration-samples/README.md`
- Modify: `docs/custom-reporting-guide.md`

**Interfaces:**
- Consumes: Public package name and existing Playwright/JUnit interfaces.
- Produces: Exact npm installation, Playwright reporter, and JUnit CLI instructions without GitHub authentication.

- [x] Replace current consumer package references with `universal-qa-reporter@0.1.2`.
- [x] Remove GitHub Packages authentication instructions from public package documentation.
- [x] Document MIT licensing and the license file as publication prerequisites.
- [x] Preserve the historical private v0.1.0 verification record.

### Task 3: Fail-closed public release configuration

**Files:**
- Modify: `.github/workflows/publish-universal-qa-reporter.yml`

**Interfaces:**
- Consumes: Existing release validation sequence and future npm Trusted Publishing configuration.
- Produces: Protected, manual public npm publication workflow using OIDC and provenance.

- [x] Point setup and publication at `https://registry.npmjs.org`.
- [x] Replace package-write permission with `id-token: write` and use an `npm-production` environment.
- [x] Verify exact package name/version/tag and fail while metadata remains `UNLICENSED` or no `LICENSE` file exists.
- [x] Preserve Chromium installation and the complete reporting validation sequence.

### Task 4: Candidate verification and audit

**Files:**
- Test: all files included by `npm pack ./reporting --dry-run --json`

**Interfaces:**
- Consumes: Candidate metadata, compiled output, documentation, and release workflow.
- Produces: Reproducible evidence that the candidate is complete, clean, and not published.

- [x] Recheck npm name availability against the official public registry.
- [x] Run typecheck, reporting tests, universal tests, adapter tests, JUnit tests, dashboard evidence tests, package tests, and package build.
- [x] Install the dry-run-equivalent package in clean Playwright and JUnit-only temporary consumers through the package test.
- [x] Inspect all packed files for secrets, customer data, private paths, and unnecessary files.
- [x] Verify workflow YAML, package version, exports, CLI help, git cleanliness, unchanged release tags, and absence of a public npm publication.

### Task 5: Approved MIT licensing

**Files:**
- Modify: `reporting/package.json`
- Create: `reporting/LICENSE`
- Modify: `reporting/package.test.cjs`

**Interfaces:**
- Consumes: The package owner's explicit MIT authorization.
- Produces: MIT metadata and license text inside the published tarball.

- [x] Set `reporting/package.json` license to `MIT`.
- [x] Add the standard MIT text with `Copyright (c) 2026 ydvgaurav1`.
- [x] Include `LICENSE` in the package `files` array and assert its presence in the tarball.
- [x] Assert the installed package declares the `MIT` license.
- [x] Confirm the release workflow still fails closed unless an approved SPDX license and `reporting/LICENSE` exist.
