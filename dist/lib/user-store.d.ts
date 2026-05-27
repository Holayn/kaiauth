import type { Database } from 'better-sqlite3';
export interface User {
    id: number;
    username: string;
}
interface UserInput {
    username: string;
    password: string;
}
export declare class UserStore {
    private _db;
    constructor(db: Database);
    getByUsername(username: string): User | null;
    exists(username: string): boolean;
    authenticate(username: string, password: string): User | null;
    findAll(): User[];
    insert({ username, password }: UserInput): bigint | number;
    upsert({ username, password }: UserInput): bigint | number;
}
export {};
//# sourceMappingURL=user-store.d.ts.map