import { requireRole } from '@/lib/auth';
import { getAllCategories } from '@/lib/categories/store';
import { getPlatformCategories } from '@/lib/platforms/store';
import { AdminCategoriesClient } from '@/app/admin/categories/AdminCategoriesClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SuperAdminCategoriesPage() {
  await requireRole(['super_admin'], '/super-admin/categories');

  const [contentCategories, platformCategories] = await Promise.all([
    getAllCategories(),
    getPlatformCategories(),
  ]);

  return (
    <AdminCategoriesClient
      initialContentCategories={contentCategories}
      initialPlatformCategories={platformCategories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description || null,
        display_order: c.display_order,
      }))}
    />
  );
}
