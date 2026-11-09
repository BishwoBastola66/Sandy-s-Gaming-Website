import type { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://sandygamings.com').replace(/\/$/, '');
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/posts`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.75,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/register`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  try {
    const supabase = await createClient();
    const { data: posts } = await supabase
      .from('posts')
      .select('slug, updated_at, published_at, post_type')
      .eq('status', 'published')
      .lte('published_at', now.toISOString())
      .order('published_at', { ascending: false })
      .limit(500);

    const postRoutes: MetadataRoute.Sitemap = (posts || []).map((p) => ({
      url:
        p.post_type === 'blog'
          ? `${baseUrl}/blog/${encodeURIComponent(p.slug)}`
          : `${baseUrl}/posts/${encodeURIComponent(p.slug)}`,
      lastModified: new Date(p.updated_at || p.published_at || now),
      changeFrequency: p.post_type === 'blog' ? 'weekly' : 'monthly',
      priority: 0.8,
    }));

    return [...staticRoutes, ...postRoutes];
  } catch {
    return staticRoutes;
  }
}
