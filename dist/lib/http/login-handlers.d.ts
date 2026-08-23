import type { RequestHandler, CookieOptions } from 'express';
import { LoginService } from '../login';
import type { SendEmail } from '../delivery/email-sender';
import type { SendDiscordDM } from 'kai-discord-sender';
interface LoginHandlersOptions {
    buildCookieOptions: (extra?: Partial<CookieOptions>) => CookieOptions;
    notify?: (message: string) => void;
    development?: boolean;
    sendEmail?: SendEmail;
    sendDiscordDM?: SendDiscordDM;
    /** Fallback for `resolveRedirect` when the request has no valid `redirect` field. */
    defaultRedirect?: string;
}
interface LoginHandlers {
    auth: RequestHandler;
    authTwoFa: RequestHandler;
    resendTwoFAEmail: RequestHandler;
    logout: RequestHandler;
    verify: RequestHandler;
}
export declare function createLoginHandlers(loginService: LoginService, opts: LoginHandlersOptions): LoginHandlers;
export {};
//# sourceMappingURL=login-handlers.d.ts.map