import type { User } from './user-store';
export interface TwoFAEntry {
    user: User;
    code: string;
}
interface TwoFAStoreOptions {
    codeTtlMs?: number;
    codeLength?: number;
}
export declare class TwoFAStore {
    private _entries;
    private _codeTtlMs;
    private _codeLength;
    constructor({ codeTtlMs, codeLength }?: TwoFAStoreOptions);
    has(key: string): boolean;
    get(key: string): TwoFAEntry | undefined;
    create(user: User): {
        key: string;
        code: string;
    };
    remove(key: string): void;
}
export {};
//# sourceMappingURL=two-fa-store.d.ts.map