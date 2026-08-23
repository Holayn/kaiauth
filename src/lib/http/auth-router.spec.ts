import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createAuthRouter } from './auth-router';

const buildCookieOptions = () => ({});

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kaiauth-test-'));
}

describe('createAuthRouter construction-time validation', () => {
  const dirs: string[] = [];
  afterEach(() => {
    // better-sqlite3 keeps its files open for the life of the Database handle; the
    // non-throwing tests below don't have a clean way to reach into SQLiteSessionStore's
    // private db to close it, so on Windows the directory can still be locked here.
    // Best-effort cleanup only — leftover temp dirs are harmless and OS-cleaned eventually.
    while (dirs.length) {
      try {
        fs.rmSync(dirs.pop()!, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  });

  function makeDir() {
    const dir = tmpDir();
    dirs.push(dir);
    return dir;
  }

  it('throws when enable2fa is true and no delivery method or development flag is set', () => {
    expect(() =>
      createAuthRouter({
        authDataDir: makeDir(),
        sessionSecret: 'secret',
        buildCookieOptions,
        notify: () => {},
      }),
    ).toThrow(/2FA delivery method/);
  });

  it('does not throw when development is set with no delivery method configured', () => {
    let result;
    expect(() => {
      result = createAuthRouter({
        authDataDir: makeDir(),
        sessionSecret: 'secret',
        buildCookieOptions,
        notify: () => {},
        development: true,
      });
    }).not.toThrow();
    result?.db.close();
  });

  it('does not throw when email is configured', () => {
    let result;
    expect(() => {
      result = createAuthRouter({
        authDataDir: makeDir(),
        sessionSecret: 'secret',
        buildCookieOptions,
        notify: () => {},
        email: { apiKey: 'key', from: 'noreply@example.com' },
      });
    }).not.toThrow();
    result?.db.close();
  });

  it('accepts a sendDiscordDM callback instead of a bot token', () => {
    let result;
    const sendDiscordDM = vi.fn().mockResolvedValue(undefined);
    expect(() => {
      result = createAuthRouter({
        authDataDir: makeDir(),
        sessionSecret: 'secret',
        buildCookieOptions,
        notify: () => {},
        discord: sendDiscordDM,
      });
    }).not.toThrow();
    result?.db.close();
  });

  it('does not throw when enable2fa is false, regardless of delivery config', () => {
    let result;
    expect(() => {
      result = createAuthRouter({
        authDataDir: makeDir(),
        sessionSecret: 'secret',
        buildCookieOptions,
        notify: () => {},
        enable2fa: false,
      });
    }).not.toThrow();
    result?.db.close();
  });

  it('does not throw when defaultRedirect is a valid same-origin path', () => {
    let result;
    expect(() => {
      result = createAuthRouter({
        authDataDir: makeDir(),
        sessionSecret: 'secret',
        buildCookieOptions,
        notify: () => {},
        enable2fa: false,
        defaultRedirect: '/admin',
      });
    }).not.toThrow();
    result?.db.close();
  });

  it.each([
    ['protocol-relative (open redirect)', '//evil.com'],
    ['missing leading slash', 'admin'],
    ['empty string', ''],
  ])('throws when defaultRedirect is invalid (%s)', (_label, defaultRedirect) => {
    expect(() =>
      createAuthRouter({
        authDataDir: makeDir(),
        sessionSecret: 'secret',
        buildCookieOptions,
        notify: () => {},
        enable2fa: false,
        defaultRedirect,
      }),
    ).toThrow(/defaultRedirect is invalid/);
  });
});
