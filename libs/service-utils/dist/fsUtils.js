"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fsUtils = void 0;
const promises_1 = __importDefault(require("fs/promises"));
/**
 * Returns true if the user has access to `path`.
 */
async function hasAccess(path, mode) {
    try {
        await promises_1.default.access(path, mode);
        return true;
    }
    catch (e) {
        // ENOENT goes here
        return false;
    }
}
exports.fsUtils = {
    hasAccess
};
