import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyPassword, createSession } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';

  const rateCheck = checkRateLimit(`auth-login:${ip}`, 10, 60 * 1000);
  if (!rateCheck.success) {
    const retrySec = Math.ceil((rateCheck.reset - Date.now()) / 1000);
    return NextResponse.json(
      { error: `Too many sign-in attempts. Please wait ${retrySec} seconds before trying again.` },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { email, password, token, credential, googleToken } = body;

    const oauthToken = token || credential || googleToken;

    if (oauthToken) {
      const googleAuthUrl = new URL('/api/auth/google', req.url);
      const googleRes = await fetch(googleAuthUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: oauthToken }),
      });
      const googleData = await googleRes.json();
      return NextResponse.json(googleData, { status: googleRes.status });
    }

    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanPassword = typeof password === 'string' ? password : '';

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }
    if (!cleanPassword) {
      return NextResponse.json({ error: 'Please enter your password.' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    const { data: account, error } = await adminClient
      .from('accounts')
      .select('id, email, display_name, role, account_status, password_hash')
      .eq('email', cleanEmail)
      .maybeSingle();

    const userAgent = req.headers.get('user-agent') || undefined;

    if (!error && account) {
      if (account.account_status === 'suspended') {
        return NextResponse.json(
          { error: 'Your account is suspended. Please contact customer support.', suspended: true },
          { status: 403 }
        );
      }

      if (!account.password_hash) {
        return NextResponse.json(
          { error: 'This account is linked with Google. Please use Continue with Google to sign in.' },
          { status: 400 }
        );
      }

      const isValid = verifyPassword(cleanPassword, account.password_hash);
      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid email or password. Please verify your credentials.' },
          { status: 401 }
        );
      }

      await createSession(account.id, { ip, userAgent });

      return NextResponse.json({
        success: true,
        message: 'Signed in successfully.',
        account: {
          id: account.id,
          email: account.email,
          display_name: account.display_name,
          role: account.role,
          account_status: account.account_status,
        },
      });
    }

    return NextResponse.json(
      { error: 'Invalid email or password. Please verify your credentials.' },
      { status: 401 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Authentication failed';
    console.error('Login error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
