'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Flame,
  Globe,
  ArrowRight,
  ShieldCheck,
  BookOpen,
  ImageIcon,
  Loader2,
} from 'lucide-react';
import type { PostType } from '@/types/database';
import { FeedPostSkeleton } from '@/components/ui/Skeleton';

export interface FeedPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body?: string | null;
  cover_image: string | null;
  post_type: PostType;
  published_at: string | null;
  created_at?: string;
  initialLikes?: number;
  commentsCount?: number;
}

const BATCH_SIZE = 6;

export function SocialFeed({ initialPosts = [] }: { initialPosts?: FeedPost[] }) {
  const [filter, setFilter] = useState<'all' | 'blog' | 'gallery'>('all');
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Strictly real database posts - zero mockdata
  const allPosts = initialPosts;

  const filteredPosts = allPosts.filter((p) => {
    if (filter === 'blog') return p.post_type === 'blog';
    if (filter === 'gallery') return p.post_type === 'poster' || p.post_type === 'photo';
    return true;
  });

  const displayedPosts = filteredPosts.slice(0, visibleCount);
  const hasMore = visibleCount < filteredPosts.length;

  const handleLoadMore = () => {
    setIsLoadingMore(true);
    // Smooth step-by-step progressive chunk loading with skeleton feedback
    setTimeout(() => {
      setVisibleCount((prev) => prev + BATCH_SIZE);
      setIsLoadingMore(false);
    }, 600);
  };

  const formatTimestamp = (dateStr?: string | null) => {
    if (!dateStr) return 'Recently';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return 'Recently';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const filters = [
    { key: 'all' as const, label: 'All Updates', icon: null },
    { key: 'blog' as const, label: 'Articles', icon: BookOpen },
    { key: 'gallery' as const, label: 'Art & Posters', icon: ImageIcon },
  ];

  return (
    <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16">
      {/* Feed Controls Header */}
      <div className="mb-8 border-b border-white/[0.06] pb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-[var(--brand-primary)]">
            <Flame className="h-4 w-4" />
            <span>Community &amp; Esports Feed</span>
          </div>
          <h2 className="text-2xl sm:text-3xl xl:text-4xl font-black tracking-tight text-white mt-1">
            Sandy&apos;s Live Stream
          </h2>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl glass text-xs font-semibold">
          {filters.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setFilter(key);
                setVisibleCount(BATCH_SIZE);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all duration-300 ${
                filter === key
                  ? 'btn-primary text-white'
                  : 'text-[var(--text-secondary)] hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {Icon && <Icon className="h-3 w-3" />}
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Responsive Full-Width Grid or Clean Empty State */}
      {displayedPosts.length === 0 ? (
        <div className="w-full py-20 sm:py-28 flex flex-col items-center justify-center text-center space-y-2">
          <h3 className="text-base font-semibold text-white">No articles published yet</h3>
          <p className="text-xs sm:text-sm text-neutral-400 max-w-md mx-auto leading-relaxed">
            Sandy&apos;s Gaming hasn&apos;t published any updates in this category yet. Stay tuned for new announcements!
          </p>
          {filter !== 'all' && (
            <button
              type="button"
              onClick={() => setFilter('all')}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-xs font-medium text-neutral-200 hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
            >
              <span>View All Updates</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedPosts.map((post, index) => {
            const detailUrl = post.post_type === 'blog' ? `/blog/${post.slug}` : `/posts/${post.slug}`;

            return (
              <article
                key={post.id}
                className="rounded-2xl glass-elevated overflow-hidden flex flex-col justify-between transition-all duration-300 hover:shadow-2xl"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
              <div>
                {/* Post Header: Avatar, Author, Timestamp (No highlight border around image) */}
                <div className="p-4 sm:p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative h-10 w-10 rounded-full overflow-hidden bg-[var(--surface-secondary)] flex items-center justify-center shrink-0">
                      <Image
                        src="/brand/sandys-gaming-logo.png"
                        alt="Sandy's Gaming"
                        width={40}
                        height={40}
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm text-white">
                          Sandy&apos;s Esports HQ
                        </span>
                        <ShieldCheck className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] font-mono">
                        <span>{formatTimestamp(post.published_at)}</span>
                        <span className="opacity-40">·</span>
                        <span className="flex items-center gap-1 font-sans">
                          <Globe className="h-3 w-3" />
                          <span>Public</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full glass text-[10px] font-semibold tracking-wide text-[var(--text-secondary)]">
                    {post.post_type === 'blog' ? 'Article' : 'Artwork'}
                  </span>
                </div>

                {/* Post Copy / Content */}
                <div className="px-4 sm:px-5 pb-3 space-y-1.5">
                  <Link href={detailUrl} className="group block">
                    <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-[var(--brand-primary)] transition-colors duration-300 leading-snug line-clamp-2">
                      {post.title}
                    </h3>
                  </Link>
                  {post.excerpt && (
                    <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-2">
                      {post.excerpt}
                    </p>
                  )}
                </div>

                {/* Post Media (Clean image presentation without border highlight) */}
                {post.cover_image && (
                  <Link href={detailUrl} className="block relative aspect-[16/9] w-full bg-[var(--background)] overflow-hidden group">
                    <Image
                      src={post.cover_image}
                      alt={post.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                    />
                  </Link>
                )}
              </div>

              {/* Action Footer */}
              <div className="p-4 sm:p-5 flex items-center justify-between border-t border-white/[0.04]">
                <span className="font-mono text-[11px] text-[var(--text-muted)]">
                  {post.post_type === 'blog' ? 'Editorial' : 'Media'}
                </span>

                <Link
                  href={detailUrl}
                  className="btn-ghost inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-white group"
                >
                  <span>{post.post_type === 'blog' ? 'Read Article' : 'View Artwork'}</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </div>
            </article>
          );
        })}

        {/* Shimmer Skeletons while step-by-step loading next batch */}
        {isLoadingMore && (
          <>
            <FeedPostSkeleton />
            <FeedPostSkeleton />
            <FeedPostSkeleton />
          </>
        )}
      </div>
      )}

      {/* Step-by-Step Progressive Load More Button */}
      {hasMore && (
        <div className="mt-12 flex justify-center">
          <button
            type="button"
            disabled={isLoadingMore}
            onClick={handleLoadMore}
            className="btn-ghost inline-flex items-center gap-2.5 rounded-2xl px-8 py-3.5 text-sm font-semibold text-white hover:border-white/[0.15] disabled:opacity-50 transition-all duration-300"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-[var(--brand-primary)]" />
                <span>Loading Next Batch...</span>
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4 text-[var(--brand-primary)]" />
                <span>Load More Updates ({filteredPosts.length - visibleCount} remaining)</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
