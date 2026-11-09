import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { SettingsClient } from '@/app/dashboard/settings/SettingsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SuperAdminSettingsPage() {
  const profile = await requireRole(['super_admin'], '/super-admin/settings');
  const supabase = await createAdminClient();
  const cookieStore = await cookies();
  const currentToken = cookieStore.get(SESSION_COOKIE_NAME)?.value || null;

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, session_token, ip_address, user_agent, created_at, expires_at')
    .eq('account_id', profile.id)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  const mappedSessions =
    sessions && sessions.length > 0
      ? sessions.map((s) => ({
          id: s.id,
          ipAddress: s.ip_address || 'Current Network',
          userAgent: s.user_agent || null,
          createdAt: s.created_at,
          isCurrent: Boolean(currentToken && s.session_token === currentToken),
        }))
      : [
          {
            id: 'current-device',
            ipAddress: 'Current Network',
            userAgent: null,
            createdAt: new Date().toISOString(),
            isCurrent: true,
          },
        ];

  if (!mappedSessions.some((s) => s.isCurrent) && mappedSessions.length > 0) {
    mappedSessions[0].isCurrent = true;
  }

  return (
    <div className="w-full flex-1 px-3.5 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 animate-page-enter">
      <div className="border-b border-white/[0.06] pb-4">
        <h1 className="text-xl font-semibold tracking-tight text-white">
          Settings
        </h1>
        <p className="mt-1 text-xs text-neutral-400">
          Manage your account profile details, display identity, and security preferences.
        </p>
      </div>

      <SettingsClient
        user={{
          id: profile.id,
          email: profile.email || '',
          phone: profile.phone || null,
          displayName: profile.display_name || 'Super Admin',
          role: profile.role || 'super_admin',
          accountStatus: profile.account_status || 'active',
          createdAt: profile.created_at,
        }}
        initialSessions={mappedSessions}
      />
    </div>
  );
}
