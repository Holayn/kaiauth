import { describe, it, expect, vi } from 'vitest';
import { createLoginHandlers } from './login-handlers';
import { Status, type LoginService } from '../login';
import type { User } from '../store/user-store';
import type { EmailSender } from '../delivery/email-sender';

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
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Failed to deliver 2FA code'));
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

describe('login-handlers authTwoFa mustRetry handling', () => {
  it('responds success:false with no mustRetry for a plain wrong code', async () => {
    const loginService = {
      verifyTwoFA: vi.fn().mockResolvedValue({ status: Status.FAILED }),
    } as unknown as LoginService;

    const { authTwoFa } = createLoginHandlers(loginService, {
      buildCookieOptions: () => ({}),
      notify: vi.fn(),
    });

    const res = fakeRes();
    await authTwoFa(fakeReq({ twoFACode: 'WRONGCODE' }, { TWOFAKEY: 'key' }), res as never, vi.fn());

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: false });
  });

  it('responds success:false with mustRetry:true when the 2FA session has expired', async () => {
    const loginService = {
      verifyTwoFA: vi.fn().mockResolvedValue({ status: Status.FAILED_TWO_FA_EXPIRED }),
    } as unknown as LoginService;

    const { authTwoFa } = createLoginHandlers(loginService, {
      buildCookieOptions: () => ({}),
      notify: vi.fn(),
    });

    const res = fakeRes();
    await authTwoFa(fakeReq({ twoFACode: '123456' }, { TWOFAKEY: 'stale' }), res as never, vi.fn());

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: false, mustRetry: true });
  });

  it('responds success:false with mustRetry:true when the 2FA session is locked out', async () => {
    const loginService = {
      verifyTwoFA: vi.fn().mockResolvedValue({ status: Status.FAILED_TWO_FA_LOCKED }),
    } as unknown as LoginService;

    const { authTwoFa } = createLoginHandlers(loginService, {
      buildCookieOptions: () => ({}),
      notify: vi.fn(),
    });

    const res = fakeRes();
    await authTwoFa(fakeReq({ twoFACode: '123456' }, { TWOFAKEY: 'locked' }), res as never, vi.fn());

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: false, mustRetry: true });
  });

  it('regenerates the session and responds 200 on success', async () => {
    const loginService = {
      verifyTwoFA: vi.fn().mockResolvedValue({
        status: Status.SUCCESS,
        user,
        bypassToken: 'bypass-token',
        bypassMaxAge: 1000,
      }),
    } as unknown as LoginService;

    const notify = vi.fn();
    const { authTwoFa } = createLoginHandlers(loginService, {
      buildCookieOptions: () => ({}),
      notify,
    });

    const res = fakeRes();
    const req = {
      body: { twoFACode: '123456' },
      cookies: { TWOFAKEY: 'key' },
      ip: '127.0.0.1',
      session: {
        regenerate: (cb: (err?: Error) => void) => cb(),
        save: (cb: (err?: Error) => void) => cb(),
      },
    };

    await authTwoFa(req as never, res as never, vi.fn());

    expect(res.statusCode).toBe(200);
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('passed 2FA'));
  });
});

describe('login-handlers redirectTo resolution', () => {
  function sessionReq(body: Record<string, unknown>) {
    return {
      body,
      cookies: {},
      ip: '127.0.0.1',
      session: {
        regenerate: (cb: (err?: Error) => void) => cb(),
        save: (cb: (err?: Error) => void) => cb(),
      },
    };
  }

  it('auth() falls back to "/" when defaultRedirect is unset and no redirect is requested', async () => {
    const loginService = {
      authenticate: vi.fn().mockResolvedValue({ status: Status.SUCCESS, user }),
    } as unknown as LoginService;

    const { auth } = createLoginHandlers(loginService, {
      buildCookieOptions: () => ({}),
      notify: vi.fn(),
    });

    const res = fakeRes();
    await auth(sessionReq({ username: 'alice', password: 'pw' }) as never, res as never, vi.fn());

    expect(res.body).toEqual({ success: true, redirectTo: '/' });
  });

  it('auth() uses the configured defaultRedirect when no redirect is requested', async () => {
    const loginService = {
      authenticate: vi.fn().mockResolvedValue({ status: Status.SUCCESS, user }),
    } as unknown as LoginService;

    const { auth } = createLoginHandlers(loginService, {
      buildCookieOptions: () => ({}),
      notify: vi.fn(),
      defaultRedirect: '/admin',
    });

    const res = fakeRes();
    await auth(sessionReq({ username: 'alice', password: 'pw' }) as never, res as never, vi.fn());

    expect(res.body).toEqual({ success: true, redirectTo: '/admin' });
  });

  it('auth() echoes back a valid requested redirect, overriding defaultRedirect', async () => {
    const loginService = {
      authenticate: vi.fn().mockResolvedValue({ status: Status.SUCCESS, user }),
    } as unknown as LoginService;

    const { auth } = createLoginHandlers(loginService, {
      buildCookieOptions: () => ({}),
      notify: vi.fn(),
      defaultRedirect: '/admin',
    });

    const res = fakeRes();
    await auth(sessionReq({ username: 'alice', password: 'pw', redirect: '/admin/orders' }) as never, res as never, vi.fn());

    expect(res.body).toEqual({ success: true, redirectTo: '/admin/orders' });
  });

  it.each([
    ['protocol-relative (open redirect)', '//evil.com'],
    ['missing leading slash', 'admin'],
    ['not a string', 123],
  ])('auth() ignores an unsafe requested redirect (%s) and falls back to defaultRedirect', async (_label, redirect) => {
    const loginService = {
      authenticate: vi.fn().mockResolvedValue({ status: Status.SUCCESS, user }),
    } as unknown as LoginService;

    const { auth } = createLoginHandlers(loginService, {
      buildCookieOptions: () => ({}),
      notify: vi.fn(),
      defaultRedirect: '/admin',
    });

    const res = fakeRes();
    await auth(sessionReq({ username: 'alice', password: 'pw', redirect }) as never, res as never, vi.fn());

    expect(res.body).toEqual({ success: true, redirectTo: '/admin' });
  });

  it('auth() resolves redirectTo on a 2FA bypass login', async () => {
    const loginService = {
      authenticate: vi.fn().mockResolvedValue({ status: Status.BYPASSED, user }),
    } as unknown as LoginService;

    const { auth } = createLoginHandlers(loginService, {
      buildCookieOptions: () => ({}),
      notify: vi.fn(),
      defaultRedirect: '/admin',
    });

    const res = fakeRes();
    await auth(sessionReq({ username: 'alice', password: 'pw' }) as never, res as never, vi.fn());

    expect(res.body).toEqual({ success: true, redirectTo: '/admin' });
  });

  it('authTwoFa() resolves redirectTo independently from its own request body', async () => {
    const loginService = {
      verifyTwoFA: vi.fn().mockResolvedValue({ status: Status.SUCCESS, user, bypassToken: 'tok', bypassMaxAge: 1000 }),
    } as unknown as LoginService;

    const { authTwoFa } = createLoginHandlers(loginService, {
      buildCookieOptions: () => ({}),
      notify: vi.fn(),
      defaultRedirect: '/admin',
    });

    const res = fakeRes();
    await authTwoFa(sessionReq({ twoFACode: '123456', redirect: '/admin/orders' }) as never, res as never, vi.fn());

    expect(res.body).toEqual({ success: true, redirectTo: '/admin/orders' });
  });
});
