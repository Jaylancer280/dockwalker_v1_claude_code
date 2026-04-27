import type { SupabaseClient } from '@supabase/supabase-js';
import type { NotifyContext } from './types';

/**
 * Reference-feature notification handlers (Phase 4 — 4 multi-channel hooks).
 * The 5th hook — EXPERIENCE.REMOVED → affected referees (in-app only) — does
 * a direct insert into `notifications` from the experience-delete route and
 * does NOT route through here, because notifyOnEvent has no channel override.
 *
 * Each handler returns an array of NotifyContext (recipient + body shape).
 * The payload always includes `recipient_person_id` so we don't need to
 * re-derive who to notify; the firing route already knows.
 */

interface RefRequestedPayload {
  reference_id?: string;
  recipient_person_id?: string;
  snapshot_vessel_name?: string;
}

interface RefAcceptedPayload {
  reference_id?: string;
  recipient_person_id?: string;
  snapshot_vessel_name?: string;
}

interface RefContactRequestedPayload {
  contact_id?: string;
  reference_id?: string;
  recipient_person_id?: string;
  snapshot_vessel_name?: string;
  question?: string | null;
}

interface RefContactAcceptedPayload {
  contact_id?: string;
  engagement_id?: string;
  recipient_person_id?: string;
}

export async function handleReferenceRequested(
  _sc: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<NotifyContext[]> {
  const p = payload as RefRequestedPayload;
  if (!p.recipient_person_id) return [];
  const vessel = p.snapshot_vessel_name ?? 'a past vessel';
  return [
    {
      recipientPersonId: p.recipient_person_id,
      roleContext: 'crew',
      notification: {
        title: 'Reference request',
        body: `Someone you worked with on ${vessel} has requested a reference. Tap to review.`,
        data: { screen: 'messages' },
      },
    },
  ];
}

export async function handleReferenceAccepted(
  _sc: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<NotifyContext[]> {
  const p = payload as RefAcceptedPayload;
  if (!p.recipient_person_id) return [];
  const vessel = p.snapshot_vessel_name ?? 'your past vessel';
  return [
    {
      recipientPersonId: p.recipient_person_id,
      roleContext: 'crew',
      notification: {
        title: 'Reference accepted',
        body: `Your reference for ${vessel} has been accepted.`,
        data: { screen: 'profile/settings/references' },
      },
    },
  ];
}

export async function handleReferenceContactRequested(
  _sc: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<NotifyContext[]> {
  const p = payload as RefContactRequestedPayload;
  if (!p.recipient_person_id) return [];
  const vessel = p.snapshot_vessel_name ?? 'a past engagement';
  const questionPart =
    p.question && p.question.trim().length > 0 ? ` They asked: "${p.question.trim()}"` : '';
  return [
    {
      recipientPersonId: p.recipient_person_id,
      roleContext: 'crew',
      notification: {
        title: 'Contact request',
        body: `An employer would like to chat about your reference for ${vessel}.${questionPart}`,
        data: { screen: 'messages' },
      },
    },
  ];
}

export async function handleReferenceContactAccepted(
  _sc: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<NotifyContext[]> {
  const p = payload as RefContactAcceptedPayload;
  if (!p.recipient_person_id || !p.engagement_id) return [];
  return [
    {
      recipientPersonId: p.recipient_person_id,
      roleContext: 'employer',
      notification: {
        title: 'Reference contact accepted',
        body: 'A reference accepted your contact request — chat thread opened.',
        data: { screen: 'chat', engagementId: p.engagement_id },
      },
    },
  ];
}
