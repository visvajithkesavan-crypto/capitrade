/**
 * lib/supabase.ts  (frontend)
 *
 * Browser-safe Supabase client initialised with the public anon key.
 * Row-Level Security (RLS) policies in the database restrict data access.
 *
 * Required environment variables (Next.js):
 *   NEXT_PUBLIC_SUPABASE_URL       — e.g. https://xyzabc.supabase.co
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY  — public anon key (safe to expose in browser)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase configuration. ' +
    'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.'
  );
}

/**
 * Singleton browser-safe Supabase client.
 * Import this wherever you need to interact with Supabase from the frontend.
 *
 * @example
 * import { supabase } from '@/lib/supabase';
 * const { data } = await supabase.from('trades').select('*');
 */
export const supabase: SupabaseClient<Database> = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      // Store the session in localStorage so it persists across page reloads
      persistSession:    true,
      autoRefreshToken:  true,
      detectSessionInUrl: true,
    },
  }
);
