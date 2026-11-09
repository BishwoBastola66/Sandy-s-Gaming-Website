/**
 * Email template generator for Sandy's Gaming transactional emails.
 * Produces clean, full-text, responsive HTML emails with a background brand logo
 * watermark and subtle CSS motion, plus accessible Plaintext versions.
 *
 * The email body has NO forced background color, so it blends seamlessly into the
 * mail client's own surface (white/grey in light mode, black in dark mode).
 * Text colors adapt via `prefers-color-scheme` and Outlook dark-mode selectors.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getLogoSrc(): string {
  const provider = (process.env.EMAIL_PROVIDER || 'spacemail').toLowerCase().trim();
  if (provider === 'spacemail' || provider === 'smtp') {
    return 'cid:sandys-gaming-logo';
  }
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  if (siteUrl && !siteUrl.includes('localhost') && !siteUrl.includes('127.0.0.1')) {
    return `${siteUrl.replace(/\/$/, '')}/brand/sandys-gaming-logo.png`;
  }
  return 'https://sandygamings.vercel.app/brand/sandys-gaming-logo.png';
}

interface EmailShellOptions {
  subject: string;
  headerLabel: string;
  logoSrc: string;
  contentHtml: string;
  footerHtml: string;
}

/**
 * Shared responsive, color-scheme-adaptive email shell.
 */
