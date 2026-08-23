import { describe, it, expect, vi } from 'vitest';

const { FakeClient } = vi.hoisted(() => {
  class FakeClient {
    static instances: FakeClient[] = [];
    listeners: Record<string, (...args: unknown[]) => void> = {};
    login = vi.fn().mockResolvedValue('token');
    users = { fetch: vi.fn() };

    constructor() {
      FakeClient.instances.push(this);
    }

    once(event: string, handler: (...args: unknown[]) => void): void {
      this.listeners[event] = handler;
    }

    emit(event: string, ...args: unknown[]): void {
      this.listeners[event]?.(...args);
    }
  }
  return { FakeClient };
});

vi.mock('discord.js', () => ({
  Client: FakeClient,
  GatewayIntentBits: { Guilds: 1 },
}));

import { DiscordSender } from './discord-sender';

describe('DiscordSender', () => {
  it('waits for readiness before sending', async () => {
    const sender = new DiscordSender({ botToken: 'tok' });
    const client = FakeClient.instances[FakeClient.instances.length - 1];
    const send = vi.fn().mockResolvedValue(undefined);
    client.users.fetch.mockResolvedValue({ send });

    const sendPromise = sender.send('123', 'Your verification code is: 654321');

    // Not ready yet — fetch must not have been called before the 'ready' event fires.
    await Promise.resolve();
    expect(client.users.fetch).not.toHaveBeenCalled();

    client.emit('ready');
    await sendPromise;

    expect(client.users.fetch).toHaveBeenCalledWith('123');
    expect(send).toHaveBeenCalledWith('Your verification code is: 654321');
  });

  it('rejects send() when the client errors before becoming ready', async () => {
    const sender = new DiscordSender({ botToken: 'bad-token' });
    const client = FakeClient.instances[FakeClient.instances.length - 1];

    const sendPromise = sender.send('123', 'Your verification code is: 654321');
    client.emit('error', new Error('invalid token'));

    await expect(sendPromise).rejects.toThrow('invalid token');
  });

  it('propagates a failure from the message send itself', async () => {
    const sender = new DiscordSender({ botToken: 'tok' });
    const client = FakeClient.instances[FakeClient.instances.length - 1];
    client.users.fetch.mockResolvedValue({ send: vi.fn().mockRejectedValue(new Error('cannot DM user')) });

    const sendPromise = sender.send('123', 'Your verification code is: 654321');
    client.emit('ready');

    await expect(sendPromise).rejects.toThrow('cannot DM user');
  });
});
