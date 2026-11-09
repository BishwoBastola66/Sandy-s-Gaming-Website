import { createAdminClient } from '@/lib/supabase/server';
import { sanitizeErrorMessage } from '@/lib/validation/error-sanitizer';

export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

const DEFAULT_CATEGORIES: CategoryItem[] = [
  {
    id: '00000000-0000-4000-8000-000000000011',
    name: 'Esports Blogs',
    slug: 'blog',
    description: 'Competitive analysis & guides',
    display_order: 1,
  },
  {
    id: '00000000-0000-4000-8000-000000000012',
    name: 'Posters',
    slug: 'poster',
    description: 'Official graphics and tournament art',
    display_order: 2,
  },
  {
    id: '00000000-0000-4000-8000-000000000013',
    name: 'Wallpapers',
    slug: 'photo',
    description: '4K ultrawide desktop wallpapers',
    display_order: 3,
  },
];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getAllCategories(): Promise<CategoryItem[]> {
  try {
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, slug, description, display_order, created_at, updated_at')
      .order('display_order', { ascending: true });

    if (!error && data && data.length > 0) {
      return data;
    }
  } catch (err) {
    console.error('[CategoriesStore] Error fetching categories:', err);
  }

  return DEFAULT_CATEGORIES;
}

export async function createCategory(input: {
  name: string;
  slug: string;
  description?: string | null;
  display_order?: number;
}): Promise<CategoryItem> {
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from('categories')
    .insert({
      name: input.name.trim(),
      slug: input.slug.trim().toLowerCase(),
      description: input.description?.trim() || null,
      display_order: input.display_order ?? 0,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(sanitizeErrorMessage(error, 'Failed to create category.'));
  }

  return data;
}

export async function updateCategory(
  idOrSlug: string,
  patch: Partial<Pick<CategoryItem, 'name' | 'slug' | 'description' | 'display_order'>>
): Promise<CategoryItem | null> {
  const supabase = await createAdminClient();
  const isUuid = UUID_REGEX.test(idOrSlug);
  const query = supabase.from('categories').update({
    ...patch,
    updated_at: new Date().toISOString(),
  });

  const { data, error } = isUuid
    ? await query.eq('id', idOrSlug).select().maybeSingle()
    : await query.eq('slug', idOrSlug).select().maybeSingle();

  if (error) {
    throw new Error(sanitizeErrorMessage(error, 'Failed to update category.'));
  }

  return data;
}

export async function deleteCategory(idOrSlug: string): Promise<boolean> {
  const supabase = await createAdminClient();
  const isUuid = UUID_REGEX.test(idOrSlug);
  const query = supabase.from('categories').delete();

  const { data, error } = isUuid
    ? await query.eq('id', idOrSlug).select('id')
    : await query.eq('slug', idOrSlug).select('id');

  if (error) {
    throw new Error(sanitizeErrorMessage(error, 'Failed to delete category.'));
  }

  return Array.isArray(data) && data.length > 0;
}
