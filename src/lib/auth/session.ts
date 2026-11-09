import crypto from 'crypto';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';

export interface Account {
  id: string;
  email: string;
  display_name: string;
  phone?: string | null;
  role: 'customer' | 'admin' | 'super_admin';
  account_status: 'active' | 'suspended' | 'pending';
  provider?: string | null;
  provider_id?: string | null;
  created_at: string;
  updated_at: string;
}

export const SESSION_COOKIE_NAME = 'sandy_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * Hash password using NIST-recommended PBKDF2 with SHA-512 and unique salt.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Constant-time verification of password against stored PBKDF2 hash.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) {
    return false;
  }
  const [salt, originalHash] = storedHash.split(':');
  if (!salt || !originalHash) {
    return false;
  }
  const checkHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(originalHash, 'hex'), Buffer.from(checkHash, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Create a new cryptographically secure session in the database 'sessions' table and set cookie.
 */
export async function createSession(
  accountId: string,
  metadata?: { ip?: string; userAgent?: string }
): Promise<string> {
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();

  const adminClient = await createAdminClient();
  const { error } = await adminClient.from('sessions').insert({
    account_id: accountId,
    session_token: sessionToken,
    ip_address: metadata?.ip || null,
    user_agent: metadata?.userAgent || null,
    expires_at: expiresAt,
  });

  if (error) {
    console.error('Failed to create session in database:', error);
    throw new Error('Database session creation failed');
  }

  // Set HTTP-only secure cookie
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return sessionToken;
}

/**
 * Retrieve current active account from database 'sessions' table using session cookie.
 */
export async function getAccountFromSession(): Promise<Account | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) {
      return null;
    }

    const adminClient = await createAdminClient();
    
    // Query active session and join unified account
    const { data: session, error } = await adminClient
      .from('sessions')
      .select(
        'id, expires_at, account_id, accounts (id, email, display_name, phone, role, account_status, provider, provider_id, created_at, updated_at)'
      )
      .eq('session_token', token)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !session || !session.accounts) {
      return null;
    }

    const rawAccount = Array.isArray(session.accounts) ? session.accounts[0] : session.accounts;
    const account = rawAccount as unknown as Account;
    if (!account || account.account_status === 'suspended') {
      return null;
    }

    return account;
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'digest' in err && (err as { digest?: string }).digest === 'DYNAMIC_SERVER_USAGE') {
      throw err;
    }
    console.error('Error validating session:', err);
    return null;
  }
}

/**
 * Destroy current session from database and clear cookie.
 */
export async function destroySession(): Promise<void> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (token) {
      const adminClient = await createAdminClient();
      await adminClient.from('sessions').delete().eq('session_token', token);
    }
    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'digest' in err && (err as { digest?: string }).digest === 'DYNAMIC_SERVER_USAGE') {
      throw err;
    }
    console.error('Error destroying session:', err);
  }
}
