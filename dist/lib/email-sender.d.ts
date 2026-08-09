export interface EmailSenderConfig {
    apiKey: string;
    from: string;
    subject?: string;
    buildBody?: (code: string) => string;
}
export declare class EmailSender {
    private _resend;
    private _config;
    constructor(config: EmailSenderConfig);
    send(to: string, code: string): Promise<void>;
}
//# sourceMappingURL=email-sender.d.ts.map