import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
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
    const requestedCategory = formData.get('category') as string | null;
    const conversationId = formData.get('conversation_id') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    // Verify conversation access if conversationId is supplied (IDOR protection)
    if (conversationId) {
      const { data: conv, error: convErr } = await adminClient
        .from('conversations')
        .select('id, customer_id')
        .eq('id', conversationId)
        .single();

      if (convErr || !conv) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }

      const isStaff = profile.role === 'admin' || profile.role === 'super_admin';
      const isOwner = conv.customer_id === profile.id;

      if (!isOwner && !isStaff) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    let category = 'docs';
    if (requestedCategory && ['images', 'videos', 'voice', 'docs'].includes(requestedCategory)) {
      category = requestedCategory;
    } else if (file.type.startsWith('image/')) {
      category = 'images';
    } else if (file.type.startsWith('video/')) {
      category = 'videos';
    } else if (file.type.startsWith('audio/')) {
      category = 'voice';
    }

    const cleanEmail = sanitizeStorageSegment(profile.email || profile.id);
    const uploaded = await uploadFileToSupabaseStorage({
      file,
      folder: `chats/${cleanEmail}/${category}`,
      bucket: 'public-media',
      maxSizeBytes: MAX_UPLOAD_SIZE,
    });

    let attachment = null;
    if (conversationId) {
      const normalizedFileType = uploaded.mimeType.startsWith('image/')
        ? 'image'
        : uploaded.mimeType.startsWith('video/')
        ? 'video'
        : uploaded.mimeType.startsWith('audio/')
        ? 'audio'
        : 'file';

      const { data: att } = await adminClient
        .from('attachments')
        .insert({
          conversation_id: conversationId,
          file_name: file.name.slice(0, 200),
          file_url: uploaded.publicUrl,
          file_type: normalizedFileType,
          file_size: uploaded.sizeBytes > 0 ? uploaded.sizeBytes : null,
        })
        .select()
        .maybeSingle();
      attachment = att;
    }

    return NextResponse.json({
      success: true,
      url: uploaded.publicUrl,
      storagePath: uploaded.storagePath,
      originalName: file.name,
      category,
      mimeType: uploaded.mimeType,
      sizeBytes: uploaded.sizeBytes,
      attachment,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to upload chat file';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
