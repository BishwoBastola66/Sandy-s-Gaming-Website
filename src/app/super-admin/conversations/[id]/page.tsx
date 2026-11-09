import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { StaffChatClient } from '@/app/admin/conversations/[id]/StaffChatClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SuperAdminConversationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const profile = await requireRole(['super_admin'], `/super-admin/conversations/${id}`);

  const supabase = await createAdminClient();

  // 1. Check conversation and authorization
  const { data: conv, error: convError } = await supabase
    .from('conversations')
    .select(`
      id,
      customer_id,
      subject,
      status,
      last_message_at,
      created_at,
      customer:accounts!conversations_customer_id_fkey(id, display_name, role)
    `)
    .eq('id', id)
    .single();

  if (convError || !conv) {
    notFound();
  }

  // 2. Load messages with bounded pagination (newest 50 messages)
  const { data: rawMessages } = await supabase
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
    .eq('conversation_id', id)
    .order('created_at', { ascending: false })
    .limit(50);

  interface RawStaffMessage {
    id: string;
    conversation_id: string;
    sender_id: string;
    body: string;
    message_type: string;
    created_at: string;
    sender?: { id: string; display_name: string; role: string } | null;
  }

  const chronological = ((rawMessages as unknown as RawStaffMessage[]) || []).reverse();
  const initialMessages = chronological.map((msg) => {
    const isSelf = msg.sender_id === profile.id;
    const sender = msg.sender;
    const senderRole = sender?.role || 'staff';
    const senderName = isSelf
      ? 'You'
      : sender?.display_name || (senderRole === 'customer' ? 'Customer' : 'Specialist');

    return {
      id: msg.id,
      conversation_id: msg.conversation_id,
      sender_id: msg.sender_id,
      body: msg.body,
      message_type: msg.message_type,
      created_at: msg.created_at,
      is_self: isSelf,
      sender_name: senderName,
      sender_role: senderRole,
      status: 'sent' as const,
    };
  });

  return (
    <StaffChatClient
      conversationId={id}
      initialConversation={conv as unknown as Parameters<typeof StaffChatClient>[0]['initialConversation']}
      initialMessages={initialMessages}
      currentUser={{
        id: profile.id,
        role: profile.role,
        displayName: profile.display_name,
      }}
    />
  );
}