function renderEmailShell({ subject, headerLabel, logoSrc, contentHtml, footerHtml }: EmailShellOptions): string {
  return `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no, address=no, email=no, date=no">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${escapeHtml(subject)}</title>
  <style>
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    body, table, td { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }

    @keyframes watermarkFloat {
      0%, 100% { transform: translateY(0px) scale(1); opacity: 0.08; }
      50% { transform: translateY(-8px) scale(1.03); opacity: 0.12; }
    }
    @keyframes fadeInContent {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .watermark-logo { animation: watermarkFloat 7s ease-in-out infinite; }
    .email-body-wrap { animation: fadeInContent 0.45s ease-out both; }

    /* ---------- Responsive (mobile) ---------- */
    @media only screen and (max-width: 600px) {
      .outer-pad { padding: 20px 16px 32px 16px !important; }
      .brand-name { font-size: 16px !important; }
      .brand-logo { width: 32px !important; height: 32px !important; }
      .header-label { font-size: 11px !important; }
      .content { font-size: 14px !important; line-height: 1.7 !important; }
      .greeting { font-size: 15px !important; }
      .otp-code { font-size: 26px !important; letter-spacing: 4px !important; }
      .watermark-logo { width: 240px !important; }
      .quote-block { padding: 10px 14px !important; }
    }
    @media only screen and (max-width: 380px) {
      .header-label-cell { display: none !important; }
      .otp-code { font-size: 22px !important; letter-spacing: 3px !important; }
    }

    /* ---------- Dark mode (Apple Mail, iOS, Outlook.com, Outlook app) ---------- */
    @media (prefers-color-scheme: dark) {
      .t-strong { color: #f4f4f5 !important; }
      .t-body { color: #d4d4d8 !important; }
      .t-muted { color: #a1a1aa !important; }
      .b-line { border-color: #27272a !important; }
      .b-accent { border-color: #e8364b !important; }
      .watermark-logo { opacity: 0.06 !important; }
    }
    [data-ogsc] .t-strong { color: #f4f4f5 !important; }
    [data-ogsc] .t-body { color: #d4d4d8 !important; }
    [data-ogsc] .t-muted { color: #a1a1aa !important; }
    [data-ogsb] .b-line { border-color: #27272a !important; }
  </style>
</head>
<body style="margin: 0; padding: 0; width: 100% !important; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
    <tr>
      <td align="center" class="outer-pad" style="padding: 32px 20px 48px 20px;">
        <!--[if mso]><table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
        <div class="email-body-wrap" style="max-width: 640px; width: 100%; margin: 0 auto; text-align: left; position: relative;">

          <!-- Top Brand Header -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="b-line" style="border-bottom: 1px solid #e5e7eb; margin-bottom: 28px;">
            <tr>
              <td valign="middle" style="padding-bottom: 18px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td valign="middle" style="padding-right: 12px;">
                      <img src="${logoSrc}" alt="Sandy's Gaming" width="38" height="38" class="brand-logo" style="display: block; width: 38px; height: 38px; object-fit: contain;" />
                    </td>
                    <td valign="middle">
                      <span class="brand-name t-strong" style="font-size: 18px; font-weight: 800; color: #111827; letter-spacing: -0.02em; white-space: nowrap;">Sandy's Gaming</span>
                    </td>
                  </tr>
                </table>
              </td>
              <td align="right" valign="middle" class="header-label-cell" style="padding-bottom: 18px;">
                <span class="header-label t-muted" style="font-size: 12px; color: #6b7280;">${escapeHtml(headerLabel)}</span>
              </td>
            </tr>
          </table>

          <!-- Background Watermark Logo Layer (Gmail & All-Client Compatible) -->
          <div style="max-height: 0; overflow: visible; text-align: center; pointer-events: none;">
            <img src="${logoSrc}" alt="" width="360" height="360" class="watermark-logo" style="display: inline-block; width: 360px; max-width: 80%; height: auto; opacity: 0.08; margin-top: 12px;" />
          </div>

          <!-- Foreground Full Text Content -->
          <div class="content t-body" style="position: relative; font-size: 15px; line-height: 1.75; color: #1f2937; word-wrap: break-word; overflow-wrap: break-word;">
            ${contentHtml}
          </div>

          <!-- Footer -->
          <div class="b-line t-muted" style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; line-height: 1.6;">
            ${footerHtml}
          </div>

        </div>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export interface InquiryEmailContext {
  recipientName?: string | null;
  inquiryDate: string;
  originalMessage: string;
  responseBody: string;
  staffName: string;
}

export function generateInquiryReplyEmail(context: InquiryEmailContext): {
  subject: string;
  html: string;
  text: string;
} {
  const greeting = context.recipientName ? `Hi ${escapeHtml(context.recipientName)},` : 'Hello,';
  const subject = `Re: Your Inquiry to Sandy's Gaming`;
  const logoSrc = getLogoSrc();

  const safeResponseBody = escapeHtml(context.responseBody).replace(/\n/g, '<br />');
  const safeOriginalMessage = escapeHtml(context.originalMessage).replace(/\n/g, '<br />');
  const safeStaffName = escapeHtml(context.staffName);

  const contentHtml = `
            <p class="greeting t-strong" style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #111827;">${greeting}</p>
            <p style="margin: 0 0 20px 0;">
              Thank you for contacting Sandy's Gaming. Our support team has reviewed your inquiry and prepared the following response for you:
            </p>

            <div class="quote-block b-accent t-strong" style="border-left: 3px solid #111827; padding: 12px 20px; margin: 24px 0; font-size: inherit; line-height: inherit; color: #111827;">
              ${safeResponseBody}
            </div>

            <p style="margin: 24px 0 0 0;">
              If you have any additional questions or need further assistance, simply reply to this email or reach out through our live support portal.
            </p>

            <p class="t-strong" style="margin: 24px 0 0 0; color: #111827;">
              Warm regards,<br />
              <strong>${safeStaffName}</strong><br />
              <span class="t-muted" style="font-size: 13px; color: #4b5563;">Sandy's Gaming Support Team</span>
            </p>

            <div class="b-line t-muted" style="margin-top: 36px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 13px; color: #6b7280;">
              <p class="t-body" style="margin: 0 0 6px 0; font-weight: 600; color: #374151;">Your Original Inquiry (${escapeHtml(context.inquiryDate)}):</p>
              <p class="t-muted" style="margin: 0; font-style: italic; color: #4b5563;">"${safeOriginalMessage}"</p>
            </div>`;

  const footerHtml = `
            <p style="margin: 0;">&copy; ${new Date().getFullYear()} Sandy's Gaming (<a href="https://sandygamings.com" class="t-strong" style="color: #111827; text-decoration: none;">sandygamings.com</a>). All rights reserved.</p>`;

  const html = renderEmailShell({
    subject,
    headerLabel: 'Support Operations',
    logoSrc,
    contentHtml,
    footerHtml,
  });

  const text = `
Sandy's Gaming

${context.recipientName ? `Hi ${context.recipientName},` : 'Hello,'}

Thank you for contacting Sandy's Gaming. Our support team has reviewed your inquiry and prepared the following response for you:

--------------------------------------------------
${context.responseBody}
--------------------------------------------------

If you have any additional questions or need further assistance, simply reply to this email or reach out through our live support portal.

Warm regards,
${context.staffName}
Sandy's Gaming Support Team

==================================================
Your Original Inquiry (${context.inquiryDate}):
"${context.originalMessage}"
==================================================

© ${new Date().getFullYear()} Sandy's Gaming (https://sandygamings.com)
  `.trim();

  return { subject, html, text };
}

