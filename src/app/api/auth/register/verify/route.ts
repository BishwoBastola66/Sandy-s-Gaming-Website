import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { createSession } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { sanitizeErrorMessage } from '@/lib/validation/error-sanitizer';

interface RegistrationPayload {
  displayName?: string;
  passwordHash?: string;
}

export async function POST(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';

  const rateCheck = checkRateLimit(`auth-verify-otp:${ip}`, 10, 60 * 1000);
  if (!rateCheck.success) {
    const retrySec = Math.ceil((rateCheck.reset - Date.now()) / 1000);
    return NextResponse.json(
      { error: `Too many verification attempts. Please wait ${retrySec} seconds.` },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { email, otp } = body;

    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanOtp = typeof otp === 'string' ? otp.trim() : '';

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email address is required.' },
        { status: 400 }
      );
    }

    if (!/^\d{6}$/.test(cleanOtp)) {
      return NextResponse.json(
        { error: 'Please enter a valid 6-digit verification code.' },
        { status: 400 }
      );
    }

    const adminClient = await createAdminClient();

    const { data: otpRecord, error: otpFetchError } = await adminClient
      .from('account_otps')
      .select('*')
      .eq('email', cleanEmail)
      .eq('purpose', 'registration')
      .maybeSingle();

    if (otpFetchError || !otpRecord) {
      return NextResponse.json(
        { error: 'No pending registration found for this email. Please register again.' },
        { status: 400 }
      );
    }

    const expiresAt = new Date(otpRecord.expires_at).getTime();
    if (expiresAt < Date.now()) {
      return NextResponse.json(
        { error: 'Verification code has expired. Please request a new code.' },
        { status: 400 }
      );
    }

    const expectedBuf = Buffer.from(String(otpRecord.otp_code));
    const providedBuf = Buffer.from(cleanOtp);
    const otpMatches =
      expectedBuf.length === providedBuf.length &&
      crypto.timingSafeEqual(expectedBuf, providedBuf);

    if (!otpMatches) {
      return NextResponse.json(
        { error: 'Invalid verification passcode. Please check your email and try again.' },
        { status: 400 }
      );
    }

    const payload = (otpRecord.payload as unknown as RegistrationPayload) || {};
    const { displayName, passwordHash } = payload;

    if (!passwordHash) {
      return NextResponse.json(
        { error: 'Registration payload is corrupted. Please register again.' },
        { status: 400 }
      );
    }

    const { data: existingAccount } = await adminClient
      .from('accounts')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existingAccount) {
      await adminClient.from('account_otps').delete().eq('id', otpRecord.id);
      return NextResponse.json(
        { error: 'An account with this email address already exists. Please sign in.' },
        { status: 400 }
      );
    }

    await adminClient.from('account_otps').delete().eq('id', otpRecord.id);

    const { data: newAccount, error: insertError } = await adminClient
      .from('accounts')
      .insert({
        email: cleanEmail,
        password_hash: passwordHash,
        display_name: displayName || 'User',
        role: 'customer',
        account_status: 'active',
        provider: 'email',
      })
      .select('id, email, display_name, role, account_status')
      .single();

    if (insertError || !newAccount) {
      console.error('Failed to create account:', insertError);
      return NextResponse.json(
        { error: sanitizeErrorMessage(insertError, 'Unable to complete account creation right now. Please try again or contact support.') },
        { status: 500 }
      );
    }

    const userAgent = req.headers.get('user-agent') || undefined;
    await createSession(newAccount.id, { ip, userAgent });

    return NextResponse.json(
      {
        success: true,
        message: 'Account verified and created successfully.',
        account: newAccount,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error('OTP verification exception:', err);
    return NextResponse.json(
      { error: sanitizeErrorMessage(err, 'Unable to verify passcode right now. Please try again.') },
      { status: 500 }
    );
  }
}
