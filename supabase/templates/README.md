# Supabase Auth Email Templates

Branded HTML for the emails Supabase sends itself — signup confirmation,
password reset, email-change confirmation. These are **not** sent by DockWalker
application code and therefore bypass the transactional email stack in
`apps/web/src/lib/email/`.

## Templates

| File                | Supabase auth event | When it fires                           |
| ------------------- | ------------------- | --------------------------------------- |
| `confirmation.html` | Signup confirmation | New user signs up with email+password   |
| `recovery.html`     | Password recovery   | User hits `/auth/forgot-password`       |
| `email_change.html` | Email change        | User changes the email on their account |

## How they get sent

Supabase's Auth service renders these via Go `text/template` when an auth event
fires and dispatches via whatever SMTP provider is configured in the project's
Auth settings (currently Supabase built-in SMTP; when `RESEND_API_KEY` is set
up and Resend is wired as the Supabase SMTP provider, these flow through
Resend too).

Because the templates live in the Supabase **dashboard**, not our filesystem,
changes here do **not** deploy automatically. They must be copied by hand
after every edit.

## Deploying changes

1. Edit the `.html` file in this directory.
2. Supabase Dashboard → Project → Authentication → Email Templates.
3. For each of the three templates above:
   - Select the matching template (Confirm signup / Reset password / Change email).
   - Paste the full HTML into the `Message body (HTML)` field.
   - Confirm the `Subject heading` matches what you want (not pulled from the file).
   - Save.
4. Send yourself a test email via the preview button or a real trigger to
   verify the logo renders and the links resolve.

## Template variables

Supabase's Go `text/template` syntax — leave these intact when editing:

- `{{ .ConfirmationURL }}` — link with auth token; used by the CTA button
- `{{ .SiteURL }}` — site URL from dashboard config; used for the logo src
- `{{ .Token }}` — 6-digit OTP (unused today; available if we switch to code-entry UX)
- `{{ .Email }}` — user's email
- `{{ .RedirectTo }}` — value passed by client at auth time

## Design parity with transactional emails

These match the transactional email look shipped in Fix 222c:

- Dark `#111a24` header with the white DockWalker logo (same file path)
- `#2d7de0` accent/CTA
- Hidden preheader span for inbox preview text
- `#1e293b` / `#475569` body text

Two deliberate differences:

- **No "Manage notifications" footer** — these are transactional security
  emails, users cannot opt out (and shouldn't try to).
- **Full confirmation URL shown in body** — belt-and-braces for users whose
  mail client strips or mangles the CTA button.

## What's NOT here

Templates that the codebase doesn't currently use are deliberately omitted:

- Invite — admin-invite flow not implemented; onboarding is self-service
- Magic link — sign-in is password-based, magic links disabled
- Reauthentication — sensitive-action reauth not wired

If any of those auth flows get turned on, add the template here + copy to
dashboard before enabling the flow.
