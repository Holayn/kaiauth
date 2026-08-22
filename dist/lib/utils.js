"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.timingSafeCompare = timingSafeCompare;
exports.isSameOriginPath = isSameOriginPath;
const crypto_1 = __importDefault(require("crypto"));
function timingSafeCompare(a, b) {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && crypto_1.default.timingSafeEqual(bufA, bufB);
}
// A same-origin path check, not a strict URI charset: a redirect target may legitimately
// carry a query string or fragment (e.g. '/admin?tab=orders'). Must start with a single
// '/' — not '//', which browsers treat as protocol-relative and would send the user off-origin.
function isSameOriginPath(value) {
    return value.startsWith('/') && !value.startsWith('//');
}
//# sourceMappingURL=utils.js.map