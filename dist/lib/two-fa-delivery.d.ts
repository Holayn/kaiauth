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
export declare function deliverTwoFACode(user: User, code: string, opts: TwoFADeliveryOptions): Promise<TwoFADeliveryResult>;
//# sourceMappingURL=two-fa-delivery.d.ts.map