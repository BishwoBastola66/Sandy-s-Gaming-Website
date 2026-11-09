import { NextResponse } from 'next/server';
import { getActivePlatforms } from '@/lib/platforms/store';

export async function GET() {
  try {
    const platforms = await getActivePlatforms();
    return NextResponse.json({ platforms });
  } catch {
    return NextResponse.json({ platforms: [] }, { status: 500 });
  }
}
