import type { User } from '../store/user-store';
import type { SendEmail } from './email-sender';
import type { SendDiscordDM } from 'kai-discord-sender';

export type DeliveryChannel = 'discord' | 'email' | 'development';

export interface TwoFADeliveryOptions {
  development?: boolean;
  sendEmail?: SendEmail;
  sendDiscordDM?: SendDiscordDM;
}

export interface TwoFADeliveryResult {
  channel: DeliveryChannel;
  emailFallbackAvailable: boolean;
}

/** Subject/body for a 2FA code email — shared by the initial send and the resend endpoint so their wording can't drift apart. */
export function twoFACodeEmail(code: string): { subject: string; body: string } {
  return { subject: 'Your verification code', body: `Your verification code is: ${code}` };
}

function twoFACodeMessage(code: string): string {
  return `Your verification code is: ${code}`;
}

export async function deliverTwoFACode(
  user: User,
  code: string,
  opts: TwoFADeliveryOptions,
): Promise<TwoFADeliveryResult> {
  const emailAvailable = !!(user.email && opts.sendEmail);

  if (opts.development) {
    console.log(`[kaiauth] (dev) 2FA code for ${user.username}: ${code}`);
    return { channel: 'development', emailFallbackAvailable: false };
  }

  if (user.discord && opts.sendDiscordDM) {
    await opts.sendDiscordDM(user.discord, twoFACodeMessage(code));
    return { channel: 'discord', emailFallbackAvailable: emailAvailable };
  }

  if (user.email && opts.sendEmail) {
    const { subject, body } = twoFACodeEmail(code);
    await opts.sendEmail(user.email, subject, body);
    return { channel: 'email', emailFallbackAvailable: false };
  }

  throw new Error(`No 2FA delivery channel available for user ${user.username} (no email or discord on file/configured)`);
}
