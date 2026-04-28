# Ephemeral Document Exchange — Feature Spec

> **Status:** IMPLEMENTED — see migrations `00090_engagement_documents.sql` (table + storage bucket + RLS) and `00091_gdpr_engagement_documents.sql` (PERSON.DATA_SCRUBBED soft-delete handler). Routes live at `apps/web/src/app/api/messages/[engagementId]/documents/`. Retained as architectural reference; not a planning artifact.
> **Scope:** Temporary file sharing in engagement chat threads. Both parties upload, both download, files auto-delete after 48 hours.
> **Decision date:** 2026-04-05.

---

## Why This Exists

The hiring flow breaks at document exchange. Every time.

1. Crew gets accepted/selected
2. Chat opens, logistics discussed
3. Employer: "Can you send me your STCW cert and passport copy?"
4. Crew: "Sure, what's your email?"
5. Exit to email/WhatsApp. Documents exchanged outside DockWalker. Maybe they come back.

This is the last exit point in the end-to-end hiring flow. Discovery, application, review, acceptance, messaging, interviews (voice call) — all inside DockWalker. But the moment someone needs to see a physical certificate, the platform loses them.

Ephemeral document exchange closes this gap. An upload button in the chat thread lets either party share files. The other party downloads them. After 48 hours, the files are deleted from DockWalker's servers. The platform is a pipe for documents, not a filing cabinet.

---

## Why Ephemeral

### DockWalker is legally lightweight. Non-negotiable.

DockWalker is a truth-declared platform. Crew declare their certifications. Employers decide whether to trust those declarations. DockWalker does not verify, inspect, validate, or retain evidence of certification claims. This is by design — it keeps the platform out of the verification liability chain.

Storing documents long-term would change this. A passport copy stored on DockWalker's servers makes DockWalker a data controller for identity documents — the most sensitive category of PII. That triggers:

- GDPR Article 5(1)(e) storage limitation obligations
- Data protection impact assessment requirements
- Right-to-erasure infrastructure for individual documents
- Breach notification obligations for identity document exposure
- Insurance and compliance costs that scale with data volume

**48-hour ephemeral storage avoids all of this.** DockWalker is a data processor during the transfer window — facilitating a handoff that the user initiated, for a purpose the user defined. The documents exist long enough to be downloaded, then they're gone. This is the same legal position as an email provider.

### Why 48 hours, not 72 or longer

- Document exchange happens in the 24-48 hours after acceptance/selection. If you haven't downloaded within 48 hours, the engagement has a problem that longer storage won't fix.
- Every hour a passport copy sits on a server is an hour of liability exposure.
- If someone needs the documents again, the other party re-uploads. The friction of re-uploading is a feature — it means documents don't linger.
- 48 hours covers weekends (uploaded Friday evening, downloaded Monday morning is 60 hours — see grace period below).

**Grace period:** The 48-hour clock starts at upload time. Files uploaded Friday at 18:00 expire Sunday at 18:00. This is tight for weekend uploads. Two options: (A) round up to end-of-day 48 hours after upload (expires Monday 00:00), or (B) keep strict 48 hours and accept that some files expire over weekends. **Recommendation: strict 48 hours.** The notification says "download within 48 hours." If the employer is hiring for Monday, they're checking Saturday. If they're not checking for 3 days, they're not urgent about this hire.

---

## User Flow

### Uploading Documents

1. Either party is in the engagement chat thread (`/messages/[engagementId]`)
2. Next to the message input, a **paperclip/attachment icon** button
3. Tapping opens the native file picker (multi-select enabled)
4. Allowed file types: PDF, JPEG, PNG, WEBP
5. Max 10MB per file, max 10 files per upload
6. Upload progress bar shown per file
7. On completion, a **document message** appears in the chat thread:

```
[Document icon] Sophie uploaded 3 documents
  STCW_Basic_Safety.pdf (2.1 MB) — [Download] [expires in 47h 58m]
  ENG1_Medical.jpg (1.4 MB) — [Download] [expires in 47h 58m]
  Passport.pdf (3.2 MB) — [Download] [expires in 47h 58m]

  "DockWalker does not verify uploaded documents."
```

8. The uploader sees a **Delete** button on each file (can remove before expiry)
9. The other party receives a notification: "Sophie shared 3 documents — download within 48 hours"

### Downloading Documents

1. Recipient taps **Download** on any file
2. The server generates a signed URL (valid 15 minutes) and serves the file with `Content-Disposition: attachment` (forces download, no in-browser preview)
3. Downloaded files are the recipient's responsibility — DockWalker has no control over what happens after download

### After Expiry

