import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';

export interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Alert({ variant = 'info', title, children, className = '' }: AlertProps) {
  const configs = {
    info: {
      icon: Info,
      wrapper: 'border-blue-500/20 bg-blue-950/20 text-blue-200',
      iconColor: 'text-blue-400',
    },
    success: {
      icon: CheckCircle2,
      wrapper: 'border-emerald-500/20 bg-emerald-950/20 text-emerald-200',
      iconColor: 'text-emerald-400',
    },
    warning: {
      icon: AlertTriangle,
      wrapper: 'border-amber-500/20 bg-amber-950/20 text-amber-200',
      iconColor: 'text-amber-400',
    },
    error: {
      icon: AlertCircle,
      wrapper: 'border-red-500/20 bg-red-950/20 text-red-200',
      iconColor: 'text-red-400',
    },
  };

  const current = configs[variant];
  const IconComponent = current.icon;

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-xl border p-4 text-xs backdrop-blur-md ${current.wrapper} ${className}`}
    >
      <IconComponent className={`h-4 w-4 shrink-0 mt-0.5 ${current.iconColor}`} />
      <div className="space-y-1">
        {title && <h4 className="font-semibold text-sm leading-tight text-white">{title}</h4>}
        <div className="leading-relaxed opacity-90">{children}</div>
      </div>
    </div>
  );
}
