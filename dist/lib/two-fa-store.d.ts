export interface TwoFAEntry {
    username: string;
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
    create(username: string): {
        key: string;
        code: string;
    };
    remove(key: string): void;
}
export {};
//# sourceMappingURL=two-fa-store.d.ts.map