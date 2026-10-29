"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const node_path_1 = __importDefault(require("node:path"));
const validate_1 = require("../../universal/schema/validate");
const generate_1 = require("./generate");
const HELP = `JUnit XML to universal report

Usage:
  npm run report:junit -- <file-or-directory> [options]
  node reporting/adapters/junit/cli.cjs <file-or-directory> [options]

Options:
  -i, --input <path>        JUnit XML file or directory (repeatable)
      --reports-root <dir>  Reports root (default: reports)
      --timezone <zone>     IANA timezone for folder labels (default: Asia/Kolkata)
      --environment <name>  Environment label (default: detected framework or "junit")
      --base-url <url>      Base URL recorded in the report
      --framework <name>    Override framework detection (pytest, selenium, testng, ...)
      --manifest <file>     JSON attachment manifest for screenshots, videos, traces, logs
      --started-at <iso>    Fallback run start when the XML has no timestamps
      --metadata <k=v>      Extra metadata in extensions.junit (repeatable)
      --latest-title <t>    Title used by reports/latest/index.html
  -h, --help                Show this help

The converter never imports Playwright. Existing reports and reports/latest are
only changed after a complete, validated report has been written.`;
async function main(argv = process.argv.slice(2)) {
    let options;
    try {
        options = parseArguments(argv);
    }
    catch (error) {
        console.error(`[junit-universal-reporter] ${errorMessage(error)}`);
        return 1;
    }
    if (options.help) {
        console.log(HELP);
        return 0;
    }
    try {
        const result = await (0, generate_1.generateJunitReport)(options);
        const { summary } = result.report;
        console.log(`[junit-universal-reporter] Report written: ${result.dashboardPath}`);
        console.log(`[junit-universal-reporter] Run ${result.runId}: ${summary.total} test(s), ${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} skipped, ${summary.flaky} flaky.`);
        console.log(`[junit-universal-reporter] Source files: ${result.sourceFiles.length}; manifest attachments copied: ${result.copiedAttachments}.`);
        for (const warning of result.warnings) {
            console.warn(`[junit-universal-reporter] Warning: ${warning}`);
        }
        return 0;
    }
    catch (error) {
        console.error(`[junit-universal-reporter] ${errorMessage(error)}`);
        if (error instanceof validate_1.SchemaValidationError) {
            for (const issue of error.issues) {
                console.error(`  ${issue.path}: ${issue.message}`);
            }
        }
        return 1;
    }
}
function parseArguments(argv) {
    const inputs = [];
    const metadata = {};
    let reportsRoot = "reports";
    let timezone = "Asia/Kolkata";
    let environment;
    let baseURL;
    let framework;
    let manifestPath;
    let startedAt;
    let latestTitle;
    let help = false;
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === "-h" || argument === "--help") {
            help = true;
            continue;
        }
        if (!argument.startsWith("-")) {
            inputs.push(argument);
            continue;
        }
        const [flag, inlineValue] = splitFlag(argument);
        const readValue = () => {
            if (inlineValue !== undefined)
                return inlineValue;
            const value = argv[index + 1];
            if (value === undefined || value.startsWith("-")) {
                throw new Error(`Missing value for ${flag}.`);
            }
            index += 1;
            return value;
        };
        switch (flag) {
            case "-i":
            case "--input":
                inputs.push(readValue());
                break;
            case "--reports-root":
                reportsRoot = readValue();
                break;
            case "--timezone":
                timezone = readValue();
                break;
            case "--environment":
                environment = readValue();
                break;
            case "--base-url":
                baseURL = readValue();
                break;
            case "--framework":
                framework = readValue();
                break;
            case "--manifest":
                manifestPath = readValue();
                break;
            case "--started-at":
                startedAt = readValue();
                break;
            case "--latest-title":
                latestTitle = readValue();
                break;
            case "--metadata": {
                const pair = readValue();
                const separator = pair.indexOf("=");
                if (separator <= 0) {
                    throw new Error(`Invalid --metadata "${pair}". Use key=value.`);
                }
                metadata[pair.slice(0, separator).trim()] = pair
                    .slice(separator + 1)
                    .trim();
                break;
            }
            default:
                throw new Error(`Unknown option "${flag}". Use --help for usage.`);
        }
    }
    if (!help && inputs.length === 0) {
        throw new Error("No JUnit XML input was provided. Use --input <file-or-directory> or pass a path.");
    }
    if (startedAt && !Number.isFinite(Date.parse(startedAt))) {
        throw new Error(`Invalid --started-at value "${startedAt}".`);
    }
    return {
        inputs,
        reportsRoot: node_path_1.default.resolve(reportsRoot),
        timezone,
        environment,
        baseURL,
        framework,
        manifestPath,
        startedAt,
        metadata,
        latestTitle,
        help,
    };
}
function splitFlag(argument) {
    const separator = argument.indexOf("=");
    if (separator < 0)
        return [argument, undefined];
    return [argument.slice(0, separator), argument.slice(separator + 1)];
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
