const crypto = require('crypto');

const CODE_LENGTH = 6;
const CODE_TTL_MS = 60 * 1000; // 1 minute

/**
 * In-memory store for pending two-factor authentication codes.
 * Each entry is keyed by a random hex token and maps to { username, code }.
 */
class TwoFAStore {
  constructor({ codeTtlMs = CODE_TTL_MS, codeLength = CODE_LENGTH } = {}) {
    this._entries = {};
    this._codeTtlMs = codeTtlMs;
    this._codeLength = codeLength;
  }

  /** Check whether a key exists and is still valid. */
  has(key) {
    return !!this._entries[key];
  }

  /** Get the entry for a key, or undefined. */
  get(key) {
    return this._entries[key];
  }

  /**
   * Create a new 2FA challenge for the given username.
   * Any previous challenges for the same username are removed.
   *
   * @param {string} username
   * @returns {{ key: string, code: string }} the generated key and code
   */
  create(username) {
    // Remove any existing entries for this user.
    for (const [key, entry] of Object.entries(this._entries)) {
      if (entry.username === username) {
        delete this._entries[key];
      }
    }

    const key = crypto.randomBytes(32).toString('hex');
    const code = Array.from({ length: this._codeLength }, () =>
      crypto.randomInt(36).toString(36)
    )
      .join('')
      .toUpperCase();

    this._entries[key] = { username, code };

    setTimeout(() => {
      delete this._entries[key];
    }, this._codeTtlMs);

    return { key, code };
  }

  /** Remove an entry by key. */
  remove(key) {
    delete this._entries[key];
  }
}

module.exports = TwoFAStore;
