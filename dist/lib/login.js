"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginService = exports.Status = void 0;
const crypto_1 = __importDefault(require("crypto"));
const rate_limiter_1 = require("./rate-limiter");
const two_fa_store_1 = require("./two-fa-store");
const utils_1 = require("./utils");
const BYPASS_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_FAIL_DELAY = [200, 600];
exports.Status = Object.freeze({
    TWO_FA_REQUIRED: 'twoFA',
    BYPASSED: 'bypassed',
    SUCCESS: 'success',
    FAILED: 'failed',
    FAILED_LOCKED_OUT: 'failed_locked_out',
    FAILED_TWO_FA_LOCKED: 'failed_2fa_locked',
    FAILED_TWO_FA_EXPIRED: 'failed_2fa_expired',
});
class LoginService {
    constructor(opts) {
        this._getUser = opts.getUser;
        this._enable2fa = opts.enable2fa ?? true;
        this._getBypassToken = opts.getBypassToken;
        this._saveBypassToken = opts.saveBypassToken;
        this._bypassMaxAge = opts.bypassTokenMaxAgeMs ?? BYPASS_MAX_AGE;
        this._failDelay = opts.failDelayMs ?? DEFAULT_FAIL_DELAY;
        this._loginLimiter = new rate_limiter_1.RateLimiter({
            isValidKey: opts.isValidUser,
            maxAttempts: opts.maxLoginAttempts ?? 3,
            lockoutDurationMs: opts.loginLockoutMs ?? 15 * 60 * 1000,
            invalidKeysCacheSize: opts.loginInvalidUsersCacheSize,
        });
        if (this._enable2fa) {
            this._twoFAStore = new two_fa_store_1.TwoFAStore({ codeTtlMs: opts.codeTtlMs });
            this._twoFALimiter = new rate_limiter_1.RateLimiter({
                isValidKey: (key) => this._twoFAStore.has(key),
            });
            this._resendLimiter = new rate_limiter_1.RateLimiter({
                isValidKey: (key) => this._twoFAStore.has(key),
                maxAttempts: opts.maxResendAttempts ?? 3,
                lockoutDurationMs: opts.resendLockoutMs ?? 5 * 60 * 1000,
            });
        }
        this._randomDelay = () => randomDelay(this._failDelay);
    }
    async authenticate(username, password, existingBypassToken = null) {
        if (!this._loginLimiter.canAttempt(username)) {
            await this._randomDelay();
            return { status: this._loginLimiter.isLockedOut(username) ? exports.Status.FAILED_LOCKED_OUT : exports.Status.FAILED };
        }
        this._loginLimiter.recordAttempt(username);
        const user = this._getUser(username, password);
        if (!user) {
            await this._randomDelay();
            return { status: this._loginLimiter.isLockedOut(username) ? exports.Status.FAILED_LOCKED_OUT : exports.Status.FAILED };
        }
        if (this._enable2fa) {
            const bypassEntry = existingBypassToken
                ? this._getBypassToken?.(existingBypassToken)
                : null;
            if (bypassEntry?.username === username) {
                this._loginLimiter.clearAttempts(username);
                return { status: exports.Status.BYPASSED, user };
            }
            const { key, code } = this._twoFAStore.create(user);
            return { status: exports.Status.TWO_FA_REQUIRED, user, twoFAKey: key, code };
        }
        this._loginLimiter.clearAttempts(username);
        return { status: exports.Status.SUCCESS, user };
    }
    async verifyTwoFA(twoFAKey, twoFACode) {
        if (!twoFAKey) {
            return { status: exports.Status.FAILED };
        }
        if (!this._twoFALimiter?.canAttempt(twoFAKey)) {
            return { status: exports.Status.FAILED_TWO_FA_LOCKED };
        }
        const entry = this._twoFAStore.get(twoFAKey);
        if (!entry) {
            return { status: exports.Status.FAILED_TWO_FA_EXPIRED };
        }
        this._twoFALimiter.recordAttempt(twoFAKey);
        if (!(0, utils_1.timingSafeCompare)(twoFACode, entry.code)) {
            return { status: exports.Status.FAILED };
        }
        this._twoFALimiter.clearAttempts(twoFAKey);
        this._twoFAStore.remove(twoFAKey);
        const bypassToken = crypto_1.default.randomBytes(32).toString('hex');
        this._saveBypassToken({
            token: bypassToken,
            username: entry.user.username,
            expiresAt: Date.now() + this._bypassMaxAge,
        });
        this._loginLimiter.clearAttempts(entry.user.username);
        return {
            status: exports.Status.SUCCESS,
            user: entry.user,
            bypassToken,
            bypassMaxAge: this._bypassMaxAge,
        };
    }
    async getPendingTwoFA(twoFAKey) {
        if (!twoFAKey || !this._resendLimiter?.canAttempt(twoFAKey)) {
            return { status: exports.Status.FAILED };
        }
        this._resendLimiter.recordAttempt(twoFAKey);
        const entry = this._twoFAStore.get(twoFAKey);
        if (!entry) {
            return { status: exports.Status.FAILED };
        }
        return { status: exports.Status.SUCCESS, user: entry.user, code: entry.code };
    }
}
exports.LoginService = LoginService;
LoginService.Status = exports.Status;
function randomDelay([min, max]) {
    return new Promise((resolve) => setTimeout(resolve, crypto_1.default.randomInt(min, max)));
}
//# sourceMappingURL=login.js.map