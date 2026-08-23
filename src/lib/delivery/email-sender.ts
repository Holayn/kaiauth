import { Resend } from 'resend';

export interface EmailSenderConfig {
  apiKey: string;
  from: string;
}

/** Delivers an email to an address. */
export type SendEmail = (to: string, subject: string, body: string) => Promise<void>;

export class EmailSender {
  private _resend: Resend;
  private _config: EmailSenderConfig;

  constructor(config: EmailSenderConfig) {
    this._resend = new Resend(config.apiKey);
    this._config = config;
  }

  async send(to: string, subject: string, body: string): Promise<void> {
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
