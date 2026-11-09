import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import {
  SuperAdminConversationsClient,
  type SuperAdminConversationItem,
} from './SuperAdminConversationsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SuperAdminConversationsPage() {
  const profile = await requireRole(['super_admin'], '/super-admin/conversations');
  const supabase = await createAdminClient();

  const { data: rawConversations } = await supabase
    .from('conversations')
    .select(`
      *,
      customer:accounts!conversations_customer_id_fkey(id, display_name, role)
    `)
    .order('last_message_at', { ascending: false });

  const conversations = (rawConversations as unknown as SuperAdminConversationItem[]) || [];

  return (
    <SuperAdminConversationsClient
      initialConversations={conversations}
      currentUserId={profile.id}
      currentUserName={profile.display_name || 'Super Admin'}
    />
  );
}