- The chat message remains but file links show: **"Expired"** (greyed out, not clickable)
- The message text stays: "Sophie uploaded 3 documents" with filenames and sizes — this preserves the record that documents were exchanged, without retaining the documents themselves
- The files are deleted from Supabase Storage by the cleanup cron
- Re-upload is always available — the crew or employer can share documents again at any time

### Deleting Before Expiry

- The uploader can delete individual files at any time by tapping **Delete** on their own uploads
- Deletion is immediate — the file is removed from storage and the download link shows "Deleted by uploader"
- If the other party already downloaded the file, the deletion only affects the server copy
- This satisfies GDPR right-to-erasure for the upload window — the data subject (uploader) can remove their own documents at any time

---

## Architecture

### Storage: Supabase Storage (Private Bucket)

**Bucket:** `engagement-documents` (new bucket, separate from `avatars`)

**Path convention:** `{engagementId}/{messageId}/{filename}`

**Bucket configuration:**

- **Private** — no public access. All reads go through the API route.
- **RLS:** Service role only. No direct client access to the bucket. All uploads and downloads are mediated by API routes that verify engagement membership.
- **No CDN caching** — documents must not be cached on edge servers. Set `Cache-Control: no-store` on all responses.

This is deliberately more locked down than the avatars bucket (which allows public read). Identity documents must never be publicly accessible, even briefly.

### Database: File Metadata Table

**New table:** `engagement_documents`

```sql
create table public.engagement_documents (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.active_engagements(id),
  message_id uuid not null references public.messages(id),
  uploader_person_id uuid not null references public.persons(id),
  file_name text not null,
  file_size_bytes integer not null,
  mime_type text not null,
  storage_path text not null,
  expires_at timestamptz not null,
  deleted_at timestamptz,           -- null = active, set = soft-deleted
  created_at timestamptz not null default now()
);

-- Index for cleanup cron
create index idx_engagement_documents_expires
  on public.engagement_documents (expires_at)
  where deleted_at is null;

-- Index for per-engagement queries
create index idx_engagement_documents_engagement
  on public.engagement_documents (engagement_id);
```

**RLS policies:**

- SELECT: engagement participants only (join through `active_engagements` on `crew_person_id` or `employer_person_id`)
- INSERT: engagement participants only
- UPDATE: uploader only (for soft-delete via `deleted_at`)
- DELETE: none (rows are soft-deleted, never hard-deleted — metadata retained for audit)

**Why soft delete on metadata?** The file is hard-deleted from storage. The metadata row is soft-deleted (marked with `deleted_at`). This preserves the audit trail: "3 documents were shared on this date, expired/deleted on this date" without retaining any document content. The GDPR export includes metadata only (filename, upload time, expiry time), never file content.

### Migration

**New migration required:**

1. Create `engagement_documents` table with RLS
2. Create `engagement-documents` storage bucket (private, no public access)
3. Storage RLS: service role only (no direct client policies)

**Rollback:** Drop table, drop bucket.

### API Routes

#### `POST /api/messages/[engagementId]/documents`

**Purpose:** Upload one or more files to the engagement.
**Auth:** Required — must be a participant in this engagement.

**Flow:**

