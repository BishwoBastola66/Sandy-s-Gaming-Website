import { NextResponse, type NextRequest } from 'next/server';
import { aj } from '@/lib/arcjet';

interface CachedSession {
  role: 'customer' | 'admin' | 'super_admin';
  accountStatus: 'active' | 'suspended' | 'pending';
  expiresAt: number;
  cachedAt: number;
}

// In-memory cache to memoize session validations and protect against DB hammering
const sessionCache = new Map<string, CachedSession>();
const CACHE_TTL_MS = 20_000; // 20 seconds cache TTL

function redirectToLogin(request: NextRequest, pathname: string, reason?: string) {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', pathname);
  if (reason) {
    loginUrl.searchParams.set('error', reason);
  }
  const response = NextResponse.redirect(loginUrl);
  // Remove expired or invalid session cookie
  response.cookies.delete('sandy_session');
  return response;
}

export async function proxy(request: NextRequest) {
  // 1. Arcjet Bot & Attack Shield Verification (if ARCJET_KEY is configured)
  if (aj) {
    try {
      const decision = await aj.protect(request);
      if (decision.isDenied()) {
        if (decision.reason.isRateLimit()) {
          return NextResponse.json(
            { error: 'Too many requests. Please slow down.' },
            { status: 429 }
          );
        }
        if (decision.reason.isBot()) {
          return NextResponse.json(
            { error: 'Automated bot access is forbidden.' },
            { status: 403 }
          );
        }
        return NextResponse.json(
          { error: 'Access denied by security shield.' },
          { status: 403 }
        );
      }
    } catch (arcjetErr) {
      // Arcjet is fail-open by design to prevent downtime if external API is unreachable
      console.warn('Arcjet protection bypass on error:', arcjetErr);
    }
  }

  const { pathname } = request.nextUrl;

  // Route classification
  const isSuperAdminRoute = pathname === '/super-admin' || pathname.startsWith('/super-admin/');
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/');
  const isCustomerRoute =
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/account' ||
    pathname.startsWith('/account/') ||
    pathname === '/chat' ||
    pathname.startsWith('/chat/');
  const isAuthPage = pathname === '/login' || pathname === '/register';

  const isProtectedRoute = isSuperAdminRoute || isAdminRoute || isCustomerRoute;

  // Read database session cookie
  const sessionToken = request.cookies.get('sandy_session')?.value;

  // 1. Unauthenticated fast-path rejection for protected routes
  if (isProtectedRoute && !sessionToken) {
    return redirectToLogin(request, pathname);
  }

  // 2. If it is a public route and not an auth page, allow through immediately
  if (!isProtectedRoute && !isAuthPage) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  // 3. Validate Database Session ('sandy_session') against public.sessions
  if (sessionToken && supabaseUrl && serviceRoleKey) {
    try {
      let sessionData: CachedSession | null = null;

      // Check in-memory validation cache
      const cached = sessionCache.get(sessionToken);
      if (
        cached &&
        Date.now() - cached.cachedAt < CACHE_TTL_MS &&
        cached.expiresAt > Date.now()
      ) {
        sessionData = cached;
      } else {
        // Query PostgreSQL via Supabase REST
        const queryUrl = `${supabaseUrl}/rest/v1/sessions?select=id,expires_at,account_id,accounts(id,role,account_status)&session_token=eq.${encodeURIComponent(sessionToken)}&limit=1`;
        const res = await fetch(queryUrl, {
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            Accept: 'application/json',
          },
          cache: 'no-store',
        });

        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows) && rows.length > 0) {
            const row = rows[0];
            const expiresAt = new Date(row.expires_at).getTime();

            if (expiresAt > Date.now()) {
              const rawAccount = Array.isArray(row.accounts) ? row.accounts[0] : row.accounts;
              if (rawAccount) {
                sessionData = {
                  role: rawAccount.role,
                  accountStatus: rawAccount.account_status,
                  expiresAt,
                  cachedAt: Date.now(),
                };
                sessionCache.set(sessionToken, sessionData);
              }
            }
          }
        }
      }

      // If session is valid in database
      if (sessionData) {
        // Check account suspension
        if (sessionData.accountStatus === 'suspended') {
          return NextResponse.redirect(new URL('/suspended', request.url));
        }

        // If on login/register page and already authenticated, redirect to appropriate dashboard
        if (isAuthPage) {
          const target =
            sessionData.role === 'super_admin'
              ? '/super-admin'
              : sessionData.role === 'admin'
              ? '/admin'
              : '/dashboard';
          return NextResponse.redirect(new URL(target, request.url));
        }

        // Strict role authorization enforcement
        if (isSuperAdminRoute && sessionData.role !== 'super_admin') {
          return NextResponse.redirect(new URL('/unauthorized', request.url));
        }

        if (isAdminRoute && sessionData.role !== 'admin') {
          return NextResponse.redirect(new URL('/unauthorized', request.url));
        }

        if (isCustomerRoute && sessionData.role !== 'customer') {
          const target = sessionData.role === 'super_admin' ? '/super-admin' : '/admin';
          return NextResponse.redirect(new URL(target, request.url));
        }

        // Access granted for protected route: set strict no-cache headers
        const response = NextResponse.next();
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');
        return response;
      } else {
        // Session token was invalid or expired in database
        sessionCache.delete(sessionToken);
        if (isProtectedRoute) {
          return redirectToLogin(request, pathname, 'Session expired. Please log in again.');
        }
      }
    } catch (err: unknown) {
      console.error('Proxy session validation error:', err);
      // For protected routes, fail-safe by redirecting to login rather than allowing access
      if (isProtectedRoute) {
        return redirectToLogin(request, pathname);
      }
    }
  }

  // If this was a protected route and no valid session was proven, redirect to login
  if (isProtectedRoute) {
    return redirectToLogin(request, pathname);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt, manifest.webmanifest (SEO & metadata files)
     * - public asset extensions (.svg, .png, .jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|mp4|css|js)$).*)',
  ],
};
