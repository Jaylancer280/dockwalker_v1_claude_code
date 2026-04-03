# Feature Spec: DockWalker CV Builder

**Product:** DockWalker
**Owner:** Nautalink Technologies, Inc.
**Status:** Specced — not yet scheduled
**Last updated:** April 2026

---

## 1. Problem Statement

Crew members in the superyacht industry still circulate paper or basic PDF CVs with no connection to verified data. These documents are self-declared, unverifiable, and divorced from any hiring platform. DockWalker has the opportunity to produce a CV that is both beautiful and backed by real data — and that turns every printed copy into a user acquisition event.

---

## 2. Feature Summary

A crew-initiated PDF CV generator that:

- Exports all non-private declared profile data into a professionally formatted PDF
- Embeds a QR code that deeplinks into the DockWalker app (or drives App Store acquisition for non-users)
- Becomes progressively more powerful as DockWalker's verified ledger (IMO-anchored vessel presence, sea time, peer attestation) matures

---

## 3. Goals

| Goal                                                               | Type            |
| ------------------------------------------------------------------ | --------------- |
| Give crew a professional, shareable artifact                       | Core value      |
| Turn every distributed CV into a DockWalker acquisition touchpoint | Growth          |
| Lay the data schema foundation for verified CV fields              | Future-proofing |
| Preserve crew privacy (no contact info, no salary)                 | Trust & safety  |

---

## 4. Out of Scope (Phase 1)

- Shareable web profile page (consider Phase 2)
- Employer-initiated CV export
- CV versioning or named CV variants
- Verified fields (sea time, vessel-presence attestation) — these populate automatically once the ledger exists; schema must accommodate them from day one

---

## 5. Data Shown on CV

All declared, non-private profile data is included. The following fields are **excluded**:

- Email address
- Phone number
- Declared salary / salary expectations
- Any field marked `private: true` in the profile schema

### Phase 1 — Declared (Unverified) Fields

| Section                  | Fields                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| Identity                 | Full name, profile photo, nationality, date of birth (optional), languages                |
| Current status           | Availability status, preferred role(s), preferred vessel type(s), preferred contract type |
| Location                 | Home port / base location                                                                 |
| Certificates & Licences  | Certificate name, issuing body, issue date, expiry date, certificate number (optional)    |
| Experience               | Vessel name, vessel type, GRT/LOA, role held, contract dates, duties summary              |
| Education                | Institution, qualification, year                                                          |
| Skills                   | Free-text skills tags                                                                     |
| Bio / Personal statement | Free-text                                                                                 |

### Phase 2 — Verified Fields (schema ready at Phase 1, populated later)

| Field                     | Verification source                                        |
| ------------------------- | ---------------------------------------------------------- |
| Sea time (days)           | IMO-anchored ledger, vessel presence events                |
| Vessel presence confirmed | Overlapping event ledger, cross-crew attestation           |
| Reference verified        | DockTalk reference call logged, referee identity confirmed |
| Certificate validity      | Third-party cert authority integration (future)            |

> **Implementation note:** All CV data fields must have a `verified: boolean` and `verified_source: string | null` column in the profile/events schema from day one. Phase 1 values will simply have `verified: false`. The PDF template must have a visual "verified" badge slot already designed, shown only when `verified: true`.

---

## 6. QR Code Behaviour

### Generation

- QR encodes a short URL: `dockwalker.io/cv/{crew_handle}` or `dockwalker.io/u/{crew_handle}`
- Short URL is permanent and tied to the crew member's account, not to a specific CV export
- If crew member deactivates account: URL resolves to a graceful "This profile is currently unavailable" page — never a 404

### Destination Logic

| User state                   | QR destination                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| Has DockWalker app installed | Universal Link deeplinks to crew profile in-app                                                        |
| No app, mobile browser       | App Store / Play Store smart banner + lightweight profile teaser (name, role, photo only — rest gated) |
| Desktop browser              | `dockwalker.io/cv/{handle}` — profile teaser + "Download DockWalker" CTA                               |

### Profile Teaser Page (web, non-authenticated)

