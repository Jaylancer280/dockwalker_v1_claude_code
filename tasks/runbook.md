# Operational Runbook

> Operational playbooks for incidents and routine ops tasks. Audience: founder running solo before any team is hired. Each section is "you can execute this cold without re-deriving."
>
> **Index**
>
> - [Emergency database rollback](#emergency-database-rollback)
> - [Stripe webhook outage](#stripe-webhook-outage)
> - [Sentry alert spike triage](#sentry-alert-spike-triage)
> - [Key rotation checklist](#key-rotation-checklist)
> - [Database backups + recovery (RTO / RPO)](#database-backups--recovery-rto--rpo)
> - [Vercel deploy rollback](#vercel-deploy-rollback)
> - [Post-incident template](#post-incident-template)

---

## Emergency database rollback

**When to use.** A migration just deployed to production via CI's `deploy-migrations` job and production is broken — Sentry error spike, user reports, stress-test failure. The forward migration applied successfully (otherwise CI would have blocked deploy) but the resulting state has a real-world problem that wasn't caught by the rollback-cycle test.

### Detection signals

- **Sentry error spike** within 5–30 minutes of a deploy. Filter by `tags.module = 'apply_projection'` or by event type if the suspect handler fired the error.
- **User report** of a feature breaking immediately after deploy.
- **Stress-test failure.** Run the relevant `scripts/stress-test-*.ts` against live remote — if the script that exercises the migration's surface fails post-deploy, you have proof.
- **Vercel deploy logs.** Open the Production deploy → Functions tab → look for spike in 5xx on routes that touch the migration's tables.

### Decision criteria — rollback vs hotfix forward

Reach for **hotfix forward** when:

- The bug is in route code (TypeScript) and the migration is fine.
- The bug is small and a fix can land in CI within 30 minutes.
- The migration is purely additive and a forward-fix can compensate without dropping data.

Reach for **rollback** when:

- The migration's `apply_projection` body is broken and projection rows are being written incorrectly.
- A new constraint is rejecting valid writes from production.
- A new RPC is producing wrong results and the affected paths are user-facing.
- You need time to think and the system is bleeding users.

### Rollback commands

Migrations auto-deploy on push to main via `.github/workflows/ci.yml` `deploy-migrations` job. Rollbacks are **not** auto-applied — you have to do this manually.

```bash
# 1. Identify the migration to roll back. Latest is in supabase/migrations/.
ls -1 supabase/migrations/ | tail -3

# 2. Apply the rollback file directly to the linked production project.
#    Requires SUPABASE_ACCESS_TOKEN + SUPABASE_DB_PASSWORD set in shell env.
cd /c/Dev/dockwalker_v1_claude_code
npx supabase link --project-ref hwpcuehqawullzqbmcdv     # if not already linked
npx supabase db query --linked --file supabase/rollbacks/00XXX_<name>.down.sql

# 3. Verify the rollback applied:
npx supabase db query --linked "SELECT count(*) FROM supabase_migrations.schema_migrations;"
# The count should drop by 1 (or however many rollbacks you applied).
```

If you need to roll back **multiple** migrations, apply them in **reverse numeric order** (highest first).

### Verification after rollback

1. **Re-run the relevant stress test** against live remote:
   ```bash
   cd /c/Dev/dockwalker_v1_claude_code
   tsx scripts/stress-test-cv-builder.ts          # adjust to relevant test
   ```
   All checks should pass on the rolled-back state.
2. **Re-check Sentry** — the error spike should subside within 1–2 minutes.
3. **Re-check `/api/health`** — `rate_limiting` and `sentry` should both be `true`. (External uptime monitor should already alert if either flips off.)
4. **Re-check Vercel deploy logs** — 5xx rate should drop.

### After the rollback lands

1. **Revert the bad migration in git**:
   ```bash
   git revert <commit-of-bad-migration>
   git push origin main
   ```
   This re-runs CI but the migration file is gone, so deploy-migrations is a no-op (no new migration to apply).
2. **Open a fix branch** to address the underlying issue, with a new migration (00XXX+1) that re-introduces the change correctly.
3. **Write a post-incident note** ([template below](#post-incident-template)) and add it to the BUILD_STATE Deferred Decisions if the fix is not immediate.

### Last-resort: rollback-of-rollback

If a rollback file itself fails (constraint violation, FK reference, etc.), the audit's P0-1 fix should have caught it via `verify_rollback_cycle.sh` before deploy. If it slipped through:

1. **Don't panic.** The DB is in a partial state. The data is intact; only schema is mid-flight.
2. **Read the rollback file** and execute the steps manually via `npx supabase db query --linked` one statement at a time. Some statements use `IF EXISTS` and are safe to skip; others may require dropping FK references first.
3. **Escalate to Supabase support** if the schema is genuinely stuck (rare).

---

## Stripe webhook outage

**Detection.** Subscription state in app diverges from Stripe Customer Portal — user upgrades/cancels but app doesn't reflect it. Or Stripe dashboard shows webhook events with `307` / `5xx` responses.

**Most likely causes (from past incidents — see `tasks/lessons.md`):**

1. **Apex domain redirect.** Vercel routes `dockwalker.io` → `www.dockwalker.io` with a 307. Stripe doesn't follow redirects on webhook delivery — every event becomes a 307 and gets dropped.
2. **Workbench mode mismatch.** The webhook was created in live mode while testing in test mode (or vice versa). Webhook is silently inactive in the other mode.

**Fix sequence:**

```bash
# 1. Verify the webhook URL doesn't 3xx:
curl -I https://dockwalker.io/api/webhooks/stripe
curl -I https://www.dockwalker.io/api/webhooks/stripe
# A correct URL returns 405 (method not allowed on GET) — NOT 307.

# 2. If apex 307s: in Stripe Dashboard, edit the webhook URL to use www.
#    Don't rely on the apex; Stripe doesn't follow redirects.
```

Verify in Stripe Workbench → Webhooks → Events tab that recent deliveries are 200. If still failing, check Vercel logs for 401 (invalid signature secret) or 500 (handler crash).

**Manual replay.** For events that fired during the outage, Stripe Dashboard → Webhook → Events → click each event → "Resend" button. Or via API:

```bash
stripe events resend <event_id>
```

---

## Sentry alert spike triage

**Detection.** Sentry email/Slack alert fires (you've configured these in Sentry → Alerts).

**Triage decision tree:**

1. **Is this a recent deploy?** Check Vercel → Deployments. If deploy < 30 min ago and error count is climbing, treat as deploy regression — rollback the deploy ([Vercel deploy rollback](#vercel-deploy-rollback)) and investigate.
2. **Is the error stack trace from `apply_projection`?** Database-layer bug — almost certainly the latest migration. Use [Emergency database rollback](#emergency-database-rollback).
3. **Is it a third-party API failure?** (Anthropic 429, OpenAI 503, Twilio 5xx, Resend 503.) Usually transient. Mark the alert as ignored, set a 30-min watch.
4. **Is it a single user hitting an edge case?** Check `event.tags.user_id` — if the same user_id keeps appearing, look at what they were doing. Patch the route's input validation or add a try/catch.
5. **Is rate limiting firing too aggressively?** Check `/api/health` for `rate_limiting: true` and review Upstash dashboard for 429 frequency. May indicate a bot or a legitimate user pattern that needs a higher tier.

**After triage**, add a tag to the Sentry issue (`triaged`, `investigating`, `wontfix`, `fixed`) so future alerts on the same issue group reuse the triage.

---

## Key rotation checklist

**When to rotate:**

- Credentials suspected to have leaked (commit, log, screenshot, support email).
- Quarterly hygiene rotation (Supabase service-role, OpenAI, Anthropic).
- Departing team member (when team grows past one).

**Per-key rotation steps.** Vercel Environment Variables UI has no edit-in-place for `Sensitive` vars — you must add a new value, then remove the old one.

### Supabase service-role key

1. Supabase Dashboard → Project Settings → API → "Reset service role JWT" → copy new key.
2. Vercel → Project Settings → Environment Variables → `SUPABASE_SERVICE_ROLE_KEY` (Production) → mark old version inactive, add new value as Sensitive.
3. **Redeploy** (Vercel auto-redeploys on env change but verify in Deployments).
4. Verify `/api/health` returns 200 and admin routes work end-to-end.

### Anthropic API key

1. console.anthropic.com → Settings → API Keys → revoke old key, create new.
2. Vercel → `ANTHROPIC_API_KEY` (Production) → update value.
3. Redeploy. Verify `/docky` page renders + a question succeeds.

### OpenAI API key

1. platform.openai.com/api-keys → revoke old, create new.
2. Vercel → `OPENAI_API_KEY` (Production) → update value.
3. Redeploy. Verify Docky's MCA RAG path works (Docky page → ask any cert question).

### Stripe keys (live + webhook secret)

Note: Stripe keys are split into publishable + secret + webhook signing.

1. Dashboard → Developers → API keys → Roll secret key (live mode).
2. Vercel → `STRIPE_SECRET_KEY` (Production) → update.
3. Webhook secret: Dashboard → Webhooks → click endpoint → "Roll signing secret".
4. Vercel → `STRIPE_WEBHOOK_SECRET` (Production) → update.
5. Redeploy. Verify a test checkout still succeeds.

### Telegram bot token / webhook secret

1. @BotFather → `/revoke` → confirm → new token issued.
2. Vercel → `TELEGRAM_BOT_TOKEN` (Production) → update.
3. Re-run Telegram `setWebhook` with the new bot token + same webhook secret.

### Notification encryption key

`NOTIFICATION_ENCRYPTION_KEY` encrypts WhatsApp phone numbers in `notification_channels.phone_encrypted`.

**Rotating this key invalidates all stored encrypted phones.** Users who had WhatsApp connected will need to re-verify. For a routine rotation, plan a maintenance window or run a re-encryption script.

```bash
# Generate new key:
openssl rand -hex 32
```

For an emergency rotation (suspected leak): rotate immediately; users will see "WhatsApp connection lost — please re-link" on next notification attempt.

---

## Database backups + recovery (RTO / RPO)

**Provider:** Supabase Pro tier on the linked project (`hwpcuehqawullzqbmcdv`).

**Coverage:**

- **Daily automated backups**, retained for 7 days (Pro tier default).
- **Point-in-time recovery (PITR)** to any moment in the last 7 days, granularity ~2 minutes.

**RTO / RPO:**

- **RPO (Recovery Point Objective):** ~2 minutes — worst case data loss is 2 minutes between PITR snapshots.
- **RTO (Recovery Time Objective):** ~30–60 minutes — Supabase Pro PITR restores typically take 15–30 minutes; add 15 minutes for verification + DNS/cache propagation.

**Restore procedure:**

1. Supabase Dashboard → Database → Backups → Point-in-Time Recovery.
2. Pick the timestamp to restore to. Choose "Restore to this project" (in-place — replaces current DB) OR "Restore to new project" (safer — keeps current DB intact, you swap DNS/env after verification).
3. **Recommended for production incidents:** restore to a new project, verify, then update Vercel env vars to point at the restored project ref. The old (broken) project stays as a forensic artifact for the post-incident review.
4. Verify migrations table on the restored project matches the expected version (compare against `BUILD_STATE.md` § Current Schema Version).

**Caveats:**

- PITR restores the **entire database** to a single timestamp. You can't selectively restore one table.
- Auth users are restored with the database. Sessions issued after the restore point are invalidated — users will need to sign in again.
- Storage objects (avatars, engagement-documents) are NOT covered by PITR. They're in Supabase Storage, separately backed up — losses of avatars/documents would need separate restoration.

---

## Vercel deploy rollback

**When to use.** Bad code deployed to production. The migration is fine (no DB rollback needed) but the new code has a bug.

```bash
# Via Vercel Dashboard:
#   Project → Deployments → find last good deploy → "..." menu → "Promote to Production"
#
# Via CLI:
npx vercel rollback                               # interactive — picks last known good
npx vercel rollback --previous                    # roll back to immediately previous deploy
```

After rollback:

1. Verify `/api/health` returns 200 from the rolled-back code.
2. Verify the user-visible bug is gone.
3. **Don't redeploy main** until the bug is fixed in code — Vercel will auto-redeploy on the next push to main and reintroduce the bug.

To pause auto-deploys while you fix:

- Vercel → Project Settings → Git → "Production Branch" → temporarily change to a branch that doesn't exist (e.g. `main-paused`). Re-set to `main` when ready.

---

## Post-incident template

After every production incident, write a short post-incident note. Copy this template into a new `tasks/incidents/YYYY-MM-DD-<short-name>.md`:

```markdown
# Incident — YYYY-MM-DD <short name>

## Summary

One sentence: what broke, who saw it, how long it lasted.

## Detection

- How did we find out? (Sentry alert / user report / proactive monitoring)
- Time to detection: HH:MM minutes from deploy / event start

## Impact

- Affected users / requests / features
- Severity: P0 (full outage) / P1 (major feature broken) / P2 (minor degradation)

## Root cause

What actually went wrong, with the migration / commit / config change identified.

## Resolution

- Time to mitigation: HH:MM
- What we did to stop the bleeding (rollback / hotfix / restart)
- Time to full recovery: HH:MM

## Action items

- [ ] **Prevent recurrence.** What test / lint rule / CI check would have caught this?
- [ ] **Improve detection.** What alert / monitor would have caught this faster?
- [ ] **Update this runbook.** Was the runbook section that covers this incident accurate? If not, update it now.

## Lessons

- 1–3 bullets, written in the same style as `tasks/lessons.md` so they can be promoted there if structural.
```

---

> Last reviewed: 2026-04-30 (initial version, pre-launch)
