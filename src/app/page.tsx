import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { CinematicHeroContainer } from '@/components/home/CinematicHeroContainer';
import { SocialFeed } from '@/components/home/SocialFeed';
import { PlatformDirectory } from '@/components/games/PlatformDirectory';
import { getActivePlatforms, getPlatformCategories } from '@/lib/platforms/store';
import type { GamingApp } from '@/types/gaming-platform';
import {
  BookOpen,
  MessageSquare,
  ArrowRight,
  Calendar,
  Sparkles,
  Flame,
  Users,
} from 'lucide-react';

import type { Database } from '@/types/database';
import type { FeedPost } from '@/components/home/SocialFeed';

export const metadata: Metadata = {
  alternates: {
    canonical: '/',
  },
};

type PostRow = Database['public']['Tables']['posts']['Row'];

async function DynamicHomeFeed() {
  let feedPosts: FeedPost[] = [];
  let blogs: Pick<PostRow, 'id' | 'title' | 'slug' | 'excerpt' | 'cover_image' | 'published_at'>[] = [];
  let gallery: Pick<PostRow, 'id' | 'title' | 'slug' | 'excerpt' | 'cover_image' | 'post_type' | 'published_at'>[] = [];
  let platforms: GamingApp[] = [];
  let categoriesWithCounts: { slug: string; name: string; count?: number }[] = [];

  try {
    const supabase = await createClient();
    const nowIso = new Date().toISOString();

    const [feedRes, blogsRes, galleryRes, dbPlatforms, rawCats] = await Promise.all([
      supabase
        .from('posts')
        .select('id, title, slug, excerpt, cover_image, post_type, published_at, created_at')
        .eq('status', 'published')
        .lte('published_at', nowIso)
        .order('published_at', { ascending: false })
        .limit(18),
      supabase
        .from('posts')
        .select('id, title, slug, excerpt, cover_image, published_at')
        .eq('post_type', 'blog')
        .eq('status', 'published')
        .lte('published_at', nowIso)
        .order('published_at', { ascending: false })
        .limit(3),
      supabase
        .from('posts')
        .select('id, title, slug, excerpt, cover_image, post_type, published_at')
        .in('post_type', ['poster', 'photo'])
        .eq('status', 'published')
        .lte('published_at', nowIso)
        .order('published_at', { ascending: false })
        .limit(3),
      getActivePlatforms().catch(() => []),
      getPlatformCategories().catch(() => []),
    ]);

    feedPosts = feedRes.data || [];
    blogs = blogsRes.data || [];
    gallery = galleryRes.data || [];
    platforms = dbPlatforms || [];
    categoriesWithCounts = (rawCats || []).map((cat) => ({
      slug: cat.slug,
      name: cat.name,
      count: cat.slug === 'all'
        ? platforms.length
        : platforms.filter((p) => p.category === cat.slug).length,
    }));
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'digest' in error && (error as { digest?: string }).digest === 'DYNAMIC_SERVER_USAGE') {
      throw error;
    }
    console.error('Error fetching home feed:', error);
  }

  return (
    <>
      {/* 2. Official Gaming Platforms & Downloads */}
      <PlatformDirectory initialPlatforms={platforms} initialCategories={categoriesWithCounts} />

      {/* 3. Community & Esports Social Feed */}
      <section className="relative">
        <SocialFeed initialPosts={feedPosts} />
      </section>

      {/* 3. Featured Esports Articles Section */}
      {blogs.length > 0 && (
        <section className="w-full max-w-[1720px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between border-b border-white/[0.06] pb-4 gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-[var(--brand-primary)]">
                <BookOpen className="h-4 w-4" />
                <span>Editorial Feed</span>
              </div>
              <h2 className="mt-1 text-2xl sm:text-3xl xl:text-4xl font-black tracking-tight text-[var(--text-primary)]">
                Recent Publications
              </h2>
            </div>
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--brand-primary)] transition-colors duration-300"
            >
              <span>View All Articles</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {blogs.map((post) => (
              <article
                key={post.id}
                className="gaming-card group flex flex-col overflow-hidden"
              >
                <div className="relative aspect-video w-full overflow-hidden bg-[var(--surface-secondary)]">
                  {post.cover_image ? (
                    <Image
                      src={post.cover_image}
                      alt={post.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[var(--text-muted)]">
                      <BookOpen className="h-10 w-10 opacity-20" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3 rounded-full glass px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                    BLOG
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] font-mono">
                    <Calendar className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
                    <time dateTime={post.published_at || ''}>
                      {post.published_at
                        ? new Date(post.published_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : 'Published'}
                    </time>
                  </div>

                  <h3 className="mt-2.5 text-base sm:text-lg font-bold text-[var(--text-primary)] group-hover:text-[var(--brand-primary)] transition-colors duration-300 line-clamp-2">
                    <Link href={`/blog/${post.slug}`}>
                      <span className="absolute inset-0" />
                      {post.title}
                    </Link>
                  </h3>

                  {post.excerpt && (
                    <p className="mt-2 text-xs sm:text-sm text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                      {post.excerpt}
                    </p>
                  )}

                  <div className="mt-auto pt-4 flex items-center gap-1.5 text-xs font-semibold text-[var(--brand-primary)]">
                    <span>Read Article</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* 4. Posters & Visual Media Showcase */}
      {gallery.length > 0 && (
        <section className="w-full max-w-[1720px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between border-b border-white/[0.06] pb-4 gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-[var(--brand-primary)]">
                <Flame className="h-4 w-4" />
                <span>Gallery &amp; Artwork</span>
              </div>
              <h2 className="mt-1 text-2xl sm:text-3xl xl:text-4xl font-black tracking-tight text-[var(--text-primary)]">
                Featured Posters &amp; Visuals
              </h2>
            </div>
            <Link
              href="/posts"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--brand-primary)] transition-colors duration-300"
            >
              <span>Explore Gallery</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {gallery.map((post) => (
              <article
                key={post.id}
                className="gaming-card group flex flex-col overflow-hidden"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--surface-secondary)]">
                  {post.cover_image ? (
                    <Image
                      src={post.cover_image}
                      alt={post.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[var(--text-muted)]">
                      <Sparkles className="h-10 w-10 opacity-20" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3 rounded-full glass px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)] capitalize">
                    {post.post_type}
                  </div>
                </div>

                <div className="p-5">
                  <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] group-hover:text-[var(--brand-primary)] transition-colors duration-300 line-clamp-1">
                    <Link href={`/posts/${post.slug}`}>
                      <span className="absolute inset-0" />
                      {post.title}
                    </Link>
                  </h3>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export default function HomePage() {
  return (
    <div className="relative isolate overflow-hidden space-y-28">
      {/* 1. Cinematic Hero Container (Instant render, no blocking loading screen) */}
      <CinematicHeroContainer />

      {/* 2. Dynamic Posts Feed (Async streaming with zero blocking screen) */}
      <Suspense fallback={null}>
        <DynamicHomeFeed />
      </Suspense>

      {/* 3. Live Support CTA Banner */}
      <section className="w-full max-w-[1720px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16 pb-20">
        <div className="relative rounded-3xl glass-elevated p-8 sm:p-14 overflow-hidden">
          <div className="relative z-10 max-w-2xl space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs font-semibold text-[var(--brand-primary)]">
              <Users className="h-3.5 w-3.5" />
              <span>Direct Support</span>
            </div>
            <h2 className="text-3xl sm:text-4xl xl:text-5xl font-black tracking-tight text-[var(--text-primary)] leading-tight">
              Need Help or Tournament Inquiries?
            </h2>
            <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
              Connect directly with our staff via authenticated live chat or submit a guest inquiry. We are here to support every player.
            </p>
            <div className="pt-2 flex flex-wrap gap-3">
              <Link
                href="/chat"
                className="btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Open Live Chat</span>
              </Link>
              <Link
                href="/contact"
                className="btn-ghost inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-[var(--text-primary)]"
              >
                <span>Submit Guest Ticket</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
