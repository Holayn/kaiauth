import { describe, it, expect, vi } from 'vitest';

const send = vi.fn();
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({ emails: { send } })),
}));

import { EmailSender } from './email-sender';

describe('EmailSender', () => {
  it('sends with the expected shape', async () => {
    send.mockResolvedValueOnce({ data: { id: 'abc' }, error: null });

    const sender = new EmailSender({ apiKey: 'key', from: 'noreply@example.com' });
    await sender.send('alice@example.com', 'Your verification code', 'Your verification code is: 123456');

    expect(send).toHaveBeenCalledWith({
      from: 'noreply@example.com',
      to: 'alice@example.com',
      subject: 'Your verification code',
      text: 'Your verification code is: 123456',
    });
  });

  it('throws when Resend returns an error', async () => {
    send.mockResolvedValueOnce({ data: null, error: { message: 'invalid API key' } });

    const sender = new EmailSender({ apiKey: 'bad', from: 'noreply@example.com' });
    await expect(
      sender.send('alice@example.com', 'Your verification code', 'Your verification code is: 123456'),
    ).rejects.toThrow('invalid API key');
  });
});
