'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Sparkles, X } from 'lucide-react';

export type AiTone = 'exciting' | 'pro' | 'guide' | 'news';

interface AiGeneratorModalProps {
  mounted: boolean;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  aiPrompt: string;
  onPromptChange: (val: string) => void;
  aiTone: AiTone;
  onToneChange: (tone: AiTone) => void;
  isGenerating: boolean;
  onSubmit: (e?: React.FormEvent) => void;
}

export function AiGeneratorModal({
  mounted,
  isOpen,
  onOpen,
  onClose,
  aiPrompt,
  onPromptChange,
  aiTone,
  onToneChange,
  isGenerating,
  onSubmit,
}: AiGeneratorModalProps) {
  if (!mounted) return null;

  return (
    <>
      {isOpen
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
              onClick={() => {
                if (!isGenerating) onClose();
              }}
            >
              <div
                className="relative w-full max-w-lg rounded-2xl border border-[#e8364b]/40 bg-gradient-to-b from-[#180a0e] via-[#111116] to-[#0e0e13] p-4 sm:p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#e8364b]/20 text-[#ff6b7d] border border-[#e8364b]/30">
                      <Sparkles className="h-4 w-4 text-amber-300" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>AI Blog &amp; Article Generator</span>
                        <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-[#e8364b]/25 text-[#ff8090]">
                          AI
                        </span>
                      </h3>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isGenerating}
                    className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer shrink-0"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={onSubmit} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-neutral-200">
                      Prompt Topic / Description <span className="text-[#e8364b]">*</span>
                    </label>
                    <div className="relative">
                      <textarea
                        rows={3}
                        value={aiPrompt}
                        onChange={(e) => onPromptChange(e.target.value)}
                        placeholder="e.g. Fire Kirin golden dragon boss hunt strategy, weapon multipliers, high-payout fish spawn cycles, and reload tips..."
                        autoFocus
                        className="w-full rounded-xl border border-white/[0.1] bg-black/50 p-3 text-xs text-white placeholder:text-neutral-500 focus:border-[#e8364b] focus:outline-none leading-relaxed resize-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-neutral-200">
                      Article Tone &amp; Style
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {(
                        [
                          { id: 'exciting', label: 'Exciting & Hype' },
                          { id: 'pro', label: 'Pro Strategy' },
                          { id: 'guide', label: 'Step-by-Step' },
                          { id: 'news', label: 'News / Update' },
                        ] as const
                      ).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => onToneChange(t.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium text-center transition-all cursor-pointer border ${
                            aiTone === t.id
                              ? 'bg-[#e8364b]/20 text-white border-[#e8364b] font-semibold'
                              : 'bg-white/[0.03] text-neutral-400 border-white/[0.06] hover:text-white'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/[0.08]">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={isGenerating}
                      className="px-3.5 py-2 text-xs font-medium text-neutral-400 hover:text-white transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isGenerating || !aiPrompt.trim()}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#e8364b] to-[#b01328] px-4 py-2 text-xs font-bold text-white shadow-md hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Writing Article...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5 text-amber-200" />
                          <span>✨ Auto-Write Blog</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )
        : null}

      {createPortal(
        <div className="fixed bottom-6 right-5 z-40">
          <button
            type="button"
            onClick={onOpen}
            className="flex h-13 w-13 flex-col items-center justify-center rounded-full bg-[#e8364b] text-white shadow-xl shadow-[#e8364b]/40 border border-white/20 hover:bg-[#d12a3e] hover:scale-105 active:scale-90 transition-all cursor-pointer group"
            aria-label="Write with AI"
            title="Write with AI"
          >
            <Sparkles className="h-5 w-5 text-amber-200 group-hover:rotate-12 transition-transform drop-shadow" />
            <span className="text-[8px] font-black uppercase tracking-wider text-white leading-none mt-0.5">
              AI
            </span>
          </button>
        </div>,
        document.body
      )}
    </>
  );
}

