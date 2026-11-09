import Link from 'next/link';
import { FileQuestion, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl glass mb-6">
        <FileQuestion className="h-7 w-7 text-[var(--text-muted)]" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Page Not Found</h1>
      <p className="mt-3 text-sm text-[var(--text-secondary)] max-w-sm">
        The requested page could not be located, or may have been unpublished or moved.
      </p>
      <div className="mt-6">
        <Link
          href="/"
          className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Return to Homepage</span>
        </Link>
      </div>
    </div>
  );
}
