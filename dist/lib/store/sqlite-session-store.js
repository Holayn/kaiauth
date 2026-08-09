"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQLiteSessionStore = void 0;
const express_session_1 = __importDefault(require("express-session"));
const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    sess TEXT NOT NULL,
    expire INTEGER NOT NULL
  )
`;
const CREATE_INDEX = `CREATE INDEX IF NOT EXISTS sessions_expire ON sessions (expire)`;
const PRUNE_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes, same as connect-sqlite3 default
class SQLiteSessionStore extends express_session_1.default.Store {
    constructor(db) {
        super();
        this.db = db;
        db.exec(CREATE_TABLE);
        db.exec(CREATE_INDEX);
        const pruneInterval = setInterval(() => this.prune(), PRUNE_INTERVAL_MS);
        pruneInterval.unref();
    }
    get(sid, cb) {
        try {
            const row = this.db
                .prepare('SELECT sess FROM sessions WHERE sid = ? AND expire > ?')
                .get(sid, Date.now());
            cb(null, row ? JSON.parse(row.sess) : null);
        }
        catch (err) {
            cb(err);
        }
    }
    set(sid, session, cb) {
        try {
            const expire = session.cookie.expires
                ? session.cookie.expires.getTime()
                : Date.now() + 86400000;
            this.db
                .prepare('INSERT OR REPLACE INTO sessions (sid, sess, expire) VALUES (?, ?, ?)')
                .run(sid, JSON.stringify(session), expire);
            cb?.();
        }
        catch (err) {
            cb?.(err);
        }
    }
    destroy(sid, cb) {
        try {
            this.db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
            cb?.();
        }
        catch (err) {
            cb?.(err);
        }
    }
    touch(sid, session, cb) {
        try {
            const expire = session.cookie.expires
                ? session.cookie.expires.getTime()
                : Date.now() + 86400000;
            this.db.prepare('UPDATE sessions SET expire = ? WHERE sid = ?').run(expire, sid);
            cb?.();
        }
        catch (err) {
            cb?.(err);
        }
    }
    all(cb) {
        try {
            const rows = this.db
                .prepare('SELECT sid, sess FROM sessions WHERE expire > ?')
                .all(Date.now());
            const sessions = {};
            for (const row of rows) {
                sessions[row.sid] = JSON.parse(row.sess);
            }
            cb(null, sessions);
        }
        catch (err) {
            cb(err);
        }
    }
    length(cb) {
        try {
            const row = this.db
                .prepare('SELECT COUNT(*) AS count FROM sessions WHERE expire > ?')
                .get(Date.now());
            cb(null, row.count);
        }
        catch (err) {
            cb(err);
        }
    }
    clear(cb) {
        try {
            this.db.prepare('DELETE FROM sessions').run();
            cb?.();
        }
        catch (err) {
            cb?.(err);
        }
    }
    prune() {
        this.db.prepare('DELETE FROM sessions WHERE expire <= ?').run(Date.now());
    }
    deleteAll() {
        this.db.prepare('DELETE FROM sessions').run();
    }
}
exports.SQLiteSessionStore = SQLiteSessionStore;
//# sourceMappingURL=sqlite-session-store.js.map