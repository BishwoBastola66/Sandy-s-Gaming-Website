import { requireAuth, getCurrentProfile } from '@/lib/auth';
import { CustomerSidebar } from '@/components/customer/CustomerSidebar';

export default async function CustomerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth('/login?redirect=/dashboard');
  const profile = await getCurrentProfile();

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[var(--background)] flex flex-col lg:flex-row w-full overflow-x-hidden">
      <CustomerSidebar
        user={{
          displayName: profile?.display_name || user.email?.split('@')[0],
          email: profile?.email || user.email,
          role: profile?.role || 'customer',
        }}
      />

      <main className="flex-1 min-w-0 min-h-0 w-full flex flex-col">
        {children}
      </main>
    </div>
  );
}
