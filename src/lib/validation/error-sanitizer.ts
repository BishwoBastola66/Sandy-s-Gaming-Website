/**
 * Client & API Error Sanitizer
 * Ensures raw database, Supabase, table, schema, constraint, or storage internals
 * are never exposed to end users in client-side alerts, toasts, or form errors.
 */

const INTERNAL_DB_PATTERNS = [
  /supabase/i,
  /postgres/i,
  /postgrest/i,
  /pgrst\d*/i,
  /relation\s+["']/i,
  /table\s+["']/i,
  /column\s+["']/i,
  /schema\s+cache/i,
  /row-level\s+security/i,
  /\brls\b/i,
  /violates\s+(foreign\s+key|unique|check|not-null)\s+constraint/i,
  /constraint\s+["']/i,
  /syntax\s+error\s+at\s+or\s+near/i,
  /invalid\s+input\s+syntax\s+for\s+type/i,
  /\bpublic\.\w+/i,
  /\bstorage\.\w+/i,
  /public-media|draft-media/i,
  /permission\s+denied\s+for\s+(table|schema|relation|function)/i,
  /could\s+not\s+find\s+the\s+['"]?\w+['"]?\s+column/i,
  /null\s+value\s+in\s+column/i,
  /database\s+session\s+creation\s+failed/i,
];

export function sanitizeErrorMessage(
  err: unknown,
  fallback = 'Something went wrong. Please check your input and try again.'
): string {
  const rawMessage =
    typeof err === 'string'
      ? err
      : err instanceof Error
      ? err.message
      : err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
      ? (err as { message: string }).message
      : '';

  const code =
    err && typeof err === 'object' && 'code' in err && typeof (err as { code: unknown }).code === 'string'
      ? (err as { code: string }).code
      : '';

  const trimmed = rawMessage.trim();
  if (!trimmed) {
    return fallback;
  }

  // 1. Friendly mapping for unique constraint / duplicate entries
  if (code === '23505' || /duplicate\s+key|unique\s+constraint|already\s+exists/i.test(trimmed)) {
    if (/slug/i.test(trimmed)) {
      return 'This URL slug is already in use. Please choose a different slug.';
    }
    if (/email/i.test(trimmed)) {
      return 'An account with this email address already exists.';
    }
    if (/name/i.test(trimmed)) {
      return 'This name is already in use. Please choose another name.';
    }
    return 'This item already exists. Please use different details.';
  }

  // 2. Friendly mapping for foreign key references
  if (code === '23503' || /foreign\s+key\s+constraint/i.test(trimmed)) {
    return 'This action cannot be completed because the item is currently in use.';
  }

  // 3. Friendly mapping for invalid UUID / check constraints / invalid types
  if (code === '23514' || code === '22P02' || /check\s+constraint|invalid\s+input\s+syntax/i.test(trimmed)) {
    return 'Please check your input fields and ensure all values are valid.';
  }

  // 4. Friendly mapping for network / fetch errors
  if (/failed\s+to\s+fetch|networkerror|load\s+failed/i.test(trimmed)) {
    return 'Network connection error. Please check your internet connection and try again.';
  }

  // 5. Block any internal database / table / Supabase terminology
  for (const pattern of INTERNAL_DB_PATTERNS) {
    if (pattern.test(trimmed)) {
      return fallback;
    }
  }

  // 6. Strip casual "in database" / "from database" / "to database" phrasing if present
  const cleaned = trimmed
    .replace(/\s+(in|from|to|into)\s+(the\s+)?database\b/gi, '')
    .replace(/\bdatabase\s+error\b/gi, 'service error');

  return cleaned || fallback;
}

