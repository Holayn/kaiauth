"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscordSender = void 0;
const discord_js_1 = require("discord.js");
/**
 * Sends Discord DMs using a single persistent bot connection.
 *
 * The bot must share a guild with the target user (or the user must allow
 * DMs from server members), or `send()` will reject with a Discord API
 * error — this is a Discord platform restriction, not something kaiauth
 * can work around.
 */
class DiscordSender {
    constructor(config) {
        this._client = new discord_js_1.Client({ intents: [discord_js_1.GatewayIntentBits.Guilds] });
        this._ready = new Promise((resolve, reject) => {
            this._client.once('ready', () => resolve());
            this._client.once('error', reject);
            this._client.login(config.botToken).catch(reject);
        });
    }
    async send(discordUserId, message) {
        await this._ready;
        const user = await this._client.users.fetch(discordUserId);
        await user.send(message);
    }
}
exports.DiscordSender = DiscordSender;
//# sourceMappingURL=discord-sender.js.map