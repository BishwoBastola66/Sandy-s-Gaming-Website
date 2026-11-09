import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

const DEFAULT_SUPABASE_URL = 'https://mreswugnlozzxbkwihqr.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZXN3dWdubG96enhia3dpaHFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyODUxMDMsImV4cCI6MjEwODg2MTEwM30.Nfi-MNSibIBT0kUJ3QZ_DzUUAt1cF9EeVcScLOMaeRM';

export function createClient() {
  if (client) return client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

  client = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  return client;
}

