import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { History } from 'lucide-react';
import { AuditLogsClient, type AuditLogItem } from './AuditLogsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SuperAdminAuditLogsPage() {
  await requireRole(['super_admin'], '/super-admin/audit-logs');
  const supabase = await createAdminClient();

  const { data: logs } = await supabase
    .from('audit_logs')
    .select(`
      id,
      actor_id,
      action,
      target_type,
      target_id,
      metadata,
      created_at,
      actor:accounts!audit_logs_actor_id_fkey(
        id,
        display_name,
        email,
        role
      )
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  const auditLogs = ((logs || []) as unknown as Array<{
    id: string;
    actor_id: string | null;
    action: string;
    target_type: string;
    target_id: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
    actor?: {
      id: string;
      display_name: string;
      email: string;
      role: string;
    } | Array<{
      id: string;
      display_name: string;
      email: string;
      role: string;
    }> | null;
  }>).map((l) => ({
    ...l,
    actor: Array.isArray(l.actor) ? l.actor[0] || null : l.actor || null,
  })) as AuditLogItem[];

  return (
    <div className="w-full flex-1 px-3.5 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 animate-page-enter">
      <div className="border-b border-white/[0.08] pb-4">
        <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2.5">
          <History className="h-5 w-5 text-[#e8364b]" />
          <span>Security Audit Trail</span>
        </h1>
        <p className="mt-1 text-xs text-neutral-400">
          Track administrative mutations, staff role updates, account suspensions, and assignments.
        </p>
      </div>

      <AuditLogsClient initialLogs={auditLogs} />
    </div>
  );
}
