import Link from 'next/link';
import { Ban, ArrowLeft } from 'lucide-react';

export default function SuspendedPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400 mb-6">
        <Ban className="h-8 w-8" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
        Account Suspended
      </h1>
      <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400 max-w-md">
        Your account has been temporarily suspended by an administrator. Please submit a guest inquiry or contact support for assistance.
      </p>
      <div className="mt-6 flex gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Return Home</span>
        </Link>
        <Link
          href="/contact"
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900 transition-colors"
        >
          <span>Contact Us</span>
        </Link>
      </div>
    </div>
  );
}
