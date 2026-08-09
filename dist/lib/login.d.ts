import type { User } from './store/user-store';
import type { BypassTokenEntry, NewBypassToken } from './store/bypass-token-store';
export declare const Status: Readonly<{
    readonly TWO_FA_REQUIRED: "twoFA";
    readonly BYPASSED: "bypassed";
    readonly SUCCESS: "success";
    readonly FAILED: "failed";
    readonly FAILED_LOCKED_OUT: "failed_locked_out";
    readonly FAILED_TWO_FA_LOCKED: "failed_2fa_locked";
    readonly FAILED_TWO_FA_EXPIRED: "failed_2fa_expired";
}>;
export type AuthResult = {
    status: typeof Status.TWO_FA_REQUIRED;
    user: User;
    twoFAKey: string;
    code: string;
} | {
    status: typeof Status.BYPASSED;
    user: User;
} | {
    status: typeof Status.SUCCESS;
    user: User;
} | {
    status: typeof Status.FAILED;
} | {
    status: typeof Status.FAILED_LOCKED_OUT;
};
export type TwoFAResult = {
    status: typeof Status.SUCCESS;
    user: User;
    bypassToken: string;
    bypassMaxAge: number;
} | {
    status: typeof Status.FAILED;
} | {
    status: typeof Status.FAILED_TWO_FA_LOCKED;
} | {
    status: typeof Status.FAILED_TWO_FA_EXPIRED;
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
    maxResendAttempts?: number;
    resendLockoutMs?: number;
}
export type PendingTwoFAResult = {
    status: typeof Status.SUCCESS;
    user: User;
    code: string;
} | {
    status: typeof Status.FAILED;
};
export declare class LoginService {
    static readonly Status: Readonly<{
        readonly TWO_FA_REQUIRED: "twoFA";
        readonly BYPASSED: "bypassed";
        readonly SUCCESS: "success";
        readonly FAILED: "failed";
        readonly FAILED_LOCKED_OUT: "failed_locked_out";
        readonly FAILED_TWO_FA_LOCKED: "failed_2fa_locked";
        readonly FAILED_TWO_FA_EXPIRED: "failed_2fa_expired";
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
    private _resendLimiter?;
    private _randomDelay;
    constructor(opts: LoginServiceOptions);
    authenticate(username: string, password: string, existingBypassToken?: string | null): Promise<AuthResult>;
    verifyTwoFA(twoFAKey: string, twoFACode: string): Promise<TwoFAResult>;
    getPendingTwoFA(twoFAKey: string): Promise<PendingTwoFAResult>;
}
//# sourceMappingURL=login.d.ts.map