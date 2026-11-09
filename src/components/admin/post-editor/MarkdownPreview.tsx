'use client';

import React from 'react';

interface MarkdownPreviewProps {
  content: string;
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  if (!content.trim()) {
    return (
      <p className="text-neutral-500 italic">
        No article content yet. Switch to Write mode or use AI to generate.
      </p>
    );
  }

  const paragraphs = content.split(/\n\s*\n/);

  return (
    <div className="space-y-4 text-neutral-200 leading-relaxed font-sans text-sm sm:text-base">
      {paragraphs.map((para, i) => {
        const trimmed = para.trim();
        if (!trimmed) return null;

        if (trimmed.includes('![') && trimmed.includes('](')) {
          const parts = trimmed.split(/(!\[[\s\S]*?\]\([\s\S]*?\))/g);
          return (
            <div key={i} className="space-y-2">
              {parts.map((part, pIdx) => {
                const subImg = part.match(/^!\[([\s\S]*?)\]\(([\s\S]*?)\)$/);
                if (subImg) {
                  const alt = subImg[1].trim();
                  const src = subImg[2].trim().replace(/\s+/g, '');
                  return (
                    <div
                      key={pIdx}
                      className="my-3 overflow-hidden rounded-xl border border-white/[0.1] bg-black/40 shadow-md"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt={alt || 'Document Image'}
                        className="w-full max-h-[500px] object-cover"
                        loading="lazy"
                      />
                      {alt && (
                        <p className="p-1.5 text-center text-xs text-neutral-400 bg-[#16161d]">
                          {alt}
                        </p>
                      )}
                    </div>
                  );
                }
                return part.trim() ? (
                  <p key={pIdx} className="whitespace-pre-line text-neutral-300">
                    {part}
                  </p>
                ) : null;
              })}
            </div>
          );
        }

        if (trimmed.startsWith('# ')) {
          return (
            <h1
              key={i}
              className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight border-b border-white/[0.1] pb-2"
            >
              {trimmed.replace(/^# /, '')}
            </h1>
          );
        }

        if (trimmed.startsWith('## ')) {
          return (
            <h2 key={i} className="text-lg sm:text-xl font-bold text-white tracking-tight pt-2">
              {trimmed.replace(/^## /, '')}
            </h2>
          );
        }

        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={i} className="text-base sm:text-lg font-semibold text-neutral-200">
              {trimmed.replace(/^### /, '')}
            </h3>
          );
        }

        if (trimmed.startsWith('> ')) {
          return (
            <blockquote
              key={i}
              className="border-l-4 border-[#e8364b] bg-white/[0.03] pl-4 py-2 italic text-neutral-300 rounded-r-lg"
            >
              {trimmed.replace(/^> /, '')}
            </blockquote>
          );
        }

        if (trimmed.startsWith('```')) {
          return (
            <pre
              key={i}
              className="p-3.5 rounded-xl bg-black/60 border border-white/[0.1] font-mono text-xs overflow-x-auto text-[#ff8090]"
            >
              {trimmed.replace(/```/g, '')}
            </pre>
          );
        }

        return (
          <p key={i} className="whitespace-pre-line text-neutral-300">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

