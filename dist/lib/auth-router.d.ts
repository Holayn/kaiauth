import { type Router, type RequestHandler, type CookieOptions } from 'express';
import Database from 'better-sqlite3';
import { SQLiteSessionStore } from './sqlite-session-store';
import { LoginService } from './login';
import { BypassTokenStore } from './bypass-token-store';
import { UserStore } from './user-store';
export interface AuthRouterOptions {
    authDataDir: string;
    sessionSecret: string;
    buildCookieOptions: (extra?: Partial<CookieOptions>) => CookieOptions;
    notify: (message: string, username?: string) => void;
    enable2fa?: boolean;
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