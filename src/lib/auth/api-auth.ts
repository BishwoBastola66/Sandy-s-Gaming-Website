import { getCurrentProfile } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { UserRole } from '@/types/database';

export interface ApiAuthResult {
  errorResponse: NextResponse | null;
  profile: NonNullable<Awaited<ReturnType<typeof getCurrentProfile>>>;
}

/**
 * Enforces role-based authorization for Next.js Route Handlers (API endpoints).
 * Automatically validates database sessions, checks account status, and verifies role privileges.
 */
export async function requireApiRole(
  allowedRoles: UserRole[]
): Promise<{ errorResponse: NextResponse; profile: null } | { errorResponse: null; profile: NonNullable<Awaited<ReturnType<typeof getCurrentProfile>>> }> {
  const profile = await getCurrentProfile();

  if (!profile) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Unauthorized: Authentication required. Please sign in.' },
        { status: 401 }
      ),
      profile: null,
    };
  }

  if (profile.account_status === 'suspended') {
    return {
      errorResponse: NextResponse.json(
        { error: 'Forbidden: Account has been suspended. Please contact support.', suspended: true },
        { status: 403 }
      ),
      profile: null,
    };
  }

  if (!allowedRoles.includes(profile.role)) {
    return {
      errorResponse: NextResponse.json(
        { error: `Forbidden: Access requires [${allowedRoles.join(', ')}] privileges.` },
        { status: 403 }
      ),
      profile: null,
    };
  }

  return { errorResponse: null, profile };
}

/**
 * Enforces basic authentication for any active user (customer, admin, super_admin).
 */
export async function requireApiAuth() {
  return requireApiRole(['customer', 'admin', 'super_admin']);
}
