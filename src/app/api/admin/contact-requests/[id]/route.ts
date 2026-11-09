import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { sanitizeErrorMessage } from '@/lib/validation/error-sanitizer';
import { z } from 'zod';

const updateInquirySchema = z.object({
  status: z.enum(['new', 'in_progress', 'replied', 'closed']).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/contact-requests/[id] - Retrieve single inquiry with replies
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const { errorResponse } = await requireApiRole(['admin', 'super_admin']);
  if (errorResponse) return errorResponse;

  const adminClient = await createAdminClient();

  // Fetch inquiry
  const { data: inquiry, error: inqError } = await adminClient
    .from('contact_inquiries')
    .select('*')
    .eq('id', id)
    .single();

  if (inqError || !inquiry) {
    return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });
  }

  // Fetch replies
  const { data: replies } = await adminClient
    .from('contact_inquiry_replies')
    .select('*')
    .eq('inquiry_id', id)
    .order('created_at', { ascending: true });

  return NextResponse.json({ inquiry, replies: replies || [] });
}

// PATCH /api/admin/contact-requests/[id] - Update status or assignment
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const { errorResponse, profile } = await requireApiRole(['admin', 'super_admin']);
  if (errorResponse) return errorResponse;

  try {
    const json = await request.json();
    const parsed = updateInquirySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid update' }, { status: 400 });
    }

    const updates: import('@/types/database').Database['public']['Tables']['contact_inquiries']['Update'] = {
      ...parsed.data,
      updated_at: new Date().toISOString(),
    };

    if (updates.status === 'closed') {
      updates.closed_at = new Date().toISOString();
    }

    const adminClient = await createAdminClient();

    const { data: updated, error: updateError } = await adminClient
      .from('contact_inquiries')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        { error: sanitizeErrorMessage(updateError, 'Failed to update inquiry.') },
        { status: 500 }
      );
    }

    // Audit log
    await adminClient.from('audit_logs').insert({
      actor_id: profile.id,
      action: 'INQUIRY_UPDATED',
      target_type: 'contact_inquiry',
      target_id: id,
      metadata: updates,
    });

    return NextResponse.json({ success: true, inquiry: updated });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(err, 'Unable to update inquiry right now.') },
      { status: 500 }
    );
  }
}
