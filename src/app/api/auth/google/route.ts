import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createSession } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { sanitizeErrorMessage } from '@/lib/validation/error-sanitizer';

export async function POST(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';

  const rateCheck = checkRateLimit(`auth-google:${ip}`, 15, 60 * 1000);
  if (!rateCheck.success) {
    return NextResponse.json(
      { error: 'Too many authentication attempts. Please wait a minute and try again.' },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const googleToken = body?.token || body?.credential || body?.googleToken;

    if (!googleToken || typeof googleToken !== 'string') {
      return NextResponse.json(
        { error: 'A valid Google authentication token is required.' },
        { status: 400 }
      );
    }

    const expectedClientId =
      process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    let providerId = '';
    let email = '';
    let displayName = 'User';

    // 1. Cryptographically verify ID token or access token directly with Google
    const idTokenRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(googleToken)}`
    );

    if (idTokenRes.ok) {
      const verifiedData = await idTokenRes.json();
      if (
        expectedClientId &&
        verifiedData.aud &&
        verifiedData.aud !== expectedClientId
      ) {
        return NextResponse.json(
          { error: 'Google token audience mismatch.' },
          { status: 401 }
        );
      }
      if (
        verifiedData.email_verified !== 'true' &&
        verifiedData.email_verified !== true
      ) {
        return NextResponse.json(
          { error: 'Google account email is not verified.' },
          { status: 401 }
        );
      }
      providerId = verifiedData.sub || '';
      email = verifiedData.email || '';
      displayName = verifiedData.name || email.split('@')[0] || 'User';
    } else {
      // Check if caller passed a valid OAuth2 access_token
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${googleToken}` },
      });
      if (!userInfoRes.ok) {
        return NextResponse.json(
          { error: 'Invalid or expired Google authentication token.' },
          { status: 401 }
        );
      }
      const userInfo = await userInfoRes.json();
      if (!userInfo.email_verified) {
        return NextResponse.json(
          { error: 'Google account email is not verified.' },
          { status: 401 }
        );
      }
      providerId = userInfo.sub || '';
      email = userInfo.email || '';
      displayName = userInfo.name || email.split('@')[0] || 'User';
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !providerId) {
      return NextResponse.json(
        { error: 'Unable to verify Google account identity.' },
        { status: 401 }
      );
    }

    const provider = 'google';
    const adminClient = await createAdminClient();

    // 2. Lookup existing account by (provider, provider_id) OR by verified email in public.accounts
    let account = null;

    const { data: byProvider } = await adminClient
      .from('accounts')
      .select('id, email, display_name, role, account_status, provider, provider_id')
      .eq('provider', provider)
      .eq('provider_id', providerId)
      .maybeSingle();

    if (byProvider) {
      account = byProvider;
    } else {
      const { data: byEmail } = await adminClient
        .from('accounts')
        .select('id, email, display_name, role, account_status, provider, provider_id')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (byEmail) {
        account = byEmail;
        if (!byEmail.provider_id) {
          await adminClient
            .from('accounts')
            .update({
              provider,
              provider_id: providerId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', byEmail.id);
        }
      }
    }

    // 3. Create new customer account if not found
    if (!account) {
      const { data: newAccount, error: insertError } = await adminClient
        .from('accounts')
        .insert({
          email: cleanEmail,
          display_name: displayName,
          provider,
          provider_id: providerId,
          role: 'customer',
          account_status: 'active',
        })
        .select('id, email, display_name, role, account_status, provider, provider_id')
        .single();

      if (insertError || !newAccount) {
        console.error('Failed to create account with Google provider:', insertError);
        return NextResponse.json(
          { error: 'Failed to create account. Please try again.' },
          { status: 500 }
        );
      }
      account = newAccount;
    }

    // 4. Check suspension
    if (account.account_status === 'suspended') {
      return NextResponse.json(
        { error: 'Your account is suspended. Please contact customer support.', suspended: true },
        { status: 403 }
      );
    }

    // 5. Create persistent database session
    const userAgent = req.headers.get('user-agent') || undefined;
    await createSession(account.id, { ip, userAgent });

    const dest =
      account.role === 'super_admin'
        ? '/super-admin'
        : account.role === 'admin'
        ? '/admin'
        : '/dashboard';

    return NextResponse.json({
      success: true,
      message: 'Signed in successfully with Google.',
      destination: dest,
      account: {
        id: account.id,
        email: account.email,
        display_name: account.display_name,
        role: account.role,
        provider: account.provider,
        provider_id: account.provider_id,
        account_status: account.account_status,
      },
    });
  } catch (err: unknown) {
    console.error('Google auth route error:', err);
    return NextResponse.json(
      { error: sanitizeErrorMessage(err, 'Unable to sign in with Google right now.') },
      { status: 500 }
    );
  }
}
