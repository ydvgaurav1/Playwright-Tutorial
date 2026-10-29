const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..");
const packageName = "universal-qa-reporter";
const packageVersion = "0.1.2";

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd ?? repositoryRoot,
    encoding: "utf8",
    env: options.env ?? process.env,
    timeout: options.timeout ?? 180_000,
  });
}

function assertSucceeded(result, label) {
  assert.equal(
    result.status,
    0,
    `${label} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
}

test("builds, packs, installs, and executes the public reporter without Playwright", (t) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "qa-reporter-package-"));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  const packDirectory = path.join(workspace, "pack");
  const consumer = path.join(workspace, "consumer");
  fs.mkdirSync(packDirectory, { recursive: true });
  fs.mkdirSync(consumer, { recursive: true });

  const build = run("npm", ["run", "build:reporter"]);
  assertSucceeded(build, "reporter build");

  const packed = run("npm", [
    "pack",
    "./reporting",
    "--pack-destination",
    packDirectory,
    "--json",
  ]);
  assertSucceeded(packed, "npm pack");
  const packResult = JSON.parse(packed.stdout);
  assert.equal(packResult.length, 1);
  assert.equal(packResult[0].name, packageName);
  assert.equal(packResult[0].version, packageVersion);
  const tarball = path.join(packDirectory, packResult[0].filename);
  assert.equal(fs.existsSync(tarball), true);

  const archive = run("tar", ["-tzf", tarball]);
  assertSucceeded(archive, "tarball inspection");
  const files = archive.stdout.trim().split("\n");
  for (const required of [
    "package/package.json",
    "package/LICENSE",
    "package/README.md",
    "package/dist/universal/index.js",
    "package/dist/universal/index.d.ts",
    "package/dist/universal/schema/qa-report.schema.json",
    "package/dist/adapters/junit/bin.js",
    "package/dist/adapters/junit/generate.js",
    "package/dist/playwright-reporter.js",
  ]) {
    assert.ok(files.includes(required), `missing tarball entry ${required}`);
  }
  assert.equal(files.some((file) => /(?:^|\/)test(?:\/|\.)/.test(file)), false);
  assert.equal(
    files.some((file) => file.endsWith(".ts") && !file.endsWith(".d.ts")),
    false,
  );

  fs.writeFileSync(
    path.join(consumer, "package.json"),
    JSON.stringify({ name: "reporter-consumer", private: true }),
  );
  const install = run(
    "npm",
    ["install", tarball, "--omit=optional", "--ignore-scripts", "--no-audit", "--no-fund"],
    { cwd: consumer },
  );
  assertSucceeded(install, "tarball install");
  assert.equal(
    fs.existsSync(path.join(consumer, "node_modules", "@playwright", "test")),
    false,
    "optional Playwright peer must not be installed for JUnit consumers",
  );

  const installedPackage = JSON.parse(
    fs.readFileSync(
      path.join(
        consumer,
        "node_modules",
        ...packageName.split("/"),
        "package.json",
      ),
      "utf8",
    ),
  );
  assert.equal(installedPackage.name, packageName);
  assert.equal(installedPackage.version, packageVersion);
  assert.equal(installedPackage.license, "MIT");
  assert.equal(installedPackage.private, undefined);
  assert.equal(
    installedPackage.publishConfig.registry,
    "https://registry.npmjs.org",
  );
  assert.equal(installedPackage.publishConfig.access, "public");
  assert.deepEqual(installedPackage.repository, {
    type: "git",
    url: "git+https://github.com/ydvgaurav1/Playwright-Tutorial.git",
    directory: "reporting",
  });

  const imports = run(
    "node",
    [
      "-e",
      [
        `const core = require("${packageName}");`,
        `const junit = require("${packageName}/junit");`,
        `const reporter = require("${packageName}/playwright");`,
        `const dashboard = require("${packageName}/dashboard");`,
        `const schema = require("${packageName}/schema");`,
        `const manifest = require("${packageName}/package.json");`,
        'if (typeof core.assertValidRunDocument !== "function") process.exit(2);',
        'if (typeof junit.generateJunitReport !== "function") process.exit(3);',
        'if (typeof reporter !== "function" && typeof reporter.default !== "function") process.exit(4);',
        'if (typeof dashboard.createDashboard !== "function") process.exit(5);',
        'if (schema.$id !== "https://qa-report.local/schema/v1/qa-report.schema.json") process.exit(6);',
        `if (manifest.name !== "${packageName}" || manifest.version !== "${packageVersion}") process.exit(7);`,
      ].join(""),
    ],
    { cwd: consumer },
  );
  assertSucceeded(imports, "package exports");

  const xml = path.join(consumer, "results.xml");
  fs.writeFileSync(
    xml,
    '<?xml version="1.0"?><testsuite name="package" tests="1" time="0.01"><testcase classname="PackageTest" name="works" time="0.01"/></testsuite>',
  );
  const blocker = path.join(consumer, "block-playwright.cjs");
  fs.writeFileSync(
    blocker,
    [
      'const Module = require("node:module");',
      "const load = Module._load;",
      "Module._load = function(request, parent, isMain) {",
      'if (request === "playwright" || request.startsWith("playwright/") || request === "@playwright/test" || request.startsWith("@playwright/test/")) throw new Error("BLOCKED_PLAYWRIGHT_LOAD: " + request);',
      "return load.call(this, request, parent, isMain);",
      "};",
    ].join("\n"),
  );
  const reportsRoot = path.join(consumer, "reports");
  const bin = path.join(consumer, "node_modules", ".bin", "universal-qa-report");
  const help = run("node", [bin, "--help"], { cwd: consumer });
  assertSucceeded(help, "installed JUnit CLI help");
  assert.match(help.stdout, /JUnit XML to universal report/);
  const conversion = run(
    "node",
    [
      "-r",
      blocker,
      bin,
      xml,
      "--reports-root",
      reportsRoot,
      "--framework",
      "rest-assured",
    ],
    { cwd: consumer },
  );
  assertSucceeded(conversion, "installed JUnit CLI");
  assert.doesNotMatch(conversion.stderr, /BLOCKED_PLAYWRIGHT_LOAD/);

  const runDirectory = fs
    .readdirSync(reportsRoot, { withFileTypes: true })
    .find((entry) => entry.isDirectory() && entry.name !== "latest");
  assert.ok(runDirectory);
  const runRoot = path.join(reportsRoot, runDirectory.name);
  const canonical = JSON.parse(fs.readFileSync(path.join(runRoot, "run.json"), "utf8"));
  assert.equal(canonical.producer.framework, "rest-assured");
  assert.equal(canonical.tests.length, 1);
  assert.equal(fs.existsSync(path.join(runRoot, "dashboard", "index.html")), true);
});
