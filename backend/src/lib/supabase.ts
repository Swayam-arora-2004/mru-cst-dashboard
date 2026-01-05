import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';

let supabase: SupabaseClient | null = null;
let supabaseAdmin: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient => {
  if (!supabase) {
    supabase = createClient(config.supabase.url, config.supabase.anonKey);
  }
  return supabase;
};

export const getSupabaseAdminClient = (): SupabaseClient => {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
  return supabaseAdmin;
};

export { supabase, supabaseAdmin };
