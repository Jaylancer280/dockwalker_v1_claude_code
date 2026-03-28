import { createClient as supabaseCreateClient, SupabaseClient } from '@supabase/supabase-js';

export type { SupabaseClient };

/** Browser/client-side Supabase client (uses anon key) */
export function createClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  return supabaseCreateClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Mobile Supabase client — accepts explicit params and a storage adapter
 * for session persistence (e.g. expo-secure-store or AsyncStorage).
 */
export function createMobileClient(
  url: string,
  anonKey: string,
  storage: {
    getItem: (key: string) => string | null | Promise<string | null>;
    setItem: (key: string, value: string) => void | Promise<void>;
    removeItem: (key: string) => void | Promise<void>;
  }
): SupabaseClient {
  return supabaseCreateClient(url, anonKey, {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

/** Server-side Supabase client (uses service role key for projection writes) */
export function createServiceClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return supabaseCreateClient(supabaseUrl, serviceKey);
}
