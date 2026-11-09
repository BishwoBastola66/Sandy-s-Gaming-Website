import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/server';
import { sanitizeErrorMessage } from '@/lib/validation/error-sanitizer';
import type { GamingApp } from '@/types/gaming-platform';

export interface PlatformCategory {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface StoredPlatform {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  play_url: string;
  category: 'fish' | 'slots' | 'all-in-one' | string;
  tags: string[];
  features: string[];
  platforms: ('android' | 'ios' | 'web' | 'pc')[];
  logo_url: string | null;
  badge: string | null;
  accent_color: string | null;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

const DEFAULT_PLATFORM_CATEGORIES: PlatformCategory[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    slug: 'all',
    name: 'All Platforms',
    description: 'All verified sweepstakes, fish shooter, and slot portals',
    display_order: 1,
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    slug: 'fish',
    name: 'Fish & Arcade Shooters',
    description: 'Multiplayer arcade shooter games with rapid cannons and boss hunts',
    display_order: 2,
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    slug: 'slots',
    name: 'Classic 777 & Slots',
    description: 'Progressive reels, Vegas 777s, and spinning multipliers',
    display_order: 3,
  },
  {
    id: '00000000-0000-4000-8000-000000000004',
    slug: 'all-in-one',
    name: 'All-In-One Suites',
    description: 'Complete sweepstakes hubs with both fish tables and multi-line reels',
    display_order: 4,
  },
];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mapRowToGamingApp(p: StoredPlatform): GamingApp {
  return {
    id: p.slug || p.id,
    name: p.name,
    tagline: p.tagline,
    description: p.description,
    playUrl: p.play_url,
    category: (p.category || 'all-in-one') as 'fish' | 'slots' | 'all-in-one',
    tags: Array.isArray(p.tags) ? p.tags : [],
    features: Array.isArray(p.features) ? p.features : [],
    platforms: (Array.isArray(p.platforms) ? p.platforms : ['android', 'ios', 'web']) as (
      | 'android'
      | 'ios'
      | 'web'
      | 'pc'
    )[],
    logoUrl: p.logo_url || `/games/${p.slug}.png`,
    badge: p.badge || undefined,
    accentColor: p.accent_color || '#e8364b',
    displayOrder: p.display_order,
    isActive: p.is_active,
  };
}

/**
 * Fetch all platform categories from Supabase `public.platform_categories`.
 */
export const getPlatformCategories = cache(async (): Promise<PlatformCategory[]> => {
  try {
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from('platform_categories')
      .select('id, slug, name, description, display_order, created_at, updated_at')
      .order('display_order', { ascending: true });

    if (!error && data && data.length > 0) {
      const hasAllTab = data.some((c) => c.slug === 'all');
      if (!hasAllTab) {
        return [DEFAULT_PLATFORM_CATEGORIES[0], ...data];
      }
      return data;
    }
  } catch (err) {
    console.error('[PlatformStore] Error fetching platform_categories:', err);
  }

  return DEFAULT_PLATFORM_CATEGORIES;
});

export const readLocalCategories = getPlatformCategories;

/**
 * Create a new platform category in Supabase `public.platform_categories`.
 */
export async function createPlatformCategory(input: {
  name: string;
  slug: string;
  description?: string | null;
  display_order?: number;
}): Promise<PlatformCategory> {
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from('platform_categories')
    .insert({
      name: input.name.trim(),
      slug: input.slug.trim().toLowerCase(),
      description: input.description?.trim() || null,
      display_order: input.display_order ?? 0,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(sanitizeErrorMessage(error, 'Failed to create platform category.'));
  }

  return data;
}

/**
 * Update an existing platform category by UUID or slug in Supabase.
 */
export async function updatePlatformCategory(
  idOrSlug: string,
  patch: Partial<Pick<PlatformCategory, 'name' | 'slug' | 'description' | 'display_order'>>
): Promise<PlatformCategory | null> {
  const supabase = await createAdminClient();
  const isUuid = UUID_REGEX.test(idOrSlug);
  const query = supabase
    .from('platform_categories')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    });

