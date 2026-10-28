function validRun() {
  return {
    schemaVersion: "1.0.0",
    producer: {
      name: "test-adapter",
      version: "1.0.0",
      framework: "test-framework",
    },
    run: {
      id: "20261027T065347Z-test",
      status: "failed",
      startedAt: "2026-10-27T06:53:47.569Z",
      endedAt: "2026-10-27T06:53:54.821Z",
      durationMs: 7252,
      timezone: "Asia/Kolkata",
    },
    environment: {
      name: "demo",
      baseUrl: "https://example.test",
      ci: false,
      browsers: ["chromium"],
      projects: ["chromium"],
    },
    capabilities: {
      steps: true,
      retries: true,
      logs: true,
      attachments: true,
      traceFormats: ["playwright"],
      timings: "test",
    },
    externalReports: [],
    tests: [
      {
        id: "test-1",
        nativeId: "test-1",
        idStrategy: "test",
        title: "standard user can log in",
        titlePath: ["SauceDemo login", "standard user can log in"],
        labels: ["@sanity", "@regression", "@module:authentication"],
        suites: ["regression", "sanity"],
        module: "authentication",
        spec: {
          key: "tests/login.spec.ts::chromium",
          name: "login.spec.ts",
          path: "tests/login.spec.ts",
        },
        source: {
          file: "tests/login.spec.ts",
          line: 12,
          column: 5,
        },
        variant: {
          name: "chromium",
          browser: "chromium",
          repeat: 0,
        },
        status: "passed",
        durationMs: 1223,
        retries: { configured: 0, used: 0 },
        attempts: [
          {
            index: 1,
            retry: 0,
            status: "passed",
            startedAt: "2026-10-27T06:53:47.919Z",
            durationMs: 1223,
            executor: { workerIndex: 1 },
            errors: [],
            steps: [
              {
                title: "Submit valid credentials",
                category: "test.step",
                status: "passed",
                startedAt: "2026-10-27T06:53:48.100Z",
                durationMs: 420,
                steps: [],
              },
            ],
            logs: [],
            evidence: [],
          },
        ],
      },
      {
        id: "test-2",
        nativeId: "test-2",
        idStrategy: "test",
        title: "intentional failure",
        titlePath: ["intentional failure"],
        labels: ["@regression", "@module:authentication"],
        suites: ["regression"],
        module: "authentication",
        spec: {
          key: "tests/demo/failure.spec.ts::chromium",
          name: "failure.spec.ts",
          path: "tests/demo/failure.spec.ts",
        },
        source: {
          file: "tests/demo/failure.spec.ts",
          line: 4,
          column: 5,
        },
        variant: {
          name: "chromium",
          browser: "chromium",
          repeat: 0,
        },
        status: "failed",
        durationMs: 6404,
        retries: { configured: 0, used: 0 },
        attempts: [
          {
            index: 1,
            retry: 0,
            status: "failed",
            startedAt: "2026-10-27T06:53:47.920Z",
            durationMs: 6404,
            executor: { workerIndex: 0 },
            errors: [
              {
                message: "expect(locator).toContainText(expected) failed",
                expected: "Account locked after invalid login",
                actual: "Epic sadface: Username and password do not match",
              },
            ],
            steps: [],
            logs: [
              {
                stream: "stdout",
                timestamp: "2026-10-27T06:53:48.000Z",
                text: "login attempted",
              },
            ],
            evidence: [
              {
                kind: "screenshot",
                name: "failure screenshot",
                path: "screenshots/failure.png",
                mimeType: "image/png",
              },
              {
                kind: "trace",
                name: "trace",
                path: "traces/failure.zip",
                mimeType: "application/zip",
                format: "playwright",
              },
            ],
          },
        ],
      },
    ],
    globalErrors: [],
  };
}

module.exports = { validRun };
