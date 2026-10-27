<<<<<<< HEAD
# Playwright TypeScript Learning Framework

A small, runnable UI test framework for the public [SauceDemo](https://www.saucedemo.com) login page. It contains two regression scenarios plus one isolated, intentionally failing reporting demonstration.

## Verified status

Verified on **2026-10-26** with Node.js `22.23.3`, Playwright `1.64.1`, and Chromium:

- Original baseline before the reporting extension — 2/2 tests passed.
- `npm run typecheck` — passed with no TypeScript errors.
- `npm test` — 3 tests executed: 2 passed and `DEMO - Intentional Failure` failed at its deliberately incorrect assertion.
- The schema-v2 custom dashboard was browser-validated for hierarchy, combined filters, contextual metrics, drill-down, test details, history, screenshot/video/trace references, and the Playwright HTML-report link.

These results verify the selectors and workflow at that time. SauceDemo is an external service, so future availability or UI changes are not controlled by this project.

## Quick start

```bash
npm install
npx playwright install chromium
npm run test:regression
```

Optional `.env` overrides:

```bash
cp .env.example .env
```

Never commit a real `.env`; `.env.example` contains only public demonstration values.

## Useful commands

| Command | Result |
|---|---|
| `npm test` | Run all three tests; returns nonzero because the `@demo` test intentionally fails. |
| `npm run test:sanity` | Run the two `@sanity` login tests. |
| `npm run test:regression` | Run `@regression` tests while excluding the intentional `@demo`; currently two pass. |
| `npm run test:headed` | Run with a visible browser. |
| `npm run test:debug` | Open Playwright Inspector and pause execution. |
| `npm run test:ui` | Open Playwright UI Mode. |
| `npm run test:trace` | Retain a trace for every test in that run. |
| `npm run report` | Open `reports/latest/index.html`. |
| `npm run test:reporting` | Verify report classification, aggregation, HTML contracts, and generated client syntax. |
| `npm run typecheck` | Check TypeScript without emitting JavaScript. |

## Runtime architecture

```text
package script
  -> playwright.config.ts
  -> Playwright discovers the regression and @demo test files
  -> fixtures/index.ts creates LoginPage with a fresh page
  -> beforeEach opens SauceDemo
  -> test-data/users.ts supplies credentials
  -> pages/LoginPage.ts performs browser actions
  -> tests/login.spec.ts performs web-first assertions
  -> custom reporter classifies suites/modules and stores project-aware results
  -> native HTML and custom dashboards write timestamped results/evidence
  -> fixture and browser context are torn down
```

A **fixture** is test setup data or an object that Playwright creates and cleans up for a test. A **page object** is a class that centralizes one page's locators and user actions. A **web-first assertion** retries against the live page until it passes or times out.

## File-by-file review

### `tests/login.spec.ts` (lines 1-27)

1. **Purpose:** Defines the valid and invalid login behaviors; imports the custom runner and data at lines 1-2.
2. **Execution flow:** `describe` registers tests (line 4), `beforeEach` opens the login page before each test (lines 5-7), each test acts and asserts (lines 9-26), then Playwright tears down its context.
3. **Playwright syntax:** `test`, `test.describe`, `test.beforeEach`, and `test.step` organize execution (lines 4-20); `expect(...).toHaveURL`, `toHaveText`, and `toContainText` auto-retry (lines 15-16, 23-25).
4. **TypeScript syntax:** Named imports are at lines 1-2; `async` callbacks return promises, and `await` pauses each callback until the browser operation settles.
5. **Data flow:** `users` supplies credentials to `loginPage.login`; browser state then flows into URL/text assertions. Side effects are navigation and form submission.
6. **Pass/fail:** The valid test requires `/inventory.html` and `Products`; the invalid test requires the expected error substring. Any thrown error, timeout, or failed assertion fails the test.
7. **QA review:** Good: independent scenarios and outcome assertions. Risks: external-site availability, shared public credentials, English copy, and only Chromium coverage.

### `pages/LoginPage.ts` (lines 1-25)

1. **Purpose:** Centralizes login-page locators and actions.
2. **Execution flow:** The fixture calls the constructor (lines 9-14), `goto` navigates (lines 16-18), and `login` fills username, fills password, then clicks (lines 20-24).
3. **Playwright syntax:** `getByPlaceholder`, `getByRole`, and `getByTestId` create lazy locators (lines 10-13); `goto`, `fill`, and `click` perform auto-waiting actions (lines 17, 21-23).
4. **TypeScript syntax:** `import type` avoids a runtime import (line 1); exported class, typed readonly fields, parameter property, typed parameters, and `Promise<void>` appear at lines 3-20.
5. **Data flow:** A Playwright `Page` enters through the constructor; strings enter `login`; DOM navigation and input are side effects; methods return no business value.
6. **Pass/fail:** Actions throw if navigation fails, a locator is ambiguous/missing, or an element is not actionable before timeout.
7. **QA review:** Semantic locators are maintainable, and `exact: true` prevents accidental partial matches. Copy/placeholder changes can still break them; assertions correctly remain in the spec rather than hiding test intent here.

### `fixtures/index.ts` (lines 1-14)

1. **Purpose:** Extends Playwright's base test with a typed `loginPage` fixture.
2. **Execution flow:** Module exports are loaded first; for each requesting test, line 9 receives a fresh built-in `page`, line 10 constructs the page object and hands it to the test, then control returns for teardown.
3. **Playwright syntax:** `base.extend` adds a fixture (line 8); `use(...)` marks where the test body runs (line 10); `expect` is re-exported (line 14).
4. **TypeScript syntax:** Import aliasing (`test as base`) is at line 1; `AppFixtures` declares the fixture shape at lines 4-6; the generic `<AppFixtures>` type-checks consumers.
5. **Data flow:** Built-in `page` -> `new LoginPage(page)` -> test callback. The fixture itself adds no persistent state.
6. **Pass/fail:** Setup errors fail the test; here there is no custom teardown that can fail after the test.
7. **QA review:** Per-test scope preserves isolation. Avoid putting login into this fixture automatically because the invalid-login scenario needs a logged-out page.

### `test-data/users.ts` (lines 1-20)

1. **Purpose:** Holds typed test credentials separately from test logic.
2. **Execution flow:** On module import, `readEnv` resolves standard credentials (lines 13-14), then the immutable-by-type `users` object is exported.
3. **Playwright syntax:** None; this is framework-independent data.
4. **TypeScript syntax:** `Readonly`, object types, exported type aliases, and typed constants appear at lines 3-20.
5. **Data flow:** Environment values or public fallbacks enter; `UserCredentials` objects leave. Import evaluation is the only side effect.
6. **Pass/fail:** Empty environment overrides throw through `readEnv`; wrong credentials later cause UI assertions to fail.
7. **QA review:** Separation improves reuse. `Readonly` is compile-time only, and public shared accounts can be changed or throttled by the site owner.

### `utils/env.ts` (lines 1-9)

1. **Purpose:** Reads an environment variable with a fallback and rejects blank configuration.
2. **Execution flow:** Resolve value (line 2), validate trimmed content (lines 4-6), return it (line 8).
3. **Playwright syntax:** None.
4. **TypeScript syntax:** Exported function, typed parameters/return, nullish coalescing `??`, template literal, and `throw` appear at lines 1-8.
5. **Data flow:** Inputs are a key, fallback, and `process.env`; output is a nonblank string. A bad input throws an `Error`.
6. **Pass/fail:** This utility has no test result itself; its thrown error prevents test collection/execution and makes the run fail.
7. **QA review:** It catches blank values but does not validate URL format or secret correctness; add validation only when requirements demand it.

### `playwright.config.ts` (lines 1-63)

1. **Purpose:** Defines test discovery, timeouts, artifacts, reporting, base URL, and the Chromium project.
2. **Execution flow:** dotenv loads first (line 1), reporting settings and `baseURL` resolve (lines 4-10), then `defineConfig` is evaluated before test discovery.
3. **Playwright syntax:** `defineConfig`, combined reporters, metadata, `devices["Desktop Chrome"]`, and failure evidence settings appear at lines 12-63.
4. **TypeScript syntax:** ES imports, `const`, nullish coalescing, Boolean conversion, a ternary, object literals, arrays, and spread syntax are used.
5. **Data flow:** Environment variables influence URL/CI behavior; options flow into every test. Side effects include dotenv reading `.env` and reporters writing artifacts.
6. **Pass/fail:** Timeouts cap waits; CI retries up to two times, and `forbidOnly` rejects committed focused tests. Reporters do not decide correctness.
7. **QA review:** Failure artifacts aid diagnosis and CI uses one worker for predictability. One browser is a deliberate learning scope; retries can expose—but must not excuse—flakiness.

### `package.json` (lines 1-22)

1. **Purpose:** Declares project metadata, commands, and pinned development dependencies.
2. **Execution flow:** npm reads it before a script; the selected command starts Playwright or TypeScript, which then reads its own config.
3. **Playwright syntax:** CLI commands are at lines 7-14, including demo, regression-only, headed, Inspector, UI, trace, and report modes.
4. **TypeScript syntax:** None; JSON is data and does not allow comments.
5. **Data flow:** Script arguments flow to the CLI; dependency versions flow to npm installation. Installation writes `node_modules` and `package-lock.json`.
6. **Pass/fail:** npm returns the child command's exit code; a failing test or type error produces a nonzero exit code.
7. **QA review:** Exact versions improve reproducibility. Dependencies need periodic controlled upgrades and regression runs.

### `tsconfig.json` (lines 1-22)

1. **Purpose:** Configures strict TypeScript checking for framework source.
2. **Execution flow:** TypeScript/Playwright locate this file, apply options (lines 2-12), and include matching source paths (lines 13-20).
3. **Playwright syntax:** The Playwright type package is included at line 11.
4. **TypeScript syntax:** `strict` enables stronger checks; `noEmit` checks without creating JavaScript; glob strings select files.
5. **Data flow:** TypeScript source enters the compiler; diagnostics and an exit code leave; no compiled files are written.
6. **Pass/fail:** Any type error makes `npm run typecheck` fail.
7. **QA review:** Strict mode catches many defects early. `skipLibCheck` trades dependency-check depth for speed and does not skip this project's types.

### `.env.example` (lines 1-6)

1. **Purpose:** Documents optional configuration keys without creating a committed secret file.
2. **Execution flow:** It never runs; a user may copy it to `.env`, which dotenv reads before config evaluation.
3. **Playwright syntax:** None.
4. **TypeScript syntax:** None; it uses `KEY=value` environment-file syntax.
5. **Data flow:** Copied values enter `process.env`; this example contains only public demo credentials.
6. **Pass/fail:** Wrong overrides can cause navigation or authentication assertions to fail.
7. **QA review:** Never place real secrets in this example; secret stores are preferable in CI.

### `.gitignore` (lines 1-9)

1. **Purpose:** Prevents dependencies, secrets, generated reports/artifacts, logs, and OS metadata from being committed.
2. **Execution flow:** Git evaluates patterns when showing/staging files; it is not part of test runtime.
3. **Playwright syntax:** Generated Playwright directories are ignored at lines 3-6.
4. **TypeScript syntax:** None.
5. **Data flow:** File paths enter Git's ignore matcher; matched untracked files are omitted from normal Git status/staging.
6. **Pass/fail:** It does not affect test outcomes.
7. **QA review:** CI must upload ignored reports before its workspace is destroyed; ignored files already tracked by Git remain tracked.

### Generated and documentation files

- `package-lock.json`: npm-generated exact dependency graph; npm reads it during install. Do not hand-edit it, and review dependency changes in pull requests.
- `README.md`: setup, verified evidence, architecture, and the file-by-file review you are reading.
- `learning-guide/01-framework-architecture.md` through `10-interview-and-practice-questions.md`: lessons in recommended study order; they do not execute.
- `docs/custom-reporting-guide.md`: custom reporter architecture, evidence, history, and operating commands.
- `reporting/report-model.ts`: reusable suite/module classification and hierarchy aggregation.
- `reporting/report-model.test.cjs`: reporting-only unit tests; these do not add Playwright test cases.
- `docs/superpowers/plans/2026-10-26-playwright-learning-framework.md`: implementation checklist; it does not execute.
- `reports/<timestamp>/`: immutable execution results, dashboard, Playwright report, screenshots, videos, and traces.
- `reports/latest/index.html`: redirects to the most recently completed custom dashboard.
- `test-results/.last-run.json`: Playwright's generated last-failed-test state.

## What the suite proves—and misses

It proves that a standard user can currently submit the public credentials and see the inventory URL/title, and that invalid credentials currently produce the expected error. It does not prove authorization, session persistence, lockout policy, accessibility, responsive behavior, all account types, all browsers, API correctness, performance, or production behavior.

Start with [Lesson 1: framework architecture](learning-guide/01-framework-architecture.md), then follow the numbered guides.
=======
# Playwright-Tutorial
Learning Guide
>>>>>>> origin/main
