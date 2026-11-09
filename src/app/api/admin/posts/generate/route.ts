import { NextResponse, type NextRequest } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function POST(req: NextRequest) {
  const { errorResponse } = await requireApiRole(['admin', 'super_admin']);
  if (errorResponse) return errorResponse;

  try {
    const { prompt, tone = 'exciting', postType = 'blog' } = await req.json();

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
      return NextResponse.json(
        { error: 'Please enter a topic or prompt with at least 3 characters.' },
        { status: 400 }
      );
    }

    const cleanPrompt = prompt.trim();
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (apiKey) {
      try {
        const sysPrompt = `You are an elite gaming journalist, content strategist, and technical esports writer for Sandy's Gaming.
Generate a high-impact, professional gaming blog article based on the user's topic: "${cleanPrompt}".
Tone: ${tone}. Post type: ${postType}.

Return strictly a valid JSON object without markdown fences, with these exact keys:
- "title": Compelling, clickable title (max 90 chars)
- "excerpt": Engaging 1-2 sentence hook / synopsis for card previews (120-180 chars)
- "body": Full Markdown article content including headings (##), subheadings (###), bullet points, pro tips, tactical breakdowns, bold text, and a conclusion.`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: sysPrompt }] }],
              generationConfig: { responseMimeType: 'application/json' },
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText);
            if (parsed.title && parsed.body) {
              return NextResponse.json({
                success: true,
                title: parsed.title,
                slug: slugify(parsed.title),
                excerpt: parsed.excerpt || cleanPrompt,
                body: parsed.body,
              });
            }
          }
        }
      } catch (geminiErr) {
        console.warn('[AIGenerator] Gemini API fallback to smart template synthesizer:', geminiErr);
      }
    }

    // Smart Local Gaming Article Synthesizer (Instant fallback when offline or no API key)
    const titleCapitalized = cleanPrompt
      .split(' ')
      .map((w) => (w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
      .join(' ');

    const title = `${titleCapitalized}: Complete Strategy & Tactical Breakdown`;
    const slug = slugify(title);
    const excerpt = `Master ${cleanPrompt} with our in-depth tactical guide, weapon multipliers, tournament insights, and expert community setups on Sandy's Gaming.`;

    const body = `## Overview

Welcome to the definitive breakdown of **${titleCapitalized}**. Whether you're grinding competitive sweepstakes lobbies, looking for tournament advantage, or mastering the newest updates, having a disciplined game plan is essential for maximizing your win rate and payouts.

In this comprehensive guide, we examine the core mechanics, optimal bet pacing, and key creature/boss multiplier strategies that separate casual players from seasoned veterans.

---

## Key Tactical Pillars

To stay ahead of the competition, focus on these three core fundamentals:

- **Resource Discipline & Bankroll Scaling**: Never max out on unpredictable early-round waves. Build a buffer during medium-density phases before committing high multipliers to high-tier boss targets.
- **Target Prioritization**: High-multiplier bosses (such as Golden Dragons, Demon Kings, and Mythical Krakens) require precision timing. Track creature spawn animations and reload cycles before unloading multi-cannon salvos.
- **Room Pacing & Co-Op Dynamics**: In multi-player rooms, synchronize your fire with team players to split boss bounties efficiently rather than wasting ammunition fighting for solo steals.

---

## Recommended Setups & Multiplier Focus

Here is the recommended setup for competitive play:

1. **Cannon / Bet Tier**: Moderate (3x - 5x base multiplier during exploration; 10x+ during locked boss phases).
2. **Device Optimization**: Play via modern mobile browsers (Safari on iOS, Chrome on Android) or the native APK launcher for minimum touch latency.
3. **Session Strategy**: Set realistic target stops. Secure credits after substantial jackpots and reset your session focus.

> **Pro Tip**: Always inspect the lobby volatility badge before committing your reload credits. Low-volatility rooms offer consistent chip stability, whereas high-volatility portals are engineered for high-risk, game-changing payout spikes.

---

## Conclusion & Next Steps

${titleCapitalized} provides unmatched excitement when played with patience, tactical awareness, and smart multiplier distribution. Jump into the Sandy's Gaming community portal, apply these strategies, and claim your spot on the top leaderboard.

*Have your own tips or legendary multiplier catches? Share them in our Sandy Gaming chat and connect with staff for instant support!*`;

    return NextResponse.json({
      success: true,
      title,
      slug,
      excerpt,
      body,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to generate post';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

