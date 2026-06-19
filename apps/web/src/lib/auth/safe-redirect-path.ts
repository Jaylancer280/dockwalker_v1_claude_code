/**
 * Validates that a `next` / `redirect` query-param value is safe to use
 * as an in-app navigation target. Returns the validated path on success,
 * or null when the input is missing or unsafe — caller falls back to a
 * default destination.
 *
 * Allowlist:
 *   - Must be a non-empty string
 *   - Must start with `/` (relative to the app)
 *   - Must NOT start with `//` (protocol-relative — prevents
 *     redirect-to-external-host attacks)
 *   - Must NOT contain `..` (path traversal)
 *   - Must NOT contain `:` (blocks `javascript:`, `data:`, `mailto:`)
 *   - Must be ≤ 256 characters (prevents URL-bomb DoS)
 *
 * Used by:
 *   - Sign-up + email-confirm flow (preserve QR-landing target through
 *     /auth/signup → /auth/callback → /onboarding → final destination)
 *   - Middleware (preserve original target when bouncing
 *     auth-but-not-onboarded users to /onboarding)
 *   - Onboarding page (route to original target on completion)
 */
export function safeRedirectPath(input: string | null | undefined): string | null {
  if (!input) return null;
  if (typeof input !== 'string') return null;
  if (input.length > 256) return null;
  if (!input.startsWith('/')) return null;
  if (input.startsWith('//')) return null; // protocol-relative
  if (input.includes('..')) return null; // path traversal
  if (input.includes(':')) return null; // protocol injection
  return input;
}
