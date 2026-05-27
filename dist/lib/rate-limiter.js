"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiter = void 0;
class RateLimiter {
    constructor({ isValidKey, maxAttempts = 3, lockoutDurationMs = 15 * 60 * 1000 }) {
        this._attempts = new Map();
        this._isValidKey = isValidKey;
        this._maxAttempts = maxAttempts;
        this._lockoutDurationMs = lockoutDurationMs;
    }
    canAttempt(key) {
        if (!this._isValidKey(key))
            return true;
        const entry = this._attempts.get(key);
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
        if (!this._isValidKey(key))
            return;
        const entry = this._attempts.get(key) ?? { count: 0, lockedUntil: 0 };
        entry.count += 1;
        if (entry.count >= this._maxAttempts) {
            entry.lockedUntil = Date.now() + this._lockoutDurationMs;
        }
        this._attempts.set(key, entry);
    }
    clearAttempts(key) {
        this._attempts.delete(key);
    }
    isLockedOut(key) {
        const entry = this._attempts.get(key);
        return !!entry?.lockedUntil && Date.now() < entry.lockedUntil;
    }
}
exports.RateLimiter = RateLimiter;
//# sourceMappingURL=rate-limiter.js.map