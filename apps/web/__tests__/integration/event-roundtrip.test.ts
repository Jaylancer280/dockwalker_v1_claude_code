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

    expect(eng).toBeTruthy();
    if (!eng) throw new Error('Engagement not found');

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

// ===========================================================================
// 11. Experience auto-derivation roundtrip
// ===========================================================================
describe('Experience auto-derivation', () => {
  const EXP_ID_1 = 'eeeeeeee-eeee-eeee-eeee-eeeeeeee0001';
  const EXP_ID_2 = 'eeeeeeee-eeee-eeee-eeee-eeeeeeee0002';
  const EXP_BRACKET_GREEN = 'f0000000-0000-0000-0000-000000000001';
  const EXP_BRACKET_6_12 = 'f0000000-0000-0000-0000-000000000002';
  const SIZE_BAND_3 = 'f1000000-0000-0000-0000-000000000003';

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
    // Vessel's size_band_id should appear in exposure
    expect(profile?.vessel_size_exposure_ids).toContain(SIZE_BAND_4);
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
  const NDA_VESSEL_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001';
  const NDA_DAYWORK_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0002';
  const NDA_APP_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0003';

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
      password: '12345678',
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
        imo_number: '9999999',
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
    expect(data[0].imo_number).toBe('9999999');
  });
});

