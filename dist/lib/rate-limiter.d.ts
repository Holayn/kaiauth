interface RateLimiterOptions {
    isValidKey: (key: string) => boolean;
    maxAttempts?: number;
    lockoutDurationMs?: number;
}
export declare class RateLimiter {
    private _isValidKey;
    private _maxAttempts;
    private _lockoutDurationMs;
    private _attempts;
    constructor({ isValidKey, maxAttempts, lockoutDurationMs }: RateLimiterOptions);
    canAttempt(key: string): boolean;
    recordAttempt(key: string): void;
    clearAttempts(key: string): void;
    isLockedOut(key: string): boolean;
}
export {};
//# sourceMappingURL=rate-limiter.d.ts.map