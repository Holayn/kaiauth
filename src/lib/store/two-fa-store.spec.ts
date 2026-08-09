import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TwoFAStore } from './two-fa-store';
import type { User } from './user-store';

const user: User = { id: 1, username: 'alice', email: null, discord: null };

describe('TwoFAStore', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('stores the full user on create', () => {
    const store = new TwoFAStore();
    const { key } = store.create(user);
    expect(store.get(key)).toEqual({ user, code: expect.any(String) });
  });

  it('replaces a prior entry for the same username', () => {
    const store = new TwoFAStore();
    const { key: key1 } = store.create(user);
    const { key: key2 } = store.create(user);

    expect(store.has(key1)).toBe(false);
    expect(store.has(key2)).toBe(true);
  });

  it('expires entries after the TTL', () => {
    const store = new TwoFAStore({ codeTtlMs: 1000 });
    const { key } = store.create(user);

    expect(store.has(key)).toBe(true);
    vi.advanceTimersByTime(1001);
    expect(store.has(key)).toBe(false);
  });

  it('remove deletes an entry', () => {
    const store = new TwoFAStore();
    const { key } = store.create(user);
    store.remove(key);
    expect(store.has(key)).toBe(false);
  });
});
