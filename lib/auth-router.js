const express = require('express');
const session = require('express-session');
const Database = require('better-sqlite3');
const SQLiteStore = require('connect-sqlite3')(session);
const LoginService = require('./login');
const createLoginHandlers = require('./login-handlers');
const BypassTokenStore = require('./bypass-token-store');
const UserStore = require('./user-store');

/**
 * Express middleware that validates required body properties.
 * @param {string[]} properties
 */
function requiredBody(properties) {
  return (req, res, next) => {
    for (const p of properties) {
      if (!req.body.hasOwnProperty(p)) {
        return res.status(400).send(`Missing property: ${p}`);
      }
    }
    next();
  };
}

/**
 * Create a fully-configured Express router for the complete auth lifecycle:
 * login, logout, session verification, and session invalidation.  When
 * `enable2fa` is true (the default), the router also handles the 2FA code
 * challenge and bypass-token revocation.
 *
 * kaiauth creates and owns its own SQLite database for users, sessions, and
 * (when 2FA is enabled) bypass tokens.  No external database needs to be
 * passed in.
 *
 * Usage:
 *   const { router } = createAuthRouter({ ... });
 *   app.use(router);
 *
 * @param {object} opts
 *
 * @param {string} [opts.dbPath='./auth.db']
 *   Path to the SQLite database file that kaiauth will create and own.
 *   Stores users and, when 2FA is enabled, bypass tokens.
 *
 * @param {string} opts.sessionSecret
 *   Secret used to sign the session cookie.
 * @param {string} [opts.sessionDbPath='./sessions.db']
 *   Path to the SQLite session database file.
 *
 * @param {(extra?: object) => object} opts.buildCookieOptions
 *   Build cookie options for auth cookies (session, and when 2FA is enabled,
 *   the 2FA key and bypass token cookies).
 *   Called with optional extra properties (e.g. `{ maxAge }`) that are merged in.
 *
 * @param {(message: string, username: string) => void} opts.notify
 *   **Required.** Notification callback invoked on auth events.  When a 2FA
 *   code is issued, called as `notify(code, username)` so the code can be
 *   delivered to the user.
 *
 * @param {boolean} [opts.enable2fa=true]
 *   When `false`, the 2FA challenge is skipped entirely: successful credential
 *   validation creates a session immediately.  The `/auth/2fa` and
 *   `/auth/revoke-2fa-bypass` routes are not registered, and `bypassTokenStore`
 *   is not returned.
 *
 * @returns {{
 *   router: import('express').Router,
 *   requireAuth: Function,
 *   loginService: import('./login'),
 *   sessionStore: object,
 *   bypassTokenStore?: import('./bypass-token-store'),
 *   userStore: import('./user-store'),
 *   db: import('better-sqlite3').Database
 * }}
 */
function createAuthRouter(opts) {
  const {
    dbPath = './auth.db',
    sessionSecret,
    sessionDbPath = './sessions.db',
    buildCookieOptions,
    notify,
    enable2fa = true,
  } = opts;

  if (!notify) {
    throw new Error('createAuthRouter requires a notify function');
  }

  const db = new Database(dbPath);
  const userStore = new UserStore(db);

  let bypassTokenStore;
  if (enable2fa) {
    bypassTokenStore = new BypassTokenStore(db);
    // Proactively clean up expired bypass tokens on startup and every 24 hours.
    bypassTokenStore.deleteExpired();
    const bypassCleanupInterval = setInterval(() => bypassTokenStore.deleteExpired(), 24 * 60 * 60 * 1000);
    bypassCleanupInterval.unref();
  }

  const loginService = new LoginService({
    getUser: (username, password) => userStore.authenticate(username, password),
    isValidUser: (username) => userStore.exists(username),
    ...(enable2fa && {
      getBypassToken: (token) => bypassTokenStore.getByToken(token),
      saveBypassToken: (entry) => bypassTokenStore.insert(entry),
    }),
    enable2fa,
  });

  const sessionStore = new SQLiteStore({ db: sessionDbPath });

  const { auth, authTwoFa, logout, verify } = createLoginHandlers(loginService, {
    buildCookieOptions,
    notify,
  });

  /** Middleware — reject unauthenticated requests with 401. */
  function requireAuth(req, res, next) {
    return req.session.user ? next() : res.sendStatus(401);
  }

  // -- Session middleware --------------------------------------------------
  const router = express.Router();

  router.use(session({
    cookie: buildCookieOptions({
      maxAge: 7 * 24 * 60 * 60 * 1000, 
    }),
    name: 'session',
    proxy: true,
    resave: false,
    rolling: true,
    saveUninitialized: false,
    secret: sessionSecret,
    store: sessionStore,
  }));

  // -- Routes --------------------------------------------------------------
  router.post('/auth', requiredBody(['username', 'password']), auth);
  if (enable2fa) {
    router.post('/auth/2fa', requiredBody(['twoFACode']), authTwoFa);
    router.post('/auth/revoke-2fa-bypass', requireAuth, (req, res) => {
      const { username } = req.body;
      if (username) {
        bypassTokenStore.deleteByUsername(username);
      } else {
        bypassTokenStore.deleteAll();
      }
      res.sendStatus(200);
    });
  }
  router.post('/auth/logout', requireAuth, logout);
  router.get('/auth/verify', requireAuth, verify);
  router.post('/auth/invalidate-all-sessions', requireAuth, (req, res) => {
    sessionStore.db.prepare('DELETE FROM sessions').run();
    if (enable2fa) {
      bypassTokenStore.deleteAll();
    }
    res.sendStatus(200);
  });

  if (enable2fa) {
    return { router, requireAuth, loginService, sessionStore, bypassTokenStore, userStore, db };
  }

  return { router, requireAuth, loginService, sessionStore, userStore, db };
}

module.exports = createAuthRouter;
