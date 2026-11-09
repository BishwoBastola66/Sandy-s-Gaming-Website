import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import Link from 'next/link';
import Image from 'next/image';
import { FileText, Plus, Edit, ExternalLink, Calendar, Layers } from 'lucide-react';
import { FloatingActionButton } from '@/components/admin/FloatingActionButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminPostsPage() {
  await requireRole(['admin'], '/admin/posts');
  const supabase = await createAdminClient();

  const { data: posts } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false });

  const hasPosts = posts && posts.length > 0;

  return (
    <div className="w-full flex-1 flex flex-col px-4 sm:px-6 lg:px-8 py-5 space-y-5 animate-page-enter min-h-[calc(100vh-4rem)]">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
        <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2.5">
          <FileText className="h-5 w-5 text-[#e8364b]" />
          <span>Content Management (CMS)</span>
        </h1>
      </div>

      {!hasPosts ? (
        <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.08] text-[#e8364b]">
            <FileText className="h-5 w-5" />
          </div>
          <h3 className="mt-3.5 text-sm font-semibold text-white">No articles created yet</h3>
          <p className="mt-1 max-w-sm text-xs text-neutral-400 leading-relaxed">
            Your CMS library is currently empty. Click Create New Post above to start authoring blogs, posters, or photos.
          </p>
          <div className="mt-4">
            <Link
              href="/admin/posts/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#e8364b] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#d12a3e] transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Create First Post</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="w-full overflow-x-auto border-b border-white/[0.08]">
          <table className="w-full divide-y divide-white/[0.06] text-left text-xs">
            <thead className="border-b border-white/[0.08] text-neutral-400 bg-white/[0.02]">
              <tr>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[11px]">Post</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[11px]">Type</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[11px]">Status</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[11px]">Date</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider text-[11px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {posts.map((post) => {
                const publicUrl = post.post_type === 'blog' ? `/blog/${post.slug}` : `/posts/${post.slug}`;

                return (
                  <tr key={post.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 font-medium text-white">
                      <div className="flex items-center gap-3">
                        {post.cover_image && (
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-[#171719] border border-white/[0.08]">
                            <Image
                              src={post.cover_image}
                              alt=""
                              fill
                              sizes="40px"
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        )}
                        <div>
                          <div className="font-semibold line-clamp-1 text-white">{post.title}</div>
                          <div className="font-mono text-[11px] text-neutral-500">/{post.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 text-[11px] font-semibold text-neutral-300 uppercase">
                        <Layers className="h-3 w-3 text-[#e8364b]" />
                        <span>{post.post_type}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize border ${
                          post.status === 'published'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                            : post.status === 'draft'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                            : 'bg-white/[0.06] text-neutral-400 border-white/[0.08]'
                        }`}
                      >
                        {post.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-400">
                      <div className="flex items-center gap-1 text-[11px]">
                        <Calendar className="h-3 w-3 text-neutral-500" />
                        <span>
                          {post.published_at
                            ? new Date(post.published_at).toLocaleDateString()
                            : new Date(post.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        {post.status === 'published' && (
                          <Link
                            href={publicUrl}
                            target="_blank"
                            className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-neutral-300 hover:text-white hover:bg-white/[0.07] transition-colors"
                            title="View Public Post"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>Preview</span>
                          </Link>
                        )}
                        <Link
                          href={`/admin/posts/${post.id}/edit`}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#e8364b] px-3 py-1 text-xs font-semibold text-white hover:bg-[#d12a3e] transition-colors"
                        >
                          <Edit className="h-3 w-3" />
                          <span>Edit</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Sticky Footer New Post (+) Button portaled to document.body */}
      <FloatingActionButton href="/admin/posts/new" label="New Post" />
    </div>
  );
}
