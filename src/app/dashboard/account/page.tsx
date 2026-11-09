import { redirect } from 'next/navigation';

export default function DashboardAccountPageRedirect() {
  redirect('/dashboard/settings');
}
