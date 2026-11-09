'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  MessageSquare,
  Ticket,
  Settings,
  Shield,
  LogOut,
  X,
  Loader2,
  ArrowUpRight,
} from 'lucide-react';

interface CustomerSidebarProps {
  user: {
    displayName?: string;
    email?: string;
    role?: string;
  };
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'Dashboard',
    items: [
      { label: 'Home', href: '/dashboard', icon: Home, exact: true },
      { label: 'Chat', href: '/dashboard/chat', icon: MessageSquare },
      { label: 'Tickets', href: '/dashboard/tickets', icon: Ticket },
      { label: 'Settings', href: '/dashboard/settings', icon: Settings },
    ],
  },
];

export function CustomerSidebar({ user }: CustomerSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [navTransition, setNavTransition] = useState<{ from: string; to: string } | null>(null);

  // Listen for topbar hamburger trigger
  useEffect(() => {
    const handleToggle = () => setMobileOpen((prev) => !prev);
    const handleOpen = () => setMobileOpen(true);
    const handleClose = () => setMobileOpen(false);

    window.addEventListener('toggle-mobile-sidebar', handleToggle);
    window.addEventListener('open-mobile-sidebar', handleOpen);
    window.addEventListener('close-mobile-sidebar', handleClose);

    return () => {
      window.removeEventListener('toggle-mobile-sidebar', handleToggle);
      window.removeEventListener('open-mobile-sidebar', handleOpen);
      window.removeEventListener('close-mobile-sidebar', handleClose);
    };
  }, []);

  // Auto-close on navigation during render
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setMobileOpen(false);
  }

  const isLinkActive = (item: NavItem) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname === item.href || pathname.startsWith(item.href + '/');
  };

  const handleSignOut = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignored
    }
    router.push('/login');
    router.refresh();
  };

  const getInitials = (name?: string, email?: string) => {
    if (name && name.trim()) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'CU';
  };

  const renderNavList = () => (
    <div className="flex flex-col h-full bg-[#0d0d10]">
      {/* Mobile Close Button */}
      <div className="lg:hidden px-4 pt-3 flex justify-end">
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-1.5">
            <h3 className="px-3 text-[11px] font-medium text-neutral-500 select-none">
              {section.title}
            </h3>
            <div className="space-y-1">
              {section.items.map((item) => {
                const isPending =
                  navTransition !== null &&
                  navTransition.from === pathname &&
                  navTransition.to === item.href &&
                  pathname !== item.href;
                const active = isLinkActive(item) || isPending;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={true}
                    onClick={() => {
                      setNavTransition({ from: pathname, to: item.href });
                      setMobileOpen(false);
                    }}
                    className={`group relative flex items-center justify-between rounded-md px-3 py-2 text-[13px] font-medium transition-all duration-150 ${
                      active
                        ? 'bg-white/[0.07] text-white border border-white/[0.08] shadow-xs'
                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.03] border border-transparent'
                    }`}
                  >
                    {/* Left vertical active indicator strip (human-crafted design) */}
                    {active && (
                      <span
                        className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[#e8364b] shadow-[0_0_8px_rgba(232,54,75,0.45)]"
                        aria-hidden="true"
                      />
                    )}

                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          active
                            ? 'text-[#e8364b]'
                            : 'text-neutral-500 group-hover:text-neutral-300'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {isPending ? (
                      <Loader2 className="h-3.5 w-3.5 text-[#e8364b] animate-spin shrink-0" />
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Footer - Full-width rows with clean dividing lines, no floating cards */}
      <div className="border-t border-white/[0.06] bg-[#0a0a0d] divide-y divide-white/[0.06]">
        {(user.role === 'admin' || user.role === 'super_admin') && (
          <Link
            href={user.role === 'super_admin' ? '/super-admin' : '/admin'}
            onClick={() => setMobileOpen(false)}
            className="flex items-center justify-between px-4 py-2.5 text-xs font-medium text-neutral-300 hover:bg-white/[0.04] hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-[#e8364b]" />
              <span>{user.role === 'super_admin' ? 'Super Admin Console' : 'Staff Workspace'}</span>
            </div>
            <ArrowUpRight className="h-3.5 w-3.5 text-neutral-500" />
          </Link>
        )}

        {/* User Profile Row - Fills fully edge-to-edge */}
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#e8364b]/15 text-[#e8364b] font-semibold text-xs border border-[#e8364b]/20">
            {getInitials(user.displayName, user.email)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white truncate leading-tight">
              {user.displayName || (user.role === 'super_admin' ? 'Super Admin' : user.role === 'admin' ? 'Staff Specialist' : 'Customer')}
            </p>
            <p className="text-[11px] text-neutral-400 truncate leading-tight mt-0.5">
              {user.email}
            </p>
          </div>
        </div>

        {/* Sign Out Row - Fills fully edge-to-edge */}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={loggingOut}
          className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-neutral-400 hover:bg-red-500/10 hover:text-red-300 transition-colors cursor-pointer disabled:opacity-50"
        >
          {loggingOut ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-red-400 shrink-0" />
          ) : (
            <LogOut className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>{loggingOut ? 'Signing out...' : 'Sign out'}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/75 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Mobile Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 shadow-2xl transform transition-transform duration-200 ease-out lg:hidden border-r border-white/[0.06] ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {renderNavList()}
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-white/[0.06] bg-[#0d0d10] min-h-[calc(100vh-4rem)] sticky top-16 h-[calc(100vh-4rem)]">
        {renderNavList()}
      </aside>
    </>
  );
}
