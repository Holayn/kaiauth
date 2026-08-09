import type { User } from './user-store';
import type { EmailSender } from './email-sender';
import type { DiscordSender } from './discord-sender';

export type DeliveryChannel = 'discord' | 'email' | 'development';

export interface TwoFADeliveryOptions {
  development?: boolean;
  emailSender?: EmailSender;
  discordSender?: DiscordSender;
}

export interface TwoFADeliveryResult {
  channel: DeliveryChannel;
  emailFallbackAvailable: boolean;
}

export async function deliverTwoFACode(
  user: User,
  code: string,
  opts: TwoFADeliveryOptions,
): Promise<TwoFADeliveryResult> {
  const emailAvailable = !!(user.email && opts.emailSender);

  if (opts.development) {
    console.log(`[kaiauth] (dev) 2FA code for ${user.username}: ${code}`);
    return { channel: 'development', emailFallbackAvailable: false };
  }

  if (user.discord && opts.discordSender) {
    await opts.discordSender.send(user.discord, code);
    return { channel: 'discord', emailFallbackAvailable: emailAvailable };
  }

  if (user.email && opts.emailSender) {
    await opts.emailSender.send(user.email, code);
    return { channel: 'email', emailFallbackAvailable: false };
  }

  throw new Error(`No 2FA delivery channel available for user ${user.username} (no email or discord on file/configured)`);
}
