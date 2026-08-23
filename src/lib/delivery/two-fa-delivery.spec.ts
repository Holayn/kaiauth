import { describe, it, expect, vi } from 'vitest';
import { deliverTwoFACode } from './two-fa-delivery';
import type { User } from '../store/user-store';

describe('deliverTwoFACode', () => {
  it('development mode logs to console and never sends', async () => {
    const user: User = { id: 1, username: 'alice', email: 'alice@example.com', discord: '123' };
    const sendEmail = vi.fn();
    const sendDiscordDM = vi.fn();

    const result = await deliverTwoFACode(user, '123456', { development: true, sendEmail, sendDiscordDM });

    expect(result).toEqual({ channel: 'development', emailFallbackAvailable: false });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('uses discord when user has a discord id and discord is configured, even if email is also configured', async () => {
    const user: User = { id: 1, username: 'alice', email: 'alice@example.com', discord: '123' };
    const sendEmail = vi.fn();
    const sendDiscordDM = vi.fn().mockResolvedValue(undefined);

    const result = await deliverTwoFACode(user, '123456', { sendEmail, sendDiscordDM });

    expect(sendDiscordDM).toHaveBeenCalledWith('123', 'Your verification code is: 123456');
    expect(sendEmail).not.toHaveBeenCalled();
    expect(result).toEqual({ channel: 'discord', emailFallbackAvailable: true });
  });

  it('propagates a discord send failure instead of swallowing it', async () => {
    const user: User = { id: 1, username: 'alice', email: null, discord: '123' };
    const sendDiscordDM = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(
      deliverTwoFACode(user, '123456', { sendDiscordDM }),
    ).rejects.toThrow('boom');
  });

  it('uses email when only email is configured', async () => {
    const user: User = { id: 1, username: 'alice', email: 'alice@example.com', discord: null };
    const sendEmail = vi.fn().mockResolvedValue(undefined);

    const result = await deliverTwoFACode(user, '123456', { sendEmail });

    expect(sendEmail).toHaveBeenCalledWith('alice@example.com', 'Your verification code', 'Your verification code is: 123456');
    expect(result).toEqual({ channel: 'email', emailFallbackAvailable: false });
  });

  it('propagates an email send failure instead of swallowing it', async () => {
    const user: User = { id: 1, username: 'alice', email: 'alice@example.com', discord: null };
    const sendEmail = vi.fn().mockRejectedValue(new Error('invalid API key'));

    await expect(deliverTwoFACode(user, '123456', { sendEmail })).rejects.toThrow('invalid API key');
  });

  it('throws when neither discord nor email is available for the user', async () => {
    const user: User = { id: 1, username: 'alice', email: null, discord: null };

    await expect(deliverTwoFACode(user, '123456', {})).rejects.toThrow(
      'No 2FA delivery channel available for user alice',
    );
  });

  it('throws when the user has contact info but the matching channel is not configured', async () => {
    const user: User = { id: 1, username: 'alice', email: 'alice@example.com', discord: '123' };

    // Neither `sendEmail` nor `sendDiscordDM` passed in opts, even though the user has both on file.
    await expect(deliverTwoFACode(user, '123456', {})).rejects.toThrow(
      'No 2FA delivery channel available for user alice',
    );
  });
});