1. Validate engagement membership
2. Validate engagement status is `active` (no uploads to completed/cancelled engagements)
3. Rate limit: max 20 files per engagement per 24 hours
4. For each file:
   - Validate magic bytes match declared MIME type (same pattern as avatar upload)
   - Validate file size <= 10MB
   - Validate MIME type in allowlist: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`
   - Upload to Supabase Storage at `{engagementId}/{messageId}/{sanitised_filename}`
5. Create a system message in the chat: `is_system: false` (it's from the user, not the system), with a special `message_type: 'documents'` or a structured payload indicating document references
6. Create `engagement_documents` rows for each file with `expires_at = now() + interval '48 hours'`
7. Call `notifyOnEvent()` — notify the other party: "{name} shared {n} documents — download within 48 hours"

**Response:** `{ messageId, documents: [{ id, fileName, fileSize, expiresAt }] }`

#### `GET /api/messages/[engagementId]/documents/[documentId]/download`

**Purpose:** Generate a signed download URL for a specific document.
**Auth:** Required — must be a participant in this engagement.

**Flow:**

1. Validate engagement membership
2. Fetch document metadata from `engagement_documents`
3. Check `deleted_at` is null — if soft-deleted, return 410 Gone "Deleted by uploader"
4. Check `expires_at > now()` — if expired, return 410 Gone "Document expired"
5. Generate signed URL from Supabase Storage (15-minute expiry)
6. Return redirect or JSON with signed URL
7. Set response headers: `Content-Disposition: attachment; filename="{original_filename}"`, `Cache-Control: no-store`

**Why not serve the file directly?** Signed URLs let the browser handle the download natively (progress bar, save dialog). The API route is the access gate; the actual bytes come from Supabase Storage's CDN (but with `no-store` caching).

#### `DELETE /api/messages/[engagementId]/documents/[documentId]`

**Purpose:** Uploader deletes their own file before expiry.
**Auth:** Required — must be the uploader (`uploader_person_id`).

**Flow:**

1. Validate uploader ownership
2. Delete file from Supabase Storage
3. Set `deleted_at = now()` on the metadata row
4. The chat message is NOT deleted — it stays with the filename but the download link shows "Deleted by uploader"

### Cleanup Cron

**Path:** `apps/web/src/app/api/cron/document-cleanup/route.ts`
**Schedule:** Every 6 hours (Vercel Cron)
**Auth:** `CRON_SECRET` bearer token (same pattern as existing crons)

**Flow:**

1. Query `engagement_documents` where `expires_at < now()` and `deleted_at is null`
2. For each expired document:
   - Delete file from Supabase Storage
   - Set `deleted_at = now()` on the metadata row
3. Log: "{n} expired documents cleaned up"

**Monitoring:** If the cron hasn't run successfully in 12 hours, alert. Add a simple health check: the cron writes `last_cleanup_at` to a config row or logs it. The existing health endpoint can check this.

**Belt and braces:** The download API route independently checks `expires_at` before serving files. Even if the cron is down for days, no expired document can be downloaded. The cron is storage cleanup, not the access gate.

### Cleanup Monitoring

**Path:** Add to existing `GET /api/cron/document-cleanup/route.ts` or separate monitoring endpoint.

After the main cleanup, run a secondary check:

```sql
SELECT count(*) FROM engagement_documents
WHERE expires_at < now() - interval '6 hours'
AND deleted_at IS NULL;
```

If this returns > 0, documents are persisting past the safety margin. Log an error-level alert. This catches:

- Cron failures that weren't noticed
- Storage deletion failures (Supabase outage during cleanup)
- Race conditions between upload and cleanup

---

## Chat Integration

### Message Type

Document uploads appear as chat messages. Two approaches:

**Option A: Structured message type.** Add a `message_type` column to `messages` (`text` | `documents` | `system`). Document messages have `message_type = 'documents'` and the `body` contains a JSON payload with document IDs.

**Option B: Regular message with document references.** The message is a normal text message with body like "Shared 3 documents". The `engagement_documents` table references the `message_id`. The chat UI checks for associated documents when rendering each message.

**Recommendation: Option B.** It avoids a migration on the `messages` table (which is hot — Realtime subscriptions, indexes, RLS). The document metadata lives in its own table. The chat UI does a lightweight join: "does this message have documents attached?" If yes, render the document cards below the message text.

### Chat UI Rendering

Each document message renders as:

```
[Avatar] Sophie Laurent                                    14:32
  Shared 3 documents

  [PDF icon] STCW_Basic_Safety.pdf    2.1 MB    [Download]    47h left
  [IMG icon] ENG1_Medical.jpg         1.4 MB    [Download]    47h left
  [PDF icon] Passport.pdf             3.2 MB    [Download]    47h left

  DockWalker does not verify uploaded documents.

---

  [PDF icon] STCW_Basic_Safety.pdf    2.1 MB    Expired
  [IMG icon] ENG1_Medical.jpg         1.4 MB    Expired
  [PDF icon] Passport.pdf             3.2 MB    Deleted by uploader
