const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PYTEST_XML = `<?xml version="1.0" encoding="utf-8"?>
<testsuites name="pytest tests" tests="3" failures="1" errors="0" skipped="1" time="1.25" timestamp="2026-10-27T06:53:47.569Z">
  <properties>
    <property name="framework" value="pytest"/>
    <property name="pytest.version" value="8.3.3"/>
    <property name="environment" value="staging"/>
  </properties>
  <testsuite name="tests.test_login" tests="3" failures="1" errors="0" skipped="1" time="1.25" timestamp="2026-10-27T06:53:47.569Z">
    <properties>
      <property name="module" value="login"/>
      <property name="tags" value="sanity, login"/>
    </properties>
    <testcase classname="tests.test_login" name="test_valid_login" time="0.25" file="tests/test_login.py" line="12">
      <system-out>logged in as standard_user</system-out>
    </testcase>
    <testcase classname="tests.test_login" name="test_invalid_password" time="0.75" file="tests/test_login.py" line="24">
      <failure message="assert 200 == 401" type="AssertionError">assert 200 == 401
  at tests/test_login.py:31</failure>
      <system-err>request failed with 500</system-err>
    </testcase>
    <testcase classname="tests.test_login" name="test_locked_user" time="0" file="tests/test_login.py" line="40">
      <skipped message="not implemented"/>
    </testcase>
  </testsuite>
</testsuites>`;

const SUREFIRE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="com.example.LoginTest" time="2.5" tests="2" failures="1" errors="0" skipped="0" timestamp="2026-10-27T07:00:00Z" hostname="ci-agent">
  <properties>
    <property name="surefire.test.class.path" value="/work/target/test-classes"/>
    <property name="java.version" value="21.0.1"/>
    <property name="os.name" value="Linux"/>
    <property name="suite" value="regression"/>
  </properties>
  <testcase classname="com.example.LoginTest" name="validLogin" time="1.0">
    <system-out>driver started</system-out>
  </testcase>
  <testcase classname="com.example.LoginTest" name="invalidLogin" time="1.5">
    <failure message="expected [true] but found [false]" type="java.lang.AssertionError"><![CDATA[java.lang.AssertionError: expected [true] but found [false]
	at com.example.LoginTest.invalidLogin(LoginTest.java:42)]]></failure>
  </testcase>
  <system-out>suite output shared by every test</system-out>
  <system-err>suite warning</system-err>
</testsuite>`;

const REST_ASSURED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="REST Assured API" time="0.9" tests="2" failures="0" errors="1" timestamp="2026-10-27T07:10:00Z">
  <properties>
    <property name="framework" value="rest-assured"/>
    <property name="base.url" value="https://api.example.test"/>
    <property name="module" value="api"/>
    <property name="branch" value="main"/>
  </properties>
  <testcase classname="com.example.ApiTest" name="getUsers" time="0.4"/>
  <testcase classname="com.example.ApiTest" name="createUser" time="0.5">
    <error message="500 Internal Server Error" type="java.lang.RuntimeException">java.lang.RuntimeException: 500
	at com.example.ApiTest.createUser(ApiTest.java:88)</error>
  </testcase>
</testsuite>`;

const NESTED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="nested" time="3.0" timestamp="2026-10-27T07:20:00Z">
  <testsuite name="outer" time="3.0" timestamp="2026-10-27T07:20:00Z">
    <testsuite name="inner" time="1.5">
      <testcase classname="pkg.OuterTest" name="nestedPass" time="0.5" file="src/test/java/pkg/OuterTest.java"/>
    </testsuite>
    <testcase classname="pkg.OuterTest" name="outerPass" time="1.5" file="src/test/java/pkg/OuterTest.java"/>
  </testsuite>
</testsuites>`;

const MISSING_METADATA_XML = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite>
  <testcase name="anonymousTest"/>
  <testcase name="anonymousTest"/>
</testsuite>`;

const EMPTY_RUN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="empty suite" time="0"/>`;

const INVALID_XML = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="broken">
  <testcase name="unclosed"></testsuite>`;

const SPECIAL_CHARACTERS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="encoding" time="0.2" timestamp="2026-10-27T07:30:00Z">
  <testcase classname="pkg.EncodingTest" name="handles &amp; entities" time="0.2">
    <failure message="expected &quot;A&quot; &lt; B" type="Error">actual &amp; expected
second line</failure>
    <system-out><![CDATA[raw <output> & text]]></system-out>
  </testcase>
</testsuite>`;

function createWorkspace(prefix = "qa-junit-adapter-") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const reportsRoot = path.join(root, "reports");
  const inputs = path.join(root, "junit-input");
  const evidence = path.join(root, "evidence");

  fs.mkdirSync(inputs, { recursive: true });
  fs.mkdirSync(evidence, { recursive: true });

  return { root, reportsRoot, inputs, evidence };
}

function writeFile(directory, name, contents) {
  const file = path.join(directory, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents, "utf8");
  return file;
}

function writeXml(workspace, name, contents) {
  return writeFile(workspace.inputs, name, contents);
}

function writeManifest(workspace, manifest) {
  return writeFile(
    workspace.root,
    "attachments.json",
    JSON.stringify(manifest, null, 2),
  );
}

function createEvidence(workspace) {
  const screenshot = path.join(workspace.evidence, "failure.png");
  const trace = path.join(workspace.evidence, "trace.zip");
  const log = path.join(workspace.evidence, "test.log");
  fs.writeFileSync(screenshot, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  fs.writeFileSync(trace, Buffer.from("PK\u0003\u0004trace"));
  fs.writeFileSync(log, "line one\nline two\n", "utf8");
  return { screenshot, trace, log };
}

function createPriorReport(reportsRoot, runId = "prior-run") {
  const runDirectory = path.join(reportsRoot, runId);
  fs.mkdirSync(path.join(runDirectory, "dashboard"), { recursive: true });
  const report = {
    schemaVersion: 2,
    run: {
      id: runId,
      status: "passed",
      startTime: "2026-10-26T06:00:00.000Z",
      endTime: "2026-10-26T06:00:01.000Z",
      timezone: "Asia/Kolkata",
    },
    metadata: {
      environment: "prior",
      baseURL: "",
      browsers: [],
      projects: [],
      operatingSystem: "",
      nodeVersion: "",
      ci: false,
    },
    summary: {
      total: 1,
      passed: 1,
      failed: 0,
      skipped: 0,
      flaky: 0,
      timedOut: 0,
      interrupted: 0,
      unknown: 0,
      durationMs: 1000,
      passRate: 100,
    },
    suites: [],
    modules: [],
    specs: [],
    tests: [],
  };
  fs.writeFileSync(
    path.join(runDirectory, "results.json"),
    JSON.stringify(report, null, 2),
  );
  fs.writeFileSync(
    path.join(runDirectory, "dashboard", "index.html"),
    "<!doctype html><title>Prior</title>",
  );
  const latest = path.join(reportsRoot, "latest");
  fs.mkdirSync(latest, { recursive: true });
  fs.writeFileSync(
    path.join(latest, "index.html"),
    `<meta http-equiv="refresh" content="0; url=../${runId}/dashboard/index.html">`,
  );
  return runDirectory;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

module.exports = {
  EMPTY_RUN_XML,
  INVALID_XML,
  MISSING_METADATA_XML,
  NESTED_XML,
  PYTEST_XML,
  REST_ASSURED_XML,
  SPECIAL_CHARACTERS_XML,
  SUREFIRE_XML,
  createEvidence,
  createPriorReport,
  createWorkspace,
  readJson,
  writeFile,
  writeManifest,
  writeXml,
};
