import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireApiAuth } from '@/lib/auth/api-auth';
import { sanitizeErrorMessage } from '@/lib/validation/error-sanitizer';

/**
 * GET /api/conversations
 * - Customer: Retrieves active conversation or customer's conversation list.
 * - Admin / Super Admin: Retrieves all support conversations with customer details.
 */
export async function GET(req: NextRequest) {
  const { errorResponse, profile } = await requireApiAuth();
  if (errorResponse) return errorResponse;

  const supabase = await createAdminClient();

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('mode'); // 'active' | 'all'

  // CUSTOMER FLOW
  if (profile.role === 'customer') {
    if (mode === 'active' || !mode) {
      // Find latest active conversation (open or in_progress)
      const { data: activeConv, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .eq('customer_id', profile.id)
        .in('status', ['open', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (convError) {
        return NextResponse.json(
          { error: sanitizeErrorMessage(convError, 'Unable to load conversation right now.') },
          { status: 500 }
        );
      }

      // If active conversation found, return it
      if (activeConv) {
        return NextResponse.json({ conversation: activeConv });
      }

      // If no active conversation exists and auto_create is requested or default
      const autoCreate = searchParams.get('auto_create') !== 'false';
      if (autoCreate) {
        const { data: newConv, error: createError } = await supabase
          .from('conversations')
          .insert({
            customer_id: profile.id,
            subject: 'General Support',
            status: 'open',
          })
          .select()
          .single();

        if (createError) {
          return NextResponse.json(
            { error: sanitizeErrorMessage(createError, 'Unable to start support conversation right now.') },
            { status: 500 }
          );
        }
        return NextResponse.json({ conversation: newConv, is_new: true });
      }

      return NextResponse.json({ conversation: null });
    }

    // mode === 'all'
    const { data: allConvs, error: allConvsError } = await supabase
      .from('conversations')
      .select('*')
      .eq('customer_id', profile.id)
      .order('created_at', { ascending: false });

    if (allConvsError) {
      return NextResponse.json(
        { error: sanitizeErrorMessage(allConvsError, 'Unable to load support conversations right now.') },
        { status: 500 }
      );
    }
    return NextResponse.json({ conversations: allConvs });
  }

  // STAFF FLOW (Admin & Super Admin have unified access to all support conversations)
  if (profile.role === 'admin' || profile.role === 'super_admin') {
    const { data: convs, error: convsError } = (await supabase
      .from('conversations')
      .select('*, customer:accounts!conversations_customer_id_fkey(id, display_name, role)')
      .order('last_message_at', { ascending: false })) as {
      data: Record<string, unknown>[] | null;
      error: { message: string } | null;
    };

    if (convsError) {
      return NextResponse.json(
        { error: sanitizeErrorMessage(convsError, 'Unable to load support conversations right now.') },
        { status: 500 }
      );
    }

    return NextResponse.json({ conversations: convs });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

/**
 * POST /api/conversations
 * - Customer initiates a new conversation thread.
 */
export async function POST(req: NextRequest) {
  const { errorResponse, profile } = await requireApiAuth();
  if (errorResponse) return errorResponse;

  const supabase = await createAdminClient();

  let bodyData: { subject?: string; initial_message?: string } = {};
  try {
    bodyData = await req.json();
  } catch {
    // Empty body is acceptable
  }

  const subject = (bodyData.subject?.trim() || 'General Support').slice(0, 100);

  // Create conversation record
  const { data: conversation, error: createError } = await supabase
    .from('conversations')
    .insert({
      customer_id: profile.id,
      subject,
      status: 'open',
    })
    .select()
    .single();

  if (createError) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(createError, 'Unable to start support conversation right now.') },
      { status: 500 }
    );
  }

  // If initial message provided, insert it
  let firstMessage = null;
  if (bodyData.initial_message && bodyData.initial_message.trim().length > 0) {
    const trimmedMsg = bodyData.initial_message.trim().slice(0, 5000);
    const { data: msg, error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        sender_id: profile.id,
        body: trimmedMsg,
        message_type: 'text',
      })
      .select()
      .single();

    if (!msgError) {
      firstMessage = msg;
    }
  }

  return NextResponse.json(
    {
      conversation,
      message: firstMessage,
    },
    { status: 201 }
  );
}
