import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireApiRole } from '@/lib/auth/api-auth';
import { sanitizeErrorMessage } from '@/lib/validation/error-sanitizer';
import { z } from 'zod';

const createPostSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200),
  slug: z.string().trim().min(3).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  post_type: z.enum(['blog', 'poster', 'photo']),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
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

// GET /api/admin/posts - List all posts for staff CMS view
export async function GET() {
  const { errorResponse } = await requireApiRole(['admin', 'super_admin']);
  if (errorResponse) return errorResponse;

  const adminClient = await createAdminClient();
  const { data: posts, error } = await adminClient
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error, 'Unable to load posts right now.') },
      { status: 500 }
    );
  }

  return NextResponse.json({ posts: posts || [] });
}

// POST /api/admin/posts - Create a new post
export async function POST(request: NextRequest) {
  const { errorResponse, profile } = await requireApiRole(['admin', 'super_admin']);
  if (errorResponse) return errorResponse;

  try {
    const json = await request.json();
    const parsed = createPostSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { title, slug, post_type, status, excerpt, body, cover_image, media } = parsed.data;
    const adminClient = await createAdminClient();

    // Check if slug already taken
    const { data: existingSlug } = await adminClient
      .from('posts')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (existingSlug) {
      return NextResponse.json({ error: `The slug "${slug}" is already in use. Please choose another.` }, { status: 400 });
    }

    const published_at = status === 'published' ? new Date().toISOString() : null;

    const { data: newPost, error: insertError } = await adminClient
      .from('posts')
      .insert({
        author_id: profile.id,
        title,
        slug,
        post_type,
        status,
        excerpt: excerpt || null,
        body: body || null,
        cover_image: cover_image || null,
        published_at,
      })
      .select()
      .single();

    if (insertError || !newPost) {
      return NextResponse.json(
        { error: sanitizeErrorMessage(insertError, 'Failed to create post. Please try again.') },
        { status: 500 }
      );
    }

    // Insert attached normalized media if provided
    if (media && media.length > 0) {
      const mediaRecords = media.map((m, idx) => ({
        post_id: newPost.id,
        storage_path: m.storage_path,
        media_type: m.media_type,
        alt_text: m.alt_text || title,
        sort_order: m.sort_order ?? idx,
      }));

      await adminClient.from('post_media').insert(mediaRecords);
    }

    // Record audit event
    await adminClient.from('audit_logs').insert({
      actor_id: profile.id,
      action: 'POST_CREATED',
      target_type: 'post',
      target_id: newPost.id,
      metadata: { title, slug, post_type, status },
    });

    return NextResponse.json({ success: true, post: newPost });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(err, 'Unable to create post right now.') },
      { status: 500 }
    );
  }
}
