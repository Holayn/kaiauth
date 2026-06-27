# kaiauth

Drop-in Express router for username/password authentication with optional two-factor authentication (2FA), rate limiting, and SQLite-backed sessions.

kaiauth creates and owns its own SQLite database — it manages user accounts, sessions, and (when 2FA is enabled) bypass tokens.

## Features

- **Flexible login flow** — credential check → optional 2FA code challenge → session creation
- **Optional 2FA** — disable with `enable2fa: false` for a simple username/password flow
- **2FA bypass tokens** — remember trusted devices so users skip 2FA on repeat logins (when 2FA is enabled)
- **Rate limiting** — in-memory per-user lockout after configurable failed attempts, with a bounded LRU cache for unrecognized usernames to prevent username enumeration
- **Timing-safe** — random delay on failure and constant-time code comparison
- **Own SQLite database** — manages `user` and (when 2FA is enabled) `twofa_bypass_token` tables internally
- **SQLite sessions** — persistent session storage backed by SQLite
- **Bcrypt passwords** — with automatic migration from legacy SHA-256 hashes

## Quick Start

```js
const express = require('express');
const path = require('path');
const { createAuthRouter } = require('kaiauth');

const app = express();
app.use(express.json());
app.use(require('cookie-parser')());

const { router, requireAuth, userStore } = createAuthRouter({
  authDataDir: path.join(__dirname, 'data'),
  sessionSecret: 'your-secret',
  buildCookieOptions: (extra) => ({
    httpOnly: true,
    sameSite: 'strict',
    secure: true,
    ...extra,
  }),
  notify: (message, user) => {
    // Deliver 2FA codes and log auth events.
    // When `user` is set, deliver the code (message) to that user.
    console.log(`[${user || 'auth'}] ${message}`);
  },
});

app.use(router);

// Protected routes
app.get('/api/data', requireAuth, (req, res) => {
  res.json({ user: req.session.user });
});
```

## API

### `createAuthRouter(opts)`

Returns `{ router, requireAuth, loginService, sessionStore, bypassTokenStore, userStore, db }`.

#### Options

| Option               | Type                       | Required | Default | Description                                                                                                                                    |
| -------------------- | -------------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `authDataDir`        | `string`                   | Yes      | —       | Absolute path to a directory where kaiauth stores its SQLite databases (`auth.db` and `sessions.db`). The directory is created if it does not exist. Must be an absolute path. |
| `sessionSecret`      | `string`                   | Yes      | —       | Secret for signing the session cookie.                                                                                                         |
| `buildCookieOptions` | `(extra?) => object`       | Yes      | —       | Builds cookie options for auth cookies (session, and when 2FA is enabled, the 2FA key and bypass token cookies).                               |
| `notify`             | `(message, user?) => void` | Yes      | —       | Notification callback for auth events. When a 2FA code is issued, called as `notify(code, username)` so the code can be delivered to the user. |
| `enable2fa`          | `boolean`                  | No       | `true`  | When `false`, skips the 2FA challenge entirely — successful credentials create a session immediately. The `/auth/2fa` and `/auth/revoke-2fa-bypass` routes are not registered and `bypassTokenStore` is not returned. |
| `loginInvalidUsersCacheSize` | `number`           | No       | `5000`  | Maximum number of unrecognized usernames tracked for rate limiting. Failed attempts from invalid usernames accumulate in a bounded LRU cache (evicting oldest entries when full) so they receive the same lockout behavior as valid users, preventing username enumeration. Increase for deployments under active enumeration attacks; decrease to reduce memory on constrained systems. The default (5000) takes just under 1MB of memory. |

#### Return Value

| Property           | Type               | Description                                                                                          |
| ------------------ | ------------------ | ---------------------------------------------------------------------------------------------------- |
| `router`           | `express.Router`   | Mount with `app.use(router)`.                                                                        |
| `requireAuth`      | `Function`         | Middleware that rejects unauthenticated requests with 401.                                           |
| `loginService`     | `LoginService`     | The underlying login service instance.                                                               |
| `sessionStore`     | `object`           | The SQLite-backed session store.                                                                     |
| `bypassTokenStore` | `BypassTokenStore` | Direct access to bypass token persistence. Only present when `enable2fa` is `true` (the default).   |
| `userStore`        | `UserStore`        | Direct access to user persistence (insert, authenticate, etc.).                                      |
| `db`               | `Database`         | The raw `better-sqlite3` database instance.                                                          |

