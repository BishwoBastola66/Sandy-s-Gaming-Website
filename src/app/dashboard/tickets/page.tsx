import { requireAuth, getCurrentProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { TicketsClient } from './TicketsClient';
import { TICKET_WITH_CUSTOMER_SELECT, mapTicketRowToItem, type TicketItem } from '@/types/tickets';

export const dynamic = 'force-dynamic';

export default async function DashboardTicketsPage() {
  const user = await requireAuth('/login?redirect=/dashboard/tickets');
  const profile = await getCurrentProfile();

  if (profile?.role === 'super_admin') {
    redirect('/super-admin/tickets');
  }
  if (profile?.role === 'admin') {
    redirect('/admin/tickets');
  }

  let initialTickets: TicketItem[] = [];

  try {
    const supabase = await createAdminClient();
    const { data } = await supabase
      .from('tickets')
      .select(TICKET_WITH_CUSTOMER_SELECT)
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });

    if (data && Array.isArray(data)) {
      initialTickets = data.map((row) =>
        mapTicketRowToItem(row as unknown as Record<string, unknown>, {
          email: profile?.email || user.email,
          name: profile?.display_name,
        })
      );
    }
  } catch (err) {
    console.error('[DashboardTicketsPage] Failed to load tickets from Supabase:', err);
  }

  return (
    <div className="w-full flex-1 flex flex-col px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6 animate-page-enter">
      <TicketsClient
        initialTickets={initialTickets}
        customerEmail={profile?.email || user.email || ''}
        customerName={profile?.display_name || user.email?.split('@')[0] || 'Customer'}
      />
    </div>
  );
}
