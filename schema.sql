-- ==============================================================================
-- SANDY'S GAMING — PRINCIPAL DBA 3NF NORMALIZED PRODUCTION SCHEMA
-- ==============================================================================
-- Authoritative, Third Normal Form (3NF / BCNF) PostgreSQL / Supabase blueprint.
-- Zero duplicate tables, zero duplicate columns, zero transitive dependencies,
-- and zero "assigned admin" columns/tables (all staff have unified support access).
--
-- Architecture & Normalization Structure:
--   0. Clean-slate deterministic teardown (reverse dependency order)
--   1. Extensions, custom types, default privilege lockdown & core utilities
--   2. Unified Accounts, Sessions & OTP Verification (accounts, sessions, account_otps)
--      - accounts: Single canonical user identity, role & authentication table
--      - sessions: Active device tokens referencing accounts(id)
--      - account_otps: Time-bound verification codes with automatic garbage collection
--   3. Content Management System (categories, posts, post_media)
--      - posts.author_id references accounts(id)
--      - posts.post_type references categories(slug) directly (no redundant category_id)
--   4. Gaming Platforms & Platform Categories (platform_categories, gaming_platforms)
--      - gaming_platforms.category references platform_categories(slug)
--   5. Live Support Chat (conversations, messages, attachments)
--      - Unified staff access (no conversation_assignments table)
--   6. Support Ticketing System (ticket_categories, ticket_priorities, tickets)
--      - tickets.customer_id references accounts(id) (no redundant customer_email/name or assigned_admin_id)
--   7. Guest Contact Inquiries & Transactional Email Replies (contact_inquiries, contact_inquiry_replies)
--      - Unified staff access (no assigned_admin_id column)
--   8. Tamper-Proof Append-Only Security Audit Logs (audit_logs)
--   9. Defense-in-Depth Row-Level Security (ENABLE + FORCE RLS) & Least-Privilege Grants
--  10. Supabase Storage Buckets (engine-enforced MIME allowlists, size caps & path rules)
--  11. Supabase Realtime Publications & Private Channel Broadcast Authorization
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. CLEAN SLATE: DROP EXISTING VIEWS, TABLES, FUNCTIONS & TRIGGERS
-- ------------------------------------------------------------------------------
DROP VIEW IF EXISTS public.message_attachments CASCADE;
DROP FUNCTION IF EXISTS public.is_assigned_to_conversation(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.sync_account_to_profile() CASCADE;
DROP TABLE IF EXISTS public.attachments CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversation_assignments CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.post_media CASCADE;
DROP TABLE IF EXISTS public.posts CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.gaming_platforms CASCADE;
DROP TABLE IF EXISTS public.platform_categories CASCADE;
DROP TABLE IF EXISTS public.tickets CASCADE;
DROP TABLE IF EXISTS public.ticket_categories CASCADE;
DROP TABLE IF EXISTS public.ticket_priorities CASCADE;
DROP TABLE IF EXISTS public.contact_inquiry_replies CASCADE;
DROP TABLE IF EXISTS public.contact_inquiries CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.account_otps CASCADE;
DROP TABLE IF EXISTS public.sessions CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.accounts CASCADE;

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS, ENUMS, DEFAULT PRIVILEGE LOCKDOWN & CORE UTILITY FUNCTIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM ('customer', 'admin', 'super_admin');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_trusted_service_context()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    current_user IN ('postgres', 'service_role', 'supabase_admin', 'supabase_storage_admin')
    OR COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. UNIFIED ACCOUNTS, SESSIONS & OTP VERIFICATION (SINGLE SOURCE OF TRUTH)
-- ------------------------------------------------------------------------------

-- 2A. Canonical User Identity, Role & Authentication Table (public.accounts)
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL CHECK (
    length(trim(email)) BETWEEN 3 AND 254
    AND email = lower(trim(email))
    AND email ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'
  ),
  password_hash TEXT CHECK (password_hash IS NULL OR length(trim(password_hash)) >= 16),
  display_name TEXT NOT NULL DEFAULT 'User' CHECK (length(trim(display_name)) BETWEEN 1 AND 100),
  phone TEXT CHECK (phone IS NULL OR length(trim(phone)) <= 40),
  role public.user_role NOT NULL DEFAULT 'customer'::public.user_role,
  account_status TEXT NOT NULL CHECK (account_status IN ('active', 'suspended', 'pending')) DEFAULT 'active',
  provider TEXT NOT NULL CHECK (provider IN ('email', 'google')) DEFAULT 'email',
  provider_id TEXT CHECK (provider_id IS NULL OR length(trim(provider_id)) <= 255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT chk_accounts_provider_credentials CHECK (
    (provider = 'email' AND password_hash IS NOT NULL)
    OR (provider = 'google' AND provider_id IS NOT NULL)
  ),
  CONSTRAINT uq_accounts_provider_identity UNIQUE (provider, provider_id)
);

-- Note: email already has a unique B-tree index via UNIQUE constraint (accounts_email_key)
CREATE INDEX IF NOT EXISTS idx_accounts_role ON public.accounts(role);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON public.accounts(account_status);

DROP TRIGGER IF EXISTS set_accounts_updated_at ON public.accounts;
CREATE TRIGGER set_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.accounts WHERE id = auth.uid();
$$;

-- Normalize email and enforce default 'customer' role for non-privileged inserts
CREATE OR REPLACE FUNCTION public.auto_set_customer_role_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email := lower(trim(NEW.email));
  END IF;

  IF NEW.role IS NULL THEN
    NEW.role := 'customer'::public.user_role;
  ELSIF NOT public.is_trusted_service_context()
    AND COALESCE(public.get_auth_role(), '') <> 'super_admin' THEN
    NEW.role := 'customer'::public.user_role;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounts_auto_set_customer_role ON public.accounts;
CREATE TRIGGER trg_accounts_auto_set_customer_role
  BEFORE INSERT ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_customer_role_on_insert();

-- Prevent unauthorized role or status escalation
CREATE OR REPLACE FUNCTION public.protect_account_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email := lower(trim(NEW.email));
  END IF;

  IF (OLD.role IS DISTINCT FROM NEW.role OR OLD.account_status IS DISTINCT FROM NEW.account_status) THEN
    IF NOT public.is_trusted_service_context()
      AND COALESCE(public.get_auth_role(), '') <> 'super_admin' THEN
      RAISE EXCEPTION 'Security Violation: Only Super Admins can alter user roles or account status.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_account_role ON public.accounts;
CREATE TRIGGER trg_protect_account_role
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_account_role_escalation();

-- 2B. Active User Sessions Table
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL CHECK (length(trim(session_token)) >= 32),
  ip_address TEXT CHECK (ip_address IS NULL OR length(ip_address) <= 100),
  user_agent TEXT CHECK (user_agent IS NULL OR length(user_agent) <= 1024),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT chk_sessions_valid_expiry CHECK (expires_at > created_at)
);

