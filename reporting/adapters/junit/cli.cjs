#!/usr/bin/env node
"use strict";

// Reuse the repository's TypeScript require hook so the converter can run with
// no build step and without adding a runtime dependency.
require("../../universal/test/load-ts.cjs");

const { main } = require("./cli.ts");

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
);
