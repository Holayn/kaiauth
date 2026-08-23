"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.twoFACodeEmail = twoFACodeEmail;
exports.deliverTwoFACode = deliverTwoFACode;
/** Subject/body for a 2FA code email — shared by the initial send and the resend endpoint so their wording can't drift apart. */
function twoFACodeEmail(code) {
    return { subject: 'Your verification code', body: `Your verification code is: ${code}` };
}
function twoFACodeMessage(code) {
    return `Your verification code is: ${code}`;
}
async function deliverTwoFACode(user, code, opts) {
    const emailAvailable = !!(user.email && opts.sendEmail);
    if (opts.development) {
        console.log(`[kaiauth] (dev) 2FA code for ${user.username}: ${code}`);
        return { channel: 'development', emailFallbackAvailable: false };
    }
    if (user.discord && opts.sendDiscordDM) {
        await opts.sendDiscordDM(user.discord, twoFACodeMessage(code));
        return { channel: 'discord', emailFallbackAvailable: emailAvailable };
    }
    if (user.email && opts.sendEmail) {
        const { subject, body } = twoFACodeEmail(code);
        await opts.sendEmail(user.email, subject, body);
        return { channel: 'email', emailFallbackAvailable: false };
    }
    throw new Error(`No 2FA delivery channel available for user ${user.username} (no email or discord on file/configured)`);
}
//# sourceMappingURL=two-fa-delivery.js.map