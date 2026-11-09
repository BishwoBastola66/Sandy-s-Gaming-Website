import { NextResponse, type NextRequest } from 'next/server';
import { requireApiAuth } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { sanitizeErrorMessage } from '@/lib/validation/error-sanitizer';
import {
  uploadFileToSupabaseStorage,
  sanitizeStorageSegment,
} from '@/lib/supabase/storage';
import {
  TICKET_WITH_CUSTOMER_SELECT,
  mapTicketRowToItem,
  type TicketAttachment,
  type TicketReply,
  type TicketItem,
  type TicketCategory,
  type TicketPriority,
} from '@/types/tickets';
import type { Json } from '@/types/database';

export type { TicketAttachment, TicketReply, TicketItem };

const VALID_CATEGORIES: readonly TicketCategory[] = [
  'tournament',
  'account',
  'gameplay',
  'payment',
  'bug',
  'general',
];

const VALID_PRIORITIES: readonly TicketPriority[] = ['low', 'medium', 'high', 'urgent'];

export async function GET(req: NextRequest) {
  const { errorResponse, profile } = await requireApiAuth();
  if (errorResponse) return errorResponse;

  const isStaff = profile.role === 'admin' || profile.role === 'super_admin';
  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get('status');

  try {
    const supabase = await createAdminClient();
    let query = supabase
      .from('tickets')
      .select(TICKET_WITH_CUSTOMER_SELECT)
      .order('created_at', { ascending: false });

    if (!isStaff) {
      query = query.eq('customer_id', profile.id);
    }

    if (
      statusParam &&
      statusParam !== 'all' &&
      ['open', 'in_progress', 'resolved', 'closed'].includes(statusParam)
    ) {
      query = query.eq('status', statusParam);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: sanitizeErrorMessage(error, 'Unable to load support tickets right now.') },
        { status: 500 }
      );
    }

    const tickets = (data || []).map((row) =>
      mapTicketRowToItem(row as unknown as Record<string, unknown>)
    );

    return NextResponse.json({ success: true, tickets });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(err, 'Unable to load support tickets right now.') },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { errorResponse, profile } = await requireApiAuth();
  if (errorResponse) return errorResponse;

  try {
    const contentType = req.headers.get('content-type') || '';
    let title = '';
    let description = '';
    let category = '';
    let priority = '';
    let attachments: TicketAttachment[] = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      title = (formData.get('title') as string) || '';
      description = (formData.get('description') as string) || '';
      category = (formData.get('category') as string) || '';
      priority = (formData.get('priority') as string) || '';

      const rawAtt = formData.get('attachments') as string | null;
      if (rawAtt) {
        try {
          attachments = JSON.parse(rawAtt);
        } catch {
          attachments = [];
        }
      }

      const files = formData.getAll('files') as File[];
      const singleFile = formData.get('file') as File | null;
      const allFiles = [...files];
      if (singleFile && !allFiles.includes(singleFile)) {
        allFiles.push(singleFile);
      }

      const cleanEmail = sanitizeStorageSegment(profile.email || profile.id);

      for (const file of allFiles) {
        if (!file || typeof file.arrayBuffer !== 'function' || file.size === 0) continue;
        const uploaded = await uploadFileToSupabaseStorage({
          file,
          folder: `tickets/${cleanEmail}`,
          bucket: 'public-media',
        });

        attachments.push({
          name: file.name.slice(0, 120),
          url: uploaded.publicUrl,
          type: uploaded.fileType === 'audio' ? 'doc' : uploaded.fileType,
          size: uploaded.sizeBytes,
        });
      }
    } else {
      const body = await req.json().catch(() => ({}));
      title = body.title || '';
      description = body.description || '';
      category = body.category || '';
      priority = body.priority || '';
      attachments = Array.isArray(body.attachments) ? body.attachments : [];
    }

    const trimmedTitle = (title || '').trim();
    const trimmedDesc = (description || '').trim();

    if (!trimmedTitle || trimmedTitle.length < 3) {
      return NextResponse.json(
        { error: 'Ticket title must be at least 3 characters long.' },
        { status: 400 }
      );
    }
    if (trimmedTitle.length > 200) {
      return NextResponse.json(
        { error: 'Ticket title cannot exceed 200 characters.' },
        { status: 400 }
      );
    }

    if (!trimmedDesc || trimmedDesc.length < 3) {
      return NextResponse.json(
        { error: 'Ticket description must be at least 3 characters long.' },
        { status: 400 }
      );
    }
    if (trimmedDesc.length > 10000) {
      return NextResponse.json(
        { error: 'Description cannot exceed 10,000 characters.' },
        { status: 400 }
      );
    }

    const cleanCategory: TicketCategory = VALID_CATEGORIES.includes(category as TicketCategory)
      ? (category as TicketCategory)
      : 'general';

    const cleanPriority: TicketPriority = VALID_PRIORITIES.includes(priority as TicketPriority)
      ? (priority as TicketPriority)
      : 'medium';

    const cleanAttachments: TicketAttachment[] = Array.isArray(attachments)
      ? attachments.slice(0, 10).map((att) => ({
          name: String(att.name || 'Attachment').slice(0, 120),
          url: String(att.url || ''),
          type: String(att.type || 'file'),
          size: typeof att.size === 'number' ? att.size : undefined,
        }))
      : [];

    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from('tickets')
      .insert({
        customer_id: profile.id,
        title: trimmedTitle,
        description: trimmedDesc,
        category: cleanCategory,
        priority: cleanPriority,
        status: 'open',
        attachments: cleanAttachments as unknown as Json,
        replies: [] as unknown as Json,
      })
      .select(TICKET_WITH_CUSTOMER_SELECT)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: sanitizeErrorMessage(error, 'Unable to create support ticket right now. Please try again.') },
        { status: 500 }
      );
    }

    const ticket = mapTicketRowToItem(data as unknown as Record<string, unknown>, {
      email: profile.email,
      name: profile.display_name,
    });

    return NextResponse.json({ success: true, ticket }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(err, 'Unable to submit support ticket right now.') },
      { status: 500 }
    );
  }
}
