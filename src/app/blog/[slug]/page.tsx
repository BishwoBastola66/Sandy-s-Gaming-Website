import { cache } from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { Calendar, Clock, ArrowLeft, User, MessageSquare } from 'lucide-react';
import { calculateReadingTime } from '@/lib/reading-time';

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://sandygamings.com').replace(/\/$/, '');

const getPublishedBlogPost = cache(async (slug: string) => {
  const cleanSlug = slug.trim();
  if (!cleanSlug) return null;

  const supabase = await createClient();
  const { data: post, error } = await supabase
    .from('posts')
    .select('*')
    .eq('slug', cleanSlug)
    .eq('post_type', 'blog')
    .eq('status', 'published')
    .maybeSingle();

  if (error || !post) return null;
  const coverUrl = resolveImageUrl(supabase, post.cover_image);
  return { post, coverUrl };
});

function resolveImageUrl(supabase: { storage: { from: (bucket: string) => { getPublicUrl: (path: string) => { data: { publicUrl: string } } } } }, pathOrUrl: string | null | undefined): string {
  if (!pathOrUrl) return '';
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  const clean = pathOrUrl.startsWith('/') ? pathOrUrl.slice(1) : pathOrUrl;
  return supabase.storage.from('public-media').getPublicUrl(clean).data.publicUrl;
}

