'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Gamepad2,
  ExternalLink,
  Search,
  MessageSquare,
  CheckCircle2,
  Smartphone,
  Globe,
  Monitor,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import type { GamingApp } from '@/types/gaming-platform';

interface PlatformDirectoryProps {
  initialPlatforms?: GamingApp[];
  initialCategories?: { slug: string; name: string; count?: number }[];
}

export function PlatformDirectory({
  initialPlatforms = [],
  initialCategories = [],
}: PlatformDirectoryProps) {
  const [apps, setApps] = useState<GamingApp[]>(initialPlatforms);
  const [categories, setCategories] = useState<{ slug: string; name: string; count?: number }[]>(
    initialCategories.length > 0
      ? initialCategories
      : [
          { slug: 'all', name: 'All Platforms' },
          { slug: 'fish', name: 'Fish & Arcade Shooters' },
          { slug: 'slots', name: 'Classic 777 & Slots' },
          { slug: 'all-in-one', name: 'All-In-One Suites' },
        ]
  );
  const [loading, setLoading] = useState(initialPlatforms.length === 0);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Load platforms and categories from database API if not provided
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [platRes, catRes] = await Promise.all([
          fetch('/api/platforms'),
          fetch('/api/platforms/categories'),
        ]);

        if (platRes.ok) {
          const platData = await platRes.json();
          if (isMounted && Array.isArray(platData.platforms)) {
            setApps(platData.platforms);
          }
        }

        if (catRes.ok) {
          const catData = await catRes.json();
          if (isMounted && Array.isArray(catData.categories) && catData.categories.length > 0) {
            setCategories(catData.categories);
          }
        }
      } catch {
        // Ignored
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    if (initialPlatforms.length === 0) {
      loadData();
    }
    return () => {
      isMounted = false;
    };
  }, [initialPlatforms.length]);

  const filteredApps = useMemo(() => {
    return apps.filter((app) => {
      if (categoryFilter !== 'all' && app.category !== categoryFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = app.name.toLowerCase().includes(query);
        const matchesTagline = app.tagline.toLowerCase().includes(query);
        const matchesDesc = app.description.toLowerCase().includes(query);
        const matchesTag = app.tags.some((t) => t.toLowerCase().includes(query));
        return matchesName || matchesTagline || matchesDesc || matchesTag;
      }
      return true;
    });
  }, [apps, categoryFilter, searchQuery]);

  const displayCategories = useMemo(() => {
    return categories.map((cat) => {
      const count =
        cat.slug === 'all'
          ? apps.length
          : apps.filter((a) => a.category === cat.slug).length;
      return {
        key: cat.slug,
        label: cat.name,
        count,
      };
    });
  }, [categories, apps]);

  return (
    <section className="relative w-full max-w-[1720px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16 py-12 sm:py-16">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-white/[0.06] pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-[#e8364b] uppercase">
            <Gamepad2 className="h-4 w-4" />
            <span>Supported Game Portals &amp; Downloads</span>
          </div>
          <h2 className="text-2xl sm:text-3xl xl:text-4xl font-black tracking-tight text-white mt-1.5">
            Verified Gaming Platforms
          </h2>
          <p className="mt-1.5 text-xs sm:text-sm text-neutral-400 max-w-2xl leading-relaxed">
            Direct web launcher &amp; official download portals for all 11 supported games. Need an account set up or credits loaded? Tap any app to launch or contact our team in Live Chat 24/7.
          </p>
        </div>

        {/* Live Support Direct Action */}
        <Link
          href="/chat"
          className="inline-flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-[#e8364b]/40 px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#e8364b] transition-all duration-200 shrink-0 self-start md:self-auto cursor-pointer"
        >
          <MessageSquare className="h-4 w-4 text-[#e8364b] group-hover:text-white" />
          <span>Get Account / Load Credits</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search platform (e.g. Juwa, Fire Kirin, Game Vault, Panda)..."
            className="w-full rounded-xl border border-white/[0.08] bg-[#111116] pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder:text-neutral-500 focus:border-[#e8364b]/50 focus:outline-none transition-colors"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {displayCategories.map(({ key, label, count }) => {
            const isActive = categoryFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setCategoryFilter(key)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#e8364b] text-white shadow-[0_0_12px_rgba(232,54,75,0.3)]'
                    : 'bg-white/[0.03] text-neutral-400 hover:text-white hover:bg-white/[0.06] border border-white/[0.06]'
                }`}
              >
                <span>{label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? 'bg-black/30 text-white' : 'bg-white/[0.08] text-neutral-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Platforms Grid */}
      {loading ? (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="rounded-2xl border border-white/[0.06] bg-[#111116] p-6 h-64 animate-pulse flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="h-6 w-36 bg-white/[0.06] rounded-lg" />
                <div className="h-4 w-52 bg-white/[0.04] rounded" />
                <div className="h-14 w-full bg-white/[0.03] rounded-lg" />
              </div>
              <div className="h-10 w-full bg-white/[0.05] rounded-xl" />
            </div>
          ))}
        </div>
      ) : filteredApps.length === 0 ? (
        <div className="py-20 text-center flex flex-col items-center justify-center">
          <Gamepad2 className="h-10 w-10 text-neutral-600 mb-3" />
          <h3 className="text-sm font-semibold text-white">No Gaming Platforms Found</h3>
          <p className="mt-1 text-xs text-neutral-400 max-w-sm">
            {searchQuery
              ? `No platforms matched "${searchQuery}". Try a different keyword.`
              : 'Gaming portals will appear here once published.'}
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredApps.map((app) => (
            <div
              key={app.id}
              className="rounded-2xl border border-white/[0.08] bg-[#111116] hover:border-[#e8364b]/40 p-5 sm:p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-2xl hover:-translate-y-0.5 group relative overflow-hidden"
            >
              {/* Background Brand Logo & Atmospheric Ambient Glow */}
              {app.logoUrl && (
                <div
                  className="absolute inset-0 pointer-events-none select-none overflow-hidden z-0 flex items-center justify-end pr-2"
                  style={{
                    background: `radial-gradient(circle at 85% 30%, ${app.accentColor || '#e8364b'}18 0%, transparent 65%)`,
                  }}
                >
                  <div className="relative w-40 h-40 sm:w-48 sm:h-48 opacity-[0.15] group-hover:opacity-[0.28] group-hover:scale-105 transition-all duration-500 ease-out">
                    <Image
                      src={app.logoUrl}
                      alt=""
                      fill
                      unoptimized
                      sizes="(max-width: 640px) 160px, 192px"
                      className="object-contain object-right"
                      aria-hidden="true"
                    />
                  </div>
                </div>
              )}

              {/* Foreground Content */}
              <div className="relative z-10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-white/[0.05] text-neutral-400 border border-white/[0.08]">
                        {app.category === 'fish' ? 'Fish & Arcade' : app.category === 'slots' ? 'Slots & 777' : 'All-In-One'}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-[#ff6b7d] transition-colors">
                      {app.name}
                    </h3>
                  </div>

                  {app.badge && (
                    <span className="rounded-full bg-[#e8364b]/15 border border-[#e8364b]/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#ff6b7d] shrink-0">
                      {app.badge}
                    </span>
                  )}
                </div>

                {/* Tagline */}
                <p className="mt-3.5 text-xs font-semibold text-neutral-200">
                  {app.tagline}
                </p>

                {/* Human-Written Description */}
                <p className="mt-1.5 text-xs text-neutral-400 leading-relaxed">
                  {app.description}
                </p>

                {/* Features List */}
                <ul className="mt-3.5 space-y-1 text-[11px] text-neutral-300">
                  {app.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                {/* Platform / Device Pills */}
                <div className="mt-4 flex flex-wrap items-center gap-1.5 pt-3 border-t border-white/[0.05]">
                  {app.platforms.includes('android') && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-white/[0.03] text-neutral-300 border border-white/[0.06]">
                      <Smartphone className="h-3 w-3 text-emerald-400" />
                      <span>Android APK</span>
                    </span>
                  )}
                  {app.platforms.includes('ios') && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-white/[0.03] text-neutral-300 border border-white/[0.06]">
                      <Globe className="h-3 w-3 text-blue-400" />
                      <span>iOS Safari</span>
                    </span>
                  )}
                  {app.platforms.includes('web') && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-white/[0.03] text-neutral-300 border border-white/[0.06]">
                      <Monitor className="h-3 w-3 text-amber-400" />
                      <span>Web Launcher</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="relative z-10 mt-5 pt-4 border-t border-white/[0.06] flex items-center gap-2">
                <a
                  href={app.playUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#e8364b] hover:bg-[#d12a3e] px-4 py-2.5 text-xs font-bold text-white transition-all shadow-[0_2px_12px_rgba(232,54,75,0.25)] hover:shadow-[0_4px_16px_rgba(232,54,75,0.35)] cursor-pointer"
                >
                  <span>Play / Download</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>

                <Link
                  href="/chat"
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] px-3.5 py-2.5 text-xs font-semibold text-neutral-200 hover:text-white transition-colors cursor-pointer"
                  title="Message support to load credits or register an account"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-[#e8364b]" />
                  <span className="hidden sm:inline">Load</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom 24/7 Support Section - Open layout without card container */}
      <div className="mt-14 pt-8 border-t border-white/[0.08] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
            <span>24/7 Verified Distributor Services</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Need an account set up or fast credit loads?
          </h3>
          <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
            Sandy&apos;s Gaming specialists handle instant account creation, secure credit reloads, and redeem requests around the clock. No waiting — reach us in live chat anytime.
          </p>
        </div>

        <Link
          href="/chat"
          className="inline-flex items-center gap-2 rounded-xl bg-[#e8364b] hover:bg-[#d12a3e] px-6 py-3 text-xs sm:text-sm font-bold text-white transition-all shadow-[0_2px_16px_rgba(232,54,75,0.3)] shrink-0 cursor-pointer"
        >
          <MessageSquare className="h-4 w-4" />
          <span>Open 24/7 Live Chat</span>
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
