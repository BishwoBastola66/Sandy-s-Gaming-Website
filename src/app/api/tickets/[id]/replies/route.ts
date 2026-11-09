import { NextResponse, type NextRequest } from 'next/server';
import { requireApiAuth } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { sanitizeErrorMessage } from '@/lib/validation/error-sanitizer';
import crypto from 'crypto';
import {
  TICKET_WITH_CUSTOMER_SELECT,
  mapTicketRowToItem,
  type TicketItem,
  type TicketReply,
} from '@/types/tickets';
import type { Json } from '@/types/database';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse, profile } = await requireApiAuth();
  if (errorResponse) return errorResponse;

  const isStaff = profile.role === 'admin' || profile.role === 'super_admin';
  const { id: ticketId } = await params;

  try {
    const supabase = await createAdminClient();
    const { data: ticket, error } = await supabase
      .from('tickets')
      .select('id, customer_id, replies')
      .eq('id', ticketId)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: sanitizeErrorMessage(error, 'Unable to load ticket replies right now.') },
        { status: 500 }
      );
    }

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
    }

    if (!isStaff && ticket.customer_id !== profile.id) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    const replies = Array.isArray(ticket.replies)
      ? (ticket.replies as unknown as TicketReply[])
      : [];

    return NextResponse.json({ success: true, replies });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(err, 'Unable to load ticket replies right now.') },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse, profile } = await requireApiAuth();
  if (errorResponse) return errorResponse;

  const isStaff = profile.role === 'admin' || profile.role === 'super_admin';
  const { id: ticketId } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const message = ((body.message as string) || '').trim();
    const newStatus = body.new_status as TicketItem['status'] | undefined;

    if (!message) {
      return NextResponse.json({ error: 'Reply message cannot be empty.' }, { status: 400 });
    }

    if (message.length > 5000) {
      return NextResponse.json(
        { error: 'Reply message cannot exceed 5000 characters.' },
        { status: 400 }
      );
    }

    const validStatuses = ['open', 'in_progress', 'resolved', 'closed'] as const;
    if (newStatus && !validStatuses.includes(newStatus)) {
      return NextResponse.json({ error: 'Invalid ticket status.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const senderRole: TicketReply['sender_role'] =
      profile.role === 'super_admin'
        ? 'super_admin'
        : profile.role === 'admin'
          ? 'admin'
          : 'customer';

    const newReply: TicketReply = {
      id: crypto.randomUUID(),
      ticket_id: ticketId,
      sender_id: profile.id,
      sender_name:
        profile.display_name ||
        profile.email?.split('@')[0] ||
        (isStaff ? 'Staff' : 'Customer'),
      sender_email: profile.email || '',
      sender_role: senderRole,
      message,
      created_at: now,
    };

    const supabase = await createAdminClient();
    const { data: ticket, error: fetchErr } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .maybeSingle();

    if (fetchErr || !ticket) {
      return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
    }

    if (!isStaff && ticket.customer_id !== profile.id) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    const existingReplies = Array.isArray(ticket.replies)
      ? (ticket.replies as unknown as TicketReply[])
      : [];
    const updatedReplies = [...existingReplies, newReply];

    let targetStatus: TicketItem['status'] = ticket.status as TicketItem['status'];
    if (newStatus) {
      targetStatus = newStatus;
    } else if (isStaff && ticket.status === 'open') {
      targetStatus = 'in_progress';
    }

    const resolvedAt =
      targetStatus === 'resolved' || targetStatus === 'closed'
        ? now
        : targetStatus === 'open' || targetStatus === 'in_progress'
          ? null
          : ticket.resolved_at;

    const { data: updatedTicket, error: updateErr } = await supabase
      .from('tickets')
      .update({
        replies: updatedReplies as unknown as Json,
        status: targetStatus,
        resolved_at: resolvedAt,
        updated_at: now,
      })
      .eq('id', ticketId)
      .select(TICKET_WITH_CUSTOMER_SELECT)
      .single();

    if (updateErr || !updatedTicket) {
      return NextResponse.json(
        { error: sanitizeErrorMessage(updateErr, 'Unable to save ticket reply right now.') },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      reply: newReply,
      ticket: mapTicketRowToItem(updatedTicket as unknown as Record<string, unknown>),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(err, 'Unable to post ticket reply right now.') },
      { status: 500 }
    );
  }
}
