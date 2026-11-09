import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { hashPassword } from '@/lib/auth/session';
import { getEmailAdapter } from '@/lib/email/adapter';
import { generateVerificationOtpEmail } from '@/lib/email/template';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';

  const rateCheck = checkRateLimit(`auth-register:${ip}`, 5, 60 * 1000);
  if (!rateCheck.success) {
    const retrySec = Math.ceil((rateCheck.reset - Date.now()) / 1000);
    return NextResponse.json(
      { error: `Too many registration requests. Please wait ${retrySec} seconds.` },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { email, password, displayName } = body;

    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanPassword = typeof password === 'string' ? password : '';
    const cleanDisplayName = typeof displayName === 'string' ? displayName.trim() : '';

    if (!cleanDisplayName || cleanDisplayName.length < 2 || cleanDisplayName.length > 50) {
      return NextResponse.json(
        { error: 'Display name must be between 2 and 50 characters.' },
        { status: 400 }
      );
    }

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    if (!cleanPassword || cleanPassword.length < 6 || cleanPassword.length > 128) {
      return NextResponse.json(
        { error: 'Password must be between 6 and 128 characters long.' },
        { status: 400 }
      );
    }

    const adminClient = await createAdminClient();

    const { data: existingAccount } = await adminClient
      .from('accounts')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existingAccount) {
      return NextResponse.json(
        { error: 'An account with this email address already exists. Please sign in.' },
        { status: 400 }
      );
    }

    const passwordHash = hashPassword(cleanPassword);
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: otpError } = await adminClient
      .from('account_otps')
      .upsert(
        {
          email: cleanEmail,
          otp_code: otpCode,
          purpose: 'registration',
          payload: {
            displayName: cleanDisplayName,
            passwordHash,
          },
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'email,purpose' }
      );

    if (otpError) {
      console.error('Failed to record registration OTP:', otpError);
      return NextResponse.json(
        { error: 'Failed to generate verification code. Please try again.' },
        { status: 500 }
      );
    }

    try {
      const emailAdapter = getEmailAdapter();
      const emailContent = generateVerificationOtpEmail({
        recipientName: cleanDisplayName,
        otpCode,
        expiresInMinutes: 10,
      });

      const emailResult = await emailAdapter.send({
        to: cleanEmail,
        toName: cleanDisplayName,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });

      if (!emailResult.success) {
        console.warn('Live email dispatch was unconfigured or failed:', emailResult.error);
      }
    } catch (err: unknown) {
      console.error('Email sending exception:', err);
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`[AUTH OTP] Dev verification code for ${cleanEmail}: ${otpCode}`);
    }

    return NextResponse.json(
      {
        success: true,
        requiresOtp: true,
        email: cleanEmail,
        message: 'A 6-digit verification code has been sent to your email.',
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal registration error';
    console.error('Registration exception:', err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
