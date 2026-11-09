'use client';

import React, { useRef, useEffect } from 'react';

interface OtpCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function OtpCodeInput({
  value,
  onChange,
  length = 6,
  disabled = false,
  autoFocus = true,
}: OtpCodeInputProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Pad or slice value into an array of single-character strings
  const digits = Array.from({ length }, (_, idx) => value[idx] || '');

  useEffect(() => {
    if (autoFocus && !disabled) {
      const firstEmptyIndex = Math.min(value.length, length - 1);
      inputRefs.current[firstEmptyIndex]?.focus();
    }
  }, [autoFocus, disabled, length]); // eslint-disable-line react-hooks/exhaustive-deps

  const focusSlot = (index: number) => {
    const clamped = Math.max(0, Math.min(index, length - 1));
    const el = inputRefs.current[clamped];
    if (el) {
      el.focus();
      el.select();
    }
  };

  const handleDigitChange = (index: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, '');
    if (!cleaned) {
      const next = [...digits];
      next[index] = '';
      onChange(next.join(''));
      return;
    }

    // Handle multi-character input (e.g. mobile OTP autofill into single input)
    if (cleaned.length > 1) {
      const next = [...digits];
      for (let i = 0; i < cleaned.length && index + i < length; i++) {
        next[index + i] = cleaned[i];
      }
      const joined = next.join('').slice(0, length);
      onChange(joined);
      focusSlot(Math.min(index + cleaned.length, length - 1));
      return;
    }

    const next = [...digits];
    next[index] = cleaned[0];
    onChange(next.join(''));

    if (index < length - 1) {
      focusSlot(index + 1);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = [...digits];
      if (next[index]) {
        next[index] = '';
        onChange(next.join(''));
      } else if (index > 0) {
        next[index - 1] = '';
        onChange(next.join(''));
        focusSlot(index - 1);
      }
      return;
    }

    if (e.key === 'Delete') {
      e.preventDefault();
      const next = [...digits];
      next[index] = '';
      onChange(next.join(''));
      return;
    }

    if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      focusSlot(index - 1);
      return;
    }

    if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      focusSlot(index + 1);
      return;
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    focusSlot(Math.min(pasted.length, length - 1));
  };

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-2.5" role="group" aria-label="6-digit verification code">
      {digits.map((digit, index) => (
        <React.Fragment key={index}>
          <input
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            id={index === 0 ? 'otp-input' : undefined}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            pattern="[0-9]*"
            maxLength={length}
            disabled={disabled}
            value={digit}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => handleDigitChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            aria-label={`Digit ${index + 1} of ${length}`}
            className={`h-12 w-11 sm:h-14 sm:w-12 rounded-xl border text-center text-lg sm:text-xl font-semibold tabular-nums text-white backdrop-blur-md transition-all duration-150 focus:outline-none disabled:opacity-50 ${
              digit
                ? 'border-white/[0.24] bg-[#1a1a22]/95'
                : 'border-white/[0.12] bg-[#131318]/90 hover:border-white/[0.2]'
            } focus:border-white/40 focus:bg-[#1b1b24] focus:shadow-[0_0_0_2px_rgba(255,255,255,0.12)]`}
          />
          {index === 2 && (
            <span className="text-neutral-600 font-bold select-none px-0.5" aria-hidden="true">
              &ndash;
            </span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

