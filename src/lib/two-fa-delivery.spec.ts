import { describe, it, expect, vi } from 'vitest';
import { deliverTwoFACode } from './two-fa-delivery';
import type { User } from './user-store';
import type { DiscordSender } from './discord-sender';
import type { EmailSender } from './email-sender';

function fakeDiscordSender(send: (id: string, code: string) => Promise<void>): DiscordSender {
  return { send } as unknown as DiscordSender;
}

function fakeEmailSender(send: (to: string, code: string) => Promise<void>): EmailSender {
  return { send } as unknown as EmailSender;
}

describe('deliverTwoFACode', () => {
  it('development mode logs to console and never sends', async () => {
    const user: User = { id: 1, username: 'alice', email: 'alice@example.com', discord: '123' };
    const emailSend = vi.fn();
    const emailSender = fakeEmailSender(emailSend);
    const discordSender = fakeDiscordSender(vi.fn());

    const result = await deliverTwoFACode(user, '123456', { development: true, emailSender, discordSender });

    expect(result).toEqual({ channel: 'development', emailFallbackAvailable: false });
    expect(emailSend).not.toHaveBeenCalled();
  });

  it('uses discord when user has a discord id and discord is configured, even if email is also configured', async () => {
    const user: User = { id: 1, username: 'alice', email: 'alice@example.com', discord: '123' };
    const emailSend = vi.fn();
    const emailSender = fakeEmailSender(emailSend);
    const discordSend = vi.fn().mockResolvedValue(undefined);
    const discordSender = fakeDiscordSender(discordSend);

    const result = await deliverTwoFACode(user, '123456', { emailSender, discordSender });

    expect(discordSend).toHaveBeenCalledWith('123', '123456');
    expect(emailSend).not.toHaveBeenCalled();
    expect(result).toEqual({ channel: 'discord', emailFallbackAvailable: true });
  });

  it('propagates a discord send failure instead of swallowing it', async () => {
    const user: User = { id: 1, username: 'alice', email: null, discord: '123' };
    const discordSender = fakeDiscordSender(vi.fn().mockRejectedValue(new Error('boom')));

    await expect(
      deliverTwoFACode(user, '123456', { discordSender }),
    ).rejects.toThrow('boom');
  });

  it('uses email when only email is configured', async () => {
    const user: User = { id: 1, username: 'alice', email: 'alice@example.com', discord: null };
    const emailSend = vi.fn().mockResolvedValue(undefined);
    const emailSender = fakeEmailSender(emailSend);

    const result = await deliverTwoFACode(user, '123456', { emailSender });

    expect(emailSend).toHaveBeenCalledWith('alice@example.com', '123456');
    expect(result).toEqual({ channel: 'email', emailFallbackAvailable: false });
  });

  it('propagates an email send failure instead of swallowing it', async () => {
    const user: User = { id: 1, username: 'alice', email: 'alice@example.com', discord: null };
    const emailSender = fakeEmailSender(vi.fn().mockRejectedValue(new Error('invalid API key')));

    await expect(deliverTwoFACode(user, '123456', { emailSender })).rejects.toThrow('invalid API key');
  });

  it('throws when neither discord nor email is available for the user', async () => {
    const user: User = { id: 1, username: 'alice', email: null, discord: null };

    await expect(deliverTwoFACode(user, '123456', {})).rejects.toThrow(
      'No 2FA delivery channel available for user alice',
    );
  });

  it('throws when the user has contact info but the matching channel is not configured', async () => {
    const user: User = { id: 1, username: 'alice', email: 'alice@example.com', discord: '123' };

    // Neither `emailSender` nor `discordSender` passed in opts, even though the user has both on file.
    await expect(deliverTwoFACode(user, '123456', {})).rejects.toThrow(
      'No 2FA delivery channel available for user alice',
    );
  });
});
