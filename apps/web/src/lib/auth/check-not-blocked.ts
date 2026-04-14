import type { SupabaseClient } from '@supabase/supabase-js';

export async function checkNotBlocked(
  personId: string,
  supabase: SupabaseClient,
): Promise<{ blocked: boolean }> {
  const { data, error } = await supabase
    .from('persons')
    .select('blocked_at')
    .eq('id', personId)
    .single();

  if (error || !data) return { blocked: false };
  return { blocked: data.blocked_at !== null };
}
