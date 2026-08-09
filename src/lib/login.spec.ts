import { describe, it, expect } from 'vitest';
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
