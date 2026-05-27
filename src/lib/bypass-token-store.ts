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

export class BypassTokenStore {
  private _db: Database;

  constructor(db: Database) {
    this._db = db;
    db.exec(
      'CREATE TABLE IF NOT EXISTS twofa_bypass_token (id INTEGER PRIMARY KEY, token TEXT UNIQUE, username TEXT, expires_at INTEGER)'
    );
  }

  insert({ token, username, expiresAt }: NewBypassToken): bigint | number {
    return this._db.prepare(
      'INSERT INTO twofa_bypass_token (token, username, expires_at) VALUES (@token, @username, @expiresAt)'
    ).run({ token, username, expiresAt }).lastInsertRowid;
  }

  getByToken(token: string): BypassTokenEntry | undefined {
    return this._db.prepare(
      'SELECT * FROM twofa_bypass_token WHERE token = ? AND expires_at > ?'
    ).get(token, Date.now()) as BypassTokenEntry | undefined;
  }

  deleteByUsername(username: string): void {
    this._db.prepare('DELETE FROM twofa_bypass_token WHERE username = ?').run(username);
  }

  deleteExpired(): void {
    this._db.prepare('DELETE FROM twofa_bypass_token WHERE expires_at <= ?').run(Date.now());
  }

  deleteAll(): void {
    this._db.prepare('DELETE FROM twofa_bypass_token').run();
  }
}
