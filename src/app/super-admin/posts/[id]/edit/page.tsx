import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { PostEditor, PostData } from '@/components/admin/PostEditor';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Edit Post | Super Admin CMS',
  description: 'Update content, replace media, or adjust post visibility.',
};

interface EditPostPageProps {
  params: Promise<{ id: string }>;
}

export default async function SuperAdminEditPostPage({ params }: EditPostPageProps) {
  await requireRole(['super_admin'], '/super-admin/posts');
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
        const url = m.storage_path.startsWith('http://') || m.storage_path.startsWith('https://') || m.storage_path.startsWith('/')
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
    <div className="w-full px-1 sm:px-3 py-2 sm:py-3 animate-page-enter">
      <PostEditor isEditMode={true} initialData={initialData} />
    </div>
  );
}
