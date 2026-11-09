import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { PostEditor, PostData } from '@/components/admin/PostEditor';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Edit Post | Admin CMS',
  description: 'Update content, replace media, or adjust post visibility.',
};

interface EditPostPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPostPage({ params }: EditPostPageProps) {
  const profile = await requireRole(['admin'], '/admin/posts');
  const { id } = await params;

  const adminClient = await createAdminClient();

  const { data: post, error } = await adminClient
    .from('posts')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !post) {
    notFound();
  }

  // Admin role can only edit their own posts; Super Admin can edit all posts
  if (profile.role === 'admin' && post.author_id !== profile.id) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-6 text-center text-red-300">
        <h2 className="text-base font-semibold">Permission Denied</h2>
        <p className="mt-1 text-xs">You can only edit posts that you authored. Contact Super Admin for assistance.</p>
      </div>
    );
  }

  const { data: media } = await adminClient
    .from('post_media')
    .select('*')
    .eq('post_id', id)
    .order('sort_order', { ascending: true });

  const initialData: PostData = {
    id: post.id,
    title: post.title,
    slug: post.slug,
    post_type: post.post_type,
    status: post.status,
    excerpt: post.excerpt || '',
    body: post.body || '',
    cover_image: post.cover_image,
    media:
      media?.map((m) => {
        const url = m.storage_path.startsWith('http://') || m.storage_path.startsWith('https://')
          ? m.storage_path
          : adminClient.storage.from('public-media').getPublicUrl(m.storage_path).data.publicUrl;
        return {
          storage_path: m.storage_path,
          media_type: m.media_type,
          alt_text: m.alt_text,
          sort_order: m.sort_order,
          url,
        };
      }) || [],
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-5 sm:py-6 animate-page-enter">
      <PostEditor isEditMode={true} initialData={initialData} />
    </div>
  );
}
