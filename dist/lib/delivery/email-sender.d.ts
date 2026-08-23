export interface EmailSenderConfig {
    apiKey: string;
    from: string;
}
/** Delivers an email to an address. */
export type SendEmail = (to: string, subject: string, body: string) => Promise<void>;
export declare class EmailSender {
    private _resend;
    private _config;
    constructor(config: EmailSenderConfig);
    send(to: string, subject: string, body: string): Promise<void>;
}
//# sourceMappingURL=email-sender.d.ts.map