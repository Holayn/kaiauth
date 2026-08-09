import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from './rate-limiter';

describe('RateLimiter', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('locks out a key after maxAttempts and un-locks after lockoutDurationMs', () => {
    const limiter = new RateLimiter({ isValidKey: () => true, maxAttempts: 2, lockoutDurationMs: 1000 });

    expect(limiter.canAttempt('k')).toBe(true);
    limiter.recordAttempt('k');
    expect(limiter.canAttempt('k')).toBe(true);
    limiter.recordAttempt('k');

    expect(limiter.canAttempt('k')).toBe(false);
    expect(limiter.isLockedOut('k')).toBe(true);

    vi.advanceTimersByTime(1001);
    expect(limiter.canAttempt('k')).toBe(true);
  });

  it('clearAttempts resets a key immediately', () => {
    const limiter = new RateLimiter({ isValidKey: () => true, maxAttempts: 1, lockoutDurationMs: 1000 });
    limiter.recordAttempt('k');
    expect(limiter.canAttempt('k')).toBe(false);

    limiter.clearAttempts('k');
    expect(limiter.canAttempt('k')).toBe(true);
  });
});

// lru-cache times entries off performance.now(), which fake timers don't drive reliably —
// these use real (short) delays instead of vi.useFakeTimers().
describe('RateLimiter valid-key memory bounds (real timers)', () => {
  it('evicts stale valid-key entries via TTL autopurge, even without any further access', async () => {
    const limiter = new RateLimiter({ isValidKey: () => true, lockoutDurationMs: 20 }) as unknown as RateLimiter & {
      _attempts: { size: number };
    };

    for (let i = 0; i < 50; i++) {
      limiter.recordAttempt(`key-${i}`);
    }
    expect(limiter._attempts.size).toBe(50);

    // ttlAutopurge means these are reclaimed on a background timer, not just lazily on
    // next access — so a key that's never queried again still doesn't leak.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(limiter._attempts.size).toBe(0);
  });

  it('clamps attemptsTtlMs up to lockoutDurationMs so a lockout cannot be evicted early', async () => {
    const limiter = new RateLimiter({
      isValidKey: () => true,
      maxAttempts: 1,
      lockoutDurationMs: 60,
      attemptsTtlMs: 10, // deliberately shorter than lockoutDurationMs
    });

    limiter.recordAttempt('k');
    expect(limiter.isLockedOut('k')).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 30));

    // If the too-short attemptsTtlMs had been honored as-is, this entry would already be
    // gone and isLockedOut would incorrectly report false here.
    expect(limiter.isLockedOut('k')).toBe(true);
  });
});
