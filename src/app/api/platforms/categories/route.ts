import { NextResponse, type NextRequest } from 'next/server';
import {
  getPlatformCategories,
  createPlatformCategory,
  getActivePlatforms,
} from '@/lib/platforms/store';
import { requireApiRole } from '@/lib/auth/api-auth';
import { z } from 'zod';

const createPlatformCategorySchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().trim().max(500).optional().nullable(),
  display_order: z.number().int().optional().default(0),
});

export async function GET() {
  try {
    const [categories, platforms] = await Promise.all([
      getPlatformCategories(),
      getActivePlatforms(),
    ]);

    const categoriesWithCounts = categories.map((cat) => ({
      ...cat,
      count:
        cat.slug === 'all'
          ? platforms.length
          : platforms.filter((p) => p.category === cat.slug).length,
    }));

    return NextResponse.json({ categories: categoriesWithCounts });
  } catch {
    return NextResponse.json({ categories: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { errorResponse } = await requireApiRole(['admin', 'super_admin']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const parsed = createPlatformCategorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid platform category data', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const newCategory = await createPlatformCategory(parsed.data);
    return NextResponse.json({ category: newCategory }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create platform category';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
