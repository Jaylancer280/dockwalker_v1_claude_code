/**
 * CV Builder feature flag.
 *
 * Per the 2026-04-29 product call, every user-facing CV-related surface
 * is hard-locked behind a "Coming Soon" gate — including paths that
 * Phase 5 had wired up (QR-landing, hire-from-QR, apply-after-invite).
 * Admin-only surfaces (mint-handle), the underlying schema/projection,
 * the daily expiry cron, and the type definitions all stay intact so
 * Stage 2 unlock is a single-flag flip.
 *
 * What's locked when this is `false`:
 *   - PATCH /api/cv/settings → 503 Coming Soon
 *   - GET   /api/cv/[handle] → 503 Coming Soon
 *   - POST  /api/permanent/[id]/invite → 503 Coming Soon
 *   - POST  /api/daywork (only the QR-hire branch with
 *     `inviteCrewPersonId`) → 503 Coming Soon. Regular daywork
 *     posting (no invitee) still works.
 *   - POST  /api/permanent/[id]/apply (only the `fromInvitationId`
 *     branch) → field is ignored when the flag is off; regular apply
 *     still works.
 *   - /settings/cv toggles → disabled + Coming-Soon toast on tap
 *   - /cv/[handle] page → renders Coming-Soon screen unconditionally
 *   - /daywork/post when `?invite=` → Coming-Soon banner + locked submit
 *   - /permanent/[id]/apply when `?from_invitation=` → Coming-Soon
 *
 * What stays accessible:
 *   - /api/admin/cv/mint-handle (admin-only QA path)
 *   - All schema + projection + types
 *   - The /api/cv/generate stub still returns its existing 503
 *     "Coming Soon" payload (locked since Phase 2)
 *   - The invitation-expiry cron (idempotent, no rows to expire while
 *     locked)
 *
 * Stage 2 unlock: flip this to `true` and remove the locked-state
 * UI/route tests (or convert them into regression checks).
 */
export const CV_BUILDER_ENABLED = false;

export const CV_BUILDER_LOCKED_PAYLOAD = {
  error: 'DockWalker CV — Coming Soon',
  message:
    'CV Builder is currently disabled while we finalise the experience. The full surface will unlock with the next release.',
} as const;
