# Task Board

> Shared between planning and implementation agents. Planning agent writes, implementation agent executes.
> Mark items `[x]` as completed. Remove completed items from the list — see git history for past work.

## Current Task

Stage 102: Availability Expiry Reminder

---

## Queue

---

### Stage 99: Email Templates + Forgot Password + SMTP Config

**Goal:** Replace Supabase's default auth emails with branded HTML templates, add a self-service password reset flow (forgot-password → email link → reset-password page), enable email confirmations, and document production SMTP setup.

**Will NOT touch:** API routes (except callback), database/migrations, RLS, billing, Docky, components outside auth pages.

**Done condition:** Local dev sends branded confirmation/reset/email-change emails to Inbucket. Forgot-password flow works end-to-end. Production SMTP setup is documented with env var references. Email confirmations are enabled.

---

#### 1. Email templates — `supabase/templates/`

Create 3 branded HTML email templates using Supabase's Go template variables (`{{ .ConfirmationURL }}`, `{{ .SiteURL }}`, `{{ .Email }}`).

- [x] Create `supabase/templates/confirmation.html` — signup email confirmation
  - Subject line (configured in config.toml): "Confirm your DockWalker account"
  - Body: DockWalker branding (text-only, no images — emails need to work in plain clients), greeting, "Click the link below to confirm your email and start using DockWalker", CTA link using `{{ .ConfirmationURL }}`, footer with "If you didn't create this account, you can ignore this email"
  - Inline CSS only (no external stylesheets — email clients strip `<link>` tags)
  - Use navy/teal brand colours inline: `#0f172a` (navy), `#0d9488` (teal)
  - Mobile-friendly: max-width 480px centered, minimum 14px font

- [x] Create `supabase/templates/recovery.html` — password reset
  - Subject: "Reset your DockWalker password"
  - Body: "You requested a password reset for your DockWalker account", CTA link using `{{ .ConfirmationURL }}`, "This link expires in 1 hour", footer with "If you didn't request this, you can ignore this email"
  - Same styling conventions as confirmation

- [x] Create `supabase/templates/email_change.html` — email change confirmation
  - Subject: "Confirm your new email address"
  - Body: "You requested to change the email address on your DockWalker account", CTA link using `{{ .ConfirmationURL }}`, footer with "If you didn't request this change, please secure your account immediately"
  - Same styling conventions

**Template structure** (shared across all 3):

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
  </head>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:sans-serif;">
    <div
      style="max-width:480px;margin:40px auto;background:#ffffff;border-radius:8px;overflow:hidden;"
    >
      <div style="background:#0f172a;padding:24px;text-align:center;">
        <h1 style="color:#ffffff;font-size:20px;margin:0;">DockWalker</h1>
      </div>
      <div style="padding:32px 24px;">
        <!-- Content varies per template -->
      </div>
      <div style="padding:16px 24px;text-align:center;color:#94a3b8;font-size:12px;">
        <!-- Footer -->
      </div>
    </div>
  </body>
</html>
```

---

#### 2. Supabase config — `supabase/config.toml`

- [x] Enable email confirmations:

  ```toml
  enable_confirmations = true
  ```

  **Impact:** Users must click confirmation link before first sign-in. Local dev emails go to Inbucket (port 54324). This makes local dev match production behavior.

- [x] Add custom template references:

  ```toml
  [auth.email.template.confirmation]
  subject = "Confirm your DockWalker account"
  content_path = "./supabase/templates/confirmation.html"

  [auth.email.template.recovery]
  subject = "Reset your DockWalker password"
  content_path = "./supabase/templates/recovery.html"

  [auth.email.template.email_change]
  subject = "Confirm your new email address"
  content_path = "./supabase/templates/email_change.html"
  ```

- [x] **Do NOT uncomment the SMTP section** in config.toml — local dev uses Inbucket. Production SMTP is configured in Supabase Dashboard, not config.toml.

---

#### 3. Forgot password page — `apps/web/src/app/auth/forgot-password/page.tsx`

- [x] Create page with:
  - Email input field
  - Submit calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: '${origin}/auth/callback?next=/auth/reset-password' })`
  - On success: show "Check your email" message (same pattern as signup success state)
  - On error: show error message
  - Loading state on submit button
  - "Back to sign in" link
  - Same layout/styling as login and signup pages (centered card, logo, max-w-sm)

---

#### 4. Reset password page — `apps/web/src/app/auth/reset-password/page.tsx`

- [x] Create page with:
  - New password + confirm password fields
  - Client-side validation: passwords match, minimum 8 chars (same rules as signup)
  - Submit calls `supabase.auth.updateUser({ password: newPassword })`
  - On success: show success message + "Sign in" link (or auto-redirect to login after 3s)
  - On error: show error message
  - Loading state on submit button
  - Same layout/styling as other auth pages
  - **Note:** User arrives here already authenticated (callback exchanged code for session). If user navigates here directly without a session, show a message like "This link has expired or is invalid" with a link to request a new one.

---

#### 5. Update callback route — `apps/web/src/app/auth/callback/route.ts`

