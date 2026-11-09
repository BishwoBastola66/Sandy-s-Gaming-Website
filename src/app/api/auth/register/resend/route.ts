import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { getEmailAdapter } from '@/lib/email/adapter';
import { generateVerificationOtpEmail } from '@/lib/email/template';
import { checkRateLimit } from '@/lib/rate-limit';

interface RegistrationPayload {
  displayName?: string;
  passwordHash?: string;
}

export async function POST(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';

  const rateCheck = checkRateLimit(`auth-resend-otp:${ip}`, 4, 60 * 1000);
  if (!rateCheck.success) {
    const retrySec = Math.ceil((rateCheck.reset - Date.now()) / 1000);
    return NextResponse.json(
      { error: `Please wait ${retrySec} seconds before requesting another code.` },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { email } = body;

    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email address is required.' },
        { status: 400 }
      );
    }

    const adminClient = await createAdminClient();

    const { data: existingOtp, error: fetchError } = await adminClient
      .from('account_otps')
      .select('*')
      .eq('email', cleanEmail)
      .eq('purpose', 'registration')
      .maybeSingle();

    if (fetchError || !existingOtp) {
      return NextResponse.json(
        { error: 'No pending registration found for this email. Please register again.' },
        { status: 400 }
      );
    }

    const newOtpCode = crypto.randomInt(100000, 999999).toString();
    const newExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: updateError } = await adminClient
      .from('account_otps')
      .update({
        otp_code: newOtpCode,
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingOtp.id);

    if (updateError) {
      console.error('Failed to update registration OTP:', updateError);
      return NextResponse.json(
        { error: 'Failed to generate new verification code. Please try again.' },
        { status: 500 }
      );
    }

    const payload = (existingOtp.payload as unknown as RegistrationPayload) || {};
    try {
      const emailAdapter = getEmailAdapter();
      const emailContent = generateVerificationOtpEmail({
        recipientName: payload.displayName || 'Gamer',
        otpCode: newOtpCode,
        expiresInMinutes: 10,
      });

      const emailResult = await emailAdapter.send({
        to: cleanEmail,
        toName: payload.displayName || 'Gamer',
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });

      if (!emailResult.success) {
        console.warn('Resend email dispatch was unconfigured or failed:', emailResult.error);
      }
    } catch (err: unknown) {
      console.error('Email resend exception:', err);
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`[AUTH OTP] Dev resent verification code for ${cleanEmail}: ${newOtpCode}`);
    }

    return NextResponse.json({
      success: true,
      message: 'A new 6-digit verification code has been sent to your email.',
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal resend error';
    console.error('OTP resend exception:', err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
