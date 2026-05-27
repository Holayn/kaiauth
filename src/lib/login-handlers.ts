import type { Request, Response, NextFunction, RequestHandler, CookieOptions } from 'express';
import { LoginService, Status } from './login';
import { destroySession, regenerateSession } from './session-utils';

const DEFAULT_COOKIE_NAMES = {
  twoFAKey: 'TWOFAKEY',
  bypass: 'TWOFABYPASS',
};

interface LoginHandlersOptions {
  buildCookieOptions: (extra?: Partial<CookieOptions>) => CookieOptions;
  notify?: (message: string, username?: string) => void;
}

interface LoginHandlers {
  auth: RequestHandler;
  authTwoFa: RequestHandler;
  logout: RequestHandler;
  verify: RequestHandler;
}

export function createLoginHandlers(loginService: LoginService, opts: LoginHandlersOptions): LoginHandlers {
  const { buildCookieOptions, notify = () => {} } = opts;
  const cookies = DEFAULT_COOKIE_NAMES;

  async function auth(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { username, password } = req.body as { username: string; password: string };
    const result = await loginService.authenticate(
      username,
      password,
      req.cookies?.[cookies.bypass] ?? null,
    );

    if (result.status === Status.FAILED) {
      res.send({ success: false });
      return;
    }

    if (result.status === Status.FAILED_LOCKED_OUT) {
      notify(`User ${username} is locked out due to too many failed login attempts`);
      res.send({ success: false });
      return;
    }

    if (result.status === Status.BYPASSED) {
      notify(`${result.username} logged in with 2FA bypass (${req.ip})`);
      try {
        await regenerateSession(req, { username: result.username });
        res.sendStatus(200);
      } catch (err) {
        next(err);
      }
      return;
    }

    if (result.status === Status.TWO_FA_REQUIRED) {
      res.cookie(cookies.twoFAKey, result.twoFAKey, buildCookieOptions());
      notify(`${result.username} passed initial auth, 2FA required (${req.ip})`);
      notify(result.code, result.username);
      res.send({ twoFA: true });
      return;
    }

    if (result.status === Status.SUCCESS) {
      notify(`${result.username} logged in (${req.ip})`);
      try {
        await regenerateSession(req, { username: result.username });
        res.sendStatus(200);
      } catch (err) {
        next(err);
      }
      return;
    }

    throw new Error(`Unexpected login result status: ${(result as { status: string }).status}`);
  }

  async function authTwoFa(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { twoFACode } = req.body as { twoFACode: string };
    const twoFAKey = (req.cookies?.[cookies.twoFAKey] as string | undefined) ?? '';

    const result = await loginService.verifyTwoFA(twoFAKey, twoFACode);

    if (result.status === Status.FAILED) {
      res.send({ success: false });
      return;
    }

    notify(`${result.username} passed 2FA, logging in (${req.ip})`);
    res.cookie(cookies.twoFAKey, '', buildCookieOptions({ maxAge: 0 }));
    res.cookie(cookies.bypass, result.bypassToken, buildCookieOptions({ maxAge: result.bypassMaxAge }));

    try {
      await regenerateSession(req, { username: result.username });
      res.sendStatus(200);
    } catch (err) {
      next(err);
    }
  }

  async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await destroySession(req);
      res.sendStatus(200);
    } catch (err) {
      next(err);
    }
  }

  async function verify(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await regenerateSession(req, { username: req.session.user!.username });
      res.sendStatus(200);
    } catch (err) {
      next(err);
    }
  }

  return { auth, authTwoFa, logout, verify };
}
