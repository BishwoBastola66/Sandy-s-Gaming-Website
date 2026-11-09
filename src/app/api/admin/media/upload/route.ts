import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import {
  uploadFileToSupabaseStorage,
  SAFE_IMAGE_MIME_TO_EXT,
} from '@/lib/supabase/storage';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(request: NextRequest) {
  const { errorResponse, profile } = await requireApiRole(['admin', 'super_admin']);
  if (errorResponse) return errorResponse;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const isDraft = formData.get('isDraft') === 'true';
    const folder = (formData.get('folder') as string | null) || 'cms';

    if (!file) {
      return NextResponse.json({ error: 'No file provided in request' }, { status: 400 });
    }

    const bucket = isDraft ? 'draft-media' : 'public-media';

    const uploaded = await uploadFileToSupabaseStorage({
      file,
      folder,
      bucket,
      maxSizeBytes: MAX_FILE_SIZE_BYTES,
      allowedMimeMap: SAFE_IMAGE_MIME_TO_EXT,
    });

    try {
      const adminClient = await createAdminClient();
      await adminClient.from('audit_logs').insert({
        actor_id: profile.id,
        action: 'MEDIA_ASSET_UPLOADED',
        target_type: 'storage',
        metadata: {
          bucket,
          storagePath: uploaded.storagePath,
          mimeType: uploaded.mimeType,
          sizeBytes: uploaded.sizeBytes,
          isDraft,
        },
      });
    } catch {
      // Non-blocking audit log
    }

    return NextResponse.json({
      success: true,
      bucket,
      storagePath: uploaded.storagePath,
      url: uploaded.publicUrl,
      mediaType: uploaded.mimeType,
      sizeBytes: uploaded.sizeBytes,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upload processing error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
