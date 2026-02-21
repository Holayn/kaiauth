const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { timingSafeCompare } = require('./utils');

const BCRYPT_ROUNDS = 12;
const DUMMY_HASH = bcrypt.hashSync('dummy-timing-equalization', BCRYPT_ROUNDS);

/**
 * SQLite-backed user store for authentication.
 *
 * Manages a `user` table with columns: id, username, password.
 * Handles credential validation, bcrypt hashing, and automatic migration
 * from legacy SHA-256 hashes.
 *
 * Expects a `better-sqlite3` Database instance.
 */
class UserStore {
  constructor(db) {
    this._db = db;
    db.exec(
      'CREATE TABLE IF NOT EXISTS user (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password TEXT)'
    );
  }

  /** Look up a user by username (without password). */
  getByUsername(username) {
    return this._db.prepare(
      'SELECT id, username FROM user WHERE username = ?'
    ).get(username) ?? null;
  }

  /** Return true if the username exists. */
  exists(username) {
    return !!this._db.prepare(
      'SELECT 1 FROM user WHERE username = ?'
    ).get(username);
  }

  /**
   * Validate credentials.  Returns the user object (without password) on
   * success, or null on failure.  Automatically migrates legacy SHA-256
   * hashes to bcrypt.
   */
  authenticate(username, password) {
    if (!username || !password) return null;

    const row = this._db.prepare(
      'SELECT * FROM user WHERE username = ?'
    ).get(username);

    if (!row) {
      // Perform dummy comparison to equalize timing with valid-user path
      bcrypt.compareSync(password, DUMMY_HASH);
      return null;
    }

    const storedHash = row.password;

    if (storedHash && storedHash.startsWith('$2')) {
      if (!bcrypt.compareSync(password, storedHash)) return null;
    } else {
      // Legacy unsalted SHA-256 — compare, then auto-migrate to bcrypt
      const sha256Hash = crypto.createHash('sha256').update(password).digest('hex');
      if (!timingSafeCompare(sha256Hash, storedHash)) return null;

      const newHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
      this._db.prepare('UPDATE user SET password = ? WHERE id = ?').run(newHash, row.id);
    }

    // Return user without the password hash
    return { id: row.id, username: row.username };
  }

  /** List all users (without passwords). */
  findAll() {
    return this._db.prepare('SELECT id, username FROM user').all()
      .map((r) => ({ id: r.id, username: r.username }));
  }

  /** Insert a new user. */
  insert({ username, password }) {
    const hash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
    return this._db.prepare(
      'INSERT INTO user (username, password) VALUES (@username, @password)'
    ).run({ username, password: hash }).lastInsertRowid;
  }

  /**
   * Insert a new user or overwrite the existing one.
   * @param {{ username: string, password: string }} user
   * @returns {number} The row id of the inserted/updated user.
   */
  upsert({ username, password }) {
    const hash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
    return this._db.prepare(
      `INSERT INTO user (username, password) VALUES (@username, @password)
       ON CONFLICT(username) DO UPDATE SET password = @password`
    ).run({ username, password: hash }).lastInsertRowid;
  }
}

module.exports = UserStore;
