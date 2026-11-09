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

import {
  FolderTree,
  Plus,
  Edit2,
  Trash2,
  Search,
  Check,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Gamepad2,
  FileText,
} from 'lucide-react';
import { sanitizeErrorMessage } from '@/lib/validation/error-sanitizer';

export interface CategoryData {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  display_order: number;
}

interface AdminCategoriesClientProps {
  initialContentCategories: CategoryData[];
  initialPlatformCategories: CategoryData[];
}

export function AdminCategoriesClient({
  initialContentCategories,
  initialPlatformCategories,
}: AdminCategoriesClientProps) {
  const [activeTab, setActiveTab] = useState<'content' | 'platform'>('content');
  const [contentCategories, setContentCategories] = useState<CategoryData[]>(initialContentCategories);
  const [platformCategories, setPlatformCategories] = useState<CategoryData[]>(initialPlatformCategories);
  const [searchQuery, setSearchQuery] = useState('');
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const mounted = useMounted();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    slug: string;
    description: string;
    display_order: number;
  }>({
    name: '',
    slug: '',
    description: '',
    display_order: 1,
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const currentList = activeTab === 'content' ? contentCategories : platformCategories;

  const filteredCategories = currentList.filter((cat) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      cat.name.toLowerCase().includes(q) ||
      cat.slug.toLowerCase().includes(q) ||
      (cat.description && cat.description.toLowerCase().includes(q))
    );
  });

  const handleOpenCreate = (targetTab?: 'content' | 'platform') => {
    const tabToUse = targetTab || activeTab;
    if (targetTab && targetTab !== activeTab) {
      setActiveTab(targetTab);
    }
    const targetList = tabToUse === 'content' ? contentCategories : platformCategories;
    setModalMode('create');
    setEditingId(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      display_order: targetList.length + 1,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (cat: CategoryData) => {
    setModalMode('edit');
    setEditingId(cat.id);
    setFormData({
      name: cat.name,
      slug: cat.slug,
      description: cat.description || '',
      display_order: cat.display_order || 1,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSlugAutofill = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: modalMode === 'create'
        ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        : prev.slug,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim() || !formData.slug.trim()) {
      setFormError('Category name and slug are required.');
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(formData.slug.trim())) {
      setFormError('Slug must use lowercase letters, numbers, and hyphens only.');
      return;
    }

    setSaving(true);
    try {
      const endpoint = activeTab === 'content' ? '/api/categories' : '/api/platforms/categories';

      if (modalMode === 'create') {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create category');

        if (activeTab === 'content') {
          setContentCategories((prev) => [...prev, data.category]);
        } else {
          setPlatformCategories((prev) => [...prev, data.category]);
        }
        showToast(`Category "${formData.name}" created successfully`);
      } else {
        const url = activeTab === 'content' ? `/api/categories/${editingId}` : `/api/platforms/categories/${editingId}`;
        const res = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update category');

        if (activeTab === 'content') {
          setContentCategories((prev) =>
            prev.map((c) => (c.id === editingId ? { ...c, ...data.category } : c))
          );
        } else {
          setPlatformCategories((prev) =>
            prev.map((c) => (c.id === editingId ? { ...c, ...data.category } : c))
          );
        }
        showToast(`Category "${formData.name}" updated successfully`);
      }

      setModalOpen(false);
    } catch (err: unknown) {
      setFormError(sanitizeErrorMessage(err, 'Error saving category.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat: CategoryData) => {
    if (!window.confirm(`Are you sure you want to delete category "${cat.name}"?`)) return;

    try {
      const url = activeTab === 'content' ? `/api/categories/${cat.id}` : `/api/platforms/categories/${cat.id}`;
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete category');
      }

      if (activeTab === 'content') {
        setContentCategories((prev) => prev.filter((c) => c.id !== cat.id));
      } else {
        setPlatformCategories((prev) => prev.filter((c) => c.id !== cat.id));
      }
      showToast(`Category "${cat.name}" removed successfully`);
    } catch (err: unknown) {
      showToast(sanitizeErrorMessage(err, 'Error deleting category.'), 'error');
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col px-4 sm:px-6 lg:px-8 py-5 space-y-6 animate-page-enter">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-xs font-semibold shadow-2xl animate-fade-in ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/30'
              : 'bg-red-950/90 text-red-200 border-red-500/30'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-400" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <FolderTree className="h-5 w-5 text-[#e8364b]" />
          <span>Category Manager</span>
        </h1>
      </div>

      {/* Category Section Switch (Like Settings Segmented Control) */}
      <div className="inline-flex p-1 rounded-xl bg-white/[0.04] border border-white/[0.08] max-w-full overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => {
            setActiveTab('content');
            setSearchQuery('');
          }}
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'content'
              ? 'bg-[#e8364b] text-white shadow-sm'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          <span>Content &amp; Media ({contentCategories.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('platform');
            setSearchQuery('');
          }}
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'platform'
              ? 'bg-[#e8364b] text-white shadow-sm'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Gamepad2 className="h-3.5 w-3.5" />
          <span>Game Platforms ({platformCategories.length})</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeTab === 'content' ? 'content' : 'game'} categories...`}
            className="w-full rounded-xl border border-white/[0.08] bg-[#111116] pl-9 pr-4 py-2 text-xs text-white placeholder:text-neutral-500 focus:border-[#e8364b]/50 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Categories Table - Seamless Flat Layout (No Card Container) */}
      <div className="w-full overflow-x-auto border-b border-white/[0.08]">
        <table className="w-full text-left text-xs divide-y divide-white/[0.06]">
          <thead className="border-b border-white/[0.08] bg-white/[0.02] text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Category Name</th>
              <th className="px-4 py-3">URL Slug</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06] text-neutral-300">
            {filteredCategories.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-neutral-500 text-xs">
                  No categories found. Click the + button below to create one.
                </td>
              </tr>
            ) : (
              filteredCategories.map((cat) => (
                <tr key={cat.id || cat.slug} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3.5 font-mono text-neutral-400 font-semibold">
                    #{cat.display_order ?? 0}
                  </td>
                  <td className="px-4 py-3.5 font-bold text-white text-sm">
                    {cat.name}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-neutral-300">
                      {cat.slug}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-neutral-400 max-w-sm truncate">
                    {cat.description || '—'}
                  </td>
                  <td className="px-4 py-3.5 text-right whitespace-nowrap space-x-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(cat)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-[#e8364b] hover:text-white text-neutral-300 transition-colors text-xs font-semibold cursor-pointer"
                    >
                      <Edit2 className="h-3 w-3" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(cat)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-950/20 hover:bg-red-900/40 text-red-400 hover:text-red-300 border border-red-900/30 transition-colors text-xs font-semibold cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Delete</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Dialog for Create/Edit */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#121217] shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <FolderTree className="h-4 w-4 text-[#e8364b]" />
                <span>
                  {modalMode === 'create'
                    ? activeTab === 'content'
                      ? 'Create Content List Category'
                      : 'Create Platform Details Category'
                    : `Edit Category "${formData.name}"`}
                </span>
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="rounded-lg bg-red-950/30 border border-red-500/30 p-2.5 text-xs text-red-300 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-300">Category Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => handleSlugAutofill(e.target.value)}
                  placeholder="e.g. Esports Tournaments, Retro Slots"
                  className="w-full rounded-xl border border-white/[0.1] bg-[#16161d] px-3.5 py-2 text-xs text-white placeholder:text-neutral-500 focus:border-[#e8364b]/50 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-300">URL Slug</label>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value.toLowerCase().trim() }))}
                  placeholder="e.g. esports-tournaments"
                  className="w-full rounded-xl border border-white/[0.1] bg-[#16161d] px-3.5 py-2 text-xs font-mono text-white placeholder:text-neutral-500 focus:border-[#e8364b]/50 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-300">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Short synopsis of this category..."
                  className="w-full rounded-xl border border-white/[0.1] bg-[#16161d] px-3.5 py-2 text-xs text-white placeholder:text-neutral-500 focus:border-[#e8364b]/50 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-300">Display Order</label>
                <input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData((prev) => ({ ...prev, display_order: parseInt(e.target.value, 10) || 0 }))}
                  className="w-full rounded-xl border border-white/[0.1] bg-[#16161d] px-3.5 py-2 text-xs text-white focus:border-[#e8364b]/50 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-white/[0.08] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#e8364b] hover:bg-[#d12a3e] text-xs font-bold text-white transition-all shadow-[0_2px_12px_rgba(232,54,75,0.3)] disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>{modalMode === 'create' ? 'Create Category' : 'Save Changes'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sticky Footer New Category (+) Button with Speed-Dial directly in document.body via Portal */}
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
                {/* 2 Buttons Pop-Up Menu: List Category & Details Category */}
                {speedDialOpen && (
                  <div className="flex flex-col items-end gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
                    {/* Button 2: Game Platform Details Category */}
                    <button
                      type="button"
                      onClick={() => {
                        setSpeedDialOpen(false);
                        handleOpenCreate('platform');
                      }}
                      className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#1a1a24] hover:bg-[#222230] text-white border border-white/10 shadow-2xl transition-all cursor-pointer group active:scale-95"
                    >
                      <div className="text-right">
                        <span className="block text-xs font-semibold text-neutral-200 group-hover:text-white">
                          Platform Details Category
                        </span>
                        <span className="block text-[10px] text-neutral-400">
                          Gaming portals &amp; game details
                        </span>
                      </div>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30 shrink-0">
                        <Gamepad2 className="h-4 w-4" />
                      </div>
                    </button>

                    {/* Button 1: Content List Category */}
                    <button
                      type="button"
                      onClick={() => {
                        setSpeedDialOpen(false);
                        handleOpenCreate('content');
                      }}
                      className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#1a1a24] hover:bg-[#222230] text-white border border-white/10 shadow-2xl transition-all cursor-pointer group active:scale-95"
                    >
                      <div className="text-right">
                        <span className="block text-xs font-semibold text-neutral-200 group-hover:text-white">
                          Content List Category
                        </span>
                        <span className="block text-[10px] text-neutral-400">
                          Blog posts, tournament lists &amp; media
                        </span>
                      </div>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e8364b]/20 text-[#ff6b7d] border border-[#e8364b]/30 shrink-0">
                        <FileText className="h-4 w-4" />
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
                  aria-label={speedDialOpen ? 'Close Category Options' : 'Add Category'}
                  title={speedDialOpen ? 'Close' : 'Add Category'}
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

