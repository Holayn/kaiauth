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

describe('LoginService login-attempt limiter clearing', () => {
  // `_loginLimiter.recordAttempt` runs on every `authenticate()` call, success or failure —
  // so with maxLoginAttempts: 3, two wrong passwords followed by one correct-credentials
  // call already pushes the count to 3, which triggers the limiter's own lockout regardless
  // of the login outcome. Whether that lockout survives into the *next* call is exactly what
  // distinguishes "cleared" from "not cleared" in these tests.
  //
  // Failed attempts go through a real (200-600ms) random delay, so fake timers are used here
  // and advanced alongside every call that's expected to fail, to keep this fast.

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  async function failedAttempt(service: LoginService, username: string, password: string) {
    const [result] = await Promise.all([
      service.authenticate(username, password),
      vi.advanceTimersByTimeAsync(600),
    ]);
    return result;
  }

  it('does not clear login attempts merely on correct credentials when a 2FA challenge is issued', async () => {
    const service = makeService({ maxLoginAttempts: 3 });

    await failedAttempt(service, 'alice', 'wrong');
    await failedAttempt(service, 'alice', 'wrong');

    const authResult = await service.authenticate('alice', 'pw');
    expect(authResult.status).toBe(Status.TWO_FA_REQUIRED);

    // If correct credentials alone had cleared the counter, this would be TWO_FA_REQUIRED
    // again instead of locked out.
    const next = await failedAttempt(service, 'alice', 'pw');
    expect(next.status).toBe(Status.FAILED_LOCKED_OUT);
  });

  it('clears login attempts once 2FA verification succeeds', async () => {
    const service = makeService({ maxLoginAttempts: 3 });

    await failedAttempt(service, 'alice', 'wrong');
    await failedAttempt(service, 'alice', 'wrong');

    const authResult = await service.authenticate('alice', 'pw');
    if (authResult.status !== Status.TWO_FA_REQUIRED) throw new Error('expected 2FA required');
    // _loginLimiter is now locked (count hit 3 above) — but that only gates authenticate(),
    // not verifyTwoFA(), so completing 2FA is still possible.

    const verify = await service.verifyTwoFA(authResult.twoFAKey, authResult.code);
    expect(verify.status).toBe(Status.SUCCESS);

    const next = await failedAttempt(service, 'alice', 'wrong');
    expect(next.status).toBe(Status.FAILED);
  });

  it('clears login attempts on a bypassed login, not just on correct credentials', async () => {
    const bypassEntry = { username: 'alice', token: 'valid-token' };
    const service = makeService({
      maxLoginAttempts: 3,
      getBypassToken: (token) => (token === 'valid-token' ? bypassEntry : undefined),
    });

    await failedAttempt(service, 'alice', 'wrong');
    await failedAttempt(service, 'alice', 'wrong');

    const bypassed = await service.authenticate('alice', 'pw', 'valid-token');
    expect(bypassed.status).toBe(Status.BYPASSED);

    // Without the fix, the count would already be 3 (2 wrong + this bypassed call) and this
    // next attempt would come back FAILED_LOCKED_OUT instead of a plain FAILED.
    const next = await failedAttempt(service, 'alice', 'wrong');
    expect(next.status).toBe(Status.FAILED);
  });

  it('clears login attempts on success when 2FA is disabled', async () => {
    const service = makeService({ maxLoginAttempts: 3, enable2fa: false });

    await failedAttempt(service, 'alice', 'wrong');
    await failedAttempt(service, 'alice', 'wrong');

    const authResult = await service.authenticate('alice', 'pw');
    expect(authResult.status).toBe(Status.SUCCESS);

    const next = await failedAttempt(service, 'alice', 'wrong');
    expect(next.status).toBe(Status.FAILED);
  });
});