### Routes

All routes are mounted under `/auth`:

| Method | Path                            | Auth | 2FA only | Body                     | Description                                                                                                    |
| ------ | ------------------------------- | ---- | -------- | ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| POST   | `/auth`                         | No   |          | `{ username, password }` | Login — validates credentials. With 2FA enabled, returns `{ twoFA: true }` if a code challenge is required; otherwise creates a session directly. |
| POST   | `/auth/2fa`                     | No   | Yes      | `{ twoFACode }`          | Verify 2FA code and create session.                                                                            |
| POST   | `/auth/logout`                  | Yes  |          | —                        | Destroy the session.                                                                                           |
| GET    | `/auth/verify`                  | Yes  |          | —                        | Verify & refresh an existing session.                                                                          |
| POST   | `/auth/invalidate-all-sessions` | Yes  |          | —                        | Wipe all sessions and, when 2FA is enabled, all bypass tokens.                                                 |
| POST   | `/auth/revoke-2fa-bypass`       | Yes  | Yes      | `{ username? }`          | Revoke 2FA bypass tokens (for one user or all).                                                                |

### `UserStore`

Manages the `user` table in the auth database.

`UserStore` is available in two ways:

1. **From `createAuthRouter` return value** — `const { userStore } = createAuthRouter({ ... })`
2. **Standalone** — useful in CLI tools or scripts that need to manage users without starting the full auth router:

```js
const path = require('path');
const Database = require('better-sqlite3');
const { UserStore } = require('kaiauth');

const db = new Database(path.join(__dirname, 'data', 'auth.db'));
const userStore = new UserStore(db);
userStore.upsert({ username: 'alice', password: 'secret' });
db.close();
```

| Method                            | Description                                                          |
| --------------------------------- | -------------------------------------------------------------------- |
| `insert({ username, password })`  | Create a new user (password is bcrypt-hashed automatically).         |
| `upsert({ username, password })`  | Insert or overwrite a user (password is bcrypt-hashed automatically).|
| `authenticate(username, password)`| Validate credentials. Returns `{ id, username }` or `null`.         |
| `setPassword(username, password)` | Update a user's password (bcrypt-hashed automatically).              |
| `exists(username)`                | Returns `true` if the username exists.                               |
| `getByUsername(username)`         | Look up user by username (without password).                         |
| `findAll()`                       | List all users (without passwords).                                  |

### CLI

kaiauth ships a `kaiauth` CLI for managing users directly against the auth database, without writing a script.

```sh
npx kaiauth <command> --db <path-to-auth.db>
```

| Command                                  | Description           |
| ---------------------------------------- | --------------------- |
| `add-user <username> <password> --db`    | Add a new user.       |
| `list-users --db`                        | List all users.       |

`add-user` updates the password if the username already exists.

**Example**

```sh
npx kaiauth add-user alice hunter2 --db ./data/auth.db
npx kaiauth list-users --db ./data/auth.db
```

### `BypassTokenStore`

Manages the `twofa_bypass_token` table. Available on the return value as `bypassTokenStore`.

| Method                                   | Description                          |
| ---------------------------------------- | ------------------------------------ |
| `insert({ token, username, expiresAt })` | Persist a bypass token.              |
| `getByToken(token)`                      | Look up an unexpired bypass token.   |
| `deleteByUsername(username)`             | Delete all bypass tokens for a user. |
| `deleteExpired()`                        | Delete all expired tokens.           |
| `deleteAll()`                            | Delete all bypass tokens.            |

## Exports

| Export             | Description                                                                 |
| ------------------ | --------------------------------------------------------------------------- |
| `createAuthRouter` | Factory that returns a fully-configured Express auth router (see above).    |
| `UserStore`        | SQLite-backed user store class, usable standalone for CLI/script scenarios. |

## Internals (not exported)

These modules are used internally by `createAuthRouter` and are not re-exported from the package entry point:

| Module                | Description                                           |
| --------------------- | ----------------------------------------------------- |
| `LoginService`        | Framework-agnostic login + 2FA service class.         |
| `createLoginHandlers` | Factory for Express route handlers.                   |
| `RateLimiter`         | Generic in-memory rate limiter with lockout.          |
| `TwoFAStore`          | In-memory 2FA code store with auto-expiry.            |
| `regenerateSession`   | Promise wrapper for `req.session.regenerate()`.       |
| `destroySession`      | Promise wrapper for session destruction.              |

## License

MIT
