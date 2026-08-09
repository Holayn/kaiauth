import type { RequestHandler, CookieOptions } from 'express';
import { LoginService } from '../login';
import type { EmailSender } from '../delivery/email-sender';
import type { DiscordSender } from '../delivery/discord-sender';
interface LoginHandlersOptions {
    buildCookieOptions: (extra?: Partial<CookieOptions>) => CookieOptions;
    notify?: (message: string) => void;
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
export declare function createLoginHandlers(loginService: LoginService, opts: LoginHandlersOptions): LoginHandlers;
export {};
//# sourceMappingURL=login-handlers.d.ts.map