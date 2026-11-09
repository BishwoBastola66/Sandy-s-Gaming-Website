import { requireRole } from '@/lib/auth';
import { PostEditor } from '@/components/admin/PostEditor';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create New Post | Super Admin CMS',
  description: 'Author and publish new blog posts, posters, and photography.',
};

export default async function SuperAdminNewPostPage() {
  await requireRole(['super_admin'], '/super-admin/posts/new');

  return (
    <div className="w-full px-1 sm:px-3 py-2 sm:py-3 animate-page-enter">
      <PostEditor isEditMode={false} />
    </div>
  );
}