-- Note: session_token already has a unique B-tree index via UNIQUE constraint (sessions_session_token_key)
CREATE INDEX IF NOT EXISTS idx_sessions_account_id ON public.sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON public.sessions(expires_at);

DROP TRIGGER IF EXISTS set_sessions_updated_at ON public.sessions;
CREATE TRIGGER set_sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 2C. Time-Bound OTP Verification Table
CREATE TABLE IF NOT EXISTS public.account_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL CHECK (
    length(trim(email)) BETWEEN 3 AND 254
    AND email = lower(trim(email))
  ),
  otp_code TEXT NOT NULL CHECK (otp_code ~ '^[0-9]{6}$'),
  purpose TEXT NOT NULL DEFAULT 'registration' CHECK (purpose IN ('registration', 'password_reset', 'login')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT uq_account_otps_email_purpose UNIQUE (email, purpose)
);

CREATE INDEX IF NOT EXISTS idx_account_otps_expires_at ON public.account_otps(expires_at);

DROP TRIGGER IF EXISTS set_account_otps_updated_at ON public.account_otps;
CREATE TRIGGER set_account_otps_updated_at
  BEFORE UPDATE ON public.account_otps
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.cleanup_expired_auth_records()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.account_otps WHERE expires_at < timezone('utc', now()) - interval '15 minutes';
  DELETE FROM public.sessions WHERE expires_at < timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_expired_otps ON public.account_otps;
CREATE TRIGGER trg_cleanup_expired_otps
  AFTER INSERT ON public.account_otps
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.cleanup_expired_auth_records();