- [x] The existing callback already handles the `next` query param correctly:
  ```typescript
  const next = searchParams.get('next') ?? '/onboarding';
  ```
  Password reset emails will use `?next=/auth/reset-password`, which will redirect correctly after code exchange.
  - **Verify this works** — read the file and confirm no changes needed. If the callback clears query params during redirect, fix it.

---

#### 6. Update middleware — `apps/web/src/lib/supabase/middleware.ts`

- [x] Add `/auth/forgot-password` and `/auth/reset-password` to the routing logic:
  - Both must be accessible without authentication (they're part of the auth flow)
  - BUT `/auth/reset-password` should NOT redirect authenticated users to onboarding (the user has a session from the callback and needs to set their new password)
  - **Approach:** Split the public routes into two groups:
    ```typescript
    // Routes that redirect authenticated users to the app
    const authEntryRoutes = ['/auth/login', '/auth/signup'];
    // All public routes (no auth required)
    const publicRoutes = [
      ...authEntryRoutes,
      '/auth/callback',
      '/auth/forgot-password',
      '/auth/reset-password',
    ];
    const isPublicRoute = publicRoutes.some((route) => path.startsWith(route));
    const isAuthEntryRoute = authEntryRoutes.some((route) => path.startsWith(route));
    ```
  - Update line 43: keep `if (!user && !isPublicRoute && !isLandingPage)` (no change — forgot-password and reset-password are now public)
  - Update line 50: change from `if (user && isPublicRoute)` to `if (user && isAuthEntryRoute)` — this prevents authenticated users on `/auth/reset-password` from being bounced to onboarding

---

#### 7. Login page update — `apps/web/src/app/auth/login/page.tsx`

- [x] Add "Forgot password?" link below the password field (inside the form, after the password input div, before the error message):
  ```tsx
  <div className="flex justify-end">
    <Link
      href="/auth/forgot-password"
      className="text-xs text-muted-foreground underline-offset-4 hover:underline"
    >
      Forgot password?
    </Link>
  </div>
  ```

---

#### 8. Environment variables documentation

- [x] Update `apps/web/.env.example` — add comment block documenting production SMTP setup:
  ```
  # ─── Production SMTP (configured in Supabase Dashboard, not here) ───
  # Supabase Dashboard → Project Settings → Auth → SMTP Settings
  # Recommended provider: Resend (resend.com) — simple, good deliverability
  # Required DNS records: SPF, DKIM (provider-specific), DMARC
  # After configuring SMTP, copy email templates from supabase/templates/ into
  # Supabase Dashboard → Auth → Email Templates
  ```

---

#### 9. Tests

- [x] Create `__tests__/auth/forgot-password.test.tsx`:
  - Renders form with email input and submit button
  - Submit calls `supabase.auth.resetPasswordForEmail` with correct email and redirectTo
  - Shows success message after submission
  - Shows error on failure

- [x] Create `__tests__/auth/reset-password.test.tsx`:
  - Renders password + confirm password fields
  - Validates passwords match
  - Validates minimum length
  - Submit calls `supabase.auth.updateUser` with new password
  - Shows success message after update

---

#### 10. Documentation

- [x] Update `BUILD_STATE.md`:
  - Stage entry: `[Stage 99] Email templates + forgot password flow — branded confirmation/recovery/email-change templates, forgot-password and reset-password pages, email confirmations enabled, middleware updated for auth flow routes`
- [x] Mark P0 #1 (Email templates + SMTP provider) as `[x]` in `tasks/launch-readiness.md`
- [x] Update `apps/web/README.md`:
  - Add "Auth email templates" section noting `supabase/templates/` location
  - Document the forgot-password flow
  - Note that production SMTP is configured in Supabase Dashboard
- [x] Update `supabase/README.md`:
  - Add entry for `supabase/templates/` directory and its 3 template files
  - Note `enable_confirmations = true` change

---

### Stage 100: Error Tracking (Sentry)

**Goal:** Integrate `@sentry/nextjs` for production error tracking. Capture server-side errors (API routes, server components), client-side errors (UI crashes), and unhandled promise rejections.

**Will NOT touch:** Database, migrations, RLS, API route logic, UI components (except error boundary enhancement).

**Done condition:** Sentry SDK initialised on both server and client. Error boundary reports to Sentry. API route errors captured automatically. DSN configurable via env var (no-ops when missing).

---

#### 1. Install Sentry — `apps/web/`

- [x] Run `npm install @sentry/nextjs` in `apps/web/`
- [x] **Do NOT run the Sentry wizard** (`npx @sentry/wizard`) — it generates too much boilerplate. Manual setup is cleaner.

---

#### 2. Sentry server config — `apps/web/sentry.server.config.ts`

- [x] Create file:

  ```typescript
  import * as Sentry from '@sentry/nextjs';

  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV,
    });
  }
  ```

  - Guard with DSN check — local dev without DSN should not initialise Sentry
  - Low trace sample rate (0.1 = 10%) to avoid quota burn at launch

---

#### 3. Sentry client config — `apps/web/sentry.client.config.ts`

- [x] Create file:

  ```typescript
  import * as Sentry from '@sentry/nextjs';

  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0.5,
    });
  }
  ```

  - Session replays off by default, 50% on errors (useful for debugging UI crashes)

---

#### 4. Sentry edge config — `apps/web/sentry.edge.config.ts`

- [x] Create file (same as server config — needed for middleware/edge routes):

  ```typescript
  import * as Sentry from '@sentry/nextjs';

  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV,
    });
  }
  ```

---

#### 5. Instrumentation file — `apps/web/src/instrumentation.ts`

- [x] Create file to register Sentry for server-side:
  ```typescript
  export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
      await import('../sentry.server.config');
    }
    if (process.env.NEXT_RUNTIME === 'edge') {
      await import('../sentry.edge.config');
    }
  }
  ```

---

#### 6. Next.js config — `apps/web/next.config.ts`

- [x] Wrap the existing config with `withSentryConfig`:

  ```typescript
  import { withSentryConfig } from '@sentry/nextjs';
  ```

  - Only wrap when `NEXT_PUBLIC_SENTRY_DSN` is set (conditional):
    ```typescript
    const nextConfig = {
      /* existing config */
    };
    export default process.env.NEXT_PUBLIC_SENTRY_DSN
      ? withSentryConfig(nextConfig, {
          silent: true,
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
        })
      : nextConfig;
    ```
  - `silent: true` prevents noisy build logs
  - Source map upload is optional — only works if `SENTRY_AUTH_TOKEN` is set. Omit for now.
  - **Preserve the existing Capacitor build conditional** (`output: 'export'` when `CAPACITOR_BUILD=1`)

---

#### 7. Enhance error boundary — `apps/web/src/app/(app)/error.tsx`

- [x] Replace `console.error(error)` with Sentry capture:

  ```typescript
  import * as Sentry from '@sentry/nextjs';

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  ```

  - Keep the existing UI unchanged (error message + retry button)
  - Sentry import is tree-shaken when DSN is not set — no bundle impact

---

#### 8. Global error boundary — `apps/web/src/app/global-error.tsx`

- [x] Create file for root-level errors (outside the `(app)` layout):

  ```typescript
  'use client';
  import * as Sentry from '@sentry/nextjs';
  import { useEffect } from 'react';

  export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
    useEffect(() => { Sentry.captureException(error); }, [error]);
    return (
      <html><body>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <button onClick={reset}>Try again</button>
        </div>
      </body></html>
    );
  }
  ```

---

#### 9. Environment variables

- [x] Update `apps/web/.env.example`:

  ```
  # ─── Error Tracking (Sentry) ───
  # NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
  # SENTRY_ORG=your-org
  # SENTRY_PROJECT=dockwalker
  # SENTRY_AUTH_TOKEN=sntrys_xxx  (optional, for source map upload)
  ```

  - All commented out — Sentry is opt-in. App works without it.

---

#### 10. Tests

- [x] No new tests needed — Sentry is infrastructure, not business logic
- [x] Verify existing tests still pass (Sentry imports should be tree-shaken in test env since no DSN)
- [x] If Sentry import causes issues in vitest, add to `vi.mock('@sentry/nextjs')` in test setup

---

#### 11. Documentation

- [x] Update `BUILD_STATE.md`:
  - Stage entry: `[Stage 100] Error tracking — @sentry/nextjs integration, server + client + edge init, error boundary capture, global error boundary, DSN-gated (no-ops without env var)`
- [x] Mark P1 #9 (Error tracking) as `[x]` in `tasks/launch-readiness.md`
- [x] Update `apps/web/README.md`:
  - Add "Error Tracking" section: Sentry is optional, set `NEXT_PUBLIC_SENTRY_DSN` to enable

---

### Stage 101: Email Notification Fallback

**Goal:** Add transactional email as a third notification channel alongside push and in-app. When a domain event triggers a notification, also send an email to the recipient. Users who denied push or are web-only will still receive critical notifications.

**Will NOT touch:** Push delivery, in-app notifications, notification UI, database schema, RLS.

**Depends on:** Stage 99 (SMTP provider configured for production).

**Done condition:** Acceptance, new message, and engagement start notifications send a branded email to the recipient. Email sending is fire-and-forget (same as push). Works in local dev via Inbucket. No-ops when Resend API key is missing.

---

#### 1. Install Resend — `apps/web/`

- [x] Run `npm install resend` in `apps/web/`
  - Resend is chosen over raw SMTP because: simple SDK, good deliverability, generous free tier (100 emails/day), TypeScript-native
  - **Note:** Supabase auth emails use Supabase's own SMTP (configured in Dashboard). Transactional app emails use Resend directly — these are separate systems.

---

#### 2. Email service helper — `apps/web/src/lib/email/send.ts`

- [x] Create helper:

  ```typescript
  import { Resend } from 'resend';

  let resendClient: Resend | null | undefined;

  function getClient(): Resend | null {
    if (resendClient !== undefined) return resendClient;
    const key = process.env.RESEND_API_KEY;
    resendClient = key ? new Resend(key) : null;
    return resendClient;
  }

  export async function sendEmail(params: {
    to: string;
    subject: string;
    html: string;
  }): Promise<void> {
    const client = getClient();
    if (!client) return; // No-op without API key
    await client.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'DockWalker <noreply@dockwalker.com>',
      ...params,
    });
  }
  ```

  - Singleton pattern (cached at module level per lessons.md)
  - No-ops gracefully when `RESEND_API_KEY` is not set
  - `RESEND_FROM_EMAIL` configurable for different environments

---

#### 3. Email templates — `apps/web/src/lib/email/templates.ts`

- [x] Create template functions that return `{ subject: string; html: string }`:
  - `applicationAcceptedEmail(params: { crewName: string; jobTitle: string; vesselType: string; startDate: string; deepLink: string })` — "You've been accepted for [role] on [vessel]"
  - `newMessageEmail(params: { recipientName: string; senderName: string; preview: string; deepLink: string })` — "[Sender] sent you a message"
  - `engagementReminderEmail(params: { crewName: string; jobTitle: string; startDate: string; deepLink: string })` — "Your engagement starts tomorrow"
  - `applicationReceivedEmail(params: { employerName: string; crewName: string; jobTitle: string; deepLink: string })` — "[Crew] applied to your [role] posting"
  - Use the same HTML structure/branding as the auth email templates from Stage 99 (navy header, white card, teal CTA button)
  - Each template is a pure function returning HTML string — no file I/O, no external dependencies

---

#### 4. Integrate into notification flow — `apps/web/src/lib/push-triggers.ts`

- [x] Add email sending as a third channel in the notification delivery path:
  - After push + in-app notification, look up the recipient's email from `auth.users` (via service client)
  - Call `sendEmail()` with the appropriate template
  - Fire-and-forget: wrap in `.catch(() => {})` like push delivery
  - **Only send emails for high-value events** (not every notification type):
    - `DAYWORK.ACCEPTED` → `applicationAcceptedEmail` to crew
    - `DAYWORK.APPLIED` → `applicationReceivedEmail` to employer
    - `MESSAGE.SENT` → `newMessageEmail` to recipient (rate-limited: max 1 email per conversation per 5 minutes to prevent spam during active chat)
  - **Do NOT email for:** rejections (too negative), shortlists (low urgency), system messages, checklist updates

- [x] Add email rate limiting for messages:
  - Use a simple in-memory Map: `Map<engagementId, lastEmailTimestamp>`
  - Skip email if last email for this conversation was <5 minutes ago
  - This prevents 20 emails during an active chat exchange
  - Map resets on server restart — acceptable for this use case

- [x] Look up recipient email:
  - Service client can query `auth.users` table: `serviceClient.auth.admin.getUserById(recipientPersonId)`
  - Extract `user.email` from the response
  - Cache in-memory for the request lifetime (not across requests — emails can change)

---

#### 5. Environment variables

- [x] Update `apps/web/.env.example`:
  ```
  # ─── Transactional Email (Resend) ───
  # RESEND_API_KEY=re_xxx
  # RESEND_FROM_EMAIL=DockWalker <noreply@dockwalker.com>
  ```

---

#### 6. Tests

- [x] Create `__tests__/lib/email-send.test.ts`:
  - Test: no-ops when RESEND_API_KEY is missing
  - Test: calls Resend SDK with correct params when key is set
  - Mock the Resend constructor and `.emails.send()`

- [x] Create `__tests__/lib/email-templates.test.ts`:
  - Test: each template returns non-empty subject and HTML
  - Test: HTML contains the expected deep link
  - Test: HTML contains the expected recipient name

---

#### 7. Documentation

- [x] Update `BUILD_STATE.md`:
  - Stage entry: `[Stage 101] Email notification fallback — Resend integration, transactional email templates for acceptance/apply/message, fire-and-forget delivery alongside push + in-app, message email rate limiting`
- [x] Mark P1 #6 (Email notification fallback) as `[x]` in `tasks/launch-readiness.md`
- [x] Update `apps/web/README.md`:
  - Add "Transactional Email" section: Resend SDK, env vars, which events trigger emails

---

### Stage 102: Availability Expiry Reminder

**Goal:** Send a push/in-app notification to crew 24 hours before their availability expires. Uses Vercel Cron to run a daily check.

**Will NOT touch:** Availability API logic, discover filtering, UI components, push delivery code.

**Done condition:** Cron route runs daily, finds crew whose availability expires within 24h, creates an in-app notification + sends push. Vercel Cron configured in `vercel.json`.

---

#### 1. Cron API route — `apps/web/src/app/api/cron/availability-expiry/route.ts`

- [x] Create route handler (GET, since Vercel Cron uses GET):
  - **Auth:** Verify `Authorization: Bearer ${CRON_SECRET}` header matches `process.env.CRON_SECRET` (prevents public access)
  - **Query:** Find all `availability_windows` where `expires_at` is between `now()` and `now() + interval '24 hours'`, grouped by `person_id`:
    ```sql
    select distinct person_id
    from availability_windows
    where expires_at > now()
      and expires_at <= now() + interval '24 hours'
      and not_available = false
    ```
  - **Deduplicate:** Only notify each person once per cron run (use DISTINCT on person_id)
  - **For each person:** Create an in-app notification + trigger push:
    - Title: "Your availability expires soon"
    - Body: "Your availability window expires in less than 24 hours. Update it to stay visible to employers."
    - Deep link: `/availability`
    - Role context: `'crew'`
    - Notification type: `'availability_expiring'`
  - **Use service client** for all DB operations (this is a server-to-server cron, no user session)
  - **Return:** `{ notified: number }` with count of crew notified

- [x] Add duplicate prevention:
  - Before notifying, check if a `availability_expiring` notification was already created for this person in the last 24 hours:
    ```sql
    select 1 from notifications
    where person_id = $1 and type = 'availability_expiring'
      and created_at > now() - interval '24 hours'
    ```
  - Skip if already notified — prevents double-notifications if cron runs more than once

---

#### 2. Vercel Cron config — `vercel.json`

- [x] Add cron schedule to existing `vercel.json`:

  ```json
  {
    "crons": [
      {
        "path": "/api/cron/availability-expiry",
        "schedule": "0 8 * * *"
      }
    ]
  }
  ```

  - Runs daily at 08:00 UTC (morning in Med/Caribbean/Florida time zones)
  - Merge into existing `vercel.json` (which already has security headers)

---

#### 3. Environment variables

- [x] Update `apps/web/.env.example`:
  ```
  # ─── Vercel Cron ───
  # CRON_SECRET=your-secret-here  (set in Vercel dashboard, used to authenticate cron requests)
  ```

---

#### 4. Tests

- [x] Create `__tests__/api/cron-availability-expiry.test.ts`:
  - Test: returns 401 without valid CRON_SECRET
  - Test: returns 200 with count of notified crew
  - Test: skips crew already notified in last 24h
  - Test: skips `not_available = true` rows
  - Mock `from('availability_windows')` and `from('notifications')` queries

---

#### 5. Documentation

- [x] Update `BUILD_STATE.md`:
  - Stage entry: `[Stage 102] Availability expiry reminder — Vercel Cron daily at 08:00 UTC, in-app + push notification 24h before availability expires, duplicate prevention`
- [x] Mark P1 #7 (Availability expiry reminder) as `[x]` in `tasks/launch-readiness.md`
- [x] Update `apps/web/README.md`:
  - Add "Cron Jobs" section: availability expiry check, CRON_SECRET env var, schedule

---

### Stage 103: Admin Tooling

**Goal:** Add an admin role concept, admin-only API routes for user lookup, engagement override, and canonical data management. No admin UI in this stage — admin operations are API-only (callable via curl/Postman or a future admin dashboard).

**Will NOT touch:** User-facing UI, user-facing API routes, push notifications, billing, Docky.

**Done condition:** Admin users (identified by `is_admin` flag on persons) can: look up any user, list stuck engagements, force-complete engagements, add/edit canonical data (ports, certs, roles). All admin actions append `ADMIN.*` events to the ledger for audit.

---

#### 1. Migration — `supabase/migrations/00050_admin_role.sql`

- [ ] Add `is_admin` boolean column to `persons`:

  ```sql
  alter table public.persons add column is_admin boolean not null default false;
  ```

  - Default false — no existing users become admin
  - No CHECK constraint on aggregate_type needed (admin actions use existing types)

- [ ] Add `ADMIN` aggregate type to the events CHECK constraint:
  - Read the current CHECK constraint from the latest migration that modified it
  - Add `'admin'` to the allowed values

- [ ] Add admin event types to `event_type` CHECK (if one exists) or document in types:
  - `ADMIN.ENGAGEMENT_COMPLETED` — force-complete a stuck engagement
  - `ADMIN.CANONICAL_ADDED` — added a port/cert/role
  - `ADMIN.CANONICAL_UPDATED` — updated canonical data
  - `ADMIN.USER_DEACTIVATED` — admin-initiated account deactivation

---

#### 2. Rollback — `supabase/rollbacks/00050_admin_role.down.sql`

- [ ] Drop `is_admin` column
- [ ] Restore previous CHECK constraint (without `'admin'`)

---

#### 3. Admin middleware — `apps/web/src/lib/admin-guard.ts`

- [ ] Create guard function:

  ```typescript
  export async function requireAdmin(request: Request) {
    const guard = await requireDomainUser(request);
    if ('error' in guard) return guard;
    const { person } = guard.value;
    if (!person.is_admin) {
      return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
    }
    return guard;
  }
  ```

  - Reuses existing `requireDomainUser` for auth + domain check
  - Adds admin flag check on top
  - Returns same shape as `requireDomainUser` for ergonomic destructuring

- [ ] Update `requireDomainUser` return type to include `is_admin` in the person object (read it from the persons query)

---

#### 4. Admin API routes

**User lookup — `apps/web/src/app/api/admin/users/route.ts`**

- [ ] `GET /api/admin/users?search=<name>&port_id=<id>&page=<n>`:
  - Uses `requireAdmin` guard
  - Queries `profiles` joined with `persons` (including deactivated — bypasses normal RLS via service client)
  - Supports search by `display_name` (ilike), filter by `location_port_id`
  - Returns paginated results (20 per page): person_id, display_name, identity_type, current_hat, primary_role, port, created_at, deactivated_at, is_admin
  - Service client for RLS bypass

**User detail — `apps/web/src/app/api/admin/users/[personId]/route.ts`**

- [ ] `GET /api/admin/users/:personId`:
  - Full profile + person + subscription status + event count + last activity
  - Includes `deactivated_at` for GDPR status

**Stuck engagements — `apps/web/src/app/api/admin/engagements/route.ts`**

- [ ] `GET /api/admin/engagements?status=active&older_than=<days>`:
  - Lists engagements in `active` status older than N days (default 14)
  - Returns: engagement_id, daywork_id, crew name, employer name, start_date, end_date, days_active
  - Useful for finding engagements where employer forgot to mark complete

**Force complete — `apps/web/src/app/api/admin/engagements/[id]/complete/route.ts`**

- [ ] `POST /api/admin/engagements/:id/complete`:
  - Body: `{ reason: string }` (required — admin must document why)
  - Appends `ADMIN.ENGAGEMENT_COMPLETED` event with `{ engagement_id, reason, admin_person_id }` in payload
  - Triggers same projection updates as `DAYWORK.COMPLETED`: daywork status → completed, engagement status → completed, applications status → completed
  - **Add `ADMIN.ENGAGEMENT_COMPLETED` handler to `apply_projection`** (same logic as DAYWORK.COMPLETED but with admin audit fields in payload)

- [ ] Create migration `supabase/migrations/00051_admin_projection.sql`:
  - `CREATE OR REPLACE FUNCTION apply_projection(...)` adding the `ADMIN.ENGAGEMENT_COMPLETED` handler
  - **CRITICAL:** Diff against migration 00048 (current version). Include ALL existing handlers unchanged.

- [ ] Create rollback `supabase/rollbacks/00051_admin_projection.down.sql`:
  - Restore apply_projection to 00048 version

**Canonical data — `apps/web/src/app/api/admin/canonical/[table]/route.ts`**

- [ ] `GET /api/admin/canonical/:table`:
  - Returns all rows from the specified canonical table
  - Allowed tables: `regions`, `cities`, `ports`, `yacht_roles`, `certifications`, `experience_brackets`, `vessel_size_bands`
  - Validates table name against allowlist (prevents SQL injection)

- [ ] `POST /api/admin/canonical/:table`:
  - Body varies by table (e.g., `{ name, city_id, sort_order }` for ports)
  - Inserts via service client
  - Appends `ADMIN.CANONICAL_ADDED` event for audit
  - Returns the new record

- [ ] `PATCH /api/admin/canonical/:table/:id`:
  - Updates name, sort_order, or parent FK
  - Appends `ADMIN.CANONICAL_UPDATED` event
  - Returns updated record

---

#### 5. Tests

- [ ] Create `__tests__/api/admin-users.test.ts`:
  - 401 unauthenticated
  - 403 non-admin user
  - 200 with results for admin user
  - Search filter works

- [ ] Create `__tests__/api/admin-engagements.test.ts`:
  - 403 for non-admin
  - Lists stuck engagements filtered by days
  - Force-complete appends event and returns 200

- [ ] Create `__tests__/api/admin-canonical.test.ts`:
  - 403 for non-admin
  - Rejects invalid table names
  - GET returns all rows
  - POST creates and returns new record

---

#### 6. Documentation

- [ ] Update `BUILD_STATE.md`:
  - Stage entry: `[Stage 103] Admin tooling — is_admin flag, admin guard, user lookup/search, stuck engagement detection + force-complete, canonical data CRUD, ADMIN.* audit events`
  - Schema version bump to v51
  - Migration table entries for 00050 and 00051
- [ ] Mark P1 #8 (Admin tooling) as `[x]` in `tasks/launch-readiness.md`
- [ ] Update `apps/web/README.md`:
  - Add "Admin API" section documenting all admin routes
- [ ] Update `supabase/README.md`:
  - Migration entries for 00050 and 00051
- [ ] Update `packages/types/README.md` if admin event types are added to shared types

---

### Stage 104: Realtime Messages

**Goal:** Replace the 5-second polling on the chat page with Supabase Realtime subscriptions. Messages appear instantly. Conversations list page remains static (polling not worth the complexity there).

**Will NOT touch:** Messages API routes, message sending logic, push notifications, database schema, RLS.

**Done condition:** New messages appear in chat without polling. Polling interval removed from chat page. Realtime subscription cleaned up on unmount. Falls back to polling if Realtime fails to connect.

---

#### 1. Supabase Realtime config — `supabase/config.toml`

- [ ] Verify Realtime is enabled in config.toml (it should be by default):

  ```toml
  [realtime]
  enabled = true
  ```

  - If not present, add it. Supabase local dev includes Realtime by default.

---

#### 2. Enable Realtime on messages table — migration `supabase/migrations/00052_messages_realtime.sql`

- [ ] Enable Realtime replication for the `messages` table:

  ```sql
  alter publication supabase_realtime add table public.messages;
  ```

  - Supabase Realtime requires tables to be added to the `supabase_realtime` publication
  - RLS policies are automatically enforced on Realtime subscriptions — only engagement participants receive messages

- [ ] Create rollback `supabase/rollbacks/00052_messages_realtime.down.sql`:
  ```sql
  alter publication supabase_realtime drop table public.messages;
  ```

---

#### 3. Realtime hook — `apps/web/src/hooks/use-realtime-messages.ts`

- [ ] Create hook:

  ```typescript
  export function useRealtimeMessages(
    engagementId: string,
    onNewMessage: (message: Message) => void,
  ) {
    // ...
  }
  ```

  - Creates a Supabase Realtime channel subscribed to `messages` table INSERTs filtered by `engagement_id`
  - On new row: calls `onNewMessage(payload.new)` to append to local state
  - Returns `{ isConnected: boolean }` for UI status
  - Cleanup: unsubscribes channel on unmount
  - Uses the browser Supabase client (from `createClient()`) — auth token is automatically included for RLS

  **Subscription filter:**

  ```typescript
  supabase
    .channel(`messages:${engagementId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `engagement_id=eq.${engagementId}`,
      },
      (payload) => {
        onNewMessage(payload.new as Message);
      },
    )
    .subscribe((status) => {
      setIsConnected(status === 'SUBSCRIBED');
    });
  ```

---

#### 4. Update chat page — `apps/web/src/app/(app)/messages/[engagementId]/page.tsx`

- [ ] Replace message polling with Realtime subscription:
  - Remove the `setInterval` for `loadMessages()` (currently every 5 seconds)
  - Keep the initial `loadMessages()` call on mount (still need to load history)
  - Add `useRealtimeMessages(engagementId, handleNewMessage)` hook
  - `handleNewMessage`: append the new message to local state, auto-scroll to bottom, mark as read
  - **Keep context polling** (`loadContext()` every 5 seconds) — engagement context changes (status, checklist, postponement) are infrequent and don't benefit from Realtime

- [ ] Add fallback:
  - If `isConnected` is false after 5 seconds, fall back to message polling (original 5s interval)
  - Show a subtle indicator if using fallback mode (optional — can skip for v1)
  - Log Realtime connection failures to console for debugging

- [ ] Handle duplicate messages:
  - Realtime INSERT + immediate `loadMessages()` after send could produce duplicates
  - Deduplicate by message `id`: before appending from Realtime, check if `id` already exists in local state

---

#### 5. Tests

- [ ] Create `__tests__/hooks/use-realtime-messages.test.ts`:
  - Test: subscribes to correct channel with engagement_id filter
  - Test: calls onNewMessage when INSERT payload received
  - Test: unsubscribes on unmount
  - Mock `supabase.channel()` and `.on()` and `.subscribe()`

---

#### 6. Documentation

- [ ] Update `BUILD_STATE.md`:
  - Stage entry: `[Stage 104] Realtime messages — Supabase Realtime subscription on messages table, replaces 5s polling on chat page, fallback to polling on connection failure, context polling retained`
  - Schema version bump to v52
  - Migration table entry for 00052
- [ ] Mark P1 #10 (Message polling lag) as `[x]` in `tasks/launch-readiness.md`
- [ ] Update `supabase/README.md`:
  - Migration entry for 00052
  - Note: Realtime enabled on messages table
- [ ] Update `apps/web/README.md`:
  - Note Realtime dependency for chat page

---

### Stage 105: Deep Links (Universal Links + App Links)

**Goal:** Add iOS Universal Links and Android App Links verification files so push notification taps open the native app instead of the browser.

**Will NOT touch:** API routes, database, push notification code, Capacitor plugin config.

**Done condition:** `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` are served from the web app. iOS Info.plist and Android AndroidManifest.xml declare the associated domain. Deep link paths match existing push notification routes.

---

#### 1. Apple App Site Association — `apps/web/public/.well-known/apple-app-site-association`

- [ ] Create file (no `.json` extension — Apple requires this):

  ```json
  {
    "applinks": {
      "apps": [],
      "details": [
        {
          "appID": "TEAM_ID.com.dockwalker.app",
          "paths": [
            "/discover",
            "/daywork/*",
            "/messages/*",
            "/availability",
            "/profile",
            "/notifications"
          ]
        }
      ]
    }
  }
  ```

  - `TEAM_ID` is a placeholder — must be replaced with actual Apple Developer Team ID
  - Paths match the deep link routes used in push notifications (`push-triggers.ts`)
  - `apps: []` is required (empty array)

- [ ] Ensure the file is served with `Content-Type: application/json`:
  - Next.js serves files from `public/` as-is
  - Add a rewrite in `vercel.json` if needed to set the correct content type:
    ```json
    {
      "headers": [
        {
          "source": "/.well-known/apple-app-site-association",
          "headers": [{ "key": "Content-Type", "value": "application/json" }]
        }
      ]
    }
    ```

---

#### 2. Android Asset Links — `apps/web/public/.well-known/assetlinks.json`

- [ ] Create file:

  ```json
  [
    {
      "relation": ["delegate_permission/common.handle_all_urls"],
      "target": {
        "namespace": "android_app",
        "package_name": "com.dockwalker.app",
        "sha256_cert_fingerprints": ["PLACEHOLDER_SHA256_FINGERPRINT"]
      }
    }
  ]
  ```

  - `sha256_cert_fingerprints` is a placeholder — must be replaced with actual signing key fingerprint
  - Package name matches `capacitor.config.ts` appId

---

#### 3. iOS config — `apps/web/ios/App/App/Info.plist`

- [ ] Add Associated Domains entitlement (if not already present):
  - This is typically done via Xcode, but the entitlement file can be edited:
  - Check if `apps/web/ios/App/App/App.entitlements` exists
  - Add `com.apple.developer.associated-domains` with value `applinks:PRODUCTION_DOMAIN`
  - **Note:** Exact domain must be filled in when production URL is known

---

#### 4. Android config — `apps/web/android/app/src/main/AndroidManifest.xml`

- [ ] Add intent filter to the main activity for deep link handling:

  ```xml
  <intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https" android:host="PRODUCTION_DOMAIN" />
  </intent-filter>
  ```

  - `android:autoVerify="true"` triggers Android's automatic assetlinks.json verification
  - `PRODUCTION_DOMAIN` is a placeholder

---

#### 5. Tests

- [ ] No automated tests needed — deep link files are static JSON
- [ ] Manual verification: after deployment, use Apple's validator (`https://app-site-association.cdn-apple.com/a/v1/DOMAIN`) and Google's validator (`https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://DOMAIN`)

