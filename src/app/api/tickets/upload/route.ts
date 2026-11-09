import { NextResponse, type NextRequest } from 'next/server';
import { requireApiAuth } from '@/lib/auth/api-auth';
import {
  uploadFileToSupabaseStorage,
  sanitizeStorageSegment,
} from '@/lib/supabase/storage';

const MAX_UPLOAD_SIZE = 25 * 1024 * 1024; // 25 MB

export async function POST(request: NextRequest) {
  const { errorResponse, profile } = await requireApiAuth();
  if (errorResponse) return errorResponse;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const cleanEmail = sanitizeStorageSegment(profile.email || profile.id);
    const uploaded = await uploadFileToSupabaseStorage({
      file,
      folder: `tickets/${cleanEmail}`,
      bucket: 'public-media',
      maxSizeBytes: MAX_UPLOAD_SIZE,
    });

    return NextResponse.json({
      success: true,
      url: uploaded.publicUrl,
      name: file.name.slice(0, 200),
      size: uploaded.sizeBytes,
      type: uploaded.fileType === 'audio' ? 'doc' : uploaded.fileType,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to upload ticket attachment';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
