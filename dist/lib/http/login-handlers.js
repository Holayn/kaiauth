"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLoginHandlers = createLoginHandlers;
const login_1 = require("../login");
const session_utils_1 = require("./session-utils");
const two_fa_delivery_1 = require("../delivery/two-fa-delivery");
const utils_1 = require("../utils");
const DEFAULT_COOKIE_NAMES = {
    twoFAKey: 'TWOFAKEY',
    bypass: 'TWOFABYPASS',
};
function createLoginHandlers(loginService, opts) {
    const { buildCookieOptions, notify = () => { }, development, emailSender, discordSender, defaultRedirect = '/' } = opts;
    const cookies = DEFAULT_COOKIE_NAMES;
    // The client can't know in advance where it's safe to land (that's a server-side policy
    // decision), so it just forwards whatever `redirect` it read off its own URL — untrusted,
    // and validated here on every request rather than trusted from the client's own check.
    function resolveRedirect(body) {
        const raw = body?.redirect;
        return typeof raw === 'string' && (0, utils_1.isSameOriginPath)(raw) ? raw : defaultRedirect;
    }
    async function auth(req, res, next) {
        const { username, password } = req.body;
        const result = await loginService.authenticate(username, password, req.cookies?.[cookies.bypass] ?? null);
        if (result.status === login_1.Status.FAILED) {
            res.send({ success: false });
            return;
        }
        if (result.status === login_1.Status.FAILED_LOCKED_OUT) {
            notify(`User ${username} is locked out due to too many failed login attempts`);
            res.send({ success: false, reason: 'Locked out' });
            return;
        }
        if (result.status === login_1.Status.BYPASSED) {
            notify(`${result.user.username} logged in with 2FA bypass (${req.ip})`);
            try {
                await (0, session_utils_1.regenerateSession)(req, { username: result.user.username });
                res.send({ success: true, redirectTo: resolveRedirect(req.body) });
            }
            catch (err) {
                next(err);
            }
            return;
        }
        if (result.status === login_1.Status.TWO_FA_REQUIRED) {
            res.cookie(cookies.twoFAKey, result.twoFAKey, buildCookieOptions());
            notify(`${result.user.username} passed initial auth, 2FA required (${req.ip})`);
            try {
                const delivery = await (0, two_fa_delivery_1.deliverTwoFACode)(result.user, result.code, { development, emailSender, discordSender });
                res.send({ twoFA: true, channel: delivery.channel, emailFallbackAvailable: delivery.emailFallbackAvailable });
            }
            catch (err) {
                notify(`Failed to deliver 2FA code to ${result.user.username}: ${err.message}`);
                res.sendStatus(500);
            }
            return;
        }
        if (result.status === login_1.Status.SUCCESS) {
            notify(`${result.user.username} logged in (${req.ip})`);
            try {
                await (0, session_utils_1.regenerateSession)(req, { username: result.user.username });
                res.send({ success: true, redirectTo: resolveRedirect(req.body) });
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
        if (result.status === login_1.Status.FAILED_TWO_FA_EXPIRED || result.status === login_1.Status.FAILED_TWO_FA_LOCKED) {
            res.send({ success: false, mustRetry: true });
            return;
        }
        notify(`${result.user.username} passed 2FA, logging in (${req.ip})`);
        res.cookie(cookies.twoFAKey, '', buildCookieOptions({ maxAge: 0 }));
        res.cookie(cookies.bypass, result.bypassToken, buildCookieOptions({ maxAge: result.bypassMaxAge }));
        try {
            await (0, session_utils_1.regenerateSession)(req, { username: result.user.username });
            res.send({ success: true, redirectTo: resolveRedirect(req.body) });
        }
        catch (err) {
            next(err);
        }
    }
    async function resendTwoFAEmail(req, res) {
        const twoFAKey = req.cookies?.[cookies.twoFAKey] ?? '';
        const pending = await loginService.getPendingTwoFA(twoFAKey);
        if (pending.status !== login_1.Status.SUCCESS || !pending.user.email || !emailSender) {
            res.send({ success: false });
            return;
        }
        try {
            if (development) {
                console.log(`[kaiauth] (dev) resend 2FA code for ${pending.user.username}: ${pending.code}`);
            }
            else {
                await emailSender.send(pending.user.email, pending.code);
            }
            notify(`Resent 2FA code via email for ${pending.user.username} (${req.ip})`);
            res.send({ success: true, channel: 'email' });
        }
        catch (err) {
            notify(`Failed to resend 2FA code via email for ${pending.user.username}: ${err.message}`);
            res.sendStatus(500);
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
            res.sendStatus(200);
        }
        catch (err) {
            next(err);
        }
    }
    return { auth, authTwoFa, resendTwoFAEmail, logout, verify };
}
//# sourceMappingURL=login-handlers.js.map