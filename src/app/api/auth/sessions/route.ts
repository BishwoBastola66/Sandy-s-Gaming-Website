import { NextResponse } from 'next/server';
import { getAccountFromSession, destroySession, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function DELETE(request: Request) {
  try {
    const user = await getAccountFromSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { sessionId, revokeAllOthers } = body as { sessionId?: string; revokeAllOthers?: boolean };

    const supabase = await createAdminClient();
    const cookieStore = await cookies();
    const currentToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (revokeAllOthers) {
      if (currentToken) {
        await supabase
          .from('sessions')
          .delete()
          .eq('account_id', user.id)
          .neq('session_token', currentToken);
      }
      return NextResponse.json({ success: true, message: 'Signed out of all other devices.' });
    }

    if (sessionId) {
      const { data: targetSession } = await supabase
        .from('sessions')
        .select('session_token')
        .eq('id', sessionId)
        .eq('account_id', user.id)
        .maybeSingle();

      if (targetSession) {
        await supabase.from('sessions').delete().eq('id', sessionId);
        if (currentToken && targetSession.session_token === currentToken) {
          await destroySession();
          return NextResponse.json({ success: true, isCurrent: true, message: 'Current session signed out.' });
        }
      }
      return NextResponse.json({ success: true, message: 'Device session terminated.' });
    }

    return NextResponse.json({ error: 'Missing sessionId or revokeAllOthers' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to revoke session';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

