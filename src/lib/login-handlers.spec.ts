import { describe, it, expect, vi } from 'vitest';
import { createLoginHandlers } from './login-handlers';
import { Status, type LoginService } from './login';
import type { User } from './user-store';
import type { EmailSender } from './email-sender';

const user: User = { id: 1, username: 'alice', email: 'alice@example.com', discord: null };

function fakeEmailSender(send: (to: string, code: string) => Promise<void>): EmailSender {
  return { send } as unknown as EmailSender;
}

function fakeRes() {
  const res: { statusCode?: number; body?: unknown; sendStatus: (n: number) => void; send: (b: unknown) => void; cookie: () => void } = {
    sendStatus: (n: number) => { res.statusCode = n; },
    send: (b: unknown) => { res.statusCode = 200; res.body = b; },
    cookie: () => {},
  };
  return res;
}

function fakeReq(body: Record<string, unknown> = {}, cookies: Record<string, string> = {}) {
  return { body, cookies, ip: '127.0.0.1' } as unknown as Parameters<ReturnType<typeof createLoginHandlers>['auth']>[0];
}

describe('login-handlers delivery failure handling', () => {
  it('auth() responds 500 when 2FA code delivery fails', async () => {
    const discordUser: User = { ...user, discord: '123456789012345678' };
    const loginService = {
      authenticate: vi.fn().mockResolvedValue({
        status: Status.TWO_FA_REQUIRED,
        user: discordUser,
        twoFAKey: 'key',
        code: '123456',
      }),
    } as unknown as LoginService;

    const discordSender = { send: vi.fn().mockRejectedValue(new Error('discord down')) };
    const notify = vi.fn();

    const { auth } = createLoginHandlers(loginService, {
      buildCookieOptions: () => ({}),
      notify,
      discordSender: discordSender as never,
    });

    const res = fakeRes();
    await auth(fakeReq({ username: 'alice', password: 'pw' }), res as never, vi.fn());

    expect(res.statusCode).toBe(500);
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Failed to deliver 2FA code'), 'alice');
  });

  it('auth() responds 200 with emailFallbackAvailable when delivery succeeds', async () => {
    const loginService = {
      authenticate: vi.fn().mockResolvedValue({
        status: Status.TWO_FA_REQUIRED,
        user,
        twoFAKey: 'key',
        code: '123456',
      }),
    } as unknown as LoginService;

    const { auth } = createLoginHandlers(loginService, {
      buildCookieOptions: () => ({}),
      notify: vi.fn(),
      emailSender: fakeEmailSender(vi.fn()),
      development: true,
    });

    const res = fakeRes();
    await auth(fakeReq({ username: 'alice', password: 'pw' }), res as never, vi.fn());

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ twoFA: true, channel: 'development', emailFallbackAvailable: false });
  });

  it('resendTwoFAEmail responds success:true with channel:email when the send succeeds', async () => {
    const loginService = {
      getPendingTwoFA: vi.fn().mockResolvedValue({ status: Status.SUCCESS, user, code: '123456' }),
    } as unknown as LoginService;

    const { resendTwoFAEmail } = createLoginHandlers(loginService, {
      buildCookieOptions: () => ({}),
      notify: vi.fn(),
      emailSender: fakeEmailSender(vi.fn().mockResolvedValue(undefined)),
    });

    const res = fakeRes();
    await resendTwoFAEmail(fakeReq({}, { TWOFAKEY: 'key' }), res as never, vi.fn());

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, channel: 'email' });
  });

  it('resendTwoFAEmail responds 500 when the email send fails', async () => {
    const loginService = {
      getPendingTwoFA: vi.fn().mockResolvedValue({ status: Status.SUCCESS, user, code: '123456' }),
    } as unknown as LoginService;

    const { resendTwoFAEmail } = createLoginHandlers(loginService, {
      buildCookieOptions: () => ({}),
      notify: vi.fn(),
      emailSender: fakeEmailSender(vi.fn().mockRejectedValue(new Error('invalid API key'))),
    });

    const res = fakeRes();
    await resendTwoFAEmail(fakeReq({}, { TWOFAKEY: 'key' }), res as never, vi.fn());

    expect(res.statusCode).toBe(500);
  });

  it('resendTwoFAEmail responds success:false (200) when the user has no email on file', async () => {
    const loginService = {
      getPendingTwoFA: vi.fn().mockResolvedValue({
        status: Status.SUCCESS,
        user: { ...user, email: null },
        code: '123456',
      }),
    } as unknown as LoginService;

    const { resendTwoFAEmail } = createLoginHandlers(loginService, {
      buildCookieOptions: () => ({}),
      notify: vi.fn(),
      emailSender: fakeEmailSender(vi.fn()),
    });

    const res = fakeRes();
    await resendTwoFAEmail(fakeReq({}, { TWOFAKEY: 'key' }), res as never, vi.fn());

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: false });
  });
});
