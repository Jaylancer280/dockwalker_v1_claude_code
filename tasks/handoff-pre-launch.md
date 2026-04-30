# Pre-launch handoff — actions only you can take

> Audit P0/P1 items that require your dashboards / accounts. I (Claude) can't reach Supabase, OpenAI, Anthropic, Vercel, GitHub, Stripe, or your local filesystem from inside the assistant.
>
> Order roughly matches risk × ease. The first three are P0 ship-blockers; the rest are P1.

---

## P0 — Rotate keys, then delete `.env.production.local`

**Why now.** Audit P0-3: that file on your dev disk contains a working Supabase service-role JWT (full RLS bypass), an active OpenAI sk-proj key (direct cost exposure), and presumably the Anthropic key. Even though the file is gitignored, it's still on disk and any future sync mishap (Dropbox / OneDrive / IDE cache) leaks all three.

**Order matters:** rotate first, then delete. If you delete first and then a rotation step fails, the running production has no working key.

### Step 1 — Supabase service-role key

1. Open https://supabase.com/dashboard/project/hwpcuehqawullzqbmcdv/settings/api
2. Click "Reset service role JWT" → confirm. Copy the new key.
3. Open https://vercel.com/[your-team]/dockwalker/settings/environment-variables
4. Find `SUPABASE_SERVICE_ROLE_KEY` (Production scope). Note: Sensitive values can't be edited in place — you have to add a new value with the new content, then remove the old one. Use the per-row Edit menu and select "Remove" on the existing one after adding the new.
5. Wait for Vercel to auto-redeploy (or trigger manually from Deployments).
6. Verify: open the live site, log in as admin, hit `/admin` — should load. Log in as crew, hit `/discover` — should load.

### Step 2 — OpenAI API key

