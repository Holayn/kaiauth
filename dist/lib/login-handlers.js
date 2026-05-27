"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLoginHandlers = createLoginHandlers;
const login_1 = require("./login");
const session_utils_1 = require("./session-utils");
const DEFAULT_COOKIE_NAMES = {
    twoFAKey: 'TWOFAKEY',
    bypass: 'TWOFABYPASS',
};
function createLoginHandlers(loginService, opts) {
    const { buildCookieOptions, notify = () => { } } = opts;
    const cookies = DEFAULT_COOKIE_NAMES;
    async function auth(req, res, next) {
        const { username, password } = req.body;
        const result = await loginService.authenticate(username, password, req.cookies?.[cookies.bypass] ?? null);
        if (result.status === login_1.Status.FAILED) {
            res.send({ success: false });
            return;
        }
        if (result.status === login_1.Status.FAILED_LOCKED_OUT) {
            notify(`User ${username} is locked out due to too many failed login attempts`);
            res.send({ success: false });
            return;
        }
        if (result.status === login_1.Status.BYPASSED) {
            notify(`${result.username} logged in with 2FA bypass (${req.ip})`);
            try {
                await (0, session_utils_1.regenerateSession)(req, { username: result.username });
                res.sendStatus(200);
            }
            catch (err) {
                next(err);
            }
            return;
        }
        if (result.status === login_1.Status.TWO_FA_REQUIRED) {
            res.cookie(cookies.twoFAKey, result.twoFAKey, buildCookieOptions());
            notify(`${result.username} passed initial auth, 2FA required (${req.ip})`);
            notify(result.code, result.username);
            res.send({ twoFA: true });
            return;
        }
        if (result.status === login_1.Status.SUCCESS) {
            notify(`${result.username} logged in (${req.ip})`);
            try {
                await (0, session_utils_1.regenerateSession)(req, { username: result.username });
                res.sendStatus(200);
            }
            catch (err) {
                next(err);
            }
            return;
        }
        throw new Error(`Unexpected login result status: ${result.status}`);
    }
    async function authTwoFa(req, res, next) {
        const { twoFACode } = req.body;
        const twoFAKey = req.cookies?.[cookies.twoFAKey] ?? '';
        const result = await loginService.verifyTwoFA(twoFAKey, twoFACode);
        if (result.status === login_1.Status.FAILED) {
            res.send({ success: false });
            return;
        }
        notify(`${result.username} passed 2FA, logging in (${req.ip})`);
        res.cookie(cookies.twoFAKey, '', buildCookieOptions({ maxAge: 0 }));
        res.cookie(cookies.bypass, result.bypassToken, buildCookieOptions({ maxAge: result.bypassMaxAge }));
        try {
            await (0, session_utils_1.regenerateSession)(req, { username: result.username });
            res.sendStatus(200);
        }
        catch (err) {
            next(err);
        }
    }
    async function logout(req, res, next) {
        try {
            await (0, session_utils_1.destroySession)(req);
            res.sendStatus(200);
        }
        catch (err) {
            next(err);
        }
    }
    async function verify(req, res, next) {
        try {
            await (0, session_utils_1.regenerateSession)(req, { username: req.session.user.username });
            res.sendStatus(200);
        }
        catch (err) {
            next(err);
        }
    }
    return { auth, authTwoFa, logout, verify };
}
//# sourceMappingURL=login-handlers.js.map