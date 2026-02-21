# kaiauth

Drop-in Express router for username/password authentication with two-factor authentication (2FA), rate limiting, and SQLite-backed sessions.

kaiauth creates and owns its own SQLite database — it manages user accounts, 2FA bypass tokens, and sessions.

## Features

- **Login with 2FA** — credential check → 2FA code challenge → session creation
- **2FA bypass tokens** — remember trusted devices so users skip 2FA on repeat logins
- **Rate limiting** — in-memory per-user lockout after configurable failed attempts
- **Timing-safe** — random delay on failure and constant-time code comparison
- **Own SQLite database** — manages `user` and `twofa_bypass_token` tables internally
- **SQLite sessions** — uses `connect-sqlite3` for persistent session storage
- **Bcrypt passwords** — with automatic migration from legacy SHA-256 hashes

## Quick Start

```js
const express = require('express');
const { createAuthRouter } = require('kaiauth');

const app = express();
app.use(express.json());
app.use(require('cookie-parser')());

const { router, requireAuth, userStore } = createAuthRouter({
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

| Option               | Type                       | Required | Description                                                                                                  |
| -------------------- | -------------------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| `sessionSecret`      | `string`                   | Yes      | Secret for signing the session cookie.                                                                       |
| `buildCookieOptions` | `(extra?) => object`       | Yes      | Builds cookie options for all auth cookies (session, 2FA key, bypass token).                                 |
| `notify`             | `(message, user?) => void` | Yes      | Notification callback for auth events. When a 2FA code is issued, called as `notify(code, user.notifyUser)` where `user` is the object from `UserStore.authenticate()`. |
| `dbPath`             | `string`                   | No       | Path to the auth SQLite database (default `'./auth.db'`).                                                    |
| `sessionDbPath`      | `string`                   | No       | Path to the session SQLite database (default `'./sessions.db'`).                                             |

#### Return Value

| Property           | Type               | Description                                                                  |
| ------------------ | ------------------ | ---------------------------------------------------------------------------- |
| `router`           | `express.Router`   | Mount with `app.use(router)`.                                                |
| `requireAuth`      | `Function`         | Middleware that rejects unauthenticated requests with 401.                   |
| `loginService`     | `LoginService`     | The underlying login service instance.                                       |
| `sessionStore`     | `object`           | The `connect-sqlite3` session store.                                         |
| `bypassTokenStore` | `BypassTokenStore` | Direct access to bypass token persistence.                                   |
| `userStore`        | `UserStore`        | Direct access to user persistence (insert, authenticate, etc.). |
| `db`               | `Database`         | The raw `better-sqlite3` database instance.                                  |

### Routes

All routes are mounted under `/auth`:

| Method | Path                            | Auth | Body                     | Description                                                                  |
| ------ | ------------------------------- | ---- | ------------------------ | ---------------------------------------------------------------------------- |
| POST   | `/auth`                         | No   | `{ username, password }` | Login — validates credentials, returns `{ twoFA: true }` if 2FA is required. |
| POST   | `/auth/2fa`                     | No   | `{ twoFACode }`          | Verify 2FA code and create session.                                          |
| POST   | `/auth/logout`                  | Yes  | —                        | Destroy the session.                                                         |
| GET    | `/auth/verify`                  | Yes  | —                        | Verify & refresh an existing session.                                        |
| POST   | `/auth/invalidate-all-sessions` | Yes  | —                        | Wipe all sessions and bypass tokens.                                         |
| POST   | `/auth/revoke-2fa-bypass`       | Yes  | `{ username? }`          | Revoke 2FA bypass tokens (for one user or all).                              |

### `UserStore`

Manages the `user` table in the auth database.

`UserStore` is available in two ways:

1. **From `createAuthRouter` return value** — `const { userStore } = createAuthRouter({ ... })`
2. **Standalone** — useful in CLI tools or scripts that need to manage users without starting the full auth router:

```js
const Database = require('better-sqlite3');
const { UserStore } = require('kaiauth');

const db = new Database('./auth.db');
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
