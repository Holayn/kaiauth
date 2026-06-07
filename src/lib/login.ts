import crypto from 'crypto';
import { RateLimiter } from './rate-limiter';
import { TwoFAStore } from './two-fa-store';
import { timingSafeCompare } from './utils';
import type { User } from './user-store';
import type { BypassTokenEntry, NewBypassToken } from './bypass-token-store';

const BYPASS_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_FAIL_DELAY: [number, number] = [200, 600];

export const Status = Object.freeze({
  TWO_FA_REQUIRED: 'twoFA',
  BYPASSED: 'bypassed',
  SUCCESS: 'success',
  FAILED: 'failed',
  FAILED_LOCKED_OUT: 'failed_locked_out',
} as const);

export type AuthResult =
  | { status: typeof Status.TWO_FA_REQUIRED; username: string; user: User; twoFAKey: string; code: string }
  | { status: typeof Status.BYPASSED; username: string; user: User }
  | { status: typeof Status.SUCCESS; username: string }
  | { status: typeof Status.FAILED }
  | { status: typeof Status.FAILED_LOCKED_OUT };

export type TwoFAResult =
  | { status: typeof Status.SUCCESS; username: string; bypassToken: string; bypassMaxAge: number }
  | { status: typeof Status.FAILED };

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
}

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

    this._loginLimiter.clearAttempts(username);

    if (this._enable2fa) {
      const bypassEntry = existingBypassToken
        ? this._getBypassToken?.(existingBypassToken)
        : null;

      if (bypassEntry?.username === username) {
        return { status: Status.BYPASSED, username, user };
      }

      const { key, code } = this._twoFAStore!.create(username);
      return { status: Status.TWO_FA_REQUIRED, username, user, twoFAKey: key, code };
    }

    return { status: Status.SUCCESS, username };
  }

  async verifyTwoFA(twoFAKey: string, twoFACode: string): Promise<TwoFAResult> {
    if (!twoFAKey || !this._twoFALimiter?.canAttempt(twoFAKey)) {
      return { status: Status.FAILED };
    }

    this._twoFALimiter.recordAttempt(twoFAKey);

    const entry = this._twoFAStore!.get(twoFAKey);
    if (!entry || !timingSafeCompare(twoFACode, entry.code)) {
      return { status: Status.FAILED };
    }

    this._twoFALimiter.clearAttempts(twoFAKey);
    this._twoFAStore!.remove(twoFAKey);

    const bypassToken = crypto.randomBytes(32).toString('hex');
    this._saveBypassToken!({
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

function randomDelay([min, max]: [number, number]): Promise<void> {
  return new Promise((resolve) =>
    setTimeout(resolve, crypto.randomInt(min, max))
  );
}
