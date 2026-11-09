import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { getEmailAdapter } from '@/lib/email/adapter';

export async function GET() {
  const { errorResponse } = await requireApiRole(['admin', 'super_admin']);
  if (errorResponse) return errorResponse;

  const emailAdapter = getEmailAdapter();

  return NextResponse.json({
    isConfigured: emailAdapter.isConfigured,
    provider: emailAdapter.name,
    fromAddress: process.env.EMAIL_FROM_ADDRESS || 'support@sandygamings.com',
    fromName: process.env.EMAIL_FROM_NAME || "Sandy's Gaming Support",
  });
}
