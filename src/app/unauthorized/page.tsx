import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400 mb-6">
        <ShieldAlert className="h-8 w-8" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
        Access Restricted
      </h1>
      <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400 max-w-md">
        You do not have the required permissions to access this administrative portal. If you believe this is an error, please contact your Super Admin.
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
          href="/chat"
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900 transition-colors"
        >
          <span>Customer Live Chat</span>
        </Link>
      </div>
    </div>
  );
}
