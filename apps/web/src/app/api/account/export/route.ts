import { NextResponse } from 'next/server';
import { requireDomainUser } from '@/lib/auth/require-domain-user';
import { decryptPhone } from '@/lib/crypto';

/**
 * GET /api/account/export
 * Returns a JSON export of the authenticated user's data for GDPR data portability.
 * Includes: profile, events, messages, engagements, availability, vessels.
 */
export async function GET() {
  const guard = await requireDomainUser();
  if (!guard.ok) return guard.response;

  try {
    const { user, supabase } = guard.value;

    const [
      profileRes,
      eventsRes,
      messagesRes,
      engagementsRes,
      availRes,
      vesselsRes,
      prefsRes,
      experiencesRes,
      applicationsRes,
      invitationsRes,
      ratingsRes,
      deviceTokensRes,
      advisorConvsRes,
      permanentPostingsRes,
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('person_id', user.id).single(),
      supabase
        .from('events')
        .select('id, event_type, aggregate_type, aggregate_id, role_context, payload, created_at')
        .eq('person_id', user.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('messages')
        .select('id, engagement_id, content, is_system, created_at')
        .eq('sender_person_id', user.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('active_engagements')
        .select(
          'id, daywork_id, permanent_posting_id, crew_person_id, employer_person_id, status, outcome, created_at',
        )
        .or(`crew_person_id.eq.${user.id},employer_person_id.eq.${user.id}`)
        .order('created_at', { ascending: true }),
      supabase
        .from('availability_windows')
        .select('id, date, expires_at, city_id, port_id, not_available')
        .eq('person_id', user.id)
        .order('date', { ascending: true }),
      supabase
        .from('vessels')
        .select('id, imo_number, name, vessel_type, size_band_id, created_at')
        .eq('owner_person_id', user.id)
        .order('created_at', { ascending: true }),
      supabase.from('user_preferences').select('*').eq('person_id', user.id).single(),
      supabase
        .from('crew_experiences')
        .select(
          'id, vessel_id, role_id, start_date, end_date, is_current, vessel_operation, flag_state, contract_type, contract_details, description, created_at',
        )
        .eq('person_id', user.id)
        .order('start_date', { ascending: false }),
      supabase
        .from('applications')
        .select(
          'id, daywork_id, permanent_posting_id, status, message, rejection_reason, created_at',
        )
        .eq('crew_person_id', user.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('daywork_invitations')
        .select('id, daywork_id, status, created_at')
        .eq('crew_person_id', user.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('engagement_ratings')
        .select('id, engagement_id, rater_role, rating_context, created_at')
        .eq('rater_person_id', user.id)
        .order('created_at', { ascending: true }),
      supabase.from('device_tokens').select('id, platform, created_at').eq('person_id', user.id),
      supabase
        .from('advisor_conversations')
        .select('id, title, created_at, advisor_messages(id, role, content, created_at)')
        .eq('person_id', user.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('permanent_postings')
        .select(
          'id, job_number, role_id, port_id, vessel_id, start_date, salary_min, salary_max, salary_currency, salary_period, live_aboard, status, created_at',
        )
        .eq('employer_person_id', user.id)
        .order('created_at', { ascending: true }),
    ]);

    // P0-C — references + reference_contacts (caller is requester or referee
    // on references; caller is employer or implicit referee on contacts).
    const { data: referencesAsRequester } = await supabase
      .from('references')
      .select(
        'id, experience_id, vessel_id, status, claimed_referee_role, claimed_referee_name, claimed_referee_email, comment, comment_updated_at, consented_at, responded_at, expires_at, pending_expires_at, revoked_at, revoke_reason, snapshot_vessel_imo, snapshot_vessel_name, snapshot_start_date, snapshot_end_date, requester_person_id, referee_person_id, created_at',
      )
      .eq('requester_person_id', user.id)
      .order('created_at', { ascending: true });
    const { data: referencesAsReferee } = await supabase
      .from('references')
      .select(
        'id, experience_id, vessel_id, status, claimed_referee_role, claimed_referee_name, claimed_referee_email, comment, comment_updated_at, consented_at, responded_at, expires_at, pending_expires_at, revoked_at, revoke_reason, snapshot_vessel_imo, snapshot_vessel_name, snapshot_start_date, snapshot_end_date, requester_person_id, referee_person_id, created_at',
      )
      .eq('referee_person_id', user.id)
      .order('created_at', { ascending: true });
    const refIdsForCaller = [
      ...new Set([...(referencesAsReferee ?? []).map((r) => r.id as string)]),
    ];
    const { data: contactsAsEmployer } = await supabase
      .from('reference_contacts')
      .select(
        'id, reference_id, status, question, engagement_id, employer_person_id, created_at, responded_at',
      )
      .eq('employer_person_id', user.id)
      .order('created_at', { ascending: true });
    const { data: contactsAsReferee } =
      refIdsForCaller.length > 0
        ? await supabase
            .from('reference_contacts')
            .select(
              'id, reference_id, status, question, engagement_id, employer_person_id, created_at, responded_at',
            )
            .in('reference_id', refIdsForCaller)
            .order('created_at', { ascending: true })
        : { data: [] };

    // WhatsApp phone (user's own data — decrypt for export)
    let whatsapp_phone: string | null = null;
    const { data: waChannel } = await supabase
      .from('notification_channels')
      .select('channel_value_encrypted, verified')
      .eq('person_id', user.id)
      .eq('channel_type', 'whatsapp')
      .eq('verified', true)
      .single();
    if (waChannel?.channel_value_encrypted) {
      try {
        whatsapp_phone = decryptPhone(Buffer.from(waChannel.channel_value_encrypted));
      } catch {
        // Decryption failed — omit from export
      }
    }

    // Engagement documents metadata (user's uploads only, no file content)
    const { data: userDocs } = await supabase
      .from('engagement_documents')
      .select('file_name, file_size_bytes, mime_type, created_at, expires_at, deleted_at')
      .eq('uploader_person_id', user.id)
      .order('created_at', { ascending: true });

    return NextResponse.json({
      exported_at: new Date().toISOString(),
      person_id: user.id,
      profile: profileRes.data ?? null,
      preferences: prefsRes.data ?? null,
      ...(whatsapp_phone ? { whatsapp_phone } : {}),
      events: eventsRes.data ?? [],
      messages: messagesRes.data ?? [],
      engagements: engagementsRes.data ?? [],
      availability: availRes.data ?? [],
      vessels: vesselsRes.data ?? [],
      experiences: experiencesRes.data ?? [],
      applications: applicationsRes.data ?? [],
      invitations: invitationsRes.data ?? [],
      ratings: ratingsRes.data ?? [],
      device_tokens: deviceTokensRes.data ?? [],
      advisor_conversations: advisorConvsRes.data ?? [],
      permanent_postings: permanentPostingsRes.data ?? [],
      engagement_documents: (userDocs ?? []).map((d) => ({
        fileName: d.file_name,
        fileSize: d.file_size_bytes,
        mimeType: d.mime_type,
        uploadedAt: d.created_at,
        expiresAt: d.expires_at,
        deletedAt: d.deleted_at,
      })),
      references: {
        outbound: referencesAsRequester ?? [],
        inbound: referencesAsReferee ?? [],
      },
      reference_contacts: {
        as_employer: contactsAsEmployer ?? [],
        as_referee: contactsAsReferee ?? [],
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
