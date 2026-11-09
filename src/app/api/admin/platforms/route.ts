import { NextResponse, type NextRequest } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { getAllPlatformsForAdmin, createPlatform } from '@/lib/platforms/store';
import { z } from 'zod';

const platformSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  name: z.string().trim().min(2).max(150),
  tagline: z.string().trim().min(5).max(300),
  description: z.string().trim().min(10).max(2000),
  play_url: z.string().trim().url('Must be a valid URL'),
  category: z.string().trim().min(2).max(100).default('all-in-one'),
  tags: z.array(z.string()).default([]),
  features: z.array(z.string()).default([]),
  platforms: z.array(z.string()).default(['android', 'ios', 'web']),
  logo_url: z.string().trim().optional().nullable(),
  badge: z.string().trim().optional().nullable(),
  accent_color: z.string().trim().optional().default('#e8364b'),
  display_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
});

export async function GET() {
  const { errorResponse } = await requireApiRole(['admin', 'super_admin']);
  if (errorResponse) return errorResponse;

  try {
    const platforms = await getAllPlatformsForAdmin();
    return NextResponse.json({ platforms });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve platforms';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { errorResponse } = await requireApiRole(['admin', 'super_admin']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const parsed = platformSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid platform data', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const created = await createPlatform({
      slug: parsed.data.slug,
      name: parsed.data.name,
      tagline: parsed.data.tagline,
      description: parsed.data.description,
      play_url: parsed.data.play_url,
      category: parsed.data.category,
      tags: parsed.data.tags,
      features: parsed.data.features,
      platforms: parsed.data.platforms as ('android' | 'ios' | 'web' | 'pc')[],
      logo_url: parsed.data.logo_url || `/games/${parsed.data.slug}.png`,
      badge: parsed.data.badge || null,
      accent_color: parsed.data.accent_color,
      display_order: parsed.data.display_order,
      is_active: parsed.data.is_active,
    });

    return NextResponse.json({ platform: created }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create platform';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
