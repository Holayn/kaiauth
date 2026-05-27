import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type { Database } from 'better-sqlite3';
import { timingSafeCompare } from './utils';

const BCRYPT_ROUNDS = 12;
const DUMMY_HASH = bcrypt.hashSync('dummy-timing-equalization', BCRYPT_ROUNDS);

export interface User {
  id: number;
  username: string;
}

interface UserRow extends User {
  password: string;
}

interface UserInput {
  username: string;
  password: string;
}

export class UserStore {
  private _db: Database;

  constructor(db: Database) {
    this._db = db;
    db.exec(
      'CREATE TABLE IF NOT EXISTS user (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password TEXT)'
    );
  }

  getByUsername(username: string): User | null {
    return (this._db.prepare('SELECT id, username FROM user WHERE username = ?').get(username) as User | undefined) ?? null;
  }

  exists(username: string): boolean {
    return !!this._db.prepare('SELECT 1 FROM user WHERE username = ?').get(username);
  }

  authenticate(username: string, password: string): User | null {
    if (!username || !password) return null;

    const row = this._db.prepare('SELECT * FROM user WHERE username = ?').get(username) as UserRow | undefined;

    if (!row) {
      bcrypt.compareSync(password, DUMMY_HASH);
      return null;
    }

    const storedHash = row.password;

    if (storedHash && storedHash.startsWith('$2')) {
      if (!bcrypt.compareSync(password, storedHash)) return null;
    } else {
      const sha256Hash = crypto.createHash('sha256').update(password).digest('hex');
      if (!timingSafeCompare(sha256Hash, storedHash)) return null;

      const newHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
      this._db.prepare('UPDATE user SET password = ? WHERE id = ?').run(newHash, row.id);
    }

    return { id: row.id, username: row.username };
  }

  findAll(): User[] {
    return this._db.prepare('SELECT id, username FROM user').all() as User[];
  }

  insert({ username, password }: UserInput): bigint | number {
    const hash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
    return this._db.prepare(
      'INSERT INTO user (username, password) VALUES (@username, @password)'
    ).run({ username, password: hash }).lastInsertRowid;
  }

  upsert({ username, password }: UserInput): bigint | number {
    const hash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
    return this._db.prepare(
      `INSERT INTO user (username, password) VALUES (@username, @password)
       ON CONFLICT(username) DO UPDATE SET password = @password`
    ).run({ username, password: hash }).lastInsertRowid;
  }
}
