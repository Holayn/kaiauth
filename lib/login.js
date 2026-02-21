const crypto = require('crypto');
const RateLimiter = require('./rate-limiter');
const TwoFAStore = require('./two-fa-store');
const { timingSafeCompare } = require('./utils');

/**
 * @typedef {object} LoginServiceOptions
 * @property {(username: string, password: string) => object|null} getUser
 *   Validate credentials; return user object on success, null on failure.
 * @property {(username: string) => boolean} isValidUser
 *   Return true if the username exists (used by the rate limiter).
 * @property {(token: string) => { username: string } | null} getBypassToken
 *   Look up existing 2FA bypass token; return entry or null.
 * @property {(entry: { token: string, username: string, expiresAt: number }) => void} saveBypassToken
 *   Persist a new 2FA bypass token.
 * @property {number} [bypassTokenMaxAgeMs]   – default 30 days
 * @property {number} [maxLoginAttempts]       – default 3
 * @property {number} [loginLockoutMs]         – default 15 min
 * @property {number} [codeTtlMs]             – 2FA code lifetime, default 60 s
 * @property {[number, number]} [failDelayMs]  – [min, max] random delay on failure (default [200, 600])
 */

const BYPASS_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_FAIL_DELAY = [200, 600]; // [min, max] ms

const Status = Object.freeze({
  TWO_FA_REQUIRED: 'twoFA',
  BYPASSED: 'bypassed',
  SUCCESS: 'success',
  FAILED: 'failed',
  FAILED_LOCKED_OUT: 'failed_locked_out',
});

/**
 * Framework-agnostic login service that manages the full
 * credential-check → 2FA → session lifecycle.
 */
class LoginService {
  /**
   * @param {LoginServiceOptions} opts
   */
  constructor(opts) {
    this._getUser = opts.getUser;
    this._getBypassToken = opts.getBypassToken;
    this._saveBypassToken = opts.saveBypassToken;
    this._bypassMaxAge = opts.bypassTokenMaxAgeMs ?? BYPASS_MAX_AGE;
    this._failDelay = opts.failDelayMs ?? DEFAULT_FAIL_DELAY;

    this._loginLimiter = new RateLimiter({
      isValidKey: opts.isValidUser,
      maxAttempts: opts.maxLoginAttempts ?? 3,
      lockoutDurationMs: opts.loginLockoutMs ?? 15 * 60 * 1000,
    });

    this._twoFAStore = new TwoFAStore({
      codeTtlMs: opts.codeTtlMs,
    });

    this._twoFALimiter = new RateLimiter({
      isValidKey: (key) => this._twoFAStore.has(key),
    });

    this._randomDelay = () => randomDelay(this._failDelay);
  }

  /** Expose status constants for consumers. */
  static Status = Status;

  /**
   * Step 1 — validate credentials and decide on 2FA.
   *
   * @param {string}      username
   * @param {string}      password
   * @param {string|null} existingBypassToken – current bypass cookie value, if any
   * @returns {Promise<{ status: string, username?: string, user?: object, twoFAKey?: string, code?: string }>}
   */
  async authenticate(username, password, existingBypassToken = null) {
    if (!this._loginLimiter.canAttempt(username)) {
      await this._randomDelay();
      return { status: Status.FAILED };
    }

    this._loginLimiter.recordAttempt(username);
    const user = this._getUser(username, password);

    if (!user) {
      await this._randomDelay();
      return { status: this._loginLimiter.isLockedOut(username) ? Status.FAILED_LOCKED_OUT : Status.FAILED };
    }

    this._loginLimiter.clearAttempts(username);

    // Check whether the user can skip 2FA via a bypass token.
    const bypassEntry = existingBypassToken
      ? this._getBypassToken(existingBypassToken)
      : null;

    if (bypassEntry?.username === username) {
      return { status: Status.BYPASSED, username, user };
    }

    // Issue a 2FA challenge.
    const { key, code } = this._twoFAStore.create(username);
    return { status: Status.TWO_FA_REQUIRED, username, user, twoFAKey: key, code };
  }

  /**
   * Step 2 — verify a 2FA code and issue a bypass token on success.
   *
   * @param {string} twoFAKey  – the key stored in the TWOFAKEY cookie
   * @param {string} twoFACode – the code the user submitted
   * @returns {Promise<{ status: string, username?: string, bypassToken?: string, bypassMaxAge?: number }>}
   */
  async verifyTwoFA(twoFAKey, twoFACode) {
    if (!twoFAKey || !this._twoFALimiter.canAttempt(twoFAKey)) {
      return { status: Status.FAILED };
    }

    this._twoFALimiter.recordAttempt(twoFAKey);

    const entry = this._twoFAStore.get(twoFAKey);
    if (!entry || !timingSafeCompare(twoFACode, entry.code)) {
      return { status: Status.FAILED };
    }

    this._twoFALimiter.clearAttempts(twoFAKey);

    // Ensure the 2FA code can't be reused.
    this._twoFAStore.remove(twoFAKey);

    // Mint a bypass token so the user can skip 2FA next time.
    const bypassToken = crypto.randomBytes(32).toString('hex');
    this._saveBypassToken({
      token: bypassToken,
      username: entry.username,
      expiresAt: Date.now() + this._bypassMaxAge,
    });

    return {
      status: Status.SUCCESS,
      username: entry.username,
      bypassToken,
      bypassMaxAge: this._bypassMaxAge,
    };
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Returns a promise that resolves after a random delay (for timing-attack prevention). */
function randomDelay([min, max]) {
  return new Promise((resolve) =>
    setTimeout(resolve, crypto.randomInt(min, max))
  );
}

module.exports = LoginService;
