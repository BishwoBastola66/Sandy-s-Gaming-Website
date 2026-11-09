'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log unexpected client-side error securely
    console.error('Unhandled application error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl glass mb-6">
        <AlertTriangle className="h-7 w-7 text-[var(--brand-primary)]" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Something went wrong</h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)] max-w-md">
        An unexpected error occurred. Our technical team has been notified.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
        >
          <RotateCcw className="h-4 w-4" />
          <span>Try Again</span>
        </button>
      </div>
    </div>
  );
}
