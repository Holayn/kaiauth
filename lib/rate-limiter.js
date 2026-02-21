/**
 * Generic in-memory rate limiter with per-key lockout.
 *
 * Tracks failed attempts per key and blocks further attempts once
 * `maxAttempts` is reached, until the lockout duration expires.
 *
 * @param {object} opts
 * @param {(key: string) => boolean} opts.isValidKey
 *   Return true if the key is valid (e.g. the username exists).
 *   Invalid keys are always allowed through so that timing stays
 *   consistent — the caller is expected to reject them later.
 * @param {number} [opts.maxAttempts=3]
 *   Number of failed attempts before lockout.
 * @param {number} [opts.lockoutDurationMs=900000]
 *   How long (ms) the lockout lasts (default 15 minutes).
 */
class RateLimiter {
  constructor({ isValidKey, maxAttempts = 3, lockoutDurationMs = 15 * 60 * 1000 } = {}) {
    this._isValidKey = isValidKey;
    this._maxAttempts = maxAttempts;
    this._lockoutDurationMs = lockoutDurationMs;
    /** @type {Map<string, { count: number, lockedUntil: number }>} */
    this._attempts = new Map();
  }

  /**
   * Check whether the given key is allowed to attempt.
   * Returns `true` if the key is unknown, invalid, or under the limit.
   * Returns `false` if the key is locked out.
   */
  canAttempt(key) {
    if (!this._isValidKey(key)) return true;

    const entry = this._attempts.get(key);
    if (!entry) return true;

    if (entry.lockedUntil && Date.now() < entry.lockedUntil) {
      return false;
    }

    // Lockout expired — reset
    if (entry.lockedUntil && Date.now() >= entry.lockedUntil) {
      this._attempts.delete(key);
      return true;
    }

    return true;
  }

  /**
   * Record a failed attempt. If the attempt count reaches the max,
   * the key is locked out for the configured duration.
   */
  recordAttempt(key) {
    if (!this._isValidKey(key)) return;

    const entry = this._attempts.get(key) || { count: 0, lockedUntil: 0 };
    entry.count += 1;

    if (entry.count >= this._maxAttempts) {
      entry.lockedUntil = Date.now() + this._lockoutDurationMs;
    }

    this._attempts.set(key, entry);
  }

  /** Clear all attempts for a key (e.g. after a successful login). */
  clearAttempts(key) {
    this._attempts.delete(key);
  }

  isLockedOut(key) {
    const entry = this._attempts.get(key);
    return !!entry?.lockedUntil && Date.now() < entry.lockedUntil;
  }
}

module.exports = RateLimiter;
