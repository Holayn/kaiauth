# kaiauth

Drop-in Express router for username/password authentication with optional two-factor authentication (2FA), rate limiting, and SQLite-backed sessions.

kaiauth creates and owns its own SQLite database — it manages user accounts, sessions, and (when 2FA is enabled) bypass tokens.

## Features

- **Flexible login flow** — credential check → optional 2FA code challenge → session creation
- **Optional 2FA** — disable with `enable2fa: false` for a simple username/password flow
- **Built-in 2FA delivery** — email (via [Resend](https://resend.com)) and Discord DM (via `discord.js`), with a `development` mode that logs codes to the console instead of sending them
- **2FA bypass tokens** — remember trusted devices so users skip 2FA on repeat logins (when 2FA is enabled)
- **Rate limiting** — in-memory per-user lockout after configurable failed attempts, with a bounded LRU cache for unrecognized usernames to prevent username enumeration
- **Timing-safe** — random delay on failure and constant-time code comparison
- **Own SQLite database** — manages `user` and (when 2FA is enabled) `twofa_bypass_token` tables internally
- **SQLite sessions** — persistent session storage backed by SQLite
- **Bcrypt passwords** — with automatic migration from legacy SHA-256 hashes
- **Optional login page** — a dependency-free, framework-free HTML/JS login (and 2FA) page served at `/login`, disabled by default. No inline `<script>` — works under a CSP that disallows `'unsafe-inline'`

## Quick Start

```js
const express = require('express');
const path = require('path');
const { createAuthRouter } = require('kaiauth');

const app = express();
app.use(express.json());
app.use(require('cookie-parser')());

const { apiRouter, pageRouter, requireAuth, userStore } = createAuthRouter({
  authDataDir: path.join(__dirname, 'data'),
  sessionSecret: 'your-secret',
  buildCookieOptions: (extra) => ({
    httpOnly: true,
    sameSite: 'strict',
    secure: true,
    ...extra,
  }),
  notify: (message) => {
    // Audit log for auth events (logins, lockouts, 2FA delivery failures, etc).
    console.log(message);
  },
  // At least one of `email` / `discord` is required when 2FA is enabled,
  // unless `development` is set — see the Options table below.
  email: {
    apiKey: process.env.RESEND_API_KEY,
    from: 'no-reply@yourapp.com',
  },
  discord: {
    botToken: process.env.DISCORD_BOT_TOKEN,
  },
  development: process.env.NODE_ENV !== 'production',
  serveLoginPage: true,
});

app.use(apiRouter);   // session middleware + all /auth* endpoints
app.use(pageRouter);  // GET /login, GET /login.js (only present when serveLoginPage: true)

// Protected routes
app.get('/api/data', requireAuth, (req, res) => {
  res.json({ user: req.session.user });
});
```

`apiRouter` and `pageRouter` are separate so you can mount them at different paths (e.g. API behind `/api`, login page at the app root) — see [Mounting `apiRouter` and `pageRouter` separately](#mounting-apirouter-and-pagerouter-separately).

## 2FA Code Delivery

When a user has a `discord` ID on file, their code is delivered **only** via Discord DM by default. Otherwise, if they have an `email` on file and `email` is configured, the code is delivered via email. **If neither applies — the user has no email/Discord ID on file, or the matching channel isn't configured — delivery fails and `POST /auth` responds `500`.** There is no silent fallback to `notify`; `notify` is audit-log-only.

A user who defaulted to Discord delivery can request the same pending code be re-sent via email instead by calling `POST /auth/2fa/resend-email` (no body — it uses the existing `twoFAKey` cookie). The login page's 2FA form shows a "Send code via email instead" link automatically when this is available (i.e. the user has an email on file and `email` is configured).

If code delivery fails outright (no channel available for the user, or the configured channel throws — e.g. Discord API error, Resend API error), `POST /auth` responds `500` rather than silently reporting success with an undelivered code. This means every user who might log in needs an `email` or `discord` value on file — set via `UserStore.setEmail`/`setDiscord` or the CLI's `update-user` command — once `enable2fa` is on and `development` is off.

Set `development: true` to skip real delivery entirely — codes are logged to the console instead. This is also what allows `enable2fa: true` without configuring `email`/`discord`; **`createAuthRouter` throws at construction time if `enable2fa` is true and neither is configured and `development` is not set**, so a delivery misconfiguration is caught immediately rather than surfacing as a `500` for the first real user who logs in.

## API

### `createAuthRouter(opts)`

Returns `{ apiRouter, pageRouter, requireAuth, loginService, sessionStore, bypassTokenStore, userStore, db }`.

#### Options

| Option                       | Type                                       | Required | Default                                 | Description                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------- | ------------------------------------------ | -------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `authDataDir`                | `string`                                   | Yes      | —                                       | Absolute path to a directory where kaiauth stores its SQLite databases (`auth.db` and `sessions.db`). The directory is created if it does not exist. Must be an absolute path.                                                                                                                                                                                                                                                              |
| `sessionSecret`              | `string`                                   | Yes      | —                                       | Secret for signing the session cookie.                                                                                                                                                                                                                                                                                                                                                                                                      |
| `buildCookieOptions`         | `(extra?) => object`                       | Yes      | —                                       | Builds cookie options for auth cookies (session, and when 2FA is enabled, the 2FA key and bypass token cookies).                                                                                                                                                                                                                                                                                                                            |
| `notify`                     | `(message: string) => void`                | Yes      | —                                       | Audit-log callback for auth events (logins, lockouts, 2FA delivery failures). Not used for 2FA code delivery — see [2FA Code Delivery](#2fa-code-delivery).                                                                                                                                                                                                                                                                                 |
| `enable2fa`                  | `boolean`                                  | No       | `true`                                  | When `false`, skips the 2FA challenge entirely — successful credentials create a session immediately. The `/auth/2fa`, `/auth/2fa/resend-email`, and `/auth/revoke-2fa-bypass` routes are not registered and `bypassTokenStore` is not returned.                                                                                                                                                                                            |
| `development`                | `boolean`                                  | No       | `false`                                 | Skips real 2FA delivery — codes are logged to the console instead. Also the only way to enable `enable2fa: true` without configuring `email`/`discord`.                                                                                                                                                                                                                                                                                     |
| `email`                      | `{ apiKey, from, subject?, buildBody? }`   | No       | —                                       | Configures 2FA delivery via [Resend](https://resend.com). `buildBody?: (code) => string` customizes the email body.                                                                                                                                                                                                                                                                                                                         |
| `discord`                    | `{ botToken: string }`                     | No       | —                                       | Configures 2FA delivery via Discord DM. The bot logs in once at `createAuthRouter` construction time and must share a guild with each target user (or the user must allow DMs from server members).                                                                                                                                                                                                                                         |
| `twoFAResend`                | `{ maxAttempts?, lockoutMs? }`             | No       | `{ maxAttempts: 3, lockoutMs: 300000 }` | Rate limiting for `POST /auth/2fa/resend-email`, independent of the code-verification rate limiter.                                                                                                                                                                                                                                                                                                                                         |
| `loginInvalidUsersCacheSize` | `number`                                   | No       | `5000`                                  | Maximum number of unrecognized usernames tracked for rate limiting. Failed attempts from invalid usernames accumulate in a bounded LRU cache (evicting oldest entries when full) so they receive the same lockout behavior as valid users, preventing username enumeration. Increase for deployments under active enumeration attacks; decrease to reduce memory on constrained systems. The default (5000) takes just under 1MB of memory. |
| `serveLoginPage`             | `boolean`                                  | No       | `false`                                 | When `true`, populates `pageRouter` with `GET /login` and `GET /login.js`, serving a self-contained login page (with 2FA support) that talks to the `/auth*` endpoints.                                                                                                                                                                                                                                                                     |
| `loginPageOptions`           | `{ title?: string; apiBasePath?: string }` | No       | —                                       | Options for the login page. `title` is shown in the `<title>` tag and as the page heading, defaulting to `'Sign in'`. `apiBasePath` is the base path the page's client-side JS uses for `/auth*` requests — see [Mounting `apiRouter` and `pageRouter` separately](#mounting-apirouter-and-pagerouter-separately). Only relevant when `serveLoginPage` is `true`.                                                                           |

#### Return Value

| Property           | Type               | Description                                                                                                                                                                      |
| ------------------ | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apiRouter`        | `express.Router`   | Session middleware + all `/auth*` endpoints. Mount with `app.use(apiRouter)` (or `app.use('/api', apiRouter)` etc).                                                              |
| `pageRouter`       | `express.Router?`  | `GET /login` and `GET /login.js` — static content, no session middleware. Only present when `serveLoginPage` is `true`. Can be mounted at a different path than `apiRouter`.     |
| `requireAuth`      | `Function`         | Middleware that rejects unauthenticated requests with 401. Needs session middleware to have already run on the request, so use it downstream of (or within) `apiRouter`'s mount. |
| `loginService`     | `LoginService`     | The underlying login service instance.                                                                                                                                           |
| `sessionStore`     | `object`           | The SQLite-backed session store.                                                                                                                                                 |
| `bypassTokenStore` | `BypassTokenStore` | Direct access to bypass token persistence. Only present when `enable2fa` is `true` (the default).                                                                                |
| `userStore`        | `UserStore`        | Direct access to user persistence (insert, authenticate, etc.).                                                                                                                  |
| `db`               | `Database`         | The raw `better-sqlite3` database instance.                                                                                                                                      |

#### Mounting `apiRouter` and `pageRouter` separately

The login page's client-side JS needs to know where `/auth*` lives. By default (`apiBasePath` unset) it infers this from its own URL — stripping the `/login` suffix — which only works if `pageRouter` and `apiRouter` end up reachable at the same path prefix (e.g. both mounted directly on `app` with no prefix, or both mounted under the same `app.use('/x', ...)`). If you mount them at *different* paths, set `loginPageOptions.apiBasePath` explicitly so the page knows where to send its requests:

```js
const { apiRouter, pageRouter } = createAuthRouter({
  // ...
  serveLoginPage: true,
  loginPageOptions: { apiBasePath: '/api' },
});

app.use('/api', apiRouter);  // POST /api/auth, POST /api/auth/2fa, ...
app.use(pageRouter);         // GET /login, GET /login.js — served at the app root
```

Without `apiBasePath` set correctly for this layout, the login page would try to submit to bare `/auth` (404) instead of `/api/auth`.

`apiBasePath` must start with `/` and contain only unreserved URI characters (letters, digits, `-._~/`) — `createAuthRouter` throws immediately if it doesn't, rather than embedding a malformed value into the page.

### Routes

All `apiRouter` routes are relative to wherever you mount it, under `/auth`:

| Method | Path                            | Auth | 2FA only | Body                     | Description                                                                                                                                                                                                                                                                                                                                |
| ------ | ------------------------------- | ---- | -------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST   | `/auth`                         | No   |          | `{ username, password }` | Login — validates credentials. With 2FA enabled, returns `{ twoFA: true, channel, emailFallbackAvailable }` if a code challenge is required (`channel` is `'discord'`, `'email'`, or `'development'` — delivering the code per [2FA Code Delivery](#2fa-code-delivery), or `500` if delivery fails); otherwise creates a session directly. |
| POST   | `/auth/2fa`                     | No   | Yes      | `{ twoFACode }`          | Verify 2FA code and create session.                                                                                                                                                                                                                                                                                                        |
| POST   | `/auth/2fa/resend-email`        | No   | Yes      | —                        | Re-send the pending code via email (uses the `twoFAKey` cookie, not a request body). `{ success: true, channel: 'email' }` on success; `{ success: false }` if not applicable (no pending code, no email on file, not configured); `500` if the send itself fails.                                                                         |
| POST   | `/auth/logout`                  | Yes  |          | —                        | Destroy the session.                                                                                                                                                                                                                                                                                                                       |
| GET    | `/auth/verify`                  | Yes  |          | —                        | Verify & refresh an existing session.                                                                                                                                                                                                                                                                                                      |
| POST   | `/auth/invalidate-all-sessions` | Yes  |          | —                        | Wipe all sessions and, when 2FA is enabled, all bypass tokens.                                                                                                                                                                                                                                                                             |
| POST   | `/auth/revoke-2fa-bypass`       | Yes  | Yes      | `{ username? }`          | Revoke 2FA bypass tokens (for one user or all).                                                                                                                                                                                                                                                                                            |

`pageRouter` is a separate router with its own two routes, relative to wherever *it's* mounted (not necessarily the same place as `apiRouter` — see [Mounting `apiRouter` and `pageRouter` separately](#mounting-apirouter-and-pagerouter-separately)):

| Method | Path        | Auth | Body | Description                                                                                                                                                      |
| ------ | ----------- | ---- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/login`    | No   | —    | Login page (HTML). Only registered when `serveLoginPage: true`. Handles 2FA client-side based on the `/auth` response — no server-side branching on `enable2fa`. |
| GET    | `/login.js` | No   | —    | Client-side script for the login page. Only registered when `serveLoginPage: true`.                                                                              |

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
userStore.insert({ username: 'alice', password: 'secret' });
db.close();
```

| Method                             | Description                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| `insert({ username, password })`   | Create a new user (password is bcrypt-hashed automatically).                 |
| `authenticate(username, password)` | Validate credentials. Returns `{ id, username, email, discord }` or `null`.  |
| `setPassword(username, password)`  | Update a user's password (bcrypt-hashed automatically).                      |
| `setEmail(username, email)`        | Set (or, with `null`/`''`, clear) a user's email address for 2FA delivery.   |
| `setDiscord(username, discordId)`  | Set (or, with `null`/`''`, clear) a user's Discord user ID for 2FA delivery. |
| `exists(username)`                 | Returns `true` if the username exists.                                       |
| `getByUsername(username)`          | Look up user by username (without password).                                 |
| `findAll()`                        | List all users (without passwords).                                          |

### CLI

kaiauth ships a `kaiauth` CLI for managing users directly against the auth database, without writing a script.

```sh
npx kaiauth <command> --db <path-to-auth.db>
```

| Command                                                          | Description                                                                                                                                                 |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `add-user <username> <password> --db [--email] [--discord]`      | Add a new user, optionally with email/Discord for 2FA delivery. Fails if the username already exists.                                                       |
| `update-user <username> --db [--password] [--email] [--discord]` | Update one or more fields on an existing user. `--email`/`--discord` accept `""` to clear. Fails if the username doesn't exist or no field flags are given. |
| `list-users --db`                                                | List all users.                                                                                                                                             |

**Example**

```sh
npx kaiauth add-user alice hunter2 --db ./data/auth.db --email alice@example.com
npx kaiauth update-user alice --db ./data/auth.db --discord 123456789012345678
npx kaiauth update-user alice --db ./data/auth.db --password newpassword
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

| Module                | Description                                                                       |
| --------------------- | --------------------------------------------------------------------------------- |
| `LoginService`        | Framework-agnostic login + 2FA service class.                                     |
| `createLoginHandlers` | Factory for Express route handlers.                                               |
| `RateLimiter`         | Generic in-memory rate limiter with lockout.                                      |
| `TwoFAStore`          | In-memory 2FA code store with auto-expiry.                                        |
| `deliverTwoFACode`    | Orchestrates 2FA channel selection (dev → discord → email; throws if none apply). |
| `DiscordSender`       | Persistent `discord.js` client wrapper for DM delivery.                           |
| `EmailSender`         | Resend-backed email delivery for 2FA codes.                                       |
| `regenerateSession`   | Promise wrapper for `req.session.regenerate()`.                                   |
| `destroySession`      | Promise wrapper for session destruction.                                          |

## License

MIT
