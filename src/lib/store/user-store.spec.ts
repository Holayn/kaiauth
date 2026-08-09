import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { UserStore } from './user-store';

describe('UserStore', () => {
  it('migrates a pre-existing schema by adding email/discord columns, preserving existing rows', () => {
    const db = new Database(':memory:');
    db.exec('CREATE TABLE user (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password TEXT)');
    db.prepare('INSERT INTO user (username, password) VALUES (?, ?)').run('alice', 'hash');

    const store = new UserStore(db);

    const columns = (db.prepare('PRAGMA table_info(user)').all() as { name: string }[]).map((c) => c.name);
    expect(columns).toEqual(expect.arrayContaining(['email', 'discord']));

    const user = store.getByUsername('alice');
    expect(user).toEqual({ id: expect.any(Number), username: 'alice', email: null, discord: null });
  });

  it('is idempotent across repeated opens', () => {
    const db = new Database(':memory:');
    new UserStore(db);
    expect(() => new UserStore(db)).not.toThrow();
  });

  it('setEmail/setDiscord set and clear values', () => {
    const store = new UserStore(new Database(':memory:'));
    store.insert({ username: 'bob', password: 'pw' });

    store.setEmail('bob', 'bob@example.com');
    store.setDiscord('bob', '123456789012345678');
    expect(store.getByUsername('bob')).toEqual({
      id: expect.any(Number),
      username: 'bob',
      email: 'bob@example.com',
      discord: '123456789012345678',
    });

    store.setEmail('bob', '');
    store.setDiscord('bob', '');
    expect(store.getByUsername('bob')).toEqual({
      id: expect.any(Number),
      username: 'bob',
      email: null,
      discord: null,
    });
  });

  it('setPassword updates the password without touching email/discord', () => {
    const store = new UserStore(new Database(':memory:'));
    store.insert({ username: 'carol', password: 'pw' });
    store.setEmail('carol', 'carol@example.com');

    store.setPassword('carol', 'new-pw');

    expect(store.authenticate('carol', 'new-pw')).not.toBeNull();
    expect(store.authenticate('carol', 'pw')).toBeNull();
    expect(store.getByUsername('carol')?.email).toBe('carol@example.com');
  });
});
