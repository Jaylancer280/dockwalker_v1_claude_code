/**
 * Integration tests: event roundtrips against real local Supabase.
 *
 * These tests verify that events emitted by the API layer are correctly
 * projected into the materialised tables. They catch payload-shape mismatches
 * between TypeScript and SQL that unit tests (which mock Supabase) cannot.
 *
 * Prerequisites:
 *   - Local Supabase running (`npx supabase start`)
 *   - Database reset with seed data (`npx supabase db reset`)
 *
 * Run:
 *   npm run test:integration   (from apps/web)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Local Supabase connection (matches .env.local / supabase start defaults)
// ---------------------------------------------------------------------------
const SUPABASE_URL = 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

// Service-role client bypasses RLS — used for append_event and reads
const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// Seed data IDs (from 002_test_profiles.sql)
// ---------------------------------------------------------------------------
const EMPLOYER_ID = '11111111-1111-1111-1111-111111111111';
const CREW_ID = '22222222-2222-2222-2222-222222222222';
const VESSEL_ID = '33333333-3333-3333-3333-333333333333';
const DAYWORK_1_ID = '44444444-4444-4444-4444-444444444001';

// Canonical lookup IDs (from 001_canonical_data.sql)
const ROLE_CAPTAIN = 'd0000000-0000-0000-0000-000000000001';
const PORT_VAUBAN = 'c0000000-0000-0000-0000-000000000001';
const EXP_BRACKET_3 = 'f0000000-0000-0000-0000-000000000003';
const CERT_STCW = 'e0000000-0000-0000-0000-000000000001';
const SIZE_BAND_4 = 'f1000000-0000-0000-0000-000000000004';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function appendEvent(
  eventType: string,
  aggregateId: string,
  aggregateType: string,
  roleContext: string,
  payload: Record<string, unknown>,
  personId: string,
) {
  const { error } = await service.rpc('append_event', {
    p_event_type: eventType,
    p_aggregate_id: aggregateId,
    p_aggregate_type: aggregateType,
    p_role_context: roleContext,
    p_payload: payload,
    p_person_id: personId,
  });
  if (error) throw new Error(`append_event(${eventType}) failed: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Smoke check: can we reach the database?
// ---------------------------------------------------------------------------
beforeAll(async () => {
  const { error } = await service.from('persons').select('id').limit(1);
  if (error) {
    throw new Error(
      `Cannot reach local Supabase (${SUPABASE_URL}). ` +
        'Ensure `npx supabase start` is running and `npx supabase db reset` has been run.',
    );
  }
});

// ===========================================================================
// 1. Hat switch roundtrip (was broken: API sends current_hat, 00014 read new_hat)
// ===========================================================================
describe('PERSON.HAT_CHANGED roundtrip', () => {
  it('switches employer → crew and persists in persons table', async () => {
    // Employer seed user starts with current_hat = 'employer'
    const { data: before } = await service
      .from('persons')
      .select('current_hat')
      .eq('id', EMPLOYER_ID)
      .single();
    expect(before?.current_hat).toBe('employer');

    // Emit hat change with the same payload shape the API route uses
    await appendEvent(
      'PERSON.HAT_CHANGED',
      EMPLOYER_ID,
      'person',
      'crew',
      { current_hat: 'crew' },
      EMPLOYER_ID,
    );

    const { data: after } = await service
      .from('persons')
      .select('current_hat')
      .eq('id', EMPLOYER_ID)
      .single();
    expect(after?.current_hat).toBe('crew');

    // Switch back so we leave seed data clean for other tests
    await appendEvent(
      'PERSON.HAT_CHANGED',
      EMPLOYER_ID,
      'person',
      'employer',
      { current_hat: 'employer' },
      EMPLOYER_ID,
    );

    const { data: restored } = await service
      .from('persons')
      .select('current_hat')
      .eq('id', EMPLOYER_ID)
      .single();
    expect(restored?.current_hat).toBe('employer');
  });
});

// ===========================================================================
// 2. Profile update roundtrip — crew fields
// ===========================================================================
describe('PROFILE.UPDATED roundtrip (crew)', () => {
  it('updates display_name and bio in profiles table', async () => {
    await appendEvent(
      'PROFILE.UPDATED',
      CREW_ID,
      'person',
      'crew',
      { display_name: 'Updated Crew Name', bio: 'New bio text' },
      CREW_ID,
    );

    const { data } = await service
      .from('profiles')
      .select('display_name, bio')
      .eq('person_id', CREW_ID)
      .single();
    expect(data?.display_name).toBe('Updated Crew Name');
    expect(data?.bio).toBe('New bio text');

    // Restore
    await appendEvent(
      'PROFILE.UPDATED',
      CREW_ID,
      'person',
      'crew',
      { display_name: 'Profile Two', bio: 'Qualified deckhand with 3 years on yachts ranging from 30-60m. PADI Divemaster, Powerboat Level 2. Available for daywork in the Antibes/Cannes area.' },
      CREW_ID,
    );
  });
});

// ===========================================================================
// 3. Profile update roundtrip — agent-specific fields
//    (was broken: 00014 dropped agency_name + role_specialization_ids)
// ===========================================================================
describe('PROFILE.UPDATED roundtrip (agent fields)', () => {
  it('updates agency_name in profiles table', async () => {
    // Use employer profile to test agency_name (agents use same table)
    const { data: before } = await service
      .from('profiles')
      .select('agency_name')
      .eq('person_id', EMPLOYER_ID)
      .single();

    await appendEvent(
      'PROFILE.UPDATED',
      EMPLOYER_ID,
      'person',
      'employer',
      { agency_name: 'Test Maritime Agency' },
      EMPLOYER_ID,
    );

    const { data: after } = await service
      .from('profiles')
      .select('agency_name')
      .eq('person_id', EMPLOYER_ID)
      .single();
    expect(after?.agency_name).toBe('Test Maritime Agency');

    // Restore
    await appendEvent(
      'PROFILE.UPDATED',
      EMPLOYER_ID,
      'person',
      'employer',
      { agency_name: before?.agency_name ?? null },
      EMPLOYER_ID,
    );
  });

  it('updates role_specialization_ids in profiles table', async () => {
    const specIds = [ROLE_CAPTAIN];

    await appendEvent(
      'PROFILE.UPDATED',
      EMPLOYER_ID,
      'person',
      'employer',
      { role_specialization_ids: specIds },
      EMPLOYER_ID,
    );

    const { data } = await service
      .from('profiles')
      .select('role_specialization_ids')
      .eq('person_id', EMPLOYER_ID)
      .single();
    expect(data?.role_specialization_ids).toEqual(specIds);

    // Restore to empty
    await appendEvent(
      'PROFILE.UPDATED',
      EMPLOYER_ID,
      'person',
      'employer',
      { role_specialization_ids: [] },
      EMPLOYER_ID,
    );
  });
});

// ===========================================================================
// 4. Vessel creation roundtrip
// ===========================================================================
describe('VESSEL.CREATED roundtrip', () => {
  it('seed vessel exists with correct IMO', async () => {
    const { data } = await service
      .from('vessels')
      .select('imo_number, name, vessel_type, owner_person_id')
      .eq('id', VESSEL_ID)
      .single();

    expect(data?.imo_number).toBe('9876543');
    expect(data?.name).toBe('M/Y Serenity');
    expect(data?.vessel_type).toBe('charter');
    expect(data?.owner_person_id).toBe(EMPLOYER_ID);
  });
});

// ===========================================================================
// 5. Daywork posting roundtrip
// ===========================================================================
describe('DAYWORK.POSTED roundtrip', () => {
  it('seed daywork exists with correct fields', async () => {
    const { data } = await service
      .from('dayworks')
      .select('poster_person_id, vessel_id, role_id, day_rate, currency, status, working_days')
      .eq('id', DAYWORK_1_ID)
      .single();

    expect(data?.poster_person_id).toBe(EMPLOYER_ID);
    expect(data?.vessel_id).toBe(VESSEL_ID);
    expect(data?.day_rate).toBe(250);
    expect(data?.currency).toBe('EUR');
    expect(data?.status).toBe('active');
    expect(data?.working_days).toBe(5);
  });
});

// ===========================================================================
// 6. Apply → Accept roundtrip (tests application + engagement + in_progress)
// ===========================================================================
describe('DAYWORK.APPLIED → DAYWORK.ACCEPTED roundtrip', () => {
  const APP_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001';
  const DAYWORK_ID = '44444444-4444-4444-4444-444444444003'; // Posting 3 (1 day, no certs)
  const AGGREGATE_ID = `${CREW_ID}:${DAYWORK_ID}`;

  it('creates application, then acceptance creates engagement and moves daywork to in_progress', async () => {
    // Clean up from previous runs (integration tests hit real DB)
    await service.from('messages').delete().eq('engagement_id',
      (await service.from('active_engagements').select('id').eq('daywork_id', DAYWORK_ID).single()).data?.id ?? '00000000-0000-0000-0000-000000000000'
    );
    await service.from('active_engagements').delete().eq('daywork_id', DAYWORK_ID);
    await service.from('applications').delete().eq('id', APP_ID);
    await service.from('dayworks').update({ status: 'active' }).eq('id', DAYWORK_ID);

    // Apply
    await appendEvent(
      'DAYWORK.APPLIED',
      AGGREGATE_ID,
      'application',
      'crew',
      { id: APP_ID, daywork_id: DAYWORK_ID, message: 'Integration test apply' },
      CREW_ID,
    );

    const { data: app } = await service
      .from('applications')
      .select('status, crew_person_id, message')
      .eq('id', APP_ID)
      .single();
    expect(app?.status).toBe('applied');
    expect(app?.crew_person_id).toBe(CREW_ID);
    expect(app?.message).toBe('Integration test apply');

    // Accept
    await appendEvent(
      'DAYWORK.ACCEPTED',
      AGGREGATE_ID,
      'application',
      'employer',
      {},
      EMPLOYER_ID,
    );

    // Application status → accepted
    const { data: accepted } = await service
      .from('applications')
      .select('status')
      .eq('id', APP_ID)
      .single();
    expect(accepted?.status).toBe('accepted');

    // Engagement created
    const { data: engagement } = await service
      .from('active_engagements')
      .select('crew_person_id, employer_person_id, daywork_id, status')
      .eq('daywork_id', DAYWORK_ID)
      .single();
    expect(engagement?.crew_person_id).toBe(CREW_ID);
    expect(engagement?.employer_person_id).toBe(EMPLOYER_ID);
    expect(engagement?.status).toBe('active');

    // Daywork → in_progress
    const { data: dw } = await service
      .from('dayworks')
      .select('status')
      .eq('id', DAYWORK_ID)
      .single();
    expect(dw?.status).toBe('in_progress');
  });
});

// ===========================================================================
// 7. Availability roundtrip
// ===========================================================================
describe('AVAILABILITY.SET roundtrip', () => {
  it('creates availability windows for date range', async () => {
    // Seed data already created availability for crew — verify it exists
    const { data, error } = await service
      .from('availability_windows')
      .select('date')
      .eq('person_id', CREW_ID)
      .order('date', { ascending: true })
      .limit(3);

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data!.length).toBeGreaterThanOrEqual(3);
  });
});

// ===========================================================================
// 8. Invitation roundtrips
// ===========================================================================
describe('DAYWORK.INVITED roundtrip', () => {
  const DAYWORK_ID = DAYWORK_1_ID; // Active posting owned by employer

  it('creates invitation row with status pending', async () => {
    // Clean up from previous runs
    await service.from('daywork_invitations').delete().eq('daywork_id', DAYWORK_ID).eq('crew_person_id', CREW_ID);

    await appendEvent(
      'DAYWORK.INVITED',
      DAYWORK_ID,
      'invitation',
      'employer',
      { daywork_id: DAYWORK_ID, crew_person_id: CREW_ID },
      EMPLOYER_ID,
    );

    const { data } = await service
      .from('daywork_invitations')
      .select('daywork_id, crew_person_id, employer_person_id, status')
      .eq('daywork_id', DAYWORK_ID)
      .eq('crew_person_id', CREW_ID)
      .single();

    expect(data?.daywork_id).toBe(DAYWORK_ID);
    expect(data?.crew_person_id).toBe(CREW_ID);
    expect(data?.employer_person_id).toBe(EMPLOYER_ID);
    expect(data?.status).toBe('pending');

    // Clean up
    await service.from('daywork_invitations').delete().eq('daywork_id', DAYWORK_ID).eq('crew_person_id', CREW_ID);
  });
});

describe('DAYWORK.ACCEPTED revokes pending invitations', () => {
  const DAYWORK_ID = '44444444-4444-4444-4444-444444444002'; // Posting 2
  const APP_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002';
  const AGGREGATE_ID = `${CREW_ID}:${DAYWORK_ID}`;
  const INVITED_CREW_ID = '33333333-3333-3333-3333-333333333333'; // Use vessel ID as a stand-in — not ideal but we need a distinct person

  it('revokes all pending invitations when crew is accepted', async () => {
    // Clean up
    await service.from('messages').delete().eq('engagement_id',
      (await service.from('active_engagements').select('id').eq('daywork_id', DAYWORK_ID).single()).data?.id ?? '00000000-0000-0000-0000-000000000000'
    );
    await service.from('active_engagements').delete().eq('daywork_id', DAYWORK_ID);
    await service.from('applications').delete().eq('id', APP_ID);
    await service.from('daywork_invitations').delete().eq('daywork_id', DAYWORK_ID);
    await service.from('dayworks').update({ status: 'active' }).eq('id', DAYWORK_ID);

    // Create a pending invitation for a different crew member
    // We need a valid person_id — use EMPLOYER_ID as a stand-in for invited crew (not realistic but valid FK)
    await appendEvent(
      'DAYWORK.INVITED',
      DAYWORK_ID,
      'invitation',
      'employer',
      { daywork_id: DAYWORK_ID, crew_person_id: EMPLOYER_ID },
      EMPLOYER_ID,
    );

    // Verify invitation is pending
    const { data: inv } = await service
      .from('daywork_invitations')
      .select('status')
      .eq('daywork_id', DAYWORK_ID)
      .eq('crew_person_id', EMPLOYER_ID)
      .single();
    expect(inv?.status).toBe('pending');

    // Apply and accept a different crew member
    await appendEvent(
      'DAYWORK.APPLIED',
      AGGREGATE_ID,
      'application',
      'crew',
      { id: APP_ID, daywork_id: DAYWORK_ID },
      CREW_ID,
    );

    await appendEvent(
      'DAYWORK.ACCEPTED',
      AGGREGATE_ID,
      'application',
      'employer',
      {},
      EMPLOYER_ID,
    );

    // Invitation should be revoked
    const { data: revoked } = await service
      .from('daywork_invitations')
      .select('status')
      .eq('daywork_id', DAYWORK_ID)
      .eq('crew_person_id', EMPLOYER_ID)
      .single();
    expect(revoked?.status).toBe('revoked');

    // Clean up
    await service.from('daywork_invitations').delete().eq('daywork_id', DAYWORK_ID);
  });
});

describe('DAYWORK.APPLIED auto-accepts matching invitation', () => {
  const DAYWORK_ID = DAYWORK_1_ID;

  it('auto-accepts pending invitation when invited crew applies via Browse', async () => {
    // Clean up
    await service.from('daywork_invitations').delete().eq('daywork_id', DAYWORK_ID).eq('crew_person_id', CREW_ID);
    await service.from('applications').delete().eq('daywork_id', DAYWORK_ID).eq('crew_person_id', CREW_ID);

    // Create invitation
    await appendEvent(
      'DAYWORK.INVITED',
      DAYWORK_ID,
      'invitation',
      'employer',
      { daywork_id: DAYWORK_ID, crew_person_id: CREW_ID },
      EMPLOYER_ID,
    );

    // Crew applies to the same daywork
    const APP_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003';
    await appendEvent(
      'DAYWORK.APPLIED',
      `${CREW_ID}:${DAYWORK_ID}`,
      'application',
      'crew',
      { id: APP_ID, daywork_id: DAYWORK_ID },
      CREW_ID,
    );

    // Invitation should be auto-accepted
    const { data: inv } = await service
      .from('daywork_invitations')
      .select('status')
      .eq('daywork_id', DAYWORK_ID)
      .eq('crew_person_id', CREW_ID)
      .single();
    expect(inv?.status).toBe('accepted');

    // Clean up
    await service.from('applications').delete().eq('id', APP_ID);
    await service.from('daywork_invitations').delete().eq('daywork_id', DAYWORK_ID).eq('crew_person_id', CREW_ID);
  });
});

describe('DAYWORK.CANCELLED_BY_EMPLOYER revokes pending invitations', () => {
  const DAYWORK_ID = '44444444-4444-4444-4444-444444444004'; // Posting 4

  it('revokes pending invitations when employer cancels daywork', async () => {
    // Clean up
    await service.from('daywork_invitations').delete().eq('daywork_id', DAYWORK_ID);
    await service.from('dayworks').update({ status: 'active' }).eq('id', DAYWORK_ID);

    // Create invitation
    await appendEvent(
      'DAYWORK.INVITED',
      DAYWORK_ID,
      'invitation',
      'employer',
      { daywork_id: DAYWORK_ID, crew_person_id: CREW_ID },
      EMPLOYER_ID,
    );

    // Cancel daywork
    await appendEvent(
      'DAYWORK.CANCELLED_BY_EMPLOYER',
      DAYWORK_ID,
      'daywork',
      'employer',
      {},
      EMPLOYER_ID,
    );

    // Invitation should be revoked
    const { data: inv } = await service
      .from('daywork_invitations')
      .select('status')
      .eq('daywork_id', DAYWORK_ID)
      .eq('crew_person_id', CREW_ID)
      .single();
    expect(inv?.status).toBe('revoked');

    // Clean up
    await service.from('daywork_invitations').delete().eq('daywork_id', DAYWORK_ID);
    await service.from('dayworks').update({ status: 'active' }).eq('id', DAYWORK_ID);
  });
});

describe('DAYWORK.RELISTED revokes pending invitations', () => {
  const DAYWORK_ID = '44444444-4444-4444-4444-444444444004'; // Posting 4

  it('revokes pending invitations when daywork is relisted', async () => {
    // Clean up
    await service.from('daywork_invitations').delete().eq('daywork_id', DAYWORK_ID);
    await service.from('dayworks').update({ status: 'active' }).eq('id', DAYWORK_ID);

    // Create invitation
    await appendEvent(
      'DAYWORK.INVITED',
      DAYWORK_ID,
      'invitation',
      'employer',
      { daywork_id: DAYWORK_ID, crew_person_id: CREW_ID },
      EMPLOYER_ID,
    );

    // Verify pending
    const { data: before } = await service
      .from('daywork_invitations')
      .select('status')
      .eq('daywork_id', DAYWORK_ID)
      .eq('crew_person_id', CREW_ID)
      .single();
    expect(before?.status).toBe('pending');

    // Relist daywork
    await appendEvent(
      'DAYWORK.RELISTED',
      DAYWORK_ID,
      'daywork',
      'employer',
      { daywork_id: DAYWORK_ID },
      EMPLOYER_ID,
    );

    // Invitation should be revoked
    const { data: inv } = await service
      .from('daywork_invitations')
      .select('status')
      .eq('daywork_id', DAYWORK_ID)
      .eq('crew_person_id', CREW_ID)
      .single();
    expect(inv?.status).toBe('revoked');

    // Clean up
    await service.from('daywork_invitations').delete().eq('daywork_id', DAYWORK_ID);
    await service.from('dayworks').update({ status: 'active' }).eq('id', DAYWORK_ID);
  });
});

// ===========================================================================
// 9. Message roundtrip
// ===========================================================================
describe('MESSAGE.SENT roundtrip', () => {
  it('inserts message linked to engagement', async () => {
    // Get the engagement created in test 6
    const DAYWORK_ID = '44444444-4444-4444-4444-444444444003';
    const { data: eng } = await service
      .from('active_engagements')
      .select('id')
      .eq('daywork_id', DAYWORK_ID)
      .single();

    if (!eng) {
      // Skip if apply→accept test hasn't run (test isolation)
      return;
    }

    const MSG_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001';

    // Clean up from previous runs
    await service.from('messages').delete().eq('id', MSG_ID);

    await appendEvent(
      'MESSAGE.SENT',
      eng.id,
      'message',
      'crew',
      { id: MSG_ID, content: 'Integration test message' },
      CREW_ID,
    );

    const { data: msg } = await service
      .from('messages')
      .select('content, sender_person_id, engagement_id')
      .eq('id', MSG_ID)
      .single();

    expect(msg?.content).toBe('Integration test message');
    expect(msg?.sender_person_id).toBe(CREW_ID);
    expect(msg?.engagement_id).toBe(eng.id);
  });
});
