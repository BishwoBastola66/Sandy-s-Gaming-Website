import { cache } from 'react';
import { getAccountFromSession } from '@/lib/auth/session';
import type { Database, UserRole } from '@/types/database';
import { redirect } from 'next/navigation';

export type Profile = Omit<Database['public']['Tables']['accounts']['Row'], 'password_hash'>;

/**
 * Retrieves the application account for the currently active database session.
 * Memoized per request to eliminate duplicate queries.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  // Validate strictly via custom database 'sessions' table
  const account = await getAccountFromSession();
  if (account) {
    return {
      id: account.id,
      email: account.email,
      phone: account.phone || null,
      display_name: account.display_name,
      role: account.role,
      account_status: account.account_status,
      provider: account.provider || 'email',
      provider_id: account.provider_id || null,
      created_at: account.created_at,
      updated_at: account.updated_at,
    };
  }

  return null;
});

/**
 * Retrieves the current authenticated user object from the active session.
 * Memoized per request using React cache().
 */
export const getCurrentUser = cache(async () => {
  const profile = await getCurrentProfile();
  if (!profile) {
    return null;
  }

  return {
    id: profile.id,
    email: profile.email || '',
    user_metadata: {
      display_name: profile.display_name,
    },
  };
});

/**
 * Enforces authentication. If unauthenticated, redirects to /login.
 */
export async function requireAuth(redirectTo: string = '/login') {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect(redirectTo);
  }

  if (profile.account_status === 'suspended') {
    redirect('/suspended');
  }

  return {
    id: profile.id,
    email: profile.email || '',
    user_metadata: {
      display_name: profile.display_name,
    },
  };
}

/**
 * Enforces role authorization.
 * If user lacks the required role or account is suspended, redirects appropriately.
 */
export async function requireRole(allowedRoles: UserRole[], fallbackUrl: string = '/') {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect(`/login?redirect=${encodeURIComponent(fallbackUrl)}`);
  }

  if (profile.account_status === 'suspended') {
    redirect('/suspended');
  }

  if (!allowedRoles.includes(profile.role)) {
    redirect('/unauthorized');
  }

  return profile;
}
