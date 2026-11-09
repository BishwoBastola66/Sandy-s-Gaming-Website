import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { connection } from 'next/server';
import { Image as ImageIcon, ArrowRight, Layers, Flame } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

export const metadata: Metadata = {
  title: 'Visual Gallery & Posters',
  description:
    "Browse high-resolution 4K gaming wallpapers, esports artwork posters, and official visual media released by Sandy's Gaming.",
  alternates: {
    canonical: '/posts',
  },
  openGraph: {
    title: "Visual Gallery & Posters | Sandy's Gaming",
    description:
      "Browse high-resolution 4K gaming wallpapers, esports artwork posters, and official visual media released by Sandy's Gaming.",
    url: '/posts',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Visual Gallery & Posters | Sandy's Gaming",
    description:
      "Browse high-resolution 4K gaming wallpapers, esports artwork posters, and official visual media released by Sandy's Gaming.",
  },
};

interface PostsGalleryPageProps {
  searchParams: Promise<{ type?: string }>;
}

export default async function PostsGalleryPage({ searchParams }: PostsGalleryPageProps) {
  await connection();
  const { type } = await searchParams;
  const activeFilter = type === 'poster' || type === 'photo' ? type : 'all';

  const supabase = await createClient();

  const query = supabase
    .from('posts')
    .select('id, title, slug, excerpt, cover_image, post_type, published_at')
    .in('post_type', activeFilter === 'all' ? ['poster', 'photo'] : [activeFilter])
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
    .limit(18);

  const { data: posts, error } = await query;
  const galleryItems = posts || [];

  return (
    <div className="w-full max-w-[1720px] mx-auto px-4 py-12 sm:px-8 lg:px-12 xl:px-16">
      {/* Gallery Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between border-b border-white/[0.06] pb-8 gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-[var(--brand-primary)]">
            <Flame className="h-4 w-4" />
            <span>Official Artwork &amp; Media</span>
          </div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-[var(--text-primary)] sm:text-4xl">
            Visual Media &amp; Posters
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)] max-w-2xl leading-relaxed">
            Curated high-res esports wallpapers, custom digital posters, and creative assets released by Sandy&apos;s Gaming.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 rounded-2xl glass p-1 self-start md:self-auto">
          {[
            { key: 'all', label: 'All Media', href: '/posts' },
            { key: 'poster', label: 'Posters', href: '/posts?type=poster' },
            { key: 'photo', label: 'Wallpapers', href: '/posts?type=photo' },
          ].map(({ key, label, href }) => (
            <Link
              key={key}
              href={href}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all duration-300 ${
                activeFilter === key
                  ? 'btn-primary text-white'
                  : 'text-[var(--text-secondary)] hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="mt-10">
        {error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-950/20 p-6 text-sm text-red-400">
            Unable to load gallery items right now. Please refresh or try again shortly.
          </div>
        ) : galleryItems.length === 0 ? (
          <EmptyState
            icon={ImageIcon}
            title={`No published ${activeFilter === 'all' ? 'gallery items' : activeFilter + 's'} found`}
            description="Our creative team is crafting new visual works. Published posters and wallpapers will appear here."
            action={
              activeFilter !== 'all' ? (
                <Link
                  href="/posts"
                  className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-white"
                >
                  View All Gallery Works
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {galleryItems.map((item) => (
              <div
                key={item.id}
                className="gaming-card group relative flex flex-col overflow-hidden"
              >
                {item.cover_image && (
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--surface-secondary)]">
                    <Image
                      src={item.cover_image}
                      alt={item.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                      unoptimized
                    />
                    <div className="absolute top-3 left-3">
                      <span className="inline-flex items-center gap-1 rounded-full glass px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)] backdrop-blur-md uppercase tracking-wide">
                        <Layers className="h-3 w-3 text-[var(--brand-primary)]" />
                        <span>{item.post_type}</span>
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex flex-1 flex-col justify-between p-6">
                  <div>
                    <h2 className="text-base font-bold tracking-tight text-[var(--text-primary)] group-hover:text-[var(--brand-primary)] transition-colors duration-300">
                      <Link href={`/posts/${encodeURIComponent(item.slug)}`}>
                        {item.title}
                      </Link>
                    </h2>
                    {item.excerpt && (
                      <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)] line-clamp-2">
                        {item.excerpt}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/[0.04]">
                    <Link
                      href={`/posts/${encodeURIComponent(item.slug)}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--brand-primary)] group/link"
                    >
                      <span>View asset &amp; details</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover/link:translate-x-1" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
