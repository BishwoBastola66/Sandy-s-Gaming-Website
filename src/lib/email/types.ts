export type EmailProviderName =
  | 'resend'
  | 'sendgrid'
  | 'postmark'
  | 'spacemail'
  | 'smtp'
  | 'unconfigured';

export type EmailDeliveryStatus =
  | 'pending'
  | 'queued'
  | 'accepted'
  | 'sent'
  | 'delivered'
  | 'bounced'
  | 'failed';

export interface EmailMessage {
  to: string;
  toName?: string | null;
  from?: string;
  fromName?: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  idempotencyKey?: string;
}

export interface EmailSendResult {
  success: boolean;
  status: EmailDeliveryStatus;
  providerMessageId?: string | null;
  error?: string | null;
  isConfigured: boolean;
  provider: string;
}

export interface EmailAdapter {
  readonly name: EmailProviderName;
  readonly isConfigured: boolean;
  send(message: EmailMessage): Promise<EmailSendResult>;
}
