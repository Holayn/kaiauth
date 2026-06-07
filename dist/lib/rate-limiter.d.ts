interface RateLimiterOptions {
    isValidKey: (key: string) => boolean;
    maxAttempts?: number;
    lockoutDurationMs?: number;
    invalidKeysCacheSize?: number;
}
export declare class RateLimiter {
    private _isValidKey;
    private _maxAttempts;
    private _lockoutDurationMs;
    private _attempts;
    private _badAttempts;
    constructor({ isValidKey, maxAttempts, lockoutDurationMs, invalidKeysCacheSize }: RateLimiterOptions);
    canAttempt(key: string): boolean;
    recordAttempt(key: string): void;
    clearAttempts(key: string): void;
    isLockedOut(key: string): boolean;
    private _getAttemptEntry;
}
export {};
//# sourceMappingURL=rate-limiter.d.ts.map