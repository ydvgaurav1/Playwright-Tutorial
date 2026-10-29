"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJunitXml = parseJunitXml;
const types_1 = require("./types");
const xml_1 = require("./xml");
function parseJunitXml(source, sourcePath) {
    const root = (0, xml_1.parseXml)(source);
    const file = {
        path: sourcePath,
        rootName: root.name,
        timeSeconds: numberAttribute(root, "time"),
        properties: readProperties(root),
        suites: [],
        testcases: [],
        systemOut: directText(root, "system-out"),
        systemErr: directText(root, "system-err"),
    };
    const counter = { value: 0 };
    if (root.name === "testsuite") {
        file.suites.push(readSuite(root, sourcePath, [], undefined, counter, file.properties));
    }
    else if (root.name === "testcase") {
        file.testcases.push(readTestCase(root, sourcePath, [], undefined, counter, file.properties));
    }
    else {
        collectContainers(root.children, file, sourcePath, [], undefined, counter, file.properties);
    }
    if (file.suites.length === 0 &&
        file.testcases.length === 0 &&
        root.name !== "testsuites") {
        throw new types_1.JunitFormatError(`No JUnit <testsuite> or <testcase> elements were found in "${sourcePath}".`);
    }
    // A <testsuite> root already attached its own output in readSuite. File-level
    // output only exists separately for a <testsuites> root.
    const first = root.name === "testsuite" ? undefined : firstFileTestcase(file);
    if (first) {
        first.suiteSystemOut = combineText(first.suiteSystemOut, file.systemOut);
        first.suiteSystemErr = combineText(first.suiteSystemErr, file.systemErr);
    }
    return file;
}
function collectContainers(children, file, sourcePath, suitePath, inheritedTimestamp, counter, inheritedProperties) {
    for (const child of children) {
        if (child.name === "testsuite") {
            file.suites.push(readSuite(child, sourcePath, suitePath, inheritedTimestamp, counter, inheritedProperties));
        }
        else if (child.name === "testcase") {
            file.testcases.push(readTestCase(child, sourcePath, suitePath, inheritedTimestamp, counter, inheritedProperties));
        }
        else if (child.name === "testsuites") {
            collectContainers(child.children, file, sourcePath, suitePath, inheritedTimestamp, counter, inheritedProperties);
        }
    }
}
function readSuite(element, sourcePath, parentPath, inheritedTimestamp, counter, inheritedProperties) {
    const name = attribute(element, "name");
    const suitePath = name ? [...parentPath, name] : [...parentPath];
    const timestamp = attribute(element, "timestamp") ?? inheritedTimestamp;
    const properties = {
        ...inheritedProperties,
        ...readProperties(element),
    };
    const suite = {
        name,
        timestamp,
        timeSeconds: numberAttribute(element, "time"),
        hostname: attribute(element, "hostname"),
        properties,
        systemOut: directText(element, "system-out"),
        systemErr: directText(element, "system-err"),
        testcases: [],
        suites: [],
        failures: directProblems(element, "failure"),
        errors: directProblems(element, "error"),
        sourcePath,
    };
    collectSuiteChildren(element.children, suite, sourcePath, suitePath, timestamp, counter, properties);
    // JUnit has no per-test association for suite-level output. Attach it once,
    // to the first test in the suite, rather than duplicating it for every test.
    const first = firstTestcase(suite);
    if (first) {
        first.suiteSystemOut = combineText(first.suiteSystemOut, suite.systemOut);
        first.suiteSystemErr = combineText(first.suiteSystemErr, suite.systemErr);
    }
    return suite;
}
function collectSuiteChildren(children, suite, sourcePath, suitePath, inheritedTimestamp, counter, inheritedProperties) {
    for (const child of children) {
        if (child.name === "testcase") {
            suite.testcases.push(readTestCase(child, sourcePath, suitePath, inheritedTimestamp, counter, inheritedProperties));
        }
        else if (child.name === "testsuite") {
            suite.suites.push(readSuite(child, sourcePath, suitePath, inheritedTimestamp, counter, inheritedProperties));
        }
        else if (child.name === "testsuites") {
            const nested = {
                path: sourcePath,
                rootName: child.name,
                properties: {},
                suites: [],
                testcases: [],
            };
            collectContainers(child.children, nested, sourcePath, suitePath, inheritedTimestamp, counter, inheritedProperties);
            suite.suites.push(...nested.suites);
            suite.testcases.push(...nested.testcases);
        }
    }
}
function readTestCase(element, sourcePath, suitePath, suiteTimestamp, counter, suiteProperties) {
    const skippedElement = firstChild(element, "skipped");
    return {
        name: attribute(element, "name") ?? "Unnamed test",
        classname: attribute(element, "classname"),
        file: attribute(element, "file"),
        line: integerAttribute(element, "line"),
        timeSeconds: numberAttribute(element, "time"),
        timestamp: attribute(element, "timestamp"),
        status: attribute(element, "status"),
        assertions: integerAttribute(element, "assertions"),
        failures: directProblems(element, "failure"),
        errors: directProblems(element, "error"),
        skipped: skippedElement ? readSkipped(skippedElement) : undefined,
        systemOut: directText(element, "system-out"),
        systemErr: directText(element, "system-err"),
        properties: readProperties(element),
        suiteProperties,
        suitePath,
        suiteTimestamp,
        sourcePath,
        index: counter.value++,
    };
}
function readProperties(element) {
    const properties = {};
    const containers = element.children.filter((child) => child.name === "properties");
    for (const container of containers) {
        for (const property of container.children) {
            if (property.name !== "property")
                continue;
            addProperty(properties, property);
        }
    }
    // A few producers put <property> directly under <testcase> or <testsuite>.
    for (const property of element.children) {
        if (property.name === "property")
            addProperty(properties, property);
    }
    return properties;
}
function addProperty(properties, property) {
    const name = attribute(property, "name") ?? attribute(property, "key");
    if (!name)
        return;
    const value = attribute(property, "value") ??
        (property.text.trim() ? property.text.trim() : "true");
    properties[name] = value;
}
function directProblems(element, name) {
    return element.children
        .filter((child) => child.name === name)
        .map((child) => ({
        message: attribute(child, "message"),
        type: attribute(child, "type") ?? attribute(child, "class"),
        text: child.text.trim() || undefined,
    }));
}
function readSkipped(element) {
    return {
        message: attribute(element, "message"),
        type: attribute(element, "type"),
        text: element.text.trim() || undefined,
    };
}
function directText(element, name) {
    const text = element.children
        .filter((child) => child.name === name)
        .map((child) => child.text.trim())
        .filter(Boolean)
        .join("\n");
    return text ? text : undefined;
}
function firstChild(element, name) {
    return element.children.find((child) => child.name === name);
}
function attribute(element, name) {
    const value = element.attributes[name.toLowerCase()];
    if (value === undefined)
        return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
}
function numberAttribute(element, name) {
    const value = attribute(element, name);
    if (value === undefined)
        return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}
function integerAttribute(element, name) {
    const value = numberAttribute(element, name);
    return value !== undefined && Number.isInteger(value) ? value : undefined;
}
function firstTestcase(suite) {
    if (suite.testcases.length > 0)
        return suite.testcases[0];
    for (const child of suite.suites) {
        const test = firstTestcase(child);
        if (test)
            return test;
    }
    return undefined;
}
function firstFileTestcase(file) {
    if (file.testcases.length > 0)
        return file.testcases[0];
    for (const suite of file.suites) {
        const test = firstTestcase(suite);
        if (test)
            return test;
    }
    return undefined;
}
function combineText(left, right) {
    if (left && right)
        return `${left}\n${right}`;
    return left ?? right;
}
