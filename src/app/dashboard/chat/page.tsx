import { requireAuth, getCurrentProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CustomerChatClient } from '@/app/(customer)/chat/CustomerChatClient';

export default async function DashboardChatPage() {
  const user = await requireAuth('/login?redirect=/dashboard/chat');
  const profile = await getCurrentProfile();

  // If user is staff (admin or super_admin), route them directly to their conversation inbox
  if (profile?.role === 'super_admin') {
    redirect('/super-admin/conversations');
  }
  if (profile?.role === 'admin') {
    redirect('/admin/conversations');
  }

  const supabase = await createAdminClient();

  // 1. Retrieve or automatically provision the customer's unified continuous conversation
  let { data: activeConv } = await supabase
    .from('conversations')
    .select('*')
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!activeConv) {
    const { data: newConv, error: createError } = await supabase
      .from('conversations')
      .insert({
        customer_id: user.id,
        subject: 'General Support',
        status: 'open',
      })
      .select()
      .single();

    if (createError) {
      console.error('[DashboardChatPage] Error creating conversation:', createError);
    }
    activeConv = newConv;
  }

  interface RawMessage {
    id: string;
    conversation_id: string;
    sender_id: string;
    body: string;
    message_type: string;
    created_at: string;
    edited_at: string | null;
  }

  interface MessageAttachmentItem {
    id: string;
    file_name: string;
    file_url: string;
    file_type: string;
    file_size?: number | null;
  }

  interface MessageItem {
    id: string;
    conversation_id: string;
    body: string;
    message_type: string;
    created_at: string;
    is_self: boolean;
    sender_name: string;
    sender_role: string;
    status: 'sent';
    attachments?: MessageAttachmentItem[];
  }

  function parseLegacyMedia(body: string, msgId: string): MessageAttachmentItem[] | null {
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

  let initialMessages: MessageItem[] = [];
  if (activeConv) {
    // Bottom messages first: fetch latest 30 messages
    const { data: messages } = await supabase
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
      .eq('conversation_id', activeConv.id)
      .order('created_at', { ascending: false })
      .limit(30);

    const chronological = ((messages as unknown as RawMessage[]) || []).reverse();
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
        console.warn('[DashboardChatPage] Attachment pre-fetch non-fatal:', attErr);
      }
    }

    initialMessages = chronological.map((msg) => {
      const isSelf = msg.sender_id === user.id;
      const dbAtts = attachmentsByMsgId[msg.id];
      const legacyAtts = !dbAtts || dbAtts.length === 0 ? parseLegacyMedia(msg.body, msg.id) : null;
      const finalAtts = dbAtts && dbAtts.length > 0 ? dbAtts : (legacyAtts || []);
      const cleanBody = legacyAtts && legacyAtts.length > 0 ? '' : msg.body;

      return {
        id: msg.id,
        conversation_id: msg.conversation_id,
        body: cleanBody,
        message_type: msg.message_type,
        created_at: msg.created_at,
        is_self: isSelf,
        sender_name: isSelf ? 'You' : 'Sandy Gaming',
        sender_role: isSelf ? 'customer' : 'staff',
        status: 'sent',
        attachments: finalAtts,
      };
    });
  }

  return (
    <CustomerChatClient
      initialConversation={activeConv}
      initialMessages={initialMessages}
      currentUserId={user.id}
      customerDisplayName={profile?.display_name || user.email?.split('@')[0] || 'Customer'}
      customerEmail={profile?.email || user.email || ''}
    />
  );
}
