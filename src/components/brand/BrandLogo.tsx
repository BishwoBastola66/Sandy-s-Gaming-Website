'use client';

import Image from 'next/image';
import Link from 'next/link';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  glow?: boolean;
  withText?: boolean;
  href?: string;
  className?: string;
}

const SIZES = {
  sm: { width: 32, height: 32, text: 'text-sm' },
  md: { width: 40, height: 40, text: 'text-base' },
  lg: { width: 56, height: 56, text: 'text-lg' },
  xl: { width: 80, height: 80, text: 'text-2xl' },
  hero: { width: 220, height: 220, text: 'text-3xl' },
};

export function BrandLogo({
  size = 'md',
  withText = false,
  href,
  className = '',
}: BrandLogoProps) {
  const config = SIZES[size] || SIZES.md;

  const content = (
    <div className={`inline-flex items-center gap-2.5 select-none group ${className}`}>
      <div className="relative flex items-center justify-center shrink-0">
        <Image
          src="/brand/sandys-gaming-logo.png"
          alt="SANDY'S GAMING"
          width={config.width}
          height={config.height}
          priority={size === 'hero' || size === 'md'}
          className="relative z-10 object-contain transition-transform duration-500 ease-out group-hover:scale-105"
        />
      </div>

      {withText && (
        <div className="flex flex-col leading-none">
          <span className={`font-black tracking-wide text-[var(--text-primary)] uppercase ${config.text}`}>
            SANDY&apos;S
          </span>
          <span className="text-[10px] font-bold tracking-[0.2em] text-[var(--brand-primary)] uppercase">
            GAMING
          </span>
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] rounded-lg">
        {content}
      </Link>
    );
  }

  return content;
}
