import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sandy's Gaming — Elite Esports, Gaming Platforms & 24/7 Live Support",
    short_name: "Sandy's Gaming",
    description:
      "Dominate the arena with Sandy's Gaming. Verified gaming platforms, competitive esports articles, exclusive artwork gallery, and 24/7 live chat support.",
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0c',
    theme_color: '#e8364b',
    orientation: 'portrait-primary',
    categories: ['games', 'entertainment', 'esports'],
    icons: [
      {
        src: '/brand/sandys-gaming-logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/brand/sandys-gaming-logo.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}

