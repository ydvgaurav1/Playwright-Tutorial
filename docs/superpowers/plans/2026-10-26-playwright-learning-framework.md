# Playwright Learning Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify a beginner-friendly Playwright TypeScript framework plus line-referenced learning material.

**Architecture:** Tests express scenarios, a custom fixture injects the page object, the page object owns login interactions, test data owns credentials, and configuration owns runner behavior. The suite uses the public SauceDemo site and Chromium.

**Tech Stack:** Node.js, TypeScript, Playwright Test, dotenv, Markdown

## Global Constraints

- Keep the design simple and modular.
- Verify the public application's selectors and workflow by executing the tests.
- Do not claim success without command output.
- Teach one topic at a time, beginning with `tests/login.spec.ts`.

---

### Task 1: Runnable framework

**Files:** `package.json`, `tsconfig.json`, `playwright.config.ts`, `tests/login.spec.ts`, `pages/LoginPage.ts`, `fixtures/index.ts`, `utils/env.ts`, `test-data/users.ts`, `.env.example`, `.gitignore`

- [x] Create configuration and dependency files.
- [x] Create the fixture, page object, test data, utility, and login scenarios.
- [x] Install dependencies and Chromium.
- [x] Run type-checking and tests.

### Task 2: Learning documentation

**Files:** `README.md`, `learning-guide/01-framework-architecture.md` through `learning-guide/10-interview-and-practice-questions.md`

- [x] Document architecture, syntax, runtime data flow, pass/fail rules, and QA risks with line references.
- [x] Document debugging, traces, screenshots, and HTML reports.
- [x] Verify commands and references against the final source.

### Task 3: Runtime verification

**Files:** Runtime outputs in `playwright-report/` and `test-results/`

- [x] Execute the Chromium suite against SauceDemo.
- [x] Repeat the suite to check basic stability.
- [x] Run with trace enabled and verify the trace artifact.
- [x] Report verified facts separately from assumptions and external risks.
