#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cli_1 = require("./cli");
(0, cli_1.main)().then((code) => {
    process.exitCode = code;
}, (error) => {
    console.error(error);
    process.exitCode = 1;
});
