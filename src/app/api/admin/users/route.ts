import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { hashPassword } from '@/lib/auth/session';
import { sanitizeErrorMessage } from '@/lib/validation/error-sanitizer';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

const provisionUserSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  displayName: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  role: z.enum(['admin', 'super_admin', 'customer']),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128).optional().or(z.literal('')),
});

const updateRoleSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  role: z.enum(['admin', 'super_admin', 'customer']),
  accountStatus: z.enum(['active', 'suspended', 'pending']).optional(),
});

// GET /api/admin/users - List users (Super Admin only)
export async function GET() {
  const { errorResponse } = await requireApiRole(['super_admin']);
  if (errorResponse) return errorResponse;

  const adminClient = await createAdminClient();
  const { data: users, error } = await adminClient
    .from('accounts')
    .select('id, email, display_name, phone, role, account_status, provider, provider_id, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error, 'Unable to load user accounts right now.') },
      { status: 500 }
    );
  }

  return NextResponse.json({ users: users || [] });
}

// POST /api/admin/users - Provision or update a user account in database (Super Admin only)
export async function POST(request: NextRequest) {
  const { errorResponse, profile } = await requireApiRole(['super_admin']);
  if (errorResponse) return errorResponse;

  const json = await request.json();
  const parsed = provisionUserSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { email, displayName, role, password } = parsed.data;
  const cleanEmail = email.toLowerCase();
  const initialPassword =
    password && password.length >= 6
      ? password
      : `SG-${crypto.randomBytes(6).toString('base64url')}!`;
  const passwordHash = hashPassword(initialPassword);
  const adminClient = await createAdminClient();
  const nowIso = new Date().toISOString();

  // Check if account already exists
  const { data: existingAccount } = await adminClient
    .from('accounts')
    .select('id, role')
    .eq('email', cleanEmail)
    .maybeSingle();

  if (existingAccount) {
    const updatePayload: import('@/types/database').Database['public']['Tables']['accounts']['Update'] = {
      role,
      display_name: displayName,
      account_status: 'active',
      updated_at: nowIso,
    };

    if (password && password.length >= 6) {
      updatePayload.password_hash = passwordHash;
      updatePayload.provider = 'email';
    }

    const { error: updateError } = await adminClient
      .from('accounts')
      .update(updatePayload)
      .eq('id', existingAccount.id);

    if (updateError) {
      return NextResponse.json(
        { error: sanitizeErrorMessage(updateError, 'Unable to update user account.') },
        { status: 500 }
      );
    }

    await adminClient.from('audit_logs').insert({
      actor_id: profile.id,
      action: 'USER_ROLE_PROMOTED',
      target_type: 'account',
      target_id: existingAccount.id,
      metadata: { new_role: role, email: cleanEmail },
    });

    return NextResponse.json({
      message: 'User account & role updated successfully',
      userId: existingAccount.id,
    });
  }

  // Create new user directly in unified public.accounts table
  const newUserId = crypto.randomUUID();

  const { error: accountError } = await adminClient.from('accounts').insert({
    id: newUserId,
    email: cleanEmail,
    password_hash: passwordHash,
    display_name: displayName,
    role,
    account_status: 'active',
    provider: 'email',
  });

  if (accountError) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(accountError, 'Unable to provision user account.') },
      { status: 500 }
    );
  }

  await adminClient.from('audit_logs').insert({
    actor_id: profile.id,
    action: 'USER_PROVISIONED',
    target_type: 'account',
    target_id: newUserId,
    metadata: { role, email: cleanEmail, display_name: displayName },
  });

  return NextResponse.json({
    message: password
      ? `Account provisioned for ${cleanEmail} with the specified password.`
      : `Account provisioned for ${cleanEmail}. Temporary password: ${initialPassword}`,
    userId: newUserId,
    temporaryPassword: password ? undefined : initialPassword,
  });
}

// PATCH /api/admin/users - Modify role or account status (Super Admin only)
export async function PATCH(request: NextRequest) {
  const { errorResponse, profile } = await requireApiRole(['super_admin']);
  if (errorResponse) return errorResponse;

  const json = await request.json();
  const parsed = updateRoleSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { userId, role, accountStatus } = parsed.data;

  // Protect against accidental self-lockout
  if (userId === profile.id) {
    if (role !== 'super_admin' || accountStatus === 'suspended') {
      return NextResponse.json(
        {
          error:
            'Forbidden: Super Admins cannot demote or suspend their own account to prevent lockout',
        },
        { status: 400 }
      );
    }
  }

  const adminClient = await createAdminClient();

  const { data: targetAccount } = await adminClient
    .from('accounts')
    .select('id, email, display_name, role, account_status')
    .eq('id', userId)
    .single();

  if (!targetAccount) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const updates: import('@/types/database').Database['public']['Tables']['accounts']['Update'] = {
    role,
    updated_at: new Date().toISOString(),
  };

  if (accountStatus) {
    updates.account_status = accountStatus;
  }

  const { error: updateError } = await adminClient
    .from('accounts')
    .update(updates)
    .eq('id', userId);

  if (updateError) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(updateError, 'Unable to update user status.') },
      { status: 500 }
    );
  }

  const isSuspension = accountStatus === 'suspended' && targetAccount.account_status !== 'suspended';
  const isReactivation = accountStatus === 'active' && targetAccount.account_status === 'suspended';
  const isRoleChange = role !== targetAccount.role;

  if (isSuspension) {
    // Revoke database sessions immediately
    await adminClient.from('sessions').delete().eq('account_id', userId);

    await adminClient.from('audit_logs').insert({
      actor_id: profile.id,
      action: 'USER_ACCOUNT_SUSPENDED',
      target_type: 'account',
      target_id: userId,
      metadata: {
        email: targetAccount.email,
        display_name: targetAccount.display_name,
        previous_status: targetAccount.account_status,
      },
    });
  } else if (isReactivation) {
    await adminClient.from('audit_logs').insert({
      actor_id: profile.id,
      action: 'USER_ACCOUNT_REACTIVATED',
      target_type: 'account',
      target_id: userId,
      metadata: {
        email: targetAccount.email,
        display_name: targetAccount.display_name,
      },
    });
  }

  if (isRoleChange) {
    await adminClient.from('audit_logs').insert({
      actor_id: profile.id,
      action: role === 'super_admin' ? 'USER_ROLE_PROMOTED' : 'USER_ROLE_DEMOTED',
      target_type: 'account',
      target_id: userId,
      metadata: {
        email: targetAccount.email,
        previous_role: targetAccount.role,
        new_role: role,
      },
    });
  }

  return NextResponse.json({
    message: isSuspension
      ? 'Staff account suspended and active sessions revoked'
      : isReactivation
      ? 'Staff account reactivated successfully'
      : 'User updated successfully',
  });
}
