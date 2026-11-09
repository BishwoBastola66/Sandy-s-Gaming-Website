import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import {
  Users,
  MessageSquare,
  History,
  UserPlus,
  Mail,
  FileText,
  Ticket,
  ArrowRight,
  Clock,
  ShieldCheck,
  Plus,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SuperAdminDashboardPage() {
  await requireRole(['super_admin'], '/super-admin');
  const supabase = await createAdminClient();

  interface RecentConvRow {
    id: string;
    subject: string | null;
    status: string;
    last_message_at: string;
    created_at: string;
    customer?: { id: string; display_name: string | null } | { id: string; display_name: string | null }[] | null;
  }

  interface RecentAuditRow {
    id: string;
    action: string;
    target_type: string;
    created_at: string;
    actor?: { display_name: string | null } | { display_name: string | null }[] | null;
  }

  const [
    { count: staffCount },
    { count: customerCount },
    { count: convCount },
    { count: ticketsCount },
    { count: auditCount },
    { count: pendingInquiriesCount },
    { data: rawConversations },
    { data: rawLogs },
  ] = await Promise.all([
    supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true })
      .in('role', ['admin', 'super_admin']),
    supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'customer'),
    supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true }),
    supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true }),
    supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true }),
    supabase
      .from('contact_inquiries')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'new'),
    supabase
      .from('conversations')
      .select(`
        id,
        subject,
        status,
        last_message_at,
        created_at,
        customer:accounts!conversations_customer_id_fkey(id, display_name)
      `)
      .order('last_message_at', { ascending: false })
      .limit(5),
    supabase
      .from('audit_logs')
      .select(`
        id,
        action,
        target_type,
        created_at,
        actor:accounts!audit_logs_actor_id_fkey(display_name)
      `)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const recentConversations = (rawConversations as unknown as RecentConvRow[]) || [];
  const recentLogs = (rawLogs as unknown as RecentAuditRow[]) || [];

  const totalStaff = staffCount ?? 0;
  const totalCustomers = customerCount ?? 0;
  const totalConversations = convCount ?? 0;
  const totalTickets = ticketsCount ?? 0;
  const totalAuditEvents = auditCount ?? 0;
  const totalNewInquiries = pendingInquiriesCount ?? 0;

  return (
    <div className="w-full flex-1 px-3.5 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6 animate-page-enter">
      {/* Overview Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-white/[0.08] gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
              System Administration
            </h1>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-300 border border-purple-500/30">
              Super Admin
            </span>
          </div>
          <p className="mt-0.5 text-xs text-neutral-400">
            Platform governance, security audit logs, and operational controls.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 shrink-0">
          <Link
            href="/super-admin/posts/new"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-medium text-neutral-200 hover:bg-white/[0.07] hover:text-white transition-colors text-center"
          >
            <Plus className="h-3.5 w-3.5 text-purple-400" />
            <span>New Post</span>
          </Link>
          <Link
            href="/super-admin/users"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-500 transition-colors text-center"
          >
            <Users className="h-3.5 w-3.5" />
            <span>Manage Staff</span>
          </Link>
        </div>
      </div>

      {/* Executive Metric Tiles - 2x2 on Mobile, 4x1 on Desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        <Link
          href="/super-admin/users"
          className="group p-3 sm:p-4 rounded-xl bg-[#111116] border border-white/[0.08] hover:border-purple-500/30 hover:bg-[#15151c] transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] sm:text-xs font-semibold text-neutral-400 uppercase tracking-wider truncate">
              Staff &amp; Admins
            </span>
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-bold text-white tabular-nums tracking-tight group-hover:text-purple-300 transition-colors">
              {totalStaff}
            </div>
            <p className="mt-0.5 text-[10px] sm:text-[11px] text-neutral-400 truncate">
              Active staff • <span className="text-neutral-300 font-medium">{totalCustomers} players</span>
            </p>
          </div>
        </Link>

        <Link
          href="/super-admin/conversations"
          className="group p-3 sm:p-4 rounded-xl bg-[#111116] border border-white/[0.08] hover:border-blue-500/30 hover:bg-[#15151c] transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] sm:text-xs font-semibold text-neutral-400 uppercase tracking-wider truncate">
              Live Chats
            </span>
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-bold text-white tabular-nums tracking-tight group-hover:text-blue-300 transition-colors">
              {totalConversations}
            </div>
            <p className="mt-0.5 text-[10px] sm:text-[11px] text-neutral-400 truncate">
              Customer support threads
            </p>
          </div>
        </Link>

        <Link
          href="/super-admin/tickets"
          className="group p-3 sm:p-4 rounded-xl bg-[#111116] border border-white/[0.08] hover:border-[#e8364b]/30 hover:bg-[#15151c] transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] sm:text-xs font-semibold text-neutral-400 uppercase tracking-wider truncate">
              Support Tickets
            </span>
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg bg-[#e8364b]/10 text-[#e8364b] border border-[#e8364b]/20">
              <Ticket className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-bold text-white tabular-nums tracking-tight group-hover:text-[#ff6b7d] transition-colors">
              {totalTickets}
            </div>
            <p className="mt-0.5 text-[10px] sm:text-[11px] text-neutral-400 truncate">
              Player support cases
            </p>
          </div>
        </Link>

        <Link
          href="/super-admin/audit-logs"
          className="group p-3 sm:p-4 rounded-xl bg-[#111116] border border-white/[0.08] hover:border-amber-500/30 hover:bg-[#15151c] transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] sm:text-xs font-semibold text-neutral-400 uppercase tracking-wider truncate">
              Audit Events
            </span>
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <History className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-bold text-white tabular-nums tracking-tight group-hover:text-amber-300 transition-colors">
              {totalAuditEvents}
            </div>
            <p className="mt-0.5 text-[10px] sm:text-[11px] text-neutral-400 truncate">
              Recorded security actions
            </p>
          </div>
        </Link>
      </div>

      {/* Quick Governance Actions Grid */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs sm:text-sm font-semibold text-white flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-purple-400" />
            <span>Quick Governance Actions</span>
          </h2>
          <span className="text-[11px] text-neutral-400">
            {totalNewInquiries} new inquiries
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          <Link
            href="/super-admin/users"
            className="flex items-center gap-2.5 p-2.5 rounded-xl bg-purple-600/15 border border-purple-500/30 text-purple-300 hover:bg-purple-600/25 transition-all text-xs font-semibold"
          >
            <UserPlus className="h-4 w-4 text-purple-400 shrink-0" />
            <span className="truncate">Provision Staff</span>
          </Link>
          <Link
            href="/super-admin/tickets"
            className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-neutral-200 hover:bg-white/[0.06] hover:text-white transition-all text-xs font-medium"
          >
            <Ticket className="h-4 w-4 text-[#e8364b] shrink-0" />
            <span className="truncate">Tickets ({totalTickets})</span>
          </Link>
          <Link
            href="/super-admin/contact-requests"
            className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-neutral-200 hover:bg-white/[0.06] hover:text-white transition-all text-xs font-medium"
          >
            <Mail className="h-4 w-4 text-amber-400 shrink-0" />
            <span className="truncate">Inquiries ({totalNewInquiries})</span>
          </Link>
          <Link
            href="/super-admin/posts"
            className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-neutral-200 hover:bg-white/[0.06] hover:text-white transition-all text-xs font-medium col-span-2 sm:col-span-1"
          >
            <FileText className="h-4 w-4 text-blue-400 shrink-0" />
            <span className="truncate">CMS Library</span>
          </Link>
        </div>
      </div>

      {/* Two-Column Live Activity Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 pt-1">
        {/* Recent Customer Conversations */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
            <div>
              <h2 className="text-xs sm:text-sm font-semibold text-white">Recent Support Threads</h2>
              <p className="text-[11px] text-neutral-400">Latest customer conversations across all queues</p>
            </div>
            <Link
              href="/super-admin/conversations"
              className="inline-flex items-center gap-1 text-xs font-medium text-purple-400 hover:text-purple-300 transition-colors"
            >
              <span>View all</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {!recentConversations || recentConversations.length === 0 ? (
            <div className="py-6">
              <EmptyState
                icon={MessageSquare}
                title="No customer threads yet"
                description="Customer conversations will appear here as soon as initiated."
              />
            </div>
          ) : (
            <div className="space-y-2">
              {recentConversations.map((conv) => {
                const customer = Array.isArray(conv.customer) ? conv.customer[0] : conv.customer;
                const initials = (customer?.display_name || 'C').slice(0, 2).toUpperCase();
                return (
                  <Link
                    key={conv.id}
                    href={`/super-admin/conversations/${conv.id}`}
                    className="p-3 flex items-center justify-between gap-3 rounded-xl bg-[#111116] border border-white/[0.06] hover:border-purple-500/30 hover:bg-[#15151c] transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20 text-xs font-semibold">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-white truncate group-hover:text-purple-300 transition-colors">
                            {customer?.display_name || 'Customer'}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold capitalize ${
                              conv.status === 'open'
                                ? 'bg-blue-500/15 text-blue-300 border border-blue-500/25'
                                : conv.status === 'in_progress'
                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                                : 'bg-white/[0.06] text-neutral-400'
                            }`}
                          >
                            {conv.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-neutral-500 truncate mt-0.5">
                          #{conv.id.slice(0, 8)}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-neutral-500 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Security Audit Events */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
            <div>
              <h2 className="text-xs sm:text-sm font-semibold text-white">Recent Audit Activity</h2>
              <p className="text-[11px] text-neutral-400">Latest governance &amp; staff actions</p>
            </div>
            <Link
              href="/super-admin/audit-logs"
              className="inline-flex items-center gap-1 text-xs font-medium text-purple-400 hover:text-purple-300 transition-colors"
            >
              <span>Full log</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {!recentLogs || recentLogs.length === 0 ? (
            <div className="py-6">
              <EmptyState
                icon={History}
                title="No audit events yet"
                description="Administrative actions and role changes are automatically logged here."
              />
            </div>
          ) : (
            <div className="space-y-2">
              {recentLogs.map((log) => {
                const actor = Array.isArray(log.actor) ? log.actor[0] : log.actor;
                return (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-[#111116] border border-white/[0.06] space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center rounded-md bg-purple-500/15 px-2 py-0.5 text-[10px] font-mono font-semibold text-purple-300 border border-purple-500/25 truncate max-w-[220px]">
                        {log.action}
                      </span>
                      <span className="text-[10px] text-neutral-500 font-mono flex items-center gap-1 shrink-0">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(log.created_at).toLocaleDateString()}</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-neutral-400">
                      <span className="capitalize text-neutral-300 text-[11px]">
                        {log.target_type.replace('_', ' ')}
                      </span>
                      <span className="text-[11px]">
                        By <span className="text-neutral-200 font-medium">{actor?.display_name || 'System'}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
