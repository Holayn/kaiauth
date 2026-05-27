import type Database from 'better-sqlite3';
import type { SessionData, Store } from 'express-session';
declare const SQLiteSessionStore_base: new () => Store;
export declare class SQLiteSessionStore extends SQLiteSessionStore_base {
    private readonly db;
    constructor(db: InstanceType<typeof Database>);
    get(sid: string, cb: (err: unknown, session?: SessionData | null) => void): void;
    set(sid: string, session: SessionData, cb?: (err?: unknown) => void): void;
    destroy(sid: string, cb?: (err?: unknown) => void): void;
    touch(sid: string, session: SessionData, cb?: (err?: unknown) => void): void;
    all(cb: (err: unknown, sessions?: Record<string, SessionData>) => void): void;
    length(cb: (err: unknown, length?: number) => void): void;
    clear(cb?: (err?: unknown) => void): void;
    prune(): void;
    deleteAll(): void;
}
export {};
//# sourceMappingURL=sqlite-session-store.d.ts.map