import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { AdminInboxClient, type InboxConversationItem, type StaffMessage } from './AdminInboxClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminConversationsListPage() {
  const profile = await requireRole(['admin'], '/admin/conversations');
  const supabase = await createAdminClient();

  // Fetch all conversations for the admin inbox
  const { data } = await supabase
    .from('conversations')
    .select(`
      id,
      subject,
      status,
      last_message_at,
      created_at,
      customer:accounts!conversations_customer_id_fkey(id, display_name, role)
    `)
    .order('last_message_at', { ascending: false });

  const convs = (data as unknown as InboxConversationItem[]) || [];

  // Also pre-fetch messages for the first conversation if available so it loads with zero delay!
  let initialMessages: StaffMessage[] = [];
  if (convs.length > 0) {
    const firstConvId = convs[0].id;

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
      .eq('conversation_id', firstConvId)
      .order('created_at', { ascending: false })
      .limit(30);

    interface PrefetchedRawMessage {
      id: string;
      conversation_id: string;
      sender_id: string;
      body: string;
      message_type: string;
      created_at: string;
      edited_at: string | null;
      sender?: { id: string; display_name: string; role: string } | null;
    }

    const chronological = ((messages as unknown as PrefetchedRawMessage[]) || []).reverse();
    const messageIds = chronological.map((m) => m.id);
    const attachmentsByMsgId: Record<string, { id: string; file_name: string; file_url: string; file_type: string; file_size?: number | null }[]> = {};

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
        console.warn('[AdminInbox] Attachment pre-fetch non-fatal:', attErr);
      }
    }

    initialMessages = chronological.map((msg) => {
      const isSelf = msg.sender_id === profile.id;
      const senderRole = msg.sender?.role || 'staff';
      const senderName = isSelf
        ? profile.display_name || 'You'
        : msg.sender?.display_name || (senderRole === 'customer' ? (convs[0].customer?.display_name || 'Customer') : 'Specialist');

      const dbAtts = attachmentsByMsgId[msg.id];
      let legacyAtts = null;
      if (!dbAtts || dbAtts.length === 0) {
        try {
          if (msg.body && msg.body.startsWith('{')) {
            const parsed = JSON.parse(msg.body);
            if (parsed && typeof parsed.url === 'string') {
              legacyAtts = [{
                id: `legacy-${msg.id}`,
                file_name: parsed.name || 'Attachment',
                file_url: parsed.url,
                file_type: parsed.type || 'image',
                file_size: parsed.size || 0,
              }];
            }
          }
        } catch {
          // ignore
        }
      }
      const finalAtts = dbAtts && dbAtts.length > 0 ? dbAtts : (legacyAtts || []);
      const cleanBody = legacyAtts && legacyAtts.length > 0 ? '' : msg.body;

      return {
        id: msg.id,
        conversation_id: msg.conversation_id,
        body: cleanBody,
        message_type: msg.message_type,
        created_at: msg.created_at,
        is_self: isSelf,
        sender_id: msg.sender_id,
        sender_name: senderName,
        sender_role: senderRole,
        status: 'sent' as const,
        attachments: finalAtts,
      };
    });
  }

  return (
    <AdminInboxClient
      initialConversations={convs}
      initialMessages={initialMessages}
      userRole={profile.role}
      currentUserId={profile.id}
      currentUserName={profile.display_name || 'Support Specialist'}
    />
  );
}
