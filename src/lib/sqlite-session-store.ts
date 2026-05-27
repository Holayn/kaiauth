import type Database from 'better-sqlite3';
import type { SessionData, Store } from 'express-session';
import session from 'express-session';

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    sess TEXT NOT NULL,
    expire INTEGER NOT NULL
  )
`;
const CREATE_INDEX = `CREATE INDEX IF NOT EXISTS sessions_expire ON sessions (expire)`;

const PRUNE_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes, same as connect-sqlite3 default

export class SQLiteSessionStore extends (session.Store as unknown as new () => Store) {
  private readonly db: InstanceType<typeof Database>;

  constructor(db: InstanceType<typeof Database>) {
    super();
    this.db = db;
    db.exec(CREATE_TABLE);
    db.exec(CREATE_INDEX);

    const pruneInterval = setInterval(() => this.prune(), PRUNE_INTERVAL_MS);
    pruneInterval.unref();
  }

  get(sid: string, cb: (err: unknown, session?: SessionData | null) => void): void {
    try {
      const row = this.db
        .prepare('SELECT sess FROM sessions WHERE sid = ? AND expire > ?')
        .get(sid, Date.now()) as { sess: string } | undefined;
      cb(null, row ? JSON.parse(row.sess) : null);
    } catch (err) {
      cb(err);
    }
  }

  set(sid: string, session: SessionData, cb?: (err?: unknown) => void): void {
    try {
      const expire = session.cookie.expires
        ? session.cookie.expires.getTime()
        : Date.now() + 86400000;
      this.db
        .prepare('INSERT OR REPLACE INTO sessions (sid, sess, expire) VALUES (?, ?, ?)')
        .run(sid, JSON.stringify(session), expire);
      cb?.();
    } catch (err) {
      cb?.(err);
    }
  }

  destroy(sid: string, cb?: (err?: unknown) => void): void {
    try {
      this.db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      cb?.();
    } catch (err) {
      cb?.(err);
    }
  }

  touch(sid: string, session: SessionData, cb?: (err?: unknown) => void): void {
    try {
      const expire = session.cookie.expires
        ? session.cookie.expires.getTime()
        : Date.now() + 86400000;
      this.db.prepare('UPDATE sessions SET expire = ? WHERE sid = ?').run(expire, sid);
      cb?.();
    } catch (err) {
      cb?.(err);
    }
  }

  all(cb: (err: unknown, sessions?: Record<string, SessionData>) => void): void {
    try {
      const rows = this.db
        .prepare('SELECT sid, sess FROM sessions WHERE expire > ?')
        .all(Date.now()) as { sid: string; sess: string }[];
      const sessions: Record<string, SessionData> = {};
      for (const row of rows) {
        sessions[row.sid] = JSON.parse(row.sess);
      }
      cb(null, sessions);
    } catch (err) {
      cb(err);
    }
  }

  length(cb: (err: unknown, length?: number) => void): void {
    try {
      const row = this.db
        .prepare('SELECT COUNT(*) AS count FROM sessions WHERE expire > ?')
        .get(Date.now()) as { count: number };
      cb(null, row.count);
    } catch (err) {
      cb(err);
    }
  }

  clear(cb?: (err?: unknown) => void): void {
    try {
      this.db.prepare('DELETE FROM sessions').run();
      cb?.();
    } catch (err) {
      cb?.(err);
    }
  }

  prune(): void {
    this.db.prepare('DELETE FROM sessions WHERE expire <= ?').run(Date.now());
  }

  deleteAll(): void {
    this.db.prepare('DELETE FROM sessions').run();
  }
}
