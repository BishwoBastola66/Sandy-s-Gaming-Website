export type TicketCategory =
  | 'tournament'
  | 'account'
  | 'gameplay'
  | 'payment'
  | 'bug'
  | 'general';

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface TicketAttachment {
  name: string;
  url: string;
  type: string;
  size?: number;
}

export interface TicketReply {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_name: string;
  sender_email: string;
  sender_role: 'customer' | 'admin' | 'super_admin';
  message: string;
  created_at: string;
}

export interface TicketItem {
  id: string;
  customer_id: string;
  customer_email: string;
  customer_name: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  attachments: TicketAttachment[];
  replies?: TicketReply[];
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
}

export const TICKET_WITH_CUSTOMER_SELECT =
  '*, customer:accounts!tickets_customer_id_fkey(id, email, display_name)' as const;

export function mapTicketRowToItem(
  row: Record<string, unknown>,
  fallbackCustomer?: { email?: string | null; name?: string | null }
): TicketItem {
  const rawCustomer = row.customer;
  const joinedCustomer = (
    Array.isArray(rawCustomer) ? rawCustomer[0] : rawCustomer
  ) as { id?: string; email?: string | null; display_name?: string | null } | null | undefined;

  return {
    id: String(row.id || ''),
    customer_id: String(row.customer_id || ''),
    customer_email:
      joinedCustomer?.email || fallbackCustomer?.email || 'customer@sandygamings.com',
    customer_name:
      joinedCustomer?.display_name || fallbackCustomer?.name || 'Customer',
    title: String(row.title || ''),
    description: String(row.description || ''),
    category: (row.category as TicketCategory) || 'general',
    priority: (row.priority as TicketPriority) || 'medium',
    status: (row.status as TicketStatus) || 'open',
    attachments: Array.isArray(row.attachments)
      ? (row.attachments as TicketAttachment[])
      : [],
    replies: Array.isArray(row.replies) ? (row.replies as TicketReply[]) : [],
    resolved_at: (row.resolved_at as string | null) ?? null,
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
  };
}


