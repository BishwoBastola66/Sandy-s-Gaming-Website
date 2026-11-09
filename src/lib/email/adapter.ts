import fs from 'fs';
import path from 'path';
import nodemailer, { type Transporter } from 'nodemailer';
import type {
  EmailAdapter,
  EmailMessage,
  EmailSendResult,
  EmailProviderName,
} from './types.ts';

/**
 * Fallback Adapter when no external email credentials are configured in .env.local.
 * Safely prevents pretend delivery while saving draft replies in PostgreSQL.
 */
export class UnconfiguredEmailAdapter implements EmailAdapter {
  readonly name: EmailProviderName = 'unconfigured';
  readonly isConfigured = false;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async send(_message: EmailMessage): Promise<EmailSendResult> {
    return {
      success: false,
      status: 'pending',
      providerMessageId: null,
      error:
        'Email delivery provider is not configured. Set EMAIL_PROVIDER (e.g. resend, sendgrid, postmark) and EMAIL_API_KEY in server environment to enable live dispatch.',
      isConfigured: false,
      provider: this.name,
    };
  }
}

/**
 * Resend Email Adapter
 * https://resend.com/docs/api-reference/emails/send-email
 */
export class ResendEmailAdapter implements EmailAdapter {
  readonly name: EmailProviderName = 'resend';
  readonly isConfigured = true;
  private apiKey: string;
  private defaultFrom: string;

  constructor(apiKey: string, defaultFrom: string) {
    this.apiKey = apiKey;
    this.defaultFrom = defaultFrom;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const fromAddress = message.from || this.defaultFrom;
    const formattedFrom = message.fromName
      ? `${message.fromName} <${fromAddress}>`
      : fromAddress;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    if (message.idempotencyKey) {
      headers['Idempotency-Key'] = message.idempotencyKey;
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          from: formattedFrom,
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
          reply_to: message.replyTo,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMsg = data?.message || data?.error || `Resend HTTP error ${response.status}`;
        return {
          success: false,
          status: 'failed',
          providerMessageId: null,
          error: `Resend error: ${errorMsg}`,
          isConfigured: true,
          provider: this.name,
        };
      }

      // Resend returns { id: '...' } upon acceptance
      return {
        success: true,
        status: 'accepted',
        providerMessageId: data?.id || null,
        error: null,
        isConfigured: true,
        provider: this.name,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network failure communicating with Resend';
      return {
        success: false,
        status: 'failed',
        providerMessageId: null,
        error: `Resend transport error: ${msg}`,
        isConfigured: true,
        provider: this.name,
      };
    }
  }
}

/**
 * SendGrid Email Adapter
 * https://docs.sendgrid.com/api-reference/mail-send/mail-send
 */
export class SendGridEmailAdapter implements EmailAdapter {
  readonly name: EmailProviderName = 'sendgrid';
  readonly isConfigured = true;
  private apiKey: string;
  private defaultFrom: string;

  constructor(apiKey: string, defaultFrom: string) {
    this.apiKey = apiKey;
    this.defaultFrom = defaultFrom;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const fromEmail = message.from || this.defaultFrom;

    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: message.to, name: message.toName || undefined }],
            },
          ],
          from: { email: fromEmail, name: message.fromName || undefined },
          reply_to: message.replyTo ? { email: message.replyTo } : undefined,
          subject: message.subject,
          content: [
            { type: 'text/plain', value: message.text },
            { type: 'text/html', value: message.html },
          ],
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const errorMsg = data?.errors?.[0]?.message || `SendGrid HTTP ${response.status}`;
        return {
          success: false,
          status: 'failed',
          providerMessageId: null,
          error: `SendGrid error: ${errorMsg}`,
          isConfigured: true,
          provider: this.name,
        };
      }

      // SendGrid returns 202 Accepted with header X-Message-Id
      const messageId = response.headers.get('x-message-id') || null;

      return {
        success: true,
        status: 'accepted',
        providerMessageId: messageId,
        error: null,
        isConfigured: true,
        provider: this.name,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error reaching SendGrid';
      return {
        success: false,
        status: 'failed',
        providerMessageId: null,
        error: `SendGrid transport error: ${msg}`,
        isConfigured: true,
        provider: this.name,
      };
    }
  }
}

/**
 * Postmark Email Adapter
 * https://postmarkapp.com/developer/api/overview
 */
export class PostmarkEmailAdapter implements EmailAdapter {
  readonly name: EmailProviderName = 'postmark';
  readonly isConfigured = true;
  private apiKey: string;
  private defaultFrom: string;

  constructor(apiKey: string, defaultFrom: string) {
    this.apiKey = apiKey;
    this.defaultFrom = defaultFrom;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const fromEmail = message.from || this.defaultFrom;
    const formattedFrom = message.fromName
      ? `"${message.fromName}" <${fromEmail}>`
      : fromEmail;

    try {
      const response = await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
          'X-Postmark-Server-Token': this.apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          From: formattedFrom,
          To: message.to,
          Subject: message.subject,
          HtmlBody: message.html,
          TextBody: message.text,
          ReplyTo: message.replyTo,
          Tag: 'inquiry-response',
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMsg = data?.Message || `Postmark HTTP ${response.status}`;
        return {
          success: false,
          status: 'failed',
          providerMessageId: null,
          error: `Postmark error: ${errorMsg}`,
          isConfigured: true,
          provider: this.name,
        };
      }

      return {
        success: true,
        status: 'accepted',
        providerMessageId: data?.MessageID || null,
        error: null,
        isConfigured: true,
        provider: this.name,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error reaching Postmark';
      return {
        success: false,
        status: 'failed',
        providerMessageId: null,
        error: `Postmark transport error: ${msg}`,
        isConfigured: true,
        provider: this.name,
      };
    }
  }
}