1. https://platform.openai.com/api-keys
2. Find your existing `sk-proj-...` key (the one in `.env.production.local`). Click "Revoke".
3. Click "Create new secret key" → name it `dockwalker-prod` → copy.
4. Vercel → `OPENAI_API_KEY` (Production) → replace value.
5. Verify: open `/docky`, ask "what STCW levels do I need for a 50m yacht?" — should return a real answer. (Embeddings use OpenAI; if revoked correctly the old key, you'd see an error.)

### Step 3 — Anthropic API key

1. https://console.anthropic.com/settings/keys
2. Revoke the existing key, create new (name `dockwalker-prod`).
3. Vercel → `ANTHROPIC_API_KEY` (Production) → replace value.
4. Verify: same Docky test as above. The LLM call uses Anthropic.

### Step 4 — Delete the file

```bash
cd C:\Dev\dockwalker_v1_claude_code
rm apps/web/.env.production.local
git status        # should NOT show this file (it's gitignored)
```

### Step 5 — Audit sync surfaces

```bash
# Check whether the file got synced anywhere it shouldn't be:
ls "C:\Users\wilhe\Dropbox" 2>NUL | findstr env
ls "C:\Users\wilhe\OneDrive" 2>NUL | findstr env
ls "C:\Users\wilhe\iCloudDrive" 2>NUL | findstr env

# Check shell history for accidental key prints:
grep -i "sk-proj\|service_role\|sk-ant" ~/.bash_history ~/.zsh_history 2>/dev/null
```

If any of those find anything, sanitize manually (delete the file from the sync, clear the shell history line). The keys you just rotated are dead anyway, but tidy up so a future reader of those files isn't confused.

---

## P0 — Sentry DSN in Vercel (P0-6)

**Why.** Right now production errors are silently dropped — `apps/web/sentry.{client,server,edge}.config.ts` all gate on `NEXT_PUBLIC_SENTRY_DSN`, and the env var isn't set.

1. https://sentry.io/signup/ → create org if needed.
2. Create project: platform Next.js, name `dockwalker-web`. Copy the **DSN** from the project's Setup Wizard.
3. Sentry → Settings → Account → API → Auth Tokens → "Create New Token" with scopes `project:releases` + `org:read`. Copy.
4. Vercel → Environment Variables (Production scope, all marked Sensitive):
   - `NEXT_PUBLIC_SENTRY_DSN` = the DSN
   - `SENTRY_ORG` = your org slug (e.g. `nautalink`)
   - `SENTRY_PROJECT` = `dockwalker-web`
   - `SENTRY_AUTH_TOKEN` = the token
5. Redeploy.
6. Verify: visit `https://www.dockwalker.io/api/health` — should return `{"sentry": true, ...}`. Then deliberately break something (visit a non-existent route, click an admin action without admin perms) and watch Sentry dashboard — event should appear within 30 seconds.

---

## P1 — GitHub Environment with required reviewer for migration deploys (P1-I1)

**Why.** `.github/workflows/ci.yml` `deploy-migrations` runs `supabase db push` against production on every merge to main. There's no manual approval gate — a bad migration ships unilaterally.

1. https://github.com/NautalinkTechnologiesInc/dockwalker_v1_claude_code/settings/environments → "New environment".
2. Name it `production-database`.
3. Under "Deployment protection rules" → check "Required reviewers" → add yourself.
4. Edit `.github/workflows/ci.yml` (I'll prep the patch — say the word and I push it):
   ```yaml
   deploy-migrations:
     name: Deploy Migrations to Production
     environment: production-database # ← add this line
     if: github.event_name == 'push' && github.ref == 'refs/heads/main'
     needs: [quality, docs, pre-commit-parity, test, database]
     # ... rest unchanged
   ```
5. From this point forward, every push to main with new migrations will pause at the deploy step waiting for your approval click in the GitHub Actions UI. CI runs all the validation gates first; you only see the prompt if everything else passed.

**Tradeoff:** you'll have to click a button on every migration push. If that's too much friction, an alternative is to require a separate label on PRs that contain migration changes — let me know and I'll wire that.

---

## P1 — Stripe webhook URL verification (P1-I5)

**Why.** Lessons file has two prior incidents where the webhook URL was misconfigured (apex 307 + Workbench mode mismatch). One-time verification now prevents launch-day debugging.

```bash
# Should return 405 (method not allowed on GET) — NOT 307:
curl -I https://www.dockwalker.io/api/webhooks/stripe
curl -I https://dockwalker.io/api/webhooks/stripe
```

If either returns 307: Vercel → Project → Settings → Domains → mark `www.dockwalker.io` as Primary and add a permanent (308) redirect from apex.

Then:

1. Stripe Dashboard → Workbench → toggle to **Live mode**.
2. Webhooks → confirm endpoint URL is `https://www.dockwalker.io/api/webhooks/stripe` (not apex).
3. Send a test event ("Send test webhook" from the dashboard) → check Vercel logs that the request landed.
4. Repeat in **Test mode** — the test webhook should be a separate endpoint. If it doesn't exist, create it pointing at the same URL.

---

## P1 — MEMORY.md launch-readiness reference (P1-Doc7)

The user-owned MEMORY.md (`C:\Users\wilhe\.claude\projects\C--Dev-dockwalker-v1-claude-code\memory\MEMORY.md`) references `tasks/launch-readiness.md` in the Planning Artifacts section, but that file doesn't exist in the repo.

Two options:

1. **Create the file.** I can scaffold `tasks/launch-readiness.md` from the audit's P0/P1 status as a tracking checklist. Say the word.
2. **Remove the reference.** Edit MEMORY.md and drop the line `- [Launch readiness assessment](../../tasks/launch-readiness.md) — ...` and the matching entry in `memory/project_launch_readiness.md`.

This is your memory, so I'll only touch it if you say to.

---

## After this list is done

- The audit's P0 + P1 register is closed end-to-end.
- Production has aggregated error tracking (Sentry).
- Migration deploys require human approval.
- All keys have been rotated to known-safe values.
- Stripe is verified delivering webhooks correctly.

Open the audit's P2 polish batch only after launch users are stable.
