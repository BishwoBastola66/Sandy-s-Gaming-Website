import { NextRequest, NextResponse } from 'next/server';
import { getAccountFromSession, verifyPassword, hashPassword } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/server';
import { sanitizeErrorMessage } from '@/lib/validation/error-sanitizer';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const account = await getAccountFromSession();
  if (!account) {
    return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { current_password, new_password } = body;

    if (!current_password || typeof current_password !== 'string') {
      return NextResponse.json({ error: 'Please enter your current password.' }, { status: 400 });
    }
    if (!new_password || typeof new_password !== 'string' || new_password.length < 6) {
      return NextResponse.json(
        { error: 'New password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    const adminClient = await createAdminClient();

    // 1. Fetch current account credentials record with password_hash
    const { data: accData, error: accError } = await adminClient
      .from('accounts')
      .select('id, password_hash')
      .eq('id', account.id)
      .single();

    if (accError || !accData) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    }

    // 2. Verify current password
    if (!accData.password_hash) {
      return NextResponse.json(
        { error: 'This account uses Google OAuth. Password change is not supported.' },
        { status: 400 }
      );
    }

    const passwordValid = verifyPassword(current_password, accData.password_hash);
    if (!passwordValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect. Please verify and try again.' },
        { status: 400 }
      );
    }

    // 3. Hash new password and update accounts table
    const newHash = hashPassword(new_password);
    const { error: updateError } = await adminClient
      .from('accounts')
      .update({ password_hash: newHash })
      .eq('id', account.id);

    if (updateError) {
      return NextResponse.json(
        { error: sanitizeErrorMessage(updateError, 'Unable to update your password right now.') },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully.',
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(err, 'Invalid password update request.') },
      { status: 400 }
    );
  }
}
