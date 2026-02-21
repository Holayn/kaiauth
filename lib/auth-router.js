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
 * login, 2FA, logout, session verification, session invalidation, and
 * 2FA-bypass revocation.
 *
 * kaiauth creates and owns its own SQLite database for users, bypass tokens,
 * and sessions.  No external database needs to be passed in.
 *
 * Usage:
 *   const { router } = createAuthRouter({ ... });
 *   app.use(router);
 *
 * @param {object} opts
 *
 * @param {string} [opts.dbPath='./auth.db']
 *   Path to the SQLite database file that kaiauth will create and own.
 *   Stores users and 2FA bypass tokens.
 *
 * @param {string} opts.sessionSecret
 *   Secret used to sign the session cookie.
 * @param {string} [opts.sessionDbPath='./sessions.db']
 *   Path to the SQLite session database file.
 *
 * @param {(extra?: object) => object} opts.buildCookieOptions
 *   Build cookie options for all auth cookies (session, 2FA key, bypass token).
 *   Called with optional extra properties (e.g. `{ maxAge }`) that are merged in.
 *
 * @param {(message: string, user?: string) => void} opts.notify
 *   **Required.** Notification callback invoked on auth events.
 *   Called with a descriptive log message for login and 2FA events.
 *   When a 2FA code is issued, called as `notify(code, user.notifyUser)`
 *   where `user` is the object returned by `UserStore.authenticate()`.
 *
 * @returns {{
 *   router: import('express').Router,
 *   requireAuth: Function,
 *   loginService: import('./login'),
 *   sessionStore: object,
 *   bypassTokenStore: import('./bypass-token-store'),
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
  } = opts;

  if (!notify) {
    throw new Error('createAuthRouter requires a notify function');
  }

  const db = new Database(dbPath);
  const bypassTokenStore = new BypassTokenStore(db);
  const userStore = new UserStore(db);

  const deleteAllBypassTokens = () => bypassTokenStore.deleteAll();
  const deleteBypassTokensByUsername = (u) => bypassTokenStore.deleteByUsername(u);

  // Proactively clean up expired bypass tokens on startup and every 24 hours.
  bypassTokenStore.deleteExpired();
  const bypassCleanupInterval = setInterval(() => bypassTokenStore.deleteExpired(), 24 * 60 * 60 * 1000);
  bypassCleanupInterval.unref();
  
  const loginService = new LoginService({
    getUser: (username, password) => userStore.authenticate(username, password),
    isValidUser: (username) => userStore.exists(username),
    getBypassToken: (token) => bypassTokenStore.getByToken(token),
    saveBypassToken: (entry) => bypassTokenStore.insert(entry),
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
  router.post('/auth/2fa', requiredBody(['twoFACode']), authTwoFa);
  router.post('/auth/logout', requireAuth, logout);
  router.get('/auth/verify', requireAuth, verify);
  router.post('/auth/invalidate-all-sessions', requireAuth, (req, res) => {
    sessionStore.db.prepare('DELETE FROM sessions').run();
    deleteAllBypassTokens();
    res.sendStatus(200);
  });
  router.post('/auth/revoke-2fa-bypass', requireAuth, (req, res) => {
    const { username } = req.body;
    if (username) {
      deleteBypassTokensByUsername(username);
    } else {
      deleteAllBypassTokens();
    }
    res.sendStatus(200);
  });

  return { router, requireAuth, loginService, sessionStore, bypassTokenStore, userStore, db };
}

module.exports = createAuthRouter;
