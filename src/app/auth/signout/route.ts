import { destroySession } from '@/lib/auth/session';
import { NextResponse, type NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    await destroySession();
  } catch {
    // Non-fatal
  }

  const response = NextResponse.redirect(new URL('/', request.url), { status: 302 });
  response.cookies.delete('sandy_session');
  return response;
}

export async function GET(request: NextRequest) {
  try {
    await destroySession();
  } catch {
    // Non-fatal
  }

  const response = NextResponse.redirect(new URL('/', request.url), { status: 302 });
  response.cookies.delete('sandy_session');
  return response;
}
