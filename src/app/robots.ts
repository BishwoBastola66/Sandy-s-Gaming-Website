import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://sandygamings.com').replace(/\/$/, '');

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/blog', '/posts', '/contact'],
        disallow: [
          '/admin/',
          '/super-admin/',
          '/api/',
          '/dashboard/',
          '/account/',
          '/chat/',
          '/verify-otp',
          '/suspended/',
          '/unauthorized/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