```

- **Active files:** Download button + countdown timer (hours remaining, not minutes)
- **Expired files:** Greyed out, "Expired" label, no download button
- **Deleted files:** Greyed out, "Deleted by uploader" label
- **Uploader's view:** Delete button (red X) on each active file they uploaded
- **Disclaimer:** Small, muted text below every document message: "DockWalker does not verify uploaded documents."

### Upload Button Placement

In the chat footer (message input area), add a **paperclip icon** button to the left of the text input. Tapping opens the native file picker with multi-select. The upload begins immediately on file selection (no separate "send" step — the files upload and the document message appears in the thread).

The paperclip button is only visible when the engagement is `active`. Not visible for completed, cancelled, or closed engagements — no document uploads after the working relationship ends.

---

## Notifications

When documents are uploaded, notify the other party:

**In-app notification:**

- Title: "Documents shared"
- Body: "{name} shared {n} documents — download within 48 hours"
- Deep link: `/messages/{engagementId}`

**Email notification:** (if email_enabled in preferences)

- Subject: "{name} shared documents on DockWalker"
- Body: "{name} shared {n} documents in your conversation about {role} — {jobNumber}. Download them within 48 hours."
- CTA: "View in DockWalker" (link to chat)
- Do NOT attach the documents to the email. The email is a notification, not a delivery mechanism.

**Push notification:** (if push tokens exist)

- Same content as in-app, deep links to chat

---

## File Validation

### Allowed Types

| MIME Type         | Extension   | Magic Bytes                 | Max Size |
| ----------------- | ----------- | --------------------------- | -------- |
| `application/pdf` | .pdf        | `%PDF` (25 50 44 46)        | 10 MB    |
| `image/jpeg`      | .jpg, .jpeg | `FF D8 FF`                  | 10 MB    |
| `image/png`       | .png        | `89 50 4E 47`               | 10 MB    |
| `image/webp`      | .webp       | `52 49 46 46...57 45 42 50` | 10 MB    |

**Rejected:** Everything else. No ZIP, DOCX, XLS, EXE, HTML. The allowed types cover: scanned certs (PDF or photo), passport copies (photo or scan), contracts (PDF). DOCX is deliberately excluded — it can contain macros. Employers who need crew to fill out forms should export to PDF.

### Validation Flow

1. Client-side: check file extension and size before upload (fast feedback)
2. Server-side: validate magic bytes match declared MIME type (same pattern as `apps/web/src/app/api/profile/avatar/route.ts`)
3. Server-side: validate file size <= 10MB
4. Reject with clear error: "Only PDF, JPEG, PNG, and WEBP files are allowed" or "File too large (max 10 MB)"

### Filename Sanitisation

Strip path separators, null bytes, and control characters from filenames before storing. Preserve the original filename for display but use the `{engagementId}/{messageId}/{uuid}.{ext}` pattern for storage paths. Never use user-supplied filenames in storage paths.

---

## Rate Limiting

| Limit                                    | Value  | Scope                              |
| ---------------------------------------- | ------ | ---------------------------------- |
| Files per upload                         | 10 max | Per message/upload action          |
| Files per engagement per 24h             | 20 max | Per engagement, rolling 24h window |
| Total upload size per engagement per 24h | 100 MB | Prevents storage abuse             |

These limits are generous for legitimate use (a full set of certs + a contract is 5-8 files, 10-30 MB) but prevent abuse (50 file spam, gigabytes of uploads).

Enforced server-side in the upload route. Query `engagement_documents` for the engagement in the last 24 hours before accepting new uploads.

---

## GDPR Compliance

### Data Retention

- **Document files:** 48 hours from upload, then hard-deleted from Supabase Storage
- **Document metadata:** Soft-deleted (marked with `deleted_at`), retained indefinitely for audit trail. Contains: filename, file size, MIME type, upload time, expiry time, deletion time. Does NOT contain file content.
- **Chat messages referencing documents:** Retained per normal message retention policy (append-only, never deleted except via GDPR data scrub)

### Right to Erasure

- **Uploader:** Can delete individual files at any time via the Delete button. Immediate hard-delete from storage + soft-delete on metadata.
- **PERSON.DATA_SCRUBBED event:** The existing GDPR scrub pipeline must be extended to: (1) hard-delete all files in Supabase Storage where `uploader_person_id = scrubbed_person_id`, (2) set `deleted_at` on all metadata rows, (3) anonymise uploader_person_id in metadata rows (or delete rows entirely).

### Data Subject Access Request

- GDPR export includes document metadata only: filename, upload time, expiry time, engagement context
- Does NOT include file content (files are either expired/deleted, or belong to the uploader who already has them)
- Does NOT include files uploaded BY the other party (those are the other party's data)

### Privacy Policy Update

The privacy policy must state:

- Documents uploaded in chat are stored temporarily (48 hours) and automatically deleted
- DockWalker does not inspect, verify, or process document content
- Document metadata (filename, size, timestamps) is retained for audit purposes
- Users can delete their uploaded documents at any time before the 48-hour expiry

---

## What It Is NOT

- **NOT a document vault.** DockWalker does not store documents long-term. 48 hours, then gone. If crew need persistent document storage, they use their own cloud drive. DockWalker is a transfer pipe.

- **NOT document verification.** DockWalker never inspects, OCRs, validates, or cross-references uploaded documents. The employer downloads the cert, looks at it with their own eyes, and decides. DockWalker's involvement ends at facilitating the transfer. This is non-negotiable — the moment the platform inspects document content, it assumes verification liability.

- **NOT e-signatures.** An employer can upload a contract PDF. The crew can download, print, sign, scan, and upload the signed version. But DockWalker does not provide digital signature functionality (DocuSign, HelloSign, etc.). E-signatures are a separate product with their own legal framework. Out of scope.

- **NOT a general file sharing tool.** The upload is scoped to engagement chat threads and restricted to document file types. It's not Dropbox. No folders, no organisation, no tagging, no search across documents.

- **NOT searchable or indexable.** Uploaded documents are opaque blobs. No full-text search on document content. No metadata extraction beyond filename and MIME type. No "find all crew who uploaded an ENG1." Documents exist in the context of one engagement, visible to two people, for 48 hours.

- **NOT configurable retention.** 48 hours, fixed, for everyone. No "let employers set their own retention period." A patchwork of retention windows is impossible to audit and creates legal risk. One rule, universally applied.

---

## Availability

**Both daywork and permanent engagements.** A daywork employer accepting a deckhand for Monday might need to see their STCW cert before they board. The 48-hour window fits daywork timelines perfectly. There is no reason to restrict this to permanent.

**Active engagements only.** The upload button is only visible when the engagement status is `active`. No uploads to completed, cancelled, or closed engagements. Once the working relationship ends, the document exchange window is over.

**Not gated behind a subscription.** Document exchange is part of the core hiring transaction. Gating it behind a paywall after acceptance/selection is hostile — the employer has already committed. The storage and bandwidth costs are negligible (see capacity planning below). If monetisation is ever needed, gate document-adjacent features (e.g., automated cert verification, document templates) rather than the basic upload.

---

## Capacity Planning

**Assumptions at scale:**

- 100 engagements/day with document exchange
- Average 5 files per engagement, 3 MB average
- Total: 1.5 GB uploaded per day
- With 48h retention: 3 GB steady state in storage
- Supabase Pro includes 100 GB — headroom is 30x

**Bandwidth:**

- Each file downloaded once by the recipient = 1.5 GB/day download
- Supabase Pro includes 250 GB/month bandwidth — 45 GB/month upload + download is well within limits

**At 10x scale (1,000 engagements/day):** 30 GB steady state, 450 GB/month bandwidth. Still within Supabase Pro limits. Beyond that, revisit storage tiers.

---

## Implementation Checklist

**Migration:**

- [ ] Create `engagement_documents` table with RLS policies and indexes
- [ ] Create `engagement-documents` Supabase Storage bucket (private, service role only)
- [ ] Rollback: drop table, drop bucket

**API routes:**

- [ ] `POST /api/messages/[engagementId]/documents` — upload files (validate type, size, magic bytes, rate limit, create metadata rows, create chat message, notify)
- [ ] `GET /api/messages/[engagementId]/documents/[documentId]/download` — signed URL generation (validate membership, check expiry, check deletion, force download headers)
- [ ] `DELETE /api/messages/[engagementId]/documents/[documentId]` — uploader deletes own file (hard-delete storage, soft-delete metadata)

**Cron:**

- [ ] `GET /api/cron/document-cleanup` — runs every 6 hours, deletes expired files from storage, soft-deletes metadata, logs count, monitors for stragglers past safety margin

**Chat UI:**

- [ ] Paperclip/attachment button in chat footer (visible only for active engagements)
- [ ] Multi-file picker with client-side type/size validation
- [ ] Upload progress indicator per file
- [ ] Document message card: file icon, name, size, download button, countdown timer
- [ ] Expired state: greyed out, "Expired" label
- [ ] Deleted state: greyed out, "Deleted by uploader" label
- [ ] Uploader delete button (red X) on own active uploads
- [ ] Disclaimer text: "DockWalker does not verify uploaded documents."

**Notifications:**

- [ ] In-app + push + email notification on document upload: "{name} shared {n} documents — download within 48 hours"

**GDPR:**

- [ ] Extend `PERSON.DATA_SCRUBBED` handler: delete all storage files for person, soft-delete metadata rows
- [ ] Extend GDPR export: include document metadata (not content) for requester's own uploads
- [ ] Update privacy policy text (document retention, no inspection, deletion rights)

**Tests:**

- [ ] Upload: valid files accepted, invalid types rejected, oversize rejected, magic byte mismatch rejected
- [ ] Download: engagement participants can download, non-participants get 403, expired files get 410, deleted files get 410
- [ ] Delete: uploader can delete own files, non-uploader gets 403
- [ ] Rate limits: 11th file in one upload rejected, 21st file in 24h rejected
- [ ] Cleanup cron: expired files deleted from storage, metadata soft-deleted, monitoring alerts on stragglers
- [ ] Integration: upload file, download file, verify storage, wait for expiry, verify deletion
