"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobCompletionError = void 0;
class JobCompletionError extends Error {
    code;
    constructor(code) {
        super();
        this.code = code;
    }
}
exports.JobCompletionError = JobCompletionError;
