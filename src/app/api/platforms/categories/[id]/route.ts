import { NextResponse, type NextRequest } from 'next/server';
import { updatePlatformCategory, deletePlatformCategory } from '@/lib/platforms/store';
import { requireApiRole } from '@/lib/auth/api-auth';
import { z } from 'zod';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const updatePlatformCategorySchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  description: z.string().trim().max(500).optional().nullable(),
  display_order: z.number().int().optional(),
});

export async function PUT(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const { errorResponse } = await requireApiRole(['admin', 'super_admin']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const parsed = updatePlatformCategorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid update data', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const updated = await updatePlatformCategory(id, parsed.data);
    if (!updated) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json({ category: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update category';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const { errorResponse } = await requireApiRole(['admin', 'super_admin']);
  if (errorResponse) return errorResponse;

  try {
    const deleted = await deletePlatformCategory(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete category';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
