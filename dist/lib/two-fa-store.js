"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwoFAStore = void 0;
const crypto_1 = __importDefault(require("crypto"));
const CODE_LENGTH = 6;
const CODE_TTL_MS = 60 * 1000;
class TwoFAStore {
    constructor({ codeTtlMs = CODE_TTL_MS, codeLength = CODE_LENGTH } = {}) {
        this._entries = {};
        this._codeTtlMs = codeTtlMs;
        this._codeLength = codeLength;
    }
    has(key) {
        return !!this._entries[key];
    }
    get(key) {
        return this._entries[key];
    }
    create(username) {
        for (const [key, entry] of Object.entries(this._entries)) {
            if (entry.username === username) {
                delete this._entries[key];
            }
        }
        const key = crypto_1.default.randomBytes(32).toString('hex');
        const code = Array.from({ length: this._codeLength }, () => crypto_1.default.randomInt(36).toString(36))
            .join('')
            .toUpperCase();
        this._entries[key] = { username, code };
        setTimeout(() => { delete this._entries[key]; }, this._codeTtlMs);
        return { key, code };
    }
    remove(key) {
        delete this._entries[key];
    }
}
exports.TwoFAStore = TwoFAStore;
//# sourceMappingURL=two-fa-store.js.map