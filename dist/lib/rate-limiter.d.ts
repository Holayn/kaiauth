interface RateLimiterOptions {
    isValidKey: (key: string) => boolean;
    maxAttempts?: number;
    lockoutDurationMs?: number;
    invalidKeysCacheSize?: number;
    /**
     * How long to remember a valid key's attempt count since it was last touched.
     * Must be at least `lockoutDurationMs` — otherwise a locked-out entry could be evicted
     * (and its lockout silently lifted) before `lockedUntil` actually passes. Defaults to
     * `lockoutDurationMs`; values below it are clamped up to it.
     */
    attemptsTtlMs?: number;
}
export declare class RateLimiter {
    private _isValidKey;
    private _maxAttempts;
    private _lockoutDurationMs;
    private _attempts;
    private _badAttempts;
    constructor({ isValidKey, maxAttempts, lockoutDurationMs, invalidKeysCacheSize, attemptsTtlMs }: RateLimiterOptions);
    canAttempt(key: string): boolean;
    recordAttempt(key: string): void;
    clearAttempts(key: string): void;
    isLockedOut(key: string): boolean;
    private _getAttemptEntry;
}
export {};
//# sourceMappingURL=rate-limiter.d.ts.map