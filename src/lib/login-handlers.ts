import type { Request, Response, NextFunction, RequestHandler, CookieOptions } from 'express';
import { LoginService, Status } from './login';
import { destroySession, regenerateSession } from './session-utils';
import { deliverTwoFACode } from './two-fa-delivery';
import type { EmailSender } from './email-sender';
import type { DiscordSender } from './discord-sender';

const DEFAULT_COOKIE_NAMES = {
  twoFAKey: 'TWOFAKEY',
  bypass: 'TWOFABYPASS',
};

interface LoginHandlersOptions {
  buildCookieOptions: (extra?: Partial<CookieOptions>) => CookieOptions;
  notify?: (message: string, username?: string) => void;
  development?: boolean;
  emailSender?: EmailSender;
  discordSender?: DiscordSender;
}

interface LoginHandlers {
  auth: RequestHandler;
  authTwoFa: RequestHandler;
  resendTwoFAEmail: RequestHandler;
  logout: RequestHandler;
  verify: RequestHandler;
}

export function createLoginHandlers(loginService: LoginService, opts: LoginHandlersOptions): LoginHandlers {
  const { buildCookieOptions, notify = () => {}, development, emailSender, discordSender } = opts;
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
      res.send({ success: false, reason: 'Locked out' });
      return;
    }

    if (result.status === Status.BYPASSED) {
      notify(`${result.user.username} logged in with 2FA bypass (${req.ip})`);
      try {
        await regenerateSession(req, { username: result.user.username });
        res.sendStatus(200);
      } catch (err) {
        next(err);
      }
      return;
    }

    if (result.status === Status.TWO_FA_REQUIRED) {
      res.cookie(cookies.twoFAKey, result.twoFAKey, buildCookieOptions());
      notify(`${result.user.username} passed initial auth, 2FA required (${req.ip})`);

      try {
        const delivery = await deliverTwoFACode(result.user, result.code, { development, emailSender, discordSender });
        res.send({ twoFA: true, channel: delivery.channel, emailFallbackAvailable: delivery.emailFallbackAvailable });
      } catch (err) {
        notify(`Failed to deliver 2FA code to ${result.user.username}: ${(err as Error).message}`, result.user.username);
        res.sendStatus(500);
      }
      return;
    }

    if (result.status === Status.SUCCESS) {
      notify(`${result.user.username} logged in (${req.ip})`);
      try {
        await regenerateSession(req, { username: result.user.username });
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

    notify(`${result.user.username} passed 2FA, logging in (${req.ip})`);
    res.cookie(cookies.twoFAKey, '', buildCookieOptions({ maxAge: 0 }));
    res.cookie(cookies.bypass, result.bypassToken, buildCookieOptions({ maxAge: result.bypassMaxAge }));

    try {
      await regenerateSession(req, { username: result.user.username });
      res.sendStatus(200);
    } catch (err) {
      next(err);
    }
  }

  async function resendTwoFAEmail(req: Request, res: Response): Promise<void> {
    const twoFAKey = (req.cookies?.[cookies.twoFAKey] as string | undefined) ?? '';
    const pending = await loginService.getPendingTwoFA(twoFAKey);

    if (pending.status !== Status.SUCCESS || !pending.user.email || !emailSender) {
      res.send({ success: false });
      return;
    }

    try {
      if (development) {
        console.log(`[kaiauth] (dev) resend 2FA code for ${pending.user.username}: ${pending.code}`);
      } else {
        await emailSender.send(pending.user.email, pending.code);
      }
      notify(`Resent 2FA code via email for ${pending.user.username} (${req.ip})`);
      res.send({ success: true, channel: 'email' });
    } catch (err) {
      notify(`Failed to resend 2FA code via email for ${pending.user.username}: ${(err as Error).message}`);
      res.sendStatus(500);
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
      res.sendStatus(200);
    } catch (err) {
      next(err);
    }
  }

  return { auth, authTwoFa, resendTwoFAEmail, logout, verify };
}
