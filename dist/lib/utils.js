"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.timingSafeCompare = timingSafeCompare;
const crypto_1 = __importDefault(require("crypto"));
function timingSafeCompare(a, b) {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && crypto_1.default.timingSafeEqual(bufA, bufB);
}
//# sourceMappingURL=utils.js.map