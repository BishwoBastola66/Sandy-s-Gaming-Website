import { NextResponse, type NextRequest } from 'next/server';
import { requireApiAuth } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { sanitizeErrorMessage } from '@/lib/validation/error-sanitizer';
import { TICKET_WITH_CUSTOMER_SELECT, mapTicketRowToItem } from '@/types/tickets';
import type { Database } from '@/types/database';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse, profile } = await requireApiAuth();
  if (errorResponse) return errorResponse;

  const isStaff = profile.role === 'admin' || profile.role === 'super_admin';
  const { id: ticketId } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const { status } = body as {
      status?: 'open' | 'in_progress' | 'resolved' | 'closed';
    };

    const validStatuses = ['open', 'in_progress', 'resolved', 'closed'] as const;
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid ticket status.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const updatePayload: Database['public']['Tables']['tickets']['Update'] = {
      updated_at: now,
    };

    if (status) {
      updatePayload.status = status;
      if (status === 'resolved' || status === 'closed') {
        updatePayload.resolved_at = now;
      } else {
        updatePayload.resolved_at = null;
      }
    }

    const supabase = await createAdminClient();
    let query = supabase.from('tickets').update(updatePayload).eq('id', ticketId);

    if (!isStaff) {
      query = query.eq('customer_id', profile.id);
    }

    const { data, error } = await query.select(TICKET_WITH_CUSTOMER_SELECT).maybeSingle();
    if (error) {
      return NextResponse.json(
        { error: sanitizeErrorMessage(error, 'Unable to update ticket status right now.') },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ error: 'Ticket not found or access denied.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      ticket: mapTicketRowToItem(data as unknown as Record<string, unknown>),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(err, 'Unable to update ticket right now.') },
      { status: 500 }
    );
  }
}
