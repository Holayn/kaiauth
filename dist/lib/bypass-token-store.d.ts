import type { Database } from 'better-sqlite3';
export interface BypassTokenEntry {
    id: number;
    token: string;
    username: string;
    expires_at: number;
}
export interface NewBypassToken {
    token: string;
    username: string;
    expiresAt: number;
}
export declare class BypassTokenStore {
    private _db;
    constructor(db: Database);
    insert({ token, username, expiresAt }: NewBypassToken): bigint | number;
    getByToken(token: string): BypassTokenEntry | undefined;
    deleteByUsername(username: string): void;
    deleteExpired(): void;
    deleteAll(): void;
}
//# sourceMappingURL=bypass-token-store.d.ts.map