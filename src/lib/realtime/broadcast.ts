import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://mreswugnlozzxbkwihqr.supabase.co';
const DEFAULT_SUPABASE_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZXN3dWdubG96enhia3dpaHFyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzI4NTEwMywiZXhwIjoyMTA4ODYxMTAzfQ.iRmt_1MPfmdrLSJdCb4TAib2W8_A1QsBtKjHHpqlOmQ';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SUPABASE_SERVICE_KEY;

let realtimeAdminClient: SupabaseClient | null = null;

function getRealtimeAdminClient(): SupabaseClient | null {
  if (!realtimeAdminClient && supabaseUrl && serviceRoleKey) {
    realtimeAdminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return realtimeAdminClient;
}

export type RealtimeBroadcastEvent =
  | 'new_message'
  | 'status_changed';

/**
 * Broadcasts an event to a private conversation topic.
 * Uses service-role authorization to bypass client RLS on emission.
 * Subscribing clients receive the event subject to private channel authorization.
 */
export async function broadcastConversationEvent(
  conversationId: string,
  event: RealtimeBroadcastEvent,
  payload: Record<string, unknown>
): Promise<boolean> {
  const client = getRealtimeAdminClient();
  if (!client) {
    console.warn('[Realtime Broadcast] Service role client is not configured');
    return false;
  }

  const topic = `chat:${conversationId}`;
  const channel = client.channel(topic, {
    config: {
      broadcast: { ack: true, self: false },
    },
  });

  return new Promise((resolve) => {
    let completed = false;

    const timeout = setTimeout(async () => {
      if (!completed) {
        completed = true;
        try {
          await client.removeChannel(channel);
        } catch {}
        resolve(false);
      }
    }, 1500);

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && !completed) {
        try {
          await channel.send({
            type: 'broadcast',
            event,
            payload,
          });
        } catch (err) {
          console.error(`[Realtime Broadcast Error: ${event}]`, err);
        } finally {
          if (!completed) {
            completed = true;
            clearTimeout(timeout);
            // Allow brief flush window so WebSocket frame is dispatched before channel teardown
            setTimeout(async () => {
              try {
                await client.removeChannel(channel);
              } catch {}
            }, 150);
            resolve(true);
          }
        }
      } else if (status === 'CHANNEL_ERROR' && !completed) {
        completed = true;
        clearTimeout(timeout);
        try {
          await client.removeChannel(channel);
        } catch {}
        resolve(false);
      }
    });
  });
}