- Shows: name, profile photo, primary role, nationality, availability badge
- Hides: full experience, certs, contact, everything else
- CTA: "View full profile on DockWalker" → App Store / Play Store
- No login wall on teaser — friction kills acquisition
- Teaser page must be functional before CV builder ships (it's the QR destination)

### In-App Deeplink Behaviour (authenticated viewer)

- Lands on crew's full profile
- Pre-populated message composer: "Hi [name], I'd like to view your full DockWalker profile." (editable)
- Crew receives message request notification — standard messaging consent flow applies
- No automatic profile visibility grant; crew controls this

---

## 7. PDF Design Requirements

- DockWalker branded — dark navy header consistent with app design system, Geist typography
- Two-column layout: left rail for identity/certs/skills, main body for experience
- Profile photo rendered in circle crop, top-left
- Verified badge (shield icon, DockWalker teal) appears inline next to any verified field — greyed out / absent for unverified Phase 1
- QR code printed bottom-right with label: "View on DockWalker"
- Footer: "Generated by DockWalker · dockwalker.io · [generation date]"
- Max 2 pages — layout engine must paginate gracefully if experience list is long
- A4 format (superyacht industry is predominantly European)
- No watermark on Pro tier; consider subtle "Generated with DockWalker Free" footer text on Seafarer tier (evaluate — may be friction vs. acquisition benefit)

---

## 8. Generation Flow (UX)

1. Crew taps "Download CV" from profile or settings
2. Preview screen shown (thumbnail of PDF layout, scrollable)
3. Single "Download PDF" button — no field selection, no toggles (all non-private data included by design)
4. PDF generated server-side, returned as download
5. Native share sheet triggered on mobile (iOS share / Android share)

**No CV editor.** The CV is a direct reflection of the DockWalker profile. To change the CV, the crew member updates their profile. This is intentional — it enforces profile completeness as the quality driver and keeps the data single-source.

---

## 9. Technical Implementation Notes

### PDF Generation

- Server-side only — **do not use client-side PDF libraries** (jsPDF, etc.) — layout consistency and font rendering are non-negotiable
- Recommended: Puppeteer (headless Chrome renders HTML/CSS → PDF) or a dedicated service (e.g. HTML/CSS to PDF via a Supabase Edge Function invoking a render service)
- CV template is an HTML/CSS file rendered server-side, same design tokens as app
- QR code generated server-side (e.g. `qrcode` npm package) and embedded as base64 PNG in the template before render

### URL / Routing

- `/cv/[handle]` route on dockwalker.io (Next.js dynamic route)
- SSR with public profile data only — no auth required to view teaser
- Universal Links configured in `apple-app-site-association` and `assetlinks.json` for deeplink passthrough

### Schema

- Add `cv_fields` metadata to profile tables indicating `verified: boolean`, `verified_source` per field — even if all false at launch
- Add `cv_generated_at: timestamp` to crew profile for analytics
- `cv_qr_handle` should be stable and not change if username changes (use internal UUID-based slug or lock handle on first CV generation)

### Analytics Events (append to event store)

- `cv.generated` — crew generated a CV
- `cv.qr_scanned` — QR scan → web profile visited (UTM param on QR URL)
- `cv.app_store_click` — teaser page CTA clicked
- `cv.deeplink_opened` — app opened via QR deeplink
- `cv.message_request_sent` — message sent via deeplink flow

---

## 10. Tier Availability

| Feature                   | Seafarer (Free)   | Pro Crew |
| ------------------------- | ----------------- | -------- |
| CV generation             | Yes               | Yes      |
| QR code                   | Yes               | Yes      |
| Verified badges (Phase 2) | Read-only display | Full     |
| "Free" footer watermark   | TBD               | No       |

> Verified badge visibility on free tier is a monetisation lever — revisit when Phase 2 ships.

---

## 11. Future State (Post-Ledger)

Once IMO-anchored vessel presence and sea time verification exist, the CV becomes a fundamentally different product:

- **Sea time auto-calculated** from ledger events, displayed as total days and per-vessel breakdown
- **Vessel presence badge** — "presence on this vessel confirmed by overlapping crew ledger"
- **Verified reference** — reference call logged via DockTalk, referee identity confirmed
- **Cert validity** — live expiry status pulled from cert records
- **"DockWalker Verified" seal** on PDF cover — a trust signal no paper CV or competitor PDF can replicate

This is the long-term moat. The CV builder in Phase 1 is infrastructure. The CV builder post-ledger is a product no maritime hiring platform has built.

---

## 12. Open Questions

| Question                                                                             | Owner       | Notes                                                                     |
| ------------------------------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------- |
| Should handle be locked on first CV generation or tied to account UUID?              | Gareth      | UUID-based slug is safer for stability                                    |
| Watermark on free tier — acquisition benefit vs. crew experience friction?           | Gareth      | Test post-launch                                                          |
| Does the teaser page require any legal review (GDPR — public display of name/photo)? | Legal       | Crew implicitly consents by generating CV; verify in T&Cs                 |
| PDF render service — self-hosted Puppeteer via Edge Function, or third-party?        | Engineering | Puppeteer on Vercel has cold-start issues; evaluate render.com or similar |
