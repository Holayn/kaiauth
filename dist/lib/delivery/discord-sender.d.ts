export interface DiscordSenderConfig {
    botToken: string;
}
/** Delivers a message to a Discord user by id. */
export type SendDiscordDM = (discordUserId: string, message: string) => Promise<void>;
/**
 * Sends Discord DMs using a single persistent bot connection.
 *
 * The bot must share a guild with the target user (or the user must allow
 * DMs from server members), or `send()` will reject with a Discord API
 * error — this is a Discord platform restriction, not something kaiauth
 * can work around.
 */
export declare class DiscordSender {
    private _client;
    private _ready;
    constructor(config: DiscordSenderConfig);
    send(discordUserId: string, message: string): Promise<void>;
}
//# sourceMappingURL=discord-sender.d.ts.map