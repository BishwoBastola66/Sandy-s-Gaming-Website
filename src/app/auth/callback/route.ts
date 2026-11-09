import { createAdminClient } from '@/lib/supabase/server';
import { createSession, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/lib/auth/session';
import { NextResponse, type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const redirectTarget = state || searchParams.get('redirect') || '';

  if (code) {
    const adminClient = await createAdminClient();
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    let cleanEmail = '';
    let displayName = 'User';
    let provider = 'google';
    let providerId = '';

    // 1. Attempt Direct Google OAuth Code Exchange
    if (clientId && clientSecret) {
      try {
        const redirectUri =
          process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI || `${origin}/auth/callback`;

        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }),
        });

        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          if (tokenData.access_token) {
            const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${tokenData.access_token}` },
            });
            if (userRes.ok) {
              const googleUser = await userRes.json();
              if (googleUser.email) {
                cleanEmail = googleUser.email.trim().toLowerCase();
                displayName = googleUser.name || cleanEmail.split('@')[0] || 'User';
                provider = 'google';
                providerId = googleUser.sub || '';
              }
            }
          }
        }
      } catch (googleErr) {
        console.warn('Direct Google token exchange fallback:', googleErr);
      }
    }

    if (cleanEmail) {
      // 2. Fetch or create user account in public.accounts
      const { data: existingAccount } = await adminClient
        .from('accounts')
        .select('id, role, account_status, provider, provider_id')
        .eq('email', cleanEmail)
        .maybeSingle();

      let accountId = existingAccount?.id;
      let role = existingAccount?.role || 'customer';
      let accountStatus = existingAccount?.account_status || 'active';

      if (!existingAccount) {
        const { data: newAccount } = await adminClient
          .from('accounts')
          .insert({
            email: cleanEmail,
            display_name: displayName,
            provider,
            provider_id: providerId || code.slice(0, 32),
            role: 'customer',
            account_status: 'active',
          })
          .select('id, role, account_status')
          .single();

        if (newAccount) {
          accountId = newAccount.id;
          role = newAccount.role;
          accountStatus = newAccount.account_status;
        }
      } else if (!existingAccount.provider_id && providerId) {
        await adminClient
          .from('accounts')
          .update({
            provider,
            provider_id: providerId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingAccount.id);
      }

      if (accountStatus === 'suspended') {
        return NextResponse.redirect(`${origin}/suspended`);
      }

      let sessionToken: string | null = null;
      if (accountId) {
        // 3. Create persistent custom session
        const forwarded = request.headers.get('x-forwarded-for');
        const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
        const userAgent = request.headers.get('user-agent') || undefined;
        sessionToken = await createSession(accountId, { ip, userAgent });
      }

      // 6. Resolve destination based on user role (with open-redirect protection)
      let dest = redirectTarget;
      if (
        !dest ||
        !dest.startsWith('/') ||
        dest.startsWith('//') ||
        dest === '/dashboard' ||
        dest === '/dashboard/chat' ||
        dest === '/dashboard/tickets'
      ) {
        dest =
          role === 'super_admin'
            ? '/super-admin'
            : role === 'admin'
            ? '/admin'
            : '/dashboard';
      }

      const redirectUrl = new URL(dest, origin);
      const response = NextResponse.redirect(redirectUrl);

      if (sessionToken) {
        response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: SESSION_MAX_AGE_SECONDS,
        });
      }

      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Could%20not%20authenticate%20with%20Google`);
}

