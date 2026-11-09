# ApexPublish & Multi-Admin Customer Support Platform

A modern, production-oriented web platform built with Next.js (App Router), Supabase (PostgreSQL, Auth, Realtime, Storage), TypeScript, and Tailwind CSS.

---

## 1. System Overview

The platform unifies two core capabilities:
- **Public Content Publishing Platform:** Multi-format CMS for blogs, posters, and photo galleries with draft/publishing workflows and CDN media storage.
- **Dual-Channel Customer Support Platform:**
  - **Authenticated Multi-Admin Live Chat:** Real-time customer chat where multiple assigned admins participate simultaneously in a shared conversation, presenting a unified "Support Team" persona to customers while preserving internal staff attribution.
  - **Guest Contact Us System:** Public inquiry workflow for unauthenticated visitors routing to an admin inbox with transactional email replies.

---

## 2. Prerequisites & Environment Setup

- **Node.js:** `v20+` or `v24+`
- **npm:** `v10+` or `v11+`
- **Supabase Project:** Free or Pro tier project at [supabase.com](https://supabase.com)

### Environment Configuration
1. Copy the environment template:
   ```bash
   cp .env.example .env.local
   ```
2. Populate the required environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project URL.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase Anonymous Public API Key (safe for browser).
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase Service Role Key (**SECRET: Server-Side ONLY**).
   - `NEXT_PUBLIC_SITE_URL`: Application URL (e.g. `http://localhost:3000`).
   - `EMAIL_PROVIDER`: Transactional email provider (`resend`, `sendgrid`, or `mock`).
   - `EMAIL_API_KEY`: API Key for transactional email provider.
   - `EMAIL_FROM_ADDRESS`: Verified sending email address.
   - `NEXT_PUBLIC_AUTH_OTP_CHANNEL`: `email` (default) or `sms`.

> [!CAUTION]
> Never commit `.env.local` or any files containing live credentials to Git. `.gitignore` is configured to exclude all real environment files.

---

## 3. Local Development Commands

### Safe Commands (Everyday Development & Verification)
- **Start Development Server:**
  ```bash
  npm run dev
  ```
  Starts Next.js dev server at [http://localhost:3000](http://localhost:3000).
- **Run TypeScript Type Check:**
  ```bash
  npm run type-check
  ```
- **Run Linter:**
  ```bash
  npm run lint
  ```
- **Build Production Bundle:**
  ```bash
  npm run build
  ```
- **Start Production Server (after build):**
  ```bash
  npm run start
  ```

### Potentially Destructive / State-Changing Commands
- `npx supabase db reset` (Destructive: Drops local database and reruns all migrations from scratch).
- `git clean -fdx` (Destructive: Deletes all untracked files and node_modules).
- `UPDATE public.profiles SET role = ...` (Privileged: Changes user role in database).

---

## 4. Project Directory Structure

```
├── docs/                 # Architectural specifications, ER diagrams, RLS matrix, and roadmap
├── public/               # Static assets (images, icons)
├── src/
│   ├── app/              # Next.js App Router (pages, layouts, route handlers)
│   ├── components/       # Reusable UI components (navigation, layout, chat, forms)
│   ├── lib/
│   │   ├── supabase/     # Browser and server Supabase clients (client.ts, server.ts, middleware.ts)
│   │   ├── validation/   # Zod validation schemas
│   │   └── utils/        # Shared helper functions
│   ├── types/            # TypeScript database definitions and domain interfaces
│   └── middleware.ts     # Root Next.js session refresh middleware
├── supabase/             # SQL migrations (001-007) and config
├── .env.example          # Environment variables template
├── .gitignore            # Git exclusion rules for secrets and build output
└── package.json          # Project dependencies and npm scripts
```
