import type { Database } from 'better-sqlite3';
export interface User {
    id: number;
    username: string;
    email: string | null;
    discord: string | null;
}
interface UserInput {
    username: string;
    password: string;
}
export declare class UserStore {
    private _db;
    constructor(db: Database);
    private _migrate;
    getByUsername(username: string): User | null;
    setPassword(username: string, password: string): void;
    setEmail(username: string, email: string | null): void;
    setDiscord(username: string, discordId: string | null): void;
    exists(username: string): boolean;
    authenticate(username: string, password: string): User | null;
    findAll(): User[];
    insert({ username, password }: UserInput): bigint | number;
}
export {};
//# sourceMappingURL=user-store.d.ts.map