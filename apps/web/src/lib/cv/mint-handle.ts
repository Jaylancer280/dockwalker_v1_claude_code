import type { SupabaseClient } from '@supabase/supabase-js';

const HANDLE_LENGTH = 8;
const HANDLE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const MAX_RETRIES = 5;
const PG_UNIQUE_VIOLATION = '23505';

export function randomHandle(length = HANDLE_LENGTH): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += HANDLE_ALPHABET[bytes[i] % HANDLE_ALPHABET.length];
  }
  return out;
}

export class MintHandleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MintHandleError';
  }
}

/**
 * Mint a fresh cv_handle for a person. Generates an 8-char alphanumeric
 * candidate and writes it to profiles.cv_handle. The column is UNIQUE so
 * a collision raises Postgres unique_violation (23505); we retry up to 5
 * times before giving up.
 *
 * Used by:
 *   - Phase 2 admin mint-handle route (Stage-1 QA)
 *   - /api/cv/generate first-call path (Stage 2)
 *   - /api/cv/regenerate-handle (Stage 2)
 *
 * Caller is responsible for the surrounding event ledger write
 * (CV.HANDLE_REGENERATED). This helper just owns the UPDATE-with-retry.
 */
export async function mintHandle(supabase: SupabaseClient, personId: string): Promise<string> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const candidate = randomHandle();
    const { error } = await supabase
      .from('profiles')
      .update({
        cv_handle: candidate,
        cv_handle_updated_at: new Date().toISOString(),
      })
      .eq('person_id', personId);

    if (!error) return candidate;
    if (error.code !== PG_UNIQUE_VIOLATION) throw error;
    // unique_violation — try again with a fresh candidate.
  }
  throw new MintHandleError(
    `cv_handle minting exhausted retry budget (${MAX_RETRIES}) for person ${personId}`,
  );
}
