import crypto from 'crypto';
import { RateLimiter } from './rate-limiter';
import { TwoFAStore } from './store/two-fa-store';
import { timingSafeCompare } from './utils';
import type { User } from './store/user-store';
import type { BypassTokenEntry, NewBypassToken } from './store/bypass-token-store';

const BYPASS_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_FAIL_DELAY: [number, number] = [200, 600];

export const Status = Object.freeze({
  TWO_FA_REQUIRED: 'twoFA',
  BYPASSED: 'bypassed',
  SUCCESS: 'success',
  FAILED: 'failed',
  FAILED_LOCKED_OUT: 'failed_locked_out',
  FAILED_TWO_FA_LOCKED: 'failed_2fa_locked',
  FAILED_TWO_FA_EXPIRED: 'failed_2fa_expired',
} as const);

export type AuthResult =
  | { status: typeof Status.TWO_FA_REQUIRED; user: User; twoFAKey: string; code: string }
  | { status: typeof Status.BYPASSED; user: User }
  | { status: typeof Status.SUCCESS; user: User }
  | { status: typeof Status.FAILED }
  | { status: typeof Status.FAILED_LOCKED_OUT };

export type TwoFAResult =
  | { status: typeof Status.SUCCESS; user: User; bypassToken: string; bypassMaxAge: number }
  | { status: typeof Status.FAILED }
  | { status: typeof Status.FAILED_TWO_FA_LOCKED }
  | { status: typeof Status.FAILED_TWO_FA_EXPIRED };

export interface LoginServiceOptions {
  getUser: (username: string, password: string) => User | null;
  isValidUser: (username: string) => boolean;
  enable2fa?: boolean;
  getBypassToken?: (token: string) => BypassTokenEntry | undefined;
  saveBypassToken?: (entry: NewBypassToken) => void;
  bypassTokenMaxAgeMs?: number;
  maxLoginAttempts?: number;
  loginLockoutMs?: number;
  loginInvalidUsersCacheSize?: number;
  codeTtlMs?: number;
  failDelayMs?: [number, number];
  maxResendAttempts?: number;
  resendLockoutMs?: number;
}

export type PendingTwoFAResult =
  | { status: typeof Status.SUCCESS; user: User; code: string }
  | { status: typeof Status.FAILED };

export class LoginService {
  static readonly Status = Status;

  private _getUser: (username: string, password: string) => User | null;
  private _enable2fa: boolean;
  private _getBypassToken?: (token: string) => BypassTokenEntry | undefined;
  private _saveBypassToken?: (entry: NewBypassToken) => void;
  private _bypassMaxAge: number;
  private _failDelay: [number, number];
  private _loginLimiter: RateLimiter;
  private _twoFAStore?: TwoFAStore;
  private _twoFALimiter?: RateLimiter;
  private _resendLimiter?: RateLimiter;
  private _randomDelay: () => Promise<void>;

  constructor(opts: LoginServiceOptions) {
    this._getUser = opts.getUser;
    this._enable2fa = opts.enable2fa ?? true;
    this._getBypassToken = opts.getBypassToken;
    this._saveBypassToken = opts.saveBypassToken;
    this._bypassMaxAge = opts.bypassTokenMaxAgeMs ?? BYPASS_MAX_AGE;
    this._failDelay = opts.failDelayMs ?? DEFAULT_FAIL_DELAY;

    this._loginLimiter = new RateLimiter({
      isValidKey: opts.isValidUser,
      maxAttempts: opts.maxLoginAttempts ?? 3,
      lockoutDurationMs: opts.loginLockoutMs ?? 15 * 60 * 1000,
      invalidKeysCacheSize: opts.loginInvalidUsersCacheSize,
    });

    if (this._enable2fa) {
      this._twoFAStore = new TwoFAStore({ codeTtlMs: opts.codeTtlMs });
      this._twoFALimiter = new RateLimiter({
        isValidKey: (key) => this._twoFAStore!.has(key),
      });
      this._resendLimiter = new RateLimiter({
        isValidKey: (key) => this._twoFAStore!.has(key),
        maxAttempts: opts.maxResendAttempts ?? 3,
        lockoutDurationMs: opts.resendLockoutMs ?? 5 * 60 * 1000,
      });
    }

    this._randomDelay = () => randomDelay(this._failDelay);
  }

  async authenticate(username: string, password: string, existingBypassToken: string | null = null): Promise<AuthResult> {
    if (!this._loginLimiter.canAttempt(username)) {
      await this._randomDelay();
      return { status: this._loginLimiter.isLockedOut(username) ? Status.FAILED_LOCKED_OUT : Status.FAILED };
    }

    this._loginLimiter.recordAttempt(username);
    const user = this._getUser(username, password);

    if (!user) {
      await this._randomDelay();
      return { status: this._loginLimiter.isLockedOut(username) ? Status.FAILED_LOCKED_OUT : Status.FAILED };
    }

    if (this._enable2fa) {
      const bypassEntry = existingBypassToken
        ? this._getBypassToken?.(existingBypassToken)
        : null;

      if (bypassEntry?.username === username) {
        this._loginLimiter.clearAttempts(username);
        
        return { status: Status.BYPASSED, user };
      }

      const { key, code } = this._twoFAStore!.create(user);
      return { status: Status.TWO_FA_REQUIRED, user, twoFAKey: key, code };
    }

    this._loginLimiter.clearAttempts(username);

    return { status: Status.SUCCESS, user };
  }

  async verifyTwoFA(twoFAKey: string, twoFACode: string): Promise<TwoFAResult> {
    if (!twoFAKey) {
      return { status: Status.FAILED };
    }

    if (!this._twoFALimiter?.canAttempt(twoFAKey)) {
      return { status: Status.FAILED_TWO_FA_LOCKED };
    }

    const entry = this._twoFAStore!.get(twoFAKey);

    if (!entry) {
      return { status: Status.FAILED_TWO_FA_EXPIRED };
    }

    this._twoFALimiter.recordAttempt(twoFAKey);

    if (!timingSafeCompare(twoFACode, entry.code)) {
      return { status: Status.FAILED };
    }

    this._twoFALimiter.clearAttempts(twoFAKey);
    this._twoFAStore!.remove(twoFAKey);

    const bypassToken = crypto.randomBytes(32).toString('hex');
    this._saveBypassToken!({
      token: bypassToken,
      username: entry.user.username,
      expiresAt: Date.now() + this._bypassMaxAge,
    });

    this._loginLimiter.clearAttempts(entry.user.username);

    return {
      status: Status.SUCCESS,
      user: entry.user,
      bypassToken,
      bypassMaxAge: this._bypassMaxAge,
    };
  }

  async getPendingTwoFA(twoFAKey: string): Promise<PendingTwoFAResult> {
    if (!twoFAKey || !this._resendLimiter?.canAttempt(twoFAKey)) {
      return { status: Status.FAILED };
    }

    this._resendLimiter.recordAttempt(twoFAKey);

    const entry = this._twoFAStore!.get(twoFAKey);
    if (!entry) {
      return { status: Status.FAILED };
    }

    return { status: Status.SUCCESS, user: entry.user, code: entry.code };
  }
}

function randomDelay([min, max]: [number, number]): Promise<void> {
  return new Promise((resolve) =>
    setTimeout(resolve, crypto.randomInt(min, max))
  );
}
