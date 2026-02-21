const LoginService = require('./login');
const { destroySession, regenerateSession } = require('./session-utils');

const { Status } = LoginService;

const DEFAULT_COOKIE_NAMES = {
  twoFAKey: 'TWOFAKEY',
  bypass: 'TWOFABYPASS',
};

/**
 * Create reusable Express route handlers for the login + 2FA flow.
 *
 * The handlers own HTTP/cookie/session plumbing — all business logic
 * lives in the provided LoginService instance.  Notification delivery
 * is delegated to the injected `notify` callback.
 *
 * @param {LoginService} loginService
 * @param {object}       opts
 * @param {(extra?: object) => object} opts.buildCookieOptions
 *   Return a cookie-options object (httpOnly, sameSite, secure, …).
 *   Called with optional extra properties (e.g. `{ maxAge }`).
 * @param {(message: string, user?: string) => void} [opts.notify]
 *   Notification callback for auth events.  When a 2FA code is issued,
 *   called as `notify(code, user.notifyUser)` where `user` is the
 *   authenticated user object returned by the credentials callback.
 * @returns {{ auth: Function, authTwoFa: Function, logout: Function, verify: Function }}
 */
function createLoginHandlers(loginService, opts) {
  const {
    buildCookieOptions,
    notify = () => {},
  } = opts;

  const cookies = DEFAULT_COOKIE_NAMES;

  async function auth(req, res, next) {
    const { username, password } = req.body;
    const result = await loginService.authenticate(
      username,
      password,
      req.cookies[cookies.bypass],
    );

    if (result.status === Status.FAILED) {
      return res.send({ success: false });
    }

    if (result.status === Status.FAILED_LOCKED_OUT) {
      notify(`User ${username} is locked out due to too many failed login attempts`);
      return res.send({ success: false });
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
      notify(result.code, result.user.notifyUser);
      return res.send({ twoFA: true });
    }

    throw new Error(`Unexpected login result status: ${result.status}`);
  }

  async function authTwoFa(req, res, next) {
    const { twoFACode } = req.body;
    const twoFAKey = req.cookies[cookies.twoFAKey];

    const result = await loginService.verifyTwoFA(twoFAKey, twoFACode);

    if (result.status === Status.FAILED) {
      return res.send({ success: false });
    }

    notify(`${result.username} passed 2FA, logging in (${req.ip})`);

    res.cookie(cookies.twoFAKey, '', buildCookieOptions({ maxAge: 0 }));
    res.cookie(cookies.bypass, result.bypassToken, buildCookieOptions({ maxAge: result.bypassMaxAge }));

    try {
      await regenerateSession(req, { username: result.username });
      return res.sendStatus(200);
    } catch (err) {
      next(err);
    }
  }

  /** Logout — destroy the session. */
  async function logout(req, res, next) {
    try {
      await destroySession(req);
      res.sendStatus(200);
    } catch (err) {
      next(err);
    }
  }

  /** Verify — regenerate session while keeping user data. */
  async function verify(req, res, next) {
    try {
      await regenerateSession(req, { username: req.session.user.username });
      res.sendStatus(200);
    } catch (err) {
      next(err);
    }
  }

  return { auth, authTwoFa, logout, verify };
}

module.exports = createLoginHandlers;
