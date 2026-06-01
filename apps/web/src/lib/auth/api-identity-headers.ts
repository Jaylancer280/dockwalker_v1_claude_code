/**
 * Identity headers passed from the proxy/middleware to API route handlers.
 *
 * These are an authenticated-session OPTIMISATION: once the proxy has called
 * `getUser()` it forwards the verified identity via these headers so the guard
 * fast-paths (`requireDomainUser`, `requireAuthSession`) can skip a duplicate
 * `getUser()` round-trip.
 *
 * Because the guards TRUST these headers without re-validating, they must never
 * be allowed to originate from the client. The proxy strips them from every
 * inbound `/api` request — authenticated or not — and only re-applies verified
 * values. (Audit 2026-06-01 S1: the strip previously ran only for authenticated
 * requests, so an unauthenticated caller could forge `x-user-id` / `x-person-id`
 * and impersonate any user through the guard fast-path.)
 */
export const IDENTITY_HEADERS = [
  'x-user-id',
  'x-person-id',
  'x-current-hat',
  'x-identity-type',
  'x-blocked',
] as const;

export interface VerifiedApiIdentity {
  userId: string;
  /** Present only when JWT custom claims are available (post-onboarding). */
  personId?: string;
  currentHat?: string;
  identityType?: string;
  blocked?: boolean;
}

/**
 * Builds the header set that is safe to forward to an API route handler.
 *
 * 1. Every client-supplied identity header is removed first (anti-spoofing).
 * 2. When `identity` is non-null (the request is authenticated), the verified
 *    values are applied. `x-user-id` is always set; the person headers are set
 *    only when the full claim set is present, mirroring the guard fast-path
 *    requirement (`requireDomainUser` needs all of person_id/current_hat/
 *    identity_type to take its zero-query path).
 * 3. When `identity` is null (unauthenticated), the headers are returned with
 *    the identity set fully stripped — so a forged `x-user-id` can never reach
 *    a handler.
 *
 * Non-identity headers (cookie, content-type, stripe-signature, the cron
 * Authorization bearer, etc.) are preserved untouched.
 */
export function buildSanitizedApiHeaders(
  incoming: Headers,
  identity: VerifiedApiIdentity | null,
): Headers {
  const headers = new Headers(incoming);

  for (const name of IDENTITY_HEADERS) {
    headers.delete(name);
  }

  if (identity) {
    headers.set('x-user-id', identity.userId);

    if (identity.personId && identity.currentHat && identity.identityType) {
      headers.set('x-person-id', identity.personId);
      headers.set('x-current-hat', identity.currentHat);
      headers.set('x-identity-type', identity.identityType);
      if (identity.blocked === true) {
        headers.set('x-blocked', 'true');
      }
    }
  }

  return headers;
}
