'use client';

import { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import {
  ArrowRight,
  BookOpen,
  MessageSquare,
  Sparkles,
  Trophy,
  ShieldCheck,
  Flame,
} from 'lucide-react';

const ThunderboltBackground = dynamic(
  () =>
    import('@/components/auth/ThunderboltBackground').then(
      (mod) => mod.ThunderboltBackground
    ),
  { ssr: false }
);

export function CinematicHeroContainer() {
  const primaryVideoRef = useRef<HTMLVideoElement>(null);
  const secondaryVideoRef = useRef<HTMLVideoElement>(null);
  const [activeLayer, setActiveLayer] = useState<'primary' | 'secondary'>('primary');
  const [vibePhase, setVibePhase] = useState<0 | 1 | 2>(0);

  // Cycle subtle site-themed color accents between video moments so it feels alive and integrated
  useEffect(() => {
    const interval = window.setInterval(() => {
      setVibePhase((prev) => ((prev + 1) % 3) as 0 | 1 | 2);
    }, 5500);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const v1 = primaryVideoRef.current;
    const v2 = secondaryVideoRef.current;
    if (!v1 || !v2) return;

    [v1, v2].forEach((video) => {
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
    });

    const tryPlay = (video: HTMLVideoElement) => {
      if (video.paused) {
        video.play().catch(() => {
          // Gracefully handle browser autoplay policies
        });
      }
    };

    if (v1.readyState >= 2) {
      tryPlay(v1);
    } else {
      v1.addEventListener('loadeddata', () => tryPlay(v1), { once: true });
      v1.addEventListener('canplay', () => tryPlay(v1), { once: true });
    }

    // Seamless dual-buffer crossfade between video loops so transitions feel smooth and atmospheric
    const CROSSFADE_WINDOW = 1.1;
    let isCrossfading = false;

    const handleTimeUpdate = () => {
      const current = activeLayer === 'primary' ? v1 : v2;
      const next = activeLayer === 'primary' ? v2 : v1;

      if (!current.duration || Number.isNaN(current.duration)) return;
      const remaining = current.duration - current.currentTime;

      if (remaining <= CROSSFADE_WINDOW && !isCrossfading) {
        isCrossfading = true;
        next.currentTime = 0;
        tryPlay(next);
        setActiveLayer((prev) => (prev === 'primary' ? 'secondary' : 'primary'));
        setVibePhase((prev) => ((prev + 1) % 3) as 0 | 1 | 2);

        window.setTimeout(() => {
          isCrossfading = false;
        }, 1200);
      }
    };

    v1.addEventListener('timeupdate', handleTimeUpdate);
    v2.addEventListener('timeupdate', handleTimeUpdate);

    const onUserInteraction = () => {
      tryPlay(activeLayer === 'primary' ? v1 : v2);
    };

    window.addEventListener('click', onUserInteraction, { once: true });
    window.addEventListener('touchstart', onUserInteraction, { once: true });

    return () => {
      v1.removeEventListener('timeupdate', handleTimeUpdate);
      v2.removeEventListener('timeupdate', handleTimeUpdate);
      window.removeEventListener('click', onUserInteraction);
      window.removeEventListener('touchstart', onUserInteraction);
    };
  }, [activeLayer]);

  return (
    <section className="relative min-h-[660px] lg:min-h-[740px] xl:min-h-[800px] w-full flex items-center overflow-hidden">
      {/* 1. Dual-Buffered Crossfading Video Background with Site Color Grading */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none bg-[var(--background)]">
        <video
          ref={primaryVideoRef}
          src="/hero-bg.mp4"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className={`absolute inset-0 h-full w-full object-cover will-change-transform transition-all duration-1000 ease-out ${
            activeLayer === 'primary'
              ? 'opacity-70 brightness-[0.72] scale-[1.02] saturate-[1.12] contrast-[1.08]'
              : 'opacity-0 brightness-[0.65] scale-[1.05]'
          }`}
        >
          <source src="/hero-bg.mp4" type="video/mp4" />
        </video>

        <video
          ref={secondaryVideoRef}
          src="/hero-bg.mp4"
          loop
          muted
          playsInline
          preload="metadata"
          className={`absolute inset-0 h-full w-full object-cover will-change-transform transition-all duration-1000 ease-out ${
            activeLayer === 'secondary'
              ? 'opacity-70 brightness-[0.72] scale-[1.02] saturate-[1.12] contrast-[1.08]'
              : 'opacity-0 brightness-[0.65] scale-[1.05]'
          }`}
        >
          <source src="/hero-bg.mp4" type="video/mp4" />
        </video>

        {/* Targeted Darkening Mask over the brightest center & cabinet highlights */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 58% 68% at 50% 48%, rgba(10, 10, 12, 0.56) 0%, rgba(10, 10, 12, 0.38) 52%, rgba(10, 10, 12, 0.22) 100%)',
          }}
        />

        {/* Subtle Site-Palette Color Wash that shifts gently between video phases */}
        <div
          className="absolute inset-0 transition-opacity duration-1000 pointer-events-none mix-blend-soft-light"
          style={{
            background:
              vibePhase === 0
                ? 'radial-gradient(circle at 68% 42%, rgba(232, 54, 75, 0.34) 0%, rgba(176, 34, 52, 0.14) 45%, transparent 75%)'
                : vibePhase === 1
                ? 'radial-gradient(circle at 55% 50%, rgba(244, 63, 94, 0.28) 0%, rgba(136, 19, 55, 0.2) 50%, transparent 78%)'
                : 'radial-gradient(circle at 72% 38%, rgba(232, 54, 75, 0.3) 0%, rgba(30, 27, 75, 0.24) 52%, transparent 76%)',
          }}
        />

        {/* Ambient Crimson & Obsidian Glow Spots tying video into site surface */}
        <div
          className="absolute -top-24 right-[12%] h-[420px] w-[420px] rounded-full blur-[130px] pointer-events-none transition-all duration-1000"
          style={{
            background: 'radial-gradient(circle, rgba(232, 54, 75, 0.22) 0%, transparent 70%)',
            transform: vibePhase === 1 ? 'scale(1.12) translateY(10px)' : 'scale(1) translateY(0px)',
          }}
        />
        <div
          className="absolute bottom-8 left-[28%] h-[320px] w-[480px] rounded-full blur-[120px] pointer-events-none transition-all duration-1000"
          style={{
            background: 'radial-gradient(circle, rgba(176, 34, 52, 0.18) 0%, transparent 72%)',
            opacity: vibePhase === 2 ? 0.9 : 0.55,
          }}
        />

        {/* Top Edge Vignette so navbar blends seamlessly into the video */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[var(--background)]/90 via-[var(--background)]/45 to-transparent pointer-events-none" />

        {/* Left & Right Perimeter Vignettes for natural framing & crisp typography */}
        <div className="absolute inset-y-0 left-0 w-full lg:w-[70%] bg-gradient-to-r from-[var(--background)]/95 via-[var(--background)]/70 to-transparent pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-40 sm:w-64 bg-gradient-to-l from-[var(--background)]/85 via-[var(--background)]/45 to-transparent pointer-events-none" />

        {/* Deep Seamless Bottom Melt into the Site Background (No hard border line) */}
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/85 to-transparent pointer-events-none" />
      </div>

      {/* Atmospheric Natural Electric Thunderbolts & Floating Sparks */}
      <ThunderboltBackground
        subtle={true}
        particleCount={130}
        minInterval={4500}
        maxInterval={9500}
        className="opacity-75"
      />

      {/* 2. Hero Content Foreground Container */}
      <div className="relative z-10 w-full max-w-[1720px] mx-auto px-4 py-16 sm:px-8 lg:px-12 xl:px-16">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column: Brand Copy & Actions */}
          <div className="lg:col-span-7 space-y-7 text-center lg:text-left">
            {/* Live Status Badge */}
            <div className="animate-fade-up inline-flex items-center gap-2 rounded-full glass px-3.5 py-1.5 text-xs text-[var(--text-secondary)] border border-[var(--brand-primary)]/20 shadow-[0_0_24px_rgba(232,54,75,0.14)]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--brand-primary)] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--brand-primary)]" />
              </span>
              <Flame className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
              <span className="font-medium tracking-wide text-white/90">
                Next-Gen Gaming &amp; Community Hub
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="animate-fade-up-delay-1 text-4xl sm:text-5xl md:text-6xl xl:text-7xl font-black tracking-tight text-[var(--text-primary)] leading-[1.05] drop-shadow-[0_4px_24px_rgba(0,0,0,0.65)]">
              Dominate the <br className="hidden sm:inline" />
              <span className="premium-text-gradient">
                Gaming Arena
              </span>
            </h1>

            {/* Description */}
            <p className="animate-fade-up-delay-2 max-w-2xl text-base sm:text-lg text-[var(--text-secondary)] leading-relaxed mx-auto lg:mx-0">
              Welcome to <span className="text-[var(--text-primary)] font-semibold">Sandy&apos;s Gaming</span>. Unrivaled competitive tournaments, esports news, exclusive artwork, and direct 24/7 staff live chat support.
            </p>

            {/* Action Buttons */}
            <div className="animate-fade-up-delay-3 flex flex-wrap items-center justify-center lg:justify-start gap-3.5 pt-1">
              <Link
                href="/blog"
                className="btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white"
              >
                <BookOpen className="h-4 w-4" />
                <span>Explore Articles</span>
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/chat"
                className="btn-ghost inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-[var(--text-primary)]"
              >
                <MessageSquare className="h-4 w-4 text-[var(--brand-primary)]" />
                <span>Live Support</span>
              </Link>
            </div>

            {/* Trust Highlights */}
            <div className="animate-fade-up-delay-3 pt-8 border-t border-white/[0.08] grid grid-cols-3 gap-6 text-center lg:text-left">
              {[
                { value: '24/7', label: 'Live Support', icon: ShieldCheck },
                { value: '100%', label: 'Verified Tourneys', icon: Trophy },
                { value: 'PRO', label: 'Curated Content', icon: Sparkles },
              ].map(({ value, label, icon: Icon }) => (
                <div key={label} className="group">
                  <div className="text-xl sm:text-2xl font-black text-[var(--text-primary)] transition-colors group-hover:text-[var(--brand-primary)] duration-300">
                    {value}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] flex items-center justify-center lg:justify-start gap-1 mt-0.5 font-mono">
                    <Icon className="h-3 w-3 text-[var(--brand-primary)]" />
                    <span>{label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Hero Brand Logo with Synchronized Ambient Aura */}
          <div className="lg:col-span-5 flex justify-center items-center animate-fade-up-delay-2">
            <div className="relative w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 animate-float flex items-center justify-center select-none">
              <div
                className="absolute inset-4 rounded-full blur-3xl pointer-events-none transition-all duration-1000"
                style={{
                  background:
                    'radial-gradient(circle, rgba(232, 54, 75, 0.28) 0%, rgba(176, 34, 52, 0.08) 55%, transparent 75%)',
                  transform: vibePhase === 1 ? 'scale(1.08)' : 'scale(0.96)',
                }}
              />
              <Image
                src="/brand/sandys-gaming-logo.png"
                alt="SANDY'S GAMING"
                fill
                priority
                fetchPriority="high"
                sizes="(max-width: 768px) 256px, (max-width: 1024px) 320px, 384px"
                className="object-contain drop-shadow-[0_0_45px_rgba(232,54,75,0.28)] transition-transform duration-700 ease-out hover:scale-105"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
