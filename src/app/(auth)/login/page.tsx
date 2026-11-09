'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Script from 'next/script';
import { Mail, Lock, ArrowRight, AlertCircle, CheckCircle2, Loader2, Eye, EyeOff } from 'lucide-react';
import { ThunderboltBackground } from '@/components/auth/ThunderboltBackground';
import { GoogleIcon } from '@/components/auth/GoogleIcon';
import { sanitizeErrorMessage } from '@/lib/validation/error-sanitizer';

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleOAuth2Client {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    prompt?: string;
    callback: (response: GoogleTokenResponse) => void;
    error_callback?: (error: { type?: string; message?: string }) => void;
  }) => {
    requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
  };
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: GoogleOAuth2Client;
      };
    };
  }
}

function ensureGoogleScriptLoaded(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.accounts?.oauth2) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      if (window.google?.accounts?.oauth2) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Sign-In script.')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Sign-In script.'));
    document.head.appendChild(script);
  });
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get('redirect') || '';
  const initialError = searchParams.get('error') || null;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(initialError);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleGoogleTokenAuth = useCallback(async (token: string) => {
    setErrorMsg(null);
    setGoogleLoading(true);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.suspended) {
          router.push('/suspended');
          return;
        }
        throw new Error(data.error || 'Failed to authenticate with Google.');
      }
      const role = data.account?.role;
      let dest = redirectTarget;
      if (!dest || dest === '/dashboard' || dest === '/dashboard/chat' || dest === '/dashboard/tickets' || dest === '/login' || dest === '/register') {
        dest =
          role === 'super_admin'
            ? '/super-admin'
            : role === 'admin'
            ? '/admin'
            : data.destination || '/dashboard';
      }
      window.location.href = dest;
    } catch (err: unknown) {
      setErrorMsg(sanitizeErrorMessage(err, 'Failed to authenticate with Google.'));
    } finally {
      setGoogleLoading(false);
    }
  }, [redirectTarget, router]);

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setGoogleLoading(true);
    try {
      const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (!googleClientId) {
        throw new Error('Google Sign-In is not configured.');
      }

      // Google OAuth blocks raw private IP origins (127.0.0.1 / 192.168.x.x); normalize to localhost
      if (
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.startsWith('192.168.') ||
        window.location.hostname.startsWith('10.')
      ) {
        const port = window.location.port ? `:${window.location.port}` : '';
        const targetOrigin = `${window.location.protocol}//localhost${port}`;
        window.location.replace(`${targetOrigin}${window.location.pathname}${window.location.search}`);
        return;
      }

      await ensureGoogleScriptLoaded();

      if (window.google?.accounts?.oauth2) {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: googleClientId,
          scope: 'openid email profile',
          prompt: 'select_account',
          callback: (tokenResponse) => {
            if (tokenResponse.error) {
              setErrorMsg(
                sanitizeErrorMessage(
                  tokenResponse.error_description || tokenResponse.error,
                  'Google sign-in could not be completed.'
                )
              );
              setGoogleLoading(false);
              return;
            }
            if (tokenResponse.access_token) {
              void handleGoogleTokenAuth(tokenResponse.access_token);
            } else {
              setGoogleLoading(false);
            }
          },
          error_callback: (err) => {
            if (err?.type === 'popup_closed') {
              setGoogleLoading(false);
              return;
            }
            setErrorMsg('Google sign-in window was closed or blocked by the browser.');
            setGoogleLoading(false);
          },
        });

        tokenClient.requestAccessToken({ prompt: 'select_account' });
        return;
      }

      // Fallback to standard redirect flow if GSI popup is unavailable
      const redirectUri = encodeURIComponent(
        process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI || `${window.location.origin}/auth/callback`
      );
      const scope = encodeURIComponent('openid email profile');
      const state = encodeURIComponent(redirectTarget || '/dashboard');
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}&prompt=select_account`;
    } catch (err: unknown) {
      setErrorMsg(sanitizeErrorMessage(err, 'Failed to connect with Google.'));
      setGoogleLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as unknown as { onGoogleTokenReceived?: (token: string) => void }).onGoogleTokenReceived = handleGoogleTokenAuth;
    }
  }, [handleGoogleTokenAuth]);


  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.suspended) {
          router.push('/suspended');
          return;
        }
        throw new Error(data.error || 'Failed to sign in. Please verify your credentials.');
      }

      const role = data.account?.role;
      let dest = redirectTarget;
      // If no explicit redirect or redirecting to generic dashboard routes, route directly to the role workspace
      if (!dest || dest === '/dashboard' || dest === '/dashboard/chat' || dest === '/dashboard/tickets' || dest === '/login' || dest === '/register') {
        dest =
          role === 'super_admin'
            ? '/super-admin'
            : role === 'admin'
            ? '/admin'
            : '/dashboard';
      }
      window.location.href = dest;
    } catch (err: unknown) {
      setErrorMsg(sanitizeErrorMessage(err, 'Failed to sign in. Please try again.'));
      setLoading(false);
    }
  };

  return (
    <div className="relative isolate min-h-[90vh] flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8 overflow-hidden">
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      {/* 1. Three.js Thunderbolt Background Canvas */}
      <ThunderboltBackground className="z-0" />

      {/* 2. Watermark Brand Logo positioned behind the form - Epic Scale */}
      <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center select-none overflow-hidden">
        <div className="relative w-[500px] h-[500px] sm:w-[760px] sm:h-[760px] lg:w-[960px] lg:h-[960px] xl:w-[1100px] xl:h-[1100px] opacity-40 filter drop-shadow-[0_0_120px_rgba(232,54,75,0.45)]">
          <Image
            src="/brand/sandys-gaming-logo.png"
            alt="Sandy's Gaming"
            fill
            sizes="(max-width: 768px) 500px, (max-width: 1200px) 760px, 1100px"
            className="object-contain"
            priority
          />
        </div>
      </div>

      {/* 3. Foreground Form (Big & Nice floating form with clean sizing) */}
      <div className="relative z-10 w-full max-w-[460px] space-y-6">
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
            Sign In
          </h1>
          <p className="mt-2 text-sm sm:text-base text-[var(--text-secondary)]">
            Enter your credentials to access your account.
          </p>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-950/60 backdrop-blur-md p-3.5 text-sm text-red-300">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
            <span className="font-medium leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-950/60 backdrop-blur-md p-3.5 text-sm text-emerald-300">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
            <span className="font-medium leading-relaxed">{successMsg}</span>
          </div>
        )}

        {/* Continue with Google Option */}
        <div>
          <button
            type="button"
            disabled={googleLoading || loading}
            onClick={handleGoogleLogin}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/[0.14] bg-[#16161a]/90 hover:bg-[#202028] backdrop-blur-md py-3.5 px-4 text-sm sm:text-base font-semibold text-white shadow-sm hover:border-white/[0.28] transition-all duration-200 cursor-pointer disabled:opacity-50"
          >
            {googleLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-white" />
                <span>Connecting to Google...</span>
              </>
            ) : (
              <>
                <GoogleIcon className="h-5 w-5" />
                <span>Continue with Google</span>
              </>
            )}
          </button>
        </div>

        {/* Divider */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/[0.1]" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[#0f0f13] px-3 text-neutral-400 font-semibold tracking-wider">
              Or continue with email
            </span>
          </div>
        </div>

        {/* Direct Password Form */}
        <form onSubmit={handlePasswordLogin} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">
              Email Address
            </label>
            <div className="relative group">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="block w-full rounded-xl border border-white/[0.12] bg-[#16161a]/90 backdrop-blur-md py-3.5 pr-4 pl-12 text-base text-white placeholder:text-neutral-500 hover:border-white/[0.22] focus:border-white/40 focus:bg-[#1b1b22] focus:ring-2 focus:ring-white/[0.08] focus:outline-none transition-all duration-200"
              />
              <div className="pointer-events-none absolute inset-y-0 left-0 z-20 flex items-center pl-4 text-neutral-400 group-focus-within:text-white transition-colors">
                <Mail className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">
              Password
            </label>
            <div className="relative group">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="block w-full rounded-xl border border-white/[0.12] bg-[#16161a]/90 backdrop-blur-md py-3.5 pr-12 pl-12 text-base text-white placeholder:text-neutral-500 hover:border-white/[0.22] focus:border-white/40 focus:bg-[#1b1b22] focus:ring-2 focus:ring-white/[0.08] focus:outline-none transition-all duration-200"
              />
              <div className="pointer-events-none absolute inset-y-0 left-0 z-20 flex items-center pl-4 text-neutral-400 group-focus-within:text-white transition-colors">
                <Lock className="h-5 w-5" />
              </div>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 z-20 flex items-center pr-3.5 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex w-full items-center justify-center gap-2.5 rounded-xl py-3.5 sm:py-4 text-base font-bold text-white shadow-[0_0_24px_rgba(232,54,75,0.4)] hover:shadow-[0_0_36px_rgba(232,54,75,0.6)] disabled:opacity-50 disabled:pointer-events-none transition-all duration-200 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Signing In...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
        </form>

        <div className="pt-4 text-center text-sm space-y-2 border-t border-white/[0.08]">
          <p className="text-[var(--text-muted)]">
            New to Sandy&apos;s Gaming?{' '}
            <Link href="/register" className="font-semibold text-white hover:text-[var(--brand-primary)] underline underline-offset-4 ml-1 transition-colors">
              Sign Up / Create Account
            </Link>
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            Guest visitor?{' '}
            <Link href="/contact" className="font-semibold text-[var(--text-secondary)] hover:text-white ml-1 transition-colors">
              Submit an Inquiry
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-[var(--brand-primary)]/20 border-t-[var(--brand-primary)] animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
