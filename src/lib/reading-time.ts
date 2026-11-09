/**
 * Calculates human-readable reading time from content and optional fallback.
 * Uses an average reading speed of 200 words per minute.
 */
export function calculateReadingTime(
  content: string | null | undefined,
  fallbackText?: string | null | undefined
): string {
  const raw = (content && content.trim().length > 0 ? content : fallbackText || '').trim();
  if (!raw) return '1 min read';

  // Strip markdown symbols, HTML tags, and clean whitespace
  const clean = raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/[#*`_~>\[\]()!-]/g, ' ')
    .trim();

  const words = clean.split(/\s+/).filter(Boolean);
  const wordsPerMinute = 200;
  const minutes = Math.max(1, Math.ceil(words.length / wordsPerMinute));

  return `${minutes} min read`;
}

