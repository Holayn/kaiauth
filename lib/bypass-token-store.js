/**
 * SQLite-backed store for 2FA bypass tokens.
 *
 * Expects a `better-sqlite3` Database instance.  The table is created
 * automatically if it doesn't already exist.
 */
class BypassTokenStore {
  constructor(db) {
    this._db = db;
    db.exec(
      'CREATE TABLE IF NOT EXISTS twofa_bypass_token (id INTEGER PRIMARY KEY, token TEXT UNIQUE, username TEXT, expires_at INTEGER)'
    );
  }

  insert({ token, username, expiresAt }) {
    return this._db.prepare(
      'INSERT INTO twofa_bypass_token (token, username, expires_at) VALUES (@token, @username, @expiresAt)'
    ).run({ token, username, expiresAt }).lastInsertRowid;
  }

  getByToken(token) {
    return this._db.prepare(
      'SELECT * FROM twofa_bypass_token WHERE token = ? AND expires_at > ?'
    ).get(token, Date.now());
  }

  deleteByUsername(username) {
    this._db.prepare('DELETE FROM twofa_bypass_token WHERE username = ?').run(username);
  }

  deleteExpired() {
    this._db.prepare('DELETE FROM twofa_bypass_token WHERE expires_at <= ?').run(Date.now());
  }

  deleteAll() {
    this._db.prepare('DELETE FROM twofa_bypass_token').run();
  }
}

module.exports = BypassTokenStore;
