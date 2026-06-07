"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiter = void 0;
const lru_cache_1 = require("lru-cache");
class RateLimiter {
    constructor({ isValidKey, maxAttempts = 3, lockoutDurationMs = 15 * 60 * 1000, invalidKeysCacheSize = 5000 }) {
        this._attempts = new Map();
        this._isValidKey = isValidKey;
        this._maxAttempts = maxAttempts;
        this._lockoutDurationMs = lockoutDurationMs;
        this._badAttempts = new lru_cache_1.LRUCache({
            max: invalidKeysCacheSize,
            ttl: lockoutDurationMs,
        });
    }
    canAttempt(key) {
        const entry = this._getAttemptEntry(key);
        if (!entry)
            return true;
        if (entry.lockedUntil && Date.now() < entry.lockedUntil)
            return false;
        if (entry.lockedUntil && Date.now() >= entry.lockedUntil) {
            this._attempts.delete(key);
            return true;
        }
        return true;
    }
    recordAttempt(key) {
        const entry = this._getAttemptEntry(key) ?? { count: 0, lockedUntil: 0 };
        entry.count += 1;
        if (entry.count >= this._maxAttempts) {
            entry.lockedUntil = Date.now() + this._lockoutDurationMs;
        }
        if (this._isValidKey(key)) {
            this._attempts.set(key, entry);
        }
        else {
            this._badAttempts.set(key, entry);
        }
    }
    clearAttempts(key) {
        this._attempts.delete(key);
    }
    isLockedOut(key) {
        const entry = this._getAttemptEntry(key);
        return !!entry?.lockedUntil && Date.now() < entry.lockedUntil;
    }
    _getAttemptEntry(key) {
        const legitAttempt = this._attempts.get(key);
        const badAttempt = this._badAttempts.get(key);
        return legitAttempt || badAttempt;
    }
}
exports.RateLimiter = RateLimiter;
//# sourceMappingURL=rate-limiter.js.map