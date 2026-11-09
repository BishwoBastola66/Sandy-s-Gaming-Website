import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { sanitizeErrorMessage } from '@/lib/validation/error-sanitizer';
import { z } from 'zod';

const updatePostSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  slug: z.string().trim().min(3).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  post_type: z.enum(['blog', 'poster', 'photo']).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  excerpt: z.string().trim().max(500).optional().nullable(),
  body: z.string().optional().nullable(),
  cover_image: z.string().trim().optional().nullable(),
  media: z
    .array(
      z.object({
        storage_path: z.string(),
        media_type: z.string(),
        alt_text: z.string().optional().nullable(),
        sort_order: z.number().int().default(0),
      })
    )
    .optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper to extract storage path from full URL
function extractStoragePath(url: string | null): { bucket: string; path: string } | null {
  if (!url) return null;
  const match = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
  if (match) {
    return { bucket: match[1], path: decodeURIComponent(match[2].split('?')[0]) };
  }
  return null;
}

// GET /api/admin/posts/[id] - Retrieve single post with media for editing
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const { errorResponse } = await requireApiRole(['admin', 'super_admin']);
  if (errorResponse) return errorResponse;

  const adminClient = await createAdminClient();
  const { data: post, error } = await adminClient
    .from('posts')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  const { data: media } = await adminClient
    .from('post_media')
    .select('*')
    .eq('post_id', id)
    .order('sort_order', { ascending: true });

  return NextResponse.json({ post, media: media || [] });
}

// PATCH /api/admin/posts/[id] - Update post content, status, and media
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const { errorResponse, profile } = await requireApiRole(['admin', 'super_admin']);
  if (errorResponse) return errorResponse;

  const adminClient = await createAdminClient();

  const { data: existingPost } = await adminClient
    .from('posts')
    .select('*')
    .eq('id', id)
    .single();

  if (!existingPost) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  if (profile.role === 'admin' && existingPost.author_id !== profile.id) {
    return NextResponse.json({ error: 'Forbidden: You can only edit posts you authored' }, { status: 403 });
  }

  const json = await request.json();
  const parsed = updatePostSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { media, ...postFields } = parsed.data;

  const updates: import('@/types/database').Database['public']['Tables']['posts']['Update'] = {
    ...postFields,
    updated_at: new Date().toISOString(),
  };

  if (updates.status === 'published' && !existingPost.published_at) {
    updates.published_at = new Date().toISOString();
  }

  if (
    updates.cover_image !== undefined &&
    existingPost.cover_image &&
    updates.cover_image !== existingPost.cover_image
  ) {
    const oldStorage = extractStoragePath(existingPost.cover_image);
    if (oldStorage) {
      await adminClient.storage.from(oldStorage.bucket).remove([oldStorage.path]);
    }
  }

  const { data: updatedPost, error: updateError } = await adminClient
    .from('posts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(updateError, 'Unable to update post. Please try again.') },
      { status: 500 }
    );
  }

  // Sync post_media rows if media array was provided
  if (media !== undefined) {
    await adminClient.from('post_media').delete().eq('post_id', id);
    if (media.length > 0) {
      const mediaRecords = media.map((m, idx) => ({
        post_id: id,
        storage_path: m.storage_path,
        media_type: m.media_type,
        alt_text: m.alt_text || updatedPost.title,
        sort_order: m.sort_order ?? idx,
      }));
      await adminClient.from('post_media').insert(mediaRecords);
    }
  }

  await adminClient.from('audit_logs').insert({
    actor_id: profile.id,
    action: 'POST_UPDATED',
    target_type: 'post',
    target_id: id,
    metadata: { updates: postFields, mediaCount: media?.length },
  });

  return NextResponse.json({ success: true, post: updatedPost });
}

// DELETE /api/admin/posts/[id] - Delete post and clean up associated storage assets
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const { errorResponse, profile } = await requireApiRole(['admin', 'super_admin']);
  if (errorResponse) return errorResponse;

  const adminClient = await createAdminClient();

  const { data: existingPost } = await adminClient
    .from('posts')
    .select('*')
    .eq('id', id)
    .single();

  if (!existingPost) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  if (profile.role === 'admin' && existingPost.author_id !== profile.id) {
    return NextResponse.json({ error: 'Forbidden: You can only delete posts you authored' }, { status: 403 });
  }

  const filesToPurge: { bucket: string; path: string }[] = [];

  const coverStorage = extractStoragePath(existingPost.cover_image);
  if (coverStorage) filesToPurge.push(coverStorage);

  const { data: mediaItems } = await adminClient
    .from('post_media')
    .select('storage_path')
    .eq('post_id', id);

  if (mediaItems) {
    for (const item of mediaItems) {
      const parsed = extractStoragePath(item.storage_path);
      if (parsed) filesToPurge.push(parsed);
      else if (item.storage_path.includes('/')) {
        filesToPurge.push({ bucket: 'public-media', path: item.storage_path });
      }
    }
  }

  const { error: deleteError } = await adminClient
    .from('posts')
    .delete()
    .eq('id', id);

  if (deleteError) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(deleteError, 'Unable to delete post. Please try again.') },
      { status: 500 }
    );
  }

  for (const item of filesToPurge) {
    try {
      await adminClient.storage.from(item.bucket).remove([item.path]);
    } catch {
      // Storage cleanup is best-effort
    }
  }

  await adminClient.from('audit_logs').insert({
    actor_id: profile.id,
    action: 'POST_DELETED',
    target_type: 'post',
    target_id: id,
    metadata: { title: existingPost.title, slug: existingPost.slug, purgedFilesCount: filesToPurge.length },
  });

  return NextResponse.json({ success: true, message: 'Post and associated storage assets deleted' });
}
