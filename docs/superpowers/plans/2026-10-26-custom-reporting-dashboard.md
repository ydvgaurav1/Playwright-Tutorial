# Custom Reporting Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one real intentional-failure demo test and a portable timestamped Playwright reporting dashboard with native evidence and history.

**Architecture:** A shared run-context creates one timestamped report root per invocation. Playwright writes its HTML report and native artifacts into that run, while a custom Reporter API implementation copies evidence into stable categorized folders, serializes captured results, generates a self-contained dashboard, and updates a local latest-report redirect.

**Tech Stack:** Playwright Test Reporter API, TypeScript, Node.js filesystem APIs, self-contained HTML/CSS/JavaScript

## Global Constraints

- Preserve both existing tests.
- Add exactly one test titled `DEMO - Intentional Failure` and produce a real assertion failure.
- Use no new dependencies, databases, external services, fake evidence, or synthetic delays.
- Keep the demo test excludable from regression execution.
- Do not expose credential values in report data.

---

### Task 1: Baseline

- [x] Inspect tests, fixtures, page object, configuration, dependencies, and existing artifacts.
- [x] Execute the original two tests and record their result.

### Task 2: Timestamped reporting infrastructure

**Files:** `reporting/run-context.ts`, `reporting/custom-reporter.ts`, `reporting/dashboard-template.ts`, `playwright.config.ts`

- [x] Create collision-safe timestamped run folders with an explicit timezone.
- [x] Configure HTML plus custom reporters and retain native failure evidence.
- [x] Serialize tests, attempts, steps, errors, metadata, modules, and attachments.
- [x] Generate the dashboard, history, and `latest/index.html` redirect.

### Task 3: Intentional failure

**Files:** `tests/demo/login-intentional-failure.spec.ts`

- [x] Add one `@demo` test using the existing fixture, page object, and invalid user.
- [x] Complete the invalid-login interaction and fail only at the incorrect error assertion.

### Task 4: Documentation and verification

**Files:** `docs/custom-reporting-guide.md`, `.env.example`, `.gitignore`, `package.json`

- [x] Document architecture, commands, evidence, history, and demo exclusion.
- [x] Type-check and execute all three tests twice.
- [x] Validate 2 passed/1 failed, assertion cause, artifacts, dashboard interactions, history retention, and latest update.
- [x] Run the two-test regression exclusion command and confirm both original behaviors still pass.