export interface VerificationOtpEmailContext {
  recipientName?: string | null;
  otpCode: string;
  expiresInMinutes?: number;
}

export function generateVerificationOtpEmail(context: VerificationOtpEmailContext): {
  subject: string;
  html: string;
  text: string;
} {
  const greeting = context.recipientName ? `Hi ${escapeHtml(context.recipientName)},` : 'Hello,';
  const subject = `${context.otpCode} is your Sandy's Gaming verification code`;
  const minutes = context.expiresInMinutes || 10;
  const logoSrc = getLogoSrc();
  const formattedCode = escapeHtml(context.otpCode).split('').join(' ');

  const contentHtml = `
            <p class="greeting t-strong" style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #111827;">${greeting}</p>

            <p style="margin: 0 0 18px 0;">
              Thank you for registering with <strong class="t-strong">Sandy's Gaming</strong>. To verify ownership of your email address and finish setting up your account, please enter the 6-digit verification code below on the sign-up screen:
            </p>

            <!-- Clean Transparent Verification Code Display (Watermark Visible Behind) -->
            <div class="b-line" style="margin: 26px 0; padding: 18px 0; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; text-align: left;">
              <div class="t-muted" style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 6px;">
                Verification Passcode
              </div>
              <div class="otp-code t-strong" style="font-family: 'SF Mono', Consolas, Monaco, 'Courier New', monospace; font-size: 32px; font-weight: 800; color: #111827; letter-spacing: 6px; white-space: nowrap;">
                ${formattedCode}
              </div>
              <div class="t-muted" style="font-size: 12px; color: #6b7280; margin-top: 6px;">
                Valid for ${minutes} minutes
              </div>
            </div>

            <p style="margin: 0 0 16px 0;">
              For your security, please do not share this passcode with anyone. Sandy's Gaming staff will never ask you for your verification code or password via email or live chat.
            </p>

            <p class="t-muted" style="margin: 0 0 24px 0; color: #4b5563;">
              If you did not request this verification code, no further action is needed—you can safely disregard this email and your address will not be registered.
            </p>

            <p class="t-strong" style="margin: 0; color: #111827;">
              Warm regards,<br />
              <strong>The Sandy's Gaming Team</strong><br />
              <a href="https://sandygamings.com" class="t-muted" style="font-size: 13px; color: #4b5563; text-decoration: none;">sandygamings.com</a>
            </p>`;

  const footerHtml = `
            <p style="margin: 0;">&copy; ${new Date().getFullYear()} Sandy's Gaming. All rights reserved.</p>
            <p style="margin: 4px 0 0 0;">This is an automated security notification regarding your account registration.</p>`;

  const html = renderEmailShell({
    subject,
    headerLabel: 'Account Verification',
    logoSrc,
    contentHtml,
    footerHtml,
  });

  const text = `
Sandy's Gaming — Account Verification

${context.recipientName ? `Hi ${context.recipientName},` : 'Hello,'}

Thank you for registering with Sandy's Gaming. To verify ownership of your email address and finish setting up your account, please enter the 6-digit verification code below on the sign-up screen:

Verification Passcode: ${context.otpCode}
(Valid for ${minutes} minutes)

For your security, please do not share this passcode with anyone. Sandy's Gaming staff will never ask you for your verification code or password.

If you did not request this verification code, you can safely disregard this email.

Warm regards,
The Sandy's Gaming Team
https://sandygamings.com
  `.trim();

  return { subject, html, text };
}
