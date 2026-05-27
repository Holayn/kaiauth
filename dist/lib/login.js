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
        });
        if (this._enable2fa) {
            this._twoFAStore = new two_fa_store_1.TwoFAStore({ codeTtlMs: opts.codeTtlMs });
            this._twoFALimiter = new rate_limiter_1.RateLimiter({
                isValidKey: (key) => this._twoFAStore.has(key),
            });
        }
        this._randomDelay = () => randomDelay(this._failDelay);
    }
    async authenticate(username, password, existingBypassToken = null) {
        if (!this._loginLimiter.canAttempt(username)) {
            await this._randomDelay();
            return { status: exports.Status.FAILED };
        }
        this._loginLimiter.recordAttempt(username);
        const user = this._getUser(username, password);
        if (!user) {
            await this._randomDelay();
            return { status: this._loginLimiter.isLockedOut(username) ? exports.Status.FAILED_LOCKED_OUT : exports.Status.FAILED };
        }
        this._loginLimiter.clearAttempts(username);
        if (this._enable2fa) {
            const bypassEntry = existingBypassToken
                ? this._getBypassToken?.(existingBypassToken)
                : null;
            if (bypassEntry?.username === username) {
                return { status: exports.Status.BYPASSED, username, user };
            }
            const { key, code } = this._twoFAStore.create(username);
            return { status: exports.Status.TWO_FA_REQUIRED, username, user, twoFAKey: key, code };
        }
        return { status: exports.Status.SUCCESS, username };
    }
    async verifyTwoFA(twoFAKey, twoFACode) {
        if (!twoFAKey || !this._twoFALimiter?.canAttempt(twoFAKey)) {
            return { status: exports.Status.FAILED };
        }
        this._twoFALimiter.recordAttempt(twoFAKey);
        const entry = this._twoFAStore.get(twoFAKey);
        if (!entry || !(0, utils_1.timingSafeCompare)(twoFACode, entry.code)) {
            return { status: exports.Status.FAILED };
        }
        this._twoFALimiter.clearAttempts(twoFAKey);
        this._twoFAStore.remove(twoFAKey);
        const bypassToken = crypto_1.default.randomBytes(32).toString('hex');
        this._saveBypassToken({
            token: bypassToken,
            username: entry.username,
            expiresAt: Date.now() + this._bypassMaxAge,
        });
        return {
            status: exports.Status.SUCCESS,
            username: entry.username,
            bypassToken,
            bypassMaxAge: this._bypassMaxAge,
        };
    }
}
exports.LoginService = LoginService;
LoginService.Status = exports.Status;
function randomDelay([min, max]) {
    return new Promise((resolve) => setTimeout(resolve, crypto_1.default.randomInt(min, max)));
}
//# sourceMappingURL=login.js.map