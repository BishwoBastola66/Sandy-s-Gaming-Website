import { requireAuth, getCurrentProfile } from '@/lib/auth';
import { CustomerSidebar } from '@/components/customer/CustomerSidebar';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth('/login?redirect=/dashboard');
  const profile = await getCurrentProfile();

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[var(--background)] flex flex-col lg:flex-row w-full">
      <CustomerSidebar
        user={{
          displayName: profile?.display_name || user.email?.split('@')[0],
          email: profile?.email || user.email,
          role: profile?.role || 'customer',
        }}
      />

      <main className="flex-1 min-w-0 w-full flex flex-col">
        {children}
      </main>
    </div>
  );
}
