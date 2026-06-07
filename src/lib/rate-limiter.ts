import { LRUCache } from "lru-cache";

interface RateLimiterOptions {
  isValidKey: (key: string) => boolean;
  maxAttempts?: number;
  lockoutDurationMs?: number;
  invalidKeysCacheSize?: number;
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
  private _badAttempts: LRUCache<string, AttemptEntry>;

  constructor({ isValidKey, maxAttempts = 3, lockoutDurationMs = 15 * 60 * 1000, invalidKeysCacheSize = 5000 }: RateLimiterOptions) {
    this._isValidKey = isValidKey;
    this._maxAttempts = maxAttempts;
    this._lockoutDurationMs = lockoutDurationMs;
    this._badAttempts = new LRUCache<string, AttemptEntry>({
      max: invalidKeysCacheSize,
      ttl: lockoutDurationMs,
    });
  }

  canAttempt(key: string): boolean {
    const entry = this._getAttemptEntry(key);
    if (!entry) return true;
    if (entry.lockedUntil && Date.now() < entry.lockedUntil) return false;
    if (entry.lockedUntil && Date.now() >= entry.lockedUntil) {
      this._attempts.delete(key);
      return true;
    }
    return true;
  }

  recordAttempt(key: string): void {
    const entry = this._getAttemptEntry(key) ?? { count: 0, lockedUntil: 0 };
    entry.count += 1;
    if (entry.count >= this._maxAttempts) {
      entry.lockedUntil = Date.now() + this._lockoutDurationMs;
    }

    if (this._isValidKey(key)) {
      this._attempts.set(key, entry);
    } else {
      this._badAttempts.set(key, entry);
    }
  }

  clearAttempts(key: string): void {
    this._attempts.delete(key);
  }

  isLockedOut(key: string): boolean {
    const entry = this._getAttemptEntry(key);
    return !!entry?.lockedUntil && Date.now() < entry.lockedUntil;
  }

  private _getAttemptEntry(key: string) {
    const legitAttempt = this._attempts.get(key);
    const badAttempt = this._badAttempts.get(key);
    return legitAttempt || badAttempt;
  }
}
