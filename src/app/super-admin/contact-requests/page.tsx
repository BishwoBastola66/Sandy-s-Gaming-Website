import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { Mail, Clock, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { InquiryStatus } from '@/types/database';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface SuperAdminContactRequestsPageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function SuperAdminContactRequestsPage({
  searchParams,
}: SuperAdminContactRequestsPageProps) {
  await requireRole(['super_admin'], '/super-admin/contact-requests');
  const { status: statusFilter } = await searchParams;

  const adminClient = await createAdminClient();

  let query = adminClient
    .from('contact_inquiries')
    .select('*')
    .order('created_at', { ascending: false });

  if (
    statusFilter &&
    (['new', 'in_progress', 'replied', 'closed'] as const).includes(statusFilter as InquiryStatus)
  ) {
    query = query.eq('status', statusFilter as InquiryStatus);
  }

  const { data: inquiries } = await query;

  // Counts for tabs
  const { data: allCounts } = await adminClient
    .from('contact_inquiries')
    .select('status');

  const counts = {
    all: allCounts?.length || 0,
    new: allCounts?.filter((i) => i.status === 'new').length || 0,
    in_progress: allCounts?.filter((i) => i.status === 'in_progress').length || 0,
    replied: allCounts?.filter((i) => i.status === 'replied').length || 0,
    closed: allCounts?.filter((i) => i.status === 'closed').length || 0,
  };

  const tabs: Array<{ key: string; label: string; count: number; href: string }> = [
    { key: 'all', label: 'All Requests', count: counts.all, href: '/super-admin/contact-requests' },
    { key: 'new', label: 'New', count: counts.new, href: '/super-admin/contact-requests?status=new' },
    { key: 'in_progress', label: 'In Progress', count: counts.in_progress, href: '/super-admin/contact-requests?status=in_progress' },
    { key: 'replied', label: 'Replied', count: counts.replied, href: '/super-admin/contact-requests?status=replied' },
    { key: 'closed', label: 'Closed', count: counts.closed, href: '/super-admin/contact-requests?status=closed' },
  ];

  const currentTab = statusFilter || 'all';

  return (
    <div className="w-full flex-1 flex flex-col px-3.5 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 animate-page-enter min-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.08] pb-4 gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2.5">
            <Mail className="h-5 w-5 text-purple-400" />
            <span>Contact &amp; Guest Inquiries</span>
          </h1>
          <p className="mt-1 text-xs text-neutral-400">
            Triage, assign, and respond to incoming inquiries submitted through the public contact portal.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-white/[0.06]">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.key;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                isActive
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-black/30 text-white' : 'bg-white/[0.08] text-neutral-400'
                }`}
              >
                {tab.count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Requests Table */}
      {!inquiries || inquiries.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.08] text-purple-400">
            <Mail className="h-5 w-5" />
          </div>
          <h3 className="mt-3.5 text-sm font-semibold text-white">No inquiries found</h3>
          <p className="mt-1 max-w-sm text-xs text-neutral-400 leading-relaxed">
            There are no contact requests matching this status filter.
          </p>
        </div>
      ) : (
        <div className="w-full overflow-x-auto border-b border-white/[0.08]">
          <table className="w-full divide-y divide-white/[0.06] text-left text-xs">
            <thead className="border-b border-white/[0.08] text-neutral-400 bg-white/[0.02]">
              <tr>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[11px]">Guest Contact</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[11px]">Subject &amp; Message</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[11px]">Status</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[11px]">Date</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[11px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {inquiries.map((inq) => {
                return (
                  <tr key={inq.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* Guest Contact Details */}
                    <td className="px-4 py-3.5 font-medium text-white">
                      <div>
                        <div className="font-semibold text-white">{inq.name}</div>
                        <div className="text-[11px] text-neutral-400 font-mono">{inq.email}</div>
                        {inq.phone && (
                          <div className="text-[10px] text-neutral-500 font-mono mt-0.5">{inq.phone}</div>
                        )}
                      </div>
                    </td>

                    {/* Message Preview */}
                    <td className="px-4 py-3.5 text-neutral-300 max-w-sm">
                      <p className="line-clamp-2 text-xs leading-relaxed">{inq.message}</p>
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize border ${
                          inq.status === 'new'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/25'
                            : inq.status === 'in_progress'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                            : inq.status === 'replied'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                            : 'bg-white/[0.06] text-neutral-400 border-white/[0.08]'
                        }`}
                      >
                        {inq.status === 'new' && <AlertCircle className="h-3 w-3" />}
                        {inq.status === 'replied' && <CheckCircle2 className="h-3 w-3" />}
                        <span>{inq.status.replace('_', ' ')}</span>
                      </span>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3.5 text-neutral-400 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-[11px]">
                        <Clock className="h-3 w-3 text-neutral-500" />
                        <span>{new Date(inq.created_at).toLocaleDateString()}</span>
                      </div>
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <Link
                        href={`/super-admin/contact-requests/${inq.id}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-500 transition-colors"
                      >
                        <span>View</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
