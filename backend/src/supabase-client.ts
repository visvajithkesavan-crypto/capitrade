/**
 * supabase-client.ts  (backend)
 *
 * Initialises a single Supabase client with the SERVICE ROLE key for use in
 * server-side code that bypasses Row-Level Security (RLS).
 *
 * Required environment variables:
 *   SUPABASE_URL          — e.g. https://xyzabc.supabase.co
 *   SUPABASE_SERVICE_KEY  — service_role key (keep secret, never expose to client)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Replace this with the output of `npx supabase gen types typescript` for full type safety.
 * For now we use a generic Record shape so the rest of the codebase compiles without
 * a generated types file.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Database = any;

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error(
    'Missing Supabase configuration. ' +
    'Ensure SUPABASE_URL and SUPABASE_SERVICE_KEY are set in your environment.'
  );
}

/**
 * Backend Supabase client (service role).
 * Use this for all server-side database operations.
 */
export const supabase: SupabaseClient<Database> = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  {
    auth: {
      // Disable automatic session management on the backend
      autoRefreshToken:  false,
      persistSession:    false,
      detectSessionInUrl: false,
    },
  }
);
