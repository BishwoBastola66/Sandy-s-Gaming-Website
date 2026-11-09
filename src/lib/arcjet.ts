import arcjet, { detectBot, shield } from '@arcjet/next';

/**
 * Arcjet Security Client
 * 
 * Provides:
 * 1. Shield: Blocks common exploit payloads, path traversal, and malicious scanners.
 * 2. Bot Detection: Blocks automated scraping bots and headless clients while allowing
 *    legitimate search engine crawlers (Google, Bing, DuckDuckGo, etc.).
 * 
 * Set ARCJET_KEY in your environment (.env.local / Vercel Environment Variables).
 * If ARCJET_KEY is omitted (e.g. in local development without Arcjet credentials),
 * the client safely bypasses without blocking legitimate local traffic.
 */
const arcjetKey = process.env.ARCJET_KEY?.trim();

export const aj = arcjetKey
  ? arcjet({
      key: arcjetKey,
      rules: [
        // Protect against common attacks (SQLi, XSS, malicious header patterns)
        shield({
          mode: 'LIVE',
        }),
        // Detect and block automated crawlers, scrapers, and headless browser bots
        detectBot({
          mode: 'LIVE',
          allow: [
            'CATEGORY:SEARCH_ENGINE', // Allows Googlebot, Bingbot, Yahoo, DuckDuckGo, etc.
            'CATEGORY:PREVIEW', // Allows Discord, Facebook, X/Twitter, WhatsApp, Telegram OpenGraph previews
            'CATEGORY:MONITOR', // Allows uptime & synthetic performance monitors
          ],
        }),
      ],
    })
  : null;