-- ------------------------------------------------------------------------------
-- 3. CMS: CATEGORIES, POSTS & POST MEDIA (3NF — NO REDUNDANT CATEGORY_ID)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) BETWEEN 2 AND 80),
  slug TEXT NOT NULL UNIQUE CHECK (
    length(trim(slug)) BETWEEN 2 AND 80
    AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  description TEXT CHECK (description IS NULL OR length(description) <= 500),
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_categories_display_order ON public.categories(display_order ASC);

DROP TRIGGER IF EXISTS set_categories_updated_at ON public.categories;
CREATE TRIGGER set_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

INSERT INTO public.categories (name, slug, description, display_order)
VALUES
  ('Esports Blogs', 'blog', 'Competitive analysis, patch breakdowns, and tournament strategy guides', 1),
  ('Posters', 'poster', 'Official graphics, character posters, and tournament promotional art', 2),
  ('Wallpapers', 'photo', '4K ultrawide desktop wallpapers and high-resolution game backgrounds', 3)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order;

CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  post_type TEXT NOT NULL REFERENCES public.categories(slug) ON UPDATE CASCADE ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 2 AND 250),
  slug TEXT NOT NULL UNIQUE CHECK (
    length(trim(slug)) BETWEEN 2 AND 150
    AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  excerpt TEXT CHECK (excerpt IS NULL OR length(excerpt) <= 1000),
  body TEXT CHECK (body IS NULL OR length(body) <= 200000),
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')) DEFAULT 'draft',
  cover_image TEXT CHECK (
    cover_image IS NULL
    OR (cover_image ~ '^(https?://|/)' AND cover_image NOT LIKE '%..%')
  ),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Note: slug already has a unique B-tree index via UNIQUE constraint (posts_slug_key)
CREATE INDEX IF NOT EXISTS idx_posts_type_status_published ON public.posts(post_type, status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_status_published ON public.posts(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author ON public.posts(author_id);

DROP TRIGGER IF EXISTS set_posts_updated_at ON public.posts;
CREATE TRIGGER set_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.post_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL CHECK (
    length(trim(storage_path)) BETWEEN 1 AND 1024
    AND storage_path NOT LIKE '%..%'
  ),
  media_type TEXT NOT NULL CHECK (media_type IN ('image/jpeg', 'image/png', 'image/webp', 'image/avif')),
  alt_text TEXT CHECK (alt_text IS NULL OR length(alt_text) <= 300),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_post_media_post_sort ON public.post_media(post_id, sort_order ASC);

-- ------------------------------------------------------------------------------
-- 4. GAMING PLATFORMS & PLATFORM CATEGORIES (3NF — ENFORCED FK ON CATEGORY)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (
    length(trim(slug)) BETWEEN 2 AND 60
    AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) BETWEEN 2 AND 80),
  description TEXT CHECK (description IS NULL OR length(description) <= 500),
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_platform_categories_order ON public.platform_categories(display_order ASC);

DROP TRIGGER IF EXISTS set_platform_categories_updated_at ON public.platform_categories;
CREATE TRIGGER set_platform_categories_updated_at
  BEFORE UPDATE ON public.platform_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

INSERT INTO public.platform_categories (slug, name, description, display_order)
VALUES
  ('fish', 'Fish & Arcade Shooters', 'Multiplayer arcade shooter games with rapid cannons and boss hunts', 1),
  ('slots', 'Classic 777 & Slots', 'Progressive reels, Vegas 777s, and spinning multipliers', 2),
  ('all-in-one', 'All-In-One Suites', 'Complete sweepstakes hubs with both fish tables and multi-line reels', 3)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order;

CREATE TABLE IF NOT EXISTS public.gaming_platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (
    length(trim(slug)) BETWEEN 2 AND 80
    AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 100),
  tagline TEXT NOT NULL CHECK (length(trim(tagline)) BETWEEN 2 AND 250),
  description TEXT NOT NULL CHECK (length(trim(description)) BETWEEN 5 AND 2000),
  play_url TEXT NOT NULL CHECK (play_url ~* '^https?://'),
  category TEXT NOT NULL DEFAULT 'all-in-one' REFERENCES public.platform_categories(slug) ON UPDATE CASCADE ON DELETE RESTRICT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  features TEXT[] NOT NULL DEFAULT '{}',
  platforms TEXT[] NOT NULL DEFAULT '{android,ios,web}',
  logo_url TEXT CHECK (
    logo_url IS NULL
    OR (logo_url ~ '^(https?://|/)' AND logo_url NOT LIKE '%..%')
  ),
  badge TEXT CHECK (badge IS NULL OR length(badge) <= 40),
  accent_color TEXT DEFAULT '#e8364b' CHECK (accent_color IS NULL OR length(accent_color) <= 30),
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_gaming_platforms_active_order ON public.gaming_platforms(is_active, display_order ASC);
CREATE INDEX IF NOT EXISTS idx_gaming_platforms_category ON public.gaming_platforms(category);

DROP TRIGGER IF EXISTS set_gaming_platforms_updated_at ON public.gaming_platforms;
CREATE TRIGGER set_gaming_platforms_updated_at
  BEFORE UPDATE ON public.gaming_platforms
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

INSERT INTO public.gaming_platforms (
  slug, name, tagline, description, play_url, category, tags, features, platforms, logo_url, badge, accent_color, display_order, is_active
)
VALUES
  (
    'game-vault',
    'Game Vault 999',
    'High-multiplier boss battles & multi-screen slot reels',
    'One of the most requested fish table and slot hubs right now. Packed with high-multiplier boss challenges like Bird King Fight and Bull Demon King, smooth spins on classic reels, and instant web play right from your browser or Android device.',
    'https://gamevault999.com/',
    'all-in-one',
    ARRAY['Fish Tables', 'Multi-Screen Slots', 'Fast Payouts'],
    ARRAY['Bird King Boss Battles', 'Dual-Screen Reels', 'Direct Web Play'],
    ARRAY['android', 'ios', 'web', 'pc'],
    '/games/game-vault.png',
    'Trending',
    '#e8364b',
    1,
    true
  ),
  (
    'juwa-777',
    'Juwa 777',
    'Classic sweepstakes powerhouse with vibrant arcade tables',
    'A true sweepstakes powerhouse packed with popular slot reels, keno, and colorful multiplayer fish tables. Jump in directly on mobile web or download the APK for lag-free, responsive cannon shooting action.',
    'https://juwa777.to/',
    'all-in-one',
    ARRAY['Fish Games', 'Vegas 7s', 'Crazy Monkey'],
    ARRAY['Multiplayer Fish Rooms', 'Instant Reloads', 'Smooth APK Engine'],
    ARRAY['android', 'ios', 'web'],
    '/games/juwa-777.png',
    'Popular',
    '#3b82f6',
    2,
    true
  ),
  (
    'fire-kirin',
    'Fire Kirin',
    'The gold standard for competitive arcade fish shooters',
    'The gold standard for fish table enthusiasts. Renowned for rapid-fire multi-cannon shooting, legendary creature bosses like the Golden Dragon and Money Tree, and rock-solid performance even on budget phones.',
    'https://start.firekirin.xyz:8580/',
    'fish',
    ARRAY['Arcade Shooter', 'Money Tree', 'Skill Shooting'],
    ARRAY['High-Power Cannons', 'Golden Dragon Boss', 'Real-Time Co-Op'],
    ARRAY['android', 'ios', 'web', 'pc'],
    '/games/fire-kirin.png',
    'Top Pick',
    '#f97316',
    3,
    true
  ),
  (
    'vegas-sweeps',
    'Vegas Sweeps',
    'Vegas-style progressive reels with instant mobile launcher',
    'Smooth Las Vegas style reels, progressive jackpots, and fast-paced arcade tables. Simple web-launcher interface that opens instantly on Safari or Chrome with zero setup needed.',
    'https://m.lasvegassweeps.com/',
    'slots',
    ARRAY['Vegas Slots', 'Instant Launcher', 'Progressives'],
    ARRAY['One-Tap Mobile Launch', 'Progressive Pots', 'Classic 777 Wheels'],
    ARRAY['android', 'ios', 'web'],
    '/games/vegas-sweeps.png',
    NULL,
    '#10b981',
    4,
    true
  ),
  (
    'orion-stars',
    'Orion Stars',
    'Community favorite with tactical fish games and VIP reels',
    'Community favorite with a massive library of multi-screen reels and tactical fish games like Tai Chi Dragon. Runs lightning-fast on mobile browsers with sharp graphics and responsive touch controls.',
    'https://orionstars.vip:8781/',
    'all-in-one',
    ARRAY['Tai Chi Dragon', 'VIP Reels', 'Arcade Fish'],
    ARRAY['Crisp Graphics', 'Tactical Multipliers', 'Cross-Platform Sync'],
    ARRAY['android', 'ios', 'web', 'pc'],
    '/games/orion-stars.png',
    'Hot',
    '#8b5cf6',
    5,
    true
  ),
  (
    'ultra-panda',
    'Ultra Panda',
    'Underwater arcade shooters with hold-and-spin bonus mechanics',
    'Packed with colorful bonus rounds, hold-and-spin slot mechanics, and underwater arcade shooting. Easy one-tap mobile web launch and reliable web app interface.',
    'https://www.ultrapanda.mobi/',
    'all-in-one',
    ARRAY['Hold & Spin', 'Underwater Arcade', 'Mobile H5'],
    ARRAY['Bonus Wheel Rounds', 'Deep Sea Bosses', 'Instant H5 Web'],
    ARRAY['android', 'ios', 'web'],
    '/games/ultra-panda.png',
    NULL,
    '#ec4899',
    6,
    true
  ),
  (
    'panda-master',
    'Panda Master',
    'High-energy arcade action with lucky wheels and fruit reels',
    'High-energy platform featuring fan-favorite fish titles, lucky wheel spins, and classic fruit slots. Great touch controls and fast loading times on Android and iOS.',
    'https://pandamaster.vip:8888/',
    'all-in-one',
    ARRAY['Lucky Wheel', 'Classic Slots', 'Fish Rooms'],
    ARRAY['Fast Touch Controls', 'Rapid Load Engine', 'Multiplier Bonuses'],
    ARRAY['android', 'ios', 'web'],
    '/games/panda-master.png',
    NULL,
    '#eab308',
    7,
    true
  ),
  (
    'dragon-fury',
    'Dragon Fury',
    'Mythical boss hunts and high-line competitive reels',
    'Action-heavy sweepstakes app loaded with fiery mythical creature boss fights, multi-line reels, and competitive table rooms with great reward multiplier pacing.',
    'https://www.dragonfury.club/',
    'fish',
    ARRAY['Mythical Bosses', 'Multi-Line', 'Club Room'],
    ARRAY['Dragon Slayer Battles', 'Streak Multipliers', 'Smooth H5'],
    ARRAY['android', 'ios', 'web'],
    '/games/dragon-fury.png',
    NULL,
    '#ef4444',
    8,
    true
  ),
  (
    'cash-machine-777',
    'Cash Machine 777',
    'Pure vintage slot machines with direct browser access',
    'Pure classic slot machine vibes mixed with modern arcade tables. Clean interface with direct web portal access so you can spin and test your luck without installing heavy files.',
    'http://ab.cashmachine777.com/',
    'slots',
    ARRAY['Classic 777', 'Direct Portal', 'Retro Reels'],
    ARRAY['Retro Sound & Feel', 'No Heavy Install', 'Fast Spins'],
    ARRAY['android', 'ios', 'web', 'pc'],
    '/games/cash-machine-777.png',
    NULL,
    '#06b6d4',
    9,
    true
  ),
  (
    'milky-way',
    'Milky Way',
    'Cosmic space-themed fish hunter with stellar bonus rounds',
    'Futuristic space-themed arcade with high-action cosmic fish hunters, stellar bonus slots, and rapid-fire multiplier rounds that keep your screen glowing.',
    'https://milkywayapp.xyz/',
    'fish',
    ARRAY['Cosmic Fish', 'Space Slots', 'High Multiplier'],
    ARRAY['Galaxy Boss Hunts', 'Stellar Jackpots', 'Mobile Optimized'],
    ARRAY['android', 'ios', 'web'],
    '/games/milky-way.png',
    'New',
    '#6366f1',
    10,
    true
  ),
  (
    'game-room-777',
    'Game Room 777',
    'High-volatility reel classics and interactive mini-games',
    'All-in-one gaming suite featuring high-volatility 777 reel classics, interactive bonus games, and fast arcade action with seamless mobile web gameplay.',
    'https://www.gameroom777.com/',
    'all-in-one',
    ARRAY['777 Classic', 'High Volatility', 'Arcade Suite'],
    ARRAY['Interactive Minigames', 'Rapid Credit Loading', 'Web Launcher'],
    ARRAY['android', 'ios', 'web'],
    '/games/game-room-777.png',
    NULL,
    '#14b8a6',
    11,
    true
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  description = EXCLUDED.description,
  play_url = EXCLUDED.play_url,
  category = EXCLUDED.category,
  tags = EXCLUDED.tags,
  features = EXCLUDED.features,
  platforms = EXCLUDED.platforms,
  logo_url = EXCLUDED.logo_url,
  badge = EXCLUDED.badge,
  accent_color = EXCLUDED.accent_color,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

-- ------------------------------------------------------------------------------
-- 5. LIVE SUPPORT CHAT: CONVERSATIONS, MESSAGES & ATTACHMENTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  subject TEXT DEFAULT 'General Support' CHECK (subject IS NULL OR length(subject) <= 200),
  status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')) DEFAULT 'open',
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_conversations_customer ON public.conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON public.conversations(last_message_at DESC);

DROP TRIGGER IF EXISTS set_conversations_updated_at ON public.conversations;
CREATE TRIGGER set_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(trim(body)) > 0 AND length(body) <= 5000),
  message_type TEXT NOT NULL CHECK (message_type IN ('text', 'system', 'media')) DEFAULT 'text',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  edited_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON public.messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);

CREATE OR REPLACE FUNCTION public.maintain_conversation_last_message_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET
    last_message_at = NEW.created_at,
    updated_at = timezone('utc', now())
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_created ON public.messages;
CREATE TRIGGER on_message_created
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.maintain_conversation_last_message_at();

CREATE OR REPLACE FUNCTION public.broadcast_conversation_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, realtime
AS $$
DECLARE
  v_sender_role TEXT;
  v_sender_name TEXT;
  v_payload JSONB;
BEGIN
  SELECT role::text, display_name INTO v_sender_role, v_sender_name
  FROM public.accounts
  WHERE id = NEW.sender_id;

  v_payload := json_build_object(
    'id', NEW.id,
    'conversation_id', NEW.conversation_id,
    'body', NEW.body,
    'message_type', NEW.message_type,
    'created_at', NEW.created_at,
    'sender_id', NEW.sender_id,
    'sender_role', COALESCE(v_sender_role, 'customer'),
    'sender_name', CASE
      WHEN v_sender_role IN ('admin', 'super_admin') THEN 'Sandy Gaming'
      ELSE COALESCE(v_sender_name, 'Customer')
    END,
    'true_sender_name', COALESCE(v_sender_name, 'Staff Member')
  );

  BEGIN
    INSERT INTO realtime.messages (topic, extension, event, payload)
    VALUES (
      'chat:' || NEW.conversation_id::text,
      'broadcast',
      'new_message',
      v_payload
    );
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_conversation_message ON public.messages;
CREATE TRIGGER trg_broadcast_conversation_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.broadcast_conversation_message();

CREATE TABLE IF NOT EXISTS public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL CHECK (length(trim(file_name)) BETWEEN 1 AND 255),
  file_url TEXT NOT NULL CHECK (
    length(trim(file_url)) BETWEEN 1 AND 1024
    AND file_url ~ '^(https?://|/)'
    AND file_url NOT LIKE '%..%'
  ),
  file_type TEXT NOT NULL DEFAULT 'image' CHECK (
    file_type IN ('image', 'video', 'audio', 'file')
    OR file_type LIKE '%/%'
  ),
  file_size BIGINT DEFAULT 0 CHECK (file_size IS NULL OR (file_size >= 0 AND file_size <= 26214400)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON public.attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_attachments_conversation_id ON public.attachments(conversation_id);
CREATE INDEX IF NOT EXISTS idx_attachments_created_at ON public.attachments(created_at ASC);

-- ------------------------------------------------------------------------------
-- 6. SUPPORT TICKETS (3NF — CUSTOMER IDENTITY RESOLVED VIA ACCOUNTS FK)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ticket_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (
    length(trim(slug)) BETWEEN 2 AND 60
    AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) BETWEEN 2 AND 80),
  description TEXT CHECK (description IS NULL OR length(description) <= 500),
  icon TEXT CHECK (icon IS NULL OR length(icon) <= 60),
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_ticket_categories_order ON public.ticket_categories(display_order ASC);
CREATE INDEX IF NOT EXISTS idx_ticket_categories_active ON public.ticket_categories(is_active);

DROP TRIGGER IF EXISTS set_ticket_categories_updated_at ON public.ticket_categories;
CREATE TRIGGER set_ticket_categories_updated_at
  BEFORE UPDATE ON public.ticket_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.ticket_priorities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (
    length(trim(slug)) BETWEEN 2 AND 40
    AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) BETWEEN 2 AND 60),
  description TEXT CHECK (description IS NULL OR length(description) <= 500),
  level INT NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 10),
  color TEXT DEFAULT '#3b82f6' CHECK (color IS NULL OR length(color) <= 30),
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_ticket_priorities_order ON public.ticket_priorities(display_order ASC);
CREATE INDEX IF NOT EXISTS idx_ticket_priorities_level ON public.ticket_priorities(level ASC);

