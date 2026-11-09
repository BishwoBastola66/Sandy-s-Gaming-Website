import { requireRole } from '@/lib/auth';
import { getAllPlatformsForAdmin } from '@/lib/platforms/store';
import { AdminPlatformsClient } from './AdminPlatformsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminPlatformsPage() {
  await requireRole(['admin'], '/admin/platforms');
  const platforms = await getAllPlatformsForAdmin();

  return <AdminPlatformsClient initialPlatforms={platforms} />;
}
