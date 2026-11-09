import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', isLoading = false, disabled, children, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-semibold rounded-xl select-none transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:transform-none';

    const variantStyles = {
      primary:
        'bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-hover)] shadow-[0_4px_20px_-4px_rgba(215,25,50,0.35)] hover:shadow-[0_6px_25px_-2px_rgba(215,25,50,0.5)]',
      secondary:
        'glass text-[var(--text-primary)] hover:bg-white/[0.08] hover:border-white/[0.15] border border-white/[0.08]',
      outline:
        'border border-white/[0.12] bg-transparent text-[var(--text-primary)] hover:bg-white/[0.05] hover:border-white/[0.2]',
      destructive:
        'bg-red-600/90 text-white hover:bg-red-600 border border-red-500/30 shadow-[0_4px_16px_-4px_rgba(239,68,68,0.4)]',
      ghost:
        'bg-transparent text-[var(--text-secondary)] hover:text-white hover:bg-white/[0.06]',
    };

    const sizeStyles = {
      sm: 'text-xs px-3 py-1.5 gap-1.5 rounded-lg',
      md: 'text-sm px-4 py-2.5 gap-2',
      lg: 'text-base px-6 py-3 gap-2.5 rounded-2xl',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
