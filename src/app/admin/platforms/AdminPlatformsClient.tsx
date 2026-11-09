'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';

function emptySubscribe() {
  return () => {};
}

function useMounted() {
  return React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

import Image from 'next/image';
import {
  Gamepad2,
  Search,
  ExternalLink,
  Edit2,
  Check,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Globe,
  Smartphone,
  Monitor,
  Plus,
  FolderPlus,
} from 'lucide-react';
import { sanitizeErrorMessage } from '@/lib/validation/error-sanitizer';

export interface AdminPlatform {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  play_url: string;
  category: string;
  tags: string[];
  features: string[];
  platforms: string[];
  logo_url: string | null;
  badge: string | null;
  accent_color: string | null;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface AdminPlatformsClientProps {
  initialPlatforms: AdminPlatform[];
}

export function AdminPlatformsClient({ initialPlatforms }: AdminPlatformsClientProps) {
  const [platforms, setPlatforms] = useState<AdminPlatform[]>(initialPlatforms);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const mounted = useMounted();
  const [editingPlatform, setEditingPlatform] = useState<AdminPlatform | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Create Game state
  const [createGameModalOpen, setCreateGameModalOpen] = useState(false);
  const [creatingGame, setCreatingGame] = useState(false);
  const [newGame, setNewGame] = useState({
    name: '',
    slug: '',
    tagline: '',
    description: '',
    play_url: '',
    category: 'all-in-one',
    badge: '',
    accent_color: '#e8364b',
    logo_url: '',
    features: 'Multiplayer Rooms, Instant Reloads, Smooth Engine',
    platforms: ['android', 'ios', 'web'],
    display_order: 0,
    is_active: true,
  });

  // Create Category state
  const [createCategoryModalOpen, setCreateCategoryModalOpen] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState({
    name: '',
    slug: '',
    description: '',
    display_order: 10,
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleNewGameNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    setNewGame((prev) => ({
      ...prev,
      name,
      slug: prev.slug === '' || prev.slug === prev.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') ? slug : prev.slug,
    }));
  };

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGame.name.trim() || !newGame.slug.trim() || !newGame.play_url.trim()) {
      showToast('Name, slug, and Play URL are required.', 'error');
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(newGame.slug.trim())) {
      showToast('Slug must use lowercase letters, numbers, and hyphens only.', 'error');
      return;
    }
    if (!/^https?:\/\/.+/i.test(newGame.play_url.trim())) {
      showToast('Play URL must start with http:// or https://.', 'error');
      return;
    }

    setCreatingGame(true);
    try {
      const res = await fetch('/api/admin/platforms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGame.name.trim(),
          slug: newGame.slug.trim(),
          tagline: newGame.tagline.trim() || `${newGame.name.trim()} Online Casino & Arcade Suite`,
          description: newGame.description.trim() || `${newGame.name.trim()} sweepstakes platform with interactive arcade tables and slots.`,
          play_url: newGame.play_url.trim(),
          category: newGame.category,
          tags: [newGame.category],
          features: newGame.features
            .split(',')
            .map((f) => f.trim())
            .filter(Boolean),
          platforms: newGame.platforms,
          logo_url: newGame.logo_url.trim() || null,
          badge: newGame.badge.trim() || null,
          accent_color: newGame.accent_color || '#e8364b',
          display_order: Number(newGame.display_order) || platforms.length + 1,
          is_active: newGame.is_active,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create game platform');
      }

      if (data.platform) {
        setPlatforms((prev) => [data.platform, ...prev]);
      }

      showToast(`Game "${newGame.name}" created successfully!`, 'success');
      setCreateGameModalOpen(false);
      setNewGame({
        name: '',
        slug: '',
        tagline: '',
        description: '',
        play_url: '',
        category: 'all-in-one',
        badge: '',
        accent_color: '#e8364b',
        logo_url: '',
        features: 'Multiplayer Rooms, Instant Reloads, Smooth Engine',
        platforms: ['android', 'ios', 'web'],
        display_order: 0,
        is_active: true,
      });
    } catch (err: unknown) {
      showToast(sanitizeErrorMessage(err, 'Failed to create game platform.'), 'error');
    } finally {
      setCreatingGame(false);
    }
  };

  const handleNewCategoryNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    setNewCategory((prev) => ({
      ...prev,
      name,
      slug: prev.slug === '' || prev.slug === prev.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') ? slug : prev.slug,
    }));
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.name.trim() || !newCategory.slug.trim()) {
      showToast('Category name and slug are required.', 'error');
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(newCategory.slug.trim())) {
      showToast('Slug must use lowercase letters, numbers, and hyphens only.', 'error');
      return;
    }

    setCreatingCategory(true);
    try {
      const res = await fetch('/api/platforms/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCategory.name.trim(),
          slug: newCategory.slug.trim(),
          description: newCategory.description.trim() || undefined,
          display_order: Number(newCategory.display_order) || 10,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create platform category');
      }

      showToast(`Category "${newCategory.name}" created successfully!`, 'success');
      setCreateCategoryModalOpen(false);
      setNewCategory({
        name: '',
        slug: '',
        description: '',
        display_order: 10,
      });
    } catch (err: unknown) {
      showToast(sanitizeErrorMessage(err, 'Failed to create category.'), 'error');
    } finally {
      setCreatingCategory(false);
    }
  };

  const filtered = platforms.filter((p) => {
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.tagline.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleEditClick = (platform: AdminPlatform) => {
    setEditingPlatform({ ...platform });
  };

  const handleSavePlatform = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlatform) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/platforms/${editingPlatform.id || editingPlatform.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingPlatform.name,
          tagline: editingPlatform.tagline,
          description: editingPlatform.description,
          play_url: editingPlatform.play_url,
          category: editingPlatform.category,
          tags: editingPlatform.tags,
          features: editingPlatform.features,
          platforms: editingPlatform.platforms,
          logo_url: editingPlatform.logo_url,
          badge: editingPlatform.badge || null,
          accent_color: editingPlatform.accent_color,
          display_order: Number(editingPlatform.display_order) || 0,
          is_active: Boolean(editingPlatform.is_active),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update platform');
      }

      const updated = data.platform || editingPlatform;
      setPlatforms((prev) =>
        prev.map((item) =>
          item.id === editingPlatform.id || item.slug === editingPlatform.slug
            ? { ...item, ...updated }
            : item
        )
      );

      showToast(`Updated ${editingPlatform.name} successfully!`, 'success');
      setEditingPlatform(null);
    } catch (err: unknown) {
      showToast(sanitizeErrorMessage(err, 'Update failed.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col px-4 sm:px-6 lg:px-8 py-5 space-y-6 animate-page-enter min-h-[calc(100vh-4rem)]">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold border ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-800/60'
              : 'bg-red-950/90 text-red-200 border-red-800/60'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
        <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2.5">
          <Gamepad2 className="h-5 w-5 text-[#e8364b]" />
          <span>Gaming Platforms Directory</span>
        </h1>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search platform name or tagline..."
            className="w-full rounded-xl border border-white/[0.08] bg-[#111116] pl-9 pr-4 py-2 text-xs text-white placeholder:text-neutral-500 focus:border-[#e8364b]/50 focus:outline-none transition-colors"
          />
        </div>

        {/* Switch Segmented Control (Like Settings) */}
        <div className="inline-flex p-1 rounded-xl bg-white/[0.04] border border-white/[0.08] overflow-x-auto scrollbar-none">
          {(
            [
              { key: 'all', label: 'All Platforms' },
              { key: 'fish', label: 'Fish & Arcade' },
              { key: 'slots', label: 'Slots & 777' },
              { key: 'all-in-one', label: 'All-In-One' },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setCategoryFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                categoryFilter === key
                  ? 'bg-[#e8364b] text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Platforms Table - Seamless Flat Layout (No Card Container) */}
      <div className="w-full overflow-x-auto border-b border-white/[0.08]">
        <table className="w-full text-left text-xs divide-y divide-white/[0.06]">
          <thead className="border-b border-white/[0.08] bg-white/[0.02] text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Portal URL</th>
                <th className="px-4 py-3">Badge</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05] text-neutral-300">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-neutral-500 text-xs">
                    No gaming platforms found. Use &quot;+ Add Platform&quot; to publish games.
                  </td>
                </tr>
              ) : (
                filtered.map((platform) => (
                  <tr key={platform.slug || platform.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div
                        className="relative h-9 w-9 shrink-0 rounded-lg overflow-hidden border bg-black/40 flex items-center justify-center"
                        style={{ borderColor: `${platform.accent_color || '#e8364b'}40` }}
                      >
                        {platform.logo_url ? (
                          <Image
                            src={platform.logo_url}
                            alt=""
                            width={36}
                            height={36}
                            unoptimized
                            className="h-full w-full object-contain p-0.5"
                          />
                        ) : (
                          <span className="font-bold text-xs" style={{ color: platform.accent_color || '#fff' }}>
                            {platform.name.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-white text-sm">{platform.name}</div>
                        <div className="text-[11px] text-neutral-500 truncate max-w-xs">{platform.tagline}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-white/[0.05] text-neutral-300 border border-white/[0.08]">
                      {platform.category}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5 max-w-xs">
                      <span className="truncate text-[11px] text-neutral-400 font-mono">
                        {platform.play_url}
                      </span>
                      <a
                        href={platform.play_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neutral-500 hover:text-white transition-colors shrink-0"
                        title="Test URL"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    {platform.badge ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#e8364b]/15 text-[#ff6b7d] border border-[#e8364b]/30">
                        {platform.badge}
                      </span>
                    ) : (
                      <span className="text-neutral-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    {platform.is_active ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        <span>Active</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-neutral-600" />
                        <span>Hidden</span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleEditClick(platform)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-[#e8364b] hover:text-white text-neutral-200 transition-colors font-semibold text-xs cursor-pointer"
                    >
                      <Edit2 className="h-3 w-3" />
                      <span>Edit</span>
                    </button>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
      </div>

      {/* Edit Platform Modal / Slide-over */}
      {editingPlatform && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl rounded-2xl border border-white/[0.1] bg-[#121217] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center border bg-black/40 shrink-0"
                  style={{ borderColor: `${editingPlatform.accent_color || '#e8364b'}50` }}
                >
                  {editingPlatform.logo_url ? (
                    <Image
                      src={editingPlatform.logo_url}
                      alt=""
                      width={32}
                      height={32}
                      unoptimized
                      className="h-full w-full object-contain p-1"
                    />
                  ) : (
                    <Gamepad2 className="h-5 w-5 text-[#e8364b]" />
                  )}
                </div>
                <div>
                  <h2 className="text-base font-bold text-white leading-tight">Edit {editingPlatform.name}</h2>
                  <p className="text-[11px] text-neutral-400 leading-tight mt-0.5">
                    Slug: <code className="font-mono text-neutral-300">{editingPlatform.slug}</code>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingPlatform(null)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSavePlatform} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {/* Name & Badge */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-semibold text-neutral-300">Platform Name *</label>
                  <input
                    type="text"
                    required
                    value={editingPlatform.name}
                    onChange={(e) => setEditingPlatform({ ...editingPlatform, name: e.target.value })}
                    className="w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 py-2 text-xs text-white focus:border-[#e8364b] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-neutral-300">Badge (Optional)</label>
                  <select
                    value={editingPlatform.badge || ''}
                    onChange={(e) => setEditingPlatform({ ...editingPlatform, badge: e.target.value || null })}
                    className="w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 py-2 text-xs text-white focus:border-[#e8364b] focus:outline-none"
                  >
                    <option value="">None</option>
                    <option value="Trending">Trending</option>
                    <option value="Popular">Popular</option>
                    <option value="Top Pick">Top Pick</option>
                    <option value="Hot">Hot</option>
                    <option value="New">New</option>
                  </select>
                </div>
              </div>

              {/* Tagline */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-neutral-300">Tagline *</label>
                <input
                  type="text"
                  required
                  value={editingPlatform.tagline}
                  onChange={(e) => setEditingPlatform({ ...editingPlatform, tagline: e.target.value })}
                  className="w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 py-2 text-xs text-white focus:border-[#e8364b] focus:outline-none"
                />
              </div>

              {/* Portal URL */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-neutral-300">Portal / Play / Download URL *</label>
                <input
                  type="url"
                  required
                  value={editingPlatform.play_url}
                  onChange={(e) => setEditingPlatform({ ...editingPlatform, play_url: e.target.value })}
                  className="w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 py-2 text-xs text-white font-mono focus:border-[#e8364b] focus:outline-none"
                />
              </div>

              {/* Category & Accent Color */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-neutral-300">Category *</label>
                  <select
                    value={editingPlatform.category}
                    onChange={(e) =>
                      setEditingPlatform({
                        ...editingPlatform,
                        category: e.target.value as 'fish' | 'slots' | 'all-in-one',
                      })
                    }
                    className="w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 py-2 text-xs text-white focus:border-[#e8364b] focus:outline-none"
                  >
                    <option value="all-in-one">All-In-One Suite</option>
                    <option value="fish">Fish &amp; Arcade Shooter</option>
                    <option value="slots">Classic 777 &amp; Slots</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-neutral-300">Accent Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editingPlatform.accent_color || '#e8364b'}
                      onChange={(e) => setEditingPlatform({ ...editingPlatform, accent_color: e.target.value })}
                      className="h-8 w-12 rounded cursor-pointer border border-white/[0.1] bg-transparent"
                    />
                    <input
                      type="text"
                      value={editingPlatform.accent_color || ''}
                      onChange={(e) => setEditingPlatform({ ...editingPlatform, accent_color: e.target.value })}
                      placeholder="#e8364b"
                      className="flex-1 rounded-xl border border-white/[0.1] bg-black/30 px-3 py-2 text-xs text-white font-mono focus:border-[#e8364b] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-neutral-300">Description *</label>
                <textarea
                  rows={3}
                  required
                  value={editingPlatform.description}
                  onChange={(e) => setEditingPlatform({ ...editingPlatform, description: e.target.value })}
                  className="w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 py-2 text-xs text-white focus:border-[#e8364b] focus:outline-none"
                />
              </div>

              {/* Key Features (comma-separated) */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-neutral-300">Key Features (comma-separated)</label>
                <input
                  type="text"
                  value={editingPlatform.features.join(', ')}
                  onChange={(e) =>
                    setEditingPlatform({
                      ...editingPlatform,
                      features: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  className="w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 py-2 text-xs text-white focus:border-[#e8364b] focus:outline-none"
                  placeholder="Bird King Boss Battles, Dual-Screen Reels, Direct Web Play"
                />
              </div>

              {/* Supported Devices */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-neutral-300">Supported Devices</label>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {[
                    { key: 'android', label: 'Android APK', icon: Smartphone },
                    { key: 'ios', label: 'iOS Safari', icon: Globe },
                    { key: 'web', label: 'Web Launcher', icon: Monitor },
                  ].map(({ key, label, icon: Icon }) => {
                    const isChecked = editingPlatform.platforms.includes(key);
                    return (
                      <label
                        key={key}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs cursor-pointer select-none transition-colors ${
                          isChecked
                            ? 'bg-[#e8364b]/15 border-[#e8364b]/40 text-white'
                            : 'bg-white/[0.02] border-white/[0.08] text-neutral-400 hover:text-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...editingPlatform.platforms, key]
                              : editingPlatform.platforms.filter((p) => p !== key);
                            setEditingPlatform({ ...editingPlatform, platforms: next });
                          }}
                          className="hidden"
                        />
                        <Icon className="h-3.5 w-3.5" />
                        <span>{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Active Toggle & Display Order */}
              <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editingPlatform.is_active}
                    onChange={(e) =>
                      setEditingPlatform({ ...editingPlatform, is_active: e.target.checked })
                    }
                    className="h-4 w-4 rounded accent-[#e8364b] cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-white">Active in Public Directory</span>
                </label>

                <div className="flex items-center gap-2">
                  <label className="text-[11px] text-neutral-400">Order:</label>
                  <input
                    type="number"
                    value={editingPlatform.display_order}
                    onChange={(e) =>
                      setEditingPlatform({
                        ...editingPlatform,
                        display_order: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-16 rounded-lg border border-white/[0.1] bg-black/30 px-2 py-1 text-xs text-white text-center focus:border-[#e8364b] focus:outline-none"
                  />
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-4 border-t border-white/[0.08] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingPlatform(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#e8364b] hover:bg-[#d12a3e] text-xs font-bold text-white transition-all shadow-[0_2px_12px_rgba(232,54,75,0.3)] disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Game Modal */}
      {createGameModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl border border-white/[0.1] bg-[#111116] shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-[#e8364b]/20 border border-[#e8364b]/30 flex items-center justify-center">
                  <Gamepad2 className="h-4 w-4 text-[#e8364b]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Add New Gaming Platform</h3>
                  <p className="text-[11px] text-neutral-400">Add a new portal to Sandy&apos;s Gaming directory</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCreateGameModalOpen(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleCreateGame} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {/* Name & Slug */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-neutral-300">Platform Name *</label>
                  <input
                    type="text"
                    required
                    value={newGame.name}
                    onChange={(e) => handleNewGameNameChange(e.target.value)}
                    placeholder="e.g. Ultra Monster 777"
                    className="w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 py-2 text-xs text-white focus:border-[#e8364b] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-neutral-300">Slug *</label>
                  <input
                    type="text"
                    required
                    value={newGame.slug}
                    onChange={(e) => setNewGame({ ...newGame, slug: e.target.value })}
                    placeholder="e.g. ultra-monster-777"
                    className="w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 py-2 text-xs text-white font-mono focus:border-[#e8364b] focus:outline-none"
                  />
                </div>
              </div>

              {/* Tagline & Badge */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-semibold text-neutral-300">Tagline</label>
                  <input
                    type="text"
                    value={newGame.tagline}
                    onChange={(e) => setNewGame({ ...newGame, tagline: e.target.value })}
                    placeholder="e.g. High-power creature boss battles & reel spinners"
                    className="w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 py-2 text-xs text-white focus:border-[#e8364b] focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-neutral-300">Badge (Optional)</label>
                  <select
                    value={newGame.badge}
                    onChange={(e) => setNewGame({ ...newGame, badge: e.target.value })}
                    className="w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 py-2 text-xs text-white focus:border-[#e8364b] focus:outline-none"
                  >
                    <option value="">None</option>
                    <option value="Trending">Trending</option>
                    <option value="Popular">Popular</option>
                    <option value="Top Pick">Top Pick</option>
                    <option value="Hot">Hot</option>
                    <option value="New">New</option>
                  </select>
                </div>
              </div>

              {/* Portal URL */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-neutral-300">Portal / Play / Download URL *</label>
                <input
                  type="url"
                  required
                  value={newGame.play_url}
                  onChange={(e) => setNewGame({ ...newGame, play_url: e.target.value })}
                  placeholder="https://example.com/play"
                  className="w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 py-2 text-xs text-white font-mono focus:border-[#e8364b] focus:outline-none"
                />
              </div>

              {/* Category & Accent Color */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-neutral-300">Category *</label>
                  <select
                    value={newGame.category}
                    onChange={(e) =>
                      setNewGame({
                        ...newGame,
                        category: e.target.value as 'fish' | 'slots' | 'all-in-one',
                      })
                    }
                    className="w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 py-2 text-xs text-white focus:border-[#e8364b] focus:outline-none"
                  >
                    <option value="all-in-one">All-In-One Suite</option>
                    <option value="fish">Fish &amp; Arcade Shooter</option>
                    <option value="slots">Classic 777 &amp; Slots</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-neutral-300">Accent Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newGame.accent_color}
                      onChange={(e) => setNewGame({ ...newGame, accent_color: e.target.value })}
                      className="h-8 w-12 rounded cursor-pointer border border-white/[0.1] bg-transparent"
                    />
                    <input
                      type="text"
                      value={newGame.accent_color}
                      onChange={(e) => setNewGame({ ...newGame, accent_color: e.target.value })}
                      placeholder="#e8364b"
                      className="flex-1 rounded-xl border border-white/[0.1] bg-black/30 px-3 py-2 text-xs text-white font-mono focus:border-[#e8364b] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-neutral-300">Description</label>
                <textarea
                  rows={2}
                  value={newGame.description}
                  onChange={(e) => setNewGame({ ...newGame, description: e.target.value })}
                  placeholder="Overview of gameplay, bosses, and features..."
                  className="w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 py-2 text-xs text-white focus:border-[#e8364b] focus:outline-none"
                />
              </div>

              {/* Key Features (comma-separated) */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-neutral-300">Key Features (comma-separated)</label>
                <input
                  type="text"
                  value={newGame.features}
                  onChange={(e) => setNewGame({ ...newGame, features: e.target.value })}
                  className="w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 py-2 text-xs text-white focus:border-[#e8364b] focus:outline-none"
                  placeholder="Multiplayer Rooms, Instant Reloads, Smooth Engine"
                />
              </div>

              {/* Supported Devices */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-neutral-300">Supported Devices</label>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {[
                    { key: 'android', label: 'Android APK', icon: Smartphone },
                    { key: 'ios', label: 'iOS Safari', icon: Globe },
                    { key: 'web', label: 'Web Launcher', icon: Monitor },
                  ].map(({ key, label, icon: Icon }) => {
                    const isChecked = newGame.platforms.includes(key);
                    return (
                      <label
                        key={key}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs cursor-pointer select-none transition-colors ${
                          isChecked
                            ? 'bg-[#e8364b]/15 border-[#e8364b]/40 text-white'
                            : 'bg-white/[0.02] border-white/[0.08] text-neutral-400 hover:text-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...newGame.platforms, key]
                              : newGame.platforms.filter((p) => p !== key);
                            setNewGame({ ...newGame, platforms: next });
                          }}
                          className="hidden"
                        />
                        <Icon className="h-3.5 w-3.5" />
                        <span>{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newGame.is_active}
                    onChange={(e) => setNewGame({ ...newGame, is_active: e.target.checked })}
                    className="h-4 w-4 rounded accent-[#e8364b] cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-white">Active in Public Directory</span>
                </label>

                <div className="flex items-center gap-2">
                  <label className="text-[11px] text-neutral-400">Order:</label>
                  <input
                    type="number"
                    value={newGame.display_order}
                    onChange={(e) =>
                      setNewGame({
                        ...newGame,
                        display_order: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-16 rounded-lg border border-white/[0.1] bg-black/30 px-2 py-1 text-xs text-white text-center focus:border-[#e8364b] focus:outline-none"
                  />
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-4 border-t border-white/[0.08] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setCreateGameModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingGame}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#e8364b] hover:bg-[#d12a3e] text-xs font-bold text-white transition-all shadow-[0_2px_12px_rgba(232,54,75,0.3)] disabled:opacity-50 cursor-pointer"
                >
                  {creatingGame ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5" />
                      <span>+ Add Game</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Category Modal */}
      {createCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md flex flex-col rounded-2xl border border-white/[0.1] bg-[#111116] shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-[#ff6b7d]/20 border border-[#ff6b7d]/30 flex items-center justify-center">
                  <FolderPlus className="h-4 w-4 text-[#ff6b7d]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Add Platform Category</h3>
                  <p className="text-[11px] text-neutral-400">Create a new game grouping category</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCreateCategoryModalOpen(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleCreateCategory} className="px-6 py-5 space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-neutral-300">Category Name *</label>
                <input
                  type="text"
                  required
                  value={newCategory.name}
                  onChange={(e) => handleNewCategoryNameChange(e.target.value)}
                  placeholder="e.g. Jackpots & Keno"
                  className="w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 py-2 text-xs text-white focus:border-[#e8364b] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-neutral-300">Slug *</label>
                <input
                  type="text"
                  required
                  value={newCategory.slug}
                  onChange={(e) => setNewCategory({ ...newCategory, slug: e.target.value })}
                  placeholder="e.g. jackpots-keno"
                  className="w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 py-2 text-xs text-white font-mono focus:border-[#e8364b] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-neutral-300">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={newCategory.description}
                  onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                  placeholder="Games featured in this category..."
                  className="w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 py-2 text-xs text-white focus:border-[#e8364b] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-neutral-300">Display Order</label>
                <input
                  type="number"
                  value={newCategory.display_order}
                  onChange={(e) =>
                    setNewCategory({ ...newCategory, display_order: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-24 rounded-xl border border-white/[0.1] bg-black/30 px-3 py-2 text-xs text-white focus:border-[#e8364b] focus:outline-none"
                />
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-4 border-t border-white/[0.08] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setCreateCategoryModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingCategory}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#e8364b] hover:bg-[#d12a3e] text-xs font-bold text-white transition-all shadow-[0_2px_12px_rgba(232,54,75,0.3)] disabled:opacity-50 cursor-pointer"
                >
                  {creatingCategory ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5" />
                      <span>+ Add Category</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sticky Footer Floating (+) Button with Speed-Dial directly in document.body via Portal */}
      {mounted
        ? createPortal(
            <>
              {/* Backdrop when speed dial is open */}
              {speedDialOpen && (
                <div
                  onClick={() => setSpeedDialOpen(false)}
                  className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs transition-opacity"
                />
              )}

              <div className="fixed bottom-6 right-5 sm:right-8 z-50 flex flex-col items-end gap-2.5">
                {/* 2 Buttons Pop-Up Menu: Game Platform & Platform Category */}
                {speedDialOpen && (
                  <div className="flex flex-col items-end gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
                    {/* Button 2: Add Game Platform */}
                    <button
                      type="button"
                      onClick={() => {
                        setSpeedDialOpen(false);
                        setCreateGameModalOpen(true);
                      }}
                      className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#1a1a24] hover:bg-[#222230] text-white border border-white/10 shadow-2xl transition-all cursor-pointer group active:scale-95"
                    >
                      <div className="text-right">
                        <span className="block text-xs font-semibold text-neutral-200 group-hover:text-white">
                          Add Game Platform
                        </span>
                        <span className="block text-[10px] text-neutral-400">
                          New game portal, download &amp; credentials
                        </span>
                      </div>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e8364b]/20 text-[#ff6b7d] border border-[#e8364b]/30 shrink-0">
                        <Gamepad2 className="h-4 w-4" />
                      </div>
                    </button>

                    {/* Button 1: Add Platform Category */}
                    <button
                      type="button"
                      onClick={() => {
                        setSpeedDialOpen(false);
                        setCreateCategoryModalOpen(true);
                      }}
                      className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#1a1a24] hover:bg-[#222230] text-white border border-white/10 shadow-2xl transition-all cursor-pointer group active:scale-95"
                    >
                      <div className="text-right">
                        <span className="block text-xs font-semibold text-neutral-200 group-hover:text-white">
                          Add Platform Category
                        </span>
                        <span className="block text-[10px] text-neutral-400">
                          Fish, slots, or all-in-one group
                        </span>
                      </div>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30 shrink-0">
                        <FolderPlus className="h-4 w-4" />
                      </div>
                    </button>
                  </div>
                )}

                {/* Main Floating Action Button (+) */}
                <button
                  type="button"
                  onClick={() => setSpeedDialOpen(!speedDialOpen)}
                  className={`flex h-13 w-13 items-center justify-center rounded-full bg-[#e8364b] text-white shadow-2xl shadow-[#e8364b]/50 border border-white/20 hover:bg-[#d12a3e] hover:scale-105 active:scale-90 transition-all cursor-pointer ${
                    speedDialOpen ? 'rotate-45' : 'rotate-0'
                  }`}
                  aria-label={speedDialOpen ? 'Close Platform Options' : 'Add Platform'}
                  title={speedDialOpen ? 'Close' : 'Add Platform'}
                >
                  <Plus className="h-6 w-6 stroke-[2.5] transition-transform duration-200" />
                </button>
              </div>
            </>,
            document.body
          )
        : null}
    </div>
  );
}

