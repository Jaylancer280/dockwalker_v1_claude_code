/**
 * Integration tests: Vessels RLS policies (migration 00074).
 *
 * Tests verify that non-owner authenticated users can read vessels
 * through the new SELECT policies, while NDA restrictions hold.
 *
 * Prerequisites:
 *   - Local Supabase running (`npx supabase start`)
 *   - Database reset with seed data (`npx supabase db reset`)
 *
 * Run:
 *   npm run test:integration   (from apps/web)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

// Seed data IDs
const EMPLOYER_ID = '11111111-1111-1111-1111-111111111111'; // owns vessels
const CREW_ID = '22222222-2222-2222-2222-222222222222'; // has experience on NDA vessel
const CREW2_ID = '77777777-7777-7777-7777-777777777777'; // no engagement or experience on NDA vessel
const VESSEL_SERENITY = '33333333-3333-3333-3333-333333333333'; // non-NDA, owned by employer
const VESSEL_PHANTOM = '33333333-3333-3333-3333-333333333334'; // NDA, owned by employer
const VESSEL_WANDERER = '33333333-3333-3333-3333-333333333335'; // non-NDA, owned by crew

// Authenticated clients (signed in as specific users)
let crewClient: SupabaseClient;
let crew2Client: SupabaseClient;
let employerClient: SupabaseClient;

async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`);
  return client;
}

beforeAll(async () => {
  [crewClient, crew2Client, employerClient] = await Promise.all([
    signIn('c@1', '87654321'),
    signIn('g@1', '87654321'),
    signIn('e@1', '87654321'),
  ]);
});

// ===========================================================================
// 1. Non-owner can read non-NDA vessels
// ===========================================================================
describe('Non-NDA vessel access', () => {
  it('crew can read a non-NDA vessel owned by employer', async () => {
    const { data, error } = await crewClient
      .from('vessels')
      .select('id, name, vessel_type, nda_flag')
      .eq('id', VESSEL_SERENITY)
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.name).toBe('Serenity');
    expect(data!.nda_flag).toBe(false);
  });

  it('crew2 can read a non-NDA vessel they do not own', async () => {
    const { data, error } = await crew2Client
      .from('vessels')
      .select('id, name')
      .eq('id', VESSEL_WANDERER)
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.name).toBe('Wanderer');
  });
});

// ===========================================================================
// 2. Non-owner CANNOT read NDA vessel without engagement or experience
// ===========================================================================
describe('NDA vessel restrictions', () => {
  it('crew2 (no engagement, no experience) cannot read NDA vessel', async () => {
    const { data, error } = await crew2Client
      .from('vessels')
      .select('id, name')
      .eq('id', VESSEL_PHANTOM)
      .maybeSingle();

    // RLS blocks access — either null data or PGRST116
    expect(data).toBeNull();
  });
});

// ===========================================================================
// 3. Crew with experience entry CAN read NDA vessel
// ===========================================================================
describe('NDA vessel access via experience', () => {
  it('crew with experience on NDA vessel can read it', async () => {
    const { data, error } = await crewClient
      .from('vessels')
      .select('id, name, vessel_type')
      .eq('id', VESSEL_PHANTOM)
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.name).toBe('Phantom');
  });
});

// ===========================================================================
// 4. Owner still has full access (existing policy preserved)
// ===========================================================================
describe('Owner access preserved', () => {
  it('employer can read their own NDA vessel', async () => {
    const { data, error } = await employerClient
      .from('vessels')
      .select('id, name, imo_number, nda_flag')
      .eq('id', VESSEL_PHANTOM)
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.name).toBe('Phantom');
    expect(data!.nda_flag).toBe(true);
    expect(data!.imo_number).toBeTruthy();
  });
});

// ===========================================================================
// 5. Embedded PostgREST joins work for non-owners (the actual bug)
// ===========================================================================
describe('PostgREST embedded vessel joins', () => {
  it('crew can read crew_experiences with embedded vessel data', async () => {
    const { data, error } = await crewClient
      .from('crew_experiences')
      .select('id, vessels(name, vessel_type)')
      .eq('person_id', CREW_ID)
      .limit(3);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    // At least one experience should have vessel data resolved
    const withVessel = data!.find(
      (e: Record<string, unknown>) => e.vessels !== null,
    );
    expect(withVessel).toBeDefined();
  });
});
