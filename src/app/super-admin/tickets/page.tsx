import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { AdminTicketsClient } from '@/app/admin/tickets/AdminTicketsClient';
import { TICKET_WITH_CUSTOMER_SELECT, mapTicketRowToItem, type TicketItem } from '@/types/tickets';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SuperAdminTicketsPage() {
  const profile = await requireRole(['super_admin'], '/super-admin/tickets');

  let initialTickets: TicketItem[] = [];

  try {
    const supabase = await createAdminClient();
    const { data } = await supabase
      .from('tickets')
      .select(TICKET_WITH_CUSTOMER_SELECT)
      .order('created_at', { ascending: false });

    if (data && Array.isArray(data)) {
      initialTickets = data.map((row) =>
        mapTicketRowToItem(row as unknown as Record<string, unknown>)
      );
    }
  } catch (err) {
    console.error('[SuperAdminTicketsPage] Failed to load tickets from Supabase:', err);
  }

  return (
    <AdminTicketsClient
      initialTickets={initialTickets}
      adminDisplayName={profile.display_name || profile.email?.split('@')[0] || 'Super Admin'}
    />
  );
}
