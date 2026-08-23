"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailSender = void 0;
const resend_1 = require("resend");
class EmailSender {
    constructor(config) {
        this._resend = new resend_1.Resend(config.apiKey);
        this._config = config;
    }
    async send(to, subject, body) {
        const { error } = await this._resend.emails.send({
            from: this._config.from,
            to,
            subject,
            text: body,
        });
        if (error) {
            throw new Error(`Failed to send email: ${error.message}`);
        }
    }
}
exports.EmailSender = EmailSender;
//# sourceMappingURL=email-sender.js.map