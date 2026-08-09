import { Resend } from 'resend';

export interface EmailSenderConfig {
  apiKey: string;
  from: string;
  subject?: string;
  buildBody?: (code: string) => string;
}

export class EmailSender {
  private _resend: Resend;
  private _config: EmailSenderConfig;

  constructor(config: EmailSenderConfig) {
    this._resend = new Resend(config.apiKey);
    this._config = config;
  }

  async send(to: string, code: string): Promise<void> {
    const { error } = await this._resend.emails.send({
      from: this._config.from,
      to,
      subject: this._config.subject ?? 'Your verification code',
      text: this._config.buildBody?.(code) ?? `Your verification code is: ${code}`,
    });

    if (error) {
      throw new Error(`Failed to send 2FA email: ${error.message}`);
    }
  }
}
