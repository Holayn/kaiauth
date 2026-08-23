import { type Router, type RequestHandler, type CookieOptions } from 'express';
import Database from 'better-sqlite3';
import { SQLiteSessionStore } from '../store/sqlite-session-store';
import { LoginService } from '../login';
import { BypassTokenStore } from '../store/bypass-token-store';
import { UserStore } from '../store/user-store';
import { type DiscordSenderConfig, type SendDiscordDM } from '../delivery/discord-sender';
import { type EmailSenderConfig, type SendEmail } from '../delivery/email-sender';
export interface AuthRouterOptions {
    authDataDir: string;
    sessionSecret: string;
    buildCookieOptions: (extra?: Partial<CookieOptions>) => CookieOptions;
    notify: (message: string) => void;
    enable2fa?: boolean;
    loginInvalidUsersCacheSize?: number;
    /**
     * Where a successful login lands when the request's `redirect` field is absent or isn't a
     * safe same-origin path. Returned as `redirectTo` in the `POST /auth` / `POST /auth/2fa`
     * success response — the built-in login page (and any custom one) navigates there. Must be
     * a same-origin path starting with a single `/`. Defaults to `/`.
     */
    defaultRedirect?: string;
    serveLoginPage?: boolean;
    loginPageOptions?: {
        title?: string;
        /**
         * Base path the login page's client-side JS should call for `/auth*` requests
         * (e.g. `/api` if `apiRouter` is mounted at `/api` while `pageRouter` is mounted at
         * the app root). Defaults to inferring it from the page's own URL, which only works
         * when `pageRouter` and `apiRouter` are mounted at the same path.
         */
        apiBasePath?: string;
    };
    development?: boolean;
    email?: EmailSenderConfig | SendEmail;
    discord?: DiscordSenderConfig | SendDiscordDM;
    twoFAResend?: {
        maxAttempts?: number;
        lockoutMs?: number;
    };
}
export interface AuthRouterResult {
    /** Session middleware + all `/auth*` endpoints. Mount this wherever your API lives. */
    apiRouter: Router;
    /**
     * `GET /login` and `GET /login.js` — static content, no session middleware. Only present
     * when `serveLoginPage` is `true`. Can be mounted at a different path than `apiRouter`;
     * set `loginPageOptions.apiBasePath` if you do.
     */
    pageRouter?: Router;
    requireAuth: RequestHandler;
    loginService: LoginService;
    sessionStore: SQLiteSessionStore;
    bypassTokenStore?: BypassTokenStore;
    userStore: UserStore;
    db: InstanceType<typeof Database>;
}
export declare function createAuthRouter(opts: AuthRouterOptions): AuthRouterResult;
//# sourceMappingURL=auth-router.d.ts.map