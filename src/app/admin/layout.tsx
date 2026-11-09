import { requireRole } from '@/lib/auth';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole(['admin'], '/admin');

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[var(--background)] flex flex-col lg:flex-row w-full overflow-x-hidden">
      <AdminSidebar
        user={{
          displayName: profile.display_name,
          email: profile.email || '',
          role: profile.role,
        }}
      />

      <main className="flex-1 min-w-0 min-h-0 w-full flex flex-col">
        {children}
      </main>
    </div>
  );
}
