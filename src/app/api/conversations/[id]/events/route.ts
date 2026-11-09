import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  // 1. Authenticate user from session cookies
  const { errorResponse, profile } = await requireApiAuth();
  if (errorResponse || !profile) {
    return errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Authorize user for this conversation
  const supabase = await createAdminClient();
  const { data: conv, error: convError } = await supabase
    .from('conversations')
    .select('id, customer_id, status')
    .eq('id', id)
    .single();

  if (convError || !conv) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  const isStaff = profile.role === 'admin' || profile.role === 'super_admin';
  const isCustomerOwner = profile.role === 'customer' && conv.customer_id === profile.id;

  if (!isStaff && !isCustomerOwner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Realtime service not configured' }, { status: 500 });
  }

  // Privileged server-side client: keeps URL and keys strictly on server
  const serverRealtimeClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const encoder = new TextEncoder();
  let pingInterval: NodeJS.Timeout | null = null;
  let channel: ReturnType<typeof serverRealtimeClient.channel> | null = null;

  // Role-aware payload sanitizer: masks staff identity from customer viewers
  const sanitizeForViewer = (raw: Record<string, unknown>) => {
    const isSelf = raw.sender_id === profile.id;
    if (isCustomerOwner) {
      const sanitized: Record<string, unknown> = {
        id: raw.id,
        conversation_id: raw.conversation_id,
        body: raw.body,
        message_type: raw.message_type,
        created_at: raw.created_at,
        edited_at: raw.edited_at || null,
        is_self: isSelf,
        sender_name: isSelf ? 'You' : 'Sandy Gaming',
        sender_role: isSelf ? 'customer' : 'staff',
        attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
      };
      return sanitized;
    }

    return {
      ...raw,
      is_self: isSelf,
      sender_name: isSelf
        ? 'You'
        : (raw.true_sender_name as string) || (raw.sender_name as string) || 'Customer',
    };
  };

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ status: 'connected' })}\n\n`)
      );

      pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          if (pingInterval) clearInterval(pingInterval);
        }
      }, 15000);

      const topic = `chat:${id}`;
      channel = serverRealtimeClient.channel(topic, {
        config: {
          broadcast: { ack: false, self: false },
        },
      });

      const dispatchEvent = (eventName: string, payload: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`)
          );
        } catch (err) {
          console.error('[SSE Proxy Error dispatching]', err);
        }
      };

      channel
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${id}`,
          },
          (payload) => {
            if (payload?.new && typeof payload.new === 'object') {
              dispatchEvent('message', sanitizeForViewer(payload.new as Record<string, unknown>));
            }
          }
        )
        .on('broadcast', { event: 'new_message' }, (resp) => {
          if (resp?.payload && typeof resp.payload === 'object') {
            dispatchEvent('message', sanitizeForViewer(resp.payload as Record<string, unknown>));
          }
        })
        .on('broadcast', { event: 'status_changed' }, (resp) => {
          if (resp?.payload) {
            dispatchEvent('status_changed', resp.payload);
          }
        })
        .subscribe();
    },
    cancel() {
      if (pingInterval) clearInterval(pingInterval);
      if (channel) {
        serverRealtimeClient.removeChannel(channel).catch(() => {});
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
