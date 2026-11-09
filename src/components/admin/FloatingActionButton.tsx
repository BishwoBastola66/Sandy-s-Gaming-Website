'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Plus } from 'lucide-react';

function emptySubscribe() {
  return () => {};
}

function useMounted() {
  return React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

interface FloatingActionButtonProps {
  href: string;
  label?: string;
  colorClass?: string;
}

export function FloatingActionButton({
  href,
  label = 'New Post',
  colorClass = 'bg-[#e8364b] hover:bg-[#d12a3e] shadow-[#e8364b]/50',
}: FloatingActionButtonProps) {
  const mounted = useMounted();

  if (!mounted) return null;

  return createPortal(
    <div className="fixed bottom-6 right-5 sm:right-8 z-50">
      <Link
        href={href}
        className={`flex h-13 w-13 items-center justify-center rounded-full text-white shadow-2xl border border-white/20 hover:scale-105 active:scale-90 transition-all cursor-pointer ${colorClass}`}
        aria-label={label}
        title={label}
      >
        <Plus className="h-6 w-6 stroke-[2.5]" />
      </Link>
    </div>,
    document.body
  );
}

