'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { UserPlus, LogIn, MessageSquare, BookOpen, ImageIcon, Mail } from 'lucide-react';

export function Footer() {
  const pathname = usePathname();

  // Hide footer on dashboard and management portal routes
  const isDashboard =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/super-admin') ||
    pathname.startsWith('/chat') ||
    pathname.startsWith('/account');

  if (isDashboard) {
    return null;
  }

  return (
    <footer className="border-t border-white/[0.06] bg-[var(--background)]">
      <div className="w-full max-w-[1720px] mx-auto px-4 py-14 sm:px-8 lg:px-12 xl:px-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <BrandLogo size="md" withText={true} href="/" glow={false} />
            <p className="max-w-md text-sm text-[var(--text-secondary)] leading-relaxed">
              Sandy&apos;s Gaming is an esports and gaming entertainment hub. Delivering exclusive articles, artwork galleries, and competitive tournament coverage with dedicated 24/7 staff support.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold tracking-wide text-[var(--text-primary)]">
              Navigation
            </h3>
            <ul className="space-y-2.5 text-sm">
              {[
                { href: '/blog', label: 'Esports Blogs', icon: BookOpen },
                { href: '/posts', label: 'Art & Posters', icon: ImageIcon },
                { href: '/contact', label: 'Contact', icon: Mail },
                { href: '/chat', label: 'Live Chat', icon: MessageSquare },
              ].map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link href={href} className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-primary)] transition-colors duration-300">
                    <Icon className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                    <span>{label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Account Access */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold tracking-wide text-[var(--text-primary)]">
              Sign Up &amp; Sign In
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/register" className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-primary)] transition-colors duration-300">
                  <UserPlus className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                  <span>Sign Up</span>
                </Link>
              </li>
              <li>
                <Link href="/login" className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-primary)] transition-colors duration-300">
                  <LogIn className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                  <span>Sign In</span>
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between text-xs text-[var(--text-muted)] gap-4">
          <p>&copy; 2026 Sandy&apos;s Gaming. All rights reserved.</p>
          <p className="font-mono text-[11px]">Built for competitive performance</p>
        </div>
      </div>
    </footer>
  );
}
