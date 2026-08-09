import express, { type Router, type RequestHandler, type CookieOptions } from 'express';
import session from 'express-session';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { SQLiteSessionStore } from '../store/sqlite-session-store';
import { LoginService } from '../login';
import { createLoginHandlers } from './login-handlers';
import { BypassTokenStore } from '../store/bypass-token-store';
import { UserStore } from '../store/user-store';
import { renderLoginPageHtml, loginPageJs } from './login-page';
import { DiscordSender, type DiscordSenderConfig } from '../delivery/discord-sender';
import { EmailSender, type EmailSenderConfig } from '../delivery/email-sender';

function requiredBody(properties: string[]): RequestHandler {
  return (req, res, next) => {
    for (const p of properties) {
      if (!Object.prototype.hasOwnProperty.call(req.body, p)) {
        res.status(400).send(`Missing property: ${p}`);
        return;
      }
    }
    next();
  };
}

export interface AuthRouterOptions {
  authDataDir: string;
  sessionSecret: string;
  buildCookieOptions: (extra?: Partial<CookieOptions>) => CookieOptions;
  notify: (message: string) => void;
  enable2fa?: boolean;
  loginInvalidUsersCacheSize?: number;
  serveLoginPage?: boolean;
  loginPageOptions?: {
    title?: string;
  };
  development?: boolean;
  email?: EmailSenderConfig;
  discord?: DiscordSenderConfig;
  twoFAResend?: {
    maxAttempts?: number;
    lockoutMs?: number;
  };
}

export interface AuthRouterResult {
  router: Router;
  requireAuth: RequestHandler;
  loginService: LoginService;
  sessionStore: SQLiteSessionStore;
  bypassTokenStore?: BypassTokenStore;
  userStore: UserStore;
  db: InstanceType<typeof Database>;
}

export function createAuthRouter(opts: AuthRouterOptions): AuthRouterResult {
  const {
    authDataDir,
    sessionSecret,
    buildCookieOptions,
    notify,
    enable2fa = true,
    serveLoginPage = false,
    development,
    email,
    discord,
  } = opts;

  if (!path.isAbsolute(authDataDir)) {
    throw new Error('createAuthRouter requires an absolute path for authDataDir');
  }
  if (fs.existsSync(authDataDir) && !fs.statSync(authDataDir).isDirectory()) {
    throw new Error('createAuthRouter authDataDir must be a directory');
  }
  if (!notify) throw new Error('createAuthRouter requires a notify function');
  if (enable2fa && !development && !email && !discord) {
    throw new Error(
      'createAuthRouter requires at least one 2FA delivery method (email or discord) when enable2fa is true, unless development is set'
    );
  }

  fs.mkdirSync(authDataDir, { recursive: true });

  const discordSender = discord ? new DiscordSender(discord) : undefined;
  const emailSender = email ? new EmailSender(email) : undefined;

  const db = new Database(path.join(authDataDir, 'auth.db'));
  const userStore = new UserStore(db);

  let bypassTokenStore: BypassTokenStore | undefined;
  if (enable2fa) {
    bypassTokenStore = new BypassTokenStore(db);
    bypassTokenStore.deleteExpired();
    const bypassCleanupInterval = setInterval(() => bypassTokenStore!.deleteExpired(), 24 * 60 * 60 * 1000);
    bypassCleanupInterval.unref();
  }

  const loginService = new LoginService({
    getUser: (username, password) => userStore.authenticate(username, password),
    isValidUser: (username) => userStore.exists(username),
    ...(enable2fa && bypassTokenStore && {
      getBypassToken: (token) => bypassTokenStore!.getByToken(token),
      saveBypassToken: (entry) => bypassTokenStore!.insert(entry),
    }),
    enable2fa,
    loginInvalidUsersCacheSize: opts.loginInvalidUsersCacheSize,
    maxResendAttempts: opts.twoFAResend?.maxAttempts,
    resendLockoutMs: opts.twoFAResend?.lockoutMs,
  });

  const sessionStore = new SQLiteSessionStore(new Database(path.join(authDataDir, 'sessions.db')));

  const { auth, authTwoFa, resendTwoFAEmail, logout, verify } = createLoginHandlers(loginService, {
    buildCookieOptions,
    notify,
    development,
    emailSender,
    discordSender,
  });

  const requireAuth: RequestHandler = (req, res, next) => {
    return req.session.user ? next() : res.sendStatus(401);
  };

  const router = express.Router();

  router.use(session({
    cookie: buildCookieOptions({ maxAge: 7 * 24 * 60 * 60 * 1000 }),
    name: 'session',
    proxy: true,
    resave: false,
    rolling: true,
    saveUninitialized: false,
    secret: sessionSecret,
    store: sessionStore,
  }));

  if (serveLoginPage) {
    const loginPageHtml = renderLoginPageHtml(opts.loginPageOptions?.title);
    router.get('/login', (req, res) => {
      res.type('html').send(loginPageHtml);
    });
    router.get('/login.js', (req, res) => {
      res.type('js').send(loginPageJs);
    });
  }

  router.post('/auth', requiredBody(['username', 'password']), auth);

  if (enable2fa) {
    router.post('/auth/2fa', requiredBody(['twoFACode']), authTwoFa);
    router.post('/auth/2fa/resend-email', resendTwoFAEmail);
    router.post('/auth/revoke-2fa-bypass', requireAuth, (req, res) => {
      const { username } = req.body as { username?: string };
      if (username) {
        bypassTokenStore!.deleteByUsername(username);
      } else {
        bypassTokenStore!.deleteAll();
      }
      res.sendStatus(200);
    });
  }

  router.post('/auth/logout', requireAuth, logout);
  router.get('/auth/verify', requireAuth, verify);
  router.post('/auth/invalidate-all-sessions', requireAuth, (req, res) => {
    sessionStore.deleteAll();
    if (enable2fa) {
      bypassTokenStore!.deleteAll();
    }
    res.sendStatus(200);
  });

  if (enable2fa) {
    return { router, requireAuth, loginService, sessionStore, bypassTokenStore, userStore, db };
  }

  return { router, requireAuth, loginService, sessionStore, userStore, db };
}
