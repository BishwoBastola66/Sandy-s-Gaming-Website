import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/navigation/Navbar';
import { Footer } from '@/components/layout/Footer';
import { getCurrentProfile } from '@/lib/auth';

const interSans = Inter({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
  preload: true,
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
  preload: true,
});

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://sandygamings.com').replace(/\/$/, '');

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0a0a0c',
  colorScheme: 'dark',
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "Sandy's Gaming",
  title: {
    default: "SANDY'S GAMING — Elite Esports, Gaming Platforms & 24/7 Live Support",
    template: "%s | Sandy's Gaming",
  },
  description:
    "Dominate the arena with Sandy's Gaming. Official gaming platform downloads, competitive esports news, 4K visual artwork gallery, and 24/7 dedicated live chat support.",
  keywords: [
    "Sandy's Gaming",
    'Sandy Gaming',
    'sandygamings',
    'esports hub',
    'gaming platforms',
    'Game Vault',
    'Juwa',
    'Fire Kirin',
    'Orion Stars',
    'Panda Master',
    'competitive gaming',
    'gaming tournaments',
    '4K gaming posters',
    '24/7 live gaming support',
  ],
  authors: [{ name: "Sandy's Gaming Team", url: siteUrl }],
  creator: "Sandy's Gaming",
  publisher: "Sandy's Gaming",
  category: 'gaming',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: '/',
  },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/brand/sandys-gaming-logo.png', type: 'image/png' },
    ],
    shortcut: '/brand/sandys-gaming-logo.png',
    apple: [
      { url: '/brand/sandys-gaming-logo.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    title: "SANDY'S GAMING — Elite Esports, Gaming Platforms & 24/7 Live Support",
    description:
      "Dominate the arena with Sandy's Gaming. Official gaming platform downloads, competitive esports news, 4K visual artwork gallery, and 24/7 dedicated live chat support.",
    siteName: "Sandy's Gaming",
    images: [
      {
        url: '/brand/og-banner.png',
        width: 1200,
        height: 630,
        alt: "Sandy's Gaming — Next-Gen Esports & Gaming Hub",
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "SANDY'S GAMING — Elite Esports, Gaming Platforms & 24/7 Live Support",
    description:
      "Dominate the arena with Sandy's Gaming. Official gaming platform downloads, competitive esports news, 4K visual artwork gallery, and 24/7 dedicated live chat support.",
    images: ['/brand/og-banner.png'],
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: "Sandy's Gaming",
      url: siteUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/brand/sandys-gaming-logo.png`,
      },
      contactPoint: [
        {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          availableLanguage: ['English'],
          url: `${siteUrl}/contact`,
        },
      ],
    },
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      url: siteUrl,
      name: "Sandy's Gaming",
      description:
        "Official gaming platforms, esports publications, visual artwork gallery, and 24/7 live customer support.",
      publisher: {
        '@id': `${siteUrl}/#organization`,
      },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${siteUrl}/blog?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
  ],
};

async function NavbarWithAuth() {
  const profile = await getCurrentProfile();
  const initialUser = profile
    ? {
        email: profile.email || '',
        role: profile.role,
        displayName: profile.display_name,
      }
    : null;

  return <Navbar initialUser={initialUser} />;
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${interSans.variable} ${jetbrainsMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <Suspense
          fallback={
            <header
              aria-hidden="true"
              className="sticky top-0 z-50 h-16 w-full border-b border-white/[0.06] bg-[var(--background)]/85 backdrop-blur-xl"
            />
          }
        >
          <NavbarWithAuth />
        </Suspense>
        <main className="flex-1 min-h-0 flex flex-col">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
