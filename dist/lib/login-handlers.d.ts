import type { RequestHandler, CookieOptions } from 'express';
import { LoginService } from './login';
interface LoginHandlersOptions {
    buildCookieOptions: (extra?: Partial<CookieOptions>) => CookieOptions;
    notify?: (message: string, username?: string) => void;
}
interface LoginHandlers {
    auth: RequestHandler;
    authTwoFa: RequestHandler;
    logout: RequestHandler;
    verify: RequestHandler;
}
export declare function createLoginHandlers(loginService: LoginService, opts: LoginHandlersOptions): LoginHandlers;
export {};
//# sourceMappingURL=login-handlers.d.ts.map