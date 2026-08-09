"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuthRouter = createAuthRouter;
const express_1 = __importDefault(require("express"));
const express_session_1 = __importDefault(require("express-session"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const sqlite_session_store_1 = require("../store/sqlite-session-store");
const login_1 = require("../login");
const login_handlers_1 = require("./login-handlers");
const bypass_token_store_1 = require("../store/bypass-token-store");
const user_store_1 = require("../store/user-store");
const login_page_1 = require("./login-page");
const discord_sender_1 = require("../delivery/discord-sender");
const email_sender_1 = require("../delivery/email-sender");
function requiredBody(properties) {
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
function createAuthRouter(opts) {
    const { authDataDir, sessionSecret, buildCookieOptions, notify, enable2fa = true, serveLoginPage = false, development, email, discord, } = opts;
    if (!path_1.default.isAbsolute(authDataDir)) {
        throw new Error('createAuthRouter requires an absolute path for authDataDir');
    }
    if (fs_1.default.existsSync(authDataDir) && !fs_1.default.statSync(authDataDir).isDirectory()) {
        throw new Error('createAuthRouter authDataDir must be a directory');
    }
    if (!notify)
        throw new Error('createAuthRouter requires a notify function');
    if (enable2fa && !development && !email && !discord) {
        throw new Error('createAuthRouter requires at least one 2FA delivery method (email or discord) when enable2fa is true, unless development is set');
    }
    fs_1.default.mkdirSync(authDataDir, { recursive: true });
    const discordSender = discord ? new discord_sender_1.DiscordSender(discord) : undefined;
    const emailSender = email ? new email_sender_1.EmailSender(email) : undefined;
    const db = new better_sqlite3_1.default(path_1.default.join(authDataDir, 'auth.db'));
    const userStore = new user_store_1.UserStore(db);
    let bypassTokenStore;
    if (enable2fa) {
        bypassTokenStore = new bypass_token_store_1.BypassTokenStore(db);
        bypassTokenStore.deleteExpired();
        const bypassCleanupInterval = setInterval(() => bypassTokenStore.deleteExpired(), 24 * 60 * 60 * 1000);
        bypassCleanupInterval.unref();
    }
    const loginService = new login_1.LoginService({
        getUser: (username, password) => userStore.authenticate(username, password),
        isValidUser: (username) => userStore.exists(username),
        ...(enable2fa && bypassTokenStore && {
            getBypassToken: (token) => bypassTokenStore.getByToken(token),
            saveBypassToken: (entry) => bypassTokenStore.insert(entry),
        }),
        enable2fa,
        loginInvalidUsersCacheSize: opts.loginInvalidUsersCacheSize,
        maxResendAttempts: opts.twoFAResend?.maxAttempts,
        resendLockoutMs: opts.twoFAResend?.lockoutMs,
    });
    const sessionStore = new sqlite_session_store_1.SQLiteSessionStore(new better_sqlite3_1.default(path_1.default.join(authDataDir, 'sessions.db')));
    const { auth, authTwoFa, resendTwoFAEmail, logout, verify } = (0, login_handlers_1.createLoginHandlers)(loginService, {
        buildCookieOptions,
        notify,
        development,
        emailSender,
        discordSender,
    });
    const requireAuth = (req, res, next) => {
        return req.session.user ? next() : res.sendStatus(401);
    };
    const apiRouter = express_1.default.Router();
    apiRouter.use((0, express_session_1.default)({
        cookie: buildCookieOptions({ maxAge: 7 * 24 * 60 * 60 * 1000 }),
        name: 'session',
        proxy: true,
        resave: false,
        rolling: true,
        saveUninitialized: false,
        secret: sessionSecret,
        store: sessionStore,
    }));
    let pageRouter;
    if (serveLoginPage) {
        pageRouter = express_1.default.Router();
        const loginPageHtml = (0, login_page_1.renderLoginPageHtml)(opts.loginPageOptions?.title, opts.loginPageOptions?.apiBasePath);
        pageRouter.get('/login', (req, res) => {
            res.type('html').send(loginPageHtml);
        });
        pageRouter.get('/login.js', (req, res) => {
            res.type('js').send(login_page_1.loginPageJs);
        });
    }
    apiRouter.post('/auth', requiredBody(['username', 'password']), auth);
    if (enable2fa) {
        apiRouter.post('/auth/2fa', requiredBody(['twoFACode']), authTwoFa);
        apiRouter.post('/auth/2fa/resend-email', resendTwoFAEmail);
        apiRouter.post('/auth/revoke-2fa-bypass', requireAuth, (req, res) => {
            const { username } = req.body;
            if (username) {
                bypassTokenStore.deleteByUsername(username);
            }
            else {
                bypassTokenStore.deleteAll();
            }
            res.sendStatus(200);
        });
    }
    apiRouter.post('/auth/logout', requireAuth, logout);
    apiRouter.get('/auth/verify', requireAuth, verify);
    apiRouter.post('/auth/invalidate-all-sessions', requireAuth, (req, res) => {
        sessionStore.deleteAll();
        if (enable2fa) {
            bypassTokenStore.deleteAll();
        }
        res.sendStatus(200);
    });
    if (enable2fa) {
        return { apiRouter, pageRouter, requireAuth, loginService, sessionStore, bypassTokenStore, userStore, db };
    }
    return { apiRouter, pageRouter, requireAuth, loginService, sessionStore, userStore, db };
}
//# sourceMappingURL=auth-router.js.map