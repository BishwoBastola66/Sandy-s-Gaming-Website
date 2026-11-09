'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  KeyRound,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';
import { ThunderboltBackground } from '@/components/auth/ThunderboltBackground';
import { OtpCodeInput } from '@/components/auth/OtpCodeInput';
import { GoogleIcon } from '@/components/auth/GoogleIcon';
import { sanitizeErrorMessage } from '@/lib/validation/error-sanitizer';

function RegisterForm() {
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get('redirect') || '/dashboard';

  // Step management: 'details' -> 'otp'
  const [step, setStep] = useState<'details' | 'otp'>('details');

  // Registration form state
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // OTP form state
  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(30);
  const [resending, setResending] = useState(false);

  // Status feedback
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleGoogleLogin = () => {
    setGoogleLoading(true);
    setErrorMsg(null);
    window.location.href = `/api/auth/google?redirect=${encodeURIComponent(redirectTarget)}`;
  };

  // Resend countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'otp' && resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [step, resendCooldown]);

  // Step 1: Request OTP and save pending payload
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanName = displayName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || cleanName.length < 2) {
      setErrorMsg('Please enter a display name (at least 2 characters).');
      return;
    }
    if (cleanName.length > 50) {
      setErrorMsg('Display name cannot exceed 50 characters.');
      return;
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: cleanName,
          email: cleanEmail,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to request verification code.');
      }

      setStep('otp');
      setResendCooldown(30);
      setSuccessMsg(data.message || 'Verification code sent to your email.');
    } catch (err: unknown) {
      setErrorMsg(sanitizeErrorMessage(err, 'Registration failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP and create the account
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otpCode.trim();

    if (!/^\d{6}$/.test(cleanOtp)) {
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
          otp: cleanOtp,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to verify passcode.');
      }

      window.location.href = redirectTarget || '/dashboard';
    } catch (err: unknown) {
      setErrorMsg(sanitizeErrorMessage(err, 'Verification failed. Please check the code and try again.'));
      setLoading(false);
    }
  };

  // Resend OTP handler
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/register/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to resend code.');
      }

      setSuccessMsg(data.message || 'A new verification passcode has been sent to your email.');
      setResendCooldown(45);
    } catch (err: unknown) {
      setErrorMsg(sanitizeErrorMessage(err, 'Failed to resend code. Please try again.'));
    } finally {
      setResending(false);
    }
  };

  const inputClass =
    'block w-full rounded-xl border border-white/[0.12] bg-[#16161a]/90 backdrop-blur-md py-3.5 pr-4 pl-12 text-sm sm:text-base text-white placeholder:text-neutral-500 hover:border-white/[0.22] focus:border-white/40 focus:bg-[#1b1b22] focus:ring-2 focus:ring-white/[0.08] focus:outline-none transition-all duration-200';

  return (
    <div className="relative isolate min-h-[90vh] flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8 overflow-hidden">
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

      {/* 3. Foreground Form (Matches Login with clean sizing) */}
      <div className="relative z-10 w-full max-w-[460px] space-y-6">
        <div className="text-center">
          {step === 'details' ? (
            <>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
                Create Account
              </h1>
              <p className="mt-2 text-sm sm:text-base text-[var(--text-secondary)]">
                Join Sandy&apos;s Gaming to start chatting with our Support Team.
              </p>
            </>
          ) : (
            <>
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl glass text-white animate-float">
                <KeyRound className="h-7 w-7 text-white" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
                Verify Your Email
              </h1>
              <p className="mt-2 text-sm sm:text-base text-[var(--text-secondary)]">
                We sent a 6-digit passcode to <br />
                <strong className="text-white font-mono">{email}</strong>
              </p>
            </>
          )}
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

        {step === 'details' && (
          <>
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
                  Or register with email
                </span>
              </div>
            </div>
          </>
        )}

        {step === 'details' ? (
          /* STEP 1: Registration Credentials */
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label htmlFor="displayName" className="block text-sm font-semibold text-[var(--text-secondary)] mb-1.5">
                Chosen Display Name
              </label>
              <div className="relative group">
                <input
                  id="displayName"
                  name="displayName"
                  type="text"
                  required
                  maxLength={50}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="GamerTag or Your Name"
                  className={inputClass}
                />
                <div className="pointer-events-none absolute inset-y-0 left-0 z-20 flex items-center pl-4 text-neutral-400 group-focus-within:text-white transition-colors">
                  <User className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="reg-email" className="block text-sm font-semibold text-[var(--text-secondary)] mb-1.5">
                Email Address
              </label>
              <div className="relative group">
                <input
                  id="reg-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className={inputClass}
                />
                <div className="pointer-events-none absolute inset-y-0 left-0 z-20 flex items-center pl-4 text-neutral-400 group-focus-within:text-white transition-colors">
                  <Mail className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="reg-password" className="block text-sm font-semibold text-[var(--text-secondary)] mb-1.5">
                Password
              </label>
              <div className="relative group">
                <input
                  id="reg-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className={inputClass}
                />
                <div className="pointer-events-none absolute inset-y-0 left-0 z-20 flex items-center pl-4 text-neutral-400 group-focus-within:text-white transition-colors">
                  <Lock className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="reg-confirm-password" className="block text-sm font-semibold text-[var(--text-secondary)] mb-1.5">
                Confirm Password
              </label>
              <div className="relative group">
                <input
                  id="reg-confirm-password"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className={inputClass}
                />
                <div className="pointer-events-none absolute inset-y-0 left-0 z-20 flex items-center pl-4 text-neutral-400 group-focus-within:text-white transition-colors">
                  <Lock className="h-5 w-5" />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex w-full items-center justify-center gap-2.5 rounded-xl py-3.5 sm:py-4 text-base font-bold text-white shadow-[0_0_24px_rgba(232,54,75,0.4)] hover:shadow-[0_0_36px_rgba(232,54,75,0.6)] disabled:opacity-50 disabled:pointer-events-none transition-all duration-200 cursor-pointer mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Sending Verification Code...</span>
                </>
              ) : (
                <>
                  <span>Create Account &amp; Continue</span>
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* STEP 2: OTP Verification */
          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <div className="space-y-3">
              <label htmlFor="otp-input" className="block text-xs font-medium tracking-wide text-neutral-300 text-center">
                Enter 6-Digit Verification Code
              </label>
              <OtpCodeInput
                value={otpCode}
                onChange={setOtpCode}
                disabled={loading}
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading || otpCode.length < 6}
              className="btn-primary flex w-full items-center justify-center gap-2.5 rounded-xl py-3.5 sm:py-4 text-base font-bold text-white shadow-[0_0_24px_rgba(232,54,75,0.4)] hover:shadow-[0_0_36px_rgba(232,54,75,0.6)] disabled:opacity-50 disabled:pointer-events-none transition-all duration-200 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Verifying &amp; Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Verify &amp; Create Account</span>
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>

            <div className="flex items-center justify-between border-t border-white/[0.08] pt-4 text-xs">
              <button
                type="button"
                onClick={() => {
                  setStep('details');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className="flex items-center gap-1.5 font-semibold text-neutral-300 hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Change Email / Back</span>
              </button>

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || resending}
                className="flex items-center gap-1.5 font-semibold text-[var(--brand-primary)] hover:underline disabled:text-neutral-400 disabled:no-underline transition-colors cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${resending ? 'animate-spin' : ''}`} />
                <span>{resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}</span>
              </button>
            </div>
          </form>
        )}

        <div className="border-t border-white/[0.08] pt-4 text-center text-sm text-[var(--text-muted)]">
          <p>
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-white hover:text-[var(--brand-primary)] underline underline-offset-4 ml-1 transition-colors">
              Sign In here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
