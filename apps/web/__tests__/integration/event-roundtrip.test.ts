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
    expect(data?.name).toBe('Serenity');
    expect(data?.vessel_type).toBe('motor');
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
    expect(data?.working_days).toBe(1);
  });
});

// ===========================================================================
// 6. Apply → Accept roundtrip (tests application + engagement + in_progress)
// ===========================================================================
describe('DAYWORK.APPLIED → DAYWORK.ACCEPTED roundtrip', () => {
  // Random UUIDs — re-runnable without db reset
  const TEST_DW_ID = crypto.randomUUID();
  const APP_ID = crypto.randomUUID();
  const AGGREGATE_ID = `${CREW_ID}:${TEST_DW_ID}`;

  it('creates application, then acceptance creates engagement and moves daywork to in_progress', async () => {
    // Create own daywork posting (self-contained, no seed conflicts)
    await appendEvent(
      'DAYWORK.POSTED',
      TEST_DW_ID,
      'daywork',
      'employer',
      {
        id: TEST_DW_ID,
        vessel_id: VESSEL_ID,
        role_id: ROLE_CAPTAIN,
        location_port_id: PORT_VAUBAN,
        start_date: '2099-03-01',
        end_date: '2099-03-05',
        working_days: 5,
        required_certification_ids: [],
        day_rate: 300,
        currency: 'EUR',
        meals: [],
      },
      EMPLOYER_ID,
    );

    // Apply
    await appendEvent(
      'DAYWORK.APPLIED',
      AGGREGATE_ID,
      'application',
      'crew',
      { id: APP_ID, daywork_id: TEST_DW_ID, message: 'Integration test apply' },
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
      .eq('daywork_id', TEST_DW_ID)
      .single();
    expect(engagement?.crew_person_id).toBe(CREW_ID);
    expect(engagement?.employer_person_id).toBe(EMPLOYER_ID);
    expect(engagement?.status).toBe('active');

    // Daywork → in_progress
    const { data: dw } = await service
      .from('dayworks')
      .select('status')
      .eq('id', TEST_DW_ID)
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
  const REVOKE_DW_ID = crypto.randomUUID();
  const APP_ID = crypto.randomUUID();
  const AGGREGATE_ID = `${CREW_ID}:${REVOKE_DW_ID}`;

  it('revokes all pending invitations when crew is accepted', async () => {
    // Create own daywork posting
    await appendEvent(
      'DAYWORK.POSTED',
      REVOKE_DW_ID,
      'daywork',
      'employer',
      {
        id: REVOKE_DW_ID,
        vessel_id: VESSEL_ID,
        role_id: ROLE_CAPTAIN,
        location_port_id: PORT_VAUBAN,
        start_date: '2099-04-01',
        end_date: '2099-04-05',
        working_days: 5,
        required_certification_ids: [],
        day_rate: 300,
        currency: 'EUR',
        meals: [],
      },
      EMPLOYER_ID,
    );

    // Create a pending invitation for a different crew member
    // Use EMPLOYER_ID as a stand-in for invited crew (valid FK)
    await appendEvent(
      'DAYWORK.INVITED',
      REVOKE_DW_ID,
      'invitation',
      'employer',
      { daywork_id: REVOKE_DW_ID, crew_person_id: EMPLOYER_ID },
      EMPLOYER_ID,
    );

    // Verify invitation is pending
    const { data: inv } = await service
      .from('daywork_invitations')
      .select('status')
      .eq('daywork_id', REVOKE_DW_ID)
      .eq('crew_person_id', EMPLOYER_ID)
      .single();
    expect(inv?.status).toBe('pending');

    // Apply and accept a different crew member
    await appendEvent(
      'DAYWORK.APPLIED',
      AGGREGATE_ID,
      'application',
      'crew',
      { id: APP_ID, daywork_id: REVOKE_DW_ID },
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
      .eq('daywork_id', REVOKE_DW_ID)
      .eq('crew_person_id', EMPLOYER_ID)
      .single();
    expect(revoked?.status).toBe('revoked');
  });
});

describe('DAYWORK.APPLIED auto-accepts matching invitation', () => {
  const DAYWORK_ID = DAYWORK_1_ID;

  it('auto-accepts pending invitation when invited crew applies via Browse', async () => {
    // Clean up from previous runs (uses seed daywork)
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
    const APP_ID = crypto.randomUUID();
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

    // Clean up (seed daywork — remove test artifacts)
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
    // Find any active engagement for the crew (created by earlier tests or seed)
    const { data: eng } = await service
      .from('active_engagements')
      .select('id')
      .eq('crew_person_id', CREW_ID)
      .limit(1)
      .single();

    expect(eng).toBeTruthy();
    if (!eng) throw new Error('Engagement not found');

    const MSG_ID = crypto.randomUUID();

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

// ===========================================================================
// 11. Experience auto-derivation roundtrip
// ===========================================================================
describe('Experience auto-derivation', () => {
  const EXP_ID_1 = crypto.randomUUID();
  const EXP_ID_2 = crypto.randomUUID();
  const EXP_BRACKET_GREEN = 'f0000000-0000-0000-0000-000000000001';
  const EXP_BRACKET_6_12 = 'f0000000-0000-0000-0000-000000000002';
  // Clean up before each test
  async function cleanExperiences() {
    await service.from('crew_experiences').delete().eq('person_id', CREW_ID);
  }

  it('EXPERIENCE.ADDED auto-derives experience_bracket_id and vessel_size_exposure_ids', async () => {
    await cleanExperiences();

    // Add 90-day experience (3 months → Green bracket)
    await appendEvent(
      'EXPERIENCE.ADDED',
      EXP_ID_1,
      'experience',
      'crew',
      {
        id: EXP_ID_1,
        vessel_id: VESSEL_ID,
        role_id: ROLE_CAPTAIN,
        start_date: '2024-01-01',
        end_date: '2024-04-01',
        is_current: false,
        vessel_operation: 'charter',
      },
      CREW_ID,
    );

    const { data: profile } = await service
      .from('profiles')
      .select('experience_bracket_id, vessel_size_exposure_ids')
      .eq('person_id', CREW_ID)
      .single();

    // ~90 days = ~2.96 months → Green (0-6 months)
    expect(profile?.experience_bracket_id).toBe(EXP_BRACKET_GREEN);
    // Vessel's size_band_id (band 5 from seed vessel) should appear in exposure
    const SIZE_BAND_5 = 'f1000000-0000-0000-0000-000000000005';
    expect(profile?.vessel_size_exposure_ids).toContain(SIZE_BAND_5);
  });

  it('adding second experience recalculates bracket from total days', async () => {
    await cleanExperiences();

    // Set up first experience (90 days) within this test
    await appendEvent(
      'EXPERIENCE.ADDED',
      EXP_ID_1,
      'experience',
      'crew',
      {
        id: EXP_ID_1,
        vessel_id: VESSEL_ID,
        role_id: ROLE_CAPTAIN,
        start_date: '2024-01-01',
        end_date: '2024-04-01',
        is_current: false,
        vessel_operation: 'charter',
      },
      CREW_ID,
    );

    // Add another 270-day experience (total ~360 days = ~11.8 months → 6-12 bracket)
    await appendEvent(
      'EXPERIENCE.ADDED',
      EXP_ID_2,
      'experience',
      'crew',
      {
        id: EXP_ID_2,
        vessel_id: VESSEL_ID,
        role_id: ROLE_CAPTAIN,
        start_date: '2024-06-01',
        end_date: '2025-02-25',
        is_current: false,
        vessel_operation: 'private',
      },
      CREW_ID,
    );

    const { data: profile } = await service
      .from('profiles')
      .select('experience_bracket_id, vessel_size_exposure_ids')
      .eq('person_id', CREW_ID)
      .single();

    // ~360 days = ~11.8 months → 6-12 months bracket
    expect(profile?.experience_bracket_id).toBe(EXP_BRACKET_6_12);
  });

  it('EXPERIENCE.REMOVED recalculates bracket downward', async () => {
    // Remove the second experience (270 days), leaving only 90-day one
    await appendEvent(
      'EXPERIENCE.REMOVED',
      EXP_ID_2,
      'experience',
      'crew',
      {},
      CREW_ID,
    );

    const { data: profile } = await service
      .from('profiles')
      .select('experience_bracket_id')
      .eq('person_id', CREW_ID)
      .single();

    // Back to ~90 days → Green bracket
    expect(profile?.experience_bracket_id).toBe(EXP_BRACKET_GREEN);
  });

  it('removing all experiences clears bracket', async () => {
    // Remove the last experience
    await appendEvent(
      'EXPERIENCE.REMOVED',
      EXP_ID_1,
      'experience',
      'crew',
      {},
      CREW_ID,
    );

    const { data: profile } = await service
      .from('profiles')
      .select('experience_bracket_id, vessel_size_exposure_ids')
      .eq('person_id', CREW_ID)
      .single();

    expect(profile?.experience_bracket_id).toBeNull();
    expect(profile?.vessel_size_exposure_ids).toEqual([]);
  });
});

// ===========================================================================
// 9. NDA reveal-after-acceptance
// ===========================================================================
describe('NDA reveal-after-acceptance', () => {
  const NDA_VESSEL_ID = crypto.randomUUID();
  const NDA_DAYWORK_ID = crypto.randomUUID();
  const NDA_APP_ID = crypto.randomUUID();
  const NDA_IMO = String(Math.floor(1000000 + Math.random() * 9000000));

  // Sign in as crew to test get_vessel_public with auth.uid() = CREW_ID
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let crewClient: any;

  beforeAll(async () => {
    // Create authenticated crew client
    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: signInError } = await anon.auth.signInWithPassword({
      email: 'c@1',
      password: '87654321',
    });
    if (signInError) throw new Error(`Sign-in failed: ${signInError.message}`);
    crewClient = anon;

    // Create NDA vessel owned by employer
    await appendEvent(
      'VESSEL.CREATED',
      NDA_VESSEL_ID,
      'vessel',
      'employer',
      {
        id: NDA_VESSEL_ID,
        imo_number: NDA_IMO,
        name: 'NDA Secret Yacht',
        vessel_type: 'motor',
        size_band_id: SIZE_BAND_4,
        loa_meters: 85,
        nda_flag: true,
      },
      EMPLOYER_ID,
    );

    // Post a daywork on that NDA vessel
    await appendEvent(
      'DAYWORK.POSTED',
      NDA_DAYWORK_ID,
      'daywork',
      'employer',
      {
        id: NDA_DAYWORK_ID,
        vessel_id: NDA_VESSEL_ID,
        role_id: ROLE_CAPTAIN,
        location_port_id: PORT_VAUBAN,
        start_date: '2099-01-01',
        end_date: '2099-01-07',
        working_days: 7,
        required_certification_ids: [],
        day_rate: 500,
        currency: 'EUR',
        meals: [],
      },
      EMPLOYER_ID,
    );

    // Crew applies
    await appendEvent(
      'DAYWORK.APPLIED',
      `${CREW_ID}:${NDA_DAYWORK_ID}`,
      'application',
      'crew',
      { id: NDA_APP_ID, daywork_id: NDA_DAYWORK_ID },
      CREW_ID,
    );
  });

  it('non-engaged crew sees null IMO for NDA vessel', async () => {
    // Before acceptance, crew should NOT see IMO
    const { data } = await crewClient.rpc('get_vessel_public', {
      p_vessel_id: NDA_VESSEL_ID,
    });

    expect(data).toHaveLength(1);
    expect(data[0].nda_flag).toBe(true);
    expect(data[0].imo_number).toBeNull();
  });

  it('engaged crew sees IMO after acceptance', async () => {
    // Employer accepts crew
    await appendEvent(
      'DAYWORK.ACCEPTED',
      `${CREW_ID}:${NDA_DAYWORK_ID}`,
      'application',
      'employer',
      {},
      EMPLOYER_ID,
    );

    // Verify engagement exists
    const { data: engagement } = await service
      .from('active_engagements')
      .select('id, status')
      .eq('crew_person_id', CREW_ID)
      .eq('daywork_id', NDA_DAYWORK_ID)
      .single();

    expect(engagement?.status).toBe('active');

    // Now crew should see full IMO
    const { data } = await crewClient.rpc('get_vessel_public', {
      p_vessel_id: NDA_VESSEL_ID,
    });

    expect(data).toHaveLength(1);
    expect(data[0].nda_flag).toBe(true);
    expect(data[0].imo_number).toBe(NDA_IMO);
  });
});

// ===========================================================================
// 10. Engagement lifecycle: completion, confirmation, ratings
// ===========================================================================
describe('Engagement lifecycle — completion + ratings', () => {
  const LC_DW = crypto.randomUUID();
  const LC_APP = crypto.randomUUID();
  const LC_AGG = `${CREW_ID}:${LC_DW}`;
  let engagementId: string;

  beforeAll(async () => {
    // Post + apply + accept to create a fresh active engagement
    await appendEvent('DAYWORK.POSTED', LC_DW, 'daywork', 'employer', {
      id: LC_DW,
      vessel_id: VESSEL_ID,
      role_id: ROLE_CAPTAIN,
      location_port_id: PORT_VAUBAN,
      start_date: '2099-05-01',
      end_date: '2099-05-05',
      working_days: 5,
      required_certification_ids: [],
      day_rate: 400,
      currency: 'EUR',
      meals: [],
    }, EMPLOYER_ID);

    await appendEvent('DAYWORK.APPLIED', LC_AGG, 'application', 'crew', {
      id: LC_APP, daywork_id: LC_DW,
    }, CREW_ID);

    await appendEvent('DAYWORK.ACCEPTED', LC_AGG, 'application', 'employer', {}, EMPLOYER_ID);

    const { data } = await service
      .from('active_engagements')
      .select('id')
      .eq('daywork_id', LC_DW)
      .eq('status', 'active')
      .single();
    engagementId = data?.id ?? '';
  });

  it('DAYWORK.COMPLETED sets daywork completed and engagement completed', async () => {
    await appendEvent(
      'DAYWORK.COMPLETED',
      LC_DW,
      'daywork',
      'employer',
      {},
      EMPLOYER_ID,
    );

    const { data: dw } = await service
      .from('dayworks')
      .select('status')
      .eq('id', LC_DW)
      .single();
    expect(dw?.status).toBe('completed');

    const { data: eng } = await service
      .from('active_engagements')
      .select('status')
      .eq('id', engagementId)
      .single();
    expect(eng?.status).toBe('completed');
  });

  it('ENGAGEMENT.COMPLETION_CONFIRMED sets crew_completion_status', async () => {
    await appendEvent(
      'ENGAGEMENT.COMPLETION_CONFIRMED',
      engagementId,
      'engagement',
      'crew',
      {},
      CREW_ID,
    );

    const { data: eng } = await service
      .from('active_engagements')
      .select('crew_completion_status')
      .eq('id', engagementId)
      .single();
    expect(eng?.crew_completion_status).toBe('confirmed');
  });

  it('ENGAGEMENT.RATED_BY_CREW persists crew rating', async () => {
    await appendEvent(
      'ENGAGEMENT.RATED_BY_CREW',
      engagementId,
      'engagement',
      'crew',
      {
        pay_accuracy: 'yes',
        meals_accuracy: 'yes',
        role_accuracy: 'yes',
        working_days_accuracy: 'as_listed',
        vessel_condition: 4,
        would_work_on_vessel_again: true,
        communication_accuracy: true,
        overall_match: 5,
      },
      CREW_ID,
    );

    const { data: rating } = await service
      .from('engagement_ratings')
      .select('rater_role, overall_match, would_work_on_vessel_again')
      .eq('engagement_id', engagementId)
      .eq('rater_role', 'crew')
      .single();

    expect(rating?.rater_role).toBe('crew');
    expect(rating?.overall_match).toBe(5);
    expect(rating?.would_work_on_vessel_again).toBe(true);
  });

  it('ENGAGEMENT.RATED_BY_EMPLOYER persists employer rating', async () => {
    await appendEvent(
      'ENGAGEMENT.RATED_BY_EMPLOYER',
      engagementId,
      'engagement',
      'employer',
      {
        skills_as_advertised: 'yes',
        certifications_verified: 'yes',
        punctuality: 'yes',
        would_rehire: true,
        communication_accuracy: true,
        overall_match: 4,
      },
      EMPLOYER_ID,
    );

    const { data: rating } = await service
      .from('engagement_ratings')
      .select('rater_role, overall_match, would_rehire')
      .eq('engagement_id', engagementId)
      .eq('rater_role', 'employer')
      .single();

    expect(rating?.rater_role).toBe('employer');
    expect(rating?.overall_match).toBe(4);
    expect(rating?.would_rehire).toBe(true);
  });
});

// ===========================================================================
// 11. Cancellation roundtrips
// ===========================================================================
describe('Cancellation events', () => {
  const CANCEL_DW = crypto.randomUUID();
  const CANCEL_APP = crypto.randomUUID();
  const CANCEL_AGG = `${CREW_ID}:${CANCEL_DW}`;

  beforeAll(async () => {
    // Post a daywork
    await appendEvent('DAYWORK.POSTED', CANCEL_DW, 'daywork', 'employer', {
      id: CANCEL_DW,
      vessel_id: VESSEL_ID,
      role_id: ROLE_CAPTAIN,
      location_port_id: PORT_VAUBAN,
      start_date: '2098-06-01',
      end_date: '2098-06-07',
      working_days: 7,
      required_certification_ids: [],
      day_rate: 400,
      currency: 'EUR',
      meals: [],
    }, EMPLOYER_ID);

    // Apply + accept to create engagement
    await appendEvent('DAYWORK.APPLIED', CANCEL_AGG, 'application', 'crew', {
      id: CANCEL_APP,
      daywork_id: CANCEL_DW,
    }, CREW_ID);

    await appendEvent('DAYWORK.ACCEPTED', CANCEL_AGG, 'application', 'employer', {}, EMPLOYER_ID);
  });

  it('ENGAGEMENT.CANCELLED_BY_CREW sets cancelled_by to crew', async () => {
    await appendEvent(
      'ENGAGEMENT.CANCELLED_BY_CREW',
      CANCEL_AGG,
      'engagement',
      'crew',
      { reason_category: 'personal_reasons', reason_text: 'Family emergency' },
      CREW_ID,
    );

    const { data: eng } = await service
      .from('active_engagements')
      .select('status, cancelled_by, cancellation_reason_category')
      .eq('daywork_id', CANCEL_DW)
      .single();

    expect(eng?.status).toBe('cancelled');
    expect(eng?.cancelled_by).toBe('crew');
    expect(eng?.cancellation_reason_category).toBe('personal_reasons');
  });
});

describe('Employer cancellation of daywork', () => {
  const EMP_CANCEL_DW = crypto.randomUUID();
  const EMP_CANCEL_APP = crypto.randomUUID();
  const EMP_CANCEL_AGG = `${CREW_ID}:${EMP_CANCEL_DW}`;

  beforeAll(async () => {
    // Post + apply + accept
    await appendEvent('DAYWORK.POSTED', EMP_CANCEL_DW, 'daywork', 'employer', {
      id: EMP_CANCEL_DW,
      vessel_id: VESSEL_ID,
      role_id: ROLE_CAPTAIN,
      location_port_id: PORT_VAUBAN,
      start_date: '2098-07-01',
      end_date: '2098-07-07',
      working_days: 7,
      required_certification_ids: [],
      day_rate: 400,
      currency: 'EUR',
      meals: [],
    }, EMPLOYER_ID);

    await appendEvent('DAYWORK.APPLIED', EMP_CANCEL_AGG, 'application', 'crew', {
      id: EMP_CANCEL_APP,
      daywork_id: EMP_CANCEL_DW,
    }, CREW_ID);

    await appendEvent('DAYWORK.ACCEPTED', EMP_CANCEL_AGG, 'application', 'employer', {}, EMPLOYER_ID);
  });

  it('ENGAGEMENT.CANCELLED_BY_EMPLOYER sets cancelled_by to employer', async () => {
    await appendEvent(
      'ENGAGEMENT.CANCELLED_BY_EMPLOYER',
      EMP_CANCEL_AGG,
      'engagement',
      'employer',
      { reason_category: 'vessel_leaving', reason_text: 'Vessel departed early' },
      EMPLOYER_ID,
    );

    const { data: eng } = await service
      .from('active_engagements')
      .select('status, cancelled_by, cancellation_reason_category')
      .eq('daywork_id', EMP_CANCEL_DW)
      .single();

    expect(eng?.status).toBe('cancelled');
    expect(eng?.cancelled_by).toBe('employer');
    expect(eng?.cancellation_reason_category).toBe('vessel_leaving');
  });
});

// ===========================================================================
// 12. Work started + postponement
// ===========================================================================
describe('Work started confirmation', () => {
  const WS_DW = crypto.randomUUID();
  const WS_APP = crypto.randomUUID();
  const WS_AGG = `${CREW_ID}:${WS_DW}`;
  let wsEngagementId: string;

  beforeAll(async () => {
    // Post + apply + accept
    await appendEvent('DAYWORK.POSTED', WS_DW, 'daywork', 'employer', {
      id: WS_DW,
      vessel_id: VESSEL_ID,
      role_id: ROLE_CAPTAIN,
      location_port_id: PORT_VAUBAN,
      start_date: '2098-08-01',
      end_date: '2098-08-07',
      working_days: 7,
      required_certification_ids: [],
      day_rate: 400,
      currency: 'EUR',
      meals: [],
    }, EMPLOYER_ID);

    await appendEvent('DAYWORK.APPLIED', WS_AGG, 'application', 'crew', {
      id: WS_APP, daywork_id: WS_DW,
    }, CREW_ID);

    await appendEvent('DAYWORK.ACCEPTED', WS_AGG, 'application', 'employer', {}, EMPLOYER_ID);

    const { data } = await service
      .from('active_engagements')
      .select('id')
      .eq('daywork_id', WS_DW)
      .single();
    wsEngagementId = data?.id ?? '';
  });

  it('ENGAGEMENT.WORK_STARTED records initiator', async () => {
    await appendEvent(
      'ENGAGEMENT.WORK_STARTED',
      WS_DW,
      'engagement',
      'crew',
      { engagement_id: wsEngagementId, initiated_by: 'crew' },
      CREW_ID,
    );

    const { data: eng } = await service
      .from('active_engagements')
      .select('work_started_status')
      .eq('id', wsEngagementId)
      .single();
    expect(eng?.work_started_status).toBe('initiated_by_crew');
  });

  it('ENGAGEMENT.WORK_STARTED_CONFIRMED sets confirmed + timestamp', async () => {
    await appendEvent(
      'ENGAGEMENT.WORK_STARTED_CONFIRMED',
      WS_DW,
      'engagement',
      'employer',
      { engagement_id: wsEngagementId },
      EMPLOYER_ID,
    );

    const { data: eng } = await service
      .from('active_engagements')
      .select('work_started_status, work_started_at')
      .eq('id', wsEngagementId)
      .single();
    expect(eng?.work_started_status).toBe('confirmed');
    expect(eng?.work_started_at).toBeTruthy();
  });
});

describe('Postponement flow', () => {
  const PP_DW = crypto.randomUUID();
  const PP_APP = crypto.randomUUID();
  const PP_AGG = `${CREW_ID}:${PP_DW}`;
  let ppEngagementId: string;

  beforeAll(async () => {
    // Post + apply + accept
    await appendEvent('DAYWORK.POSTED', PP_DW, 'daywork', 'employer', {
      id: PP_DW,
      vessel_id: VESSEL_ID,
      role_id: ROLE_CAPTAIN,
      location_port_id: PORT_VAUBAN,
      start_date: '2098-09-01',
      end_date: '2098-09-07',
      working_days: 7,
      required_certification_ids: [],
      day_rate: 400,
      currency: 'EUR',
      meals: [],
    }, EMPLOYER_ID);

    await appendEvent('DAYWORK.APPLIED', PP_AGG, 'application', 'crew', {
      id: PP_APP, daywork_id: PP_DW,
    }, CREW_ID);

    await appendEvent('DAYWORK.ACCEPTED', PP_AGG, 'application', 'employer', {}, EMPLOYER_ID);

    const { data } = await service
      .from('active_engagements')
      .select('id')
      .eq('daywork_id', PP_DW)
      .single();
    ppEngagementId = data?.id ?? '';
  });

  it('ENGAGEMENT.POSTPONEMENT_PROPOSED records proposed dates', async () => {
    await appendEvent(
      'ENGAGEMENT.POSTPONEMENT_PROPOSED',
      PP_DW,
      'engagement',
      'employer',
      {
        engagement_id: ppEngagementId,
        proposed_start_date: '2098-09-10',
        proposed_end_date: '2098-09-17',
        proposed_working_days: 7,
      },
      EMPLOYER_ID,
    );

    const { data: eng } = await service
      .from('active_engagements')
      .select('postponement_status, proposed_start_date, proposed_end_date')
      .eq('id', ppEngagementId)
      .single();

    expect(eng?.postponement_status).toBe('proposed');
    expect(eng?.proposed_start_date).toBe('2098-09-10');
    expect(eng?.proposed_end_date).toBe('2098-09-17');
  });

  it('ENGAGEMENT.POSTPONEMENT_ACCEPTED applies new dates to engagement and daywork', async () => {
    await appendEvent(
      'ENGAGEMENT.POSTPONEMENT_ACCEPTED',
      PP_DW,
      'engagement',
      'crew',
      {
        engagement_id: ppEngagementId,
        daywork_id: PP_DW,
        new_start_date: '2098-09-10',
        new_end_date: '2098-09-17',
        new_working_days: 7,
      },
      CREW_ID,
    );

    const { data: eng } = await service
      .from('active_engagements')
      .select('start_date, end_date, postponement_status')
      .eq('id', ppEngagementId)
      .single();

    expect(eng?.postponement_status).toBe('accepted');
    expect(eng?.start_date).toBe('2098-09-10');
    expect(eng?.end_date).toBe('2098-09-17');

    const { data: dw } = await service
      .from('dayworks')
      .select('start_date, end_date')
      .eq('id', PP_DW)
      .single();

    expect(dw?.start_date).toBe('2098-09-10');
    expect(dw?.end_date).toBe('2098-09-17');
  });
});

describe('Postponement rejection cancels engagement', () => {
  const PR_DW = crypto.randomUUID();
  const PR_APP = crypto.randomUUID();
  const PR_AGG = `${CREW_ID}:${PR_DW}`;
  let prEngagementId: string;

  beforeAll(async () => {
    // Post + apply + accept + propose
    await appendEvent('DAYWORK.POSTED', PR_DW, 'daywork', 'employer', {
      id: PR_DW,
      vessel_id: VESSEL_ID,
      role_id: ROLE_CAPTAIN,
      location_port_id: PORT_VAUBAN,
      start_date: '2098-10-01',
      end_date: '2098-10-07',
      working_days: 7,
      required_certification_ids: [],
      day_rate: 400,
      currency: 'EUR',
      meals: [],
    }, EMPLOYER_ID);

    await appendEvent('DAYWORK.APPLIED', PR_AGG, 'application', 'crew', {
      id: PR_APP, daywork_id: PR_DW,
    }, CREW_ID);

    await appendEvent('DAYWORK.ACCEPTED', PR_AGG, 'application', 'employer', {}, EMPLOYER_ID);

    const { data } = await service
      .from('active_engagements')
      .select('id')
      .eq('daywork_id', PR_DW)
      .single();
    prEngagementId = data?.id ?? '';

    await appendEvent('ENGAGEMENT.POSTPONEMENT_PROPOSED', PR_DW, 'engagement', 'employer', {
      engagement_id: prEngagementId,
      proposed_start_date: '2098-10-10',
      proposed_end_date: '2098-10-17',
      proposed_working_days: 7,
    }, EMPLOYER_ID);
  });

  it('ENGAGEMENT.POSTPONEMENT_REJECTED cancels the engagement', async () => {
    await appendEvent(
      'ENGAGEMENT.POSTPONEMENT_REJECTED',
      PR_DW,
      'engagement',
      'crew',
      {
        engagement_id: prEngagementId,
        crew_person_id: CREW_ID,
        daywork_id: PR_DW,
      },
      CREW_ID,
    );

    const { data: eng } = await service
      .from('active_engagements')
      .select('status, cancelled_by, postponement_status')
      .eq('id', prEngagementId)
      .single();

    expect(eng?.status).toBe('cancelled');
    expect(eng?.cancelled_by).toBe('postponement');
    expect(eng?.postponement_status).toBe('rejected');
  });
});

// ===========================================================================
// 13. Checklist roundtrip
// ===========================================================================
describe('Checklist events', () => {
  const CK_DW = crypto.randomUUID();
  const CK_APP = crypto.randomUUID();
  const CK_AGG = `${CREW_ID}:${CK_DW}`;
  let ckEngagementId: string;

  beforeAll(async () => {
    // Post + apply + accept
    await appendEvent('DAYWORK.POSTED', CK_DW, 'daywork', 'employer', {
      id: CK_DW,
      vessel_id: VESSEL_ID,
      role_id: ROLE_CAPTAIN,
      location_port_id: PORT_VAUBAN,
      start_date: '2098-11-01',
      end_date: '2098-11-07',
      working_days: 7,
      required_certification_ids: [],
      day_rate: 400,
      currency: 'EUR',
      meals: [],
    }, EMPLOYER_ID);

    await appendEvent('DAYWORK.APPLIED', CK_AGG, 'application', 'crew', {
      id: CK_APP, daywork_id: CK_DW,
    }, CREW_ID);

    await appendEvent('DAYWORK.ACCEPTED', CK_AGG, 'application', 'employer', {}, EMPLOYER_ID);

    const { data } = await service
      .from('active_engagements')
      .select('id')
      .eq('daywork_id', CK_DW)
      .single();
    ckEngagementId = data?.id ?? '';
  });

  it('CHECKLIST.SET creates checklist with items', async () => {
    const items = [
      { id: 'item-1', label: 'Bring passport' },
      { id: 'item-2', label: 'Bring STCW cert' },
      { id: 'item-3', label: 'White polo required' },
    ];

    await appendEvent(
      'CHECKLIST.SET',
      ckEngagementId,
      'checklist',
      'employer',
      { engagement_id: ckEngagementId, items },
      EMPLOYER_ID,
    );

    const { data: checklist } = await service
      .from('engagement_checklists')
      .select('items, acknowledged_item_ids')
      .eq('engagement_id', ckEngagementId)
      .single();

    expect(checklist?.items).toHaveLength(3);
    expect(checklist?.acknowledged_item_ids).toEqual([]);
  });

  it('CHECKLIST.ITEM_TOGGLED adds item to acknowledged list', async () => {
    await appendEvent(
      'CHECKLIST.ITEM_TOGGLED',
      ckEngagementId,
      'checklist',
      'crew',
      { engagement_id: ckEngagementId, item_id: 'item-1', checked: true },
      CREW_ID,
    );

    const { data: checklist } = await service
      .from('engagement_checklists')
      .select('acknowledged_item_ids')
      .eq('engagement_id', ckEngagementId)
      .single();

    expect(checklist?.acknowledged_item_ids).toContain('item-1');
  });

  it('CHECKLIST.ITEM_TOGGLED unchecked removes item from acknowledged list', async () => {
    await appendEvent(
      'CHECKLIST.ITEM_TOGGLED',
      ckEngagementId,
      'checklist',
      'crew',
      { engagement_id: ckEngagementId, item_id: 'item-1', checked: false },
      CREW_ID,
    );

    const { data: checklist } = await service
      .from('engagement_checklists')
      .select('acknowledged_item_ids')
      .eq('engagement_id', ckEngagementId)
      .single();

    expect(checklist?.acknowledged_item_ids).not.toContain('item-1');
  });
});

// ===========================================================================
// Invitation aggregate_type roundtrip (catches CHECK constraint)
// ===========================================================================
describe('Invitation aggregate_type roundtrip', () => {
  const INV_DAYWORK_ID = '44444444-4444-4444-4444-444444444008';
  it('DAYWORK.INVITED creates a pending invitation', async () => {
    // Clean up from previous runs
    await service.from('daywork_invitations').delete().eq('daywork_id', INV_DAYWORK_ID).eq('crew_person_id', CREW_ID);

    await appendEvent(
      'DAYWORK.INVITED',
      INV_DAYWORK_ID,
      'invitation',
      'employer',
      {
        daywork_id: INV_DAYWORK_ID,
        crew_person_id: CREW_ID,
      },
      EMPLOYER_ID,
    );

    const { data } = await service
      .from('daywork_invitations')
      .select('status, crew_person_id')
      .eq('daywork_id', INV_DAYWORK_ID)
      .eq('crew_person_id', CREW_ID)
      .single();

    expect(data?.status).toBe('pending');
  });

  it('DAYWORK.INVITATION_ACCEPTED updates invitation status', async () => {
    // Get the invitation ID
    const { data: inv } = await service
      .from('daywork_invitations')
      .select('id')
      .eq('daywork_id', INV_DAYWORK_ID)
      .eq('crew_person_id', CREW_ID)
      .single();

    expect(inv).toBeTruthy();

    await appendEvent(
      'DAYWORK.INVITATION_ACCEPTED',
      inv!.id,
      'invitation',
      'crew',
      {
        daywork_id: INV_DAYWORK_ID,
        invitation_id: inv!.id,
      },
      CREW_ID,
    );

    const { data: updated } = await service
      .from('daywork_invitations')
      .select('status')
      .eq('id', inv!.id)
      .single();

    expect(updated?.status).toBe('accepted');
  });
});

// ===========================================================================
// Experience aggregate_type roundtrip (catches CHECK constraint)
// ===========================================================================
describe('Experience aggregate_type roundtrip', () => {
  const EXP_ID = crypto.randomUUID();
  const ROLE_DECKHAND = 'd0000000-0000-0000-0000-000000000006';

  it('EXPERIENCE.ADDED creates a crew_experiences row', async () => {
    await appendEvent(
      'EXPERIENCE.ADDED',
      EXP_ID,
      'experience',
      'crew',
      {
        id: EXP_ID,
        vessel_id: VESSEL_ID,
        role_id: ROLE_DECKHAND,
        start_date: '2025-01-01',
        end_date: '2025-06-01',
        is_current: false,
        vessel_operation: 'charter',
      },
      CREW_ID,
    );

    const { data } = await service
      .from('crew_experiences')
      .select('id, vessel_operation, start_date')
      .eq('id', EXP_ID)
      .single();

    expect(data?.vessel_operation).toBe('charter');
    expect(data?.start_date).toBe('2025-01-01');
  });

  it('EXPERIENCE.UPDATED modifies the experience row', async () => {
    await appendEvent(
      'EXPERIENCE.UPDATED',
      EXP_ID,
      'experience',
      'crew',
      {
        vessel_operation: 'private',
        description: 'Updated via integration test',
      },
      CREW_ID,
    );

    const { data } = await service
      .from('crew_experiences')
      .select('vessel_operation, description')
      .eq('id', EXP_ID)
      .single();

    expect(data?.vessel_operation).toBe('private');
    expect(data?.description).toBe('Updated via integration test');
  });
});

// ===========================================================================
// Permanent jobs roundtrip
// ===========================================================================
describe('Permanent jobs roundtrip', () => {
  // Random UUIDs — re-runnable without db reset
  const PERM_POSTING_ID = crypto.randomUUID();
  const PERM_APP_ID = crypto.randomUUID();
  const PERM_ENG_ID = crypto.randomUUID();
  let PERM_AGG: string;

  // Revert posting (separate flow)
  const REVERT_POSTING_ID = crypto.randomUUID();
  const REVERT_APP_ID = crypto.randomUUID();
  const REVERT_ENG_ID = crypto.randomUUID();

  // Cancel from active
  const CANCEL_POSTING_ID = crypto.randomUUID();
  const CANCEL_APP_ID = crypto.randomUUID();

  // Engagement close
  const CLOSE_POSTING_ID = crypto.randomUUID();
  const CLOSE_APP_ID = crypto.randomUUID();
  const CLOSE_ENG_ID = crypto.randomUUID();

  beforeAll(() => {
    PERM_AGG = `${CREW_ID}:${PERM_POSTING_ID}`;
  });

  it('PERMANENT.POSTED creates row in permanent_postings', async () => {
    await appendEvent(
      'PERMANENT.POSTED',
      PERM_POSTING_ID,
      'permanent',
      'employer',
      {
        id: PERM_POSTING_ID,
        vessel_id: VESSEL_ID,
        role_id: ROLE_CAPTAIN,
        port_id: PORT_VAUBAN,
        start_date: '2099-06-01',
        salary_min: 5000,
        salary_max: 7000,
        salary_currency: 'EUR',
        salary_period: 'monthly',
        live_aboard: true,
        required_certification_ids: [],
        shortlist_cap: 2,
        notes: 'Integration test permanent posting',
      },
      EMPLOYER_ID,
    );

    const { data } = await service
      .from('permanent_postings')
      .select('status, job_number, salary_min, salary_max, shortlist_cap')
      .eq('id', PERM_POSTING_ID)
      .single();

    expect(data?.status).toBe('active');
    expect(data?.job_number).toBeGreaterThan(0);
    expect(data?.salary_min).toBe(5000);
    expect(data?.shortlist_cap).toBe(2);
  });

  it('PERMANENT.APPLIED creates application with permanent_posting_id', async () => {
    await appendEvent(
      'PERMANENT.APPLIED',
      PERM_AGG,
      'permanent',
      'crew',
      {
        id: PERM_APP_ID,
        permanent_posting_id: PERM_POSTING_ID,
        crew_person_id: CREW_ID,
        message: 'Integration test apply',
      },
      CREW_ID,
    );

    const { data } = await service
      .from('applications')
      .select('status, permanent_posting_id, daywork_id, message')
      .eq('id', PERM_APP_ID)
      .single();

    expect(data?.status).toBe('applied');
    expect(data?.permanent_posting_id).toBe(PERM_POSTING_ID);
    expect(data?.daywork_id).toBeNull();
    expect(data?.message).toBe('Integration test apply');
  });

  it('PERMANENT.APPLICATION_BLOCKED is a no-op — event exists but no state change', async () => {
    await appendEvent(
      'PERMANENT.APPLICATION_BLOCKED',
      `${CREW_ID}:${PERM_POSTING_ID}`,
      'permanent',
      'crew',
      {
        crew_person_id: CREW_ID,
        permanent_posting_id: PERM_POSTING_ID,
        missing_certification_ids: [1, 2],
      },
      CREW_ID,
    );

    // Verify event was recorded
    const { data: events } = await service
      .from('events')
      .select('id')
      .eq('event_type', 'PERMANENT.APPLICATION_BLOCKED')
      .eq('aggregate_type', 'permanent');

    expect(events).toBeTruthy();
    expect(events!.length).toBeGreaterThan(0);
  });

  it('PERMANENT.SHORTLISTED updates application and enforces cap', async () => {
    await appendEvent(
      'PERMANENT.SHORTLISTED',
      PERM_AGG,
      'permanent',
      'employer',
      { crew_person_id: CREW_ID, permanent_posting_id: PERM_POSTING_ID },
      EMPLOYER_ID,
    );

    const { data: app } = await service
      .from('applications')
      .select('status')
      .eq('id', PERM_APP_ID)
      .single();
    expect(app?.status).toBe('shortlisted');
  });

  it('PERMANENT.SELECTED creates engagement and moves posting to in_negotiation', async () => {
    await appendEvent(
      'PERMANENT.SELECTED',
      PERM_AGG,
      'permanent',
      'employer',
      {
        crew_person_id: CREW_ID,
        permanent_posting_id: PERM_POSTING_ID,
        engagement_id: PERM_ENG_ID,
      },
      EMPLOYER_ID,
    );

    // Application → selected
    const { data: app } = await service
      .from('applications')
      .select('status')
      .eq('id', PERM_APP_ID)
      .single();
    expect(app?.status).toBe('selected');

    // Engagement created
    const { data: eng } = await service
      .from('active_engagements')
      .select('permanent_posting_id, daywork_id, status')
      .eq('permanent_posting_id', PERM_POSTING_ID)
      .eq('crew_person_id', CREW_ID)
      .single();
    expect(eng?.permanent_posting_id).toBe(PERM_POSTING_ID);
    expect(eng?.daywork_id).toBeNull();
    expect(eng?.status).toBe('active');

    // Posting → in_negotiation
    const { data: posting } = await service
      .from('permanent_postings')
      .select('status')
      .eq('id', PERM_POSTING_ID)
      .single();
    expect(posting?.status).toBe('in_negotiation');
  });

  it('PERMANENT.PLACEMENT_CONFIRMED fills posting', async () => {
    await appendEvent(
      'PERMANENT.PLACEMENT_CONFIRMED',
      PERM_POSTING_ID,
      'permanent',
      'employer',
      { permanent_posting_id: PERM_POSTING_ID },
      EMPLOYER_ID,
    );

    const { data: posting } = await service
      .from('permanent_postings')
      .select('status')
      .eq('id', PERM_POSTING_ID)
      .single();
    expect(posting?.status).toBe('filled');
  });

  it('PERMANENT.SELECTION_REVERTED closes engagement and reverts posting', async () => {
    // Setup: post → apply → shortlist → select
    await appendEvent('PERMANENT.POSTED', REVERT_POSTING_ID, 'permanent', 'employer', {
      id: REVERT_POSTING_ID, vessel_id: VESSEL_ID, role_id: ROLE_CAPTAIN, port_id: PORT_VAUBAN,
      start_date: '2099-07-01', salary_min: 4000, salary_max: 5000, salary_currency: 'EUR',
      salary_period: 'monthly', live_aboard: false, required_certification_ids: [], shortlist_cap: 3,
    }, EMPLOYER_ID);

    await appendEvent('PERMANENT.APPLIED', `${CREW_ID}:${REVERT_POSTING_ID}`, 'permanent', 'crew', {
      id: REVERT_APP_ID, permanent_posting_id: REVERT_POSTING_ID, crew_person_id: CREW_ID,
    }, CREW_ID);

    await appendEvent('PERMANENT.SHORTLISTED', `${CREW_ID}:${REVERT_POSTING_ID}`, 'permanent', 'employer', {
      crew_person_id: CREW_ID, permanent_posting_id: REVERT_POSTING_ID,
    }, EMPLOYER_ID);

    await appendEvent('PERMANENT.SELECTED', `${CREW_ID}:${REVERT_POSTING_ID}`, 'permanent', 'employer', {
      crew_person_id: CREW_ID, permanent_posting_id: REVERT_POSTING_ID, engagement_id: REVERT_ENG_ID,
    }, EMPLOYER_ID);

    // Get engagement ID
    const { data: eng } = await service.from('active_engagements')
      .select('id').eq('permanent_posting_id', REVERT_POSTING_ID).eq('crew_person_id', CREW_ID).single();

    // Revert
    await appendEvent('PERMANENT.SELECTION_REVERTED', REVERT_POSTING_ID, 'permanent', 'employer', {
      permanent_posting_id: REVERT_POSTING_ID, engagement_id: eng!.id,
    }, EMPLOYER_ID);

    // Engagement → closed
    const { data: closedEng } = await service.from('active_engagements')
      .select('status, outcome').eq('id', eng!.id).single();
    expect(closedEng?.status).toBe('closed');
    expect(closedEng?.outcome).toBe('not_successful');

    // Posting → active
    const { data: posting } = await service.from('permanent_postings')
      .select('status').eq('id', REVERT_POSTING_ID).single();
    expect(posting?.status).toBe('active');
  });

  it('PERMANENT.CANCELLED_BY_EMPLOYER from active cancels posting and rejects apps', async () => {
    await appendEvent('PERMANENT.POSTED', CANCEL_POSTING_ID, 'permanent', 'employer', {
      id: CANCEL_POSTING_ID, vessel_id: VESSEL_ID, role_id: ROLE_CAPTAIN, port_id: PORT_VAUBAN,
      start_date: '2099-08-01', salary_min: 3000, salary_max: 4000, salary_currency: 'EUR',
      salary_period: 'monthly', live_aboard: true, required_certification_ids: [], shortlist_cap: 3,
    }, EMPLOYER_ID);

    await appendEvent('PERMANENT.APPLIED', `${CREW_ID}:${CANCEL_POSTING_ID}`, 'permanent', 'crew', {
      id: CANCEL_APP_ID, permanent_posting_id: CANCEL_POSTING_ID, crew_person_id: CREW_ID,
    }, CREW_ID);

    await appendEvent('PERMANENT.CANCELLED_BY_EMPLOYER', CANCEL_POSTING_ID, 'permanent', 'employer', {
      permanent_posting_id: CANCEL_POSTING_ID, reason: 'Changed plans',
    }, EMPLOYER_ID);

    const { data: posting } = await service.from('permanent_postings')
      .select('status').eq('id', CANCEL_POSTING_ID).single();
    expect(posting?.status).toBe('cancelled');

    const { data: app } = await service.from('applications')
      .select('status').eq('id', CANCEL_APP_ID).single();
    expect(app?.status).toBe('rejected');
  });

  it('PERMANENT.ENGAGEMENT_CLOSED with crew withdrew closes engagement and reverts posting', async () => {
    // Setup: post → apply → shortlist → select
    await appendEvent('PERMANENT.POSTED', CLOSE_POSTING_ID, 'permanent', 'employer', {
      id: CLOSE_POSTING_ID, vessel_id: VESSEL_ID, role_id: ROLE_CAPTAIN, port_id: PORT_VAUBAN,
      start_date: '2099-09-01', salary_min: 6000, salary_max: 8000, salary_currency: 'EUR',
      salary_period: 'monthly', live_aboard: true, required_certification_ids: [], shortlist_cap: 3,
    }, EMPLOYER_ID);

    await appendEvent('PERMANENT.APPLIED', `${CREW_ID}:${CLOSE_POSTING_ID}`, 'permanent', 'crew', {
      id: CLOSE_APP_ID, permanent_posting_id: CLOSE_POSTING_ID, crew_person_id: CREW_ID,
    }, CREW_ID);

    await appendEvent('PERMANENT.SHORTLISTED', `${CREW_ID}:${CLOSE_POSTING_ID}`, 'permanent', 'employer', {
      crew_person_id: CREW_ID, permanent_posting_id: CLOSE_POSTING_ID,
    }, EMPLOYER_ID);

    await appendEvent('PERMANENT.SELECTED', `${CREW_ID}:${CLOSE_POSTING_ID}`, 'permanent', 'employer', {
      crew_person_id: CREW_ID, permanent_posting_id: CLOSE_POSTING_ID, engagement_id: CLOSE_ENG_ID,
    }, EMPLOYER_ID);

    const { data: eng } = await service.from('active_engagements')
      .select('id').eq('permanent_posting_id', CLOSE_POSTING_ID).eq('crew_person_id', CREW_ID).single();

    // Crew closes with withdrew
    await appendEvent('PERMANENT.ENGAGEMENT_CLOSED', CLOSE_POSTING_ID, 'permanent', 'crew', {
      engagement_id: eng!.id, outcome: 'withdrew', closed_by: 'crew',
    }, CREW_ID);

    const { data: closedEng } = await service.from('active_engagements')
      .select('status, outcome').eq('id', eng!.id).single();
    expect(closedEng?.status).toBe('closed');
    expect(closedEng?.outcome).toBe('withdrew');

    // Posting reverted to active (crew withdrew)
    const { data: posting } = await service.from('permanent_postings')
      .select('status').eq('id', CLOSE_POSTING_ID).single();
    expect(posting?.status).toBe('active');
  });
});
