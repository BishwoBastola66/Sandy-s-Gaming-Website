import { NextResponse, type NextRequest } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { updatePlatform, deletePlatform } from '@/lib/platforms/store';
import { z } from 'zod';

const updatePlatformSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  tagline: z.string().trim().min(5).max(300).optional(),
  description: z.string().trim().min(10).max(2000).optional(),
  play_url: z.string().trim().url('Must be a valid URL').optional(),
  category: z.string().trim().min(2).max(100).optional(),
  tags: z.array(z.string()).optional(),
  features: z.array(z.string()).optional(),
  platforms: z.array(z.string()).optional(),
  logo_url: z.string().trim().optional().nullable(),
  badge: z.string().trim().optional().nullable(),
  accent_color: z.string().trim().optional().nullable(),
  display_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { errorResponse } = await requireApiRole(['admin', 'super_admin']);
  if (errorResponse) return errorResponse;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Missing platform id' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const parsed = updatePlatformSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid update data', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const updated = await updatePlatform(id, parsed.data as Parameters<typeof updatePlatform>[1]);

    if (!updated) {
      return NextResponse.json({ error: 'Platform not found' }, { status: 404 });
    }

    return NextResponse.json({ platform: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update platform';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { errorResponse } = await requireApiRole(['admin', 'super_admin']);
  if (errorResponse) return errorResponse;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Missing platform id' }, { status: 400 });
  }

  try {
    const deleted = await deletePlatform(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Platform not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Platform deleted successfully' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete platform';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