DROP TRIGGER IF EXISTS set_ticket_priorities_updated_at ON public.ticket_priorities;
CREATE TRIGGER set_ticket_priorities_updated_at
  BEFORE UPDATE ON public.ticket_priorities
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

INSERT INTO public.ticket_categories (slug, name, description, icon, display_order)
VALUES
  ('tournament', 'Tournament Dispute / Entry', 'Matches, scores, dispute resolution, and bracket registration', 'Trophy', 1),
  ('account', 'Account & Security', 'Sign-in issues, profile management, and account security', 'Shield', 2),
  ('gameplay', 'Gameplay & Tournament Meta', 'Rules, platform connection, and gameplay inquiries', 'Gamepad2', 3),
  ('payment', 'Payment & Billing', 'Transactions, credit reload, prize payout, and billing verification', 'CreditCard', 4),
  ('bug', 'Bug / Technical Glitch', 'Platform bugs, crash reports, and interface glitches', 'Bug', 5),
  ('general', 'General Support', 'General inquiries, feedback, and customer assistance', 'HelpCircle', 6)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order;

INSERT INTO public.ticket_priorities (slug, name, description, level, color, display_order)
VALUES
  ('low', 'Low', 'General inquiry or feedback; resolved within standard SLA', 1, '#737373', 1),
  ('medium', 'Medium', 'Standard support request; addressed in regular queue', 2, '#3b82f6', 2),
  ('high', 'High', 'Urgent issue requiring fast specialist response', 3, '#f59e0b', 3),
  ('urgent', 'Urgent', 'Critical blocker directly impacting tournament or account access', 4, '#ef4444', 4)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  level = EXCLUDED.level,
  color = EXCLUDED.color,
  display_order = EXCLUDED.display_order;

CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  category TEXT NOT NULL REFERENCES public.ticket_categories(slug) ON UPDATE CASCADE ON DELETE RESTRICT DEFAULT 'general',
  priority TEXT NOT NULL REFERENCES public.ticket_priorities(slug) ON UPDATE CASCADE ON DELETE RESTRICT DEFAULT 'medium',
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 200),
  description TEXT NOT NULL CHECK (length(trim(description)) BETWEEN 3 AND 10000),
  status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')) DEFAULT 'open',
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(attachments) = 'array'),
  replies JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(replies) = 'array'),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_tickets_customer_id ON public.tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_tickets_category ON public.tickets(category);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON public.tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.tickets(created_at DESC);

CREATE OR REPLACE FUNCTION public.maintain_ticket_resolution_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('resolved', 'closed') AND OLD.status NOT IN ('resolved', 'closed') THEN
    NEW.resolved_at := COALESCE(NEW.resolved_at, timezone('utc', now()));
  ELSIF NEW.status IN ('open', 'in_progress') THEN
    NEW.resolved_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tickets_resolution_timestamp ON public.tickets;
CREATE TRIGGER trg_tickets_resolution_timestamp
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.maintain_ticket_resolution_timestamp();

DROP TRIGGER IF EXISTS set_tickets_updated_at ON public.tickets;
CREATE TRIGGER set_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 7. GUEST CONTACT INQUIRIES & EMAIL REPLIES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contact_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT CHECK (name IS NULL OR length(name) <= 120),
  email TEXT NOT NULL CHECK (
    length(trim(email)) BETWEEN 5 AND 254
    AND email ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'
  ),
  phone TEXT NOT NULL CHECK (length(trim(phone)) BETWEEN 5 AND 40),
  message TEXT NOT NULL CHECK (length(trim(message)) BETWEEN 10 AND 5000),
  status TEXT NOT NULL CHECK (status IN ('new', 'in_progress', 'replied', 'closed')) DEFAULT 'new',
  replied_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_contact_inquiries_status ON public.contact_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_contact_inquiries_created ON public.contact_inquiries(created_at DESC);

DROP TRIGGER IF EXISTS set_contact_inquiries_updated_at ON public.contact_inquiries;
CREATE TRIGGER set_contact_inquiries_updated_at
  BEFORE UPDATE ON public.contact_inquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.contact_inquiry_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES public.contact_inquiries(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  body TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 10000),
  email_delivery_status TEXT NOT NULL CHECK (
    email_delivery_status IN ('pending', 'queued', 'accepted', 'sent', 'delivered', 'bounced', 'failed')
  ) DEFAULT 'pending',
  provider_message_id TEXT CHECK (provider_message_id IS NULL OR length(provider_message_id) <= 255),
  last_delivery_error TEXT CHECK (last_delivery_error IS NULL OR length(last_delivery_error) <= 2000),
  idempotency_key TEXT UNIQUE CHECK (idempotency_key IS NULL OR length(idempotency_key) <= 120),
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count BETWEEN 0 AND 10),
  last_attempted_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Note: idempotency_key already has a unique B-tree index via UNIQUE constraint
