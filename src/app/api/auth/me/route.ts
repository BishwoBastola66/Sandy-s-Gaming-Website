import { NextRequest, NextResponse } from 'next/server';
import { getAccountFromSession } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/server';
import { sanitizeErrorMessage } from '@/lib/validation/error-sanitizer';

export const dynamic = 'force-dynamic';

export async function GET() {
  const account = await getAccountFromSession();
  if (!account) {
    return NextResponse.json({ authenticated: false, account: null });
  }

  return NextResponse.json({
    authenticated: true,
    account: {
      id: account.id,
      email: account.email,
      phone: account.phone || null,
      display_name: account.display_name,
      role: account.role,
      account_status: account.account_status,
      provider: account.provider || 'email',
      provider_id: account.provider_id || null,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const account = await getAccountFromSession();
  if (!account) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const updates: { display_name?: string; phone?: string | null } = {};

    if (typeof body.display_name === 'string') {
      const trimmed = body.display_name.trim().slice(0, 50);
      if (trimmed.length < 2) {
        return NextResponse.json(
          { error: 'Display name must be at least 2 characters long.' },
          { status: 400 }
        );
      }
      updates.display_name = trimmed;
    }

    if (typeof body.phone === 'string') {
      const trimmedPhone = body.phone.trim().slice(0, 20);
      updates.phone = trimmedPhone || null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided to update.' }, { status: 400 });
    }

    const supabase = await createAdminClient();

    // Update canonical account row in public.accounts
    const { data: updatedAccount, error: updateError } = await supabase
      .from('accounts')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', account.id)
      .select('id, email, phone, display_name, role, account_status')
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: sanitizeErrorMessage(updateError, 'Unable to update your profile settings right now.') },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      account: updatedAccount,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(err, 'Invalid profile update request.') },
      { status: 400 }
    );
  }
}
