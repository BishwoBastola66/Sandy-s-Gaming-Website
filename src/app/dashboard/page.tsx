import { requireAuth, getCurrentProfile } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { HomeFeedClient, type FeedPostItem, type CategoryItem } from './HomeFeedClient';

export default async function DashboardHomePage() {
  const user = await requireAuth('/login?redirect=/dashboard');
  const profile = await getCurrentProfile();

  // Verify role: If staff or super_admin enters dashboard, immediately route them to their console
  if (profile?.role === 'super_admin') {
    redirect('/super-admin');
  }
  if (profile?.role === 'admin') {
    redirect('/admin');
  }
  const supabase = await createAdminClient();

  // 1. Fetch categories and published posts in parallel from Supabase
  const [{ data: categoriesData }, { data: postsData }] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name, slug, description, display_order')
      .order('display_order', { ascending: true }),
    supabase
      .from('posts')
      .select('id, title, slug, excerpt, post_type, cover_image, published_at')
      .eq('status', 'published')
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false })
      .limit(40),
  ]);

  // Fallback category definitions if the table hasn't been migrated yet
  const categories: CategoryItem[] =
    categoriesData && categoriesData.length > 0
      ? (categoriesData as CategoryItem[])
      : [
          { id: 'cat-1', name: 'Esports Blogs', slug: 'blog', display_order: 1 },
          { id: 'cat-2', name: 'Posters', slug: 'poster', display_order: 2 },
          { id: 'cat-3', name: 'Wallpapers', slug: 'photo', display_order: 3 },
        ];

  // Strictly real posts from database - zero mockdata
  const feedPosts = (postsData as FeedPostItem[]) || [];

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-start py-4 px-2 sm:px-4 animate-page-enter">
      <HomeFeedClient
        initialPosts={feedPosts}
        categories={categories}
        userDisplayName={profile?.display_name || user.email?.split('@')[0] || 'Customer'}
        userEmail={profile?.email || user.email || ''}
      />
    </div>
  );
}