CREATE INDEX IF NOT EXISTS idx_inquiry_replies_inquiry ON public.contact_inquiry_replies(inquiry_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_inquiry_replies_admin ON public.contact_inquiry_replies(admin_id);
CREATE INDEX IF NOT EXISTS idx_inquiry_replies_status ON public.contact_inquiry_replies(email_delivery_status);

CREATE OR REPLACE FUNCTION public.handle_inquiry_reply_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.contact_inquiries
  SET
    status = 'replied',
    replied_at = NEW.created_at,
    updated_at = timezone('utc', now())
  WHERE id = NEW.inquiry_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_inquiry_reply_created ON public.contact_inquiry_replies;
CREATE TRIGGER on_inquiry_reply_created
  AFTER INSERT ON public.contact_inquiry_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_inquiry_reply_created();

-- ------------------------------------------------------------------------------
-- 8. TAMPER-PROOF APPEND-ONLY AUDIT LOGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (length(trim(action)) BETWEEN 2 AND 120),
  target_type TEXT NOT NULL CHECK (length(trim(target_type)) BETWEEN 2 AND 80),
  target_id TEXT CHECK (target_id IS NULL OR length(target_id) <= 150),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

CREATE OR REPLACE FUNCTION public.protect_audit_logs_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Security Violation: audit_logs is append-only and cannot be modified, deleted, or truncated.';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_audit_logs ON public.audit_logs;
CREATE TRIGGER trg_protect_audit_logs
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_audit_logs_immutability();

DROP TRIGGER IF EXISTS trg_protect_audit_logs_truncate ON public.audit_logs;
CREATE TRIGGER trg_protect_audit_logs_truncate
  BEFORE TRUNCATE ON public.audit_logs
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.protect_audit_logs_immutability();

-- ------------------------------------------------------------------------------
-- 9. DEFENSE-IN-DEPTH ROW LEVEL SECURITY (ENABLE + FORCE) & GRANTS
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_tbl TEXT;
BEGIN
  FOREACH v_tbl IN ARRAY ARRAY[
    'accounts', 'sessions', 'account_otps',
    'categories', 'posts', 'post_media',
    'platform_categories', 'gaming_platforms',
    'conversations', 'messages', 'attachments',
    'ticket_categories', 'ticket_priorities', 'tickets',
    'contact_inquiries', 'contact_inquiry_replies', 'audit_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_tbl);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', v_tbl);
  END LOOP;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Public Read-Only Grants (anon + authenticated) for public storefront/blog/catalog
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT SELECT ON public.posts TO anon, authenticated;
GRANT SELECT ON public.post_media TO anon, authenticated;
GRANT SELECT ON public.platform_categories TO anon, authenticated;
GRANT SELECT ON public.gaming_platforms TO anon, authenticated;
GRANT SELECT ON public.ticket_categories TO anon, authenticated;
GRANT SELECT ON public.ticket_priorities TO anon, authenticated;

-- Guest Contact Form Submission Grant (strictly constrained by RLS WITH CHECK below)
GRANT INSERT ON public.contact_inquiries TO anon, authenticated;

-- Least-Privilege Grants for authenticated role
GRANT SELECT, UPDATE ON public.accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_media TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gaming_platforms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.messages TO authenticated;
GRANT SELECT, INSERT ON public.attachments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_priorities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_inquiries TO authenticated;
GRANT SELECT, INSERT ON public.contact_inquiry_replies TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;

-- Explicit service_role full-access policies across all tables (supports FORCE RLS)
DO $$
DECLARE
  v_tbl TEXT;
BEGIN
  FOREACH v_tbl IN ARRAY ARRAY[
    'accounts', 'sessions', 'account_otps',
    'categories', 'posts', 'post_media',
    'platform_categories', 'gaming_platforms',
    'conversations', 'messages', 'attachments',
    'ticket_categories', 'ticket_priorities', 'tickets',
    'contact_inquiries', 'contact_inquiry_replies', 'audit_logs'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "service_role_full_access_%I" ON public.%I', v_tbl, v_tbl);
    EXECUTE format(
      'CREATE POLICY "service_role_full_access_%I" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      v_tbl, v_tbl
    );
  END LOOP;
END $$;

-- Accounts Policies
DROP POLICY IF EXISTS "accounts_select_self_or_staff" ON public.accounts;
CREATE POLICY "accounts_select_self_or_staff"
  ON public.accounts FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.get_auth_role() IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "accounts_update_self_safe" ON public.accounts;
CREATE POLICY "accounts_update_self_safe"
  ON public.accounts FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT a.role FROM public.accounts a WHERE a.id = auth.uid())
    AND account_status = (SELECT a.account_status FROM public.accounts a WHERE a.id = auth.uid())
  );

DROP POLICY IF EXISTS "accounts_super_admin_all" ON public.accounts;
CREATE POLICY "accounts_super_admin_all"
  ON public.accounts FOR ALL
  TO authenticated
  USING (public.get_auth_role() = 'super_admin')
  WITH CHECK (public.get_auth_role() = 'super_admin');

-- Categories Policies
DROP POLICY IF EXISTS "categories_select_public" ON public.categories;
CREATE POLICY "categories_select_public"
  ON public.categories FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "categories_staff_manage" ON public.categories;
CREATE POLICY "categories_staff_manage"
  ON public.categories FOR ALL
  TO authenticated
  USING (public.get_auth_role() IN ('admin', 'super_admin'))
  WITH CHECK (public.get_auth_role() IN ('admin', 'super_admin'));

-- Posts Policies
DROP POLICY IF EXISTS "posts_select_published" ON public.posts;
CREATE POLICY "posts_select_published"
  ON public.posts FOR SELECT
  TO anon, authenticated
  USING (
    (status = 'published' AND (published_at IS NULL OR published_at <= timezone('utc', now())))
    OR (auth.uid() IS NOT NULL AND public.get_auth_role() IN ('admin', 'super_admin'))
  );

DROP POLICY IF EXISTS "posts_staff_write" ON public.posts;
CREATE POLICY "posts_staff_write"
  ON public.posts FOR INSERT
  TO authenticated
  WITH CHECK (public.get_auth_role() IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "posts_staff_update" ON public.posts;
CREATE POLICY "posts_staff_update"
  ON public.posts FOR UPDATE
  TO authenticated
  USING (public.get_auth_role() IN ('admin', 'super_admin'))
  WITH CHECK (public.get_auth_role() IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "posts_staff_delete" ON public.posts;
CREATE POLICY "posts_staff_delete"
  ON public.posts FOR DELETE
  TO authenticated
  USING (public.get_auth_role() = 'super_admin' OR (author_id = auth.uid() AND public.get_auth_role() = 'admin'));

-- Post Media Policies
DROP POLICY IF EXISTS "post_media_select" ON public.post_media;
CREATE POLICY "post_media_select"
  ON public.post_media FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.posts
      WHERE posts.id = post_media.post_id
        AND (
          (posts.status = 'published' AND (posts.published_at IS NULL OR posts.published_at <= timezone('utc', now())))
          OR (auth.uid() IS NOT NULL AND public.get_auth_role() IN ('admin', 'super_admin'))
        )
    )
  );

