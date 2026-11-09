import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireApiAuth } from '@/lib/auth/api-auth';
import { broadcastConversationEvent } from '@/lib/realtime/broadcast';
import { sanitizeErrorMessage } from '@/lib/validation/error-sanitizer';
import type { ConversationStatus } from '@/types/database';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface ConversationRecord {
  id: string;
  customer_id: string;
  subject: string | null;
  status: ConversationStatus;
  last_message_at: string;
  created_at: string;
  closed_at: string | null;
  customer?: { id: string; display_name: string; role: string } | null;
}

interface AssignedStaffRecord {
  id: string;
  admin_id: string;
  status: string;
  assigned_at: string;
  admin?: { id: string; display_name: string; role: string } | null;
}

/**
 * Validates whether the caller has access to the conversation:
 * - Customer: Must be conversation owner (`customer_id === user.id`)
 * - Admin / Super Admin: Full support management access
 */
async function authorizeConversation(
  conversationId: string,
  userId: string,
  role: string
): Promise<{ authorized: boolean; conversation?: ConversationRecord; isOwner?: boolean }> {
  const supabase = await createAdminClient();

  // Fetch the conversation record
  const { data: conv, error: convError } = (await supabase
    .from('conversations')
    .select(`
      *,
      customer:accounts!conversations_customer_id_fkey(id, display_name, role)
    `)
    .eq('id', conversationId)
    .single()) as { data: ConversationRecord | null; error: { message: string } | null };

  if (convError || !conv) {
    return { authorized: false };
  }

  // Staff (admin & super_admin) have global management authorization
  if (role === 'super_admin' || role === 'admin') {
    return { authorized: true, conversation: conv };
  }

  if (role === 'customer') {
    if (conv.customer_id === userId) {
      return { authorized: true, conversation: conv, isOwner: true };
    }
    return { authorized: false };
  }

  return { authorized: false };
}

/**
 * GET /api/conversations/[id]
 */
export async function GET(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const { errorResponse, profile } = await requireApiAuth();
  if (errorResponse) return errorResponse;

  const { authorized, conversation } = await authorizeConversation(id, profile.id, profile.role);
  if (!authorized) {
    return NextResponse.json({ error: 'Conversation not found or access denied' }, { status: 404 });
  }

  return NextResponse.json({
    conversation,
    assigned_staff: [] as AssignedStaffRecord[],
  });
}

/**
 * PATCH /api/conversations/[id]
 * Updates status (e.g., 'open', 'in_progress', 'resolved', 'closed')
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const { errorResponse, profile } = await requireApiAuth();
  if (errorResponse) return errorResponse;

  const supabase = await createAdminClient();

  const { authorized, conversation, isOwner } = await authorizeConversation(id, profile.id, profile.role);
  if (!authorized || !conversation) {
    return NextResponse.json({ error: 'Conversation not found or access denied' }, { status: 404 });
  }

  const body = (await req.json()) as { status?: ConversationStatus };
  const nextStatus = body.status as ConversationStatus;

  const validStatuses: ConversationStatus[] = ['open', 'in_progress', 'resolved', 'closed'];
  if (!nextStatus || !validStatuses.includes(nextStatus)) {
    return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
  }

  // Customers can resolve or close their own conversation, or reopen an open one
  if (profile.role === 'customer' && !isOwner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const updatePayload: { status: ConversationStatus; closed_at?: string | null } = {
    status: nextStatus,
  };

  if (nextStatus === 'closed' || nextStatus === 'resolved') {
    updatePayload.closed_at = new Date().toISOString();
  } else if (conversation.status === 'closed' && (nextStatus === 'open' || nextStatus === 'in_progress')) {
    updatePayload.closed_at = null;
  }

  const { data: updated, error: updateError } = await supabase
    .from('conversations')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(updateError, 'Unable to update conversation status right now.') },
      { status: 500 }
    );
  }

  // Broadcast status change event to participants (awaited for Vercel serverless lifecycle)
  try {
    await broadcastConversationEvent(id, 'status_changed', {
      conversation_id: id,
      status: updated.status,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Conversations Route] Broadcast status_changed error:', err);
  }

  return NextResponse.json({ conversation: updated });
}
