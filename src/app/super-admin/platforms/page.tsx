import { requireRole } from '@/lib/auth';
import { getAllPlatformsForAdmin } from '@/lib/platforms/store';
import { AdminPlatformsClient } from '@/app/admin/platforms/AdminPlatformsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SuperAdminPlatformsPage() {
  await requireRole(['super_admin'], '/super-admin/platforms');
  const platforms = await getAllPlatformsForAdmin();

  return <AdminPlatformsClient initialPlatforms={platforms} />;
}
