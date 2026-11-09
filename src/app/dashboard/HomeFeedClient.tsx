'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Calendar,
  BookOpen,
  Image as ImageIcon,
  Layers,
  ArrowUpRight,
  Search,
  FolderOpen,
} from 'lucide-react';

export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  display_order?: number;
}

export interface FeedPostItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  post_type: string;
  cover_image: string | null;
  published_at: string | null;
}

interface HomeFeedClientProps {
  initialPosts: FeedPostItem[];
  categories: CategoryItem[];
  userDisplayName: string;
  userEmail: string;
}

export function HomeFeedClient({ initialPosts, categories }: HomeFeedClientProps) {
  // Real posts from database strictly - zero mockdata
  const posts = useMemo(() => initialPosts || [], [initialPosts]);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      if (activeFilter !== 'all' && p.post_type !== activeFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const title = p.title.toLowerCase();
        const excerpt = (p.excerpt || '').toLowerCase();
        return title.includes(q) || excerpt.includes(q);
      }
      return true;
    });
  }, [posts, activeFilter, searchQuery]);

  const getTypeBadge = (post: FeedPostItem) => {
    const matchedCategory = categories.find((c) => c.slug === post.post_type);

    const label =
      matchedCategory?.name ||
      (post.post_type === 'blog'
        ? 'Esports Blog'
        : post.post_type === 'poster'
        ? 'Digital Poster'
        : post.post_type === 'photo'
        ? '4K Wallpaper'
        : 'Featured Media');

    switch (post.post_type) {
      case 'blog':
        return {
          label,
          icon: BookOpen,
          classes: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
          targetRoute: (slug: string) => `/blog/${slug}`,
        };
      case 'poster':
        return {
          label,
          icon: Layers,
          classes: 'bg-[#e8364b]/15 text-[#ff6b7d] border-[#e8364b]/30',
          targetRoute: (slug: string) => `/posts/${slug}`,
        };
      case 'photo':
        return {
          label,
          icon: ImageIcon,
          classes: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
          targetRoute: (slug: string) => `/posts/${slug}`,
        };
      default:
        return {
          label,
          icon: Layers,
          classes: 'bg-white/[0.08] text-neutral-300 border-white/[0.1]',
          targetRoute: (slug: string) => `/posts/${slug}`,
        };
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Filter & Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Category Filter Pills (Dynamically loaded from Database categories) */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-200 cursor-pointer shrink-0 ${
              activeFilter === 'all'
                ? 'bg-[#e8364b] text-white shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            All Content
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id || cat.slug}
              type="button"
              onClick={() => setActiveFilter(cat.slug)}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-200 cursor-pointer shrink-0 ${
                activeFilter === cat.slug
                  ? 'bg-[#e8364b] text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Search Input Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-2.5 h-3.5 w-3.5 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search feed..."
            className="w-full rounded-xl border border-white/[0.08] bg-[#141419] pl-9 pr-3 py-2 text-xs text-white placeholder:text-neutral-500 focus:border-[#e8364b]/50 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Grid of Post Cards or Empty State */}
      {filteredPosts.length === 0 ? (
        <div className="w-full py-16 text-center space-y-3">
          {posts.length === 0 ? (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.03] border border-white/[0.08] mx-auto text-[#e8364b]">
                <FolderOpen className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-white">No content published yet</h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed">
                Sandy&apos;s Gaming hasn&apos;t published any articles or media in this section yet. New publications will appear here automatically.
              </p>
            </>
          ) : (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.03] border border-white/[0.08] mx-auto text-neutral-400">
                <Search className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-white">No content matching filter</h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                Try choosing another category or clearing your search term to see posts.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredPosts.map((post) => {
            const badge = getTypeBadge(post);
            const BadgeIcon = badge.icon;
            const targetUrl = badge.targetRoute(post.slug);

            return (
              <article
                key={post.id}
                className="group flex flex-col rounded-2xl border border-white/[0.08] bg-[#111116] overflow-hidden hover:border-white/[0.16] hover:bg-[#14141a] transition-all duration-300"
              >
                {/* 1. Media Image Thumbnail */}
                <Link
                  href={targetUrl}
                  className="relative aspect-[16/9] w-full overflow-hidden bg-[#181820] cursor-pointer"
                >
                  {post.cover_image ? (
                    <Image
                      src={post.cover_image}
                      alt={post.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-104"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1a1a24] to-[#0d0d12] text-neutral-600">
                      <BadgeIcon className="h-10 w-10 text-neutral-500" />
                    </div>
                  )}

                  {/* Category Badge Tag on Image */}
                  <div className="absolute top-3 left-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-md border ${badge.classes}`}
                    >
                      <BadgeIcon className="h-3 w-3" />
                      <span>{badge.label}</span>
                    </span>
                  </div>
                </Link>

                {/* 2. Content Details (Date, Title, Excerpt, Action Link) */}
                <div className="flex flex-1 flex-col justify-between p-5 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {post.published_at
                          ? new Date(post.published_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : 'Recent'}
                      </span>
                    </div>

                    <h2 className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-[#ff6b7d] transition-colors">
                      <Link href={targetUrl}>{post.title}</Link>
                    </h2>

                    {post.excerpt && (
                      <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                        {post.excerpt}
                      </p>
                    )}
                  </div>

                  {/* Card Footer Link */}
                  <div className="pt-3 border-t border-white/[0.05] flex items-center justify-between">
                    <Link
                      href={targetUrl}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#e8364b] hover:text-[#ff6b7d] transition-colors"
                    >
                      <span>{post.post_type === 'blog' ? 'Read Article' : 'View Media'}</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>

                    <span className="text-[10px] font-mono text-neutral-600">
                      #{post.id.slice(0, 6)}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
