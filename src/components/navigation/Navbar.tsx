'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { UserRole } from '@/types/database';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { MessageSquare, BookOpen, Image as ImageIcon, Mail, Menu, X, LogOut, LayoutDashboard, ArrowRight } from 'lucide-react';

const NAV_LINKS = [
  { href: '/blog', label: 'Blog', icon: BookOpen },
  { href: '/posts', label: 'Gallery', icon: ImageIcon },
  { href: '/contact', label: 'Contact', icon: Mail },
] as const;

export interface NavbarInitialUser {
  email: string | null;
  role: UserRole | null;
  displayName?: string | null;
}

export function Navbar({ initialUser }: { initialUser?: NavbarInitialUser | null }) {
  const [mobileMenuState, setMobileMenuState] = useState<{ open: boolean; pathname: string }>({
    open: false,
    pathname: '',
  });
  const [userEmail, setUserEmail] = useState<string | null>(() => {
    if (initialUser !== undefined) return initialUser?.email ?? null;
    if (typeof window !== 'undefined') {
      try {
        return sessionStorage.getItem('sg_user_email');
      } catch {}
    }
    return null;
  });
  const [userRole, setUserRole] = useState<UserRole | null>(() => {
    if (initialUser !== undefined) return initialUser?.role ?? null;
    if (typeof window !== 'undefined') {
      try {
        return (sessionStorage.getItem('sg_user_role') as UserRole) || null;
      } catch {}
    }
    return null;
  });
  const [loading, setLoading] = useState(initialUser === undefined);
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const mobileMenuOpen = mobileMenuState.open && mobileMenuState.pathname === pathname;

  // Detect scroll for glass effect
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.account) {
            setUserEmail(data.account.email);
            setUserRole(data.account.role);
            try {
              sessionStorage.setItem('sg_user_email', data.account.email);
              sessionStorage.setItem('sg_user_role', data.account.role);
            } catch {}
            return;
          }
        }
        setUserEmail(null);
        setUserRole(null);
        try {
          sessionStorage.removeItem('sg_user_email');
          sessionStorage.removeItem('sg_user_role');
        } catch {}
      } catch {
        if (!initialUser) {
          setUserEmail(null);
          setUserRole(null);
        }
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [pathname, initialUser]);

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignored
    }
    try {
      sessionStorage.removeItem('sg_user_email');
      sessionStorage.removeItem('sg_user_role');
    } catch {}
    setUserEmail(null);
    setUserRole(null);
    router.push('/');
    router.refresh();
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const isWorkspace =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/account') ||
    pathname.startsWith('/chat') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/super-admin');

  const isCustomerDashboard = isWorkspace;

  const chatHref =
    userRole === 'admin' || userRole === 'super_admin'
      ? '/admin/conversations'
      : '/dashboard/chat';
  const chatLabel = 'Chat';

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-500 ${
        scrolled || isCustomerDashboard
          ? 'bg-[var(--background)]/90 backdrop-blur-2xl border-b border-white/[0.06] shadow-[0_1px_20px_rgba(0,0,0,0.3)]'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="w-full flex h-16 max-w-[1720px] mx-auto items-center justify-between px-4 sm:px-8 lg:px-12 xl:px-16">
        {/* Brand Logo & Mobile Sidebar Trigger for Workspace */}
        <div className="flex items-center gap-2.5">
          {isWorkspace && (
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('toggle-mobile-sidebar'));
              }}
              className="lg:hidden inline-flex items-center justify-center p-1.5 -ml-1 rounded-md text-neutral-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
              aria-label="Open sidebar menu"
            >
              <Menu className="h-5 w-5 text-white" />
            </button>
          )}
          <BrandLogo size="md" withText={true} href="/" glow={false} />
        </div>

        {/* Desktop Navigation (Hidden inside Customer Dashboard area) */}
        {!isCustomerDashboard && (
          <nav className="hidden md:flex items-center gap-8 lg:gap-10">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`relative flex items-center gap-2 py-2 text-sm font-medium tracking-wide transition-colors duration-200 ${
                  isActive(href)
                    ? 'text-white'
                    : 'text-[var(--text-secondary)] hover:text-white'
                }`}
              >
                <Icon className={`h-4 w-4 transition-colors ${isActive(href) ? 'text-[var(--brand-primary)]' : ''}`} />
                <span>{label}</span>
                {isActive(href) && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-[var(--brand-primary)]" />
                )}
              </Link>
            ))}
            <Link
              href={chatHref}
              className={`relative flex items-center gap-2 py-2 text-sm font-medium tracking-wide transition-colors duration-200 ${
                isActive(chatHref) || isActive('/chat')
                  ? 'text-white'
                  : 'text-[var(--text-secondary)] hover:text-white'
              }`}
            >
              <MessageSquare className={`h-4 w-4 transition-colors ${isActive(chatHref) || isActive('/chat') ? 'text-[var(--brand-primary)]' : ''}`} />
              <span>{chatLabel}</span>
              {(isActive(chatHref) || isActive('/chat')) && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-[var(--brand-primary)]" />
              )}
            </Link>
          </nav>
        )}

        {/* Action Controls */}
        <div className="hidden md:flex items-center gap-2.5">
          {!loading && userEmail ? (
            <div className="flex items-center gap-2.5">
              {!isWorkspace && (
                <Link
                  href={userRole === 'super_admin' ? '/super-admin' : userRole === 'admin' ? '/admin' : '/dashboard'}
                  className="btn-primary flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm"
                >
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  <span>Dashboard</span>
                </Link>
              )}
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center gap-1.5 rounded-xl border border-red-900/30 bg-red-950/10 px-2.5 py-1.5 text-xs font-medium text-red-400 hover:bg-red-950/20 hover:border-red-900/50 transition-all duration-300 cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-[var(--text-secondary)] hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="btn-primary flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-white shadow-sm"
              >
                <span>Sign Up</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>

        {/* Mobile toggle (Public non-workspace pages only) */}
        {!isWorkspace && (
          <div className="flex lg:hidden items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setMobileMenuState({
                  open: !mobileMenuOpen,
                  pathname,
                })
              }
              className="inline-flex items-center justify-center rounded-xl p-2 text-[var(--text-secondary)] hover:text-white hover:bg-white/[0.06] transition-all duration-300"
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        )}
      </div>

      {/* Mobile menu — smooth slide-in (only for public pages) */}
      {!isWorkspace && (
        <div
          className={`lg:hidden overflow-hidden transition-all duration-400 ease-out ${
            mobileMenuOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
        <div className="border-t border-white/[0.06] bg-[var(--background)]/95 backdrop-blur-2xl px-4 pt-3 pb-5">
          <div className="flex flex-col space-y-1">
            {!isCustomerDashboard && (
              <>
                {NAV_LINKS.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-3 py-2.5 px-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                      isActive(href)
                        ? 'text-white bg-white/[0.06]'
                        : 'text-[var(--text-primary)] hover:bg-white/[0.04]'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isActive(href) ? 'text-[var(--brand-primary)]' : 'text-[var(--text-secondary)]'}`} />
                    <span>{label}</span>
                  </Link>
                ))}
                <Link
                  href={chatHref}
                  className={`flex items-center gap-3 py-2.5 px-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                    isActive(chatHref) || isActive('/chat')
                      ? 'text-white bg-white/[0.06]'
                      : 'text-[var(--text-primary)] hover:bg-white/[0.04]'
                  }`}
                >
                  <MessageSquare className={`h-4 w-4 ${isActive(chatHref) || isActive('/chat') ? 'text-[var(--brand-primary)]' : 'text-[var(--text-secondary)]'}`} />
                  <span>{chatLabel}</span>
                </Link>
              </>
            )}

            <div className="pt-3 mt-2 border-t border-white/[0.06] flex flex-col gap-2">
              {!loading && userEmail ? (
                <>
                  {!isWorkspace && (
                    <Link
                      href={userRole === 'super_admin' ? '/super-admin' : userRole === 'admin' ? '/admin' : '/dashboard'}
                      className="w-full text-center rounded-xl btn-primary py-2.5 text-sm font-semibold text-white flex items-center justify-center gap-2"
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      <span>Dashboard</span>
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full text-center rounded-xl border border-red-900/30 bg-red-950/10 py-2.5 text-sm font-medium text-red-400 hover:bg-red-950/20 transition-colors cursor-pointer"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/login"
                    className="w-full text-center rounded-xl border border-white/[0.12] bg-[#16161a] py-2.5 text-sm font-semibold text-white hover:bg-white/[0.06] transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    className="w-full text-center rounded-xl btn-primary py-2.5 text-sm font-semibold text-white flex items-center justify-center gap-1.5"
                  >
                    <span>Sign Up</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      )}
    </header>
  );
}