// ===========================================================================
// 10. Engagement lifecycle: completion, confirmation, ratings
// ===========================================================================
describe('Engagement lifecycle — completion + ratings', () => {
  // Use seed daywork 5 which is in_progress with active engagement
  const DW5 = '44444444-4444-4444-4444-444444444005';
  let engagementId: string;

  beforeAll(async () => {
    const { data } = await service
      .from('active_engagements')
      .select('id')
      .eq('daywork_id', DW5)
      .eq('status', 'active')
      .single();
    engagementId = data?.id ?? '';
  });

  it('DAYWORK.COMPLETED sets daywork completed and engagement completed', async () => {
    await appendEvent(
      'DAYWORK.COMPLETED',
      DW5,
      'daywork',
      'employer',
      {},
      EMPLOYER_ID,
    );

    const { data: dw } = await service
      .from('dayworks')
      .select('status')
      .eq('id', DW5)
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
    // Clean up any existing rating
    await service.from('engagement_ratings').delete()
      .eq('engagement_id', engagementId)
      .eq('rater_role', 'crew');

    await appendEvent(
      'ENGAGEMENT.RATED_BY_CREW',
      engagementId,
      'engagement',
      'crew',
      {
        pay_accuracy: 'accurate',
        meals_accuracy: 'accurate',
        role_accuracy: 'accurate',
        working_days_accuracy: 'accurate',
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
    // Clean up any existing rating
    await service.from('engagement_ratings').delete()
      .eq('engagement_id', engagementId)
      .eq('rater_role', 'employer');

    await appendEvent(
      'ENGAGEMENT.RATED_BY_EMPLOYER',
      engagementId,
      'engagement',
      'employer',
      {
        skills_as_advertised: 'accurate',
        certifications_verified: 'verified',
        punctuality: 'on_time',
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
  // Create fresh daywork + engagement for cancellation tests
  const CANCEL_DW = 'cccccccc-cccc-cccc-dddd-000000000001';
  const CANCEL_APP = 'cccccccc-cccc-cccc-dddd-000000000002';
  const CANCEL_AGG = `${CREW_ID}:${CANCEL_DW}`;

  beforeAll(async () => {
    // Clean up from previous runs
    await service.from('messages').delete().eq('engagement_id',
      (await service.from('active_engagements').select('id').eq('daywork_id', CANCEL_DW).maybeSingle()).data?.id ?? '00000000-0000-0000-0000-000000000000'
    );
    await service.from('active_engagements').delete().eq('daywork_id', CANCEL_DW);
    await service.from('applications').delete().eq('daywork_id', CANCEL_DW);
    await service.from('dayworks').delete().eq('id', CANCEL_DW);

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
  const EMP_CANCEL_DW = 'cccccccc-cccc-cccc-dddd-000000000003';
  const EMP_CANCEL_APP = 'cccccccc-cccc-cccc-dddd-000000000004';
  const EMP_CANCEL_AGG = `${CREW_ID}:${EMP_CANCEL_DW}`;

  beforeAll(async () => {
    // Clean up
    await service.from('messages').delete().eq('engagement_id',
      (await service.from('active_engagements').select('id').eq('daywork_id', EMP_CANCEL_DW).maybeSingle()).data?.id ?? '00000000-0000-0000-0000-000000000000'
    );
    await service.from('active_engagements').delete().eq('daywork_id', EMP_CANCEL_DW);
    await service.from('applications').delete().eq('daywork_id', EMP_CANCEL_DW);
    await service.from('dayworks').delete().eq('id', EMP_CANCEL_DW);

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
  const WS_DW = 'cccccccc-cccc-cccc-dddd-000000000005';
  const WS_APP = 'cccccccc-cccc-cccc-dddd-000000000006';
  const WS_AGG = `${CREW_ID}:${WS_DW}`;
  let wsEngagementId: string;

  beforeAll(async () => {
    // Clean up
    await service.from('engagement_checklists').delete().eq('engagement_id',
      (await service.from('active_engagements').select('id').eq('daywork_id', WS_DW).maybeSingle()).data?.id ?? '00000000-0000-0000-0000-000000000000'
    );
    await service.from('messages').delete().eq('engagement_id',
      (await service.from('active_engagements').select('id').eq('daywork_id', WS_DW).maybeSingle()).data?.id ?? '00000000-0000-0000-0000-000000000000'
    );
    await service.from('active_engagements').delete().eq('daywork_id', WS_DW);
    await service.from('applications').delete().eq('daywork_id', WS_DW);
    await service.from('dayworks').delete().eq('id', WS_DW);

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
  const PP_DW = 'cccccccc-cccc-cccc-dddd-000000000007';
  const PP_APP = 'cccccccc-cccc-cccc-dddd-000000000008';
  const PP_AGG = `${CREW_ID}:${PP_DW}`;
  let ppEngagementId: string;

  beforeAll(async () => {
    // Clean up
    await service.from('messages').delete().eq('engagement_id',
      (await service.from('active_engagements').select('id').eq('daywork_id', PP_DW).maybeSingle()).data?.id ?? '00000000-0000-0000-0000-000000000000'
    );
    await service.from('active_engagements').delete().eq('daywork_id', PP_DW);
    await service.from('applications').delete().eq('daywork_id', PP_DW);
    await service.from('dayworks').delete().eq('id', PP_DW);

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
  const PR_DW = 'cccccccc-cccc-cccc-dddd-000000000009';
  const PR_APP = 'cccccccc-cccc-cccc-dddd-00000000000a';
  const PR_AGG = `${CREW_ID}:${PR_DW}`;
  let prEngagementId: string;

  beforeAll(async () => {
    // Clean up
    await service.from('messages').delete().eq('engagement_id',
      (await service.from('active_engagements').select('id').eq('daywork_id', PR_DW).maybeSingle()).data?.id ?? '00000000-0000-0000-0000-000000000000'
    );
    await service.from('active_engagements').delete().eq('daywork_id', PR_DW);
    await service.from('applications').delete().eq('daywork_id', PR_DW);
    await service.from('dayworks').delete().eq('id', PR_DW);

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
  const CK_DW = 'cccccccc-cccc-cccc-dddd-00000000000b';
  const CK_APP = 'cccccccc-cccc-cccc-dddd-00000000000c';
  const CK_AGG = `${CREW_ID}:${CK_DW}`;
  let ckEngagementId: string;

  beforeAll(async () => {
    // Clean up
    await service.from('engagement_checklists').delete().eq('engagement_id',
      (await service.from('active_engagements').select('id').eq('daywork_id', CK_DW).maybeSingle()).data?.id ?? '00000000-0000-0000-0000-000000000000'
    );
    await service.from('messages').delete().eq('engagement_id',
      (await service.from('active_engagements').select('id').eq('daywork_id', CK_DW).maybeSingle()).data?.id ?? '00000000-0000-0000-0000-000000000000'
    );
    await service.from('active_engagements').delete().eq('daywork_id', CK_DW);
    await service.from('applications').delete().eq('daywork_id', CK_DW);
    await service.from('dayworks').delete().eq('id', CK_DW);

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
