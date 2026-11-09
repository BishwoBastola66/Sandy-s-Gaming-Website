import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth/session';

export async function POST() {
  try {
    await destroySession();
  } catch {
    // Non-fatal
  }

  const response = NextResponse.json({ success: true, message: 'Signed out successfully.' });
  response.cookies.delete('sandy_session');
  return response;
}
