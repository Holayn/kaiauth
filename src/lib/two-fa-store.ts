import crypto from 'crypto';
import type { User } from './user-store';

const CODE_LENGTH = 6;
const CODE_TTL_MS = 60 * 1000;

export interface TwoFAEntry {
  user: User;
  code: string;
}

interface TwoFAStoreOptions {
  codeTtlMs?: number;
  codeLength?: number;
}

export class TwoFAStore {
  private _entries: Record<string, TwoFAEntry> = {};
  private _codeTtlMs: number;
  private _codeLength: number;

  constructor({ codeTtlMs = CODE_TTL_MS, codeLength = CODE_LENGTH }: TwoFAStoreOptions = {}) {
    this._codeTtlMs = codeTtlMs;
    this._codeLength = codeLength;
  }

  has(key: string): boolean {
    return !!this._entries[key];
  }

  get(key: string): TwoFAEntry | undefined {
    return this._entries[key];
  }

  create(user: User): { key: string; code: string } {
    for (const [key, entry] of Object.entries(this._entries)) {
      if (entry.user.username === user.username) {
        delete this._entries[key];
      }
    }

    const key = crypto.randomBytes(32).toString('hex');
    const code = Array.from({ length: this._codeLength }, () =>
      crypto.randomInt(36).toString(36)
    )
      .join('')
      .toUpperCase();

    this._entries[key] = { user, code };
    setTimeout(() => { delete this._entries[key]; }, this._codeTtlMs);

    return { key, code };
  }

  remove(key: string): void {
    delete this._entries[key];
  }
}
