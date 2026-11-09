import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import Link from 'next/link';
import Image from 'next/image';
import { Inbox, Mail, BookOpen, CheckCircle, Plus, FileText, Edit, ExternalLink, Ticket, ArrowRight, ChevronRight } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { TICKET_WITH_CUSTOMER_SELECT, mapTicketRowToItem, type TicketItem } from '@/types/tickets';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminDashboardPage() {
  await requireRole(['admin'], '/admin');
  const supabase = await createAdminClient();

  let ticketsList: TicketItem[] = [];

  const [
    { count: activeConversationsCount },
    { count: pendingInquiries },
    { count: postsCount },
    { data: recentPosts },
    { count: supabaseTicketsCount },
    { count: supabaseOpenTicketsCount },
    { data: supabaseRecentTickets },
  ] = await Promise.all([
    supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .in('status', ['open', 'in_progress']),
    supabase
      .from('contact_inquiries')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'new'),
    supabase
      .from('posts')
      .select('*', { count: 'exact', head: true }),
    supabase
      .from('posts')
      .select('id, title, slug, post_type, status, cover_image, created_at, published_at')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true }),
    supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .in('status', ['open', 'in_progress']),
    supabase
      .from('tickets')
      .select(TICKET_WITH_CUSTOMER_SELECT)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const totalTickets = supabaseTicketsCount ?? 0;
  const totalOpenTickets = supabaseOpenTicketsCount ?? 0;
  if (supabaseRecentTickets && Array.isArray(supabaseRecentTickets)) {
    ticketsList = supabaseRecentTickets.map((row) =>
      mapTicketRowToItem(row as unknown as Record<string, unknown>)
    );
  }

  const totalActiveConversations = activeConversationsCount ?? 0;
  const totalInquiries = pendingInquiries ?? 0;
  const totalPosts = postsCount ?? 0;

  return (
    <div className="w-full px-3.5 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6 animate-page-enter">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-white/[0.08] gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
              Staff Operations
            </h1>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#e8364b]/15 text-[#ff6b7d] border border-[#e8364b]/30">
              Staff Console
            </span>
          </div>
          <p className="mt-0.5 text-xs text-neutral-400">
            Player support disputes, live messaging, and published gaming content.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 shrink-0">
          <Link
            href="/admin/tickets"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-xs font-medium text-neutral-200 hover:bg-white/[0.07] hover:text-white transition-colors text-center"
          >
            <Ticket className="h-3.5 w-3.5 text-[#e8364b]" />
            <span className="truncate">Tickets</span>
          </Link>
          <Link
            href="/admin/posts/new"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#e8364b] px-2.5 py-2 text-xs font-semibold text-white hover:bg-[#d12a3e] transition-colors text-center"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="truncate">Post</span>
          </Link>
        </div>
      </div>

      {/* Overview Metric Tiles - 2x2 on Mobile, 4x1 on Desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        <Link
          href="/admin/tickets"
          className="group p-3 sm:p-4 rounded-xl bg-[#111116] border border-white/[0.08] hover:border-[#e8364b]/30 hover:bg-[#15151c] transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] sm:text-xs font-semibold text-neutral-400 uppercase tracking-wider truncate">
              Tickets
            </span>
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg bg-[#e8364b]/10 text-[#e8364b] border border-[#e8364b]/20">
              <Ticket className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-bold tracking-tight tabular-nums text-white group-hover:text-[#ff6b7d] transition-colors">
              {totalTickets}
            </div>
            <p className="mt-0.5 text-[10px] sm:text-[11px] text-neutral-400 truncate">
              <span className="text-emerald-400 font-semibold">{totalOpenTickets} open</span> in queue
            </p>
          </div>
        </Link>

        <Link
          href="/admin/conversations"
          className="group p-3 sm:p-4 rounded-xl bg-[#111116] border border-white/[0.08] hover:border-blue-500/30 hover:bg-[#15151c] transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] sm:text-xs font-semibold text-neutral-400 uppercase tracking-wider truncate">
              Live Chats
            </span>
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Inbox className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-bold tracking-tight tabular-nums text-white group-hover:text-blue-300 transition-colors">
              {totalActiveConversations}
            </div>
            <p className="mt-0.5 text-[10px] sm:text-[11px] text-neutral-400 truncate">
              Active customer threads
            </p>
          </div>
        </Link>

        <Link
          href="/admin/contact-requests"
          className="group p-3 sm:p-4 rounded-xl bg-[#111116] border border-white/[0.08] hover:border-amber-500/30 hover:bg-[#15151c] transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] sm:text-xs font-semibold text-neutral-400 uppercase tracking-wider truncate">
              Inquiries
            </span>
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-bold tracking-tight tabular-nums text-white group-hover:text-amber-300 transition-colors">
              {totalInquiries}
            </div>
            <p className="mt-0.5 text-[10px] sm:text-[11px] text-neutral-400 truncate">
              Unresolved guest messages
            </p>
          </div>
        </Link>

        <Link
          href="/admin/posts"
          className="group p-3 sm:p-4 rounded-xl bg-[#111116] border border-white/[0.08] hover:border-emerald-500/30 hover:bg-[#15151c] transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] sm:text-xs font-semibold text-neutral-400 uppercase tracking-wider truncate">
              CMS Posts
            </span>
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-bold tracking-tight tabular-nums text-white group-hover:text-emerald-300 transition-colors">
              {totalPosts}
            </div>
            <p className="mt-0.5 text-[10px] sm:text-[11px] text-neutral-400 truncate">
              Published &amp; draft articles
            </p>
          </div>
        </Link>
      </div>

      {/* Content Management & Publishing Hub */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
          <div>
            <h2 className="text-xs sm:text-sm font-semibold text-white flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#e8364b]" />
              <span>Recent CMS Posts</span>
            </h2>
            <p className="text-[11px] text-neutral-400">
              Articles, guides, and tournament graphics.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/posts/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#e8364b] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#d12a3e] transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create</span>
            </Link>
            <Link
              href="/admin/posts"
              className="inline-flex items-center gap-1 text-xs font-medium text-neutral-300 hover:text-white transition-colors"
            >
              <span>View all ({totalPosts})</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {!recentPosts || recentPosts.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No articles created yet"
            description="Your CMS library is empty. Click Create to start authoring blogs, posters, or photos."
            action={
              <Link
                href="/admin/posts/new"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#e8364b] px-4 py-2 text-xs font-semibold text-white hover:bg-[#d12a3e] transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Create First Post</span>
              </Link>
            }
          />
        ) : (
          <div className="space-y-2">
            {recentPosts.map((post) => {
              const publicUrl = post.post_type === 'blog' ? `/blog/${post.slug}` : `/posts/${post.slug}`;
              return (
                <div
                  key={post.id}
                  className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl bg-[#111116] border border-white/[0.06] hover:border-white/[0.12] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {post.cover_image ? (
                      <div className="relative h-11 w-14 shrink-0 overflow-hidden rounded-lg bg-[#17171c] border border-white/[0.06]">
                        <Image
                          src={post.cover_image}
                          alt=""
                          fill
                          sizes="56px"
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="flex h-11 w-14 shrink-0 items-center justify-center rounded-lg bg-[#17171c] border border-white/[0.06] text-neutral-500">
                        <FileText className="h-4 w-4" />
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-semibold text-white truncate">
                          {post.title}
                        </h3>
                        <span
                          className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold capitalize ${
                            post.status === 'published'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                              : 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                          }`}
                        >
                          {post.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                        /{post.slug} • {new Date(post.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {post.status === 'published' && (
                      <Link
                        href={publicUrl}
                        target="_blank"
                        className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-neutral-300 hover:text-white hover:bg-white/[0.07]"
                        title="View Public Post"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span>Preview</span>
                      </Link>
                    )}
                    <Link
                      href={`/admin/posts/${post.id}/edit`}
                      className="inline-flex items-center gap-1 rounded-lg bg-white/[0.08] px-3 py-1 text-xs font-medium text-white hover:bg-white/[0.14] transition-colors"
                    >
                      <Edit className="h-3 w-3" />
                      <span>Edit</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Operational Modules (Support Tickets & Guest Inquiries) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 pt-1">
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
            <div>
              <h2 className="text-xs sm:text-sm font-semibold text-white flex items-center gap-2">
                <Ticket className="h-4 w-4 text-[#e8364b]" />
                <span>Customer Support Tickets</span>
              </h2>
              <p className="text-[11px] text-neutral-400">
                Disputes and gameplay assistance queue.
              </p>
            </div>
            <Link
              href="/admin/tickets"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#e8364b] hover:text-[#ff6b7d] transition-colors shrink-0"
            >
              <span>View all ({totalTickets})</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {ticketsList.length === 0 ? (
            <EmptyState
              icon={Ticket}
              title="No tickets currently submitted"
              description="Customer tickets submitted from their dashboard will populate here for staff triage."
            />
          ) : (
            <div className="space-y-2">
              {ticketsList.map((t) => (
                <Link
                  key={t.id}
                  href="/admin/tickets"
                  className="p-3 rounded-xl bg-[#111116] border border-white/[0.06] hover:border-[#e8364b]/30 hover:bg-[#15151c] flex items-center justify-between gap-3 transition-all group"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-neutral-400 font-semibold">
                        #{t.id.slice(0, 8)}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                          t.priority === 'urgent'
                            ? 'bg-red-500/15 text-red-400 border border-red-500/25'
                            : t.priority === 'high'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                            : 'bg-white/[0.06] text-neutral-400'
                        }`}
                      >
                        {t.priority}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold capitalize ${
                          t.status === 'open'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                            : t.status === 'in_progress'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                            : 'bg-white/[0.06] text-neutral-400'
                        }`}
                      >
                        {t.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-white group-hover:text-[#ff6b7d] truncate mt-1 transition-colors">
                      {t.title}
                    </p>
                    <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                      From {t.customer_name || 'Customer'} • {new Date(t.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-neutral-500 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="pb-2 border-b border-white/[0.06] flex items-center justify-between">
            <div>
              <h2 className="text-xs sm:text-sm font-semibold text-white flex items-center gap-2">
                <Mail className="h-4 w-4 text-amber-400" />
                <span>Guest Contact Requests</span>
              </h2>
              <p className="text-[11px] text-neutral-400">
                Inquiries received via public contact form.
              </p>
            </div>
            <Link
              href="/admin/contact-requests"
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors shrink-0"
            >
              <span>View all ({totalInquiries})</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {totalInquiries === 0 ? (
            <EmptyState
              icon={CheckCircle}
              title="All inquiries resolved"
              description="No unresolved guest messages in the queue. New submissions will populate here for review."
            />
          ) : (
            <div className="p-4 rounded-xl bg-[#111116] border border-white/[0.06] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">Pending Submissions</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/25">
                  {totalInquiries} new
                </span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                You have {totalInquiries} unanswered guest inquiries waiting for triage.
              </p>
              <Link
                href="/admin/contact-requests"
                className="inline-flex items-center justify-center gap-1.5 w-full rounded-lg bg-amber-500/15 border border-amber-500/30 px-3.5 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 transition-colors"
              >
                <span>Triage Inquiries Now</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