DROP POLICY IF EXISTS "post_media_staff_write" ON public.post_media;
CREATE POLICY "post_media_staff_write"
  ON public.post_media FOR ALL
  TO authenticated
  USING (public.get_auth_role() IN ('admin', 'super_admin'))
  WITH CHECK (public.get_auth_role() IN ('admin', 'super_admin'));

-- Platform Categories Policies
DROP POLICY IF EXISTS "platform_categories_select_public" ON public.platform_categories;
CREATE POLICY "platform_categories_select_public"
  ON public.platform_categories FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "platform_categories_staff_manage" ON public.platform_categories;
CREATE POLICY "platform_categories_staff_manage"
  ON public.platform_categories FOR ALL
  TO authenticated
  USING (public.get_auth_role() IN ('admin', 'super_admin'))
  WITH CHECK (public.get_auth_role() IN ('admin', 'super_admin'));

-- Gaming Platforms Policies
DROP POLICY IF EXISTS "gaming_platforms_select_public" ON public.gaming_platforms;
CREATE POLICY "gaming_platforms_select_public"
  ON public.gaming_platforms FOR SELECT
  TO anon, authenticated
  USING (is_active = true OR public.get_auth_role() IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "gaming_platforms_staff_manage" ON public.gaming_platforms;
CREATE POLICY "gaming_platforms_staff_manage"
  ON public.gaming_platforms FOR ALL
  TO authenticated
  USING (public.get_auth_role() IN ('admin', 'super_admin'))
  WITH CHECK (public.get_auth_role() IN ('admin', 'super_admin'));

-- Conversations Policies (Unified Staff Access — No Assigned Admin Restrictions)
DROP POLICY IF EXISTS "conversations_select" ON public.conversations;
CREATE POLICY "conversations_select"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (
    customer_id = auth.uid()
    OR public.get_auth_role() IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS "conversations_insert_customer" ON public.conversations;
CREATE POLICY "conversations_insert_customer"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "conversations_update" ON public.conversations;
CREATE POLICY "conversations_update"
  ON public.conversations FOR UPDATE
  TO authenticated
  USING (
    customer_id = auth.uid()
    OR public.get_auth_role() IN ('admin', 'super_admin')
  )
  WITH CHECK (
    customer_id = auth.uid()
    OR public.get_auth_role() IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS "conversations_delete_super_admin" ON public.conversations;
CREATE POLICY "conversations_delete_super_admin"
  ON public.conversations FOR DELETE
  TO authenticated
  USING (public.get_auth_role() = 'super_admin');

-- Messages Policies (Unified Staff Access — No Assigned Admin Restrictions)
DROP POLICY IF EXISTS "messages_select" ON public.messages;
CREATE POLICY "messages_select"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    conversation_id IN (SELECT id FROM public.conversations WHERE customer_id = auth.uid())
    OR public.get_auth_role() IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS "messages_insert" ON public.messages;
CREATE POLICY "messages_insert"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      conversation_id IN (SELECT id FROM public.conversations WHERE customer_id = auth.uid())
      OR public.get_auth_role() IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "messages_super_admin_delete" ON public.messages;
CREATE POLICY "messages_super_admin_delete"
  ON public.messages FOR DELETE
  TO authenticated
  USING (public.get_auth_role() = 'super_admin');

-- Attachments Policies (Unified Staff Access — No Assigned Admin Restrictions)
DROP POLICY IF EXISTS "attachments_select" ON public.attachments;
CREATE POLICY "attachments_select"
  ON public.attachments FOR SELECT
  TO authenticated
  USING (
    conversation_id IN (SELECT id FROM public.conversations WHERE customer_id = auth.uid())
    OR public.get_auth_role() IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS "attachments_insert" ON public.attachments;
CREATE POLICY "attachments_insert"
  ON public.attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    conversation_id IN (SELECT id FROM public.conversations WHERE customer_id = auth.uid())
    OR public.get_auth_role() IN ('admin', 'super_admin')
  );

-- Ticket Categories & Priorities Policies
DROP POLICY IF EXISTS "ticket_categories_select_all" ON public.ticket_categories;
CREATE POLICY "ticket_categories_select_all"
  ON public.ticket_categories FOR SELECT
  TO anon, authenticated
  USING (is_active = true OR public.get_auth_role() IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "ticket_categories_super_admin_manage" ON public.ticket_categories;
CREATE POLICY "ticket_categories_super_admin_manage"
  ON public.ticket_categories FOR ALL
  TO authenticated
  USING (public.get_auth_role() = 'super_admin')
  WITH CHECK (public.get_auth_role() = 'super_admin');

DROP POLICY IF EXISTS "ticket_priorities_select_all" ON public.ticket_priorities;
CREATE POLICY "ticket_priorities_select_all"
  ON public.ticket_priorities FOR SELECT
  TO anon, authenticated
  USING (is_active = true OR public.get_auth_role() IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "ticket_priorities_super_admin_manage" ON public.ticket_priorities;
CREATE POLICY "ticket_priorities_super_admin_manage"
  ON public.ticket_priorities FOR ALL
  TO authenticated
  USING (public.get_auth_role() = 'super_admin')
  WITH CHECK (public.get_auth_role() = 'super_admin');

-- Tickets Policies
DROP POLICY IF EXISTS "tickets_customer_select" ON public.tickets;
CREATE POLICY "tickets_customer_select"
  ON public.tickets FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid() OR public.get_auth_role() IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "tickets_customer_insert" ON public.tickets;
CREATE POLICY "tickets_customer_insert"
  ON public.tickets FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "tickets_update" ON public.tickets;
CREATE POLICY "tickets_update"
  ON public.tickets FOR UPDATE
  TO authenticated
  USING (customer_id = auth.uid() OR public.get_auth_role() IN ('admin', 'super_admin'))
  WITH CHECK (customer_id = auth.uid() OR public.get_auth_role() IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "tickets_super_admin_delete" ON public.tickets;
CREATE POLICY "tickets_super_admin_delete"
  ON public.tickets FOR DELETE
  TO authenticated
  USING (public.get_auth_role() = 'super_admin');

-- Contact Inquiries & Replies Policies
DROP POLICY IF EXISTS "contact_inquiries_insert_public" ON public.contact_inquiries;
CREATE POLICY "contact_inquiries_insert_public"
  ON public.contact_inquiries FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'new'
    AND replied_at IS NULL
    AND closed_at IS NULL
    AND length(trim(email)) BETWEEN 5 AND 254
    AND length(trim(phone)) BETWEEN 5 AND 40
    AND length(trim(message)) BETWEEN 10 AND 5000
  );

DROP POLICY IF EXISTS "contact_inquiries_staff_select" ON public.contact_inquiries;
CREATE POLICY "contact_inquiries_staff_select"
  ON public.contact_inquiries FOR SELECT
  TO authenticated
  USING (public.get_auth_role() IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "contact_inquiries_staff_update" ON public.contact_inquiries;
CREATE POLICY "contact_inquiries_staff_update"
  ON public.contact_inquiries FOR UPDATE
  TO authenticated
  USING (public.get_auth_role() IN ('admin', 'super_admin'))
  WITH CHECK (public.get_auth_role() IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "contact_inquiries_super_admin_delete" ON public.contact_inquiries;
CREATE POLICY "contact_inquiries_super_admin_delete"
  ON public.contact_inquiries FOR DELETE
  TO authenticated
  USING (public.get_auth_role() = 'super_admin');

DROP POLICY IF EXISTS "inquiry_replies_staff_select" ON public.contact_inquiry_replies;
CREATE POLICY "inquiry_replies_staff_select"
  ON public.contact_inquiry_replies FOR SELECT
  TO authenticated
  USING (public.get_auth_role() IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "inquiry_replies_staff_insert" ON public.contact_inquiry_replies;
CREATE POLICY "inquiry_replies_staff_insert"
  ON public.contact_inquiry_replies FOR INSERT
  TO authenticated
  WITH CHECK (
    admin_id = auth.uid()
    AND public.get_auth_role() IN ('admin', 'super_admin')
  );

-- Audit Logs Policies
DROP POLICY IF EXISTS "audit_logs_super_admin_select" ON public.audit_logs;
CREATE POLICY "audit_logs_super_admin_select"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.get_auth_role() = 'super_admin');

DROP POLICY IF EXISTS "audit_logs_authenticated_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_authenticated_insert"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 10. SUPABASE STORAGE BUCKETS & HARDENED MEDIA OBJECT POLICIES
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES
    (
      'public-media',
      'public-media',
      true,
      26214400, -- 25 MB hard cap at Storage Engine level
      ARRAY[
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/avif',
        'image/gif',
        'video/mp4',
        'video/webm',
        'video/quicktime',
        'audio/webm',
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/ogg',
        'audio/mp4',
        'application/pdf',
        'text/plain'
      ]
    ),
    (
      'draft-media',
      'draft-media',
      false,
      10485760, -- 10 MB hard cap for private CMS drafts
      ARRAY[
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/avif'
      ]
    )
  ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
$$;

DO $$
BEGIN
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
$$;

DROP POLICY IF EXISTS "storage_service_role_all" ON storage.objects;
CREATE POLICY "storage_service_role_all"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id IN ('public-media', 'draft-media'))
  WITH CHECK (
    bucket_id IN ('public-media', 'draft-media')
    AND name NOT LIKE '%..%'
  );

DROP POLICY IF EXISTS "storage_staff_upload" ON storage.objects;
CREATE POLICY "storage_staff_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id IN ('public-media', 'draft-media')
    AND name NOT LIKE '%..%'
    AND (storage.foldername(name))[1] IN ('posts', 'docs', 'chats', 'tickets', 'platforms')
    AND public.get_auth_role() IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS "storage_staff_update" ON storage.objects;
CREATE POLICY "storage_staff_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id IN ('public-media', 'draft-media')
    AND public.get_auth_role() IN ('admin', 'super_admin')
  )
  WITH CHECK (
    bucket_id IN ('public-media', 'draft-media')
    AND name NOT LIKE '%..%'
    AND public.get_auth_role() IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS "storage_staff_delete" ON storage.objects;
CREATE POLICY "storage_staff_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id IN ('public-media', 'draft-media')
    AND public.get_auth_role() IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS "storage_public_media_read" ON storage.objects;
CREATE POLICY "storage_public_media_read"
  ON storage.objects FOR SELECT
  TO public
  USING (
    bucket_id = 'public-media'
    AND name NOT LIKE '%..%'
  );

DROP POLICY IF EXISTS "storage_draft_media_staff_read" ON storage.objects;
CREATE POLICY "storage_draft_media_staff_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'draft-media'
    AND public.get_auth_role() IN ('admin', 'super_admin')
  );

-- ------------------------------------------------------------------------------
-- 11. SUPABASE REALTIME PUBLICATIONS & PRIVATE CHANNEL AUTHORIZATION
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['messages', 'conversations', 'tickets']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = v_table
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
    END IF;
  END LOOP;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'realtime' AND tablename = 'messages') THEN
    EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE realtime.messages FROM PUBLIC, anon';
    EXECUTE 'GRANT ALL ON TABLE realtime.messages TO service_role';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
$$;

DROP POLICY IF EXISTS "realtime_service_role_all" ON realtime.messages;
CREATE POLICY "realtime_service_role_all"
  ON realtime.messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "realtime_conversation_select" ON realtime.messages;
CREATE POLICY "realtime_conversation_select"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.messages.extension IN ('broadcast', 'presence')
    AND (realtime.topic() LIKE 'chat:%' OR realtime.topic() LIKE 'conversation:%')
    AND (
      EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.customer_id = auth.uid()
          AND (
            'chat:' || c.id::text = realtime.topic()
            OR 'conversation:' || c.id::text = realtime.topic()
          )
      )
      OR public.get_auth_role() IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "realtime_conversation_insert" ON realtime.messages;
CREATE POLICY "realtime_conversation_insert"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    realtime.messages.extension = 'broadcast'
    AND (realtime.topic() LIKE 'chat:%' OR realtime.topic() LIKE 'conversation:%')
    AND (
      EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.customer_id = auth.uid()
          AND (
            'chat:' || c.id::text = realtime.topic()
            OR 'conversation:' || c.id::text = realtime.topic()
          )
      )
      OR public.get_auth_role() IN ('admin', 'super_admin')
    )
  );
