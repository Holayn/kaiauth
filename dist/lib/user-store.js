"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserStore = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const utils_1 = require("./utils");
const BCRYPT_ROUNDS = 12;
const DUMMY_HASH = bcryptjs_1.default.hashSync('dummy-timing-equalization', BCRYPT_ROUNDS);
class UserStore {
    constructor(db) {
        this._db = db;
        db.exec('CREATE TABLE IF NOT EXISTS user (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password TEXT)');
        this._migrate();
    }
    _migrate() {
        const columns = new Set(this._db.prepare('PRAGMA table_info(user)').all().map((c) => c.name));
        if (!columns.has('email'))
            this._db.exec('ALTER TABLE user ADD COLUMN email TEXT');
        if (!columns.has('discord'))
            this._db.exec('ALTER TABLE user ADD COLUMN discord TEXT');
    }
    getByUsername(username) {
        return this._db.prepare('SELECT id, username, email, discord FROM user WHERE username = ?').get(username) ?? null;
    }
    setPassword(username, password) {
        const hash = bcryptjs_1.default.hashSync(password, BCRYPT_ROUNDS);
        this._db.prepare('UPDATE user SET password = ? WHERE username = ?').run(hash, username);
    }
    setEmail(username, email) {
        this._db.prepare('UPDATE user SET email = ? WHERE username = ?').run(email || null, username);
    }
    setDiscord(username, discordId) {
        this._db.prepare('UPDATE user SET discord = ? WHERE username = ?').run(discordId || null, username);
    }
    exists(username) {
        return !!this._db.prepare('SELECT 1 FROM user WHERE username = ?').get(username);
    }
    authenticate(username, password) {
        if (!username || !password)
            return null;
        const row = this._db.prepare('SELECT * FROM user WHERE username = ?').get(username);
        if (!row) {
            bcryptjs_1.default.compareSync(password, DUMMY_HASH);
            return null;
        }
        const storedHash = row.password;
        if (storedHash && storedHash.startsWith('$2')) {
            if (!bcryptjs_1.default.compareSync(password, storedHash))
                return null;
        }
        else {
            const sha256Hash = crypto_1.default.createHash('sha256').update(password).digest('hex');
            if (!(0, utils_1.timingSafeCompare)(sha256Hash, storedHash))
                return null;
            const newHash = bcryptjs_1.default.hashSync(password, BCRYPT_ROUNDS);
            this._db.prepare('UPDATE user SET password = ? WHERE id = ?').run(newHash, row.id);
        }
        return { id: row.id, username: row.username, email: row.email, discord: row.discord };
    }
    findAll() {
        return this._db.prepare('SELECT id, username, email, discord FROM user').all();
    }
    insert({ username, password }) {
        const hash = bcryptjs_1.default.hashSync(password, BCRYPT_ROUNDS);
        return this._db.prepare('INSERT INTO user (username, password) VALUES (@username, @password)').run({ username, password: hash }).lastInsertRowid;
    }
}
exports.UserStore = UserStore;
//# sourceMappingURL=user-store.js.map