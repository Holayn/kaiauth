import { type Router, type RequestHandler, type CookieOptions } from 'express';
import Database from 'better-sqlite3';
import { SQLiteSessionStore } from '../store/sqlite-session-store';
import { LoginService } from '../login';
import { BypassTokenStore } from '../store/bypass-token-store';
import { UserStore } from '../store/user-store';
import { type DiscordSenderConfig } from '../delivery/discord-sender';
import { type EmailSenderConfig } from '../delivery/email-sender';
export interface AuthRouterOptions {
    authDataDir: string;
    sessionSecret: string;
    buildCookieOptions: (extra?: Partial<CookieOptions>) => CookieOptions;
    notify: (message: string, username?: string) => void;
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
export declare function createAuthRouter(opts: AuthRouterOptions): AuthRouterResult;
//# sourceMappingURL=auth-router.d.ts.map