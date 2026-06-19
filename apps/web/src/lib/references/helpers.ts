import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Per-experience reference cap by subscription tier.
 *  Free      → 1 active reference (pending + accepted) per experience
 *  Crew Pro  → 3 active references per experience
 */
export const CREW_FREE_REFS_PER_EXPERIENCE = 1;
export const CREW_PRO_REFS_PER_EXPERIENCE = 3;

/**
 * Two-tier employer contact-request budget (Free).
 *  - At most 10 outstanding pending contact requests at any time.
 *  - At most 5 accepted contact requests in any rolling 30 days.
 *  Pro = unlimited.
 */
export const EMPLOYER_FREE_PENDING_BUDGET = 10;
export const EMPLOYER_FREE_ACCEPTED_30D_BUDGET = 5;

export type SubscriptionPlan = 'free' | 'crew_pro' | 'employer_pro';

export async function getSubscriptionPlan(
  sc: SupabaseClient,
  personId: string,
): Promise<SubscriptionPlan> {
  const { data } = await sc
    .from('subscriptions')
    .select('plan')
    .eq('person_id', personId)
    .maybeSingle();
  const plan = (data?.plan as SubscriptionPlan | undefined) ?? 'free';
  return plan;
}

export function refsCapForPlan(plan: SubscriptionPlan): number {
  return plan === 'crew_pro' ? CREW_PRO_REFS_PER_EXPERIENCE : CREW_FREE_REFS_PER_EXPERIENCE;
}

export interface VesselGateRow {
  id: string;
  name: string;
  imo_number: string;
  nda_flag: boolean;
  source: string;
  hidden_at: string | null;
}

/**
 * Returns null if the vessel is references-eligible (not hidden); otherwise
 * returns a structured rejection with a user-facing message.
 *
 * 00128 dropped the source=curated check (pending vessels in the admin
 * queue accept references). 00130 dropped the NDA check too — NDA protects
 * vessel identity from OUTSIDE parties; the referee was the captain/HOD on
 * the vessel and obviously already knows the IMO. Display-layer masking
 * (`/api/messages/[engagementId]/context`) handles employer visibility in
 * reference-contact chats.
 */
export function checkVesselReferenceGate(
  vessel: VesselGateRow | null,
): { ok: false; status: number; error: string } | { ok: true } {
  if (!vessel) return { ok: false, status: 404, error: 'Vessel not found' };
  if (vessel.hidden_at !== null) {
    return {
      ok: false,
      status: 400,
      error: 'This vessel is unavailable for references',
    };
  }
  return { ok: true };
}

/**
 * Masks an email like `c***n@example.com` for the unauthenticated
 * `/api/references/by-token/[token]` summary surface — referee can verify
 * "yes that's mine" without leaking the full address to anyone with the link.
 */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at < 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 2) return `${local}${domain}`;
  return `${local[0]}***${local[local.length - 1]}${domain}`;
}

/**
 * Idempotency key conventions per Phase 2 spec.
 *
 * `request` is salted by `newRefId` so each fresh submission produces a
 * distinct key — the route's auto-supersede + cap pre-check combine to
 * provide the dedup guarantee that the static-key version was meant to
 * provide. A static `(experience, email)` key collides on legitimate
 * resubmissions after revoke/decline, causing `append_event` to hit the
 * unique-violation dedup path, return the original event id, and skip
 * the projection — leaving the client with a fresh token that doesn't
 * match any row.
 */
export const refIdemKey = {
  request: (newRefId: string): string => `REFERENCE.REQUESTED:${newRefId}`,
  resend: (oldReferenceId: string): string => `REFERENCE.REQUESTED:resend:${oldReferenceId}`,
  accept: (referenceId: string): string => `REFERENCE.ACCEPTED:${referenceId}`,
  contactAccept: (contactId: string): string => `REFERENCE.CONTACT_ACCEPTED:${contactId}`,
};

export function normalizeEmailOrName(email: string | null | undefined, name: string): string {
  if (email && email.trim()) return email.trim().toLowerCase();
  return `name:${name.trim().toLowerCase()}`;
}
