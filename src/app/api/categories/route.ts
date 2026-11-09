import { NextResponse, type NextRequest } from 'next/server';
import { getAllCategories, createCategory } from '@/lib/categories/store';
import { requireApiRole } from '@/lib/auth/api-auth';
import { z } from 'zod';

const createCategorySchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().trim().max(500).optional().nullable(),
  display_order: z.number().int().optional().default(0),
});

export async function GET() {
  try {
    const categories = await getAllCategories();
    return NextResponse.json({ categories });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch categories';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { errorResponse } = await requireApiRole(['admin', 'super_admin']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const parsed = createCategorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid category data', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const newCategory = await createCategory(parsed.data);
    return NextResponse.json({ category: newCategory }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create category';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
