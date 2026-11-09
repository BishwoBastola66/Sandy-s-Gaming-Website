'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  KeyRound,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import { ThunderboltBackground } from '@/components/auth/ThunderboltBackground';
import { OtpCodeInput } from '@/components/auth/OtpCodeInput';
import { sanitizeErrorMessage } from '@/lib/validation/error-sanitizer';

function VerifyOtpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get('redirect') || '/dashboard';
  const emailParam = searchParams.get('email') || searchParams.get('target') || '';

  const [email, setEmail] = useState(emailParam);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(30);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanToken = token.trim();

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (!/^\d{6}$/.test(cleanToken)) {
      setErrorMsg('Please enter a valid 6-digit numeric passcode.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          otp: cleanToken,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Verification failed.');
      }

      setSuccessMsg('Verification successful! Account created. Redirecting...');

      setTimeout(() => {
        router.push(redirectTarget);
      }, 700);
    } catch (err: unknown) {
      setErrorMsg(sanitizeErrorMessage(err, 'Invalid or expired OTP code.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (resendCooldown > 0 || !cleanEmail || !cleanEmail.includes('@')) return;

    setResending(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/register/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to resend passcode.');
      }

      setSuccessMsg('A new 6-digit passcode has been sent to your email.');
      setResendCooldown(60);
    } catch (err: unknown) {
      setErrorMsg(sanitizeErrorMessage(err, 'Failed to resend OTP.'));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="relative isolate min-h-[90vh] flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8 overflow-hidden">
      {/* 1. Three.js Thunderbolt Background Canvas */}
      <ThunderboltBackground className="z-0" />

      {/* 2. Watermark Brand Logo positioned behind the form */}
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

      {/* 3. Foreground Form */}
      <div className="relative z-10 w-full max-w-[480px] space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl glass text-[var(--brand-primary)] animate-float">
            <KeyRound className="h-7 w-7" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
            Enter Verification Code
          </h1>
          <p className="mt-2 text-sm sm:text-base text-[var(--text-secondary)]">
            {email ? (
              <>
                Passcode sent to <strong className="text-white font-mono">{email}</strong>
              </>
            ) : (
              'Enter the email and 6-digit code sent to your device'
            )}
          </p>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs sm:text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3 text-xs sm:text-sm text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleVerifyOtp} className="space-y-6">
          {!emailParam && (
            <div>
              <label htmlFor="verify-email" className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                Email Address
              </label>
              <input
                id="verify-email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="block w-full rounded-xl border border-white/[0.12] bg-[#16161a]/90 backdrop-blur-md py-3.5 px-4 text-sm sm:text-base text-white placeholder:text-neutral-500 hover:border-white/[0.22] focus:border-white/40 focus:bg-[#1b1b22] focus:ring-2 focus:ring-white/[0.08] focus:outline-none transition-all duration-200"
              />
            </div>
          )}

          <div className="space-y-3">
            <label htmlFor="otp-input" className="block text-xs font-medium tracking-wide text-neutral-300 text-center">
              Enter 6-Digit Verification Code
            </label>
            <OtpCodeInput
              value={token}
              onChange={setToken}
              disabled={loading}
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading || token.length < 6}
            className="btn-primary flex w-full items-center justify-center gap-2.5 rounded-xl py-3.5 sm:py-4 text-base font-bold text-white shadow-[0_0_24px_rgba(232,54,75,0.4)] hover:shadow-[0_0_36px_rgba(232,54,75,0.6)] disabled:opacity-50 disabled:pointer-events-none transition-all duration-200 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Verifying &amp; Creating Account...</span>
              </>
            ) : (
              <>
                <span>Verify &amp; Continue</span>
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
        </form>

        <div className="flex items-center justify-between border-t border-white/[0.06] pt-4 text-xs">
          <Link
            href="/register"
            className="flex items-center gap-1.5 font-semibold text-[var(--text-muted)] hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Change Email</span>
          </Link>

          <button
            type="button"
            onClick={handleResendOtp}
            disabled={resendCooldown > 0 || resending || !email}
            className="flex items-center gap-1.5 font-semibold text-[var(--brand-primary)] hover:underline disabled:text-[var(--text-muted)] disabled:no-underline transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${resending ? 'animate-spin' : ''}`} />
            <span>{resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={null}>
      <VerifyOtpContent />
    </Suspense>
  );
}