  const { data, error } = isUuid
    ? await query.eq('id', idOrSlug).select().maybeSingle()
    : await query.eq('slug', idOrSlug).select().maybeSingle();

  if (error) {
    throw new Error(sanitizeErrorMessage(error, 'Failed to update platform category.'));
  }

  return data;
}

/**
 * Delete a platform category by UUID or slug in Supabase.
 */
export async function deletePlatformCategory(idOrSlug: string): Promise<boolean> {
  const supabase = await createAdminClient();
  const isUuid = UUID_REGEX.test(idOrSlug);
  const query = supabase.from('platform_categories').delete();

  const { data, error } = isUuid
    ? await query.eq('id', idOrSlug).select('id')
    : await query.eq('slug', idOrSlug).select('id');

  if (error) {
    throw new Error(sanitizeErrorMessage(error, 'Failed to delete platform category.'));
  }

  return Array.isArray(data) && data.length > 0;
}

/**
 * Fetch all active gaming platforms from Supabase `public.gaming_platforms`.
 */
export const getActivePlatforms = cache(async (): Promise<GamingApp[]> => {
  try {
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from('gaming_platforms')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (!error && data) {
      return (data as StoredPlatform[]).map(mapRowToGamingApp);
    }
  } catch (err) {
    console.error('[PlatformStore] Error fetching active gaming_platforms:', err);
  }

  return [];
});

/**
 * Fetch all gaming platforms (active & inactive) for Admin management.
 */
export async function getAllPlatformsForAdmin(): Promise<StoredPlatform[]> {
  try {
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from('gaming_platforms')
      .select('*')
      .order('display_order', { ascending: true });

    if (!error && data) {
      return data as StoredPlatform[];
    }
  } catch (err) {
    console.error('[PlatformStore] Error fetching all gaming_platforms:', err);
  }

  return [];
}

/**
 * Create a new gaming platform in Supabase `public.gaming_platforms`.
 */
export async function createPlatform(
  input: Omit<StoredPlatform, 'id' | 'created_at' | 'updated_at'>
): Promise<StoredPlatform> {
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from('gaming_platforms')
    .insert({
      slug: input.slug,
      name: input.name,
      tagline: input.tagline,
      description: input.description,
      play_url: input.play_url,
      category: input.category,
      tags: input.tags,
      features: input.features,
      platforms: input.platforms,
      logo_url: input.logo_url || `/games/${input.slug}.png`,
      badge: input.badge || null,
      accent_color: input.accent_color || '#e8364b',
      display_order: input.display_order,
      is_active: input.is_active,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(sanitizeErrorMessage(error, 'Failed to create gaming platform.'));
  }

  return data as StoredPlatform;
}

/**
 * Update a gaming platform in Supabase `public.gaming_platforms`.
 */
export async function updatePlatform(
  idOrSlug: string,
  patch: Partial<StoredPlatform>
): Promise<StoredPlatform | null> {
  const supabase = await createAdminClient();
  const isUuid = UUID_REGEX.test(idOrSlug);
  const query = supabase.from('gaming_platforms').update({
    ...patch,
    updated_at: new Date().toISOString(),
  });

  const { data, error } = isUuid
    ? await query.eq('id', idOrSlug).select().maybeSingle()
    : await query.eq('slug', idOrSlug).select().maybeSingle();

  if (error) {
    throw new Error(sanitizeErrorMessage(error, 'Failed to update gaming platform.'));
  }

  return (data as StoredPlatform) || null;
}

/**
 * Delete a gaming platform in Supabase `public.gaming_platforms`.
 */
export async function deletePlatform(idOrSlug: string): Promise<boolean> {
  const supabase = await createAdminClient();
  const isUuid = UUID_REGEX.test(idOrSlug);
  const query = supabase.from('gaming_platforms').delete();

  const { data, error } = isUuid
    ? await query.eq('id', idOrSlug).select('id')
    : await query.eq('slug', idOrSlug).select('id');

  if (error) {
    throw new Error(sanitizeErrorMessage(error, 'Failed to delete gaming platform.'));
  }

  return Array.isArray(data) && data.length > 0;
}
