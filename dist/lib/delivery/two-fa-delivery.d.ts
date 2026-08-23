import type { User } from '../store/user-store';
import type { SendEmail } from './email-sender';
import type { SendDiscordDM } from './discord-sender';
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
export declare function twoFACodeEmail(code: string): {
    subject: string;
    body: string;
};
export declare function deliverTwoFACode(user: User, code: string, opts: TwoFADeliveryOptions): Promise<TwoFADeliveryResult>;
//# sourceMappingURL=two-fa-delivery.d.ts.map