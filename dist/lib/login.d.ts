import type { User } from './user-store';
import type { BypassTokenEntry, NewBypassToken } from './bypass-token-store';
export declare const Status: Readonly<{
    readonly TWO_FA_REQUIRED: "twoFA";
    readonly BYPASSED: "bypassed";
    readonly SUCCESS: "success";
    readonly FAILED: "failed";
    readonly FAILED_LOCKED_OUT: "failed_locked_out";
}>;
export type AuthResult = {
    status: typeof Status.TWO_FA_REQUIRED;
    username: string;
    user: User;
    twoFAKey: string;
    code: string;
} | {
    status: typeof Status.BYPASSED;
    username: string;
    user: User;
} | {
    status: typeof Status.SUCCESS;
    username: string;
} | {
    status: typeof Status.FAILED;
} | {
    status: typeof Status.FAILED_LOCKED_OUT;
};
export type TwoFAResult = {
    status: typeof Status.SUCCESS;
    username: string;
    bypassToken: string;
    bypassMaxAge: number;
} | {
    status: typeof Status.FAILED;
};
export interface LoginServiceOptions {
    getUser: (username: string, password: string) => User | null;
    isValidUser: (username: string) => boolean;
    enable2fa?: boolean;
    getBypassToken?: (token: string) => BypassTokenEntry | undefined;
    saveBypassToken?: (entry: NewBypassToken) => void;
    bypassTokenMaxAgeMs?: number;
    maxLoginAttempts?: number;
    loginLockoutMs?: number;
    loginInvalidUsersCacheSize?: number;
    codeTtlMs?: number;
    failDelayMs?: [number, number];
}
export declare class LoginService {
    static readonly Status: Readonly<{
        readonly TWO_FA_REQUIRED: "twoFA";
        readonly BYPASSED: "bypassed";
        readonly SUCCESS: "success";
        readonly FAILED: "failed";
        readonly FAILED_LOCKED_OUT: "failed_locked_out";
    }>;
    private _getUser;
    private _enable2fa;
    private _getBypassToken?;
    private _saveBypassToken?;
    private _bypassMaxAge;
    private _failDelay;
    private _loginLimiter;
    private _twoFAStore?;
    private _twoFALimiter?;
    private _randomDelay;
    constructor(opts: LoginServiceOptions);
    authenticate(username: string, password: string, existingBypassToken?: string | null): Promise<AuthResult>;
    verifyTwoFA(twoFAKey: string, twoFACode: string): Promise<TwoFAResult>;
}
//# sourceMappingURL=login.d.ts.map