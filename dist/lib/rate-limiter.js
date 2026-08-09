"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiter = void 0;
const lru_cache_1 = require("lru-cache");
class RateLimiter {
    constructor({ isValidKey, maxAttempts = 3, lockoutDurationMs = 15 * 60 * 1000, invalidKeysCacheSize = 5000, attemptsTtlMs }) {
        this._isValidKey = isValidKey;
        this._maxAttempts = maxAttempts;
        this._lockoutDurationMs = lockoutDurationMs;
        // No `max` here: valid keys only arrive via `isValidKey`, so growth is gated by real
        // application state (usernames, active 2FA sessions) rather than attacker-chosen input.
        // A count-based cap would let unrelated traffic evict another key's attempt count early.
        this._attempts = new lru_cache_1.LRUCache({
            ttl: Math.max(attemptsTtlMs ?? lockoutDurationMs, lockoutDurationMs),
            // Without `max`, entries only leave via TTL expiry, which by default only happens
            // lazily when that exact key is looked up again — a key that's never touched after
            // its final attempt (e.g. an abandoned twoFAKey) would otherwise sit here forever.
            // Autopurge reclaims expired entries on a background timer instead.
            ttlAutopurge: true,
        });
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