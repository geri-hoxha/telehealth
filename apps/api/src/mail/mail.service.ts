import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface Email {
  to: string;
  subject: string;
  text: string;
}

/**
 * Sends emails through Resend's HTTP API when RESEND_API_KEY and MAIL_FROM are set. Without them
 * the email is written to the log, so codes and links can be used in development. Never throws.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiKey?: string;
  private readonly from?: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('RESEND_API_KEY') || undefined;
    this.from = config.get<string>('MAIL_FROM') || undefined;
    if (!this.apiKey || !this.from) {
      this.logger.warn('Email is not configured (RESEND_API_KEY, MAIL_FROM): emails are only logged');
    }
  }

  async send(email: Email): Promise<void> {
    if (!this.apiKey || !this.from) {
      this.logger.log(`Email to ${email.to}\nSubject: ${email.subject}\n\n${email.text}\n`);
      return;
    }
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: this.from, to: [email.to], subject: email.subject, text: email.text }),
      });
      if (!response.ok) {
        this.logger.warn(`Resend rejected an email (${response.status} ${await response.text()})`);
      }
    } catch (error) {
      this.logger.error(`Email to ${email.to} failed: ${String(error)}`);
    }
  }
}