/**
 * SMTP / SpaceMail Email Adapter
 * Supports SpaceMail (mail.spacemail.com) and standard SMTP configurations.
 */
export interface SmtpConfig {
  host: string;
  port: number;
  secure?: boolean;
  user: string;
  pass: string;
  defaultFrom: string;
  defaultFromName?: string;
}

export class SmtpEmailAdapter implements EmailAdapter {
  readonly name: EmailProviderName;
  readonly isConfigured: boolean;
  private transporter: Transporter | null = null;
  private defaultFrom: string;
  private defaultFromName?: string;

  constructor(config: SmtpConfig, providerName: EmailProviderName = 'spacemail') {
    this.name = providerName;
    this.defaultFrom = config.defaultFrom;
    this.defaultFromName = config.defaultFromName;
    this.isConfigured = Boolean(config.host && config.user && config.pass);

    if (this.isConfigured) {
      this.transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure ?? config.port === 465,
        auth: {
          user: config.user,
          pass: config.pass,
        },
      });
    }
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (!this.isConfigured || !this.transporter) {
      return {
        success: false,
        status: 'failed',
        providerMessageId: null,
        error: `${this.name} credentials (password or user) are not configured.`,
        isConfigured: false,
        provider: this.name,
      };
    }

    const fromAddress = message.from || this.defaultFrom;
    const fromName = message.fromName || this.defaultFromName;
    const formattedFrom = fromName ? `"${fromName}" <${fromAddress}>` : fromAddress;

    try {
      const logoPath = path.join(process.cwd(), 'public', 'brand', 'sandys-gaming-logo.png');
      const attachments =
        message.html.includes('cid:sandys-gaming-logo') && fs.existsSync(logoPath)
          ? [
              {
                filename: 'sandys-gaming-logo.png',
                path: logoPath,
                cid: 'sandys-gaming-logo',
                contentDisposition: 'inline' as const,
              },
            ]
          : undefined;

      const info = await this.transporter.sendMail({
        from: formattedFrom,
        to: message.toName ? `"${message.toName}" <${message.to}>` : message.to,
        replyTo: message.replyTo,
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments,
      });

      return {
        success: true,
        status: 'sent',
        providerMessageId: info.messageId || null,
        error: null,
        isConfigured: true,
        provider: this.name,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'SMTP delivery error';
      return {
        success: false,
        status: 'failed',
        providerMessageId: null,
        error: `${this.name} delivery error: ${msg}`,
        isConfigured: true,
        provider: this.name,
      };
    }
  }
}

/**
 * Factory function to retrieve active email adapter based on server environment.
 * Automatically falls back to UnconfiguredEmailAdapter when credentials are not supplied.
 */
export function getEmailAdapter(): EmailAdapter {
  const provider = (process.env.EMAIL_PROVIDER || 'unconfigured').toLowerCase().trim();
  const defaultFrom = (process.env.EMAIL_FROM_ADDRESS || 'no-reply@sandygamings.com').trim();
  const defaultFromName = (process.env.EMAIL_FROM_NAME || "Sandy's Gaming").trim();

  // SpaceMail / SMTP
  if (provider === 'spacemail' || provider === 'smtp') {
    const host = (process.env.SPACEMAIL_HOST || process.env.SMTP_HOST || 'mail.spacemail.com').trim();
    const port = parseInt(process.env.SPACEMAIL_PORT || process.env.SMTP_PORT || '465', 10);
    const user = (process.env.SPACEMAIL_USER || process.env.SMTP_USER || defaultFrom).trim();
    const pass = (process.env.SPACEMAIL_PASSWORD || process.env.SMTP_PASSWORD || '').trim();

    if (!pass) {
      // Password not yet configured
      return new UnconfiguredEmailAdapter();
    }

    return new SmtpEmailAdapter(
      {
        host,
        port,
        secure: port === 465,
        user,
        pass,
        defaultFrom,
        defaultFromName,
      },
      provider as EmailProviderName
    );
  }

  const apiKey = (process.env.EMAIL_API_KEY || '').trim();

  // If no API key is supplied, we are strictly unconfigured
  if (!apiKey || provider === 'unconfigured' || provider === 'mock') {
    return new UnconfiguredEmailAdapter();
  }

  switch (provider) {
    case 'resend':
      return new ResendEmailAdapter(apiKey, defaultFrom);
    case 'sendgrid':
      return new SendGridEmailAdapter(apiKey, defaultFrom);
    case 'postmark':
      return new PostmarkEmailAdapter(apiKey, defaultFrom);
    default:
      return new UnconfiguredEmailAdapter();
  }
}
