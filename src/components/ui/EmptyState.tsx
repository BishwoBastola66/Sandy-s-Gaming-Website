import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex min-h-[200px] flex-col items-center justify-center py-10 px-4 text-center ${className}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.03] border border-white/[0.06] text-neutral-400">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-3.5 text-sm font-semibold text-white">{title}</h3>
      <p className="mt-1 max-w-sm text-xs text-neutral-400 leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
