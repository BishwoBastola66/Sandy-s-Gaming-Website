import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireApiAuth } from '@/lib/auth/api-auth';
import { broadcastConversationEvent } from '@/lib/realtime/broadcast';
import { sanitizeErrorMessage } from '@/lib/validation/error-sanitizer';
import type { ConversationStatus, MessageType } from '@/types/database';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface ConversationSummary {
  id: string;
  customer_id: string;
  status: ConversationStatus;
}

interface RawMessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  message_type: MessageType;
  created_at: string;
  edited_at: string | null;
  sender?: { id: string; display_name: string; role: string } | null;
}

interface MessageAttachmentItem {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number | null;
}

function parseLegacyMediaAttachment(body: string, msgId: string): MessageAttachmentItem[] | null {
  try {
    if (!body || !body.startsWith('{')) return null;
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed.url === 'string') {
      let fileType = parsed.type || 'image';
      if (fileType === 'images') fileType = 'image';
      return [
        {
          id: `legacy-${msgId}`,
          file_name: parsed.name || 'Attachment',
          file_url: parsed.url,
          file_type: fileType,
          file_size: typeof parsed.size === 'number' ? parsed.size : null,
        },
      ];
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Authorization helper for conversation access.
 */
async function authorizeParticipant(
  conversationId: string,
  userId: string,
  role: string
): Promise<{ authorized: boolean; conversation?: ConversationSummary; isCustomerOwner?: boolean }> {
  const supabase = await createAdminClient();

  const { data: conv, error } = await supabase
    .from('conversations')
    .select('id, customer_id, status')
    .eq('id', conversationId)
    .single();

  if (error || !conv) {
    return { authorized: false };
  }

  // All staff (admin & super_admin) have access to support live chats
  if (role === 'super_admin' || role === 'admin') {
    return { authorized: true, conversation: conv };
  }

  if (role === 'customer') {
    if (conv.customer_id === userId) {
      return { authorized: true, conversation: conv, isCustomerOwner: true };
    }
    return { authorized: false };
  }

  return { authorized: false };
}

/**
 * GET /api/conversations/[id]/messages
 * Bounded pagination and role-aware sender identification:
 * - Customers see their messages as "You", and all staff messages as "Support Team".
 * - Staff sees real sender display names and roles.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const { errorResponse, profile } = await requireApiAuth();
  if (errorResponse) return errorResponse;

  const supabase = await createAdminClient();

  const { authorized, conversation } = await authorizeParticipant(id, profile.id, profile.role);
  if (!authorized || !conversation) {
    return NextResponse.json({ error: 'Conversation not found or access denied' }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  // Bounded pagination: min 1, max 100, default 30 (faster initial bottom message load)
  const limitParam = parseInt(searchParams.get('limit') || '30', 10);
  const limit = Math.min(Math.max(isNaN(limitParam) ? 30 : limitParam, 1), 100);
  const before = searchParams.get('before'); // ISO timestamp cursor for older messages
  const after = searchParams.get('after') || searchParams.get('since'); // ISO timestamp cursor for new messages

  // Build messages query
  let query = supabase
    .from('messages')
    .select(`
      id,
      conversation_id,
      sender_id,
      body,
      message_type,
      created_at,
      edited_at,
      sender:accounts!messages_sender_id_fkey(id, display_name, role)
    `)
    .eq('conversation_id', id);

  if (after) {
    query = query.gt('created_at', after).order('created_at', { ascending: true });
  } else if (before) {
    query = query.lt('created_at', before).order('created_at', { ascending: false });
  } else {
    // Initial load: Fetch the down (latest) messages first
    query = query.order('created_at', { ascending: false });
  }

  // Fetch messages up to limit
  const { data: messages, error: msgsError } = await query.limit(limit);

  if (msgsError) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(msgsError, 'Unable to load conversation messages right now.') },
      { status: 500 }
    );
  }

  // If `after` was used, results are already chronological ascending; otherwise reverse descending query to ascending
  const chronological = after
    ? ((messages as unknown as RawMessageRow[]) || [])
    : ((messages as unknown as RawMessageRow[]) || []).reverse();

  // Fetch attachments from dedicated table for these messages
  const messageIds = chronological.map((m) => m.id);
  const attachmentsByMsgId: Record<string, MessageAttachmentItem[]> = {};

  if (messageIds.length > 0) {
    try {
      const { data: attData } = await supabase
        .from('attachments')
        .select('id, message_id, conversation_id, file_name, file_url, file_type, file_size')
        .in('message_id', messageIds);

      if (attData) {
        for (const att of attData) {
          if (att.message_id) {
            if (!attachmentsByMsgId[att.message_id]) {
              attachmentsByMsgId[att.message_id] = [];
            }
            attachmentsByMsgId[att.message_id].push({
              id: att.id,
              file_name: att.file_name,
              file_url: att.file_url,
              file_type: att.file_type,
              file_size: att.file_size,
            });
          }
        }
      }
    } catch (attErr) {
      console.warn('[Messages GET] Attachment fetch non-fatal error:', attErr);
    }
  }

  // Role-aware identity masking and attachment stitching
  const isCustomerViewer = profile.role === 'customer';

  const sanitizedMessages = chronological.map((msg) => {
    const isSelf = msg.sender_id === profile.id;
    const senderProfile = msg.sender;

    const dbAttachments = attachmentsByMsgId[msg.id];
    const legacyAttachments = !dbAttachments || dbAttachments.length === 0 ? parseLegacyMediaAttachment(msg.body, msg.id) : null;
    const finalAttachments = dbAttachments && dbAttachments.length > 0 ? dbAttachments : (legacyAttachments || []);
    const cleanBody = legacyAttachments && legacyAttachments.length > 0 ? '' : msg.body;

    if (isCustomerViewer) {
      // Customer views map staff messages to generic "Support Team" and hide individual staff IDs
      if (isSelf) {
        return {
          id: msg.id,
          conversation_id: msg.conversation_id,
          body: cleanBody,
          message_type: msg.message_type,
          created_at: msg.created_at,
          edited_at: msg.edited_at,
          is_self: true,
          sender_name: 'You',
          sender_role: 'customer',
          attachments: finalAttachments,
        };
      }

      return {
        id: msg.id,
        conversation_id: msg.conversation_id,
        body: cleanBody,
        message_type: msg.message_type,
        created_at: msg.created_at,
        edited_at: msg.edited_at,
        is_self: false,
        sender_name: 'Sandy Gaming',
        sender_role: 'staff',
        attachments: finalAttachments,
      };
    }

    // STAFF VIEWER (Admin / Super Admin): Real sender identity preserved
    const senderRole = senderProfile?.role || 'staff';
    const senderName = isSelf
      ? 'You'
      : senderProfile?.display_name || (senderRole === 'customer' ? 'Customer' : 'Specialist');

    return {
      id: msg.id,
      conversation_id: msg.conversation_id,
      sender_id: msg.sender_id,
      body: cleanBody,
      message_type: msg.message_type,
      created_at: msg.created_at,
      edited_at: msg.edited_at,
      is_self: isSelf,
      sender_name: senderName,
      sender_role: senderRole,
      attachments: finalAttachments,
    };
  });

  return NextResponse.json({
    conversation_id: id,
    status: conversation.status,
    messages: sanitizedMessages,
    has_more: (messages?.length ?? 0) === limit,
  });
}

/**
 * POST /api/conversations/[id]/messages
 * Secure message dispatch:
 * - Derives sender strictly from authenticated session (profile.id).
 * - Enforces length boundaries (1 - 5000 characters).
 * - Links Discord-style attachments stored in dedicated attachments table.
 * - Prevents rapid accidental duplicate submissions.
 * - Updates conversation.last_message_at via PostgreSQL trigger.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const { errorResponse, profile } = await requireApiAuth();
  if (errorResponse) return errorResponse;

  const supabase = await createAdminClient();

  const { authorized, conversation } = await authorizeParticipant(id, profile.id, profile.role);
  if (!authorized || !conversation) {
    return NextResponse.json({ error: 'Conversation not found or access denied' }, { status: 404 });
  }

  let bodyData: Record<string, unknown> = {};
  try {
    bodyData = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }

  // 1. Content and attachments validation
  const rawBody = typeof bodyData.body === 'string' ? bodyData.body : '';
  let trimmedBody = rawBody.trim();

  const rawAttachments = Array.isArray(bodyData.attachments) ? bodyData.attachments : [];
  const rawAttachmentIds = Array.isArray(bodyData.attachment_ids) ? (bodyData.attachment_ids as string[]) : [];

  if (trimmedBody.length === 0) {
    if (rawAttachments.length > 0) {
      trimmedBody = (rawAttachments[0]?.file_name as string) || 'Attachment';
    } else if (rawAttachmentIds.length > 0) {
      trimmedBody = 'Attachment';
    } else {
      return NextResponse.json({ error: 'Message body or attachment is required' }, { status: 400 });
    }
  }

  if (trimmedBody.length > 5000) {
    return NextResponse.json({ error: 'Message body cannot exceed 5000 characters' }, { status: 400 });
  }

  const allowedTypes: MessageType[] = ['text', 'system', 'media'];
  const messageType: MessageType = allowedTypes.includes(bodyData.message_type as MessageType)
    ? (bodyData.message_type as MessageType)
    : (rawAttachments.length > 0 || rawAttachmentIds.length > 0 ? 'media' : 'text');

  // 2. Duplicate submission safeguard
  const threeSecondsAgo = new Date(Date.now() - 3000).toISOString();
  const { data: recentDuplicate } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, body, message_type, created_at, edited_at')
    .eq('conversation_id', id)
    .eq('sender_id', profile.id)
    .eq('body', trimmedBody)
    .gte('created_at', threeSecondsAgo)
    .maybeSingle();

  if (recentDuplicate) {
    return NextResponse.json(
      {
        message: {
          ...recentDuplicate,
          is_self: true,
          sender_name: 'You',
          sender_role: profile.role === 'customer' ? 'customer' : 'staff',
          attachments: [],
        },
        duplicate_prevented: true,
      },
      { status: 200 }
    );
  }

  // 3. Secure insert: Sender derived STRICTLY from server session (profile.id)
  const { data: insertedMessage, error: insertError } = await supabase
    .from('messages')
    .insert({
      conversation_id: id,
      sender_id: profile.id, // Authenticated session ID ONLY
      body: trimmedBody,
      message_type: messageType,
    })
    .select('id, conversation_id, sender_id, body, message_type, created_at, edited_at')
    .single();

  if (insertError) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(insertError, 'Unable to send message right now. Please try again.') },
      { status: 500 }
    );
  }

  // 5. Store & Link Attachments to the inserted message
  const insertedMsgId = insertedMessage.id;
  const finalAttachments: MessageAttachmentItem[] = [];

  if (rawAttachmentIds.length > 0) {
    try {
      const { data: updatedAtts } = await supabase
        .from('attachments')
        .update({ message_id: insertedMsgId })
        .in('id', rawAttachmentIds)
        .eq('conversation_id', id)
        .select('id, file_name, file_url, file_type, file_size');

      if (updatedAtts) {
        for (const a of updatedAtts) {
          finalAttachments.push({
            id: a.id,
            file_name: a.file_name,
            file_url: a.file_url,
            file_type: a.file_type,
            file_size: a.file_size,
          });
        }
      }
    } catch (linkErr) {
      console.warn('[Messages Route] Attachment link error:', linkErr);
    }
  }

  if (rawAttachments.length > 0) {
    const normalizeAttachmentType = (rawType: unknown): 'image' | 'video' | 'audio' | 'file' => {
      const t = typeof rawType === 'string' ? rawType.toLowerCase() : '';
      if (t === 'image' || t === 'images' || t.startsWith('image/')) return 'image';
      if (t === 'video' || t === 'videos' || t.startsWith('video/')) return 'video';
      if (t === 'audio' || t === 'voice' || t.startsWith('audio/')) return 'audio';
      return 'file';
    };

    const toInsert = rawAttachments
      .filter((a) => a && typeof a.file_url === 'string')
      .map((a) => ({
        message_id: insertedMsgId,
        conversation_id: id,
        file_name: ((a.file_name as string) || 'attachment').slice(0, 200),
        file_url: a.file_url as string,
        file_type: normalizeAttachmentType(a.file_type),
        file_size: typeof a.file_size === 'number' && a.file_size > 0 ? a.file_size : null,
      }));

    if (toInsert.length > 0) {
      try {
        const { data: insertedAtts } = await supabase
          .from('attachments')
          .insert(toInsert)
          .select('id, file_name, file_url, file_type, file_size');

        if (insertedAtts) {
          for (const a of insertedAtts) {
            finalAttachments.push({
              id: a.id,
              file_name: a.file_name,
              file_url: a.file_url,
              file_type: a.file_type,
              file_size: a.file_size,
            });
          }
        }
      } catch (attInsertErr) {
        console.warn('[Messages Route] Attachment insert error:', attInsertErr);
      }
    }
  }

  // 6. Broadcast message via Realtime channel (Dual-path delivery alongside DB trigger)
  const isCustomerSender = profile.role === 'customer';
  const displayBody = (rawAttachments.length > 0 || rawAttachmentIds.length > 0) && rawBody.trim() === '' ? '' : insertedMessage.body;

  const broadcastPayload = {
    id: insertedMessage.id,
    conversation_id: insertedMessage.conversation_id,
    body: displayBody,
    message_type: insertedMessage.message_type,
    created_at: insertedMessage.created_at,
    sender_id: insertedMessage.sender_id,
    sender_role: profile.role,
    sender_name: isCustomerSender ? (profile.display_name || 'Customer') : 'Sandy Gaming',
    true_sender_name: profile.display_name || 'Staff Member',
    attachments: finalAttachments,
  };

  // Broadcast event to Supabase Realtime channel (awaited for Vercel serverless lifecycle)
  try {
    await broadcastConversationEvent(id, 'new_message', broadcastPayload);
  } catch (err) {
    console.error('[Messages Route] Realtime broadcast error (non-fatal):', err);
  }

  return NextResponse.json(
    {
      message: {
        ...insertedMessage,
        body: displayBody,
        is_self: true,
        sender_name: 'You',
        sender_role: profile.role === 'customer' ? 'customer' : 'staff',
        attachments: finalAttachments,
      },
    },
    { status: 201 }
  );
}
