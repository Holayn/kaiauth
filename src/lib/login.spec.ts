import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LoginService, Status } from './login';
import type { User } from './user-store';

const user: User = { id: 1, username: 'alice', email: 'alice@example.com', discord: null };

function makeService(overrides: Partial<ConstructorParameters<typeof LoginService>[0]> = {}) {
  return new LoginService({
    getUser: (username, password) => (username === 'alice' && password === 'pw' ? user : null),
    isValidUser: (username) => username === 'alice',
    saveBypassToken: () => {},
    maxResendAttempts: 2,
    ...overrides,
  });
}

describe('LoginService.getPendingTwoFA', () => {
  it('returns FAILED for an unknown key', async () => {
    const service = makeService();
    const result = await service.getPendingTwoFA('nonexistent');
    expect(result.status).toBe(Status.FAILED);
  });

  it('returns the pending user and code for a valid key without consuming it', async () => {
    const service = makeService();
    const authResult = await service.authenticate('alice', 'pw');
    if (authResult.status !== Status.TWO_FA_REQUIRED) throw new Error('expected 2FA required');

    const first = await service.getPendingTwoFA(authResult.twoFAKey);
    expect(first).toEqual({ status: Status.SUCCESS, user, code: authResult.code });

    const second = await service.getPendingTwoFA(authResult.twoFAKey);
    expect(second.status).toBe(Status.SUCCESS);
  });

  it('rate-limits resend attempts independently from verify attempts', async () => {
    const service = makeService({ maxResendAttempts: 2, maxLoginAttempts: 10 });
    const authResult = await service.authenticate('alice', 'pw');
    if (authResult.status !== Status.TWO_FA_REQUIRED) throw new Error('expected 2FA required');

    await service.getPendingTwoFA(authResult.twoFAKey);
    await service.getPendingTwoFA(authResult.twoFAKey);
    const third = await service.getPendingTwoFA(authResult.twoFAKey);
    expect(third.status).toBe(Status.FAILED);

    // Verifying the actual code should still work — the resend limiter above must not affect it.
    const verify = await service.verifyTwoFA(authResult.twoFAKey, authResult.code);
    expect(verify.status).toBe(Status.SUCCESS);
  });
});

describe('LoginService.verifyTwoFA', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns FAILED for an empty key', async () => {
    const service = makeService();
    const result = await service.verifyTwoFA('', '123456');
    expect(result.status).toBe(Status.FAILED);
  });

  it('returns FAILED_TWO_FA_EXPIRED for a key that never existed', async () => {
    const service = makeService();
    const result = await service.verifyTwoFA('nonexistent', '123456');
    expect(result.status).toBe(Status.FAILED_TWO_FA_EXPIRED);
  });

  it('returns FAILED_TWO_FA_EXPIRED once the code has expired', async () => {
    const service = makeService({ codeTtlMs: 1000 });
    const authResult = await service.authenticate('alice', 'pw');
    if (authResult.status !== Status.TWO_FA_REQUIRED) throw new Error('expected 2FA required');

    vi.advanceTimersByTime(1001);

    const result = await service.verifyTwoFA(authResult.twoFAKey, authResult.code);
    expect(result.status).toBe(Status.FAILED_TWO_FA_EXPIRED);
  });

  it('returns FAILED for a wrong code against a valid pending entry', async () => {
    const service = makeService();
    const authResult = await service.authenticate('alice', 'pw');
    if (authResult.status !== Status.TWO_FA_REQUIRED) throw new Error('expected 2FA required');

    const result = await service.verifyTwoFA(authResult.twoFAKey, 'WRONGCODE');
    expect(result.status).toBe(Status.FAILED);
  });

  it('locks out after repeated wrong codes, returning FAILED_TWO_FA_LOCKED on the next attempt', async () => {
    const service = makeService();
    const authResult = await service.authenticate('alice', 'pw');
    if (authResult.status !== Status.TWO_FA_REQUIRED) throw new Error('expected 2FA required');

    // Default _twoFALimiter maxAttempts is 3 — three wrong guesses each return FAILED...
    for (let i = 0; i < 3; i++) {
      const result = await service.verifyTwoFA(authResult.twoFAKey, 'WRONGCODE');
      expect(result.status).toBe(Status.FAILED);
    }

    // ...and the next attempt (even with the correct code) is locked out instead.
    const locked = await service.verifyTwoFA(authResult.twoFAKey, authResult.code);
    expect(locked.status).toBe(Status.FAILED_TWO_FA_LOCKED);
  });

  it('still succeeds with the correct code after some wrong attempts, below the lockout threshold', async () => {
    const service = makeService();
    const authResult = await service.authenticate('alice', 'pw');
    if (authResult.status !== Status.TWO_FA_REQUIRED) throw new Error('expected 2FA required');

    await service.verifyTwoFA(authResult.twoFAKey, 'WRONGCODE');

    const result = await service.verifyTwoFA(authResult.twoFAKey, authResult.code);
    expect(result.status).toBe(Status.SUCCESS);
  });

  it('consumes the pending entry on success, so re-verifying the same key returns FAILED_TWO_FA_EXPIRED', async () => {
    const service = makeService();
    const authResult = await service.authenticate('alice', 'pw');
    if (authResult.status !== Status.TWO_FA_REQUIRED) throw new Error('expected 2FA required');

    const first = await service.verifyTwoFA(authResult.twoFAKey, authResult.code);
    expect(first.status).toBe(Status.SUCCESS);

    const second = await service.verifyTwoFA(authResult.twoFAKey, authResult.code);
    expect(second.status).toBe(Status.FAILED_TWO_FA_EXPIRED);
  });
});