function renderArticleBody(content: string) {
  if (!content) return null;
  const paragraphs = content.split(/\n\s*\n/);

  return (
    <div className="space-y-6 text-sm sm:text-base leading-relaxed text-[var(--text-secondary)]">
      {paragraphs.map((para, i) => {
        const trimmed = para.trim();
        if (!trimmed) return null;

        // Image check: ![alt](url)
        if (trimmed.includes('![') && trimmed.includes('](')) {
          const parts = trimmed.split(/(!\[[\s\S]*?\]\([\s\S]*?\))/g);
          return (
            <div key={i} className="space-y-3">
              {parts.map((part, pIdx) => {
                const subImg = part.match(/^!\[([\s\S]*?)\]\(([\s\S]*?)\)$/);
                if (subImg) {
                  const alt = subImg[1].trim();
                  const src = subImg[2].trim().replace(/\s+/g, '');
                  return (
                    <div key={pIdx} className="my-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-black/40 shadow-xl">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={alt || 'Article Image'} className="w-full max-h-[550px] object-cover" loading="lazy" />
                      {alt && <p className="p-2.5 text-center text-xs text-neutral-400 bg-black/50 border-t border-white/[0.06]">{alt}</p>}
                    </div>
                  );
                }
                return part.trim() ? (
                  <p key={pIdx} className="whitespace-pre-line leading-relaxed text-[var(--text-secondary)]">
                    {part}
                  </p>
                ) : null;
              })}
            </div>
          );
        }

        if (trimmed.startsWith('# ')) {
          return (
            <h2 key={i} className="text-xl sm:text-2xl font-bold text-white tracking-tight pt-2 border-b border-white/[0.08] pb-2">
              {trimmed.replace(/^# /, '')}
            </h2>
          );
        }

        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={i} className="text-lg sm:text-xl font-bold text-white tracking-tight pt-2">
              {trimmed.replace(/^## /, '')}
            </h3>
          );
        }

        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={i} className="text-base font-semibold text-neutral-200">
              {trimmed.replace(/^### /, '')}
            </h4>
          );
        }

        if (trimmed.startsWith('> ')) {
          return (
            <blockquote key={i} className="border-l-4 border-[#e8364b] bg-white/[0.03] pl-4 py-2 italic text-neutral-300 rounded-r-lg">
              {trimmed.replace(/^> /, '')}
            </blockquote>
          );
        }

        return (
          <p key={i} className="whitespace-pre-line leading-relaxed text-[var(--text-secondary)]">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!slug) return { title: 'Article Not Found' };

  const result = await getPublishedBlogPost(slug);

  if (!result) {
    return {
      title: 'Article Not Found',
      description: 'The requested article could not be located.',
      robots: { index: false, follow: false },
    };
  }

  const { post, coverUrl } = result;
  const canonicalPath = `/blog/${encodeURIComponent(post.slug)}`;

  return {
    title: post.title,
    description: post.excerpt || "Read this esports and gaming article on Sandy's Gaming.",
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      type: 'article',
      url: canonicalPath,
      title: post.title,
      description: post.excerpt || "Read this esports and gaming article on Sandy's Gaming.",
      publishedTime: post.published_at || post.created_at,
      modifiedTime: post.updated_at || post.published_at || post.created_at,
      authors: ["Sandy's Editorial Team"],
      images: coverUrl ? [{ url: coverUrl, alt: post.title }] : ['/brand/og-banner.png'],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt || "Read this esports and gaming article on Sandy's Gaming.",
      images: coverUrl ? [coverUrl] : ['/brand/og-banner.png'],
    },
  };
}

export default async function BlogPostDetailPage({ params }: BlogPostPageProps) {
  await connection();
  const { slug } = await params;

  if (!slug || typeof slug !== 'string' || slug.trim().length === 0) {
    notFound();
  }

  const result = await getPublishedBlogPost(slug);

  if (!result) {
    notFound();
  }

  const { post, coverUrl } = result;

  const formattedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Recently published';

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.excerpt || post.title,
        image: coverUrl ? [coverUrl] : [`${siteUrl}/brand/sandys-gaming-logo.png`],
        datePublished: post.published_at || post.created_at,
        dateModified: post.updated_at || post.published_at || post.created_at,
        author: {
          '@type': 'Organization',
          name: "Sandy's Editorial Team",
          url: siteUrl,
        },
        publisher: {
          '@type': 'Organization',
          name: "Sandy's Gaming",
          logo: {
            '@type': 'ImageObject',
            url: `${siteUrl}/brand/sandys-gaming-logo.png`,
          },
        },
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': `${siteUrl}/blog/${encodeURIComponent(post.slug)}`,
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: siteUrl,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Blog',
            item: `${siteUrl}/blog`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: post.title,
            item: `${siteUrl}/blog/${encodeURIComponent(post.slug)}`,
          },
        ],
      },
    ],
  };

  return (
    <article className="w-full max-w-[1720px] mx-auto px-4 py-12 sm:px-8 lg:px-12 xl:px-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to All Articles</span>
        </Link>

        <span className="inline-flex items-center rounded-full glass px-3 py-0.5 text-xs font-semibold text-[var(--brand-primary)]">
          Published Article
        </span>
      </div>

      {/* Article Header */}
      <header className="mt-8 space-y-4 max-w-4xl">
        <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)] sm:text-5xl leading-tight">
          {post.title}
        </h1>

        <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-muted)] font-mono border-y border-white/[0.06] py-3.5">
          <div className="flex items-center gap-1.5 font-sans font-semibold text-[var(--text-secondary)]">
            <User className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
            <span>Sandy&apos;s Editorial Team</span>
          </div>
          <span className="opacity-40">&bull;</span>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
            <time dateTime={post.published_at || ''}>{formattedDate}</time>
          </div>
          <span className="opacity-40">&bull;</span>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            <span>{calculateReadingTime(post.body, post.excerpt)}</span>
          </div>
        </div>

        {post.excerpt && (
          <p className="text-base sm:text-lg leading-relaxed text-[var(--text-secondary)] font-medium italic">
            &ldquo;{post.excerpt}&rdquo;
          </p>
        )}
      </header>

      {/* Featured Cover Image */}
      {coverUrl && (
        <div className="relative mt-8 h-80 sm:h-[480px] xl:h-[600px] w-full overflow-hidden rounded-3xl glass-elevated">
          <Image
            src={coverUrl}
            alt={post.title}
            fill
            priority
            sizes="(max-width: 1720px) 100vw, 1720px"
            className="object-cover"
            unoptimized
          />
        </div>
      )}

      {/* Article Body Content */}
      <div className="mt-10 max-w-4xl">
        {post.body ? (
          renderArticleBody(post.body)
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">No content provided for this article.</p>
        )}
      </div>

      {/* Article Footer */}
      <footer className="mt-14 border-t border-white/[0.06] pt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 max-w-4xl">
        <div>
          <h4 className="text-sm font-bold text-[var(--text-primary)]">Have questions or feedback?</h4>
          <p className="text-xs text-[var(--text-secondary)]">Reach out directly to our team via guest inquiry or live support.</p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/contact"
            className="btn-ghost inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-[var(--text-primary)]"
          >
            <span>Contact Us</span>
          </Link>
          <Link
            href="/chat"
            className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-white"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Start Live Chat</span>
          </Link>
        </div>
      </footer>
    </article>
  );
}
