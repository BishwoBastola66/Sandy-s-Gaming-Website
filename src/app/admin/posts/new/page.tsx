import { requireRole } from '@/lib/auth';
import { PostEditor } from '@/components/admin/PostEditor';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create New Post | Admin CMS',
  description: 'Author and publish new blog posts, posters, and photography.',
};

export default async function NewPostPage() {
  await requireRole(['admin'], '/admin/posts/new');

  return (
    <div className="w-full px-3 sm:px-6 lg:px-8 py-3 sm:py-4 animate-page-enter">
      <PostEditor isEditMode={false} />
    </div>
  );
}
