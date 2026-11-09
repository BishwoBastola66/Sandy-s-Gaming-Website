import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className = '', ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`skeleton-shimmer rounded-xl ${className}`}
      {...props}
    />
  );
}

export function FeedPostSkeleton() {
  return (
    <div className="rounded-2xl glass-elevated overflow-hidden p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full shrink-0" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="h-2.5 w-20" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>

      {/* Copy */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>

      {/* Media Image */}
      <Skeleton className="aspect-[16/9] w-full rounded-xl" />

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-28 rounded-lg" />
      </div>
    </div>
  );
}

export function GamingCardSkeleton() {
  return (
    <div className="gaming-card flex flex-col overflow-hidden">
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="p-5 space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-3 w-full" />
        <div className="pt-2 flex justify-between items-center">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-4" />
        </div>
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl glass p-6 space-y-4">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-3.5 w-full" />
      <Skeleton className="h-3.5 w-5/6" />
      <div className="pt-3 flex gap-2">
        <Skeleton className="h-8 w-24 rounded-xl" />
        <Skeleton className="h-8 w-24 rounded-xl" />
      </div>
    </div>
  );
}

export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <tr className="border-b border-white/[0.06]">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <Skeleton className="h-4 w-full max-w-[140px]" />
        </td>
      ))}
    </tr>
  );
}
