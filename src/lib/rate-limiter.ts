interface RateLimiterOptions {
  isValidKey: (key: string) => boolean;
  maxAttempts?: number;
  lockoutDurationMs?: number;
}

interface AttemptEntry {
  count: number;
  lockedUntil: number;
}

export class RateLimiter {
  private _isValidKey: (key: string) => boolean;
  private _maxAttempts: number;
  private _lockoutDurationMs: number;
  private _attempts: Map<string, AttemptEntry> = new Map();

  constructor({ isValidKey, maxAttempts = 3, lockoutDurationMs = 15 * 60 * 1000 }: RateLimiterOptions) {
    this._isValidKey = isValidKey;
    this._maxAttempts = maxAttempts;
    this._lockoutDurationMs = lockoutDurationMs;
  }

  canAttempt(key: string): boolean {
    if (!this._isValidKey(key)) return true;
    const entry = this._attempts.get(key);
    if (!entry) return true;
    if (entry.lockedUntil && Date.now() < entry.lockedUntil) return false;
    if (entry.lockedUntil && Date.now() >= entry.lockedUntil) {
      this._attempts.delete(key);
      return true;
    }
    return true;
  }

  recordAttempt(key: string): void {
    if (!this._isValidKey(key)) return;
    const entry = this._attempts.get(key) ?? { count: 0, lockedUntil: 0 };
    entry.count += 1;
    if (entry.count >= this._maxAttempts) {
      entry.lockedUntil = Date.now() + this._lockoutDurationMs;
    }
    this._attempts.set(key, entry);
  }

  clearAttempts(key: string): void {
    this._attempts.delete(key);
  }

  isLockedOut(key: string): boolean {
    const entry = this._attempts.get(key);
    return !!entry?.lockedUntil && Date.now() < entry.lockedUntil;
  }
}