---

#### 6. Documentation

- [ ] Update `BUILD_STATE.md`:
  - Stage entry: `[Stage 105] Deep links — apple-app-site-association + assetlinks.json, iOS entitlements, Android intent filters (domain placeholders for production)`
- [ ] Mark P2 #11 (Deep links) as `[x]` in `tasks/launch-readiness.md`
- [ ] Update `apps/web/README.md`:
  - Add "Deep Links" section: file locations, placeholder values that need production config

---

### Stage 106: Analytics (Vercel Analytics)

**Goal:** Add Vercel Analytics for basic page view and web vital tracking. Minimal setup, no custom event tracking in this stage.

**Will NOT touch:** API routes, database, components, business logic.

**Done condition:** Vercel Analytics script loads on all pages. Page views and web vitals are tracked. No-ops in local dev.

---

#### 1. Install — `apps/web/`

- [ ] Run `npm install @vercel/analytics` in `apps/web/`

---

#### 2. Add Analytics component — `apps/web/src/app/layout.tsx`

- [ ] Import and add the Analytics component inside the root layout `<body>`:

  ```typescript
  import { Analytics } from '@vercel/analytics/react';
  ```

  ```tsx
  <body>
    {children}
    <Analytics />
  </body>
  ```

  - Vercel Analytics auto-detects the Vercel deployment and self-configures
  - No API key needed — Vercel injects the project ID at build time
  - No-ops in local dev automatically (only active on Vercel deployments)
  - No custom events in this stage — just page views and web vitals

