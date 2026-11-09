import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { connection } from 'next/server';
import { BookOpen, Calendar, Clock, ArrowRight, ChevronLeft, ChevronRight, Search, Flame } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { calculateReadingTime } from '@/lib/reading-time';

export const metadata: Metadata = {
  title: 'Blog & Esports News',
  description:
    "Explore competitive tournament breakdowns, patch meta analysis, gaming platform guides, and Sandy's Gaming community updates.",
  alternates: {
    canonical: '/blog',
  },
  openGraph: {
    title: "Blog & Esports News | Sandy's Gaming",
    description:
      "Explore competitive tournament breakdowns, patch meta analysis, gaming platform guides, and Sandy's Gaming community updates.",
    url: '/blog',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Blog & Esports News | Sandy's Gaming",
    description:
      "Explore competitive tournament breakdowns, patch meta analysis, gaming platform guides, and Sandy's Gaming community updates.",
  },
};

interface BlogPageProps {
  searchParams: Promise<{ page?: string; q?: string }>;
}

export default async function BlogListingPage({ searchParams }: BlogPageProps) {
  await connection();
  const { page, q } = await searchParams;
  const currentPage = Math.max(1, parseInt(page || '1', 10));
  const pageSize = 6;
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();

  let query = supabase
    .from('posts')
    .select('id, title, slug, excerpt, body, cover_image, published_at, post_type', { count: 'exact' })
    .eq('post_type', 'blog')
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
    .range(from, to);

  if (q) {
    query = query.ilike('title', `%${q.trim()}%`);
  }

  const { data: posts, count, error } = await query;

  const totalCount = count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);
  const blogList = posts || [];

  return (
    <div className="w-full max-w-[1720px] mx-auto px-4 py-12 sm:px-8 lg:px-12 xl:px-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between border-b border-white/[0.06] pb-8 gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-[var(--brand-primary)]">
            <Flame className="h-4 w-4" />
            <span>Sandy&apos;s Editorial &amp; Esports Feed</span>
          </div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-[var(--text-primary)] sm:text-4xl">
            Latest Publications
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)] max-w-2xl leading-relaxed">
            In-depth guides on competitive gaming, esports rosters, and platform updates curated by Sandy&apos;s Gaming.
          </p>
        </div>

        {/* Search Input Bar */}
        <form method="get" action="/blog" className="relative w-full max-w-xs">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[var(--text-muted)]">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="search"
            name="q"
            defaultValue={q || ''}
            placeholder="Search articles..."
            className="block w-full rounded-xl border border-white/[0.08] bg-[var(--surface-secondary)] py-2.5 pr-3 pl-10 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] hover:border-white/[0.18] focus:border-white/35 focus:outline-none focus:ring-1 focus:ring-white/[0.08] transition-all duration-200"
          />
        </form>
      </div>

      {/* Content Feed */}
      <div className="mt-10">
        {error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-950/20 p-6 text-sm text-red-400">
            Unable to load articles right now. Please refresh or try again shortly.
          </div>
        ) : blogList.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={q ? `No articles matching "${q}"` : 'No published articles yet'}
            description={
              q
                ? 'Try searching with different keywords or clear the search query to see all articles.'
                : 'Our editorial team is preparing new publication posts. Check back soon for fresh content.'
            }
            action={
              q ? (
                <Link
                  href="/blog"
                  className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-white"
                >
                  Clear Search
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {blogList.map((post) => {
              const formattedDate = post.published_at
                ? new Date(post.published_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Recently published';

              return (
                <article
                  key={post.id}
                  className="gaming-card group flex flex-col justify-between overflow-hidden"
                >
                  <div>
                    {post.cover_image && (
                      <div className="relative aspect-video w-full overflow-hidden bg-[var(--surface-secondary)]">
                        <Image
                          src={post.cover_image}
                          alt={post.title}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                          unoptimized
                        />
                        <div className="absolute top-3 left-3 rounded-full glass px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                          BLOG
                        </div>
                      </div>
                    )}
                    <div className="p-6">
                      <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] font-mono mb-3">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
                          <time dateTime={post.published_at || ''}>{formattedDate}</time>
                        </span>
                        <span className="opacity-40">&bull;</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                          <span>{calculateReadingTime(post.body, post.excerpt)}</span>
                        </span>
                      </div>

                      <h2 className="text-base font-bold text-[var(--text-primary)] group-hover:text-[var(--brand-primary)] transition-colors duration-300 line-clamp-2">
                        <Link href={`/blog/${encodeURIComponent(post.slug)}`}>
                          {post.title}
                        </Link>
                      </h2>

                      {post.excerpt && (
                        <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)] line-clamp-3">
                          {post.excerpt}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-white/[0.04] p-6 pt-3 pb-4">
                    <Link
                      href={`/blog/${encodeURIComponent(post.slug)}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--brand-primary)] group/link"
                    >
                      <span>Read article</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover/link:translate-x-1" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Bounded Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-12 flex items-center justify-between border-t border-white/[0.06] pt-6">
            <div className="text-xs text-[var(--text-muted)] font-mono">
              Showing page <span className="font-semibold text-white">{currentPage}</span> of{' '}
              <span className="font-semibold text-white">{totalPages}</span> ({totalCount} total articles)
            </div>

            <div className="flex items-center gap-2">
              {currentPage > 1 ? (
                <Link
                  href={`/blog?page=${currentPage - 1}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                  className="inline-flex items-center gap-1.5 rounded-xl glass px-3.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-white transition-all duration-300"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Previous</span>
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-xl glass px-3.5 py-1.5 text-xs font-semibold text-[var(--text-muted)] opacity-40 cursor-not-allowed">
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Previous</span>
                </span>
              )}

              {currentPage < totalPages ? (
                <Link
                  href={`/blog?page=${currentPage + 1}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                  className="inline-flex items-center gap-1.5 rounded-xl glass px-3.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-white transition-all duration-300"
                >
                  <span>Next</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-xl glass px-3.5 py-1.5 text-xs font-semibold text-[var(--text-muted)] opacity-40 cursor-not-allowed">
                  <span>Next</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
