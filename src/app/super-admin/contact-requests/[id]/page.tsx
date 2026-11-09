import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { InquiryDetailClient, EmailConfigInfo } from '@/app/admin/contact-requests/[id]/InquiryDetailClient';
import { getEmailAdapter } from '@/lib/email/adapter';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Inquiry Detail | Super Admin Operations',
  description: 'Manage guest contact inquiry triage, assignment, and reply history.',
};

interface SuperAdminInquiryDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function SuperAdminInquiryDetailPage({ params }: SuperAdminInquiryDetailPageProps) {
  const profile = await requireRole(['super_admin'], '/super-admin/contact-requests');
  const { id } = await params;

  const adminClient = await createAdminClient();

  const { data: inquiry, error: inqError } = await adminClient
    .from('contact_inquiries')
    .select('*')
    .eq('id', id)
    .single();

  if (inqError || !inquiry) {
    notFound();
  }

  const { data: replies } = await adminClient
    .from('contact_inquiry_replies')
    .select('*')
    .eq('inquiry_id', id)
    .order('created_at', { ascending: true });

  const { data: staffList } = await adminClient
    .from('accounts')
    .select('id, display_name, email, role')
    .in('role', ['admin', 'super_admin'])
    .eq('account_status', 'active')
    .order('display_name', { ascending: true });

  const staffMap = new Map(staffList?.map((s) => [s.id, s]) || []);

  const enrichedReplies = (replies || []).map((r) => ({
    ...r,
    admin: staffMap.get(r.admin_id) || null,
  }));

  const emailAdapter = getEmailAdapter();
  const emailConfig: EmailConfigInfo = {
    isConfigured: emailAdapter.isConfigured,
    provider: emailAdapter.name,
    fromAddress: process.env.EMAIL_FROM_ADDRESS || 'support@sandygamings.com',
  };

  return (
    <div className="w-full flex-1 px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6 animate-page-enter">
      <div className="flex items-center gap-3 border-b border-white/[0.08] pb-4">
        <Link
          href="/super-admin/contact-requests"
          className="rounded-xl border border-white/[0.08] bg-[#14151c] p-2.5 text-neutral-400 hover:text-white hover:bg-white/[0.06] hover:border-white/20 transition-all cursor-pointer shadow-sm"
          title="Back to Inquiries"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight text-white">
              Inquiry from {inquiry.name || 'Anonymous Guest'}
            </h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize ${
                inquiry.status === 'new'
                  ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                  : inquiry.status === 'in_progress'
                  ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                  : inquiry.status === 'replied'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-white/[0.06] text-neutral-300 border border-white/10'
              }`}
            >
              {inquiry.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1 font-mono flex items-center gap-2 flex-wrap">
            <span>{inquiry.email}</span>
            <span>&bull;</span>
            <span>Received on {new Date(inquiry.created_at).toLocaleString()}</span>
          </p>
        </div>
      </div>

      <InquiryDetailClient
        inquiry={inquiry}
        replies={enrichedReplies}
        availableStaff={staffList || []}
        currentUserId={profile.id}
        emailConfig={emailConfig}
      />
    </div>
  );
}