---

#### 3. Speed Insights (optional but free)

- [ ] Run `npm install @vercel/speed-insights` in `apps/web/`
- [ ] Add to root layout alongside Analytics:

  ```typescript
  import { SpeedInsights } from '@vercel/speed-insights/next';
  ```

  ```tsx
  <body>
    {children}
    <Analytics />
    <SpeedInsights />
  </body>
  ```

  - Tracks Core Web Vitals (LCP, FID, CLS) per route
  - Free tier included with Vercel

---

#### 4. Tests

- [ ] No tests needed — analytics is a third-party script injection with no business logic
- [ ] Verify existing tests still pass (Analytics component should render null in test env)

---

#### 5. Documentation

- [ ] Update `BUILD_STATE.md`:
  - Stage entry: `[Stage 106] Analytics — @vercel/analytics + @vercel/speed-insights, page views and web vitals tracking`
- [ ] Mark P2 #12 (Analytics) as `[x]` in `tasks/launch-readiness.md`
- [ ] Update `apps/web/README.md`:
  - Add "Analytics" section: Vercel Analytics (auto-configured on Vercel deployments, no env vars needed)

---

### Stage 107: Avatar Storage Bucket (Production Verification)

**Status: ALREADY IMPLEMENTED — verification only.**

Research confirms avatar storage is fully built (migration 00039, upload route with MIME + magic byte validation, RLS policies, client-side resizing, comprehensive tests). The launch readiness item's concern about "production needs configured bucket" is handled automatically — Supabase migrations create the bucket and policies in any environment.

- [ ] **Verify:** Run `npx supabase db reset` and confirm the `avatars` bucket exists with correct policies
- [ ] **Mark P2 #14 as done** in `tasks/launch-readiness.md` with note: "Already implemented in Stage 39 (migration 00039). Bucket + RLS + upload route + tests all exist. Production bucket is created automatically via migrations."
- [ ] **No stage number needed** — this is a verification task, not a code change

---

## Done

(See git history for completed stages 51-98)
