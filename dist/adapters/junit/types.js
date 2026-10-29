"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JunitFormatError = void 0;
class JunitFormatError extends Error {
    constructor(message) {
        super(message);
        this.name = "JunitFormatError";
    }
}
exports.JunitFormatError = JunitFormatError;
